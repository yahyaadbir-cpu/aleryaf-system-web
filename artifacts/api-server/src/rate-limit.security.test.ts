import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { createRateLimitMiddleware } from "./lib/rate-limit";

test("login rate limiter blocks repeated attempts", async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = { error() {}, warn() {}, info() {} } as any;
    next();
  });
  app.post(
    "/login",
    createRateLimitMiddleware({
      windowMs: 60_000,
      maxRequests: 2,
      blockDurationMs: 60_000,
      keyPrefix: "test-login",
      eventType: "test.login_rate_limit",
      message: "limited",
      includeUsername: true,
      onBlocked: async () => undefined,
    }),
    (_req, res) => res.json({ ok: true }),
  );

  await request(app).post("/login").send({ username: "u" });
  await request(app).post("/login").send({ username: "u" });
  const blocked = await request(app).post("/login").send({ username: "u" });

  assert.equal(blocked.status, 429);
  assert.deepEqual(blocked.body, { error: "limited" });
});
