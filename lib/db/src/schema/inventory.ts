import { pgTable, serial, timestamp, numeric, integer, text, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { itemsTable } from "./items";
import { warehousesTable } from "./warehouses";

export const inventoryImportsTable = pgTable("inventory_imports", {
  id: serial("id").primaryKey(),
  importDate: date("import_date").notNull(),
  warehouseId: integer("warehouse_id").references(() => warehousesTable.id),
  rowsProcessed: integer("rows_processed").notNull().default(0),
  rowsMatched: integer("rows_matched").notNull().default(0),
  rowsUnmatched: integer("rows_unmatched").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const inventoryImportRowsTable = pgTable("inventory_import_rows", {
  id: serial("id").primaryKey(),
  importId: integer("import_id").notNull().references(() => inventoryImportsTable.id, { onDelete: "cascade" }),
  itemId: integer("item_id").references(() => itemsTable.id),
  itemCode: text("item_code"),
  rawName: text("raw_name"),
  quantity: numeric("quantity", { precision: 15, scale: 4 }).notNull(),
  costTry: numeric("cost_try", { precision: 15, scale: 4 }),
  costUsd: numeric("cost_usd", { precision: 15, scale: 4 }),
  sourceUnit: text("source_unit"),
  sourceQuantity: numeric("source_quantity", { precision: 15, scale: 4 }),
  sourceUnitCost: numeric("source_unit_cost", { precision: 15, scale: 4 }),
  sourceTotalValue: numeric("source_total_value", { precision: 15, scale: 4 }),
  normalizedQtyKg: numeric("normalized_qty_kg", { precision: 15, scale: 4 }),
  normalizedCostPerKg: numeric("normalized_cost_per_kg", { precision: 15, scale: 8 }),
  matched: integer("matched").notNull().default(0), // 0 = unmatched, 1 = matched
});

export const insertInventoryImportSchema = createInsertSchema(inventoryImportsTable).omit({ id: true, createdAt: true });
export const insertInventoryImportRowSchema = createInsertSchema(inventoryImportRowsTable).omit({ id: true });

export type InsertInventoryImport = z.infer<typeof insertInventoryImportSchema>;
export type InsertInventoryImportRow = z.infer<typeof insertInventoryImportRowSchema>;
export type InventoryImport = typeof inventoryImportsTable.$inferSelect;
export type InventoryImportRow = typeof inventoryImportRowsTable.$inferSelect;
