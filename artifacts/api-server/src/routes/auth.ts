import { Router, type IRouter } from "express";
import { z } from "zod";
import { activityLogTable, db } from "@workspace/db";
import {
  authenticateUser,
  clearSession,
  createSession,
  getAuthenticatedUserFromRequest,
  getSessionTokenFromRequest,
  HAS_CONFIGURED_ADMIN_BOOTSTRAP,
} from "../lib/auth";
import { createRateLimitMiddleware } from "../lib/rate-limit";
import { writeSecurityAuditEvent } from "../lib/audit";
import { redeemInvite } from "../lib/invites";

const router: IRouter = Router();

const loginBodySchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const redeemInviteBodySchema = z.object({
  token: z.string().min(20),
  username: z.string().trim().min(1),
  password: z.string().min(12).max(128),
});

const loginRateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 8,
  blockDurationMs: 15 * 60 * 1000,
  keyPrefix: "login",
  eventType: "auth.login_rate_limit",
  message: "محاولات كثيرة لتسجيل الدخول. حاول مرة أخرى بعد قليل.",
  includeUsername: true,
});

const inviteRedeemRateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  blockDurationMs: 15 * 60 * 1000,
  keyPrefix: "invite-redeem",
  eventType: "auth.invite_redeem_rate_limit",
  message: "محاولات كثيرة لاستخدام الدعوة. حاول مرة أخرى بعد قليل.",
  includeUsername: true,
});

router.get("/csrf", (_req, res) => {
  res.status(204).send();
});

router.get("/bootstrap-status", (_req, res) => {
  res.json({
    adminBootstrapConfigured: HAS_CONFIGURED_ADMIN_BOOTSTRAP,
  });
});

router.get("/me", async (req, res) => {
  try {
    const user = await getAuthenticatedUserFromRequest(req);
    if (!user) {
      res.status(401).json({ user: null });
      return;
    }

    res.json({ user });
  } catch (err) {
    req.log.error({ err }, "Failed to load current user");
    res.status(500).json({ error: "Failed to load current user" });
  }
});

router.post("/login", loginRateLimit, async (req, res) => {
  try {
    const body = loginBodySchema.parse(req.body);
    const result = await authenticateUser(body.username, body.password);

    if (!result.ok) {
      await writeSecurityAuditEvent({
        req,
        eventType: "auth.login",
        outcome: "failure",
        actorUsername: body.username,
      });
      res.status(401).json({ error: result.error });
      return;
    }

    await createSession(result.user, res);
    await db.insert(activityLogTable).values({
      username: result.user.username,
      action: "تسجيل دخول",
      details: result.user.isAdmin ? "دخول بحساب إداري" : "دخول بحساب مستخدم",
    });
    await writeSecurityAuditEvent({
      req,
      eventType: "auth.login",
      outcome: "success",
      actorUserId: result.user.id,
      actorUsername: result.user.username,
      metadata: {
        isAdmin: result.user.isAdmin,
      },
    });
    res.json({ user: result.user });
  } catch (err) {
    req.log.error({ err }, "Failed to login");
    res.status(500).json({ error: "Failed to login" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const user = await getAuthenticatedUserFromRequest(req);
    const sessionToken = getSessionTokenFromRequest(req) ?? undefined;
    await clearSession(sessionToken, res);
    if (user) {
      await db.insert(activityLogTable).values({
        username: user.username,
        action: "تسجيل خروج",
      });
      await writeSecurityAuditEvent({
        req,
        eventType: "auth.logout",
        outcome: "success",
        actorUserId: user.id,
        actorUsername: user.username,
      });
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to logout");
    res.status(500).json({ error: "Failed to logout" });
  }
});

router.post("/invites/redeem", inviteRedeemRateLimit, async (req, res) => {
  try {
    const body = redeemInviteBodySchema.parse(req.body);
    const result = await redeemInvite(body);

    if (!result.ok) {
      await writeSecurityAuditEvent({
        req,
        eventType: "auth.invite_redeem",
        outcome: "failure",
        actorUsername: body.username,
      });
      res.status(400).json({ error: result.error });
      return;
    }

    await createSession(result.user, res);
    await db.insert(activityLogTable).values({
      username: result.user.username,
      action: "استخدام دعوة",
      details: result.user.isAdmin ? "إنشاء حساب إداري عبر دعوة" : "إنشاء حساب مستخدم عبر دعوة",
    });
    await writeSecurityAuditEvent({
      req,
      eventType: "auth.invite_redeem",
      outcome: "success",
      actorUserId: result.user.id,
      actorUsername: result.user.username,
      metadata: {
        inviteId: result.invite.id,
        invitedBy: result.invite.createdByUsername,
      },
    });
    res.status(201).json({ user: result.user });
  } catch (err) {
    req.log.error({ err }, "Failed to redeem invite");
    res.status(500).json({ error: "Failed to redeem invite" });
  }
});

export default router;
