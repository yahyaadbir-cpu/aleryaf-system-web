import { Router, type IRouter } from "express";
import { activityLogTable, db } from "@workspace/db";
import { authenticateUser, clearSession, createSession, getAuthenticatedUserFromRequest } from "../lib/auth";

const router: IRouter = Router();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const loginAttempts = new Map<string, { count: number; firstAttemptAt: number; blockedUntil: number }>();

function getLoginThrottleKey(ip: string, username: string) {
  return `${ip}::${username.trim().toLowerCase()}`;
}

function getRemainingBlockMs(key: string) {
  const record = loginAttempts.get(key);
  if (!record) return 0;

  const now = Date.now();
  if (record.blockedUntil > now) {
    return record.blockedUntil - now;
  }

  if (now - record.firstAttemptAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
  }

  return 0;
}

function registerFailedLogin(key: string) {
  const now = Date.now();
  const current = loginAttempts.get(key);

  if (!current || now - current.firstAttemptAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, {
      count: 1,
      firstAttemptAt: now,
      blockedUntil: 0,
    });
    return;
  }

  current.count += 1;
  if (current.count >= LOGIN_MAX_ATTEMPTS) {
    current.blockedUntil = now + LOGIN_WINDOW_MS;
  }
  loginAttempts.set(key, current);
}

function clearFailedLogin(key: string) {
  loginAttempts.delete(key);
}

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
    const throttleKey = getLoginThrottleKey(req.ip || "unknown", username);
    const blockedForMs = getRemainingBlockMs(throttleKey);

    if (blockedForMs > 0) {
      res.setHeader("Retry-After", String(Math.ceil(blockedForMs / 1000)));
      res.status(429).json({ error: "محاولات كثيرة لتسجيل الدخول. حاول مرة أخرى بعد قليل." });
      return;
    }

    const result = await authenticateUser(username, password);

    if (!result.ok) {
      registerFailedLogin(throttleKey);
      res.status(401).json({ error: result.error });
      return;
    }

    clearFailedLogin(throttleKey);
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
