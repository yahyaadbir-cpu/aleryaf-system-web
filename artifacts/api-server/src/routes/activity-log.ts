import { Router, type IRouter } from "express";
import { db, activityLogTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  try {
    const logs = await db
      .select()
      .from(activityLogTable)
      .orderBy(desc(activityLogTable.createdAt))
      .limit(500);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "فشل في جلب السجل" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { username, action, details } = req.body as {
      username?: string;
      action?: string;
      details?: string;
    };
    if (!username || !action) {
      return res.status(400).json({ error: "username and action are required" });
    }
    const [entry] = await db
      .insert(activityLogTable)
      .values({ username, action, details: details ?? null })
      .returning();
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: "فشل في حفظ السجل" });
  }
});

export default router;
