import { Router, type IRouter } from "express";
import { activityLogTable, db } from "@workspace/db";
import { authenticateUser, clearSession, createSession, getAuthenticatedUserFromRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/me", async (req, res) => {
  try {
    const user = await getAuthenticatedUserFromRequest(req);
    if (!user) {
      res.status(401).json({ user: null });
      return;
    }

    res.json({ user });
  } catch (err) {
    req.log.error({ err }, "Failed to load current user");
    res.status(500).json({ error: "Failed to load current user" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const username = typeof req.body?.username === "string" ? req.body.username : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const result = await authenticateUser(username, password);

    if (!result.ok) {
      res.status(401).json({ error: result.error });
      return;
    }

    await createSession(result.user, res);
    await db.insert(activityLogTable).values({
      username: result.user.username,
      action: "تسجيل دخول",
      details: result.user.isAdmin ? "دخول بحساب إداري" : "دخول بحساب مستخدم",
    });
    res.json({ user: result.user });
  } catch (err) {
    req.log.error({ err }, "Failed to login");
    res.status(500).json({ error: "Failed to login" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const user = await getAuthenticatedUserFromRequest(req);
    const sessionToken = typeof req.cookies?.aleryaf_session === "string" ? req.cookies.aleryaf_session : undefined;
    await clearSession(sessionToken, res);
    if (user) {
      await db.insert(activityLogTable).values({
        username: user.username,
        action: "تسجيل خروج",
      });
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to logout");
    res.status(500).json({ error: "Failed to logout" });
  }
});

export default router;
