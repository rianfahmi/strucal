import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_FYS_LIMIT,
  applyConcretePreset,
  applyCoverPreset,
  applyRebarPreset,
  applyStandardDiameters,
  createDefaultMaterials,
  validateMaterials,
  type Materials,
} from "../src/lib/materials.ts";
import { createProjectBundle, reviseMaterials } from "../src/lib/projects.ts";

function validMaterials(revisionId = "revision-1"): Materials {
  const materials = createDefaultMaterials(revisionId);
  return {
    ...materials,
    concrete: {
      ...materials.concrete,
      grade: "fc' 30",
      fc: { ...materials.concrete.fc, value: 30 },
      density: { ...materials.concrete.density, value: 2400 },
      cover: { ...materials.concrete.cover, value: 40 },
    },
    longitudinal_rebar: { ...materials.longitudinal_rebar, grade: "BJTS 420", fy: { ...materials.longitudinal_rebar.fy, value: 420 } },
    transverse_rebar: { ...materials.transverse_rebar, grade: "BJTS 280", fys: { ...materials.transverse_rebar.fys, value: 280 } },
    available_diameters: [10, 13, 16].map((value) => ({ id: `D${value}`, nominal_diameter: { value, unit: "mm", provenance: "INPUT" } })),
  };
}

test("model material memakai unit dan provenance eksplisit tanpa mengarang rumus Ec", () => {
  const materials = createDefaultMaterials("revision-1");

  assert.equal(materials.concrete.fc.unit, "MPa");
  assert.equal(materials.concrete.density.unit, "kg/m³");
  assert.equal(materials.concrete.cover.unit, "mm");
  assert.equal(materials.longitudinal_rebar.fy.provenance, "INPUT");
  assert.equal(materials.transverse_rebar.fys.provenance, "INPUT");
  assert.deepEqual(materials.concrete.elastic_modulus, {
    value: null,
    unit: "MPa",
    provenance: "CODE",
    status: "UNAVAILABLE",
    formula_id: null,
    standard_ref: null,
  });
});

test("validasi menerima material lengkap dan diameter terstruktur", () => {
  const materials = validMaterials();
  assert.deepEqual(validateMaterials(materials), []);
  assert.deepEqual(materials.available_diameters.map(({ nominal_diameter }) => nominal_diameter), [
    { value: 10, unit: "mm", provenance: "INPUT" },
    { value: 13, unit: "mm", provenance: "INPUT" },
    { value: 16, unit: "mm", provenance: "INPUT" },
  ]);
});

test("validasi menolak nilai wajib kosong, nonpositif, dan diameter duplikat", () => {
  const materials = validMaterials();
  materials.concrete.fc.value = 0;
  materials.transverse_rebar.fys.value = Number.NaN;
  materials.available_diameters.push({ id: "duplicate", nominal_diameter: { value: 13, unit: "mm", provenance: "INPUT" } });

  const paths = validateMaterials(materials).map(({ path }) => path);
  assert.ok(paths.includes("concrete.fc"));
  assert.ok(paths.includes("transverse_rebar.fys"));
  assert.ok(paths.includes("available_diameters.3.nominal_diameter"));
});

test("penyimpanan material membuat revisi dan mempertahankan geometri", () => {
  const initial = createProjectBundle(
    { title: "Gedung A", location: "", function: "", owner: "" },
    (() => { const values = ["project-1", "revision-1"]; return () => values.shift()!; })(),
    () => "2026-09-28T00:00:00.000Z",
  );
  const saved = reviseMaterials(initial, validMaterials(), "manual", () => "revision-2", () => "2026-09-28T00:01:00.000Z");

  assert.equal(saved.revision.source_revision_id, "revision-1");
  assert.equal(saved.materials.revision_id, "revision-2");
  assert.equal(saved.geometry.revision_id, "revision-2");
  assert.equal(saved.materials.concrete.fc.value, 30);
  assert.deepEqual(saved.geometry.grid_x, initial.geometry.grid_x);
  assert.throws(() => reviseMaterials(initial, createDefaultMaterials("revision-1"), "manual"), /Mutu beton wajib diisi/);
});

test("preset mutu beton mengisi fc', density, cover dengan benar dan mendukung override", () => {
  const initial = createDefaultMaterials("rev-1");
  const applied = applyConcretePreset(initial, "fc-25");

  assert.equal(applied.concrete.grade, "fc' 25 MPa");
  assert.equal(applied.concrete.fc.value, 25);
  assert.equal(applied.concrete.density.value, 2400);
  assert.equal(applied.concrete.cover.value, 40);

  // Mekanisme override manual
  const overridden = {
    ...applied,
    concrete: {
      ...applied.concrete,
      fc: { ...applied.concrete.fc, value: 27.5 },
      cover: { ...applied.concrete.cover, value: 50 },
    },
  };
  assert.equal(overridden.concrete.fc.value, 27.5);
  assert.equal(overridden.concrete.cover.value, 50);
});

test("preset baja tulangan mengisi fy dan fys dengan default terikat dan batas 420 MPa", () => {
  const initial = createDefaultMaterials("rev-1");
  
  // BjTS 420B
  const m420 = applyRebarPreset(initial, "bjts-420b");
  assert.equal(m420.longitudinal_rebar.grade, "BjTS 420B");
  assert.equal(m420.longitudinal_rebar.fy.value, 420);
  assert.equal(m420.transverse_rebar.fys.value, 420);

  // BjTS 520 (fy=520, tetapi fys dibatasi ke 420 untuk sengkang sesuai SNI 2847)
  const m520 = applyRebarPreset(initial, "bjts-520");
  assert.equal(m520.longitudinal_rebar.fy.value, 520);
  assert.equal(m520.transverse_rebar.fys.value, MAX_FYS_LIMIT);

  // Override manual fys
  const customTransverse = {
    ...m420,
    transverse_rebar: {
      ...m420.transverse_rebar,
      grade: "BjTP 280",
      fys: { ...m420.transverse_rebar.fys, value: 280 },
    },
  };
  assert.equal(customTransverse.transverse_rebar.fys.value, 280);
});

test("validasi menolak fys melebihi 420 MPa sesuai SNI 2847:2019 Tabel 20.2.2.4a", () => {
  const materials = validMaterials();
  materials.transverse_rebar.fys.value = 500;

  const issues = validateMaterials(materials);
  const fysIssue = issues.find(({ path }) => path === "transverse_rebar.fys");
  assert.ok(fysIssue);
  assert.match(fysIssue.message, /melebihi batas maksimum 420 MPa/);
  assert.match(fysIssue.message, /SNI 2847:2019 Tabel 20.2.2.4a/);

  // Batas tepat 420 MPa harus diterima
  materials.transverse_rebar.fys.value = 420;
  assert.equal(validateMaterials(materials).length, 0);
});

test("preset selimut dan diameter standar mengisi parameter dengan benar", () => {
  const initial = createDefaultMaterials("rev-1");
  const withCover = applyCoverPreset(initial, "earth-contact-permanent");
  assert.equal(withCover.concrete.cover.value, 75);

  const withDiameters = applyStandardDiameters(initial);
  assert.deepEqual(withDiameters.available_diameters.map((d) => d.nominal_diameter.value), [10, 13, 16, 19, 22, 25]);
});
