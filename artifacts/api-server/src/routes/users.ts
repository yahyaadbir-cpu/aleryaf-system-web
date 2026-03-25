import { Router, type IRouter } from "express";
import { and, desc, eq, ne } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { hashPasswordForStorage, normalizeUsername, requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        isAdmin: usersTable.isAdmin,
        isActive: usersTable.isActive,
        canUseTurkishInvoices: usersTable.canUseTurkishInvoices,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
        lastLoginAt: usersTable.lastLoginAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.lastLoginAt), desc(usersTable.createdAt), desc(usersTable.id));

    res.json(
      users.map((user) => ({
        ...user,
        isAdmin: user.isAdmin === 1,
        isActive: user.isActive === 1,
        canUseTurkishInvoices: user.canUseTurkishInvoices === 1,
      })),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to load users" });
  }
});

router.post("/", async (req, res) => {
  try {
    const username = typeof req.body?.username === "string" ? normalizeUsername(req.body.username) : "";
    const password = typeof req.body?.password === "string" ? req.body.password.trim() : "";
    const isAdmin = Boolean(req.body?.isAdmin);
    const canUseTurkishInvoices = Boolean(req.body?.canUseTurkishInvoices);

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (existing) {
      res.status(409).json({ error: "Username already exists" });
      return;
    }

    const now = new Date();
    const [created] = await db
      .insert(usersTable)
      .values({
        username,
        passwordHash: hashPasswordForStorage(password),
        isAdmin: isAdmin ? 1 : 0,
        isActive: 1,
        canUseTurkishInvoices: canUseTurkishInvoices ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        isAdmin: usersTable.isAdmin,
        isActive: usersTable.isActive,
        canUseTurkishInvoices: usersTable.canUseTurkishInvoices,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
        lastLoginAt: usersTable.lastLoginAt,
      });

    res.status(201).json({
      ...created,
      isAdmin: created.isAdmin === 1,
      isActive: created.isActive === 1,
      canUseTurkishInvoices: created.canUseTurkishInvoices === 1,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const isActive = Boolean(req.body?.isActive);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }

    const [targetUser] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        isAdmin: usersTable.isAdmin,
      })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (targetUser.isAdmin === 1 && !isActive) {
      res.status(400).json({ error: "Admin accounts cannot be disabled" });
      return;
    }

    if (req.authUser?.id === id && !isActive) {
      res.status(400).json({ error: "You cannot disable your own account" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({
        isActive: isActive ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        isAdmin: usersTable.isAdmin,
        isActive: usersTable.isActive,
        canUseTurkishInvoices: usersTable.canUseTurkishInvoices,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
        lastLoginAt: usersTable.lastLoginAt,
      });

    res.json({
      ...updated,
      isAdmin: updated.isAdmin === 1,
      isActive: updated.isActive === 1,
      canUseTurkishInvoices: updated.canUseTurkishInvoices === 1,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user status" });
  }
});

router.patch("/:id/turkish-invoices", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const canUseTurkishInvoices = Boolean(req.body?.canUseTurkishInvoices);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({
        canUseTurkishInvoices: canUseTurkishInvoices ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        isAdmin: usersTable.isAdmin,
        isActive: usersTable.isActive,
        canUseTurkishInvoices: usersTable.canUseTurkishInvoices,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
        lastLoginAt: usersTable.lastLoginAt,
      });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      ...updated,
      isAdmin: updated.isAdmin === 1,
      isActive: updated.isActive === 1,
      canUseTurkishInvoices: updated.canUseTurkishInvoices === 1,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update Turkish invoice access" });
  }
});

router.patch("/:id/password", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const password = typeof req.body?.password === "string" ? req.body.password.trim() : "";

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }

    if (!password) {
      res.status(400).json({ error: "Password is required" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({
        passwordHash: hashPasswordForStorage(password),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to update password" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }

    if (req.authUser?.id === id) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }

    const [deleted] = await db
      .delete(usersTable)
      .where(and(eq(usersTable.id, id), ne(usersTable.username, "الارياف")))
      .returning({ id: usersTable.id });

    if (!deleted) {
      res.status(404).json({ error: "User not found or protected" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
