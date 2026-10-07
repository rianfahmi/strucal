import type { Geometry } from "./geometry.ts";

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

export function validateLoads(loads: Loads, geometry: Geometry): LoadIssue[] {
  const issues: LoadIssue[] = [];
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
  if (!components.length) warnings.push("Belum ada assignment yang berkontribusi pada berat seismik.");
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

export type OccupancyType = "OFFICE" | "RESIDENTIAL" | "SCHOOL" | "HOSPITAL";

export type OccupancyPreset = {
  key: OccupancyType;
  label: string;
  description: string;
  loads: {
    self_weight: { value: number; source: string; assumption: string; seismic_factor: number };
    superimposed_dead: { value: number; source: string; assumption: string; seismic_factor: number };
    live: { value: number; source: string; assumption: string; seismic_factor: number };
    roof_live: { value: number; source: string; assumption: string; seismic_factor: number };
    wind: { value: number; source: string; assumption: string; seismic_factor: number };
    rain: { value: number; source: string; assumption: string; seismic_factor: number };
  };
};

export const OCCUPANCY_PRESETS: Record<OccupancyType, OccupancyPreset> = {
  OFFICE: {
    key: "OFFICE",
    label: "Gedung Kantor",
    description: "Ruang kantor umum, koridor, dan partisi fleksibel",
    loads: {
      self_weight: {
        value: 2.88,
        source: "SNI 1727:2020 Tabel C3.1-2 hlm. 282 (PDF hlm. 314)",
        assumption: "Pelat beton bertulang tebal 120 mm (24 kN/m³)",
        seismic_factor: 1.0,
      },
      superimposed_dead: {
        value: 1.50,
        source: "SNI 1727:2020 Tabel C3.1-2 hlm. 282 (PDF hlm. 314) & Pasal 4.3.2",
        assumption: "Finishing spesi keramik, plafon, MEP, dan partisi kantor (0,72 kN/m²)",
        seismic_factor: 1.0,
      },
      live: {
        value: 2.40,
        source: "SNI 1727:2020 Tabel 4.3-1 hlm. 26 (PDF hlm. 58)",
        assumption: "Beban hidup ruang kantor (2,40 kN/m² / 50 psf)",
        seismic_factor: 0.0,
      },
      roof_live: {
        value: 0.96,
        source: "SNI 1727:2020 Tabel 4.3-1 hlm. 29 (PDF hlm. 61)",
        assumption: "Atap datar dengan akses pemeliharaan (0,96 kN/m² / 20 psf)",
        seismic_factor: 0.0,
      },
      wind: {
        value: 0.40,
        source: "SNI 1727:2020 Bab 26–31 hlm. 129 (PDF hlm. 161)",
        assumption: "Beban angin desain minimum dinding penahan",
        seismic_factor: 0.0,
      },
      rain: {
        value: 0.20,
        source: "SNI 1727:2020 Bab 8 hlm. 67 (PDF hlm. 99)",
        assumption: "Beban air hujan desain atap datar",
        seismic_factor: 0.0,
      },
    },
  },
  RESIDENTIAL: {
    key: "RESIDENTIAL",
    label: "Hunian / Rumah Tinggal / Apartemen",
    description: "Kamar hunian dan ruang tinggal privat",
    loads: {
      self_weight: {
        value: 2.88,
        source: "SNI 1727:2020 Tabel C3.1-2 hlm. 282 (PDF hlm. 314)",
        assumption: "Pelat beton bertulang tebal 120 mm (24 kN/m³)",
        seismic_factor: 1.0,
      },
      superimposed_dead: {
        value: 1.20,
        source: "SNI 1727:2020 Tabel C3.1-2 hlm. 282 (PDF hlm. 314)",
        assumption: "Finishing spesi keramik dan plafon hunian",
        seismic_factor: 1.0,
      },
      live: {
        value: 1.92,
        source: "SNI 1727:2020 Tabel 4.3-1 hlm. 26 (PDF hlm. 58)",
        assumption: "Beban hidup ruang hunian privat (1,92 kN/m² / 40 psf)",
        seismic_factor: 0.0,
      },
      roof_live: {
        value: 0.96,
        source: "SNI 1727:2020 Tabel 4.3-1 hlm. 29 (PDF hlm. 61)",
        assumption: "Atap datar dengan akses pemeliharaan (0,96 kN/m² / 20 psf)",
        seismic_factor: 0.0,
      },
      wind: {
        value: 0.40,
        source: "SNI 1727:2020 Bab 26–31 hlm. 129 (PDF hlm. 161)",
        assumption: "Beban angin desain minimum",
        seismic_factor: 0.0,
      },
      rain: {
        value: 0.20,
        source: "SNI 1727:2020 Bab 8 hlm. 67 (PDF hlm. 99)",
        assumption: "Beban air hujan desain atap",
        seismic_factor: 0.0,
      },
    },
  },
  SCHOOL: {
    key: "SCHOOL",
    label: "Sekolah / Ruang Kelas",
    description: "Ruang kelas dan fasilitas pendidikan",
    loads: {
      self_weight: {
        value: 2.88,
        source: "SNI 1727:2020 Tabel C3.1-2 hlm. 282 (PDF hlm. 314)",
        assumption: "Pelat beton bertulang tebal 120 mm (24 kN/m³)",
        seismic_factor: 1.0,
      },
      superimposed_dead: {
        value: 1.30,
        source: "SNI 1727:2020 Tabel C3.1-2 hlm. 282 (PDF hlm. 314)",
        assumption: "Finishing spesi keramik, instalasi pendidikan, dan plafon",
        seismic_factor: 1.0,
      },
      live: {
        value: 1.92,
        source: "SNI 1727:2020 Tabel 4.3-1 hlm. 26 (PDF hlm. 58)",
        assumption: "Beban hidup ruang kelas sekolah (1,92 kN/m² / 40 psf)",
        seismic_factor: 0.0,
      },
      roof_live: {
        value: 0.96,
        source: "SNI 1727:2020 Tabel 4.3-1 hlm. 29 (PDF hlm. 61)",
        assumption: "Atap datar dengan akses pemeliharaan (0,96 kN/m² / 20 psf)",
        seismic_factor: 0.0,
      },
      wind: {
        value: 0.40,
        source: "SNI 1727:2020 Bab 26–31 hlm. 129 (PDF hlm. 161)",
        assumption: "Beban angin desain minimum",
        seismic_factor: 0.0,
      },
      rain: {
        value: 0.20,
        source: "SNI 1727:2020 Bab 8 hlm. 67 (PDF hlm. 99)",
        assumption: "Beban air hujan desain atap",
        seismic_factor: 0.0,
      },
    },
  },
  HOSPITAL: {
    key: "HOSPITAL",
    label: "Rumah Sakit / Ruang Pasien",
    description: "Kamar rawat inap dan fasilitas kesehatan",
    loads: {
      self_weight: {
        value: 2.88,
        source: "SNI 1727:2020 Tabel C3.1-2 hlm. 282 (PDF hlm. 314)",
        assumption: "Pelat beton bertulang tebal 120 mm (24 kN/m³)",
        seismic_factor: 1.0,
      },
      superimposed_dead: {
        value: 1.50,
        source: "SNI 1727:2020 Tabel C3.1-2 hlm. 282 (PDF hlm. 314)",
        assumption: "Finishing lantai medis, MEP, dan partisi ruang pasien",
        seismic_factor: 1.0,
      },
      live: {
        value: 1.92,
        source: "SNI 1727:2020 Tabel 4.3-1 hlm. 27 (PDF hlm. 59)",
        assumption: "Beban hidup ruang rawat pasien (1,92 kN/m² / 40 psf)",
        seismic_factor: 0.0,
      },
      roof_live: {
        value: 0.96,
        source: "SNI 1727:2020 Tabel 4.3-1 hlm. 29 (PDF hlm. 61)",
        assumption: "Atap datar dengan akses pemeliharaan (0,96 kN/m² / 20 psf)",
        seismic_factor: 0.0,
      },
      wind: {
        value: 0.40,
        source: "SNI 1727:2020 Bab 26–31 hlm. 129 (PDF hlm. 161)",
        assumption: "Beban angin desain minimum",
        seismic_factor: 0.0,
      },
      rain: {
        value: 0.20,
        source: "SNI 1727:2020 Bab 8 hlm. 67 (PDF hlm. 99)",
        assumption: "Beban air hujan desain atap",
        seismic_factor: 0.0,
      },
    },
  },
};

export function applyOccupancyPreset(loads: Loads, presetKey: OccupancyType): Loads {
  const preset = OCCUPANCY_PRESETS[presetKey];
  if (!preset) return loads;

  const keyMap: Record<LoadCategory, keyof OccupancyPreset["loads"] | undefined> = {
    SELF_WEIGHT: "self_weight",
    SUPERIMPOSED_DEAD: "superimposed_dead",
    LIVE: "live",
    ROOF_LIVE: "roof_live",
    WIND: "wind",
    RAIN: "rain",
    SEISMIC: undefined,
  };

  const updatedDefinitions = loads.definitions.map((def) => {
    const fieldKey = keyMap[def.category];
    if (!fieldKey) return def;
    const config = preset.loads[fieldKey];
    return {
      ...def,
      value: config.value,
      source: config.source,
      assumption: config.assumption,
      seismic_weight_factor: config.seismic_factor,
    };
  });

  return {
    ...loads,
    definitions: updatedDefinitions,
  };
}

export function generateDefaultAssignments(
  loads: Loads,
  geometry: Geometry,
  options?: { includeTypicalFloors?: boolean; includeRoof?: boolean }
): LoadAssignment[] {
  const includeTypical = options?.includeTypicalFloors ?? true;
  const includeRoof = options?.includeRoof ?? true;

  const upperStories = geometry.stories.filter((s) => s.order > 0);
  if (!upperStories.length) return loads.assignments;

  const maxOrder = Math.max(...upperStories.map((s) => s.order));
  const roofStory = upperStories.find((s) => s.order === maxOrder);
  const typicalStories = upperStories.filter((s) => s.order < maxOrder);

  const getDefId = (category: LoadCategory) => loads.definitions.find((d) => d.category === category)?.id;

  const defSelfWeight = getDefId("SELF_WEIGHT");
  const defSidl = getDefId("SUPERIMPOSED_DEAD");
  const defLive = getDefId("LIVE");
  const defRoofLive = getDefId("ROOF_LIVE");
  const defRain = getDefId("RAIN");

  const existingKeys = new Set(loads.assignments.map((a) => `${a.load_id}:${a.target_id}`));
  const nextAssignments: LoadAssignment[] = [...loads.assignments];

  const createId = () => typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `load-assign-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const addIfAbsent = (loadId: string | undefined, story: typeof upperStories[0], assumption: string) => {
    if (!loadId) return;
    const targetId = `story:${story.order}:area`;
    const key = `${loadId}:${targetId}`;
    if (!existingKeys.has(key)) {
      existingKeys.add(key);
      nextAssignments.push({
        id: createId(),
        load_id: loadId,
        target_type: "STORY_AREA",
        target_id: targetId,
        application: "UNIFORM_AREA",
        assumption,
        revision_id: loads.revision_id,
        provenance: "INPUT",
      });
    }
  };

  if (includeTypical) {
    for (const story of typicalStories) {
      addIfAbsent(defSelfWeight, story, `Beban sendiri lantai tipikal ${story.name} (SNI 1727:2020)`);
      addIfAbsent(defSidl, story, `Beban mati tambahan lantai tipikal ${story.name} (SNI 1727:2020)`);
      addIfAbsent(defLive, story, `Beban hidup lantai tipikal ${story.name} (SNI 1727:2020)`);
    }
  }

  if (includeRoof && roofStory) {
    addIfAbsent(defSelfWeight, roofStory, `Beban sendiri atap ${roofStory.name} (SNI 1727:2020)`);
    addIfAbsent(defSidl, roofStory, `Beban mati tambahan atap ${roofStory.name} (SNI 1727:2020)`);
    addIfAbsent(defRoofLive, roofStory, `Beban hidup atap ${roofStory.name} (SNI 1727:2020)`);
    addIfAbsent(defRain, roofStory, `Beban air hujan atap ${roofStory.name} (SNI 1727:2020)`);
  }

  return nextAssignments;
}

export function applyDefaultLoadsWorkflow(
  loads: Loads,
  geometry: Geometry,
  presetKey: OccupancyType = "OFFICE",
  options?: { includeTypicalFloors?: boolean; includeRoof?: boolean }
): Loads {
  const withPresets = applyOccupancyPreset(loads, presetKey);
  const assignments = generateDefaultAssignments(withPresets, geometry, options);
  return {
    ...withPresets,
    assignments,
  };
}

