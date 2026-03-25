import test from "node:test";
import assert from "node:assert/strict";
import { buildSafeHandbookResponse } from "./routes/handbook";

test("handbook safe response does not leak passwords or private keys", () => {
  const response = buildSafeHandbookResponse();
  const serialized = JSON.stringify(response).toLowerCase();

  assert.equal(serialized.includes("adminpassword"), false);
  assert.equal(serialized.includes("employeebootstrappassword"), false);
  assert.equal(serialized.includes("privatekey"), false);
  assert.equal(serialized.includes("database_url"), false);
});
