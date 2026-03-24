import { Router, type IRouter } from "express";
import { db, itemsTable, itemAliasesTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import {
  GetItemsQueryParams,
  CreateItemBody,
  UpdateItemParams,
  UpdateItemBody,
  DeleteItemParams,
  GetItemAliasesParams,
  AddItemAliasParams,
  AddItemAliasBody,
  DeleteItemAliasParams,
} from "@workspace/api-zod";
import { requireMutationRow, sendRouteError, toIsoDateTime } from "../lib/http";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const query = GetItemsQueryParams.parse(req.query);

    let conditions = sql`1=1`;
    if (query.search) {
      conditions = sql`${conditions} AND (${itemsTable.name} ILIKE ${'%' + query.search + '%'} OR ${itemsTable.code} ILIKE ${'%' + query.search + '%'} OR ${itemsTable.nameAr} ILIKE ${'%' + query.search + '%'})`;
    }
    if (query.category) {
      conditions = sql`${conditions} AND ${itemsTable.category} = ${query.category}`;
    }

    const items = await db.select().from(itemsTable).where(conditions).orderBy(itemsTable.name);
    const aliases = await db.select().from(itemAliasesTable);

    const aliasMap = new Map<number, typeof aliases>();
    for (const alias of aliases) {
      if (!aliasMap.has(alias.itemId)) aliasMap.set(alias.itemId, []);
      aliasMap.get(alias.itemId)!.push(alias);
    }

    res.json(items.map(item => ({
      ...item,
      currentStock: parseFloat(item.currentStock || "0"),
      minStock: parseFloat(item.minStock || "0"),
      unitCostTry: item.unitCostTry ? parseFloat(item.unitCostTry) : null,
      unitCostUsd: item.unitCostUsd ? parseFloat(item.unitCostUsd) : null,
      unitPriceTry: item.unitPriceTry ? parseFloat(item.unitPriceTry) : null,
      unitPriceUsd: item.unitPriceUsd ? parseFloat(item.unitPriceUsd) : null,
      createdAt: toIsoDateTime(item.createdAt),
      aliases: aliasMap.get(item.id) || [],
    })));
  } catch (err) {
    req.log.error({ err }, "Error fetching items");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateItemBody.parse(req.body);
    const [insertedItem] = await db.insert(itemsTable).values({
      code: body.code,
      name: body.name,
      nameAr: body.nameAr,
      category: body.category,
      currentStock: "0",
      minStock: (body.minStock ?? 0).toString(),
      isActive: body.isActive ?? true,
      unitCostTry: body.unitCostTry?.toString(),
      unitCostUsd: body.unitCostUsd?.toString(),
      unitPriceTry: body.unitPriceTry?.toString(),
      unitPriceUsd: body.unitPriceUsd?.toString(),
      createdAt: new Date(),
    }).returning();
    const item = requireMutationRow(insertedItem, "Item");
    res.status(201).json({
      ...item,
      currentStock: parseFloat(item.currentStock || "0"),
      minStock: parseFloat(item.minStock || "0"),
      unitCostTry: item.unitCostTry ? parseFloat(item.unitCostTry) : null,
      unitCostUsd: item.unitCostUsd ? parseFloat(item.unitCostUsd) : null,
      unitPriceTry: item.unitPriceTry ? parseFloat(item.unitPriceTry) : null,
      unitPriceUsd: item.unitPriceUsd ? parseFloat(item.unitPriceUsd) : null,
      createdAt: toIsoDateTime(item.createdAt),
      aliases: [],
    });
  } catch (err) {
    req.log.error({ err }, "Error creating item");
    sendRouteError(req, res, err);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = UpdateItemParams.parse(req.params);
    const body = UpdateItemBody.parse(req.body);
    const { currentStock: _ignore, ...updateData } = body as any;
    const [item] = await db.update(itemsTable).set({
      ...updateData,
      minStock: body.minStock?.toString(),
      unitCostTry: body.unitCostTry?.toString(),
      unitCostUsd: body.unitCostUsd?.toString(),
      unitPriceTry: body.unitPriceTry?.toString(),
      unitPriceUsd: body.unitPriceUsd?.toString(),
    }).where(eq(itemsTable.id, id)).returning();
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    res.json({
      ...item,
      currentStock: parseFloat(item.currentStock || "0"),
      minStock: parseFloat(item.minStock || "0"),
      unitCostTry: item.unitCostTry ? parseFloat(item.unitCostTry) : null,
      unitCostUsd: item.unitCostUsd ? parseFloat(item.unitCostUsd) : null,
      unitPriceTry: item.unitPriceTry ? parseFloat(item.unitPriceTry) : null,
      unitPriceUsd: item.unitPriceUsd ? parseFloat(item.unitPriceUsd) : null,
      createdAt: toIsoDateTime(item.createdAt),
      aliases: [],
    });
  } catch (err) {
    req.log.error({ err }, "Error updating item");
    sendRouteError(req, res, err);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeleteItemParams.parse(req.params);
    await db.delete(itemsTable).where(eq(itemsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/aliases", async (req, res) => {
  try {
    const { id } = GetItemAliasesParams.parse(req.params);
    const aliases = await db.select().from(itemAliasesTable).where(eq(itemAliasesTable.itemId, id));
    res.json(aliases);
  } catch (err) {
    req.log.error({ err }, "Error fetching aliases");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/aliases", async (req, res) => {
  try {
    const { id } = AddItemAliasParams.parse(req.params);
    const body = AddItemAliasBody.parse(req.body);
    const [insertedAlias] = await db.insert(itemAliasesTable).values({ itemId: id, alias: body.alias }).returning();
    const alias = requireMutationRow(insertedAlias, "Item alias");
    res.status(201).json(alias);
  } catch (err) {
    req.log.error({ err }, "Error adding alias");
    sendRouteError(req, res, err);
  }
});

router.delete("/aliases/:aliasId", async (req, res) => {
  try {
    const { aliasId } = DeleteItemAliasParams.parse(req.params);
    await db.delete(itemAliasesTable).where(eq(itemAliasesTable.id, aliasId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting alias");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
