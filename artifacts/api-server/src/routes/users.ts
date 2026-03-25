import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, userInvitesTable, usersTable } from "@workspace/db";
import { normalizeUsername, requireAdmin, revokeUserSessions, hashPasswordForStorage } from "../lib/auth";
import { createRateLimitMiddleware } from "../lib/rate-limit";
import { writeSecurityAuditEvent } from "../lib/audit";
import { createInviteToken, hashInviteToken } from "../lib/invites";

const router: IRouter = Router();

const sensitiveAdminRateLimit = createRateLimitMiddleware({
  windowMs: 10 * 60 * 1000,
  maxRequests: 50,
  blockDurationMs: 10 * 60 * 1000,
  keyPrefix: "admin-sensitive",
  eventType: "admin.rate_limit",
  message: "عدد كبير من العمليات الإدارية الحساسة. حاول مرة أخرى بعد قليل.",
});

const createInviteBodySchema = z.object({
  username: z.string().trim().min(1).max(128),
  isAdmin: z.boolean().optional().default(false),
  canUseTurkishInvoices: z.boolean().optional().default(false),
  expiresInHours: z.coerce.number().int().min(1).max(168).optional().default(24),
});

const updateStatusBodySchema = z.object({
  isActive: z.boolean(),
});

const updatePermissionBodySchema = z.object({
  canUseTurkishInvoices: z.boolean(),
});

const updateRoleBodySchema = z.object({
  isAdmin: z.boolean(),
});

const updatePasswordBodySchema = z.object({
  password: z.string().min(12).max(128),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const inviteIdParamSchema = z.object({
  inviteId: z.coerce.number().int().positive(),
});

router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        isAdmin: usersTable.isAdmin,
        isActive: usersTable.isActive,
        canUseTurkishInvoices: usersTable.canUseTurkishInvoices,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
        lastLoginAt: usersTable.lastLoginAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.lastLoginAt), desc(usersTable.createdAt), desc(usersTable.id));

    res.json(
      users.map((user) => ({
        ...user,
        isAdmin: user.isAdmin === 1,
        isActive: user.isActive === 1,
        canUseTurkishInvoices: user.canUseTurkishInvoices === 1,
      })),
    );
  } catch {
    res.status(500).json({ error: "Failed to load users" });
  }
});

router.get("/invites", async (_req, res) => {
  try {
    const now = new Date();
    const invites = await db
      .select({
        id: userInvitesTable.id,
        invitedUsername: userInvitesTable.invitedUsername,
        isAdmin: userInvitesTable.isAdmin,
        canUseTurkishInvoices: userInvitesTable.canUseTurkishInvoices,
        createdByUsername: userInvitesTable.createdByUsername,
        expiresAt: userInvitesTable.expiresAt,
        createdAt: userInvitesTable.createdAt,
        redeemedAt: userInvitesTable.redeemedAt,
        revokedAt: userInvitesTable.revokedAt,
      })
      .from(userInvitesTable)
      .orderBy(desc(userInvitesTable.createdAt));

    res.json(
      invites.map((invite) => ({
        ...invite,
        isAdmin: invite.isAdmin === 1,
        canUseTurkishInvoices: invite.canUseTurkishInvoices === 1,
        isRedeemable: !invite.redeemedAt && !invite.revokedAt && invite.expiresAt > now,
      })),
    );
  } catch {
    res.status(500).json({ error: "Failed to load invites" });
  }
});

router.post("/invites", sensitiveAdminRateLimit, async (req, res) => {
  try {
    const body = createInviteBodySchema.parse(req.body);
    const username = normalizeUsername(body.username);
    const token = createInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000);

    const [existingUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);
    if (existingUser) {
      res.status(409).json({ error: "Username already exists" });
      return;
    }

    const [existingInvite] = await db
      .select({ id: userInvitesTable.id })
      .from(userInvitesTable)
      .where(
        and(
          eq(userInvitesTable.invitedUsername, username),
          isNull(userInvitesTable.redeemedAt),
          isNull(userInvitesTable.revokedAt),
          gt(userInvitesTable.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (existingInvite) {
      res.status(409).json({ error: "An active invite already exists for this username" });
      return;
    }

    const [invite] = await db
      .insert(userInvitesTable)
      .values({
        tokenHash,
        invitedUsername: username,
        isAdmin: body.isAdmin ? 1 : 0,
        canUseTurkishInvoices: body.canUseTurkishInvoices ? 1 : 0,
        createdByUserId: req.authUser?.id ?? null,
        createdByUsername: req.authUser?.username ?? null,
        expiresAt,
        createdAt: new Date(),
      })
      .returning({
        id: userInvitesTable.id,
        invitedUsername: userInvitesTable.invitedUsername,
        isAdmin: userInvitesTable.isAdmin,
        canUseTurkishInvoices: userInvitesTable.canUseTurkishInvoices,
        createdByUsername: userInvitesTable.createdByUsername,
        expiresAt: userInvitesTable.expiresAt,
        createdAt: userInvitesTable.createdAt,
      });

    await writeSecurityAuditEvent({
      req,
      eventType: "user.invite_create",
      outcome: "success",
      actorUserId: req.authUser?.id ?? null,
      actorUsername: req.authUser?.username ?? null,
      targetUsername: username,
      metadata: {
        inviteId: invite.id,
        isAdmin: body.isAdmin,
        canUseTurkishInvoices: body.canUseTurkishInvoices,
      },
    });

    res.status(201).json({
      ...invite,
      isAdmin: invite.isAdmin === 1,
      canUseTurkishInvoices: invite.canUseTurkishInvoices === 1,
      token,
    });
  } catch {
    res.status(500).json({ error: "Failed to create invite" });
  }
});

router.post("/:id/revoke-sessions", sensitiveAdminRateLimit, async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const [targetUser] = await db
      .select({ id: usersTable.id, username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await revokeUserSessions(id, { incrementSessionVersion: true });
    await writeSecurityAuditEvent({
      req,
      eventType: "user.session_revoke",
      outcome: "success",
      actorUserId: req.authUser?.id ?? null,
      actorUsername: req.authUser?.username ?? null,
      targetUserId: targetUser.id,
      targetUsername: targetUser.username,
    });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to revoke sessions" });
  }
});

router.post("/invites/:inviteId/revoke", sensitiveAdminRateLimit, async (req, res) => {
  try {
    const { inviteId } = inviteIdParamSchema.parse(req.params);
    const [invite] = await db
      .update(userInvitesTable)
      .set({ revokedAt: new Date() })
      .where(eq(userInvitesTable.id, inviteId))
      .returning({
        id: userInvitesTable.id,
        invitedUsername: userInvitesTable.invitedUsername,
      });

    if (!invite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    await writeSecurityAuditEvent({
      req,
      eventType: "user.invite_revoke",
      outcome: "success",
      actorUserId: req.authUser?.id ?? null,
      actorUsername: req.authUser?.username ?? null,
      targetUsername: invite.invitedUsername,
      metadata: { inviteId: invite.id },
    });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to revoke invite" });
  }
});

router.patch("/:id/status", sensitiveAdminRateLimit, async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { isActive } = updateStatusBodySchema.parse(req.body);

    const [targetUser] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        isAdmin: usersTable.isAdmin,
      })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (targetUser.isAdmin === 1 && !isActive) {
      res.status(400).json({ error: "Admin accounts cannot be disabled" });
      return;
    }

    if (req.authUser?.id === id && !isActive) {
      res.status(400).json({ error: "You cannot disable your own account" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({
        isActive: isActive ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        isAdmin: usersTable.isAdmin,
        isActive: usersTable.isActive,
        canUseTurkishInvoices: usersTable.canUseTurkishInvoices,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
        lastLoginAt: usersTable.lastLoginAt,
      });

    await revokeUserSessions(id, { incrementSessionVersion: true });
    await writeSecurityAuditEvent({
      req,
      eventType: "user.status_change",
      outcome: "success",
      actorUserId: req.authUser?.id ?? null,
      actorUsername: req.authUser?.username ?? null,
      targetUserId: updated.id,
      targetUsername: updated.username,
      metadata: { isActive },
    });

    res.json({
      ...updated,
      isAdmin: updated.isAdmin === 1,
      isActive: updated.isActive === 1,
      canUseTurkishInvoices: updated.canUseTurkishInvoices === 1,
    });
  } catch {
    res.status(500).json({ error: "Failed to update user status" });
  }
});

router.patch("/:id/turkish-invoices", sensitiveAdminRateLimit, async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { canUseTurkishInvoices } = updatePermissionBodySchema.parse(req.body);

    const [updated] = await db
      .update(usersTable)
      .set({
        canUseTurkishInvoices: canUseTurkishInvoices ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        isAdmin: usersTable.isAdmin,
        isActive: usersTable.isActive,
        canUseTurkishInvoices: usersTable.canUseTurkishInvoices,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
        lastLoginAt: usersTable.lastLoginAt,
      });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await revokeUserSessions(id, { incrementSessionVersion: true });
    await writeSecurityAuditEvent({
      req,
      eventType: "user.permission_change",
      outcome: "success",
      actorUserId: req.authUser?.id ?? null,
      actorUsername: req.authUser?.username ?? null,
      targetUserId: updated.id,
      targetUsername: updated.username,
      metadata: { canUseTurkishInvoices },
    });

    res.json({
      ...updated,
      isAdmin: updated.isAdmin === 1,
      isActive: updated.isActive === 1,
      canUseTurkishInvoices: updated.canUseTurkishInvoices === 1,
    });
  } catch {
    res.status(500).json({ error: "Failed to update Turkish invoice access" });
  }
});

router.patch("/:id/role", sensitiveAdminRateLimit, async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { isAdmin } = updateRoleBodySchema.parse(req.body);

    if (req.authUser?.id === id && !isAdmin) {
      res.status(400).json({ error: "You cannot remove your own admin role" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({
        isAdmin: isAdmin ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        isAdmin: usersTable.isAdmin,
        isActive: usersTable.isActive,
        canUseTurkishInvoices: usersTable.canUseTurkishInvoices,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
        lastLoginAt: usersTable.lastLoginAt,
      });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await revokeUserSessions(id, { incrementSessionVersion: true });
    await writeSecurityAuditEvent({
      req,
      eventType: "user.role_change",
      outcome: "success",
      actorUserId: req.authUser?.id ?? null,
      actorUsername: req.authUser?.username ?? null,
      targetUserId: updated.id,
      targetUsername: updated.username,
      metadata: { isAdmin },
    });

    res.json({
      ...updated,
      isAdmin: updated.isAdmin === 1,
      isActive: updated.isActive === 1,
      canUseTurkishInvoices: updated.canUseTurkishInvoices === 1,
    });
  } catch {
    res.status(500).json({ error: "Failed to update role" });
  }
});

router.patch("/:id/password", sensitiveAdminRateLimit, async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { password } = updatePasswordBodySchema.parse(req.body);

    const [updated] = await db
      .update(usersTable)
      .set({
        passwordHash: hashPasswordForStorage(password),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        username: usersTable.username,
      });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await revokeUserSessions(id, { incrementSessionVersion: true });
    await writeSecurityAuditEvent({
      req,
      eventType: "user.password_change",
      outcome: "success",
      actorUserId: req.authUser?.id ?? null,
      actorUsername: req.authUser?.username ?? null,
      targetUserId: updated.id,
      targetUsername: updated.username,
    });

    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to update password" });
  }
});

router.delete("/:id", sensitiveAdminRateLimit, async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);

    if (req.authUser?.id === id) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }

    const [targetUser] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        isAdmin: usersTable.isAdmin,
      })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (targetUser.isAdmin === 1) {
      res.status(400).json({ error: "Admin accounts cannot be deleted" });
      return;
    }

    await revokeUserSessions(id, { incrementSessionVersion: true });
    await db.delete(usersTable).where(eq(usersTable.id, id));
    await writeSecurityAuditEvent({
      req,
      eventType: "user.delete",
      outcome: "success",
      actorUserId: req.authUser?.id ?? null,
      actorUsername: req.authUser?.username ?? null,
      targetUserId: targetUser.id,
      targetUsername: targetUser.username,
    });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
