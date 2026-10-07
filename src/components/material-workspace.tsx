"use client";

import { useEffect, useRef, useState } from "react";
import {
  CONCRETE_PRESETS,
  COVER_PRESETS,
  REBAR_PRESETS,
  MAX_FYS_LIMIT,
  applyConcretePreset,
  applyCoverPreset,
  applyRebarPreset,
  applyStandardDiameters,
  validateMaterials,
  type MaterialIssue,
  type Materials,
  type MaterialValue,
} from "../lib/materials";
import { useProjects, type SaveStatus } from "./project-provider";

type MaterialTab = "concrete" | "longitudinal" | "transverse" | "diameters";

export function MaterialWorkspace() {
  const { active, createProject, markUnsaved, saveMaterials, saveStatus } = useProjects();
  if (!active) return <section className="panel empty-project"><h2>Belum ada proyek</h2><p>Buat proyek sebelum mengisi material.</p><button className="button button-primary" type="button" onClick={() => void createProject()}>Buat Proyek</button></section>;
  return <MaterialEditor key={active.project.id} initial={active.materials} markUnsaved={markUnsaved} saveMaterials={saveMaterials} saveStatus={saveStatus} />;
}

function MaterialEditor({ initial, markUnsaved, saveMaterials, saveStatus }: {
  initial: Materials;
  markUnsaved: () => void;
  saveMaterials: (materials: Materials, reason: "manual" | "autosave") => Promise<void>;
  saveStatus: SaveStatus;
}) {
  const [materials, setMaterials] = useState(initial);
  const [tab, setTab] = useState<MaterialTab>("concrete");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const issues = validateMaterials(materials);

  useEffect(() => () => clearTimeout(timer.current), []);

  function apply(next: Materials) {
    setMaterials(next);
    markUnsaved();
    clearTimeout(timer.current);
    if (!validateMaterials(next).length) timer.current = setTimeout(() => void saveMaterials(next, "autosave"), 800);
  }

  const numberValue = (value: string) => value === "" ? null : Number(value);
  const issueAt = (path: string) => issues.find((issue) => issue.path === path);

  async function saveNow() {
    clearTimeout(timer.current);
    if (!issues.length) await saveMaterials(materials, "manual");
  }

  return (
    <section className="panel material-editor" aria-label="Editor material">
      <div className="material-tabs" role="tablist" aria-label="Data material">
        {([
          ["concrete", "Concrete"],
          ["longitudinal", "Longitudinal Rebar"],
          ["transverse", "Transverse Rebar"],
          ["diameters", "Available Diameters"],
        ] as const).map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} type="button" onClick={() => setTab(value)}>{label}</button>)}
      </div>

      {tab === "concrete" && <section className="material-section" aria-labelledby="concrete-title">
        <SectionHeading eyebrow="Beton" title="Concrete" badge="INPUT" id="concrete-title" />
        <div className="preset-selector">
          <label><span>Pilihan Cepat Mutu Beton</span>
            <select aria-label="Pilihan Cepat Mutu Beton" value={CONCRETE_PRESETS.find((p) => p.grade === materials.concrete.grade && p.fc === materials.concrete.fc.value)?.id ?? ""} onChange={(e) => e.target.value && apply(applyConcretePreset(materials, e.target.value))}>
              <option value="">Pilih Preset Mutu (atau isi manual di bawah)</option>
              {CONCRETE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            </select>
          </label>
        </div>
        <div className="material-form">
          <TextField label="Mutu / grade" path="concrete.grade" value={materials.concrete.grade} issue={issueAt("concrete.grade")} onChange={(grade) => apply({ ...materials, concrete: { ...materials.concrete, grade } })} />
          <NumberField label="fc'" path="concrete.fc" quantity={materials.concrete.fc} issue={issueAt("concrete.fc")} onChange={(value) => apply({ ...materials, concrete: { ...materials.concrete, fc: { ...materials.concrete.fc, value } } })} />
          <NumberField label="Density" path="concrete.density" quantity={materials.concrete.density} issue={issueAt("concrete.density")} onChange={(value) => apply({ ...materials, concrete: { ...materials.concrete, density: { ...materials.concrete.density, value } } })} />
          <NumberField label="Concrete cover" path="concrete.cover" quantity={materials.concrete.cover} issue={issueAt("concrete.cover")} onChange={(value) => apply({ ...materials, concrete: { ...materials.concrete, cover: { ...materials.concrete.cover, value } } })} />
        </div>
        <div className="preset-selector">
          <label><span>Rujukan Selimut Beton (SNI 2847:2019 Tabel 20.6.1.3.1)</span>
            <select aria-label="Rujukan Selimut Beton" value={COVER_PRESETS.find((p) => p.cover === materials.concrete.cover.value)?.id ?? ""} onChange={(e) => e.target.value && apply(applyCoverPreset(materials, e.target.value))}>
              <option value="">Pilih Kondisi Paparan untuk Mengisi Cover</option>
              {COVER_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            </select>
          </label>
        </div>
        <div className="derived-property" aria-label="Modulus elastisitas beton">
          <div><span>Elastic modulus, Ec</span><strong>Belum tersedia</strong></div>
          <div><span className="badge badge-code">CODE</span><small>Rumus belum tersedia pada registry yang disetujui.</small></div>
        </div>
      </section>}

      {tab === "longitudinal" && <section className="material-section" aria-labelledby="longitudinal-title">
        <SectionHeading eyebrow="Tulangan utama" title="Longitudinal Rebar" badge="INPUT" id="longitudinal-title" />
        <div className="preset-selector">
          <label><span>Pilihan Cepat Mutu Baja Tulangan</span>
            <select aria-label="Pilihan Cepat Mutu Baja Tulangan" value={REBAR_PRESETS.find((p) => p.grade === materials.longitudinal_rebar.grade && p.fy === materials.longitudinal_rebar.fy.value)?.id ?? ""} onChange={(e) => e.target.value && apply(applyRebarPreset(materials, e.target.value))}>
              <option value="">Pilih Mutu Baja (atau isi manual di bawah)</option>
              {REBAR_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            </select>
          </label>
        </div>
        <div className="material-form">
          <TextField label="Mutu / grade" path="longitudinal_rebar.grade" value={materials.longitudinal_rebar.grade} issue={issueAt("longitudinal_rebar.grade")} onChange={(grade) => apply({ ...materials, longitudinal_rebar: { ...materials.longitudinal_rebar, grade } })} />
          <NumberField label="fy" path="longitudinal_rebar.fy" quantity={materials.longitudinal_rebar.fy} issue={issueAt("longitudinal_rebar.fy")} onChange={(value) => apply({ ...materials, longitudinal_rebar: { ...materials.longitudinal_rebar, fy: { ...materials.longitudinal_rebar.fy, value } } })} />
        </div>
      </section>}

      {tab === "transverse" && <section className="material-section" aria-labelledby="transverse-title">
        <SectionHeading eyebrow="Sengkang / spiral" title="Transverse Rebar" badge="INPUT" id="transverse-title" />
        <div className="preset-selector">
          <button type="button" className="button button-secondary" onClick={() => apply({ ...materials, transverse_rebar: { ...materials.transverse_rebar, grade: materials.longitudinal_rebar.grade, fys: { ...materials.transverse_rebar.fys, value: Math.min(materials.longitudinal_rebar.fy.value ?? MAX_FYS_LIMIT, MAX_FYS_LIMIT) } } })}>
            Samakan dengan Tulangan Utama (fys = {Math.min(materials.longitudinal_rebar.fy.value ?? MAX_FYS_LIMIT, MAX_FYS_LIMIT)} MPa)
          </button>
        </div>
        <div className="material-form">
          <TextField label="Mutu / grade" path="transverse_rebar.grade" value={materials.transverse_rebar.grade} issue={issueAt("transverse_rebar.grade")} onChange={(grade) => apply({ ...materials, transverse_rebar: { ...materials.transverse_rebar, grade } })} />
          <NumberField label="fys" path="transverse_rebar.fys" quantity={materials.transverse_rebar.fys} issue={issueAt("transverse_rebar.fys")} onChange={(value) => apply({ ...materials, transverse_rebar: { ...materials.transverse_rebar, fys: { ...materials.transverse_rebar.fys, value } } })} />
        </div>
      </section>}

      {tab === "diameters" && <section className="material-section" aria-labelledby="diameters-title">
        <SectionHeading eyebrow="Pilihan desain" title="Available Diameters" badge="INPUT" id="diameters-title" />
        <div className="preset-selector">
          <button type="button" className="button button-secondary" onClick={() => apply(applyStandardDiameters(materials))}>
            Gunakan Diameter Standar Pasar (D10, D13, D16, D19, D22, D25)
          </button>
        </div>
        <div className="table-scroll"><table className="geometry-table diameter-table"><thead><tr><th>Diameter nominal (mm)</th><th>Sumber</th><th><span className="sr-only">Aksi</span></th></tr></thead><tbody>
          {materials.available_diameters.map((diameter, index) => {
            const path = `available_diameters.${index}.nominal_diameter`;
            const issue = issueAt(path);
            return <tr key={diameter.id}>
              <td><input aria-label={`Diameter tulangan ${index + 1}`} aria-invalid={Boolean(issue)} aria-describedby={issue ? `${path}-error` : undefined} type="number" min="0" step="any" value={diameter.nominal_diameter.value ?? ""} onChange={(event) => apply({ ...materials, available_diameters: materials.available_diameters.map((item, itemIndex) => itemIndex === index ? { ...item, nominal_diameter: { ...item.nominal_diameter, value: numberValue(event.target.value) } } : item) })} />{issue && <small className="field-error" id={`${path}-error`}>{issue.message}</small>}</td>
              <td><span className="badge badge-input">INPUT</span></td>
              <td><button className="icon-button" type="button" aria-label={`Hapus diameter ${index + 1}`} onClick={() => apply({ ...materials, available_diameters: materials.available_diameters.filter((_, itemIndex) => itemIndex !== index) })}>×</button></td>
            </tr>;
          })}
        </tbody></table></div>
        {!materials.available_diameters.length && <p className="inline-error" role="alert">{issueAt("available_diameters")?.message}</p>}
        <button className="button button-secondary add-row" type="button" onClick={() => apply({ ...materials, available_diameters: [...materials.available_diameters, { id: crypto.randomUUID(), nominal_diameter: { value: null, unit: "mm", provenance: "INPUT" } }] })}>+ Tambah Diameter</button>
      </section>}

      <div className={`material-validation ${issues.length ? "has-error" : "is-valid"}`} role="status">
        <strong>{issues.length ? `${issues.length} data material perlu diperbaiki` : "Material valid"}</strong>
        <span>{issues[0]?.message ?? "Semua input wajib memiliki nilai dan unit yang valid."}</span>
      </div>
      <button className="button button-primary save-material" type="button" disabled={Boolean(issues.length) || saveStatus === "saving"} onClick={() => void saveNow()}>Simpan Material</button>
    </section>
  );
}

function SectionHeading({ eyebrow, title, badge, id }: { eyebrow: string; title: string; badge: string; id: string }) {
  return <div className="data-section-heading"><div><p className="eyebrow">{eyebrow}</p><h2 id={id}>{title}</h2></div><span className="badge badge-input">{badge}</span></div>;
}

function TextField({ label, path, value, issue, onChange }: { label: string; path: string; value: string; issue?: MaterialIssue; onChange: (value: string) => void }) {
  const errorId = `${path}-error`;
  return <label className="material-field"><span>{label}</span><div className="input-with-source"><input aria-invalid={Boolean(issue)} aria-describedby={issue ? errorId : undefined} value={value} onChange={(event) => onChange(event.target.value)} /><span>INPUT</span></div>{issue && <small className="field-error" id={errorId}>{issue.message}</small>}</label>;
}

function NumberField({ label, path, quantity, issue, onChange }: { label: string; path: string; quantity: MaterialValue; issue?: MaterialIssue; onChange: (value: number | null) => void }) {
  const errorId = `${path}-error`;
  return <label className="material-field"><span>{label}</span><div className="number-with-unit"><input aria-invalid={Boolean(issue)} aria-describedby={issue ? errorId : undefined} type="number" min="0" step="any" value={quantity.value ?? ""} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} /><span>{quantity.unit}</span><small>INPUT</small></div>{issue && <small className="field-error" id={errorId}>{issue.message}</small>}</label>;
}
