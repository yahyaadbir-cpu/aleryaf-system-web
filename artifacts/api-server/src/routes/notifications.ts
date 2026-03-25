import { Router, type IRouter } from "express";
import { z } from "zod";
import { GetInvoiceParams } from "@workspace/api-zod";
import { db, invoicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  deactivatePushSubscription,
  getPushPublicKey,
  markInvoicePrinted,
  sendNotification,
  upsertPushSubscription,
} from "../lib/push-notifications";
import { createRateLimitMiddleware } from "../lib/rate-limit";
import { writeSecurityAuditEvent } from "../lib/audit";

const router: IRouter = Router();
const adminBroadcastRateLimit = createRateLimitMiddleware({
  windowMs: 10 * 60 * 1000,
  maxRequests: 15,
  blockDurationMs: 10 * 60 * 1000,
  keyPrefix: "admin-broadcast",
  eventType: "notifications.broadcast_rate_limit",
  message: "عدد كبير من محاولات الإرسال الإداري. حاول مرة أخرى بعد قليل.",
});

const subscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  userAgent: z.string().optional().nullable(),
});

const unregisterSchema = z.object({
  endpoint: z.string().url(),
});

const broadcastSchema = z.object({
  audience: z.enum(["admin", "all"]).default("all"),
  title: z.string().trim().min(1).max(140),
  body: z.string().trim().min(1).max(500),
  url: z.string().trim().max(300).optional().default("/"),
  tag: z.string().trim().max(120).optional().default(""),
});

router.get("/public-key", (_req, res) => {
  res.json({ publicKey: getPushPublicKey() });
});

router.post("/subscriptions", async (req, res) => {
  try {
    const body = subscriptionSchema.parse(req.body);
    const subscription = body.subscription;

    await upsertPushSubscription({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      username: req.authUser?.username ?? null,
      isAdmin: !!req.authUser?.isAdmin,
      userAgent: body.userAgent ?? null,
    });

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to register push subscription");
    res.status(500).json({ error: "Failed to register subscription" });
  }
});

router.post("/subscriptions/unregister", async (req, res) => {
  try {
    const { endpoint } = unregisterSchema.parse(req.body);

    await deactivatePushSubscription(endpoint);
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to unregister push subscription");
    res.status(500).json({ error: "Failed to unregister subscription" });
  }
});

router.post("/broadcast", adminBroadcastRateLimit, async (req, res) => {
  try {
    if (!req.authUser?.isAdmin) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const payload = broadcastSchema.parse(req.body);

    await sendNotification({
      type: payload.audience === "admin" ? "manual-admin-broadcast" : "manual-broadcast",
      audience: payload.audience,
      payload: {
        title: payload.title,
        body: payload.body,
        url: payload.url || "/",
        tag: payload.tag || `manual-broadcast-${Date.now()}`,
      },
    });
    await writeSecurityAuditEvent({
      req,
      eventType: "notifications.broadcast",
      outcome: "success",
      actorUserId: req.authUser.id,
      actorUsername: req.authUser.username,
      metadata: {
        audience: payload.audience,
        title: payload.title,
      },
    });

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to send manual push notification");
    res.status(500).json({ error: "Failed to send push notification" });
  }
});

router.post("/invoices/:id/printed", async (req, res) => {
  try {
    const { id } = GetInvoiceParams.parse(req.params);
    const [invoice] = await db
      .select({ id: invoicesTable.id })
      .from(invoicesTable)
      .where(eq(invoicesTable.id, id))
      .limit(1);

    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const created = await markInvoicePrinted(id, req.authUser?.username ?? req.body?.username ?? null);
    res.json({ ok: true, created });
  } catch (err) {
    req.log.error({ err }, "Failed to mark invoice as printed");
    res.status(500).json({ error: "Failed to mark invoice as printed" });
  }
});

export default router;
