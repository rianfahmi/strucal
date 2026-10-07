import assert from "node:assert/strict";
import test from "node:test";
import { completeProjectBundle } from "./fixtures/complete-project.ts";
import { createDefaultMaterials, validateMaterials, sameMaterials } from "../src/lib/materials.ts";
import { createDefaultGeometry, validateGeometry, sameGeometry } from "../src/lib/geometry.ts";
import { createDefaultLoads, validateLoads, calculateSeismicWeight, sameLoads } from "../src/lib/loads.ts";
import { createDefaultSeismic, validateSeismicInput, sameSeismic } from "../src/lib/seismic.ts";

test("safety-net: complete project baseline outputs remain locked and immutable", () => {
  const bundle = completeProjectBundle();
  const res = bundle.seismic.derived_results!;

  // 1. Validasi Material
  const materialIssues = validateMaterials(bundle.materials);
  assert.equal(materialIssues.length, 0);
  assert.equal(bundle.materials.concrete.fc.value, 30);
  assert.equal(bundle.materials.longitudinal_rebar.fy.value, 420);
  assert.equal(bundle.materials.transverse_rebar.fys.value, 280);

  // 2. Validasi Geometri
  const geometryIssues = validateGeometry(bundle.geometry);
  assert.equal(geometryIssues.length, 0);
  assert.equal(bundle.geometry.stories.length, 4);
  const topElevation = bundle.geometry.stories[3].elevation;
  assert.equal(topElevation, 10.5);

  // 3. Validasi Berat Seismik M5
  const sw = calculateSeismicWeight(bundle.loads, bundle.geometry, bundle.revision.registry_version);
  assert.equal(sw.status, "AVAILABLE");
  assert.equal(sw.value, 270);
  assert.equal(sw.unit, "kN");
  assert.equal(sw.components.length, 1);

  // 4. Validasi Hasil Seismik M6
  assert.equal(res.status, "VALID");
  assert.equal(res.kds_review?.governing_kds, "D");

  // Spektrum
  assert.equal(res.coefficients?.fa.value, 1.2);
  assert.equal(res.coefficients?.fv.value, 2.0);
  assert.ok(Math.abs(res.spectrum!.sms.value - 0.9) < 1e-9);
  assert.ok(Math.abs(res.spectrum!.sm1.value - 0.6) < 1e-9);
  assert.ok(Math.abs(res.spectrum!.sds.value - 0.6) < 1e-9);
  assert.ok(Math.abs(res.spectrum!.sd1.value - 0.4) < 1e-9);

  // Parameter Sistem Struktur (C.5 SRPMK Beton)
  assert.equal(res.system_parameters?.R.value, 8);
  assert.equal(res.system_parameters?.omega0.value, 3);
  assert.equal(res.system_parameters?.Cd.value, 5.5);
  assert.equal(res.system_parameters?.Ct.value, 0.0466);
  assert.equal(res.system_parameters?.x.value, 0.9);

  // Periode
  assert.ok(Math.abs(res.period!.ta.value - 0.38677312181494855) < 1e-9);
  assert.equal(res.period?.cu.value, 1.4);
  assert.ok(Math.abs(res.period!.tmax.value - 0.541482370540928) < 1e-9);
  assert.ok(Math.abs(res.period!.used.value - 0.38677312181494855) < 1e-9);

  // Koefisien Seismik Cs
  assert.ok(Math.abs(res.response_coefficient!.nominal.value - 0.075) < 1e-9);
  assert.ok(Math.abs(res.response_coefficient!.upper_bound.value - 0.1292747535438165) < 1e-9);
  assert.ok(Math.abs(res.response_coefficient!.governing.value - 0.075) < 1e-9);

  // Gaya Geser Dasar (Base Shear) V
  assert.equal(res.seismic_weight?.value, 270);
  assert.ok(Math.abs(res.base_shear!.value - 20.25) < 1e-9);
  assert.equal(res.base_shear?.unit, "kN");

  // Distribusi Gaya Vertikal Fx
  assert.equal(res.story_forces.length, 3);
  const sumFx = res.story_forces.reduce((acc, f) => acc + f.force.value, 0);
  const sumCvx = res.story_forces.reduce((acc, f) => acc + f.cvx.value, 0);
  assert.ok(Math.abs(sumFx - 20.25) < 1e-9);
  assert.ok(Math.abs(sumCvx - 1.0) < 1e-9);
});

test("safety-net: default factory models retain strict schema validation contracts", () => {
  const rev = "rev-test-1";
  const reg = "SNI-1726:2019-M6-V1-approved-2026-09-28";

  // Default Materials mewajibkan input
  const defaultMat = createDefaultMaterials(rev);
  const matIssues = validateMaterials(defaultMat);
  assert.ok(matIssues.length >= 8); // grade, fc, density, cover, fy, fys, diameters

  // Default Geometry valid dan menyediakan 4 stories
  const defaultGeo = createDefaultGeometry(rev);
  const geoIssues = validateGeometry(defaultGeo);
  assert.equal(geoIssues.length, 0);
  assert.equal(defaultGeo.stories.length, 4);

  // Default Loads memiliki 6 kategori wajib
  const defaultLoads = createDefaultLoads(rev, reg);
  assert.equal(defaultLoads.definitions.length, 6);
  const loadIssues = validateLoads(defaultLoads, defaultGeo);
  assert.ok(loadIssues.length > 0); // belum ada nilai load

  // Default Seismic belum lengkap dan memerlukan input
  const defaultSeismic = createDefaultSeismic(rev, reg);
  const seismicIssues = validateSeismicInput(defaultSeismic);
  assert.ok(seismicIssues.length > 0);

  // Idempotensi perbandingan model
  assert.ok(sameMaterials(defaultMat, createDefaultMaterials("rev-other")));
  assert.ok(sameGeometry(defaultGeo, createDefaultGeometry("rev-other")));
  assert.ok(sameLoads(defaultLoads, createDefaultLoads("rev-other", reg)));
  assert.ok(sameSeismic(defaultSeismic, createDefaultSeismic("rev-other", reg)));
});
