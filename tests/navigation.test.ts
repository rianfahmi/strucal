import assert from "node:assert/strict";
import test from "node:test";
import { navigationGroups, navigationItems } from "../src/lib/navigation.ts";

test("navigation matches approved IA", () => {
  assert.deepEqual(navigationGroups.map((group) => group.label), [
    "Overview",
    "Tahap 1 — Parameter Awal",
    "Tahap 2 — Hasil Analisis",
    "Tahap 3 — Desain",
    "Output",
  ]);
  assert.equal(navigationItems.length, 16);
  assert.equal(new Set(navigationItems.map((item) => item.href)).size, navigationItems.length);
  assert.equal(navigationItems.at(-1)?.label, "Generate #2");
});
