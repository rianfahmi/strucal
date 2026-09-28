import assert from "node:assert/strict";
import test from "node:test";
import { createEtabsHandoff } from "../src/lib/etabs-handoff.ts";
import { getCombinationRegistry, type CombinationRegistry } from "../src/lib/load-registry.ts";
import { createProjectBundle, reviseGeometry, type ProjectBundle } from "../src/lib/projects.ts";
import { completeProjectBundle } from "./fixtures/complete-project.ts";

const completeBundle = completeProjectBundle;

test("M7 mengagregasi M3–M6, provenance, load case, dan tabel spektrum dari revisi aktif", () => {
  const bundle = completeBundle();
  const handoff = createEtabsHandoff(bundle);
  assert.deepEqual(handoff.grids[0].spacings, [6, 6, 6]);
  assert.equal(handoff.stories.at(-1)?.elevation, 10.5);
  assert.equal(handoff.materials.concrete.fc.value, 30);
  assert.equal(handoff.patterns[0].categoryLabel, "Self Weight");
  assert.equal(handoff.assignments[0].target?.label, "Story 1 · area lantai");
  assert.equal(handoff.assignments[0].definition?.unit, "kN/m²");
  assert.equal(handoff.rawSeismic.site_class, "SD");
  assert.ok(Math.abs(handoff.result!.spectrum!.sds.value - 0.6) < 1e-12);
  assert.equal(handoff.result?.kds_review?.governing_kds, "D");
  assert.equal(handoff.result?.seismic_weight?.value, 270);
  assert.ok(Math.abs(handoff.result!.base_shear!.value - 20.25) < 1e-12);
  assert.equal(handoff.inputProvenance.ss.source, "PUSKIM");
  assert.equal(handoff.registryVersion, bundle.revision.registry_version);
  assert.equal(handoff.loadCases[0].name, handoff.patterns[0].name);
  assert.equal(handoff.loadCases.at(-1)?.source, "M6");
  assert.ok(handoff.spectrum.length > 100);
  assert.equal(handoff.spectrum[0].acceleration.unit, "g");
  assert.equal(handoff.status, "READY");
  assert.equal(handoff.readiness.find(({ label }) => label === "Kombinasi beban")?.status, "WARNING");
  assert.equal(handoff.readiness.find(({ label }) => label === "Kombinasi beban")?.classification, "REFERENCE_ONLY");
});

test("data hilang, assignment invalid, dan revisi upstream tidak pernah READY", () => {
  const empty = createEtabsHandoff(createProjectBundle({ title: "Baru", location: "", function: "", owner: "" }));
  assert.equal(empty.status, "BLOCKED");
  assert.equal(empty.readiness.find(({ label }) => label === "Material")?.status, "BLOCKED");
  const invalidGeometry = completeBundle();
  invalidGeometry.geometry.grid_x = [];
  assert.equal(createEtabsHandoff(invalidGeometry).readiness.find(({ label }) => label === "Geometri")?.status, "BLOCKED");
  const bundle = completeBundle();
  bundle.loads.assignments[0].target_id = "missing";
  assert.equal(createEtabsHandoff(bundle).readiness.find(({ label }) => label === "Assignment beban")?.status, "BLOCKED");
  const original = completeBundle();
  const changed = reviseGeometry(original, { ...original.geometry, grid_x: original.geometry.grid_x.map((line, index) => index === 1 ? { ...line, ordinate: 7 } : line) }, "manual", () => "revision-2");
  const stale = createEtabsHandoff(changed);
  assert.equal(stale.stale, true);
  assert.equal(stale.result, null);
  assert.equal(stale.readiness.find(({ label }) => label === "Perhitungan seismik")?.status, "BLOCKED");
  assert.equal(stale.grids[0].lines[1].ordinate, 7);
});

test("kombinasi referensi terpilih ditampilkan tanpa memblokir readiness atau mensyaratkan approval", () => {
  const bundle = completeBundle();
  const pending = getCombinationRegistry(bundle.revision.registry_version);
  bundle.loads.combination_rule_ids = ["COMBO-1"];
  const reviewRegistry: CombinationRegistry = { ...pending, rules: [{ id: "COMBO-1", label: "Uji", expression: "1.2D + 1.6L", standard_ref: "Referensi proyek", reviewed_by: "", reviewed_at: "" }] };
  const reviewHandoff = createEtabsHandoff(bundle, reviewRegistry);
  assert.deepEqual(reviewHandoff.combinations.map(({ expression }) => expression), ["1.2D + 1.6L"]);
  assert.equal(reviewHandoff.status, "READY");
  const approved: CombinationRegistry = { ...pending, status: "APPROVED", rules: [{ id: "COMBO-1", label: "Uji", expression: "1.2D + 1.6L", standard_ref: "Engineer approved fixture", reviewed_by: "Engineer", reviewed_at: "2026-09-28" }] };
  const handoff = createEtabsHandoff(bundle, approved);
  assert.deepEqual(handoff.combinations.map(({ expression }) => expression), ["1.2D + 1.6L"]);
  assert.equal(handoff.readiness.find(({ label }) => label === "Kombinasi beban")?.status, "READY");
  assert.equal(handoff.status, "READY");
});

test("asumsi pemodelan tersisa diklasifikasikan sebagai warning atau tanggung jawab ETABS", () => {
  const handoff = createEtabsHandoff(completeBundle());
  assert.equal(handoff.readiness.find(({ label }) => label === "Section / elemen")?.classification, "WARNING_ONLY");
  for (const label of ["Boundary / restraint", "Self-weight multiplier", "Setup load case", "Setup response spectrum"]) {
    const item = handoff.readiness.find((entry) => entry.label === label);
    assert.equal(item?.status, "WARNING");
    assert.equal(item?.classification, "ETABS_RESPONSIBILITY");
  }
  assert.equal(handoff.status, "READY");
});

test("bundle hasil reopen tetap menghasilkan handoff yang sama", () => {
  const bundle = completeBundle();
  const reopened = structuredClone(bundle) as ProjectBundle;
  const before = createEtabsHandoff(bundle);
  const after = createEtabsHandoff(reopened);
  assert.equal(after.revisionId, before.revisionId);
  assert.equal(after.result?.base_shear?.value, before.result?.base_shear?.value);
  assert.deepEqual(after.readiness, before.readiness);
  assert.deepEqual(after.spectrum, before.spectrum);
});
