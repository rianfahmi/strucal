import systemsRegistry from "../../registry/seismic/sni-1726-2019.table-12.systems.json" with { type: "json" };
import type { SeismicContext, SeismicDisplayOptions, SeismicEngineeringOptions, SeismicRawInputs, TraceValue } from "./seismic.ts";

export type KdsCheck = {
  rule_id: string; label: string; input_value: number; input_unit: string; result: string;
  formula: string; substitution: string; standard_ref: string; registry_version: string;
  engine_version: string; status: "VALID" | "WARNING"; warning: string | null;
};
export type KdsReview = { risk_category: string; sds: TraceValue; sd1: TraceValue; checks: KdsCheck[]; governing_kds: string; standard_ref: string };
export type SystemEligibility = { id: string; label: string; status: "ALLOWED" | "CONDITIONAL" | "BLOCKED"; reason: string; standard_ref: string };
export type PeriodClassification = { id: "STEEL_MOMENT_FRAME" | "CONCRETE_MOMENT_FRAME" | "STEEL_EBF" | "STEEL_BRBF" | "OTHER"; label: string; reason: string; standard_ref: string };
export type SystemParameters = { R: TraceValue; omega0: TraceValue; Cd: TraceValue; Ct: TraceValue; x: TraceValue; period_classification: PeriodClassification };
export type PeriodResult = { ta: TraceValue; cu: TraceValue; tmax: TraceValue; analytical_period: TraceValue | null; used: TraceValue };
export type ResponseCoefficientResult = { nominal: TraceValue; upper_bound: TraceValue; lower_bounds: TraceValue[]; governing: TraceValue };
export type StoryForce = { story: string; elevation: number; weight: number; cvx: TraceValue; force: TraceValue };
export type StoryDistribution = { k: TraceValue; forces: StoryForce[] };
export type SpectrumPoint = { period: number; acceleration: TraceValue };
export type DesignSpectrum = Record<"sms" | "sm1" | "sds" | "sd1" | "t0" | "ts", TraceValue>;

export type SeismicRuleSet = {
  site_coefficients: (input: SeismicRawInputs, context: SeismicContext) => { fa: TraceValue; fv: TraceValue };
  design_spectrum: (input: SeismicRawInputs, coefficients: { fa: TraceValue; fv: TraceValue }, context: SeismicContext) => DesignSpectrum;
  kds: (input: SeismicRawInputs, spectrum: DesignSpectrum, context: SeismicContext) => KdsReview;
  systems: (context: SeismicContext, kds: string, options: SeismicEngineeringOptions) => SystemEligibility[];
  system_parameters: (systemId: string, options: SeismicEngineeringOptions, context: SeismicContext) => SystemParameters;
  period: (height: number, parameters: SystemParameters, spectrum: DesignSpectrum, context: SeismicContext) => PeriodResult;
  response_coefficient: (input: SeismicRawInputs, spectrum: DesignSpectrum, parameters: SystemParameters, period: PeriodResult, context: SeismicContext) => ResponseCoefficientResult;
  base_shear: (coefficient: TraceValue, weight: TraceValue, context: SeismicContext) => TraceValue;
  story_distribution: (baseShear: TraceValue, stories: SeismicContext["stories"], period: PeriodResult, context: SeismicContext) => StoryDistribution;
  evaluate_spectrum: (period: number, input: SeismicRawInputs, spectrum: DesignSpectrum, context: SeismicContext) => TraceValue;
  response_spectrum: (input: SeismicRawInputs, spectrum: DesignSpectrum, display: SeismicDisplayOptions, context: SeismicContext) => SpectrumPoint[];
};

export type SeismicRegistry = {
  registry_version: string; standard_number: string; standard_year: number;
  status: "APPROVED" | "PENDING_ENGINEER_APPROVAL"; reviewed_by: string | null;
  reviewed_at: string | null; missing_rules: string[]; rules: SeismicRuleSet | null;
};

type Limit = "TB" | "TI" | number | { max_height_m?: number; status?: "TI"; note: string };
type SystemRow = {
  system_id: string; name: string; material_family: string; R: number; Omega0: number; Cd: number;
  limits: Record<"B" | "C" | "D" | "E" | "F", Limit>; notes: string[]; source_page: number;
};

const rows = systemsRegistry.rows as SystemRow[];
const STANDARD = "SNI 1726:2019";
const APPROVAL = "ENGINEER_APPROVED_M6_V1";
const severity = ["A", "B", "C", "D", "E", "F"];

function trace(value: number, unit: string, formulaId: string, formula: string, substitution: string, inputs: Record<string, number | string>, standardRef: string, context: SeismicContext, provenance: TraceValue["provenance"] = "CODE", warning: string | null = null): TraceValue {
  return { value, unit, provenance, formula_id: formulaId, formula, substitution, source_inputs: inputs, standard_ref: standardRef, registry_version: context.registry_version, engine_version: context.engine_version, status: warning ? "WARNING" : "VALID", warning };
}

function inputTrace(key: "fa" | "fv", input: SeismicRawInputs, context: SeismicContext) {
  const value = input[key]!;
  const source = context.input_provenance[key];
  return trace(value, "dimensionless", `INPUT.${key.toUpperCase()}.M6.V1`, "Engineer/PUSKIM input; no lookup or interpolation in V1", `${key}=${value}`, { value, source: source.source, entered_by: source.entered_by, project_revision: source.project_revision }, key === "fa" ? `${STANDARD} Tabel 6; M6 V1 input policy` : `${STANDARD} Tabel 7; M6 V1 input policy`, context, "INPUT");
}

function kdsBySds(value: number, risk: string) {
  if (value < 0.167) return "A";
  if (value < 0.33) return risk === "IV" ? "C" : "B";
  if (value < 0.5) return risk === "IV" ? "D" : "C";
  return "D";
}

function kdsBySd1(value: number, risk: string) {
  if (value < 0.067) return "A";
  if (value < 0.133) return risk === "IV" ? "C" : "B";
  if (value < 0.2) return risk === "IV" ? "D" : "C";
  return "D";
}

function kdsCheck(ruleId: string, label: string, value: number, result: string, formula: string, standardRef: string, context: SeismicContext): KdsCheck {
  return { rule_id: ruleId, label, input_value: value, input_unit: "g", result, formula, substitution: `${label}=${value} g → KDS ${result}`, standard_ref: standardRef, registry_version: context.registry_version, engine_version: context.engine_version, status: "VALID", warning: null };
}

function specialHeightSystem(row: SystemRow, options: SeismicEngineeringOptions) {
  const name = row.name.toLocaleLowerCase("id-ID");
  return name.includes("rangka baja dengan bresing eksentris")
    || name.includes("rangka baja dengan bresing konsentris khusus")
    || name.includes("rangka baja dengan bresing terkekang terhadap tekuk")
    || name.includes("dinding geser pelat baja khusus")
    || (name.includes("dinding geser beton bertulang khusus") && options.special_height.reinforced_concrete_wall_cast_in_place);
}

function systemEligibility(row: SystemRow, context: SeismicContext, kds: string, options: SeismicEngineeringOptions): SystemEligibility {
  const label = `${row.system_id} · ${row.name}`;
  if (kds === "A") return { id: row.system_id, label, status: "CONDITIONAL", reason: "KDS A berada di luar kolom B–F Tabel 12; verifikasi 6.6 diperlukan.", standard_ref: `${STANDARD} 6.6 dan Tabel 12` };
  const limit = row.limits[kds as keyof typeof row.limits];
  const ref = `${STANDARD} Tabel 12 baris ${row.system_id}, hlm. ${row.source_page}`;
  if (limit === "TB") return { id: row.system_id, label, status: "ALLOWED", reason: `TB — tidak dibatasi pada KDS ${kds}.`, standard_ref: ref };
  if (limit === "TI") return { id: row.system_id, label, status: "BLOCKED", reason: `TI — tidak diizinkan pada KDS ${kds}.`, standard_ref: ref };
  const note = typeof limit === "object" ? limit.note : null;
  const max = typeof limit === "number" ? limit : limit.max_height_m;
  if (max !== undefined && context.building_height <= max && !["k", "l", "n"].includes(note ?? "")) return { id: row.system_id, label, status: "ALLOWED", reason: `hn=${context.building_height} m ≤ ${max} m pada KDS ${kds}.`, standard_ref: ref };
  if (max !== undefined && context.building_height <= max) return { id: row.system_id, label, status: "CONDITIONAL", reason: `Memenuhi ${max} m; kondisi catatan ${note} wajib diverifikasi.`, standard_ref: `${ref}; catatan ${note}` };
  if (note === "i" && context.building_height <= 13.7) return { id: row.system_id, label, status: "CONDITIONAL", reason: "Batas 13,7 m hanya untuk gudang satu tingkat menurut catatan i.", standard_ref: `${ref}; catatan i` };
  if (["D", "E", "F"].includes(kds) && specialHeightSystem(row, options)) {
    const approvedMax = kds === "F" ? 50 : 75;
    if (context.building_height <= approvedMax) {
      const conditionsMet = options.special_height.enabled && options.special_height.no_excessive_torsional_irregularity_type_1b && options.special_height.max_plane_share_percent !== null && options.special_height.max_plane_share_percent <= 60;
      return {
        id: row.system_id, label, status: conditionsMet ? "ALLOWED" : "CONDITIONAL",
        reason: conditionsMet ? `Kenaikan 7.2.5.4: hn=${context.building_height} m ≤ ${approvedMax} m; tanpa Tipe 1b; porsi bidang ${options.special_height.max_plane_share_percent}% ≤60%.` : `Berpotensi sampai ${approvedMax} m; wajib konfirmasi sistem tercakup, tanpa Tipe 1b, dan tiap bidang ≤60%.`,
        standard_ref: `${STANDARD} 7.2.5.4 hlm. 53–54; ${APPROVAL}`,
      };
    }
  }
  if (typeof limit === "object" && limit.status === "TI" && ["j", "k", "l"].includes(note ?? "")) return { id: row.system_id, label, status: "CONDITIONAL", reason: `TI dengan pengecualian catatan ${note}; seluruh kondisi pasal wajib diverifikasi.`, standard_ref: `${ref}; catatan ${note}` };
  return { id: row.system_id, label, status: "BLOCKED", reason: max === undefined ? `Tidak diizinkan pada KDS ${kds}.` : `hn=${context.building_height} m melampaui ${max} m pada KDS ${kds}.`, standard_ref: ref };
}

function classifyPeriod(row: SystemRow, options: SeismicEngineeringOptions) {
  const momentConditions = options.moment_frame_carries_all_seismic_force && options.moment_frame_unrestrained_by_rigid_components;
  const name = row.name.toLocaleLowerCase("id-ID");
  const steelMoment = name.includes("rangka baja") && name.includes("pemikul momen") && !name.includes("komposit");
  const concreteMoment = name.includes("rangka beton bertulang pemikul momen");
  if (momentConditions && steelMoment) return { classification: { id: "STEEL_MOMENT_FRAME", label: "Rangka baja pemikul momen", reason: "Dua syarat rangka momen Tabel 18 terpenuhi.", standard_ref: `${STANDARD} Tabel 18` } satisfies PeriodClassification, Ct: 0.0724, x: 0.8 };
  if (momentConditions && concreteMoment) return { classification: { id: "CONCRETE_MOMENT_FRAME", label: "Rangka beton pemikul momen", reason: "Dua syarat rangka momen Tabel 18 terpenuhi.", standard_ref: `${STANDARD} Tabel 18` } satisfies PeriodClassification, Ct: 0.0466, x: 0.9 };
  if (row.material_family === "BAJA" && name.includes("bresing eksentris")) return { classification: { id: "STEEL_EBF", label: "Rangka baja dengan bresing eksentris", reason: "Klasifikasi langsung tipe sistem.", standard_ref: `${STANDARD} Tabel 18` } satisfies PeriodClassification, Ct: 0.0731, x: 0.75 };
  if (row.material_family === "BAJA" && name.includes("bresing terkekang terhadap tekuk")) return { classification: { id: "STEEL_BRBF", label: "Rangka baja dengan bresing terkekang terhadap tekuk", reason: "Klasifikasi langsung tipe sistem.", standard_ref: `${STANDARD} Tabel 18` } satisfies PeriodClassification, Ct: 0.0731, x: 0.75 };
  return { classification: { id: "OTHER", label: "Semua sistem struktur lainnya", reason: concreteMoment || steelMoment ? "Syarat rangka momen tidak terpenuhi; fallback diterapkan." : "Tidak termasuk klasifikasi khusus Tabel 18.", standard_ref: `${STANDARD} Tabel 18; ${APPROVAL}` } satisfies PeriodClassification, Ct: 0.0488, x: 0.75 };
}

export function calculateCu(sd1: number) {
  if (sd1 <= 0.1) return 1.7;
  if (sd1 < 0.15) return 1.7 + (sd1 - 0.1) / 0.05 * (1.6 - 1.7);
  if (sd1 === 0.15) return 1.6;
  if (sd1 < 0.2) return 1.6 + (sd1 - 0.15) / 0.05 * (1.5 - 1.6);
  if (sd1 === 0.2) return 1.5;
  if (sd1 < 0.3) return 1.5 + (sd1 - 0.2) / 0.1 * (1.4 - 1.5);
  return 1.4;
}

function spectrumValue(period: number, input: SeismicRawInputs, spectrum: DesignSpectrum) {
  if (period < spectrum.t0.value) return spectrum.sds.value * (0.4 + 0.6 * period / spectrum.t0.value);
  if (period <= spectrum.ts.value) return spectrum.sds.value;
  if (period <= input.tl!) return spectrum.sd1.value / period;
  return spectrum.sd1.value * input.tl! / period ** 2;
}

function createRules(): SeismicRuleSet {
  const evaluateSpectrum: SeismicRuleSet["evaluate_spectrum"] = (period, input, spectrum, context) => {
    const value = spectrumValue(period, input, spectrum);
    const id = period < spectrum.t0.value ? "SNI1726-2019-EQ11" : period <= spectrum.ts.value ? "SNI1726-2019-6.4-PLATEAU" : period <= input.tl! ? "SNI1726-2019-EQ12" : "SNI1726-2019-EQ13";
    return trace(value, "g", id, "Continuous piecewise Sa(T)", `T=${period}→Sa=${value}`, { T: period, SDS: spectrum.sds.value, SD1: spectrum.sd1.value, T0: spectrum.t0.value, Ts: spectrum.ts.value, TL: input.tl! }, `${STANDARD} 6.4 Persamaan (11)–(13), hlm. 35`, context, "AUTO");
  };
  return {
    site_coefficients: (input, context) => ({ fa: inputTrace("fa", input, context), fv: inputTrace("fv", input, context) }),
    design_spectrum: (input, coefficients, context) => {
      const sms = coefficients.fa.value * input.ss!;
      const sm1 = coefficients.fv.value * input.s1!;
      const sds = 2 / 3 * sms;
      const sd1 = 2 / 3 * sm1;
      const t0 = 0.2 * sd1 / sds;
      const ts = sd1 / sds;
      return {
        sms: trace(sms, "g", "SNI1726-2019-EQ7", "SMS=Fa·Ss", `${coefficients.fa.value}×${input.ss}`, { Fa: coefficients.fa.value, Ss: input.ss! }, `${STANDARD} 6.2 Persamaan (7), hlm. 34`, context, "AUTO"),
        sm1: trace(sm1, "g", "SNI1726-2019-EQ8", "SM1=Fv·S1", `${coefficients.fv.value}×${input.s1}`, { Fv: coefficients.fv.value, S1: input.s1! }, `${STANDARD} 6.2 Persamaan (8), hlm. 34`, context, "AUTO"),
        sds: trace(sds, "g", "SNI1726-2019-EQ9", "SDS=(2/3)·SMS", `(2/3)×${sms}`, { SMS: sms }, `${STANDARD} 6.3 Persamaan (9), hlm. 34`, context, "AUTO"),
        sd1: trace(sd1, "g", "SNI1726-2019-EQ10", "SD1=(2/3)·SM1", `(2/3)×${sm1}`, { SM1: sm1 }, `${STANDARD} 6.3 Persamaan (10), hlm. 34`, context, "AUTO"),
        t0: trace(t0, "s", "SNI1726-2019-T0", "T0=0.2·SD1/SDS", `0.2×${sd1}/${sds}`, { SD1: sd1, SDS: sds }, `${STANDARD} 6.4, hlm. 35`, context, "AUTO"),
        ts: trace(ts, "s", "SNI1726-2019-TS", "Ts=SD1/SDS", `${sd1}/${sds}`, { SD1: sd1, SDS: sds }, `${STANDARD} 6.4, hlm. 35`, context, "AUTO"),
      };
    },
    kds: (input, spectrum, context) => {
      const bySds = kdsBySds(spectrum.sds.value, input.risk_category);
      const bySd1 = kdsBySd1(spectrum.sd1.value, input.risk_category);
      const checks = [kdsCheck("SNI1726-2019-T8", "SDS", spectrum.sds.value, bySds, "Tabel 8", `${STANDARD} Tabel 8, hlm. 37`, context), kdsCheck("SNI1726-2019-T9", "SD1", spectrum.sd1.value, bySd1, "Tabel 9", `${STANDARD} Tabel 9, hlm. 37`, context)];
      let governing = severity.indexOf(bySds) >= severity.indexOf(bySd1) ? bySds : bySd1;
      if (input.s1! >= 0.75) {
        governing = input.risk_category === "IV" ? "F" : "E";
        checks.push(kdsCheck("SNI1726-2019-6.5-S1", "S1 override", input.s1!, governing, "S1≥0.75 g", `${STANDARD} 6.5, hlm. 36`, context));
      }
      return { risk_category: input.risk_category, sds: spectrum.sds, sd1: spectrum.sd1, checks, governing_kds: governing, standard_ref: `${STANDARD} 6.5, Tabel 8–9` };
    },
    systems: (context, kds, options) => rows.map((row) => systemEligibility(row, context, kds, options)),
    system_parameters: (systemId, options, context) => {
      const row = rows.find(({ system_id }) => system_id === systemId);
      if (!row) throw new Error(`System ${systemId} tidak tersedia.`);
      const classified = classifyPeriod(row, options);
      const ref = `${STANDARD} Tabel 12 baris ${row.system_id}, hlm. ${row.source_page}`;
      const table12 = (value: number, key: string) => trace(value, "dimensionless", `SNI1726-2019-T12-${row.system_id}-${key}`, `${key}=lookup(system_id)`, `${row.system_id}→${value}`, { system_id: row.system_id }, ref, context);
      return {
        R: table12(row.R, "R"), omega0: table12(row.Omega0, "OMEGA0"), Cd: table12(row.Cd, "CD"),
        Ct: trace(classified.Ct, "s/m^x", `SNI1726-2019-T18-${classified.classification.id}-CT`, "Ct=Table18(classification)", `${classified.classification.id}→${classified.Ct}`, { system_id: row.system_id, classification: classified.classification.id }, classified.classification.standard_ref, context),
        x: trace(classified.x, "dimensionless", `SNI1726-2019-T18-${classified.classification.id}-X`, "x=Table18(classification)", `${classified.classification.id}→${classified.x}`, { system_id: row.system_id, classification: classified.classification.id }, classified.classification.standard_ref, context),
        period_classification: classified.classification,
      };
    },
    period: (height, parameters, spectrum, context) => {
      const taValue = parameters.Ct.value * height ** parameters.x.value;
      const cuValue = calculateCu(spectrum.sd1.value);
      const tmaxValue = cuValue * taValue;
      const ta = trace(taValue, "s", "SNI1726-2019-EQ36", "Ta=Ct·hn^x", `${parameters.Ct.value}×${height}^${parameters.x.value}`, { Ct: parameters.Ct.value, hn: height, x: parameters.x.value }, `${STANDARD} 7.8.2.1 Persamaan (36), hlm. 72`, context, "AUTO");
      const cu = trace(cuValue, "dimensionless", "SNI1726-2019-T17-CU-M6V1", "Cu=linear interpolation(Table 17)", `SD1=${spectrum.sd1.value}→${cuValue}`, { SD1: spectrum.sd1.value }, `${STANDARD} Tabel 17, hlm. 71; ${APPROVAL}`, context);
      const tmax = trace(tmaxValue, "s", "SNI1726-2019-7.8.2-TMAX", "Tmax=Cu·Ta", `${cuValue}×${taValue}`, { Cu: cuValue, Ta: taValue }, `${STANDARD} 7.8.2, hlm. 71`, context, "AUTO");
      const used = trace(taValue, "s", "M6V1-PERIOD-USED", "Tused=Ta when analytical period is unavailable", `${taValue}`, { Ta: taValue, Tmax: tmaxValue }, `M6 V1 ETABS-compatible period policy; ${STANDARD} 7.8.2`, context, "AUTO");
      return { ta, cu, tmax, analytical_period: null, used };
    },
    response_coefficient: (input, spectrum, parameters, period, context) => {
      const ie = input.risk_category === "IV" ? 1.5 : input.risk_category === "III" ? 1.25 : 1;
      const ratio = parameters.R.value / ie;
      const nominalValue = spectrum.sds.value / ratio;
      const upperValue = period.used.value <= input.tl! ? spectrum.sd1.value / (period.used.value * ratio) : spectrum.sd1.value * input.tl! / (period.used.value ** 2 * ratio);
      const lower34Value = Math.max(0.044 * spectrum.sds.value * ie, 0.01);
      const lowers = [trace(lower34Value, "dimensionless", "SNI1726-2019-EQ34", "Cs≥max(0.044·SDS·Ie,0.01)", `max(0.044×${spectrum.sds.value}×${ie},0.01)`, { SDS: spectrum.sds.value, Ie: ie }, `${STANDARD} 7.8.1.1 Persamaan (34), hlm. 70`, context)];
      if (input.s1! >= 0.6) lowers.push(trace(0.5 * input.s1! / ratio, "dimensionless", "SNI1726-2019-EQ35", "Cs≥0.5·S1/(R/Ie)", `0.5×${input.s1}/${ratio}`, { S1: input.s1!, R: parameters.R.value, Ie: ie }, `${STANDARD} 7.8.1.1 Persamaan (35), hlm. 70`, context));
      const lowerValue = Math.max(...lowers.map(({ value }) => value));
      const governingValue = Math.max(lowerValue, Math.min(nominalValue, upperValue));
      const nominal = trace(nominalValue, "dimensionless", "SNI1726-2019-EQ31", "Cs=SDS/(R/Ie)", `${spectrum.sds.value}/(${parameters.R.value}/${ie})`, { SDS: spectrum.sds.value, R: parameters.R.value, Ie: ie }, `${STANDARD} 7.8.1.1 Persamaan (31), hlm. 69`, context, "AUTO");
      const upper = trace(upperValue, "dimensionless", period.used.value <= input.tl! ? "SNI1726-2019-EQ32" : "SNI1726-2019-EQ33", period.used.value <= input.tl! ? "Cs≤SD1/[T(R/Ie)]" : "Cs≤SD1·TL/[T²(R/Ie)]", `${upperValue}`, { SD1: spectrum.sd1.value, T: period.used.value, TL: input.tl!, R: parameters.R.value, Ie: ie }, `${STANDARD} 7.8.1.1, hlm. 70`, context, "AUTO");
      const governing = trace(governingValue, "dimensionless", "SNI1726-2019-CS-GOVERNING", "max(lower bounds,min(nominal,upper))", `max(${lowerValue},min(${nominalValue},${upperValue}))`, { nominal: nominalValue, upper: upperValue, lower: lowerValue }, `${STANDARD} 7.8.1.1 Persamaan (31)–(35)`, context, "AUTO");
      return { nominal, upper_bound: upper, lower_bounds: lowers, governing };
    },
    base_shear: (coefficient, weight, context) => trace(coefficient.value * weight.value, "kN", "SNI1726-2019-EQ30", "V=Cs·W", `${coefficient.value}×${weight.value}`, { Cs: coefficient.value, W: weight.value }, `${STANDARD} 7.8.1 Persamaan (30), hlm. 69`, context, "AUTO"),
    story_distribution: (baseShear, stories, period, context) => {
      const T = period.used.value;
      const kValue = T <= 0.5 ? 1 : T >= 2.5 ? 2 : 1 + (T - 0.5) / 2;
      const terms = stories.map(({ weight, elevation }) => weight * elevation ** kValue);
      const denominator = terms.reduce((sum, value) => sum + value, 0);
      const k = trace(kValue, "dimensionless", "SNI1726-2019-7.8.3-K-M6V1", "k=1; linear; k=2 by T", `T=${T}→k=${kValue}`, { T }, `${STANDARD} 7.8.3, hlm. 73; ${APPROVAL}`, context);
      return { k, forces: stories.map((story, index) => {
        const cvxValue = terms[index] / denominator;
        return { ...story, cvx: trace(cvxValue, "dimensionless", "SNI1726-2019-EQ41", "Cvx=wx·hx^k/Σ(wi·hi^k)", `${terms[index]}/${denominator}`, { wx: story.weight, hx: story.elevation, k: kValue, denominator }, `${STANDARD} 7.8.3 Persamaan (41), hlm. 73`, context, "AUTO"), force: trace(cvxValue * baseShear.value, "kN", "SNI1726-2019-EQ40", "Fx=Cvx·V", `${cvxValue}×${baseShear.value}`, { Cvx: cvxValue, V: baseShear.value }, `${STANDARD} 7.8.3 Persamaan (40), hlm. 73`, context, "AUTO") };
      }) };
    },
    evaluate_spectrum: evaluateSpectrum,
    response_spectrum: (input, spectrum, display, context) => {
      const count = Math.floor(display.max_period / display.step);
      const periods = Array.from({ length: count + 1 }, (_, index) => index * display.step);
      periods.push(display.max_period, 0, spectrum.t0.value, spectrum.ts.value);
      if (input.tl! <= display.max_period) periods.push(input.tl!);
      const unique = new Map(periods.filter((value) => value >= 0 && value <= display.max_period).map((value) => [value.toFixed(12), value]));
      return [...unique.values()].sort((a, b) => a - b).map((period) => ({ period, acceleration: evaluateSpectrum(period, input, spectrum, context) }));
    },
  };
}

export function getSeismicRegistry(registryVersion: string): SeismicRegistry {
  return { registry_version: registryVersion, standard_number: "SNI 1726", standard_year: 2019, status: "APPROVED", reviewed_by: APPROVAL, reviewed_at: "2026-09-28", missing_rules: [], rules: createRules() };
}
