import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readJson = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const manifest = readJson("../registry/seismic/registry-requirements.manifest.json");
const registrySchema = readJson("../registry/seismic/registry-item.schema.json");
const fixtureTemplate = readJson("../registry/seismic/golden-fixtures.template.json");
const fixtureSchema = readJson("../registry/seismic/golden-fixture.schema.json");

const requiredRegistryFields = [
  "registry_key", "standard_id", "standard_version", "clause_or_table_reference", "applicability",
  "inputs", "outputs", "units", "interpolation_method", "boundary_behavior", "formula_id",
  "formula_expression", "source_status", "approval_status",
];
const approvalStatuses = ["DRAFT", "ENGINEER_REVIEW", "APPROVED", "REJECTED"];
const categories = [
  "FA_TABLE", "FV_TABLE", "DESIGN_SPECTRUM", "KDS_DETERMINATION", "STRUCTURAL_SYSTEM_ELIGIBILITY",
  "STRUCTURAL_SYSTEM_PARAMETERS", "PERIOD_CALCULATION", "SEISMIC_RESPONSE_COEFFICIENT", "BASE_SHEAR",
  "VERTICAL_STORY_FORCE_DISTRIBUTION", "RESPONSE_SPECTRUM_GENERATION", "GOLDEN_FIXTURES",
];

test("schema registry mewajibkan seluruh metadata audit dan status approval", () => {
  for (const field of requiredRegistryFields) assert.ok(registrySchema.required.includes(field), `${field} belum wajib`);
  assert.deepEqual(registrySchema.properties.approval_status.enum, approvalStatuses);
});

test("manifest mencakup 12 kategori M6 dengan key unik dan tanpa nilai engineering", () => {
  assert.equal(manifest.status, "BLOCKED_PENDING_ENGINEERING_DATA");
  assert.deepEqual([...new Set(manifest.items.map((item: { category: string }) => item.category))].sort(), [...categories].sort());
  assert.equal(new Set(manifest.items.map((item: { registry_key: string }) => item.registry_key)).size, manifest.items.length);
  for (const item of manifest.items) {
    for (const field of requiredRegistryFields) assert.ok(Object.hasOwn(item, field), `${item.registry_key}.${field} hilang`);
    assert.equal(item.standard_id, "SNI 1726");
    assert.equal(item.standard_version, "2019");
    assert.equal(item.source_status, "UNRESOLVED");
    assert.equal(item.approval_status, "DRAFT");
    assert.equal(item.clause_or_table_reference, null);
    assert.equal(item.formula_expression, null);
    assert.ok(item.inputs.length > 0 && item.outputs.length > 0);
  }
});

test("Fa dan Fv mendefinisikan sumbu, unit, interpolasi, boundary, dan referensi unresolved", () => {
  const fa = manifest.items.find((item: { registry_key: string }) => item.registry_key === "seismic.site.fa");
  const fv = manifest.items.find((item: { registry_key: string }) => item.registry_key === "seismic.site.fv");
  assert.deepEqual(fa.inputs.map(({ name }: { name: string }) => name), ["site_class", "Ss"]);
  assert.deepEqual(fv.inputs.map(({ name }: { name: string }) => name), ["site_class", "S1"]);
  for (const item of [fa, fv]) {
    assert.equal(item.interpolation_method, null);
    assert.equal(item.boundary_behavior, null);
    assert.equal(item.clause_or_table_reference, null);
    assert.equal(item.outputs[0].unit, "dimensionless");
  }
});

test("template fixture mencakup minimum 10 sasaran dan tetap unresolved", () => {
  const verifies = fixtureSchema.properties.verifies.enum;
  assert.deepEqual(fixtureTemplate.fixtures.map(({ verifies: value }: { verifies: string }) => value).sort(), [...verifies].sort());
  assert.equal(new Set(fixtureTemplate.fixtures.map(({ fixture_id }: { fixture_id: string }) => fixture_id)).size, fixtureTemplate.fixtures.length);
  for (const fixture of fixtureTemplate.fixtures) {
    assert.equal(fixture.registry_version, null);
    assert.equal(fixture.source_status, "UNRESOLVED");
    assert.equal(fixture.approval_status, "DRAFT");
    assert.deepEqual(fixture.inputs, []);
    assert.deepEqual(fixture.expected_outputs, []);
    assert.deepEqual(fixture.tolerances, []);
    assert.ok(fixture.required_cases.length > 0);
  }
});
