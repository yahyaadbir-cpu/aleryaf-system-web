import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: integer("is_admin").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  canUseTurkishInvoices: integer("can_use_turkish_invoices").notNull().default(0),
  sessionVersion: integer("session_version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

export const authSessionsTable = pgTable("auth_sessions", {
  id: serial("id").primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  username: text("username").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sessionVersion: integer("session_version").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
});

export const userInvitesTable = pgTable("user_invites", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  invitedUsername: text("invited_username").notNull().unique(),
  isAdmin: integer("is_admin").notNull().default(0),
  canUseTurkishInvoices: integer("can_use_turkish_invoices").notNull().default(0),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdByUsername: text("created_by_username"),
  expiresAt: timestamp("expires_at").notNull(),
  redeemedAt: timestamp("redeemed_at"),
  redeemedByUserId: integer("redeemed_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type UserRecord = typeof usersTable.$inferSelect;
export type AuthSessionRecord = typeof authSessionsTable.$inferSelect;
export type UserInviteRecord = typeof userInvitesTable.$inferSelect;
