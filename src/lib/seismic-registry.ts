import type { SeismicContext, SeismicRawInputs, TraceValue } from "./seismic.ts";

export type KdsCheck = {
  rule_id: string;
  label: string;
  input_value: number;
  input_unit: string;
  result: string;
  formula: string;
  substitution: string;
  standard_ref: string;
  registry_version: string;
  engine_version: string;
  status: "VALID" | "WARNING";
  warning: string | null;
};
export type KdsReview = { risk_category: string; sds: TraceValue; sd1: TraceValue; checks: KdsCheck[]; governing_kds: string; standard_ref: string };
export type SystemEligibility = {
  id: string;
  label: string;
  status: "ALLOWED" | "CONDITIONAL" | "BLOCKED";
  reason: string;
  standard_ref: string;
};
export type SystemParameters = Record<"R" | "omega0" | "Cd" | "Ct" | "x", TraceValue>;
export type PeriodResult = { ta: TraceValue; limit: TraceValue | null };
export type StoryForce = { story: string; elevation: number; weight: number; force: TraceValue };
export type SpectrumPoint = { period: number; acceleration: TraceValue };

export type SeismicRuleSet = {
  site_coefficients: (input: SeismicRawInputs) => { fa: TraceValue; fv: TraceValue };
  design_spectrum: (input: SeismicRawInputs, coefficients: { fa: TraceValue; fv: TraceValue }) => Record<"sms" | "sm1" | "sds" | "sd1", TraceValue>;
  kds: (input: SeismicRawInputs, spectrum: Record<"sds" | "sd1", TraceValue>) => KdsReview;
  systems: (context: SeismicContext, kds: string) => SystemEligibility[];
  system_parameters: (systemId: string) => SystemParameters;
  period: (height: number, parameters: SystemParameters) => PeriodResult;
  response_coefficient: (spectrum: Record<"sds" | "sd1", TraceValue>, parameters: SystemParameters, period: PeriodResult) => TraceValue;
  base_shear: (responseCoefficient: TraceValue, seismicWeight: TraceValue) => TraceValue;
  story_distribution: (baseShear: TraceValue, stories: SeismicContext["stories"]) => StoryForce[];
  response_spectrum: (spectrum: Record<"sds" | "sd1", TraceValue>) => SpectrumPoint[];
};

export type SeismicRegistry = {
  registry_version: string;
  standard_number: string;
  standard_year: number;
  status: "APPROVED" | "PENDING_ENGINEER_APPROVAL";
  reviewed_by: string | null;
  reviewed_at: string | null;
  missing_rules: string[];
  rules: SeismicRuleSet | null;
};

export type ApprovedSeismicRuleRecord = {
  registry_version: string;
  standard_number: string;
  standard_year: number;
  status: "APPROVED";
  rule_id: string;
  rule_type: "TABLE" | "FORMULA" | "SYSTEM_CONSTRAINT";
  table_or_clause_ref: string;
  conditions: Record<string, string | number>;
  result: string | number;
  unit: string;
  effective_from: string;
  reviewed_by: string;
  reviewed_at: string;
  source_note: string;
};

const REQUIRED_RULES = [
  "Tabel koefisien situs Fa dan Fv beserta aturan interpolasi",
  "Rumus parameter spektrum desain",
  "Seluruh tabel/aturan KDS dan aturan governing",
  "Registry sistem struktur lengkap: syarat, batas tinggi/pemakaian, R, Ω0, Cd, Ct, x",
  "Rumus batas periode, koefisien respons seismik, dan gaya geser dasar",
  "Rumus distribusi vertikal gaya gempa",
  "Rumus response spectrum desain",
];

export function getSeismicRegistry(registryVersion: string): SeismicRegistry {
  return {
    registry_version: registryVersion,
    standard_number: "SNI 1726",
    standard_year: 2019,
    status: "PENDING_ENGINEER_APPROVAL",
    reviewed_by: null,
    reviewed_at: null,
    missing_rules: REQUIRED_RULES,
    rules: null,
  };
}
