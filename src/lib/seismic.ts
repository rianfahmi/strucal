import type { Story } from "./geometry.ts";
import type { SeismicWeightResult } from "./loads.ts";
import type { KdsReview, SeismicRegistry, SpectrumPoint, StoryForce, SystemEligibility, SystemParameters } from "./seismic-registry.ts";

export type SeismicRawInputs = { ss: number | null; s1: number | null; site_class: string; risk_category: string };
export type TraceValue = {
  value: number;
  unit: string;
  provenance: "AUTO" | "CODE" | "INHERITED";
  formula_id: string;
  formula: string;
  substitution: string;
  source_inputs: Record<string, number | string>;
  standard_ref: string;
  registry_version: string;
  engine_version: string;
  status: "VALID" | "WARNING";
  warning: string | null;
};
export type SeismicContext = {
  building_height: number;
  concrete_material: boolean;
  seismic_weight: SeismicWeightResult;
  stories: { story: string; elevation: number; weight: number }[];
  engine_version: string;
};
export type SeismicResult = {
  status: "REQUIRES_INPUT" | "REQUIRES_REGISTRY_DATA" | "REQUIRES_SYSTEM_SELECTION" | "INVALID_SYSTEM" | "VALID";
  warnings: string[];
  coefficients: { fa: TraceValue; fv: TraceValue } | null;
  spectrum: Record<"sms" | "sm1" | "sds" | "sd1", TraceValue> | null;
  kds_review: KdsReview | null;
  system_eligibility: SystemEligibility[];
  system_parameters: SystemParameters | null;
  period: { ta: TraceValue; limit: TraceValue | null } | null;
  response_coefficient: TraceValue | null;
  seismic_weight: TraceValue | null;
  base_shear: TraceValue | null;
  story_forces: StoryForce[];
  response_spectrum: SpectrumPoint[];
};
export type SeismicModel = {
  revision_id: string;
  registry_version: string;
  raw_inputs: SeismicRawInputs;
  selected_structural_system_id: string | null;
  derived_results: SeismicResult | null;
};
export type SeismicIssue = { path: string; message: string };

export function createDefaultSeismic(revisionId: string, registryVersion: string): SeismicModel {
  return {
    revision_id: revisionId,
    registry_version: registryVersion,
    raw_inputs: { ss: null, s1: null, site_class: "", risk_category: "" },
    selected_structural_system_id: null,
    derived_results: null,
  };
}

export function seismicContext(stories: Story[], seismicWeight: SeismicWeightResult, concreteMaterial: boolean, engineVersion: string): SeismicContext {
  const weights = new Map(seismicWeight.by_story.map(({ story, value }) => [story, value]));
  const levels = stories.filter(({ order }) => order > 0);
  return {
    building_height: levels.at(-1)?.elevation ?? 0,
    concrete_material: concreteMaterial,
    seismic_weight: seismicWeight,
    stories: levels.map(({ name, elevation }) => ({ story: name, elevation, weight: weights.get(name) ?? 0 })),
    engine_version: engineVersion,
  };
}

export function validateSeismicInput(model: SeismicModel): SeismicIssue[] {
  const issues: SeismicIssue[] = [];
  for (const [key, value] of [["ss", model.raw_inputs.ss], ["s1", model.raw_inputs.s1]] as const) {
    if (value === null || !Number.isFinite(value) || value < 0) issues.push({ path: `raw_inputs.${key}`, message: `${key === "ss" ? "Ss" : "S1"} harus berupa angka nol atau lebih.` });
  }
  if (!model.raw_inputs.site_class.trim()) issues.push({ path: "raw_inputs.site_class", message: "Kelas situs wajib diisi." });
  if (!model.raw_inputs.risk_category.trim()) issues.push({ path: "raw_inputs.risk_category", message: "Kategori risiko wajib diisi." });
  return issues;
}

function inherited(value: number, unit: string, formulaId: string, inputs: Record<string, number | string>, registry: SeismicRegistry, context: SeismicContext): TraceValue {
  return {
    value, unit, provenance: "INHERITED", formula_id: formulaId, formula: "Nilai diwarisi dari modul upstream",
    substitution: `${value} ${unit}`, source_inputs: inputs, standard_ref: "Project dependency graph",
    registry_version: registry.registry_version, engine_version: context.engine_version, status: "VALID", warning: null,
  };
}

function baseResult(status: SeismicResult["status"], warnings: string[]): SeismicResult {
  return {
    status, warnings, coefficients: null, spectrum: null, kds_review: null, system_eligibility: [], system_parameters: null,
    period: null, response_coefficient: null, seismic_weight: null, base_shear: null, story_forces: [], response_spectrum: [],
  };
}

export function calculateSeismic(model: SeismicModel, context: SeismicContext, registry: SeismicRegistry): SeismicResult {
  const inputIssues = validateSeismicInput(model);
  if (inputIssues.length) return baseResult("REQUIRES_INPUT", inputIssues.map(({ message }) => message));
  if (model.registry_version !== registry.registry_version) return baseResult("REQUIRES_REGISTRY_DATA", ["Versi registry seismik tidak sama dengan revisi proyek."]);
  if (registry.status !== "APPROVED" || !registry.rules) return baseResult("REQUIRES_REGISTRY_DATA", registry.missing_rules);

  const coefficients = registry.rules.site_coefficients(model.raw_inputs);
  const spectrum = registry.rules.design_spectrum(model.raw_inputs, coefficients);
  const kdsReview = registry.rules.kds(model.raw_inputs, spectrum);
  const eligibility = registry.rules.systems(context, kdsReview.governing_kds);
  const partial = { ...baseResult("REQUIRES_SYSTEM_SELECTION", []), coefficients, spectrum, kds_review: kdsReview, system_eligibility: eligibility };
  if (!model.selected_structural_system_id) return partial;
  const selected = eligibility.find(({ id }) => id === model.selected_structural_system_id);
  if (!selected || selected.status !== "ALLOWED") return { ...partial, status: "INVALID_SYSTEM", warnings: [selected?.reason ?? "Sistem struktur tidak tersedia pada registry aktif."] };
  if (context.seismic_weight.status !== "AVAILABLE") return { ...partial, status: "REQUIRES_INPUT", warnings: context.seismic_weight.warnings };

  const systemParameters = registry.rules.system_parameters(selected.id);
  const period = registry.rules.period(context.building_height, systemParameters);
  const responseCoefficient = registry.rules.response_coefficient(spectrum, systemParameters, period);
  const seismicWeight = inherited(context.seismic_weight.value, "kN", "LOAD.SW.AGGREGATE.1", { revision_weight: context.seismic_weight.value }, registry, context);
  const baseShear: TraceValue = {
    value: responseCoefficient.value * seismicWeight.value, unit: "kN", provenance: "AUTO", formula_id: "SEISMIC.BASE_SHEAR",
    formula: "V = Cs × W", substitution: `V = ${responseCoefficient.value} × ${seismicWeight.value}`,
    source_inputs: { Cs: responseCoefficient.value, W: seismicWeight.value }, standard_ref: responseCoefficient.standard_ref,
    registry_version: registry.registry_version, engine_version: context.engine_version, status: "VALID", warning: null,
  };
  return {
    ...partial, status: "VALID", system_parameters: systemParameters, period, response_coefficient: responseCoefficient,
    seismic_weight: seismicWeight, base_shear: baseShear,
    story_forces: registry.rules.story_distribution(baseShear, context.stories),
    response_spectrum: registry.rules.response_spectrum(spectrum),
  };
}

export function sameSeismic(left: SeismicModel, right: SeismicModel) {
  const clean = (model: SeismicModel) => ({ ...model, revision_id: "" });
  return JSON.stringify(clean(left)) === JSON.stringify(clean(right));
}
