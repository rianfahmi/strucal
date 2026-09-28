"use client";

import { useEffect, useRef, useState } from "react";
import { calculateSeismicWeight } from "../lib/loads";
import { getSeismicRegistry } from "../lib/seismic-registry";
import { calculateSeismic, seismicContext, validateSeismicInput, type SeismicModel, type TraceValue } from "../lib/seismic";
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

  useEffect(() => () => clearTimeout(timer.current), []);

  function apply(next: SeismicModel) {
    const calculated = { ...next, derived_results: calculateSeismic(next, context, registry) };
    setModel(calculated);
    markUnsaved();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveSeismic(calculated, "autosave"), 800);
  }

  function setRaw(key: keyof SeismicModel["raw_inputs"], value: string | number | null) {
    apply({ ...model, raw_inputs: { ...model.raw_inputs, [key]: value }, selected_structural_system_id: null });
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
      <Heading id="seismic-input-title" title="Input Dasar" badge="INPUT" />
      <div className="seismic-input-grid">
        <NumberInput label="Ss" value={model.raw_inputs.ss} unit="g" issue={issues.find(({ path }) => path === "raw_inputs.ss")?.message} onChange={(value) => setRaw("ss", value)} />
        <NumberInput label="S1" value={model.raw_inputs.s1} unit="g" issue={issues.find(({ path }) => path === "raw_inputs.s1")?.message} onChange={(value) => setRaw("s1", value)} />
        <TextInput label="Kelas situs" value={model.raw_inputs.site_class} issue={issues.find(({ path }) => path === "raw_inputs.site_class")?.message} onChange={(value) => setRaw("site_class", value)} />
        <TextInput label="Kategori risiko" value={model.raw_inputs.risk_category} issue={issues.find(({ path }) => path === "raw_inputs.risk_category")?.message} onChange={(value) => setRaw("risk_category", value)} />
      </div>
      <div className="seismic-inherited">
        <article><span>Tinggi bangunan</span><strong>{context.building_height.toFixed(3)} m</strong><small className="badge badge-inherited">INHERITED · Geometry</small></article>
        <article><span>Berat seismik</span><strong>{context.seismic_weight.status === "AVAILABLE" ? `${context.seismic_weight.value.toFixed(3)} kN` : "Belum valid"}</strong><small className="badge badge-inherited">INHERITED · M5</small></article>
      </div>
    </section>}

    {tab === "spectrum" && <section aria-labelledby="seismic-spectrum-title"><Heading id="seismic-spectrum-title" title="Parameter Spektrum" badge="CODE + AUTO" />
      {result.spectrum ? <div className="trace-grid"><TraceCard label="Fa" trace={result.coefficients!.fa} /><TraceCard label="Fv" trace={result.coefficients!.fv} />{Object.entries(result.spectrum).map(([label, trace]) => <TraceCard key={label} label={label.toUpperCase()} trace={trace} />)}</div> : <RegistryBlock status={result.status} warnings={result.warnings} />}
    </section>}

    {tab === "kds" && <section aria-labelledby="seismic-kds-title"><Heading id="seismic-kds-title" title="Review KDS" badge="AUTO" />
      {result.kds_review ? <><p className="kds-context">Kategori risiko: {result.kds_review.risk_category} · SDS: {result.kds_review.sds.value} {result.kds_review.sds.unit} · SD1: {result.kds_review.sd1.value} {result.kds_review.sd1.unit}</p><div className="table-scroll"><table className="seismic-table"><thead><tr><th>Parameter / aturan</th><th>Input</th><th>Hasil</th><th>Referensi</th></tr></thead><tbody>{result.kds_review.checks.map((check) => <tr key={check.rule_id}><td>{check.label}<small>{check.rule_id}</small></td><td>{check.input_value} {check.input_unit}</td><td>{check.result}<details><summary>Jejak aturan</summary><small>Formula: {check.formula}</small><small>Substitusi: {check.substitution}</small><small>Registry: {check.registry_version}</small><small>Engine: {check.engine_version}</small><small>Status: {check.status}{check.warning ? ` · ${check.warning}` : ""}</small></details></td><td>{check.standard_ref}</td></tr>)}</tbody></table></div><div className="governing-kds"><span>Governing KDS</span><strong>{result.kds_review.governing_kds}</strong><small>{result.kds_review.standard_ref}</small></div></> : <RegistryBlock status={result.status} warnings={result.warnings} />}
    </section>}

    {tab === "systems" && <section aria-labelledby="seismic-system-title"><Heading id="seismic-system-title" title="Review Sistem Struktur" badge="CODE + SELECTED" />
      {result.system_eligibility.length ? <><div className="system-list">{result.system_eligibility.map((system) => <article key={system.id} className={`system-${system.status.toLowerCase()}`}><div><strong>{system.label}</strong><span className="badge">{system.status}</span></div><p>{system.reason}</p><small>{system.standard_ref}</small></article>)}</div><label className="seismic-select"><span>Sistem struktur terpilih</span><select value={model.selected_structural_system_id ?? ""} onChange={(event) => apply({ ...model, selected_structural_system_id: event.target.value || null })}><option value="">Pilih sistem valid</option>{result.system_eligibility.map((system) => <option key={system.id} value={system.id} disabled={system.status !== "ALLOWED"}>{system.label} · {system.status}</option>)}</select></label></> : <RegistryBlock status={result.status} warnings={result.warnings} />}
    </section>}

    {tab === "results" && <section aria-labelledby="seismic-results-title"><Heading id="seismic-results-title" title="Hasil Analisis" badge="AUTO" />
      {result.status === "VALID" ? <div className="trace-grid">{Object.entries(result.system_parameters!).map(([label, trace]) => <TraceCard key={label} label={label === "omega0" ? "Ω0" : label} trace={trace} />)}<TraceCard label="Ta" trace={result.period!.ta} />{result.period!.limit && <TraceCard label="Batas periode" trace={result.period!.limit} />}<TraceCard label="Cs" trace={result.response_coefficient!} /><TraceCard label="W" trace={result.seismic_weight!} /><TraceCard label="V" trace={result.base_shear!} /></div> : <RegistryBlock status={result.status} warnings={result.warnings.length ? result.warnings : ["Pilih sistem struktur berstatus ALLOWED."]} />}
    </section>}

    {tab === "chart" && <section aria-labelledby="seismic-chart-title"><Heading id="seismic-chart-title" title="Response Spectrum" badge="AUTO" />
      {result.response_spectrum.length ? <><SpectrumChart points={result.response_spectrum} /><div className="table-scroll"><table className="seismic-table"><thead><tr><th>Periode (s)</th><th>Sa (g)</th><th>Formula ID</th></tr></thead><tbody>{result.response_spectrum.map((point) => <tr key={point.period}><td>{point.period}</td><td>{point.acceleration.value}</td><td>{point.acceleration.formula_id}</td></tr>)}</tbody></table></div></> : <RegistryBlock status={result.status} warnings={result.warnings} />}
    </section>}

    {tab === "stories" && <section aria-labelledby="seismic-stories-title"><Heading id="seismic-stories-title" title="Distribusi Story" badge="AUTO" />
      {result.story_forces.length ? <div className="table-scroll"><table className="seismic-table"><thead><tr><th>Story</th><th>Elevasi (m)</th><th>W (kN)</th><th>Fx (kN)</th><th>Formula ID</th></tr></thead><tbody>{result.story_forces.map((row) => <tr key={row.story}><td>{row.story}</td><td>{row.elevation}</td><td>{row.weight}</td><td>{row.force.value}</td><td>{row.force.formula_id}</td></tr>)}</tbody></table></div> : <RegistryBlock status={result.status} warnings={result.warnings} />}
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

function NumberInput({ label, value, unit, issue, onChange }: { label: string; value: number | null; unit: string; issue?: string; onChange: (value: number | null) => void }) {
  return <label className="material-field"><span>{label}</span><div className="number-with-unit"><input type="number" min="0" step="any" value={value ?? ""} aria-invalid={Boolean(issue)} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} /><span>{unit}</span><small>INPUT</small></div>{issue && <small className="field-error">{issue}</small>}</label>;
}

function TextInput({ label, value, issue, onChange }: { label: string; value: string; issue?: string; onChange: (value: string) => void }) {
  return <label className="material-field"><span>{label}</span><div className="input-with-source"><input value={value} aria-invalid={Boolean(issue)} onChange={(event) => onChange(event.target.value)} /><span>INPUT</span></div>{issue && <small className="field-error">{issue}</small>}</label>;
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
