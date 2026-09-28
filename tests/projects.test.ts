import assert from "node:assert/strict";
import test from "node:test";
import { createProjectBundle, reviseGeometry, reviseLoads, reviseProject, reviseSeismic } from "../src/lib/projects.ts";
import type { SeismicResult } from "../src/lib/seismic.ts";

const ids = (...values: string[]) => {
  let index = 0;
  return () => values[index++];
};

test("project creation identifies its initial active revision", () => {
  const bundle = createProjectBundle(
    { title: "Gedung A", location: "Bandung", function: "Kantor", owner: "Pemilik" },
    ids("project-1", "revision-1"),
    () => "2026-09-28T00:00:00.000Z",
  );

  assert.equal(bundle.project.active_revision_id, "revision-1");
  assert.equal(bundle.revision.project_id, "project-1");
  assert.equal(bundle.revision.revision_number, 1);
  assert.equal(bundle.revision.source_revision_id, null);
});

test("save creates traceable revision metadata and preserves the project id", () => {
  const initial = createProjectBundle(
    { title: "Gedung A", location: "", function: "", owner: "" },
    ids("project-1", "revision-1"),
    () => "2026-09-28T00:00:00.000Z",
  );
  const saved = reviseProject(
    initial,
    { title: "Gedung A", location: "Jakarta", function: "Kantor", owner: "Pemilik" },
    "autosave",
    ids("revision-2"),
    () => "2026-09-28T00:01:00.000Z",
  );

  assert.equal(saved.project.id, initial.project.id);
  assert.equal(saved.project.active_revision_id, "revision-2");
  assert.equal(saved.revision.revision_number, 2);
  assert.equal(saved.revision.source_revision_id, "revision-1");
  assert.equal(saved.revision.save_reason, "autosave");
  assert.equal(saved.geometry.revision_id, "revision-2");
  assert.equal(saved.loads.revision_id, "revision-2");
  assert.equal(saved.seismic.revision_id, "revision-2");
});

test("geometry save creates a revision and rejects invalid geometry", () => {
  const initial = createProjectBundle(
    { title: "Gedung A", location: "", function: "", owner: "" },
    ids("project-1", "revision-1"),
    () => "2026-09-28T00:00:00.000Z",
  );
  const geometry = { ...initial.geometry, grid_x: initial.geometry.grid_x.map((line, index) => index === 1 ? { ...line, ordinate: 7.5 } : line) };
  const saved = reviseGeometry(initial, geometry, "manual", ids("revision-2"), () => "2026-09-28T00:01:00.000Z");

  assert.equal(saved.geometry.grid_x[1].ordinate, 7.5);
  assert.equal(saved.geometry.revision_id, "revision-2");
  assert.equal(saved.revision.source_revision_id, "revision-1");
  assert.throws(() => reviseGeometry(initial, { ...geometry, grid_x: [{ ...geometry.grid_x[0] }] }, "manual"), /minimal memiliki dua garis/);
});

test("load save creates a revision and updates all nested load revision references", () => {
  const initial = createProjectBundle(
    { title: "Gedung A", location: "", function: "", owner: "" },
    ids("project-1", "revision-1"),
    () => "2026-09-28T00:00:00.000Z",
  );
  const loads = {
    ...initial.loads,
    definitions: initial.loads.definitions.map((definition, index) => ({
      ...definition,
      value: index + 1,
      source: "Kriteria desain",
      assumption: "Beban merata",
      seismic_weight_factor: index < 4 ? 1 : 0,
    })),
  };
  const saved = reviseLoads(initial, loads, "manual", ids("revision-2"), () => "2026-09-28T00:01:00.000Z");

  assert.equal(saved.loads.revision_id, "revision-2");
  assert.ok(saved.loads.definitions.every(({ revision_id }) => revision_id === "revision-2"));
  assert.equal(saved.geometry.revision_id, "revision-2");
  assert.equal(saved.materials.revision_id, "revision-2");
  assert.throws(() => reviseLoads(initial, initial.loads, "manual"), /Nilai load/);
});

test("hasil M6 tersimpan pada revisi aktif dan perubahan upstream menginvalidasinya", () => {
  const initial = createProjectBundle(
    { title: "Gedung A", location: "", function: "", owner: "" },
    ids("project-1", "revision-1"),
    () => "2026-09-28T00:00:00.000Z",
  );
  const derived: SeismicResult = { status: "REQUIRES_REGISTRY_DATA", warnings: ["missing"], coefficients: null, spectrum: null, kds_review: null, system_eligibility: [], system_parameters: null, period: null, response_coefficient: null, seismic_weight: null, base_shear: null, story_forces: [], response_spectrum: [] };
  const result = { ...initial.seismic, raw_inputs: { ss: 1, s1: 0.5, site_class: "TEST", risk_category: "TEST" }, derived_results: derived };
  const saved = reviseSeismic(initial, result, "manual", ids("revision-2"), () => "2026-09-28T00:01:00.000Z");
  assert.equal(saved.seismic.revision_id, "revision-2");
  assert.equal(saved.seismic.derived_results?.status, "REQUIRES_REGISTRY_DATA");
  const changedGeometry = { ...saved.geometry, grid_x: saved.geometry.grid_x.map((line, index) => index === 1 ? { ...line, ordinate: 7 } : line) };
  const invalidated = reviseGeometry(saved, changedGeometry, "manual", ids("revision-3"), () => "2026-09-28T00:02:00.000Z");
  assert.equal(invalidated.seismic.derived_results, null);
  assert.equal(invalidated.seismic.raw_inputs.ss, 1);
});
