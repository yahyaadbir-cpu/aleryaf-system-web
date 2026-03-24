import { pgTable, serial, text, boolean, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const itemsTable = pgTable("items", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  category: text("category"),
  unitCostTry: numeric("unit_cost_try", { precision: 15, scale: 4 }),
  unitCostUsd: numeric("unit_cost_usd", { precision: 15, scale: 4 }),
  unitPriceTry: numeric("unit_price_try", { precision: 15, scale: 4 }),
  unitPriceUsd: numeric("unit_price_usd", { precision: 15, scale: 4 }),
  currentStock: numeric("current_stock", { precision: 15, scale: 4 }).notNull().default("0"),
  minStock: numeric("min_stock", { precision: 15, scale: 4 }).default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const itemAliasesTable = pgTable("item_aliases", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => itemsTable.id, { onDelete: "cascade" }),
  alias: text("alias").notNull(),
});

export const insertItemSchema = createInsertSchema(itemsTable).omit({ id: true, createdAt: true });
export const insertItemAliasSchema = createInsertSchema(itemAliasesTable).omit({ id: true });

export type InsertItem = z.infer<typeof insertItemSchema>;
export type InsertItemAlias = z.infer<typeof insertItemAliasSchema>;
export type Item = typeof itemsTable.$inferSelect;
export type ItemAlias = typeof itemAliasesTable.$inferSelect;
