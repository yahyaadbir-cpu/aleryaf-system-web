import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { and, eq, gt, ne } from "drizzle-orm";
import { authSessionsTable, db, usersTable } from "@workspace/db";
import { appEnv } from "./env";
import { clearCsrfCookie, rotateCsrfCookie } from "./csrf";
import { writeSecurityAuditEvent } from "./audit";

const SESSION_COOKIE = "aleryaf_session";
const SESSION_TTL_MS = appEnv.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export const ADMIN_USERNAME = appEnv.ADMIN_BOOTSTRAP_USERNAME?.trim() || "";
export const HAS_CONFIGURED_ADMIN_BOOTSTRAP = Boolean(
  appEnv.ADMIN_BOOTSTRAP_USERNAME?.trim() && appEnv.ADMIN_BOOTSTRAP_PASSWORD?.trim(),
);

export type AuthenticatedUser = {
  id: number;
  username: string;
  isAdmin: boolean;
  canUseTurkishInvoices: boolean;
  sessionVersion: number;
};

type SessionLookupRow = {
  isActive: number;
  sessionVersion: number;
  sessionRowVersion: number;
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

export function isSessionRecordValid(session: SessionLookupRow | null | undefined) {
  return Boolean(
    session &&
      session.isActive === 1 &&
      session.sessionVersion === session.sessionRowVersion,
  );
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
    secure: appEnv.isProduction,
    path: "/",
    expires: expiresAt,
  };
}

async function ensureBootstrapAdminUser() {
  if (!HAS_CONFIGURED_ADMIN_BOOTSTRAP) {
    return null;
  }

  const [existingAdmin] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, ADMIN_USERNAME))
    .limit(1);

  if (existingAdmin) {
    return existingAdmin;
  }

  const now = new Date();
  const [createdAdmin] = await db
    .insert(usersTable)
    .values({
      username: ADMIN_USERNAME,
      passwordHash: hashPasswordForStorage(appEnv.ADMIN_BOOTSTRAP_PASSWORD!),
      isAdmin: 1,
      isActive: 1,
      sessionVersion: 1,
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

  await ensureBootstrapAdminUser();

  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, normalizedUsername))
    .limit(1);

  if (!existingUser || !existingUser.isActive) {
    return { ok: false as const, error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
  }

  if (!verifyPassword(normalizedPassword, existingUser.passwordHash)) {
    return { ok: false as const, error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
  }

  return {
    ok: true as const,
    user: {
      id: existingUser.id,
      username: existingUser.username,
      isAdmin: existingUser.isAdmin === 1,
      canUseTurkishInvoices: existingUser.canUseTurkishInvoices === 1,
      sessionVersion: existingUser.sessionVersion,
    },
  };
}

export async function revokeUserSessions(
  userId: number,
  options?: { incrementSessionVersion?: boolean; exceptSessionToken?: string | null },
) {
  if (options?.incrementSessionVersion !== false) {
    await db
      .update(usersTable)
      .set({
        sessionVersion: crypto.randomInt(1, 2_147_483_647),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));
  }

  if (options?.exceptSessionToken) {
    await db
      .delete(authSessionsTable)
      .where(and(eq(authSessionsTable.userId, userId), ne(authSessionsTable.sessionToken, options.exceptSessionToken)));
    return;
  }

  await db.delete(authSessionsTable).where(eq(authSessionsTable.userId, userId));
}

export async function createSession(user: AuthenticatedUser, res: Response) {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await db.insert(authSessionsTable).values({
    sessionToken,
    userId: user.id,
    username: user.username,
    sessionVersion: user.sessionVersion,
    expiresAt,
    createdAt: now,
    lastSeenAt: now,
  });

  await db
    .update(usersTable)
    .set({ lastLoginAt: now, updatedAt: now })
    .where(eq(usersTable.id, user.id));

  res.cookie(SESSION_COOKIE, sessionToken, buildCookieOptions(expiresAt));
  rotateCsrfCookie(res);
}

export async function clearSession(sessionToken: string | undefined, res: Response) {
  if (sessionToken) {
    await db.delete(authSessionsTable).where(eq(authSessionsTable.sessionToken, sessionToken));
  }

  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "strict",
    secure: appEnv.isProduction,
    path: "/",
  });
  clearCsrfCookie(res);
}

export function getSessionTokenFromRequest(req: Request) {
  return typeof req.cookies?.[SESSION_COOKIE] === "string" ? req.cookies[SESSION_COOKIE] : null;
}

export async function getAuthenticatedUserFromRequest(req: Request): Promise<AuthenticatedUser | null> {
  const sessionToken = getSessionTokenFromRequest(req);
  if (!sessionToken) return null;

  const now = new Date();
  const [session] = await db
    .select({
      sessionId: authSessionsTable.id,
      userId: usersTable.id,
      username: usersTable.username,
      isAdmin: usersTable.isAdmin,
      canUseTurkishInvoices: usersTable.canUseTurkishInvoices,
      sessionVersion: usersTable.sessionVersion,
      sessionRowVersion: authSessionsTable.sessionVersion,
      isActive: usersTable.isActive,
      expiresAt: authSessionsTable.expiresAt,
    })
    .from(authSessionsTable)
    .innerJoin(usersTable, eq(authSessionsTable.userId, usersTable.id))
    .where(and(eq(authSessionsTable.sessionToken, sessionToken), gt(authSessionsTable.expiresAt, now)))
    .limit(1);

  if (!isSessionRecordValid(session)) {
    await db.delete(authSessionsTable).where(eq(authSessionsTable.sessionToken, sessionToken));
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
    sessionVersion: session.sessionVersion,
  };
}

export function createRequireRoleMiddleware(
  getUser: (req: Request) => Promise<AuthenticatedUser | null>,
  adminRequired: boolean,
  onBlockedAdminAccess: typeof writeSecurityAuditEvent = writeSecurityAuditEvent,
) {
  return async function requireRole(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await getUser(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (adminRequired && !user.isAdmin) {
        await onBlockedAdminAccess({
          req,
          eventType: "auth.admin_access_denied",
          outcome: "blocked",
          actorUserId: user.id,
          actorUsername: user.username,
        });
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      req.authUser = user;
      next();
    } catch (err) {
      req.log.error({ err }, adminRequired ? "Failed to validate admin session" : "Failed to validate session");
      res.status(500).json({ error: "Failed to validate session" });
    }
  };
}

export const requireAuth = createRequireRoleMiddleware(getAuthenticatedUserFromRequest, false);
export const requireAdmin = createRequireRoleMiddleware(getAuthenticatedUserFromRequest, true);
