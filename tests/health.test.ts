import assert from "node:assert/strict";
import test from "node:test";
import { createHealthPayload } from "../src/lib/health.ts";

test("health payload reports a healthy StruCal service", () => {
  assert.deepEqual(createHealthPayload(), {
    service: "strucal",
    status: "ok",
    version: "0.0.0",
  });
});
