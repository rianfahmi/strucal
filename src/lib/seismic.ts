import type { Story } from "./geometry.ts";
import type { SeismicWeightResult } from "./loads.ts";
import type { DesignSpectrum, KdsReview, PeriodResult, ResponseCoefficientResult, SeismicRegistry, SpectrumPoint, StoryForce, SystemEligibility, SystemParameters } from "./seismic-registry.ts";

export type ManualSeismicInputKey = "site_class" | "ss" | "s1" | "tl" | "fa" | "fv";
export type InputProvenance = { source: string; entered_by: string; status: "INPUT"; project_revision: string };
export type SeismicRawInputs = { ss: number | null; s1: number | null; tl: number | null; fa: number | null; fv: number | null; site_class: string; risk_category: string; override_site_coefficients?: boolean };
export type SeismicInputProvenance = Record<ManualSeismicInputKey, InputProvenance>;
export type SeismicEngineeringOptions = {
  moment_frame_carries_all_seismic_force: boolean;
  moment_frame_unrestrained_by_rigid_components: boolean;
  special_height: {
    enabled: boolean;
    reinforced_concrete_wall_cast_in_place: boolean;
    no_excessive_torsional_irregularity_type_1b: boolean;
    max_plane_share_percent: number | null;
  };
};
export type SeismicDisplayOptions = { max_period: number; step: number };
export type TraceValue = {
  value: number; unit: string; provenance: "INPUT" | "AUTO" | "CODE" | "INHERITED";
  formula_id: string; formula: string; substitution: string; source_inputs: Record<string, number | string>;
  standard_ref: string; registry_version: string; engine_version: string;
  status: "VALID" | "WARNING"; warning: string | null;
};
export type SeismicContext = {
  building_height: number;
  concrete_material: boolean;
  seismic_weight: SeismicWeightResult;
  stories: { story: string; elevation: number; weight: number }[];
  engine_version: string;
  registry_version: string;
  input_provenance: SeismicInputProvenance;
};
export type SeismicResult = {
  status: "REQUIRES_INPUT" | "REQUIRES_REGISTRY_DATA" | "REQUIRES_SYSTEM_SELECTION" | "INVALID_SYSTEM" | "VALID";
  warnings: string[];
  coefficients: { fa: TraceValue; fv: TraceValue } | null;
  spectrum: DesignSpectrum | null;
  kds_review: KdsReview | null;
  system_eligibility: SystemEligibility[];
  system_parameters: SystemParameters | null;
  period: PeriodResult | null;
  response_coefficient: ResponseCoefficientResult | null;
  seismic_weight: TraceValue | null;
  base_shear: TraceValue | null;
  story_exponent: TraceValue | null;
  story_forces: StoryForce[];
  response_spectrum: SpectrumPoint[];
};
export type SeismicModel = {
  revision_id: string;
  registry_version: string;
  raw_inputs: SeismicRawInputs;
  input_provenance: SeismicInputProvenance;
  engineering_options: SeismicEngineeringOptions;
  display_options: SeismicDisplayOptions;
  selected_structural_system_id: string | null;
  derived_results: SeismicResult | null;
};
export type SeismicIssue = { path: string; message: string };

const inputKeys: ManualSeismicInputKey[] = ["site_class", "ss", "s1", "tl", "fa", "fv"];
const numericKeys = ["ss", "s1", "tl", "fa", "fv"] as const;

function defaultProvenance(revisionId: string): SeismicInputProvenance {
  return Object.fromEntries(inputKeys.map((key) => [key, { source: "", entered_by: "", status: "INPUT", project_revision: revisionId }])) as SeismicInputProvenance;
}

function defaultEngineeringOptions(): SeismicEngineeringOptions {
  return {
    moment_frame_carries_all_seismic_force: false,
    moment_frame_unrestrained_by_rigid_components: false,
    special_height: { enabled: false, reinforced_concrete_wall_cast_in_place: false, no_excessive_torsional_irregularity_type_1b: false, max_plane_share_percent: null },
  };
}

export const SITE_COEFFICIENT_REFERENCE = "SNI 1726:2019 hlm. 34 (PDF hlm. 42)";

export type SiteClass = "SA" | "SB" | "SC" | "SD" | "SE" | "SF";

export const TABLE_6_FA = {
  reference: "SNI 1726:2019 hlm. 34 (PDF hlm. 42) Tabel 6",
  ss_keys: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5] as const,
  table: {
    SA: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
    SB: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
    SC: [1.3, 1.3, 1.2, 1.2, 1.2, 1.2],
    SD: [1.6, 1.4, 1.2, 1.1, 1.0, 1.0],
    SE: [2.4, 1.7, 1.3, 1.1, 0.9, 0.8],
    SF: [null, null, null, null, null, null],
  } satisfies Record<SiteClass, (number | null)[]>,
  footnotes: {
    SF: "Situs yang memerlukan investigasi geoteknik spesifik dan analisis respons situs-spesifik, lihat 6.10.1",
  },
} as const;

export const TABLE_7_FV = {
  reference: "SNI 1726:2019 hlm. 34 (PDF hlm. 42) Tabel 7",
  s1_keys: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6] as const,
  table: {
    SA: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
    SB: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
    SC: [1.5, 1.5, 1.5, 1.5, 1.5, 1.4],
    SD: [2.4, 2.2, 2.0, 1.9, 1.8, 1.7],
    SE: [4.2, 3.3, 2.8, 2.4, 2.2, 2.0],
    SF: [null, null, null, null, null, null],
  } satisfies Record<SiteClass, (number | null)[]>,
  footnotes: {
    SF: "Situs yang memerlukan investigasi geoteknik spesifik dan analisis respons situs-spesifik, lihat 6.10.1",
  },
} as const;

export const SITE_COEFFICIENTS_DATA = {
  reference: SITE_COEFFICIENT_REFERENCE,
  fa: TABLE_6_FA,
  fv: TABLE_7_FV,
} as const;

export type SiteCoefficientResult = {
  value: number | null;
  status: "AUTOMATIC" | "MANUAL_REQUIRED" | "INVALID";
  isOutOfRange: boolean;
  notice: string | null;
  warning: string | null;
  source: "otomatis SNI" | "manual";
};

export function calculateFa(siteClass: string, ss: number | null): SiteCoefficientResult {
  if (siteClass === "SF") {
    return {
      value: null,
      status: "MANUAL_REQUIRED",
      isOutOfRange: false,
      notice: null,
      warning: "Kelas situs SF memerlukan evaluasi spesifik situs (investigasi geoteknik dan analisis respons situs-spesifik sesuai SNI 1726:2019 Pasal 6.10.1 & Tabel 6 Catatan a). Nilai Fa tidak dihitung otomatis dan wajib diisi manual dari laporan geoteknik.",
      source: "manual",
    };
  }

  const validClasses = ["SA", "SB", "SC", "SD", "SE"] as const;
  if (!validClasses.includes(siteClass as (typeof validClasses)[number])) {
    return {
      value: null,
      status: "INVALID",
      isOutOfRange: false,
      notice: null,
      warning: "Pilih kelas situs yang valid (SA–SF).",
      source: "manual",
    };
  }

  if (ss === null || !Number.isFinite(ss) || ss < 0) {
    return {
      value: null,
      status: "INVALID",
      isOutOfRange: false,
      notice: null,
      warning: "Nilai Ss harus berupa angka nol atau lebih.",
      source: "manual",
    };
  }

  const row = TABLE_6_FA.table[siteClass as keyof typeof TABLE_6_FA.table] as readonly number[];
  const keys = TABLE_6_FA.ss_keys;

  if (ss <= keys[0]) {
    const isUnder = ss < keys[0];
    return {
      value: row[0],
      status: "AUTOMATIC",
      isOutOfRange: isUnder,
      notice: isUnder ? `Nilai Ss (${ss} g) berada di bawah batas Tabel 6 (${keys[0]} g); menggunakan nilai batas kolom pertama (${row[0]}).` : null,
      warning: null,
      source: "otomatis SNI",
    };
  }

  const lastIndex = keys.length - 1;
  if (ss >= keys[lastIndex]) {
    const isOver = ss > keys[lastIndex];
    return {
      value: row[lastIndex],
      status: "AUTOMATIC",
      isOutOfRange: isOver,
      notice: isOver ? `Nilai Ss (${ss} g) berada di atas batas Tabel 6 (${keys[lastIndex]} g); menggunakan nilai batas kolom akhir (${row[lastIndex]}).` : null,
      warning: null,
      source: "otomatis SNI",
    };
  }

  for (let i = 0; i < lastIndex; i++) {
    const x0 = keys[i];
    const x1 = keys[i + 1];
    if (ss >= x0 && ss <= x1) {
      const y0 = row[i];
      const y1 = row[i + 1];
      const interpolated = y0 + ((ss - x0) / (x1 - x0)) * (y1 - y0);
      return {
        value: Math.round(interpolated * 10000) / 10000,
        status: "AUTOMATIC",
        isOutOfRange: false,
        notice: null,
        warning: null,
        source: "otomatis SNI",
      };
    }
  }

  return {
    value: null,
    status: "INVALID",
    isOutOfRange: false,
    notice: null,
    warning: "Gagal menginterpolasi nilai Fa.",
    source: "manual",
  };
}

export function calculateFv(siteClass: string, s1: number | null): SiteCoefficientResult {
  if (siteClass === "SF") {
    return {
      value: null,
      status: "MANUAL_REQUIRED",
      isOutOfRange: false,
      notice: null,
      warning: "Kelas situs SF memerlukan evaluasi spesifik situs (investigasi geoteknik dan analisis respons situs-spesifik sesuai SNI 1726:2019 Pasal 6.10.1 & Tabel 7 Catatan a). Nilai Fv tidak dihitung otomatis dan wajib diisi manual dari laporan geoteknik.",
      source: "manual",
    };
  }

  const validClasses = ["SA", "SB", "SC", "SD", "SE"] as const;
  if (!validClasses.includes(siteClass as (typeof validClasses)[number])) {
    return {
      value: null,
      status: "INVALID",
      isOutOfRange: false,
      notice: null,
      warning: "Pilih kelas situs yang valid (SA–SF).",
      source: "manual",
    };
  }

  if (s1 === null || !Number.isFinite(s1) || s1 < 0) {
    return {
      value: null,
      status: "INVALID",
      isOutOfRange: false,
      notice: null,
      warning: "Nilai S1 harus berupa angka nol atau lebih.",
      source: "manual",
    };
  }

  const row = TABLE_7_FV.table[siteClass as keyof typeof TABLE_7_FV.table] as readonly number[];
  const keys = TABLE_7_FV.s1_keys;

  if (s1 <= keys[0]) {
    const isUnder = s1 < keys[0];
    return {
      value: row[0],
      status: "AUTOMATIC",
      isOutOfRange: isUnder,
      notice: isUnder ? `Nilai S1 (${s1} g) berada di bawah batas Tabel 7 (${keys[0]} g); menggunakan nilai batas kolom pertama (${row[0]}).` : null,
      warning: null,
      source: "otomatis SNI",
    };
  }

  const lastIndex = keys.length - 1;
  if (s1 >= keys[lastIndex]) {
    const isOver = s1 > keys[lastIndex];
    return {
      value: row[lastIndex],
      status: "AUTOMATIC",
      isOutOfRange: isOver,
      notice: isOver ? `Nilai S1 (${s1} g) berada di atas batas Tabel 7 (${keys[lastIndex]} g); menggunakan nilai batas kolom akhir (${row[lastIndex]}).` : null,
      warning: null,
      source: "otomatis SNI",
    };
  }

  for (let i = 0; i < lastIndex; i++) {
    const x0 = keys[i];
    const x1 = keys[i + 1];
    if (s1 >= x0 && s1 <= x1) {
      const y0 = row[i];
      const y1 = row[i + 1];
      const interpolated = y0 + ((s1 - x0) / (x1 - x0)) * (y1 - y0);
      return {
        value: Math.round(interpolated * 10000) / 10000,
        status: "AUTOMATIC",
        isOutOfRange: false,
        notice: null,
        warning: null,
        source: "otomatis SNI",
      };
    }
  }

  return {
    value: null,
    status: "INVALID",
    isOutOfRange: false,
    notice: null,
    warning: "Gagal menginterpolasi nilai Fv.",
    source: "manual",
  };
}

export function getCoefficientSourceLabel(provenanceSource?: string): "otomatis SNI" | "manual" | "Input manual (data lama, sumber tidak tercatat)" {
  const source = provenanceSource?.trim();
  if (!source) return "Input manual (data lama, sumber tidak tercatat)";
  return source.toLowerCase() === "otomatis sni" ? "otomatis SNI" : "manual";
}

export function syncSiteCoefficients(model: SeismicModel): SeismicModel {
  if (model.raw_inputs.override_site_coefficients || model.raw_inputs.site_class === "SF") {
    return model;
  }
  const faRes = calculateFa(model.raw_inputs.site_class, model.raw_inputs.ss);
  const fvRes = calculateFv(model.raw_inputs.site_class, model.raw_inputs.s1);
  const nextRaw = { ...model.raw_inputs };
  const nextProv = { ...model.input_provenance };

  if (faRes.value !== null) {
    nextRaw.fa = faRes.value;
    nextProv.fa = {
      ...nextProv.fa,
      source: "otomatis SNI",
      entered_by: "SNI 1726:2019 Tabel 6",
    };
  }

  if (fvRes.value !== null) {
    nextRaw.fv = fvRes.value;
    nextProv.fv = {
      ...nextProv.fv,
      source: "otomatis SNI",
      entered_by: "SNI 1726:2019 Tabel 7",
    };
  }

  return {
    ...model,
    raw_inputs: nextRaw,
    input_provenance: nextProv,
  };
}

export function createDefaultSeismic(revisionId: string, registryVersion: string): SeismicModel {
  return {
    revision_id: revisionId,
    registry_version: registryVersion,
    raw_inputs: { ss: null, s1: null, tl: null, fa: null, fv: null, site_class: "", risk_category: "", override_site_coefficients: false },
    input_provenance: defaultProvenance(revisionId),
    engineering_options: defaultEngineeringOptions(),
    display_options: { max_period: 6, step: 0.01 },
    selected_structural_system_id: null,
    derived_results: null,
  };
}

export function normalizeSeismic(model: SeismicModel, revisionId: string, registryVersion: string): SeismicModel {
  const defaults = createDefaultSeismic(revisionId, registryVersion);
  const raw = model.raw_inputs as Partial<SeismicRawInputs>;
  return {
    ...defaults,
    ...model,
    revision_id: revisionId,
    registry_version: model.registry_version ?? registryVersion,
    raw_inputs: { ...defaults.raw_inputs, ...raw },
    input_provenance: Object.fromEntries(inputKeys.map((key) => [key, { ...defaults.input_provenance[key], ...model.input_provenance?.[key] }])) as SeismicInputProvenance,
    engineering_options: { ...defaults.engineering_options, ...model.engineering_options, special_height: { ...defaults.engineering_options.special_height, ...model.engineering_options?.special_height } },
    display_options: { ...defaults.display_options, ...model.display_options },
  };
}

export function seismicContext(stories: Story[], seismicWeight: SeismicWeightResult, concreteMaterial: boolean, engineVersion: string): SeismicContext {
  const weights = new Map(seismicWeight.by_story.map(({ story, value }) => [story, value]));
  const levels = stories.filter(({ order }) => order > 0);
  const baseElevation = stories[0]?.elevation ?? 0;
  return {
    building_height: (levels.at(-1)?.elevation ?? baseElevation) - baseElevation,
    concrete_material: concreteMaterial,
    seismic_weight: seismicWeight,
    stories: levels.map(({ name, elevation }) => ({ story: name, elevation: elevation - baseElevation, weight: weights.get(name) ?? 0 })),
    engine_version: engineVersion,
    registry_version: seismicWeight.registry_version,
    input_provenance: defaultProvenance(""),
  };
}

export function validateSeismicInput(model: SeismicModel): SeismicIssue[] {
  const issues: SeismicIssue[] = [];
  for (const key of numericKeys) {
    const value = model.raw_inputs[key];
    const minimum = key === "ss" || key === "s1" ? 0 : Number.MIN_VALUE;
    if (value === null || !Number.isFinite(value) || value < minimum) issues.push({ path: `raw_inputs.${key}`, message: `${key.toUpperCase()} harus berupa angka ${minimum === 0 ? "nol atau lebih" : "lebih besar dari nol"}.` });
  }
  if (!(["SA", "SB", "SC", "SD", "SE", "SF"] as string[]).includes(model.raw_inputs.site_class)) issues.push({ path: "raw_inputs.site_class", message: "Kelas situs wajib dipilih." });
  if (!(["I", "II", "III", "IV"] as string[]).includes(model.raw_inputs.risk_category)) issues.push({ path: "raw_inputs.risk_category", message: "Kategori risiko wajib dipilih." });
  for (const key of inputKeys) {
    const provenance = model.input_provenance[key];
    if (!provenance.source.trim()) issues.push({ path: `input_provenance.${key}.source`, message: `Sumber ${key} wajib diisi.` });
    if (!provenance.entered_by.trim()) issues.push({ path: `input_provenance.${key}.entered_by`, message: `Penginput ${key} wajib diisi.` });
  }
  if (!Number.isFinite(model.display_options.max_period) || model.display_options.max_period <= 0) issues.push({ path: "display_options.max_period", message: "Periode maksimum tampilan harus lebih besar dari nol." });
  if (!Number.isFinite(model.display_options.step) || model.display_options.step <= 0) issues.push({ path: "display_options.step", message: "Step spektrum harus lebih besar dari nol." });
  const share = model.engineering_options.special_height.max_plane_share_percent;
  if (share !== null && (!Number.isFinite(share) || share < 0 || share > 100)) issues.push({ path: "engineering_options.special_height.max_plane_share_percent", message: "Porsi gaya bidang harus 0–100%." });
  return issues;
}

function inherited(value: number, unit: string, registry: SeismicRegistry, context: SeismicContext): TraceValue {
  return { value, unit, provenance: "INHERITED", formula_id: "LOAD.SW.AGGREGATE.1", formula: "W diwarisi dari M5", substitution: `${value} ${unit}`, source_inputs: { revision_weight: value }, standard_ref: "SNI 1726:2019 7.7.2; M5 active revision", registry_version: registry.registry_version, engine_version: context.engine_version, status: "VALID", warning: null };
}

function baseResult(status: SeismicResult["status"], warnings: string[]): SeismicResult {
  return { status, warnings, coefficients: null, spectrum: null, kds_review: null, system_eligibility: [], system_parameters: null, period: null, response_coefficient: null, seismic_weight: null, base_shear: null, story_exponent: null, story_forces: [], response_spectrum: [] };
}

function traces(result: SeismicResult) {
  return [
    ...(result.coefficients ? Object.values(result.coefficients) : []),
    ...(result.spectrum ? Object.values(result.spectrum) : []),
    ...(result.system_parameters ? [result.system_parameters.R, result.system_parameters.omega0, result.system_parameters.Cd, result.system_parameters.Ct, result.system_parameters.x] : []),
    ...(result.period ? [result.period.ta, result.period.cu, result.period.tmax, result.period.used, ...(result.period.analytical_period ? [result.period.analytical_period] : [])] : []),
    ...(result.response_coefficient ? [result.response_coefficient.nominal, result.response_coefficient.upper_bound, ...result.response_coefficient.lower_bounds, result.response_coefficient.governing] : []),
    ...(result.seismic_weight ? [result.seismic_weight] : []), ...(result.base_shear ? [result.base_shear] : []), ...(result.story_exponent ? [result.story_exponent] : []),
    ...result.story_forces.flatMap(({ cvx, force }) => [cvx, force]), ...result.response_spectrum.map(({ acceleration }) => acceleration),
  ];
}

export function calculateSeismic(model: SeismicModel, suppliedContext: SeismicContext, registry: SeismicRegistry): SeismicResult {
  const inputIssues = validateSeismicInput(model);
  if (inputIssues.length) return baseResult("REQUIRES_INPUT", inputIssues.map(({ message }) => message));
  if (model.registry_version !== registry.registry_version) return baseResult("REQUIRES_REGISTRY_DATA", ["Versi registry seismik tidak sama dengan revisi proyek."]);
  if (registry.status !== "APPROVED" || !registry.rules) return baseResult("REQUIRES_REGISTRY_DATA", registry.missing_rules);
  const context = { ...suppliedContext, registry_version: registry.registry_version, input_provenance: model.input_provenance };
  const coefficients = registry.rules.site_coefficients(model.raw_inputs, context);
  const spectrum = registry.rules.design_spectrum(model.raw_inputs, coefficients, context);
  const kdsReview = registry.rules.kds(model.raw_inputs, spectrum, context);
  const eligibility = registry.rules.systems(context, kdsReview.governing_kds, model.engineering_options);
  const responseSpectrum = registry.rules.response_spectrum(model.raw_inputs, spectrum, model.display_options, context);
  const partial = { ...baseResult("REQUIRES_SYSTEM_SELECTION", []), coefficients, spectrum, kds_review: kdsReview, system_eligibility: eligibility, response_spectrum: responseSpectrum };
  if (!model.selected_structural_system_id) return partial;
  const selected = eligibility.find(({ id }) => id === model.selected_structural_system_id);
  if (!selected || selected.status !== "ALLOWED") return { ...partial, status: "INVALID_SYSTEM", warnings: [selected?.reason ?? "Sistem struktur tidak tersedia pada registry aktif."] };
  if (context.seismic_weight.status !== "AVAILABLE") return { ...partial, status: "REQUIRES_INPUT", warnings: context.seismic_weight.warnings };
  const systemParameters = registry.rules.system_parameters(selected.id, model.engineering_options, context);
  const period = registry.rules.period(context.building_height, systemParameters, spectrum, context);
  const responseCoefficient = registry.rules.response_coefficient(model.raw_inputs, spectrum, systemParameters, period, context);
  const seismicWeight = inherited(context.seismic_weight.value, "kN", registry, context);
  const baseShear = registry.rules.base_shear(responseCoefficient.governing, seismicWeight, context);
  const distribution = registry.rules.story_distribution(baseShear, context.stories, period, context);
  const result: SeismicResult = { ...partial, status: "VALID", system_parameters: systemParameters, period, response_coefficient: responseCoefficient, seismic_weight: seismicWeight, base_shear: baseShear, story_exponent: distribution.k, story_forces: distribution.forces };
  const sumCvx = distribution.forces.reduce((sum, item) => sum + item.cvx.value, 0);
  const sumFx = distribution.forces.reduce((sum, item) => sum + item.force.value, 0);
  if (!Number.isFinite(sumCvx) || Math.abs(sumCvx - 1) > 1e-9 || Math.abs(sumFx - baseShear.value) > Math.max(1e-9, Math.abs(baseShear.value) * 1e-9)) return baseResult("REQUIRES_REGISTRY_DATA", ["Keseimbangan distribusi vertikal tidak valid."]);
  if (traces(result).some(({ value, unit, formula_id, standard_ref, registry_version, engine_version }) => !Number.isFinite(value) || !unit || !formula_id || !standard_ref || registry_version !== registry.registry_version || engine_version !== context.engine_version)) return baseResult("REQUIRES_REGISTRY_DATA", ["Registry menghasilkan nilai atau provenance yang tidak valid."]);
  return result;
}

export function evaluateResponseSpectrum(period: number, model: SeismicModel, context: SeismicContext, registry: SeismicRegistry) {
  if (!registry.rules || registry.status !== "APPROVED") throw new Error("Registry seismik belum disetujui.");
  const result = calculateSeismic({ ...model, selected_structural_system_id: null }, context, registry);
  if (!result.spectrum) throw new Error(result.warnings[0] ?? "Input spektrum belum valid.");
  return registry.rules.evaluate_spectrum(period, model.raw_inputs, result.spectrum, { ...context, registry_version: registry.registry_version, input_provenance: model.input_provenance });
}

export function sameSeismic(left: SeismicModel, right: SeismicModel) {
  const clean = (model: SeismicModel) => ({
    ...model,
    revision_id: "",
    raw_inputs: {
      ...model.raw_inputs,
      override_site_coefficients: Boolean(model.raw_inputs.override_site_coefficients),
    },
    input_provenance: Object.fromEntries(inputKeys.map((key) => [key, { ...model.input_provenance[key], project_revision: "" }])),
  });
  return JSON.stringify(clean(left)) === JSON.stringify(clean(right));
}
