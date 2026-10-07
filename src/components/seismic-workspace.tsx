"use client";

import { useEffect, useRef, useState } from "react";
import { calculateSeismicWeight } from "../lib/loads";
import { getSeismicRegistry } from "../lib/seismic-registry";
import { calculateFa, calculateFv, calculateSeismic, getCoefficientSourceLabel, seismicContext, validateSeismicInput, type ManualSeismicInputKey, type SeismicModel, type TraceValue } from "../lib/seismic";
import { ENGINE_VERSION } from "../lib/projects";
import { useProjects, type SaveStatus } from "./project-provider";

type Tab = "input" | "spectrum" | "kds" | "systems" | "results" | "chart" | "stories" | "validation";
const tabs: [Tab, string][] = [["input", "Input Dasar"], ["spectrum", "Parameter Spektrum"], ["kds", "Review KDS"], ["systems", "Review Sistem Struktur"], ["results", "Hasil Analisis"], ["chart", "Response Spectrum"], ["stories", "Distribusi Story"], ["validation", "Validation"]];

export function SeismicWorkspace() {
  const { active, createProject, markUnsaved, saveSeismic, saveStatus } = useProjects();
  if (!active) return <section className="panel empty-project"><h2>Belum ada proyek</h2><p>Buat proyek sebelum mengisi analisa gempa.</p><button className="button button-primary" type="button" onClick={() => void createProject()}>Buat Proyek</button></section>;
  const weight = calculateSeismicWeight(active.loads, active.geometry, active.revision.registry_version);
  const context = seismicContext(active.geometry.stories, weight, active.materials.concrete.type === "concrete", ENGINE_VERSION);
  return <SeismicEditor key={active.project.id} initial={active.seismic} context={context} registryVersion={active.revision.registry_version} markUnsaved={markUnsaved} saveSeismic={saveSeismic} saveStatus={saveStatus} />;
}

function SeismicEditor({ initial, context, registryVersion, markUnsaved, saveSeismic, saveStatus }: {
  initial: SeismicModel;
  context: ReturnType<typeof seismicContext>;
  registryVersion: string;
  markUnsaved: () => void;
  saveSeismic: (model: SeismicModel, reason: "manual" | "autosave") => Promise<void>;
  saveStatus: SaveStatus;
}) {
  const [model, setModel] = useState(initial);
  const [tab, setTab] = useState<Tab>("input");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const registry = getSeismicRegistry(registryVersion);
  const result = calculateSeismic(model, context, registry);
  const issues = validateSeismicInput(model);

  const isSf = model.raw_inputs.site_class === "SF";
  const isOverride = Boolean(model.raw_inputs.override_site_coefficients);
  const isAutoFa = !isOverride && !isSf;
  const isAutoFv = !isOverride && !isSf;
  const faCalc = calculateFa(model.raw_inputs.site_class, model.raw_inputs.ss);
  const fvCalc = calculateFv(model.raw_inputs.site_class, model.raw_inputs.s1);
  const faSourceLabel = getCoefficientSourceLabel(model.input_provenance.fa?.source);
  const fvSourceLabel = getCoefficientSourceLabel(model.input_provenance.fv?.source);

  useEffect(() => () => clearTimeout(timer.current), []);

  function apply(next: SeismicModel) {
    const calculated = { ...next, derived_results: calculateSeismic(next, context, registry) };
    setModel(calculated);
    markUnsaved();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveSeismic(calculated, "autosave"), 800);
  }

  function setRaw(key: keyof SeismicModel["raw_inputs"], value: string | number | boolean | null) {
    const nextRaw = { ...model.raw_inputs, [key]: value };
    const nextProv = { ...model.input_provenance };

    if (!nextRaw.override_site_coefficients && nextRaw.site_class !== "SF") {
      if (key === "ss" || key === "site_class") {
        const faRes = calculateFa(nextRaw.site_class, nextRaw.ss);
        if (faRes.value !== null) {
          nextRaw.fa = faRes.value;
          nextProv.fa = { ...nextProv.fa, source: "otomatis SNI", entered_by: "SNI 1726:2019 Tabel 6" };
        }
      }
      if (key === "s1" || key === "site_class") {
        const fvRes = calculateFv(nextRaw.site_class, nextRaw.s1);
        if (fvRes.value !== null) {
          nextRaw.fv = fvRes.value;
          nextProv.fv = { ...nextProv.fv, source: "otomatis SNI", entered_by: "SNI 1726:2019 Tabel 7" };
        }
      }
    } else if (nextRaw.site_class === "SF" && key === "site_class") {
      nextProv.fa = { ...nextProv.fa, source: "manual (spesifik situs SF)" };
      nextProv.fv = { ...nextProv.fv, source: "manual (spesifik situs SF)" };
    }

    apply({ ...model, raw_inputs: nextRaw, input_provenance: nextProv, selected_structural_system_id: null });
  }

  function toggleOverride(enabled: boolean) {
    const nextRaw = { ...model.raw_inputs, override_site_coefficients: enabled };
    const nextProv = { ...model.input_provenance };
    if (!enabled && nextRaw.site_class !== "SF") {
      const faRes = calculateFa(nextRaw.site_class, nextRaw.ss);
      const fvRes = calculateFv(nextRaw.site_class, nextRaw.s1);
      if (faRes.value !== null) {
        nextRaw.fa = faRes.value;
        nextProv.fa = { ...nextProv.fa, source: "otomatis SNI", entered_by: "SNI 1726:2019 Tabel 6" };
      }
      if (fvRes.value !== null) {
        nextRaw.fv = fvRes.value;
        nextProv.fv = { ...nextProv.fv, source: "otomatis SNI", entered_by: "SNI 1726:2019 Tabel 7" };
      }
    } else if (enabled) {
      nextProv.fa = { ...nextProv.fa, source: "manual" };
      nextProv.fv = { ...nextProv.fv, source: "manual" };
    }
    apply({ ...model, raw_inputs: nextRaw, input_provenance: nextProv, selected_structural_system_id: null });
  }

  function setProvenance(key: ManualSeismicInputKey, field: "source" | "entered_by", value: string) {
    apply({ ...model, input_provenance: { ...model.input_provenance, [key]: { ...model.input_provenance[key], [field]: value } } });
  }

  async function saveNow() {
    clearTimeout(timer.current);
    await saveSeismic({ ...model, derived_results: result }, "manual");
  }

  return <section className="panel seismic-editor" aria-label="Workspace analisa gempa">
    <div className="seismic-tabs" role="tablist" aria-label="Analisa gempa">
      {tabs.map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} type="button" onClick={() => setTab(value)}>{label}</button>)}
    </div>

    {tab === "input" && <section aria-labelledby="seismic-input-title">
      <Heading id="seismic-input-title" title="Parameter Seismik &amp; Koefisien Situs" badge={faSourceLabel === fvSourceLabel ? faSourceLabel : `Fa: ${faSourceLabel} · Fv: ${fvSourceLabel}`} />
      <p className="seismic-input-note">
        Koefisien situs Fa dan Fv dihitung otomatis dengan interpolasi linier sesuai SNI 1726:2019 Tabel 6 dan Tabel 7 (hlm. 34). Override manual tersedia pada Pengaturan Lanjutan.
      </p>

      {isSf && <div className="seismic-warning-banner" role="alert">
        <strong>⚠️ PERINGATAN KELAS SITUS SF:</strong>
        <p>Kelas situs SF memerlukan evaluasi spesifik situs (investigasi geoteknik spesifik dan analisis respons spesifik-situs sesuai SNI 1726:2019 Pasal 6.10.1 &amp; Catatan a Tabel 6/7). Nilai Fa dan Fv tidak dapat dihitung otomatis dan wajib diisi manual dari laporan geoteknik.</p>
      </div>}

      {(faCalc.notice || fvCalc.notice) && !isSf && <div className="seismic-notice-banner" role="status">
        {faCalc.notice && <p>ℹ️ {faCalc.notice}</p>}
        {fvCalc.notice && <p>ℹ️ {fvCalc.notice}</p>}
      </div>}

      <div className="seismic-input-grid">
        <SelectInput label="Kelas situs" value={model.raw_inputs.site_class} options={["SA", "SB", "SC", "SD", "SE", "SF"]} issue={issues.find(({ path }) => path === "raw_inputs.site_class")?.message} onChange={(value) => setRaw("site_class", value)} />
        <SelectInput label="Kategori risiko" value={model.raw_inputs.risk_category} options={["I", "II", "III", "IV"]} issue={issues.find(({ path }) => path === "raw_inputs.risk_category")?.message} onChange={(value) => setRaw("risk_category", value)} />
        <NumberInput label="Ss" value={model.raw_inputs.ss} unit="g" issue={issues.find(({ path }) => path === "raw_inputs.ss")?.message} onChange={(value) => setRaw("ss", value)} />
        <NumberInput label="S1" value={model.raw_inputs.s1} unit="g" issue={issues.find(({ path }) => path === "raw_inputs.s1")?.message} onChange={(value) => setRaw("s1", value)} />
        <NumberInput label="TL" value={model.raw_inputs.tl} unit="s" issue={issues.find(({ path }) => path === "raw_inputs.tl")?.message} onChange={(value) => setRaw("tl", value)} />

        {isAutoFa ? (
          <label className="material-field">
            <span>Fa (koefisien situs)</span>
            <div className="number-with-unit">
              <input type="number" readOnly disabled value={model.raw_inputs.fa ?? ""} />
              <span>-</span>
              <small className={`badge ${faSourceLabel === "otomatis SNI" ? "badge-auto" : "badge-input"}`}>{faSourceLabel}</small>
            </div>
            <small className="field-note">{faSourceLabel === "otomatis SNI" ? "Interpolasi Tabel 6 (SNI 1726:2019 hlm. 34)" : faSourceLabel}</small>
          </label>
        ) : (
          <NumberInput label="Fa (koefisien situs)" value={model.raw_inputs.fa} unit="-" issue={issues.find(({ path }) => path === "raw_inputs.fa")?.message} sourceLabel={faSourceLabel} onChange={(value) => setRaw("fa", value)} />
        )}

        {isAutoFv ? (
          <label className="material-field">
            <span>Fv (koefisien situs)</span>
            <div className="number-with-unit">
              <input type="number" readOnly disabled value={model.raw_inputs.fv ?? ""} />
              <span>-</span>
              <small className={`badge ${fvSourceLabel === "otomatis SNI" ? "badge-auto" : "badge-input"}`}>{fvSourceLabel}</small>
            </div>
            <small className="field-note">{fvSourceLabel === "otomatis SNI" ? "Interpolasi Tabel 7 (SNI 1726:2019 hlm. 34)" : fvSourceLabel}</small>
          </label>
        ) : (
          <NumberInput label="Fv (koefisien situs)" value={model.raw_inputs.fv} unit="-" issue={issues.find(({ path }) => path === "raw_inputs.fv")?.message} sourceLabel={fvSourceLabel} onChange={(value) => setRaw("fv", value)} />
        )}
      </div>

      <details className="advanced-settings">
        <summary>Pengaturan Lanjutan &amp; Override Manual</summary>
        <div className="advanced-settings-content">
          <label className="override-checkbox">
            <input
              type="checkbox"
              checked={isOverride}
              onChange={(e) => toggleOverride(e.target.checked)}
            />{" "}
            <strong>Override manual koefisien situs (Fa dan Fv)</strong>
            <p className="seismic-input-note" style={{ margin: "0.25rem 0 0" }}>
              Aktifkan jika Anda ingin memasukkan nilai Fa dan Fv manual dari laporan respons spesifik situs (Pasal 6.10.1) atau PUSKIM.
            </p>
          </label>
          <ProvenanceTable model={model} issues={issues} onChange={setProvenance} />
        </div>
      </details>

      <div className="auto-calculated-list"><strong>AUTO CALCULATED</strong><span>SMS · SM1 · SDS · SD1 · T0 · Ts · KDS · validasi sistem · R/Ω0/Cd · Ct/x · Ta · Cu · Tmax · Cs · V · Fx · response spectrum</span></div>
      <div className="seismic-inherited">
        <article><span>Tinggi bangunan</span><strong>{context.building_height.toFixed(3)} m</strong><small className="badge badge-inherited">INHERITED · Geometry</small></article>
        <article><span>Berat seismik</span><strong>{context.seismic_weight.status === "AVAILABLE" ? `${context.seismic_weight.value.toFixed(3)} kN` : "Belum valid"}</strong><small className="badge badge-inherited">INHERITED · M5</small></article>
      </div>
    </section>}

    {tab === "spectrum" && <section aria-labelledby="seismic-spectrum-title"><Heading id="seismic-spectrum-title" title="Parameter Spektrum" badge="CODE + AUTO" />
      {result.spectrum ? <div className="trace-grid"><TraceCard label={`Fa (${faSourceLabel})`} trace={result.coefficients!.fa} /><TraceCard label={`Fv (${fvSourceLabel})`} trace={result.coefficients!.fv} />{Object.entries(result.spectrum).map(([label, trace]) => <TraceCard key={label} label={label.toUpperCase()} trace={trace} />)}</div> : <RegistryBlock status={result.status} warnings={result.warnings} />}
    </section>}

    {tab === "kds" && <section aria-labelledby="seismic-kds-title"><Heading id="seismic-kds-title" title="Review KDS" badge="AUTO" />
      {result.kds_review ? <><p className="kds-context">Kategori risiko: {result.kds_review.risk_category} · SDS: {result.kds_review.sds.value} {result.kds_review.sds.unit} · SD1: {result.kds_review.sd1.value} {result.kds_review.sd1.unit}</p><div className="table-scroll"><table className="seismic-table"><thead><tr><th>Parameter / aturan</th><th>Input</th><th>Hasil</th><th>Referensi</th></tr></thead><tbody>{result.kds_review.checks.map((check) => <tr key={check.rule_id}><td>{check.label}<small>{check.rule_id}</small></td><td>{check.input_value} {check.input_unit}</td><td>{check.result}<details><summary>Jejak aturan</summary><small>Formula: {check.formula}</small><small>Substitusi: {check.substitution}</small><small>Registry: {check.registry_version}</small><small>Engine: {check.engine_version}</small><small>Status: {check.status}{check.warning ? ` · ${check.warning}` : ""}</small></details></td><td>{check.standard_ref}</td></tr>)}</tbody></table></div><div className="governing-kds"><span>Governing KDS</span><strong>{result.kds_review.governing_kds}</strong><small>{result.kds_review.standard_ref}</small></div></> : <RegistryBlock status={result.status} warnings={result.warnings} />}
    </section>}

    {tab === "systems" && <section aria-labelledby="seismic-system-title"><Heading id="seismic-system-title" title="Review Sistem Struktur" badge="CODE + SELECTED" />
      {result.system_eligibility.length ? <><EngineeringOptions model={model} apply={apply} /><div className="system-list">{result.system_eligibility.map((system) => <article key={system.id} className={`system-${system.status.toLowerCase()}`}><div><strong>{system.label}</strong><span className="badge">{system.status}</span></div><p>{system.reason}</p><small>{system.standard_ref}</small></article>)}</div><label className="seismic-select"><span>Sistem struktur terpilih</span><select value={model.selected_structural_system_id ?? ""} onChange={(event) => apply({ ...model, selected_structural_system_id: event.target.value || null })}><option value="">Pilih sistem valid</option>{result.system_eligibility.map((system) => <option key={system.id} value={system.id} disabled={system.status !== "ALLOWED"}>{system.label} · {system.status}</option>)}</select></label></> : <RegistryBlock status={result.status} warnings={result.warnings} />}
    </section>}

    {tab === "results" && <section aria-labelledby="seismic-results-title"><Heading id="seismic-results-title" title="Hasil Analisis" badge="AUTO" />
      {result.status === "VALID" ? <><div className="period-classification"><strong>{result.system_parameters!.period_classification.label}</strong><span>{result.system_parameters!.period_classification.reason}</span><small>{result.system_parameters!.period_classification.standard_ref}</small></div><div className="trace-grid">{(["R", "omega0", "Cd", "Ct", "x"] as const).map((label) => <TraceCard key={label} label={label === "omega0" ? "Ω0" : label} trace={result.system_parameters![label]} />)}<TraceCard label="Ta" trace={result.period!.ta} /><TraceCard label="Cu" trace={result.period!.cu} /><TraceCard label="Tmax" trace={result.period!.tmax} /><TraceCard label="Periode digunakan" trace={result.period!.used} /><TraceCard label="Cs nominal" trace={result.response_coefficient!.nominal} /><TraceCard label="Cs batas atas" trace={result.response_coefficient!.upper_bound} />{result.response_coefficient!.lower_bounds.map((trace) => <TraceCard key={trace.formula_id} label="Cs batas bawah" trace={trace} />)}<TraceCard label="Cs governing" trace={result.response_coefficient!.governing} /><TraceCard label="W" trace={result.seismic_weight!} /><TraceCard label="V" trace={result.base_shear!} /></div></> : <RegistryBlock status={result.status} warnings={result.warnings.length ? result.warnings : ["Pilih sistem struktur berstatus ALLOWED."]} />}
    </section>}

    {tab === "chart" && <section aria-labelledby="seismic-chart-title"><Heading id="seismic-chart-title" title="Response Spectrum" badge="AUTO" />
      <div className="spectrum-display-options"><NumberInput label="Tmax tampilan" value={model.display_options.max_period} unit="s" onChange={(value) => value !== null && apply({ ...model, display_options: { ...model.display_options, max_period: value } })} /><NumberInput label="Step" value={model.display_options.step} unit="s" onChange={(value) => value !== null && apply({ ...model, display_options: { ...model.display_options, step: value } })} /></div>
      {result.response_spectrum.length ? <><p className="seismic-input-note">Sampling hanya untuk presentasi/export; fungsi Sa(T) kontinu tetap governing. TL={model.raw_inputs.tl} s {model.raw_inputs.tl! > model.display_options.max_period ? "tersimpan di provenance dan berada di luar chart." : "disuntikkan tepat pada chart."}</p><SpectrumChart points={result.response_spectrum} /><div className="table-scroll spectrum-table"><table className="seismic-table"><thead><tr><th>Periode (s)</th><th>Sa (g)</th><th>Formula ID</th></tr></thead><tbody>{result.response_spectrum.map((point) => <tr key={point.period}><td>{point.period}</td><td>{point.acceleration.value}</td><td>{point.acceleration.formula_id}</td></tr>)}</tbody></table></div></> : <RegistryBlock status={result.status} warnings={result.warnings} />}
    </section>}

    {tab === "stories" && <section aria-labelledby="seismic-stories-title"><Heading id="seismic-stories-title" title="Distribusi Story" badge="AUTO" />
      {result.story_forces.length ? <><div className="governing-kds"><span>Eksponen distribusi k</span><strong>{result.story_exponent!.value}</strong><small>{result.story_exponent!.standard_ref}</small></div><div className="table-scroll"><table className="seismic-table"><thead><tr><th>Story</th><th>Elevasi (m)</th><th>W (kN)</th><th>Cvx</th><th>Fx (kN)</th><th>Formula ID</th></tr></thead><tbody>{result.story_forces.map((row) => <tr key={row.story}><td>{row.story}</td><td>{row.elevation}</td><td>{row.weight}</td><td>{row.cvx.value}</td><td>{row.force.value}</td><td>{row.force.formula_id}</td></tr>)}</tbody></table></div></> : <RegistryBlock status={result.status} warnings={result.warnings} />}
    </section>}

    {tab === "validation" && <section aria-labelledby="seismic-validation-title"><Heading id="seismic-validation-title" title="Validation" badge={result.status} />
      <div className={`seismic-validation ${result.status === "VALID" ? "is-valid" : "has-error"}`}><strong>{result.status}</strong><span>Registry: {registry.registry_version} · {registry.status}</span>{result.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>
    </section>}

    <button className="button button-primary save-seismic" type="button" disabled={saveStatus === "saving"} onClick={() => void saveNow()}>Simpan Analisa Gempa</button>
  </section>;
}

function Heading({ id, title, badge }: { id: string; title: string; badge: string }) {
  return <div className="data-section-heading"><div><p className="eyebrow">Analisa Gempa</p><h2 id={id}>{title}</h2></div><span className="badge badge-code">{badge}</span></div>;
}

function NumberInput({ label, value, unit, issue, sourceLabel = "INPUT", onChange }: { label: string; value: number | null; unit: string; issue?: string; sourceLabel?: string; onChange: (value: number | null) => void }) {
  return <label className="material-field"><span>{label}</span><div className="number-with-unit"><input type="number" min="0" step="any" value={value ?? ""} aria-invalid={Boolean(issue)} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} /><span>{unit}</span><small>{sourceLabel}</small></div>{issue && <small className="field-error">{issue}</small>}</label>;
}

function SelectInput({ label, value, options, issue, onChange }: { label: string; value: string; options: string[]; issue?: string; onChange: (value: string) => void }) {
  return <label className="material-field"><span>{label}</span><div className="input-with-source"><select value={value} aria-invalid={Boolean(issue)} onChange={(event) => onChange(event.target.value)}><option value="">Pilih</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><span>INPUT</span></div>{issue && <small className="field-error">{issue}</small>}</label>;
}

function ProvenanceTable({ model, issues, onChange }: { model: SeismicModel; issues: ReturnType<typeof validateSeismicInput>; onChange: (key: ManualSeismicInputKey, field: "source" | "entered_by", value: string) => void }) {
  const labels: Record<ManualSeismicInputKey, string> = { site_class: "Site Class", ss: "Ss", s1: "S1", tl: "TL", fa: "Fa", fv: "Fv" };
  return <div className="table-scroll provenance-table"><table className="seismic-table"><thead><tr><th>Input</th><th>Sumber</th><th>Entered by</th><th>Status</th><th>Project revision</th></tr></thead><tbody>{(Object.keys(labels) as ManualSeismicInputKey[]).map((key) => {
    const provenance = model.input_provenance[key];
    const sourceIssue = issues.find(({ path }) => path === `input_provenance.${key}.source`)?.message;
    const userIssue = issues.find(({ path }) => path === `input_provenance.${key}.entered_by`)?.message;
    return <tr key={key}><td>{labels[key]}</td><td><input value={provenance.source} aria-label={`Sumber ${labels[key]}`} aria-invalid={Boolean(sourceIssue)} onChange={(event) => onChange(key, "source", event.target.value)} />{sourceIssue && <small className="field-error">{sourceIssue}</small>}</td><td><input value={provenance.entered_by} aria-label={`Penginput ${labels[key]}`} aria-invalid={Boolean(userIssue)} onChange={(event) => onChange(key, "entered_by", event.target.value)} />{userIssue && <small className="field-error">{userIssue}</small>}</td><td><span className="badge badge-input">INPUT</span></td><td>{provenance.project_revision}</td></tr>;
  })}</tbody></table></div>;
}

function EngineeringOptions({ model, apply }: { model: SeismicModel; apply: (next: SeismicModel) => void }) {
  const options = model.engineering_options;
  const setOption = (key: "moment_frame_carries_all_seismic_force" | "moment_frame_unrestrained_by_rigid_components", value: boolean) => apply({ ...model, engineering_options: { ...options, [key]: value }, selected_structural_system_id: null });
  const setHeight = (patch: Partial<typeof options.special_height>) => apply({ ...model, engineering_options: { ...options, special_height: { ...options.special_height, ...patch } }, selected_structural_system_id: null });
  return <fieldset className="engineering-options"><legend>Kondisi klasifikasi dan 7.2.5.4</legend><label><input type="checkbox" checked={options.moment_frame_carries_all_seismic_force} onChange={(event) => setOption("moment_frame_carries_all_seismic_force", event.target.checked)} /> Rangka momen memikul 100% gaya seismik</label><label><input type="checkbox" checked={options.moment_frame_unrestrained_by_rigid_components} onChange={(event) => setOption("moment_frame_unrestrained_by_rigid_components", event.target.checked)} /> Tidak dilingkupi/terhubung komponen lebih kaku yang mencegah defleksi</label><label><input type="checkbox" checked={options.special_height.enabled} onChange={(event) => setHeight({ enabled: event.target.checked })} /> Terapkan kenaikan batas tinggi 7.2.5.4</label><label><input type="checkbox" checked={options.special_height.reinforced_concrete_wall_cast_in_place} onChange={(event) => setHeight({ reinforced_concrete_wall_cast_in_place: event.target.checked })} /> Dinding beton bertulang khusus adalah cor di tempat</label><label><input type="checkbox" checked={options.special_height.no_excessive_torsional_irregularity_type_1b} onChange={(event) => setHeight({ no_excessive_torsional_irregularity_type_1b: event.target.checked })} /> Tidak ada ketidakberaturan torsi berlebihan Tipe 1b</label><NumberInput label="Maks. gaya tiap bidang" value={options.special_height.max_plane_share_percent} unit="%" onChange={(value) => setHeight({ max_plane_share_percent: value })} /></fieldset>;
}

function RegistryBlock({ status, warnings }: { status?: string; warnings: string[] }) {
  const title = status === "REQUIRES_INPUT" ? "Input atau berat seismik belum valid" : status === "REQUIRES_SYSTEM_SELECTION" ? "Pilih sistem struktur valid" : status === "INVALID_SYSTEM" ? "Sistem struktur tidak diizinkan" : "Memerlukan data registry yang disetujui engineer";
  return <div className="registry-review" role="status"><strong>{title}</strong>{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>;
}

function TraceCard({ label, trace }: { label: string; trace: TraceValue }) {
  return <details className="trace-card"><summary><span>{label}</span><strong>{trace.value} {trace.unit}</strong><small className={`badge badge-${trace.provenance.toLowerCase()}`}>{trace.provenance}</small></summary><dl><dt>Formula ID</dt><dd>{trace.formula_id}</dd><dt>Formula</dt><dd>{trace.formula}</dd><dt>Substitusi</dt><dd>{trace.substitution}</dd><dt>Source inputs</dt><dd>{JSON.stringify(trace.source_inputs)}</dd><dt>Referensi</dt><dd>{trace.standard_ref}</dd><dt>Registry</dt><dd>{trace.registry_version}</dd><dt>Engine</dt><dd>{trace.engine_version}</dd><dt>Status</dt><dd>{trace.status}{trace.warning ? ` · ${trace.warning}` : ""}</dd></dl></details>;
}

function SpectrumChart({ points }: { points: ReturnType<typeof calculateSeismic>["response_spectrum"] }) {
  const maxX = Math.max(...points.map(({ period }) => period), 1);
  const maxY = Math.max(...points.map(({ acceleration }) => acceleration.value), 1);
  const path = points.map(({ period, acceleration }, index) => `${index ? "L" : "M"} ${40 + period / maxX * 520} ${260 - acceleration.value / maxY * 220}`).join(" ");
  return <svg className="spectrum-chart" viewBox="0 0 600 300" role="img" aria-label="Grafik response spectrum"><path d="M 40 20 V 260 H 570" className="chart-axis" /><path d={path} className="chart-line" /><text x="290" y="290">Periode, T (s)</text><text x="8" y="20">Sa (g)</text></svg>;
}
