import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readJson = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const manifest = readJson("../registry/seismic/registry-requirements.manifest.json");
const schema = readJson("../registry/seismic/registry-item.schema.json");
const registry = readJson("../registry/seismic/sni-1726-2019.engineer-review.json");
const systems = readJson("../registry/seismic/sni-1726-2019.table-12.systems.json");
const fixtureSchema = readJson("../registry/seismic/golden-fixture.schema.json");
const fixtures = readJson("../registry/seismic/golden-fixtures.candidate.json");

const requiredRegistryFields = [
  "registry_key", "standard_id", "standard_version", "clause_or_table_reference", "source_pages",
  "applicability", "inputs", "outputs", "units", "interpolation_method", "boundary_behavior",
  "formula_id", "formula_expression", "source_status", "approval_status",
];

const entry = (key: string) => registry.entries.find((item: { registry_key: string }) => item.registry_key === key);
const fixture = (kind: string) => fixtures.fixtures.find((item: { verifies: string }) => item.verifies === kind);
const output = (item: { expected_outputs: Array<{ name: string; value: unknown }> }, name: string) =>
  item.expected_outputs.find((value) => value.name === name)?.value;

test("schema mendukung provenance halaman dan mewajibkan status review", () => {
  for (const field of requiredRegistryFields.filter((field) => field !== "source_pages")) assert.ok(schema.required.includes(field), `${field} belum wajib`);
  assert.ok(Object.hasOwn(schema.properties, "source_pages"));
  assert.deepEqual(schema.properties.approval_status.enum, ["DRAFT", "ENGINEER_REVIEW", "APPROVED", "REJECTED"]);
  assert.ok(schema.properties.source_status.enum.includes("STANDARD_EXTRACTED"));
});

test("manifest menunjuk registry hasil ekstraksi", () => {
  assert.equal(manifest.status, "ENGINEER_REVIEW_DATA_EXTRACTED");
  assert.equal(manifest.populated_registry, "./sni-1726-2019.engineer-review.json");
});

test("semua entry memenuhi metadata minimum dan belum approved", () => {
  assert.equal(registry.entries.length, 13);
  assert.equal(new Set(registry.entries.map((item: { registry_key: string }) => item.registry_key)).size, 13);
  for (const item of registry.entries) {
    for (const field of requiredRegistryFields) assert.ok(Object.hasOwn(item, field), `${item.registry_key}.${field} hilang`);
    assert.equal(item.standard_id, "SNI 1726");
    assert.equal(item.standard_version, "2019");
    assert.equal(item.source_status, "STANDARD_EXTRACTED");
    assert.equal(item.approval_status, "ENGINEER_REVIEW");
    assert.ok(item.clause_or_table_reference.length > 0);
    assert.ok(item.source_pages.length > 0 && item.source_pages.every(Number.isInteger));
  }
  assert.equal(registry.unresolved_review_items.length, 8);
});

test("Fa/Fv memuat seluruh sumbu, nilai, boundary, dan tidak mengarang interpolasi", () => {
  const fa = entry("seismic.site.fa");
  const fv = entry("seismic.site.fv");
  assert.deepEqual(fa.rule_data.axis_Ss_g.map((point: { value: number }) => point.value), [0.25, 0.5, 0.75, 1, 1.25, 1.5]);
  assert.deepEqual(fv.rule_data.axis_S1_g.map((point: { value: number }) => point.value), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
  assert.deepEqual(fa.rule_data.rows.SD, [1.6, 1.4, 1.2, 1.1, 1, 1]);
  assert.deepEqual(fv.rule_data.rows.SE, [4.2, 3.3, 2.8, 2.4, 2.2, 2]);
  assert.match(fa.interpolation_method, /^UNRESOLVED:/);
  assert.match(fv.interpolation_method, /^UNRESOLVED:/);
});

test("rumus spektrum menghasilkan kandidat boundary yang konsisten", () => {
  const f = fixture("SDS_SD1");
  const SMS = 1.2 * 0.75;
  const SM1 = 2 * 0.3;
  const SDS = (2 / 3) * SMS;
  const SD1 = (2 / 3) * SM1;
  assert.ok(Math.abs(SMS - Number(output(f, "SMS"))) < 1e-12);
  assert.ok(Math.abs(SM1 - Number(output(f, "SM1"))) < 1e-12);
  assert.ok(Math.abs(SDS - Number(output(f, "SDS"))) < 1e-12);
  assert.ok(Math.abs(SD1 - Number(output(f, "SD1"))) < 1e-12);
  assert.ok(Math.abs(0.2 * SD1 / SDS - Number(output(f, "T0"))) < 1e-12);
  assert.ok(Math.abs(SD1 / SDS - Number(output(f, "Ts"))) < 1e-12);

  const spectrum = fixture("RESPONSE_SPECTRUM_ORDINATES");
  assert.ok(Math.abs(0.4 * SDS - Number(output(spectrum, "Sa_T0zero"))) < 1e-12);
  assert.ok(Math.abs(SD1 / 8 - Number(output(spectrum, "Sa_at_TL"))) < 1e-12);
  assert.ok(Math.abs(SD1 * 8 / 10 ** 2 - Number(output(spectrum, "Sa_at_10s"))) < 1e-12);
});

test("Tabel 12 lengkap: 85 system_id, parameter, lima kolom KDS, footnote a-p", () => {
  assert.equal(systems.rows.length, 85);
  assert.equal(new Set(systems.rows.map((row: { system_id: string }) => row.system_id)).size, 85);
  assert.deepEqual(
    Object.fromEntries([..."ABCDEFGH"].map((family) => [family, systems.rows.filter((row: { system_id: string }) => row.system_id.startsWith(`${family}.`)).length])),
    { A: 18, B: 26, C: 12, D: 13, E: 8, F: 1, G: 6, H: 1 },
  );
  for (const row of systems.rows) {
    assert.ok(row.R > 0 && row.Omega0 > 0 && row.Cd > 0);
    assert.deepEqual(Object.keys(row.limits), ["B", "C", "D", "E", "F"]);
    assert.ok([49, 50, 51].includes(row.source_page));
  }
  assert.deepEqual(Object.keys(systems.footnotes), [..."abcdefghijklmnop"]);
  assert.equal(systems.rows.find((row: { system_id: string }) => row.system_id === "C.1").Cd, 5.5);
  assert.equal(systems.rows.find((row: { system_id: string }) => row.system_id === "B.24").limits.F, "TB");
  assert.ok(systems.review_flags.length > 0);
});

test("periode, Cs, V, dan Fx kandidat mengikuti formula registry", () => {
  const ta = fixture("TA");
  const Ta = 0.0724 * 30 ** 0.8;
  assert.ok(Math.abs(Ta - Number(output(ta, "Ta"))) < 1e-12);
  assert.ok(Math.abs(1.4 * Ta - Number(output(ta, "Tmax"))) < 1e-12);

  const cs = fixture("CS");
  const Cs = Math.max(Math.max(0.044 * 0.6, 0.01), Math.min(0.6 / 8, 0.4 / (Ta * 8)));
  assert.ok(Math.abs(Cs - Number(output(cs, "Cs"))) < 1e-12);

  const v = fixture("V");
  const V = Cs * 10_000;
  assert.ok(Math.abs(V - Number(output(v, "V"))) < 1e-9);

  const fx = fixture("FX");
  const k = 1 + (Ta - 0.5) / 2;
  const terms = [3, 6, 9].map((height) => 1_000 * height ** k);
  const forces = terms.map((term) => V * term / terms.reduce((sum, value) => sum + value, 0));
  assert.ok(Math.abs(k - Number(output(fx, "k"))) < 1e-12);
  assert.ok(Math.abs(forces.reduce((sum, value) => sum + value, 0) - Number(output(fx, "sum_Fx"))) < 1e-9);
});

test("candidate fixtures mencakup sepuluh sasaran dan semuanya menunggu review", () => {
  const expected = fixtureSchema.properties.verifies.enum;
  assert.deepEqual(fixtures.fixtures.map(({ verifies }: { verifies: string }) => verifies).sort(), [...expected].sort());
  assert.equal(new Set(fixtures.fixtures.map(({ fixture_id }: { fixture_id: string }) => fixture_id)).size, fixtures.fixtures.length);
  for (const item of fixtures.fixtures) {
    assert.equal(item.registry_version, registry.registry_version);
    assert.equal(item.source_status, "STANDARD_DERIVED");
    assert.equal(item.approval_status, "ENGINEER_REVIEW");
    assert.ok(item.clause_or_table_references.length > 0);
  }
});
