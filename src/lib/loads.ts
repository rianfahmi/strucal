import type { Geometry } from "./geometry.ts";
import type { CombinationRegistry } from "./load-registry.ts";

export type LoadCategory = "SELF_WEIGHT" | "SUPERIMPOSED_DEAD" | "LIVE" | "ROOF_LIVE" | "WIND" | "RAIN" | "SEISMIC";
export type LoadApplication = "UNIFORM_AREA" | "UNIFORM_LINE";
export type LoadUnit = "kN/m²" | "kN/m";
export type LoadProvenance = "INPUT" | "INHERITED" | "CODE" | "CALCULATED";
export type LoadTargetType = "STORY_AREA" | "GRID_LINE";

export type LoadDefinition = {
  id: string;
  name: string;
  category: LoadCategory;
  value: number | null;
  unit: LoadUnit;
  source: string;
  application: LoadApplication;
  assumption: string;
  revision_id: string;
  provenance: LoadProvenance;
  seismic_weight_factor: number | null;
  seismic_weight_factor_provenance: LoadProvenance;
};

export type LoadAssignment = {
  id: string;
  load_id: string;
  target_type: LoadTargetType;
  target_id: string;
  application: LoadApplication;
  assumption: string;
  revision_id: string;
  provenance: LoadProvenance;
};

export type Loads = {
  revision_id: string;
  combination_registry_version: string;
  combination_rule_ids: string[];
  definitions: LoadDefinition[];
  assignments: LoadAssignment[];
};

export type LoadTarget = {
  id: string;
  type: LoadTargetType;
  application: LoadApplication;
  label: string;
  story: string;
  measure: number;
  measure_unit: "m²" | "m";
};

export type LoadIssue = { path: string; message: string };
export type SeismicWeightComponent = {
  assignment_id: string;
  load_id: string;
  load_name: string;
  story: string;
  load_value: number;
  load_unit: LoadUnit;
  target_measure: number;
  target_measure_unit: "m²" | "m";
  factor: number;
  weight: number;
  unit: "kN";
  provenance: "CALCULATED";
};

export type SeismicWeightResult = {
  value: number;
  unit: "kN";
  status: "AVAILABLE" | "INVALID";
  provenance: "CALCULATED";
  formula_id: "LOAD.SW.AGGREGATE.1";
  registry_version: string;
  components: SeismicWeightComponent[];
  by_story: { story: string; value: number; unit: "kN" }[];
  warnings: string[];
};

export const LOAD_CATEGORY_LABELS: Record<LoadCategory, string> = {
  SELF_WEIGHT: "Self Weight",
  SUPERIMPOSED_DEAD: "Superimposed Dead Load",
  LIVE: "Live Load",
  ROOF_LIVE: "Roof Live Load",
  WIND: "Wind",
  RAIN: "Rain",
  SEISMIC: "Seismic-related",
};

const REQUIRED_CATEGORIES: LoadCategory[] = ["SELF_WEIGHT", "SUPERIMPOSED_DEAD", "LIVE", "ROOF_LIVE", "WIND", "RAIN"];
const unitFor = (application: LoadApplication): LoadUnit => application === "UNIFORM_AREA" ? "kN/m²" : "kN/m";

export function loadTargets(geometry: Geometry): LoadTarget[] {
  const widthX = geometry.grid_x.at(-1)!.ordinate - geometry.grid_x[0].ordinate;
  const widthY = geometry.grid_y.at(-1)!.ordinate - geometry.grid_y[0].ordinate;
  return geometry.stories.filter(({ order }) => order > 0).flatMap((story) => [
    {
      id: `story:${story.order}:area`, type: "STORY_AREA" as const, application: "UNIFORM_AREA" as const,
      label: `${story.name} · area lantai`, story: story.name, measure: widthX * widthY, measure_unit: "m²" as const,
    },
    ...geometry.grid_x.map((line) => ({
      id: `story:${story.order}:grid:X:${line.label}`, type: "GRID_LINE" as const, application: "UNIFORM_LINE" as const,
      label: `${story.name} · Grid X ${line.label}`, story: story.name, measure: widthY, measure_unit: "m" as const,
    })),
    ...geometry.grid_y.map((line) => ({
      id: `story:${story.order}:grid:Y:${line.label}`, type: "GRID_LINE" as const, application: "UNIFORM_LINE" as const,
      label: `${story.name} · Grid Y ${line.label}`, story: story.name, measure: widthX, measure_unit: "m" as const,
    })),
  ]);
}

export function createDefaultLoads(revisionId: string, registryVersion: string): Loads {
  const definition = (category: LoadCategory, name: string): LoadDefinition => ({
    id: category.toLowerCase(), name, category, value: null, unit: "kN/m²", source: "", application: "UNIFORM_AREA",
    assumption: "", revision_id: revisionId, provenance: "INPUT", seismic_weight_factor: null, seismic_weight_factor_provenance: "INPUT",
  });
  return {
    revision_id: revisionId,
    combination_registry_version: registryVersion,
    combination_rule_ids: [],
    definitions: REQUIRED_CATEGORIES.map((category) => definition(category, LOAD_CATEGORY_LABELS[category])),
    assignments: [],
  };
}

export function changeLoadApplication(definition: LoadDefinition, application: LoadApplication): LoadDefinition {
  return { ...definition, application, unit: unitFor(application) };
}

export function validateLoads(loads: Loads, geometry: Geometry, registry: CombinationRegistry): LoadIssue[] {
  const issues: LoadIssue[] = [];
  if (loads.combination_registry_version !== registry.registry_version) issues.push({ path: "combination_registry_version", message: "Versi registry kombinasi tidak sama dengan revisi proyek." });
  const registryIds = new Set(registry.rules.map(({ id }) => id));
  loads.combination_rule_ids.forEach((id, index) => {
    if (!registryIds.has(id)) issues.push({ path: `combination_rule_ids.${index}`, message: `Aturan kombinasi ${id} tidak tersedia pada registry aktif.` });
  });
  for (const category of REQUIRED_CATEGORIES) {
    if (!loads.definitions.some((definition) => definition.category === category)) issues.push({ path: "definitions", message: `${LOAD_CATEGORY_LABELS[category]} wajib tersedia.` });
  }
  const definitionIds = new Set<string>();
  const names = new Set<string>();
  loads.definitions.forEach((definition, index) => {
    const path = `definitions.${index}`;
    const normalizedName = definition.name.trim().toLocaleLowerCase("id-ID");
    if (!definition.id || definitionIds.has(definition.id)) issues.push({ path: `${path}.id`, message: "ID load wajib unik." });
    definitionIds.add(definition.id);
    if (!normalizedName || names.has(normalizedName)) issues.push({ path: `${path}.name`, message: "Nama load wajib diisi dan unik." });
    names.add(normalizedName);
    if (definition.value === null || !Number.isFinite(definition.value) || definition.value === 0) issues.push({ path: `${path}.value`, message: "Nilai load harus berupa angka bukan nol." });
    if (definition.unit !== unitFor(definition.application)) issues.push({ path: `${path}.unit`, message: "Unit load tidak sesuai dengan aplikasinya." });
    if (!definition.source.trim()) issues.push({ path: `${path}.source`, message: "Sumber load wajib diisi." });
    if (!definition.assumption.trim()) issues.push({ path: `${path}.assumption`, message: "Asumsi load wajib diisi." });
    if (definition.revision_id !== loads.revision_id) issues.push({ path: `${path}.revision_id`, message: "Revisi load tidak konsisten." });
    if (definition.seismic_weight_factor === null || !Number.isFinite(definition.seismic_weight_factor) || definition.seismic_weight_factor < 0 || definition.seismic_weight_factor > 1) {
      issues.push({ path: `${path}.seismic_weight_factor`, message: "Faktor berat seismik harus berada pada rentang 0–1." });
    }
  });
  const targets = new Map(loadTargets(geometry).map((target) => [target.id, target]));
  const assignmentKeys = new Set<string>();
  loads.assignments.forEach((assignment, index) => {
    const path = `assignments.${index}`;
    const definition = loads.definitions.find(({ id }) => id === assignment.load_id);
    const target = targets.get(assignment.target_id);
    if (!definition) issues.push({ path: `${path}.load_id`, message: "Load assignment merujuk definisi yang tidak tersedia." });
    if (!target || target.type !== assignment.target_type) issues.push({ path: `${path}.target_id`, message: "Target load tidak tersedia pada geometri aktif." });
    if (definition && target && (assignment.application !== definition.application || assignment.application !== target.application)) issues.push({ path: `${path}.application`, message: "Aplikasi load, definisi, dan target tidak kompatibel." });
    const key = `${assignment.load_id}:${assignment.target_id}`;
    if (assignmentKeys.has(key)) issues.push({ path, message: "Load yang sama tidak boleh ditetapkan dua kali pada target yang sama." });
    assignmentKeys.add(key);
    if (!assignment.assumption.trim()) issues.push({ path: `${path}.assumption`, message: "Asumsi assignment wajib diisi." });
    if (assignment.revision_id !== loads.revision_id) issues.push({ path: `${path}.revision_id`, message: "Revisi assignment tidak konsisten." });
  });
  return issues;
}

export function calculateSeismicWeight(loads: Loads, geometry: Geometry, registryVersion: string): SeismicWeightResult {
  const targets = new Map(loadTargets(geometry).map((target) => [target.id, target]));
  const components: SeismicWeightComponent[] = [];
  const warnings: string[] = [];
  for (const assignment of loads.assignments) {
    const definition = loads.definitions.find(({ id }) => id === assignment.load_id);
    const target = targets.get(assignment.target_id);
    if (!definition || !target || definition.value === null || definition.seismic_weight_factor === null) {
      warnings.push(`Assignment ${assignment.id} belum memiliki input lengkap.`);
      continue;
    }
    if (definition.seismic_weight_factor === 0) continue;
    components.push({
      assignment_id: assignment.id, load_id: definition.id, load_name: definition.name, story: target.story,
      load_value: definition.value, load_unit: definition.unit, target_measure: target.measure, target_measure_unit: target.measure_unit,
      factor: definition.seismic_weight_factor, weight: definition.value * target.measure * definition.seismic_weight_factor,
      unit: "kN", provenance: "CALCULATED",
    });
  }
  const byStory = new Map<string, number>();
  components.forEach(({ story, weight }) => byStory.set(story, (byStory.get(story) ?? 0) + weight));
  return {
    value: components.reduce((sum, { weight }) => sum + weight, 0), unit: "kN",
    status: warnings.length ? "INVALID" : "AVAILABLE", provenance: "CALCULATED", formula_id: "LOAD.SW.AGGREGATE.1",
    registry_version: registryVersion, components, by_story: [...byStory].map(([story, value]) => ({ story, value, unit: "kN" })), warnings,
  };
}

export function sameLoads(left: Loads, right: Loads) {
  const withoutRevision = (loads: Loads) => ({
    ...loads, revision_id: "", definitions: loads.definitions.map((item) => ({ ...item, revision_id: "" })), assignments: loads.assignments.map((item) => ({ ...item, revision_id: "" })),
  });
  return JSON.stringify(withoutRevision(left)) === JSON.stringify(withoutRevision(right));
}
