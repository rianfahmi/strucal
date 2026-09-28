"use client";

import { useEffect, useRef, useState } from "react";
import { getCombinationRegistry } from "../lib/load-registry";
import {
  LOAD_CATEGORY_LABELS,
  calculateSeismicWeight,
  changeLoadApplication,
  loadTargets,
  validateLoads,
  type LoadApplication,
  type LoadAssignment,
  type LoadCategory,
  type LoadDefinition,
  type Loads,
} from "../lib/loads";
import { useProjects, type SaveStatus } from "./project-provider";

type LoadTab = "definitions" | "assignments" | "gravity" | "weather" | "seismic" | "combinations" | "summary";
const tabs: [LoadTab, string][] = [
  ["definitions", "Load Definitions"], ["assignments", "Load Assignments"], ["gravity", "Gravity Loads"],
  ["weather", "Wind / Rain"], ["seismic", "Seismic Weight"], ["combinations", "Combination Review"], ["summary", "Summary"],
];
const gravityCategories = new Set<LoadCategory>(["SELF_WEIGHT", "SUPERIMPOSED_DEAD", "LIVE", "ROOF_LIVE"]);

export function LoadWorkspace() {
  const { active, createProject, markUnsaved, saveLoads, saveStatus } = useProjects();
  if (!active) return <section className="panel empty-project"><h2>Belum ada proyek</h2><p>Buat proyek sebelum mengisi pembebanan.</p><button className="button button-primary" type="button" onClick={() => void createProject()}>Buat Proyek</button></section>;
  return <LoadEditor key={active.project.id} initial={active.loads} geometry={active.geometry} registryVersion={active.revision.registry_version} markUnsaved={markUnsaved} saveLoads={saveLoads} saveStatus={saveStatus} />;
}

function LoadEditor({ initial, geometry, registryVersion, markUnsaved, saveLoads, saveStatus }: {
  initial: Loads;
  geometry: Parameters<typeof loadTargets>[0];
  registryVersion: string;
  markUnsaved: () => void;
  saveLoads: (loads: Loads, reason: "manual" | "autosave") => Promise<void>;
  saveStatus: SaveStatus;
}) {
  const [loads, setLoads] = useState(initial);
  const [tab, setTab] = useState<LoadTab>("definitions");
  const [assignmentLoadId, setAssignmentLoadId] = useState(initial.definitions[0]?.id ?? "");
  const [assignmentTargetId, setAssignmentTargetId] = useState("");
  const [assignmentAssumption, setAssignmentAssumption] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const registry = getCombinationRegistry(registryVersion);
  const targets = loadTargets(geometry);
  const issues = validateLoads(loads, geometry, registry);
  const seismicWeight = calculateSeismicWeight(loads, geometry, registryVersion);

  useEffect(() => () => clearTimeout(timer.current), []);

  function apply(next: Loads) {
    setLoads(next);
    markUnsaved();
    clearTimeout(timer.current);
    if (!validateLoads(next, geometry, registry).length) timer.current = setTimeout(() => void saveLoads(next, "autosave"), 800);
  }

  function updateDefinition(id: string, update: (definition: LoadDefinition) => LoadDefinition) {
    apply({ ...loads, definitions: loads.definitions.map((definition) => definition.id === id ? update(definition) : definition) });
  }

  function addDefinition() {
    const id = crypto.randomUUID();
    apply({ ...loads, definitions: [...loads.definitions, {
      id, name: "Seismic-related", category: "SEISMIC", value: null, unit: "kN/m²", source: "", application: "UNIFORM_AREA",
      assumption: "", revision_id: loads.revision_id, provenance: "INPUT", seismic_weight_factor: 0, seismic_weight_factor_provenance: "INPUT",
    }] });
    setAssignmentLoadId(id);
  }

  function addAssignment() {
    const definition = loads.definitions.find(({ id }) => id === assignmentLoadId);
    const target = targets.find(({ id }) => id === assignmentTargetId);
    if (!definition || !target) return;
    const assignment: LoadAssignment = {
      id: crypto.randomUUID(), load_id: definition.id, target_type: target.type, target_id: target.id, application: definition.application,
      assumption: assignmentAssumption.trim(), revision_id: loads.revision_id, provenance: "INPUT",
    };
    apply({ ...loads, assignments: [...loads.assignments, assignment] });
    setAssignmentAssumption("");
  }

  async function saveNow() {
    clearTimeout(timer.current);
    if (!issues.length) await saveLoads(loads, "manual");
  }

  const selectedDefinition = loads.definitions.find(({ id }) => id === assignmentLoadId);
  const compatibleTargets = targets.filter(({ application }) => application === selectedDefinition?.application);

  return <section className="panel load-editor" aria-label="Editor pembebanan">
    <div className="load-tabs" role="tablist" aria-label="Data pembebanan">
      {tabs.map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} type="button" onClick={() => setTab(value)}>{label}</button>)}
    </div>

    {tab === "definitions" && <section aria-labelledby="load-definitions-title">
      <LoadHeading id="load-definitions-title" eyebrow="Data proyek" title="Load Definitions" badge="INPUT" />
      <div className="table-scroll"><table className="load-table load-definition-table"><thead><tr><th>Nama / kategori</th><th>Nilai</th><th>Aplikasi</th><th>Faktor W</th><th>Sumber</th><th>Asumsi</th><th>Provenance</th><th><span className="sr-only">Aksi</span></th></tr></thead><tbody>
        {loads.definitions.map((definition, index) => <tr key={definition.id}>
          <td><input aria-label={`Nama load ${index + 1}`} value={definition.name} onChange={(event) => updateDefinition(definition.id, (item) => ({ ...item, name: event.target.value }))} /><select aria-label={`Kategori load ${index + 1}`} value={definition.category} onChange={(event) => updateDefinition(definition.id, (item) => ({ ...item, category: event.target.value as LoadCategory }))}>{Object.entries(LOAD_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
          <td><div className="compact-number"><input aria-label={`Nilai ${definition.name}`} type="number" step="any" value={definition.value ?? ""} onChange={(event) => updateDefinition(definition.id, (item) => ({ ...item, value: event.target.value === "" ? null : Number(event.target.value) }))} /><span>{definition.unit}</span></div></td>
          <td><select aria-label={`Aplikasi ${definition.name}`} value={definition.application} onChange={(event) => updateDefinition(definition.id, (item) => changeLoadApplication(item, event.target.value as LoadApplication))}><option value="UNIFORM_AREA">Area merata</option><option value="UNIFORM_LINE">Garis merata</option></select></td>
          <td><div className="compact-number"><input aria-label={`Faktor berat seismik ${definition.name}`} type="number" min="0" max="1" step="any" value={definition.seismic_weight_factor ?? ""} onChange={(event) => updateDefinition(definition.id, (item) => ({ ...item, seismic_weight_factor: event.target.value === "" ? null : Number(event.target.value) }))} /><span>×</span></div></td>
          <td><input aria-label={`Sumber ${definition.name}`} value={definition.source} onChange={(event) => updateDefinition(definition.id, (item) => ({ ...item, source: event.target.value }))} /></td>
          <td><input aria-label={`Asumsi ${definition.name}`} value={definition.assumption} onChange={(event) => updateDefinition(definition.id, (item) => ({ ...item, assumption: event.target.value }))} /></td>
          <td><span className="badge badge-input">{definition.provenance}</span></td>
          <td>{definition.category === "SEISMIC" && <button className="icon-button" type="button" aria-label={`Hapus ${definition.name}`} onClick={() => apply({ ...loads, definitions: loads.definitions.filter(({ id }) => id !== definition.id), assignments: loads.assignments.filter(({ load_id }) => load_id !== definition.id) })}>×</button>}</td>
        </tr>)}
      </tbody></table></div>
      <button className="button button-secondary add-row" type="button" onClick={addDefinition}>+ Tambah Load</button>
    </section>}

    {tab === "assignments" && <section aria-labelledby="load-assignments-title">
      <LoadHeading id="load-assignments-title" eyebrow="Target geometri aktif" title="Load Assignments" badge="INPUT" />
      <div className="assignment-form">
        <label><span>Load definition</span><select value={assignmentLoadId} onChange={(event) => { setAssignmentLoadId(event.target.value); setAssignmentTargetId(""); }}>{loads.definitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.name} · {definition.unit}</option>)}</select></label>
        <label><span>Target / application</span><select value={assignmentTargetId} onChange={(event) => setAssignmentTargetId(event.target.value)}><option value="">Pilih target aktual</option>{compatibleTargets.map((target) => <option key={target.id} value={target.id}>{target.label} · {target.measure} {target.measure_unit}</option>)}</select></label>
        <label><span>Asumsi assignment</span><input value={assignmentAssumption} onChange={(event) => setAssignmentAssumption(event.target.value)} /></label>
        <button className="button button-secondary" type="button" disabled={!assignmentTargetId || !assignmentAssumption.trim()} onClick={addAssignment}>Tambah Assignment</button>
      </div>
      <AssignmentTable assignments={loads.assignments} definitions={loads.definitions} targets={targets} onDelete={(id) => apply({ ...loads, assignments: loads.assignments.filter((assignment) => assignment.id !== id) })} />
    </section>}

    {tab === "gravity" && <LoadReview title="Gravity Loads" definitions={loads.definitions.filter(({ category }) => gravityCategories.has(category))} assignments={loads.assignments} />}
    {tab === "weather" && <LoadReview title="Wind / Rain" definitions={loads.definitions.filter(({ category }) => category === "WIND" || category === "RAIN")} assignments={loads.assignments} />}

    {tab === "seismic" && <section aria-labelledby="seismic-weight-title">
      <LoadHeading id="seismic-weight-title" eyebrow="Calculated from approved project loads" title="Seismic Weight" badge="CALCULATED" />
      <div className="load-kpis"><article><span>Total berat seismik</span><strong>{seismicWeight.value.toLocaleString("id-ID", { maximumFractionDigits: 3 })} kN</strong><small>{seismicWeight.formula_id}</small></article><article><span>Komponen</span><strong>{seismicWeight.components.length}</strong><small>Tidak ada input ulang nilai W</small></article><article><span>Status</span><strong>{seismicWeight.status === "AVAILABLE" ? "Tersedia" : "Perlu input"}</strong><small>{seismicWeight.warnings[0] ?? "Agregasi load tervalidasi"}</small></article></div>
      <div className="table-scroll"><table className="load-table"><thead><tr><th>Story</th><th>Load</th><th>Nilai</th><th>Target</th><th>Faktor</th><th>Kontribusi (kN)</th><th>Sumber</th></tr></thead><tbody>{seismicWeight.components.map((component) => <tr key={component.assignment_id}><td>{component.story}</td><td>{component.load_name}</td><td>{component.load_value} {component.load_unit}</td><td>{component.target_measure} {component.target_measure_unit}</td><td>{component.factor}</td><td>{component.weight.toLocaleString("id-ID", { maximumFractionDigits: 3 })}</td><td><span className="badge badge-calculated">CALCULATED</span></td></tr>)}</tbody></table></div>
    </section>}

    {tab === "combinations" && <section aria-labelledby="combination-title">
      <LoadHeading id="combination-title" eyebrow={`Registry ${registry.registry_version}`} title="Combination Review" badge="CODE" />
      {registry.status === "PENDING_ENGINEER_APPROVAL" ? <div className="registry-review" role="status"><strong>PERLU REVIEW</strong><p>{registry.note}</p><small>Kombinasi tidak di-hardcode di UI dan tidak akan diterbitkan sebelum registry disetujui.</small></div> : <div className="table-scroll"><table className="load-table"><thead><tr><th>ID</th><th>Kombinasi</th><th>Referensi</th></tr></thead><tbody>{registry.rules.map((rule) => <tr key={rule.id}><td>{rule.id}</td><td>{rule.expression}</td><td>{rule.standard_ref}</td></tr>)}</tbody></table></div>}
    </section>}

    {tab === "summary" && <section aria-labelledby="load-summary-title">
      <LoadHeading id="load-summary-title" eyebrow="Review revisi aktif" title="Load Summary" badge="INHERITED" />
      <div className="load-kpis"><article><span>Definitions</span><strong>{loads.definitions.length}</strong><small>6 kategori minimum</small></article><article><span>Assignments</span><strong>{loads.assignments.length}</strong><small>Target geometri aktual</small></article><article><span>Registry combinations</span><strong>{loads.combination_rule_ids.length}</strong><small>{registry.status === "APPROVED" ? "Approved" : "Menunggu persetujuan"}</small></article></div>
      <div className={`load-validation ${issues.length ? "has-error" : "is-valid"}`} role="status"><strong>{issues.length ? `${issues.length} data pembebanan perlu diperbaiki` : "Data pembebanan valid"}</strong><span>{issues[0]?.message ?? "Unit, provenance, target, dan revisi konsisten."}</span></div>
    </section>}

    <div className={`load-validation ${issues.length ? "has-error" : "is-valid"}`} role="status"><strong>{issues.length ? `${issues.length} masalah validasi` : "Siap disimpan"}</strong><span>{issues[0]?.message ?? `Semua data terikat revisi ${loads.revision_id}.`}</span></div>
    <button className="button button-primary save-loads" type="button" disabled={Boolean(issues.length) || saveStatus === "saving"} onClick={() => void saveNow()}>Simpan Pembebanan</button>
  </section>;
}

function LoadHeading({ eyebrow, title, badge, id }: { eyebrow: string; title: string; badge: string; id: string }) {
  return <div className="data-section-heading"><div><p className="eyebrow">{eyebrow}</p><h2 id={id}>{title}</h2></div><span className={`badge badge-${badge.toLocaleLowerCase()}`}>{badge}</span></div>;
}

function AssignmentTable({ assignments, definitions, targets, onDelete }: { assignments: LoadAssignment[]; definitions: LoadDefinition[]; targets: ReturnType<typeof loadTargets>; onDelete: (id: string) => void }) {
  return <div className="table-scroll"><table className="load-table"><thead><tr><th>Load</th><th>Target aktual</th><th>Aplikasi</th><th>Asumsi</th><th>Provenance</th><th><span className="sr-only">Aksi</span></th></tr></thead><tbody>{assignments.map((assignment) => <tr key={assignment.id}><td>{definitions.find(({ id }) => id === assignment.load_id)?.name ?? "Tidak dikenal"}</td><td>{targets.find(({ id }) => id === assignment.target_id)?.label ?? assignment.target_id}</td><td>{assignment.application}</td><td>{assignment.assumption}</td><td><span className="badge badge-input">{assignment.provenance}</span></td><td><button className="icon-button" type="button" aria-label="Hapus assignment" onClick={() => onDelete(assignment.id)}>×</button></td></tr>)}</tbody></table>{!assignments.length && <p className="table-empty">Belum ada assignment. Pilih definisi dan target geometri di atas.</p>}</div>;
}

function LoadReview({ title, definitions, assignments }: { title: string; definitions: LoadDefinition[]; assignments: LoadAssignment[] }) {
  return <section><LoadHeading id={`${title.replaceAll(" ", "-")}-title`} eyebrow="Review terstruktur" title={title} badge="INHERITED" /><div className="table-scroll"><table className="load-table"><thead><tr><th>Load</th><th>Kategori</th><th>Nilai</th><th>Assignment</th><th>Sumber</th><th>Asumsi</th></tr></thead><tbody>{definitions.map((definition) => <tr key={definition.id}><td>{definition.name}</td><td>{LOAD_CATEGORY_LABELS[definition.category]}</td><td>{definition.value ?? "—"} {definition.unit}</td><td>{assignments.filter(({ load_id }) => load_id === definition.id).length}</td><td>{definition.source || "—"}</td><td>{definition.assumption || "—"}</td></tr>)}</tbody></table></div></section>;
}
