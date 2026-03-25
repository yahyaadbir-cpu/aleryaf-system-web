import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { createRequireRoleMiddleware, isSessionRecordValid, type AuthenticatedUser } from "./lib/auth";

const fakeLogger = {
  error() {},
  warn() {},
  info() {},
};

function buildUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 1,
    username: "tester",
    isAdmin: false,
    canUseTurkishInvoices: false,
    sessionVersion: 1,
    ...overrides,
  };
}

test("non-admin is blocked from admin endpoints with 403", async () => {
  const app = express();
  app.use((req, _res, next) => {
    req.log = fakeLogger as any;
    next();
  });
  app.get(
    "/admin",
    createRequireRoleMiddleware(async () => buildUser({ isAdmin: false }), true, async () => undefined),
    (_req, res) => res.json({ ok: true }),
  );

  const response = await request(app).get("/admin");
  assert.equal(response.status, 403);
  assert.deepEqual(response.body, { error: "Forbidden" });
});

test("old session becomes invalid when session version changes after password change", () => {
  assert.equal(
    isSessionRecordValid({
      isActive: 1,
      sessionVersion: 2,
      sessionRowVersion: 1,
    }),
    false,
  );
});

test("old session becomes invalid when session version changes after role change", () => {
  assert.equal(
    isSessionRecordValid({
      isActive: 1,
      sessionVersion: 3,
      sessionRowVersion: 2,
    }),
    false,
  );
});
