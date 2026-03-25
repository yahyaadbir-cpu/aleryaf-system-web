import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, activityLogTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();
const createActivitySchema = z.object({
  action: z.string().trim().min(1).max(140),
  details: z.string().trim().max(500).optional(),
});

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const logs = await db
      .select()
      .from(activityLogTable)
      .orderBy(desc(activityLogTable.createdAt))
      .limit(500);

    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: "فشل في جلب السجل" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { action, details } = createActivitySchema.parse(req.body);
    const username = req.authUser?.username;

    if (!username || !action) {
      return res.status(400).json({ error: "username and action are required" });
    }

    const [entry] = await db
      .insert(activityLogTable)
      .values({ username, action, details: details ?? null })
      .returning();

    return res.status(201).json(entry);
  } catch (err) {
    return res.status(500).json({ error: "فشل في حفظ السجل" });
  }
});

export default router;
