import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const securityAuditLogsTable = pgTable("security_audit_logs", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  outcome: text("outcome").notNull(),
  actorUserId: integer("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  actorUsername: text("actor_username"),
  targetUserId: integer("target_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  targetUsername: text("target_username"),
  requestPath: text("request_path"),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SecurityAuditLogRecord = typeof securityAuditLogsTable.$inferSelect;
