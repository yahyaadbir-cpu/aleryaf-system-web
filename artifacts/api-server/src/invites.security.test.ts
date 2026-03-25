import test from "node:test";
import assert from "node:assert/strict";
import { isInviteRedeemable } from "./lib/invites";

test("invite token is not redeemable after expiry", () => {
  assert.equal(
    isInviteRedeemable({
      expiresAt: new Date("2025-01-01T00:00:00.000Z"),
      redeemedAt: null,
      revokedAt: null,
    }, new Date("2025-01-02T00:00:00.000Z")),
    false,
  );
});

test("invite token is single-use after redemption", () => {
  assert.equal(
    isInviteRedeemable({
      expiresAt: new Date("2025-01-02T00:00:00.000Z"),
      redeemedAt: new Date("2025-01-01T12:00:00.000Z"),
      revokedAt: null,
    }, new Date("2025-01-01T13:00:00.000Z")),
    false,
  );
});
