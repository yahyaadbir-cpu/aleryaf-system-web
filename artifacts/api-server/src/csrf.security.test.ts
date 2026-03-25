import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { requireCsrf } from "./lib/csrf";

test("csrf middleware rejects protected mutation without matching token", async () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.post("/protected", requireCsrf, (_req, res) => res.json({ ok: true }));

  const response = await request(app)
    .post("/protected")
    .set("Cookie", ["aleryaf_csrf=test-cookie"]);

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, { error: "CSRF validation failed" });
});

test("csrf middleware accepts protected mutation with matching token", async () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.post("/protected", requireCsrf, (_req, res) => res.json({ ok: true }));

  const response = await request(app)
    .post("/protected")
    .set("Cookie", ["aleryaf_csrf=test-cookie"])
    .set("X-CSRF-Token", "test-cookie");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true });
});
