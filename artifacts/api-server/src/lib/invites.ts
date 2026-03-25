import crypto from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, userInvitesTable, usersTable } from "@workspace/db";
import { normalizeUsername, hashPasswordForStorage } from "./auth";

export function createInviteToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function isInviteRedeemable(invite: {
  expiresAt: Date;
  redeemedAt: Date | null;
  revokedAt: Date | null;
}, now = new Date()) {
  return !invite.redeemedAt && !invite.revokedAt && invite.expiresAt > now;
}

export async function redeemInvite(params: {
  token: string;
  username: string;
  password: string;
}) {
  const username = normalizeUsername(params.username);
  const tokenHash = hashInviteToken(params.token);
  const now = new Date();

  const [invite] = await db
    .select()
    .from(userInvitesTable)
    .where(
      and(
        eq(userInvitesTable.tokenHash, tokenHash),
        gt(userInvitesTable.expiresAt, now),
        isNull(userInvitesTable.redeemedAt),
        isNull(userInvitesTable.revokedAt),
      ),
    )
    .limit(1);

  if (!invite || !isInviteRedeemable(invite, now)) {
    return { ok: false as const, error: "الدعوة غير صالحة أو منتهية" };
  }

  if (invite.invitedUsername !== username) {
    return { ok: false as const, error: "اسم المستخدم لا يطابق الدعوة" };
  }

  const [existingUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (existingUser) {
    return { ok: false as const, error: "اسم المستخدم مستخدم بالفعل" };
  }

  const createdAt = new Date();
  const [createdUser] = await db
    .insert(usersTable)
    .values({
      username,
      passwordHash: hashPasswordForStorage(params.password.trim()),
      isAdmin: invite.isAdmin,
      isActive: 1,
      canUseTurkishInvoices: invite.canUseTurkishInvoices,
      sessionVersion: 1,
      createdAt,
      updatedAt: createdAt,
    })
    .returning();

  await db
    .update(userInvitesTable)
    .set({
      redeemedAt: now,
      redeemedByUserId: createdUser.id,
    })
    .where(eq(userInvitesTable.id, invite.id));

  return {
    ok: true as const,
    invite,
    user: {
      id: createdUser.id,
      username: createdUser.username,
      isAdmin: createdUser.isAdmin === 1,
      canUseTurkishInvoices: createdUser.canUseTurkishInvoices === 1,
      sessionVersion: createdUser.sessionVersion,
    },
  };
}
