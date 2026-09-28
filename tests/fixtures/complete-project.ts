import assert from "node:assert/strict";
import { calculateSeismicWeight } from "../../src/lib/loads.ts";
import { ENGINE_VERSION, createProjectBundle, type ProjectBundle } from "../../src/lib/projects.ts";
import { calculateSeismic, seismicContext } from "../../src/lib/seismic.ts";
import { getSeismicRegistry } from "../../src/lib/seismic-registry.ts";

export function completeProjectBundle(): ProjectBundle {
  const ids = ["project-1", "revision-1"];
  const bundle = createProjectBundle({ title: "Gedung A", location: "Bandung", function: "Kantor", owner: "Pemilik" }, () => ids.shift()!, () => "2026-09-28T00:00:00.000Z");
  bundle.materials.concrete.grade = "fc 30";
  bundle.materials.concrete.fc.value = 30;
  bundle.materials.concrete.density.value = 2400;
  bundle.materials.concrete.cover.value = 40;
  bundle.materials.longitudinal_rebar.grade = "BJTS 420";
  bundle.materials.longitudinal_rebar.fy.value = 420;
  bundle.materials.transverse_rebar.grade = "BJTS 280";
  bundle.materials.transverse_rebar.fys.value = 280;
  bundle.materials.available_diameters = [{ id: "D16", nominal_diameter: { value: 16, unit: "mm", provenance: "INPUT" } }];
  bundle.loads.definitions = bundle.loads.definitions.map((definition, index) => ({ ...definition, value: index + 1, source: "Kriteria desain", assumption: "Beban merata", seismic_weight_factor: index === 0 ? 1 : 0 }));
  bundle.loads.assignments = [{ id: "a1", load_id: "self_weight", target_type: "STORY_AREA", target_id: "story:1:area", application: "UNIFORM_AREA", assumption: "Lantai Story 1", revision_id: bundle.revision.id, provenance: "INPUT" }];
  bundle.seismic.raw_inputs = { site_class: "SD", ss: 0.75, s1: 0.3, tl: 8, fa: 1.2, fv: 2, risk_category: "II" };
  for (const key of Object.keys(bundle.seismic.input_provenance) as (keyof typeof bundle.seismic.input_provenance)[]) bundle.seismic.input_provenance[key] = { source: "PUSKIM", entered_by: "Engineer", status: "INPUT", project_revision: bundle.revision.id };
  bundle.seismic.engineering_options.moment_frame_carries_all_seismic_force = true;
  bundle.seismic.engineering_options.moment_frame_unrestrained_by_rigid_components = true;
  bundle.seismic.selected_structural_system_id = "C.5";
  bundle.seismic.derived_results = calculateSeismic(bundle.seismic, seismicContext(bundle.geometry.stories, calculateSeismicWeight(bundle.loads, bundle.geometry, bundle.revision.registry_version), true, ENGINE_VERSION), getSeismicRegistry(bundle.revision.registry_version));
  assert.equal(bundle.seismic.derived_results.status, "VALID");
  return bundle;
}
