"use client";

import { useEffect, useMemo, useState } from "react";
import { getReportAssets, getReportWorkspace, listReportSnapshots, persistReportAsset, persistReportSnapshot, persistReportWorkspace } from "../lib/project-database";
import {
  createReportSnapshot,
  createReportWorkspace,
  deriveAssumptionsAndDefaults,
  isReportSnapshotStale,
  updateFigure,
  updateTableCaption,
  validateReport,
  type ReportAsset,
  type ReportWorkspace,
} from "../lib/report";
import { useProjects } from "./project-provider";

type Tab = "document" | "assumptions" | "figures" | "tables" | "validation" | "generate";
const tabs: [Tab, string][] = [
  ["document", "Dokumen"],
  ["assumptions", "Asumsi & Default"],
  ["figures", "Gambar & Caption"],
  ["tables", "Tabel & Caption"],
  ["validation", "Validasi"],
  ["generate", "Generate"],
];


export function ReportWorkspaceView() {
  const { active } = useProjects();
  const [tab, setTab] = useState<Tab>("document");
  const [workspace, setWorkspace] = useState<ReportWorkspace | null>(null);
  const [assets, setAssets] = useState<Record<string, ReportAsset>>({});
  const [lastSnapshotStale, setLastSnapshotStale] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");

  useEffect(() => {
    if (!active) return;
    const current = active;
    let cancelled = false;
    void (async () => {
      const stored = await getReportWorkspace(current.project.id);
      const next = createReportWorkspace(current, stored);
      const assetIds = next.figures.flatMap(({ uploaded_asset_reference }) => uploaded_asset_reference ? [uploaded_asset_reference] : []);
      const [storedAssets, snapshots] = await Promise.all([getReportAssets(assetIds), listReportSnapshots(active.project.id)]);
      if (cancelled) return;
      setWorkspace(next);
      setAssets(Object.fromEntries(storedAssets.map((asset) => [asset.asset_id, asset])));
      setLastSnapshotStale(Boolean(snapshots[0] && isReportSnapshotStale(snapshots[0], current)));
      await persistReportWorkspace(next);
    })().catch((error) => setGenerationStatus(error instanceof Error ? error.message : "Workspace laporan gagal dimuat."));
    return () => { cancelled = true; };
  }, [active]);

  const validation = useMemo(() => workspace ? validateReport(workspace) : { status: "BLOCKED" as const, blocked: ["Belum ada proyek aktif."], warnings: [] }, [workspace]);
  const assumptions = useMemo(() => active ? deriveAssumptionsAndDefaults(active) : [], [active]);
  if (!active || !workspace || workspace.project_id !== active.project.id) return <section className="panel empty-state"><h2>Memuat workspace laporan</h2><p>Menyiapkan metadata Generate #1 untuk proyek aktif.</p></section>;
  const bundle = active;
  const reportWorkspace = workspace;

  async function apply(next: ReportWorkspace) {
    setWorkspace(next);
    await persistReportWorkspace(next);
  }

  async function upload(figureId: string, file: File | undefined) {
    if (!file || !["image/png", "image/jpeg"].includes(file.type)) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const asset: ReportAsset = { asset_id: crypto.randomUUID(), project_id: bundle.project.id, file_name: file.name, mime_type: file.type as ReportAsset["mime_type"], data_url: dataUrl, created_at: new Date().toISOString() };
    await persistReportAsset(asset);
    setAssets((current) => ({ ...current, [asset.asset_id]: asset }));
    await apply(updateFigure(reportWorkspace, figureId, { uploaded_asset_reference: asset.asset_id }));
  }

  async function generate() {
    setGenerationStatus("Membuat DOCX…");
    try {
      const snapshot = createReportSnapshot(bundle, reportWorkspace);
      const referencedAssets = snapshot.uploaded_image_references.map((id) => assets[id]).filter(Boolean);
      const response = await fetch("/api/reports/generate-1", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bundle, snapshot, assets: referencedAssets }) });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? "Generate DOCX gagal.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = snapshot.file_name; anchor.click();
      URL.revokeObjectURL(url);
      await persistReportSnapshot(snapshot);
      setLastSnapshotStale(false);
      setGenerationStatus(`Selesai · ${snapshot.file_name}`);
    } catch (error) {
      setGenerationStatus(error instanceof Error ? error.message : "Generate DOCX gagal.");
    }
  }

  return <section className="panel report-editor" aria-label="Workspace Generate 1">
    <div className="report-tabs" role="tablist" aria-label="Generate 1">
      {tabs.map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} type="button" onClick={() => setTab(value)}>{label}</button>)}
    </div>

    {tab === "document" && <section><ReportHeading title="Dokumen" meta={`${workspace.template_reference} · CLONE → PATCH`} /><div className={`report-validation is-${validation.status.toLowerCase()}`}><strong>{validation.status}</strong><span>Master template terverifikasi</span><span>Revisi proyek {active.revision.revision_number}</span></div><div className="report-outline">{workspace.sections.map((section) => <article key={section.section_id} className={`level-${section.level}`}><span>{section.section_id === "front" ? "—" : section.section_id}</span><div><small>{section.chapter}</small><strong>{section.title}</strong></div><Status value={section.status} /></article>)}</div></section>}

    {tab === "assumptions" && <section><ReportHeading title="Asumsi & Nilai Default" meta={`${assumptions.length} parameter aktif · Standar SNI 1726/1727/2847`} /><div className="table-scroll"><table className="seismic-table"><thead><tr><th>Kategori</th><th>Parameter</th><th>Nilai Aktif</th><th>Status</th><th>Rujukan Standar</th><th>Catatan</th></tr></thead><tbody>{assumptions.map((item, index) => <tr key={index}><td><strong>{item.category}</strong></td><td>{item.parameter}</td><td><code>{item.value}</code></td><td><span className={`etabs-status ${item.status === "DEFAULT_SNI" ? "is-ready" : "is-warning"}`}>{item.status === "DEFAULT_SNI" ? "DEFAULT SNI" : "OVERRIDE MANUAL"}</span></td><td>{item.standard_ref}</td><td><small>{item.note}</small></td></tr>)}</tbody></table></div></section>}

    {tab === "tables" && <section><ReportHeading title="Tabel Laporan" meta={`${workspace.tables.length} tabel dari data proyek`} /><div className="report-card-list">{workspace.tables.map((table) => <article key={table.table_id}><div className="report-card-head"><div><small>{table.section_id} · {table.source_module}</small><strong>{table.default_caption}</strong></div><Status value={table.status} /></div><label><span>Caption tabel</span><input value={table.caption_override} placeholder={table.default_caption} onChange={(event) => void apply(updateTableCaption(workspace, table.table_id, event.target.value))} /></label><small>table_id: {table.table_id} · revisi {table.data_revision}</small></article>)}</div></section>}

    {tab === "figures" && <section><ReportHeading title="Gambar & Caption" meta="Referensi master di kiri · gambar proyek di kanan" /><div className="figure-list">{workspace.figures.map((figure) => {
      const asset = figure.uploaded_asset_reference ? assets[figure.uploaded_asset_reference] : null;
      return <article key={figure.figure_id} className="figure-card"><div className="figure-preview-pair"><div><small>Contoh master</small><div className="figure-preview">{figure.reference_example_reference ? <ReferencePreview src={figure.reference_example_reference} alt={`Contoh ${figure.effective_caption}`} /> : <div className="reference-placeholder"><span>Tidak ada contoh khusus</span></div>}</div></div><div><small>Gambar proyek</small><div className="figure-preview">{asset ? <AssetPreview asset={asset} alt={figure.effective_caption} /> : figure.system_image_source ? <SystemPreview figureId={figure.figure_id} /> : <div className="reference-placeholder"><strong>Belum tersedia</strong><span>Gambar opsional akan dihilangkan dari DOCX</span></div>}</div></div></div><div className="figure-controls"><div className="report-card-head"><div><small>{figure.section_id} · {figure.source_type.replaceAll("_", " ")}</small><strong>{figure.default_caption}</strong></div><Status value={figure.status} /></div><label><span>Judul Gambar</span><input value={figure.caption_override} placeholder={figure.default_caption} onChange={(event) => void apply(updateFigure(workspace, figure.figure_id, { caption_override: event.target.value }))} /></label><div className="figure-actions"><label className="button button-secondary"><input className="sr-only" type="file" accept="image/png,image/jpeg" onChange={(event) => void upload(figure.figure_id, event.target.files?.[0])} />Upload/Ganti Gambar</label>{figure.system_image_source && <button className="button button-secondary" type="button" onClick={() => void apply(updateFigure(workspace, figure.figure_id, { uploaded_asset_reference: null }))}>Gunakan Gambar Sistem</button>}<button className="button button-secondary" type="button" onClick={() => void apply(updateFigure(workspace, figure.figure_id, { caption_override: "" }))}>Reset Judul</button>{figure.uploaded_asset_reference && <button className="button button-secondary" type="button" onClick={() => void apply(updateFigure(workspace, figure.figure_id, { uploaded_asset_reference: null }))}>Hapus Override</button>}</div><small>figure_id: {figure.figure_id} · {figure.required ? "wajib" : "opsional"}</small></div></article>;
    })}</div></section>}

    {tab === "validation" && <section><ReportHeading title="Preview dan Validasi" meta={`Revisi proyek ${active.revision.revision_number}`} /><div className={`report-validation is-${validation.status.toLowerCase()}`}><strong>{validation.status}</strong><span>{validation.blocked.length ? `${validation.blocked.length} blocker` : "Konten wajib siap"}</span><span>{validation.warnings.length} warning</span>{lastSnapshotStale && <span>Snapshot terakhir STALE</span>}</div>{validation.blocked.map((item) => <p className="report-issue blocked" key={item}>{item}</p>)}{validation.warnings.map((item) => <p className="report-issue warning" key={item}>{item}</p>)}<dl className="snapshot-grid"><div><dt>Project revision</dt><dd>{active.revision.id}</dd></div><div><dt>Geometry revision</dt><dd>{active.geometry.revision_id}</dd></div><div><dt>Material revision</dt><dd>{active.materials.revision_id}</dd></div><div><dt>Load revision</dt><dd>{active.loads.revision_id}</dd></div><div><dt>Seismic revision</dt><dd>{active.seismic.revision_id}</dd></div><div><dt>Registry</dt><dd>{active.revision.registry_version}</dd></div></dl></section>}

    {tab === "generate" && <section><ReportHeading title="Generate DOCX" meta="Snapshot immutable dari revisi aktif" /><div className="generate-panel"><p>DOCX memuat front matter, BAB I, BAB II, serta BAB III sampai handoff ETABS. Nomor caption dan daftar memakai field Word.</p><button className="button button-primary" type="button" disabled={validation.status === "BLOCKED"} onClick={() => void generate()}>Generate DOCX</button>{generationStatus && <span role="status">{generationStatus}</span>}</div></section>}
  </section>;
}

function ReportHeading({ title, meta }: { title: string; meta: string }) {
  return <div className="data-section-heading"><div><p className="eyebrow">M8 · Generate #1</p><h2>{title}</h2></div><small>{meta}</small></div>;
}

function Status({ value }: { value: string }) {
  return <span className={`etabs-status is-${value.toLowerCase()}`}>{value}</span>;
}

function AssetPreview({ asset, alt }: { asset: ReportAsset; alt: string }) {
  // User-selected local data URLs are already bounded to PNG/JPEG by the upload control.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset.data_url} alt={alt} />;
}

function ReferencePreview({ src, alt }: { src: string; alt: string }) {
  // Static reference images are extracted from the master and are guidance only.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} />;
}

function SystemPreview({ figureId }: { figureId: string }) {
  if (figureId === "response-spectrum") return <svg viewBox="0 0 320 180" role="img" aria-label="Preview spektrum respons"><path d="M35 15V145H300" /><path d="M35 145L55 45L125 45L180 85L295 135" className="accent" /><path d="M55 40V150M125 40V150" className="guide" /><text x="7" y="20">Sa (g)</text><text x="260" y="170">T (detik)</text><text x="48" y="165">T0</text><text x="118" y="165">Ts</text></svg>;
  if (figureId === "story-elevation") return <svg viewBox="0 0 320 180" role="img" aria-label="Preview elevasi"><path d="M70 25V155M250 25V155M45 45H275M45 80H275M45 115H275M45 150H275" /></svg>;
  if (figureId === "model-3d") return <svg viewBox="0 0 320 180" role="img" aria-label="Preview model tiga dimensi"><path d="M85 145L215 145L265 115L135 115ZM85 105L215 105L265 75L135 75ZM85 65L215 65L265 35L135 35ZM85 65V145M215 65V145M265 35V115M135 35V115" /></svg>;
  return <svg viewBox="0 0 320 180" role="img" aria-label="Preview denah grid"><path d="M55 25V155M120 25V155M190 25V155M265 25V155M35 45H285M35 90H285M35 135H285" /></svg>;
}
