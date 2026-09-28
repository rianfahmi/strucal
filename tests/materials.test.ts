import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultMaterials, validateMaterials, type Materials } from "../src/lib/materials.ts";
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
