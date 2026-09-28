import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateSeismic, createDefaultSeismic, seismicContext, type SeismicContext, type TraceValue } from "../src/lib/seismic.ts";
import { createDefaultGeometry } from "../src/lib/geometry.ts";
import { getSeismicRegistry, type SeismicRegistry, type SeismicRuleSet } from "../src/lib/seismic-registry.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/seismic-engine-boundary.contract.json", import.meta.url), "utf8"));
const trace = (value: number, unit: string, id: string): TraceValue => ({
  value, unit, provenance: "CODE", formula_id: id, formula: id, substitution: String(value), source_inputs: {}, standard_ref: "TEST ONLY",
  registry_version: fixture.registry_version, engine_version: "test-engine", status: "VALID", warning: null,
});
const rules: SeismicRuleSet = {
  site_coefficients: () => ({ fa: trace(1, "-", "TEST.FA"), fv: trace(1, "-", "TEST.FV") }),
  design_spectrum: (input) => ({ sms: trace(input.ss!, "g", "TEST.SMS"), sm1: trace(input.s1!, "g", "TEST.SM1"), sds: trace(input.ss!, "g", "TEST.SDS"), sd1: trace(input.s1!, "g", "TEST.SD1") }),
  kds: (input, spectrum) => ({ risk_category: input.risk_category, sds: spectrum.sds, sd1: spectrum.sd1, checks: [{ rule_id: "TEST.KDS", label: "Fixture", input_value: spectrum.sds.value, input_unit: "g", result: "TEST-D", formula: "TEST ONLY", substitution: "TEST ONLY", standard_ref: "TEST ONLY", registry_version: fixture.registry_version, engine_version: "test-engine", status: "VALID", warning: null }], governing_kds: "TEST-D", standard_ref: "TEST ONLY" }),
  systems: () => [
    { id: "allowed", label: "Allowed fixture", status: "ALLOWED", reason: "Fixture", standard_ref: "TEST ONLY" },
    { id: "blocked", label: "Blocked fixture", status: "BLOCKED", reason: "Blocked by fixture", standard_ref: "TEST ONLY" },
  ],
  system_parameters: () => ({ R: trace(1, "-", "TEST.R"), omega0: trace(1, "-", "TEST.O"), Cd: trace(1, "-", "TEST.CD"), Ct: trace(1, "-", "TEST.CT"), x: trace(1, "-", "TEST.X") }),
  period: () => ({ ta: trace(1, "s", "TEST.TA"), limit: null }),
  response_coefficient: () => trace(0.1, "-", "TEST.CS"),
  base_shear: (coefficient, weight) => ({ ...trace(coefficient.value * weight.value, "kN", "TEST.V"), source_inputs: { Cs: coefficient.value, W: weight.value } }),
  story_distribution: (baseShear, stories) => stories.map((story) => ({ ...story, force: trace(baseShear.value, "kN", "TEST.FX") })),
  response_spectrum: () => [{ period: 0, acceleration: trace(1, "g", "TEST.SA") }],
};
const registry: SeismicRegistry = { registry_version: fixture.registry_version, standard_number: "TEST", standard_year: 0, status: "APPROVED", reviewed_by: "test", reviewed_at: "test", missing_rules: [], rules };
const context: SeismicContext = {
  building_height: fixture.input.height_m, concrete_material: true, engine_version: "test-engine",
  seismic_weight: { value: fixture.input.weight_kN, unit: "kN", status: "AVAILABLE", provenance: "CALCULATED", formula_id: "LOAD.SW.AGGREGATE.1", registry_version: fixture.registry_version, components: [], by_story: [{ story: "Roof", value: fixture.input.weight_kN, unit: "kN" }], warnings: [] },
  stories: [{ story: "Roof", elevation: fixture.input.height_m, weight: fixture.input.weight_kN }],
};

test("registry produksi berhenti pada batas data yang belum disetujui", () => {
  const model = { ...createDefaultSeismic("revision-1", "project-registry"), raw_inputs: { ss: 1, s1: 0.5, site_class: "X", risk_category: "X" } };
  const result = calculateSeismic(model, context, getSeismicRegistry("project-registry"));
  assert.equal(result.status, "REQUIRES_REGISTRY_DATA");
  assert.match(result.warnings[0], /Fa dan Fv/);
});

test("input mentah kosong ditolak sebelum lookup registry", () => {
  const result = calculateSeismic(createDefaultSeismic("revision-1", fixture.registry_version), context, registry);
  assert.equal(result.status, "REQUIRES_INPUT");
  assert.equal(result.warnings.length, 4);
});

test("tinggi dan elevasi story seismik relatif terhadap level dasar geometri", () => {
  const geometry = createDefaultGeometry("revision-1");
  const offset = geometry.stories.map((story) => ({ ...story, elevation: story.elevation + 100 }));
  const inherited = seismicContext(offset, context.seismic_weight, true, "test-engine");
  assert.equal(inherited.building_height, 10.5);
  assert.equal(inherited.stories[0].elevation, 3.5);
});

test("sistem blocked tetap terlihat dan tidak dapat menjadi pilihan valid", () => {
  const model = { ...createDefaultSeismic("revision-1", fixture.registry_version), raw_inputs: fixture.input, selected_structural_system_id: "blocked" };
  const result = calculateSeismic(model, context, registry);
  assert.equal(result.system_eligibility.find(({ id }) => id === "blocked")?.status, "BLOCKED");
  assert.equal(result.status, "INVALID_SYSTEM");
  assert.equal(result.base_shear, null);
});

test("fixture sintetis menguji kontrak pipeline, lookup parameter, provenance, base shear, distribusi, dan spectrum", () => {
  const model = { ...createDefaultSeismic("revision-1", fixture.registry_version), raw_inputs: fixture.input, selected_structural_system_id: "allowed" };
  const result = calculateSeismic(model, context, registry);
  assert.equal(result.status, "VALID");
  assert.equal(result.kds_review?.governing_kds, fixture.expected.kds);
  assert.equal(result.kds_review?.checks[0].input_value, fixture.input.ss);
  assert.equal(result.system_parameters?.R.formula_id, "TEST.R");
  assert.ok(Math.abs(result.period!.ta.value - fixture.expected.ta_s) <= fixture.tolerance);
  assert.ok(Math.abs(result.response_coefficient!.value - fixture.expected.cs) <= fixture.tolerance);
  assert.ok(Math.abs(result.base_shear!.value - fixture.expected.base_shear_kN) <= fixture.tolerance);
  assert.ok(Math.abs(result.story_forces[0].force.value - fixture.expected.story_force_kN) <= fixture.tolerance);
  assert.equal(result.response_spectrum[0].acceleration.unit, "g");
  assert.equal(result.base_shear?.source_inputs.W, fixture.input.weight_kN);
  assert.equal(result.base_shear?.registry_version, fixture.registry_version);
});

test("output registry tidak finite tidak pernah menjadi hasil valid", () => {
  const invalid = { ...registry, rules: { ...rules, response_coefficient: () => trace(Number.NaN, "-", "TEST.CS") } };
  const model = { ...createDefaultSeismic("revision-1", fixture.registry_version), raw_inputs: fixture.input, selected_structural_system_id: "allowed" };
  const result = calculateSeismic(model, context, invalid);
  assert.equal(result.status, "REQUIRES_REGISTRY_DATA");
  assert.equal(result.base_shear, null);
});
