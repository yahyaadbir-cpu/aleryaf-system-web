import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { invoicesTable } from "./invoices";

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  username: text("username"),
  isAdmin: integer("is_admin").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
});

export const notificationEventsTable = pgTable("notification_events", {
  id: serial("id").primaryKey(),
  eventKey: text("event_key").notNull().unique(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: text("audience").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invoicePrintEventsTable = pgTable("invoice_print_events", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }).unique(),
  printedBy: text("printed_by"),
  printedAt: timestamp("printed_at").notNull().defaultNow(),
});

export type PushSubscriptionRecord = typeof pushSubscriptionsTable.$inferSelect;
export type NotificationEventRecord = typeof notificationEventsTable.$inferSelect;
export type InvoicePrintEventRecord = typeof invoicePrintEventsTable.$inferSelect;
