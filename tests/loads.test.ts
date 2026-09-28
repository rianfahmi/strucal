import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultGeometry } from "../src/lib/geometry.ts";
import { getCombinationRegistry } from "../src/lib/load-registry.ts";
import {
  calculateSeismicWeight,
  changeLoadApplication,
  createDefaultLoads,
  loadTargets,
  validateLoads,
  type Loads,
} from "../src/lib/loads.ts";

const registryVersion = "registry-1";

function validLoads(): Loads {
  const loads = createDefaultLoads("revision-1", registryVersion);
  return {
    ...loads,
    definitions: loads.definitions.map((definition, index) => ({
      ...definition,
      value: index + 1,
      source: "Dokumen kriteria desain",
      assumption: "Beban merata pada seluruh lantai",
      seismic_weight_factor: definition.category === "WIND" ? 0 : 1,
    })),
    assignments: [{
      id: "assignment-1",
      load_id: "self_weight",
      target_type: "STORY_AREA",
      target_id: "story:1:area",
      application: "UNIFORM_AREA",
      assumption: "Diterapkan pada Story 1",
      revision_id: "revision-1",
      provenance: "INPUT",
    }],
  };
}

test("default load model menyediakan kategori minimum dengan unit, sumber, aplikasi, asumsi, dan revisi eksplisit", () => {
  const loads = createDefaultLoads("revision-1", registryVersion);
  assert.deepEqual(loads.definitions.map(({ category }) => category), ["SELF_WEIGHT", "SUPERIMPOSED_DEAD", "LIVE", "ROOF_LIVE", "WIND", "RAIN"]);
  assert.ok(loads.definitions.every(({ unit, application, revision_id, provenance }) => unit === "kN/m²" && application === "UNIFORM_AREA" && revision_id === "revision-1" && provenance === "INPUT"));
});

test("target assignment berasal dari area story dan garis grid pada geometri aktif", () => {
  const targets = loadTargets(createDefaultGeometry("revision-1"));
  assert.deepEqual(targets.find(({ id }) => id === "story:1:area"), {
    id: "story:1:area", type: "STORY_AREA", application: "UNIFORM_AREA", label: "Story 1 · area lantai", story: "Story 1", measure: 270, measure_unit: "m²",
  });
  assert.equal(targets.find(({ id }) => id === "story:1:grid:X:A")?.measure, 15);
  assert.equal(targets.find(({ id }) => id === "story:1:grid:Y:1")?.measure, 18);
});

test("perubahan aplikasi menormalisasi unit tanpa parser unit di UI", () => {
  const definition = createDefaultLoads("revision-1", registryVersion).definitions[0];
  assert.deepEqual(changeLoadApplication(definition, "UNIFORM_LINE"), { ...definition, application: "UNIFORM_LINE", unit: "kN/m" });
});

test("berat seismik diturunkan dari load definition, assignment, faktor, dan ukuran target", () => {
  const result = calculateSeismicWeight(validLoads(), createDefaultGeometry("revision-1"), registryVersion);
  assert.equal(result.status, "AVAILABLE");
  assert.equal(result.value, 270);
  assert.equal(result.components[0].provenance, "CALCULATED");
  assert.deepEqual(result.by_story, [{ story: "Story 1", value: 270, unit: "kN" }]);
  assert.equal(result.formula_id, "LOAD.SW.AGGREGATE.1");
});

test("validasi menolak input load kosong, target asing, dan duplikasi assignment tanpa memblokir referensi kombinasi", () => {
  const geometry = createDefaultGeometry("revision-1");
  const loads = validLoads();
  loads.definitions[0].source = "";
  loads.assignments.push({ ...loads.assignments[0], id: "assignment-2", target_id: "missing" });
  loads.combination_rule_ids = ["not-approved"];
  const paths = validateLoads(loads, geometry).map(({ path }) => path);
  assert.ok(paths.includes("definitions.0.source"));
  assert.ok(paths.includes("assignments.1.target_id"));
  assert.ok(!paths.some((path) => path.startsWith("combination_")));
});

test("registry kombinasi kosong tidak mengarang referensi proyek", () => {
  const registry = getCombinationRegistry(registryVersion);
  assert.equal(registry.status, "PENDING_ENGINEER_APPROVAL");
  assert.deepEqual(registry.rules, []);
});
