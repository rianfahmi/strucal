import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultGeometry } from "../src/lib/geometry.ts";
import { calculateCu, getSeismicRegistry } from "../src/lib/seismic-registry.ts";
import { calculateSeismic, createDefaultSeismic, evaluateResponseSpectrum, seismicContext, type SeismicModel } from "../src/lib/seismic.ts";

const closeTo = (actual: number, expected: number, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

const registryVersion = "SNI-1726:2019|SNI-1727:2020|SNI-2847:2019";
const registry = getSeismicRegistry(registryVersion);
const geometry = createDefaultGeometry("revision-1");
const weight = {
  value: 3000, unit: "kN" as const, status: "AVAILABLE" as const, provenance: "CALCULATED" as const,
  formula_id: "LOAD.SW.AGGREGATE.1" as const, registry_version: registryVersion, components: [],
  by_story: geometry.stories.filter(({ order }) => order > 0).map(({ name }) => ({ story: name, value: 1000, unit: "kN" as const })), warnings: [],
};
const context = seismicContext(geometry.stories, weight, true, "test-engine");

function approvedModel(): SeismicModel {
  const model = createDefaultSeismic("revision-1", registryVersion);
  model.raw_inputs = { site_class: "SD", ss: 0.75, s1: 0.3, tl: 8, fa: 1.2, fv: 2, risk_category: "II" };
  for (const key of Object.keys(model.input_provenance) as (keyof typeof model.input_provenance)[]) model.input_provenance[key] = { source: "PUSKIM", entered_by: "Engineer A", status: "INPUT", project_revision: "revision-1" };
  model.engineering_options.moment_frame_carries_all_seismic_force = true;
  model.engineering_options.moment_frame_unrestrained_by_rigid_components = true;
  model.selected_structural_system_id = "C.5";
  return model;
}

test("input engineer/PUSKIM wajib lengkap beserta provenance", () => {
  const invalid = createDefaultSeismic("revision-1", registryVersion);
  const result = calculateSeismic(invalid, context, registry);
  assert.equal(result.status, "REQUIRES_INPUT");
  assert.ok(result.warnings.some((warning) => warning.includes("Sumber")));
  assert.equal(approvedModel().input_provenance.fa.status, "INPUT");
});

test("Fa/Fv adalah INPUT tanpa interpolasi dan parameter spektrum diturunkan otomatis", () => {
  const result = calculateSeismic({ ...approvedModel(), selected_structural_system_id: null }, context, registry);
  assert.equal(result.coefficients?.fa.provenance, "INPUT");
  assert.equal(result.coefficients?.fv.formula_id, "INPUT.FV.M6.V1");
  closeTo(result.spectrum!.sms.value, 0.9);
  closeTo(result.spectrum!.sm1.value, 0.6);
  closeTo(result.spectrum!.sds.value, 0.6);
  closeTo(result.spectrum!.sd1.value, 0.4);
  assert.ok(Math.abs(result.spectrum!.t0.value - 0.13333333333333333) < 1e-12);
  assert.ok(Math.abs(result.spectrum!.ts.value - 0.6666666666666667) < 1e-12);
});

test("KDS otomatis menampilkan kedua tabel dan governing", () => {
  const review = calculateSeismic({ ...approvedModel(), selected_structural_system_id: null }, context, registry).kds_review!;
  assert.deepEqual(review.checks.map(({ result }) => result), ["D", "D"]);
  assert.equal(review.governing_kds, "D");
  assert.match(review.checks[0].standard_ref, /Tabel 8/);
});

test("sistem allowed dapat dipilih dan sistem blocked tetap terlihat", () => {
  const result = calculateSeismic(approvedModel(), context, registry);
  assert.equal(result.system_eligibility.find(({ id }) => id === "C.5")?.status, "ALLOWED");
  assert.equal(result.system_eligibility.find(({ id }) => id === "C.7")?.status, "BLOCKED");
  const blocked = calculateSeismic({ ...approvedModel(), selected_structural_system_id: "C.7" }, context, registry);
  assert.equal(blocked.status, "INVALID_SYSTEM");
});

test("interpretasi tinggi 7.2.5.4 hanya allowed bila seluruh kondisi terpenuhi", () => {
  const tallContext = { ...context, building_height: 60 };
  const model = approvedModel();
  model.selected_structural_system_id = "A.1";
  model.engineering_options.special_height = { enabled: true, reinforced_concrete_wall_cast_in_place: true, no_excessive_torsional_irregularity_type_1b: true, max_plane_share_percent: 60 };
  const allowed = calculateSeismic(model, tallContext, registry);
  assert.equal(allowed.system_eligibility.find(({ id }) => id === "A.1")?.status, "ALLOWED");
  assert.match(allowed.system_eligibility.find(({ id }) => id === "A.1")!.standard_ref, /ENGINEER_APPROVED/);
  model.engineering_options.special_height.max_plane_share_percent = 61;
  assert.equal(calculateSeismic(model, tallContext, registry).system_eligibility.find(({ id }) => id === "A.1")?.status, "CONDITIONAL");
});

test("lookup R/Omega0/Cd dan klasifikasi Ct/x beton dapat diaudit", () => {
  const parameters = calculateSeismic(approvedModel(), context, registry).system_parameters!;
  assert.deepEqual([parameters.R.value, parameters.omega0.value, parameters.Cd.value], [8, 3, 5.5]);
  assert.deepEqual([parameters.Ct.value, parameters.x.value], [0.0466, 0.9]);
  assert.equal(parameters.period_classification.id, "CONCRETE_MOMENT_FRAME");
});

test("rangka momen jatuh ke klasifikasi OTHER bila syarat Tabel 18 tidak terpenuhi", () => {
  const model = approvedModel();
  model.engineering_options.moment_frame_carries_all_seismic_force = false;
  const parameters = calculateSeismic(model, context, registry).system_parameters!;
  assert.deepEqual([parameters.Ct.value, parameters.x.value], [0.0488, 0.75]);
  assert.equal(parameters.period_classification.id, "OTHER");
});

test("Cu tepat pada breakpoint dan terinterpolasi linier dengan presisi penuh", () => {
  assert.equal(calculateCu(0.1), 1.7);
  assert.equal(calculateCu(0.15), 1.6);
  assert.equal(calculateCu(0.175), 1.55);
  assert.equal(calculateCu(0.2), 1.5);
  assert.equal(calculateCu(0.25), 1.45);
  assert.equal(calculateCu(0.3), 1.4);
});

test("Ta, Cu, Tmax, dan periode digunakan tetap terpisah", () => {
  const period = calculateSeismic(approvedModel(), context, registry).period!;
  assert.ok(Math.abs(period.ta.value - 0.38677312181494855) < 1e-12);
  assert.equal(period.cu.value, 1.4);
  assert.ok(Math.abs(period.tmax.value - 0.541482370540928) < 1e-12);
  assert.equal(period.analytical_period, null);
  assert.equal(period.used.value, period.ta.value);
});

test("Cs menyimpan nominal, batas, dan nilai governing", () => {
  const cs = calculateSeismic(approvedModel(), context, registry).response_coefficient!;
  closeTo(cs.nominal.value, 0.075);
  assert.ok(Math.abs(cs.upper_bound.value - 0.12927475354381654) < 1e-12);
  closeTo(cs.lower_bounds[0].value, 0.0264);
  closeTo(cs.governing.value, 0.075);
});

test("V memakai W M5 aktif", () => {
  const result = calculateSeismic(approvedModel(), context, registry);
  assert.equal(result.seismic_weight?.provenance, "INHERITED");
  closeTo(result.base_shear!.value, 225);
  assert.equal(result.base_shear?.source_inputs.W, 3000);
});

test("distribusi vertikal memenuhi jumlah Cvx=1 dan Fx=V", () => {
  const result = calculateSeismic(approvedModel(), context, registry);
  assert.equal(result.story_exponent?.value, 1);
  assert.ok(Math.abs(result.story_forces.reduce((sum, item) => sum + item.cvx.value, 0) - 1) < 1e-12);
  assert.ok(Math.abs(result.story_forces.reduce((sum, item) => sum + item.force.value, 0) - result.base_shear!.value) < 1e-12);
  result.story_forces.forEach(({ force }, index) => closeTo(force.value, [37.5, 75, 112.5][index]));
});

test("spektrum kontinu mengevaluasi breakpoint dan periode arbitrer", () => {
  const model = approvedModel();
  const result = calculateSeismic(model, context, registry);
  closeTo(evaluateResponseSpectrum(0, model, context, registry).value, 0.24);
  closeTo(evaluateResponseSpectrum(result.spectrum!.t0.value, model, context, registry).value, 0.6);
  closeTo(evaluateResponseSpectrum(result.spectrum!.ts.value, model, context, registry).value, 0.6);
  closeTo(evaluateResponseSpectrum(8, model, context, registry).value, 0.05);
  closeTo(evaluateResponseSpectrum(10, model, context, registry).value, 0.032);
});

test("sampling default 0–6 s/0,01 s menyuntikkan T0 dan Ts tanpa TL di luar chart", () => {
  const result = calculateSeismic(approvedModel(), context, registry);
  assert.equal(result.response_spectrum[0].period, 0);
  assert.equal(result.response_spectrum.at(-1)?.period, 6);
  assert.ok(result.response_spectrum.some(({ period }) => period === result.spectrum!.t0.value));
  assert.ok(result.response_spectrum.some(({ period }) => period === result.spectrum!.ts.value));
  assert.ok(!result.response_spectrum.some(({ period }) => period === 8));
});

test("registry final approved dan pipeline memiliki provenance lengkap", () => {
  const result = calculateSeismic(approvedModel(), context, registry);
  assert.equal(registry.status, "APPROVED");
  assert.equal(result.status, "VALID");
  assert.equal(result.base_shear?.registry_version, registryVersion);
  assert.equal(result.base_shear?.engine_version, "test-engine");
});
