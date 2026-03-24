import { eq, sql } from "drizzle-orm";
import { itemsTable } from "@workspace/db";

const ARABIC_ALEF_VARIANTS = /[أإآٱ]/g;
const ARABIC_TATWEEL = /\u0640/g;
const KG_UNIT = "كغ";

export function normalizeArabicText(value?: string | null): string {
  return (value ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(ARABIC_TATWEEL, "")
    .replace(ARABIC_ALEF_VARIANTS, "ا")
    .replace(/\s+/g, " ");
}

export function normalizeUnit(value?: string | null): string | null {
  const normalized = normalizeArabicText(value).replace(/\s+/g, "");
  if (!normalized) return null;
  if ([KG_UNIT, "كجم", "kg", "كيلو", "كيلوغرام", "كيلوجرام"].includes(normalized)) return KG_UNIT;
  if (["عدد", "عد"].includes(normalized)) return "عدد";
  return (value ?? "").toString().trim() || null;
}

export function isKgUnit(value?: string | null): boolean {
  const normalized = normalizeUnit(value);
  return normalized == null || normalized === KG_UNIT;
}

export function isSummaryInventoryRow(rawName?: string | null, itemCode?: string | null): boolean {
  const normalizedName = normalizeArabicText(rawName);
  const normalizedCode = normalizeArabicText(itemCode);
  if (!normalizedName && !normalizedCode) return true;

  return (
    normalizedName === "المجموع" ||
    normalizedName === "عدد المواد المظهره" ||
    normalizedName === "عدد المواد المظهرة" ||
    normalizedName.startsWith("المجموع") ||
    normalizedName.startsWith("عدد المواد المظهره") ||
    normalizedName.startsWith("عدد المواد المظهرة")
  );
}

export function computeCanonicalInventoryValues(
  quantity: number,
  unit?: string | null,
  unitCost?: number | null,
) {
  const quantityKg = Number.isFinite(quantity) ? quantity : 0;
  const costPerKg = unitCost != null && Number.isFinite(unitCost) ? unitCost : null;
  const unitDisplay = normalizeUnit(unit) ?? KG_UNIT;
  const totalValue = costPerKg == null ? null : quantityKg * costPerKg;

  return {
    quantityKg,
    unitDisplay,
    costPerKg,
    totalValue,
  };
}

type DbLike = {
  execute: (query: unknown) => Promise<{ rows: unknown[] }>;
  select: (...args: unknown[]) => any;
  from?: (...args: unknown[]) => any;
};

export type LatestImportSnapshot = {
  itemId: number;
  importDate: string;
  quantityKg: number;
  unitDisplay: string;
  costPerKg: number | null;
  costPerKgTry: number | null;
  costPerKgUsd: number | null;
  totalValue: number | null;
  currency: "TRY" | "USD" | null;
};

export async function getLatestImportSnapshotMap(db: DbLike, itemIds?: number[]) {
  if (itemIds && itemIds.length === 0) return new Map<number, LatestImportSnapshot>();

  const itemFilter = itemIds?.length
    ? sql`AND ir.item_id = ANY(${sql.raw(`ARRAY[${itemIds.join(",")}]::int[]`)})`
    : sql``;

  const result = await db.execute(sql`
    SELECT DISTINCT ON (ir.item_id)
      ir.item_id,
      ii.import_date,
      COALESCE(ir.normalized_qty_kg, ir.source_quantity, ir.quantity)::numeric AS quantity_kg,
      COALESCE(NULLIF(ir.source_unit, ''), 'كغ') AS unit_display,
      COALESCE(ir.normalized_cost_per_kg, ir.source_unit_cost)::numeric AS cost_per_kg,
      ir.cost_try::numeric AS cost_try,
      ir.cost_usd::numeric AS cost_usd,
      COALESCE(ir.source_total_value, (COALESCE(ir.normalized_qty_kg, ir.source_quantity, ir.quantity) * COALESCE(ir.normalized_cost_per_kg, ir.source_unit_cost)))::numeric AS total_value
    FROM inventory_import_rows ir
    JOIN inventory_imports ii ON ii.id = ir.import_id
    WHERE ir.matched = 1
      AND ir.item_id IS NOT NULL
      ${itemFilter}
    ORDER BY ir.item_id, ii.import_date DESC, ii.id DESC, ir.id DESC
  `);

  return new Map(
    (result.rows as Array<Record<string, string | number | null>>).map((row) => {
      const costPerKgTry = row.cost_try == null ? null : parseFloat(String(row.cost_try));
      const costPerKgUsd = row.cost_usd == null ? null : parseFloat(String(row.cost_usd));

      return [
        Number(row.item_id),
        {
          itemId: Number(row.item_id),
          importDate: String(row.import_date),
          quantityKg: parseFloat(String(row.quantity_kg ?? "0")),
          unitDisplay: row.unit_display == null ? KG_UNIT : String(row.unit_display),
          costPerKg: row.cost_per_kg == null ? null : parseFloat(String(row.cost_per_kg)),
          costPerKgTry,
          costPerKgUsd,
          totalValue: row.total_value == null ? null : parseFloat(String(row.total_value)),
          currency: costPerKgTry != null ? "TRY" : costPerKgUsd != null ? "USD" : null,
        } satisfies LatestImportSnapshot,
      ];
    }),
  );
}

export async function getLatestItemCostSnapshot(
  db: DbLike,
  itemId: number,
  currency: "TRY" | "USD",
): Promise<number> {
  const snapshots = await getLatestImportSnapshotMap(db, [itemId]);
  const snapshot = snapshots.get(itemId);
  const snapshotCost = currency === "TRY" ? snapshot?.costPerKgTry : snapshot?.costPerKgUsd;
  if (snapshotCost != null) return snapshotCost;

  const [item] = await db
    .select({
      unitCostTry: itemsTable.unitCostTry,
      unitCostUsd: itemsTable.unitCostUsd,
    })
    .from(itemsTable)
    .where(eq(itemsTable.id, itemId))
    .limit(1);

  const fallback = currency === "TRY" ? item?.unitCostTry : item?.unitCostUsd;
  return fallback ? parseFloat(fallback) : 0;
}
