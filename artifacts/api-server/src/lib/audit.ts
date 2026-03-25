import crypto from "node:crypto";
import type { Request } from "express";
import { db, securityAuditLogsTable } from "@workspace/db";
import { logger } from "./logger";
import { appEnv } from "./env";

type SecurityAuditEventInput = {
  req?: Request;
  eventType: string;
  outcome: "success" | "failure" | "blocked";
  actorUserId?: number | null;
  actorUsername?: string | null;
  targetUserId?: number | null;
  targetUsername?: string | null;
  metadata?: Record<string, unknown>;
};

function hashIp(ip: string | null | undefined) {
  if (!ip) return null;
  return crypto.createHmac("sha256", appEnv.SESSION_SECRET).update(ip).digest("hex");
}

export async function writeSecurityAuditEvent(input: SecurityAuditEventInput) {
  const requestPath = input.req?.originalUrl ?? input.req?.url ?? null;
  const userAgent = input.req?.get("user-agent") ?? null;
  const ipHash = hashIp(input.req?.ip);

  await db.insert(securityAuditLogsTable).values({
    eventType: input.eventType,
    outcome: input.outcome,
    actorUserId: input.actorUserId ?? null,
    actorUsername: input.actorUsername ?? null,
    targetUserId: input.targetUserId ?? null,
    targetUsername: input.targetUsername ?? null,
    requestPath,
    ipHash,
    userAgent,
    metadata: input.metadata ?? null,
    createdAt: new Date(),
  });

  logger.info(
    {
      securityEvent: {
        eventType: input.eventType,
        outcome: input.outcome,
        actorUserId: input.actorUserId ?? null,
        actorUsername: input.actorUsername ?? null,
        targetUserId: input.targetUserId ?? null,
        targetUsername: input.targetUsername ?? null,
        requestPath,
        ipHash,
        metadata: input.metadata ?? null,
      },
    },
    "Security audit event",
  );
}
