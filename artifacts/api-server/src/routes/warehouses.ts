import { Router, type IRouter } from "express";
import { db, warehousesTable, branchesTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import {
  CreateWarehouseBody,
  DeleteWarehouseParams,
} from "@workspace/api-zod";
import { requireMutationRow, sendRouteError, toIsoDateTime } from "../lib/http";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const warehouses = await db
      .select({
        id: warehousesTable.id,
        name: warehousesTable.name,
        isActive: warehousesTable.isActive,
        branchId: warehousesTable.branchId,
        branchName: branchesTable.name,
        branchCode: branchesTable.code,
        createdAt: warehousesTable.createdAt,
        updatedAt: warehousesTable.updatedAt,
      })
      .from(warehousesTable)
      .innerJoin(branchesTable, eq(warehousesTable.branchId, branchesTable.id))
      .orderBy(asc(warehousesTable.name));

    res.json(warehouses.map((warehouse) => ({
      ...warehouse,
      createdAt: toIsoDateTime(warehouse.createdAt),
      updatedAt: toIsoDateTime(warehouse.updatedAt),
    })));
  } catch (err) {
    req.log.error({ err }, "Error fetching warehouses");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateWarehouseBody.parse(req.body);
    const name = body.name.trim();

    if (!name) {
      res.status(400).json({ error: "Warehouse name is required" });
      return;
    }

    const [branch] = await db
      .select({ id: branchesTable.id, name: branchesTable.name, code: branchesTable.code })
      .from(branchesTable)
      .where(eq(branchesTable.id, body.branchId))
      .limit(1);

    if (!branch) {
      res.status(400).json({ error: "Branch not found" });
      return;
    }

    const now = new Date();
    const [insertedWarehouse] = await db
      .insert(warehousesTable)
      .values({
        name,
        branchId: body.branchId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const warehouse = requireMutationRow(insertedWarehouse, "Warehouse");

    res.status(201).json({
      ...warehouse,
      branchName: branch.name,
      branchCode: branch.code,
      createdAt: toIsoDateTime(warehouse.createdAt),
      updatedAt: toIsoDateTime(warehouse.updatedAt),
    });
  } catch (err) {
    req.log.error({ err }, "Error creating warehouse");
    sendRouteError(req, res, err);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeleteWarehouseParams.parse(req.params);
    await db.delete(warehousesTable).where(eq(warehousesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting warehouse");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
