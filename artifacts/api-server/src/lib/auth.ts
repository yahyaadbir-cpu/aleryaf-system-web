import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { and, eq, gt } from "drizzle-orm";
import { authSessionsTable, db, usersTable } from "@workspace/db";

const DEFAULT_ADMIN_USERNAME = "الارياف";
const DEV_DEFAULT_ADMIN_PASSWORD = "admin5713";
const SESSION_COOKIE = "aleryaf_session";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? "7");
const SESSION_TTL_MS = Math.max(1, Number.isFinite(SESSION_TTL_DAYS) ? SESSION_TTL_DAYS : 7) * 24 * 60 * 60 * 1000;
const isProduction = process.env.NODE_ENV === "production";

export const ADMIN_USERNAME = process.env.ADMIN_USERNAME?.trim() || DEFAULT_ADMIN_USERNAME;
export const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD?.trim() ||
  (isProduction ? "" : DEV_DEFAULT_ADMIN_PASSWORD);
export const EMPLOYEE_BOOTSTRAP_PASSWORD = process.env.EMPLOYEE_BOOTSTRAP_PASSWORD?.trim() || "";
export const HAS_CONFIGURED_ADMIN_PASSWORD = Boolean(ADMIN_PASSWORD);

export type AuthenticatedUser = {
  id: number;
  username: string;
  isAdmin: boolean;
  canUseTurkishInvoices: boolean;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser | null;
    }
  }
}

export function normalizeUsername(username: string) {
  return username.trim();
}

export function hashPasswordForStorage(password: string, salt?: string) {
  const effectiveSalt = salt ?? crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, effectiveSalt, 64).toString("hex");
  return `${effectiveSalt}:${derived}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, expected] = passwordHash.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function buildCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

async function ensureAdminUser() {
  const [existingAdmin] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, ADMIN_USERNAME))
    .limit(1);

  if (existingAdmin) {
    return existingAdmin;
  }

  if (!ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD environment variable is required to bootstrap the admin account in production");
  }

  const now = new Date();
  const [createdAdmin] = await db
    .insert(usersTable)
    .values({
      username: ADMIN_USERNAME,
      passwordHash: hashPasswordForStorage(ADMIN_PASSWORD),
      isAdmin: 1,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return createdAdmin;
}

export async function authenticateUser(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedPassword = password.trim();

  if (!normalizedUsername || !normalizedPassword) {
    return { ok: false as const, error: "يرجى إدخال اسم المستخدم وكلمة المرور" };
  }

  await ensureAdminUser();

  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, normalizedUsername))
    .limit(1);

  if (existingUser) {
    if (!existingUser.isActive) {
      return { ok: false as const, error: "هذا الحساب غير مفعّل" };
    }

    if (!verifyPassword(normalizedPassword, existingUser.passwordHash)) {
      return { ok: false as const, error: "كلمة المرور غير صحيحة" };
    }

    return {
      ok: true as const,
      user: {
        id: existingUser.id,
        username: existingUser.username,
        isAdmin: existingUser.isAdmin === 1,
        canUseTurkishInvoices: existingUser.canUseTurkishInvoices === 1,
      },
    };
  }

  if (!EMPLOYEE_BOOTSTRAP_PASSWORD) {
    return { ok: false as const, error: "اسم المستخدم غير موجود" };
  }

  if (normalizedUsername === ADMIN_USERNAME) {
    return { ok: false as const, error: "كلمة المرور غير صحيحة" };
  }

  if (normalizedPassword !== EMPLOYEE_BOOTSTRAP_PASSWORD) {
    return { ok: false as const, error: "كلمة المرور غير صحيحة" };
  }

  const now = new Date();
  const [createdUser] = await db
    .insert(usersTable)
    .values({
      username: normalizedUsername,
      passwordHash: hashPasswordForStorage(normalizedPassword),
      isAdmin: 0,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return {
    ok: true as const,
    user: {
      id: createdUser.id,
      username: createdUser.username,
      isAdmin: false,
      canUseTurkishInvoices: false,
    },
  };
}

export async function createSession(user: AuthenticatedUser, res: Response) {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await db.insert(authSessionsTable).values({
    sessionToken,
    userId: user.id,
    username: user.username,
    expiresAt,
    createdAt: now,
    lastSeenAt: now,
  });

  await db
    .update(usersTable)
    .set({ lastLoginAt: now, updatedAt: now })
    .where(eq(usersTable.id, user.id));

  res.cookie(SESSION_COOKIE, sessionToken, buildCookieOptions(expiresAt));
}

export async function clearSession(sessionToken: string | undefined, res: Response) {
  if (sessionToken) {
    await db.delete(authSessionsTable).where(eq(authSessionsTable.sessionToken, sessionToken));
  }

  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function getAuthenticatedUserFromRequest(req: Request): Promise<AuthenticatedUser | null> {
  const sessionToken = typeof req.cookies?.[SESSION_COOKIE] === "string" ? req.cookies[SESSION_COOKIE] : null;
  if (!sessionToken) return null;

  const now = new Date();
  const [session] = await db
    .select({
      sessionId: authSessionsTable.id,
      userId: usersTable.id,
      username: usersTable.username,
      isAdmin: usersTable.isAdmin,
      canUseTurkishInvoices: usersTable.canUseTurkishInvoices,
      isActive: usersTable.isActive,
      expiresAt: authSessionsTable.expiresAt,
    })
    .from(authSessionsTable)
    .innerJoin(usersTable, eq(authSessionsTable.userId, usersTable.id))
    .where(and(eq(authSessionsTable.sessionToken, sessionToken), gt(authSessionsTable.expiresAt, now)))
    .limit(1);

  if (!session || session.isActive !== 1) {
    if (sessionToken) {
      await db.delete(authSessionsTable).where(eq(authSessionsTable.sessionToken, sessionToken));
    }
    return null;
  }

  await db
    .update(authSessionsTable)
    .set({ lastSeenAt: now })
    .where(eq(authSessionsTable.id, session.sessionId));

  return {
    id: session.userId,
    username: session.username,
    isAdmin: session.isAdmin === 1,
    canUseTurkishInvoices: session.canUseTurkishInvoices === 1,
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getAuthenticatedUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    req.authUser = user;
    next();
  } catch (err) {
    req.log.error({ err }, "Failed to validate session");
    res.status(500).json({ error: "Failed to validate session" });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getAuthenticatedUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!user.isAdmin) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    req.authUser = user;
    next();
  } catch (err) {
    req.log.error({ err }, "Failed to validate admin session");
    res.status(500).json({ error: "Failed to validate session" });
  }
}
