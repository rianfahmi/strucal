import { createEtabsHandoff } from "./etabs-handoff.ts";
import type { ProjectBundle } from "./projects.ts";
import { REPORT_MASTER_FILE, REPORT_TEMPLATE_MANIFEST } from "./report-template-manifest.ts";
import { getCoefficientSourceLabel } from "./seismic.ts";

export type ReportStatus = "READY" | "WARNING" | "BLOCKED";
export type FigureSourceType = "AUTO_GENERATED" | "USER_UPLOAD" | "REFERENCE_PLACEHOLDER";

export type ReportSection = {
  section_id: string;
  chapter: string;
  title: string;
  level: 1 | 2;
  order_index: number;
  status: ReportStatus;
};

export type ReportFigure = {
  figure_id: string;
  section_id: string;
  order_index: number;
  default_caption: string;
  caption_override: string;
  effective_caption: string;
  source_type: FigureSourceType;
  system_image_source: string | null;
  uploaded_asset_reference: string | null;
  reference_example_reference: string | null;
  required: boolean;
  status: ReportStatus;
  project_revision: string;
};

export type ReportTable = {
  table_id: string;
  section_id: string;
  order_index: number;
  default_caption: string;
  caption_override: string;
  effective_caption: string;
  source_module: string;
  data_revision: string;
  required: boolean;
  status: ReportStatus;
};

export type ReportAsset = {
  asset_id: string;
  project_id: string;
  file_name: string;
  mime_type: "image/png" | "image/jpeg";
  data_url: string;
  created_at: string;
};

export type ReportWorkspace = {
  project_id: string;
  project_revision: string;
  template_reference: string;
  template_fidelity_status: "VERIFIED_REFERENCE_MAP";
  sections: ReportSection[];
  figures: ReportFigure[];
  tables: ReportTable[];
};

export type ReportSnapshot = {
  report_snapshot_id: string;
  generated_at: string;
  project_id: string;
  project_revision: string;
  geometry_revision: string;
  material_revision: string;
  load_revision: string;
  seismic_revision: string;
  registry_version: string;
  combination_registry_version: string;
  template_reference: string;
  template_fidelity_status: "VERIFIED_REFERENCE_MAP";
  figures: ReportFigure[];
  tables: ReportTable[];
  uploaded_image_references: string[];
  caption_overrides: Record<string, string>;
  source_input_hash: string;
  file_name: string;
};

export const REPORT_TEMPLATE_REFERENCE = REPORT_MASTER_FILE;

const SECTION_TEMPLATE: Omit<ReportSection, "status">[] = [
  { section_id: "front", chapter: "FRONT MATTER", title: "Sampul dan Daftar", level: 1, order_index: 0 },
  { section_id: "1", chapter: "BAB I", title: "PENDAHULUAN", level: 1, order_index: 10 },
  { section_id: "1.1", chapter: "BAB I", title: "Data Perencanaan", level: 2, order_index: 11 },
  { section_id: "1.2", chapter: "BAB I", title: "Data Bangunan", level: 2, order_index: 12 },
  { section_id: "1.2.1", chapter: "BAB I", title: "Data Struktur", level: 2, order_index: 13 },
  { section_id: "1.2.2", chapter: "BAB I", title: "Gambar Rencana", level: 2, order_index: 14 },
  { section_id: "1.3", chapter: "BAB I", title: "Diagram Alir Perencanaan", level: 2, order_index: 15 },
  { section_id: "1.4", chapter: "BAB I", title: "Dasar-Dasar Perencanaan", level: 2, order_index: 16 },
  { section_id: "1.4.1", chapter: "BAB I", title: "Peraturan yang Digunakan", level: 2, order_index: 17 },
  { section_id: "2", chapter: "BAB II", title: "MATERIAL DAN PEMBEBANAN", level: 1, order_index: 20 },
  { section_id: "2.1", chapter: "BAB II", title: "Konsep Perancangan Struktur Beton Bertulang", level: 2, order_index: 21 },
  { section_id: "2.2", chapter: "BAB II", title: "Material Properties", level: 2, order_index: 22 },
  { section_id: "2.3", chapter: "BAB II", title: "Pembebanan", level: 2, order_index: 23 },
  { section_id: "2.3.1", chapter: "BAB II", title: "Beban Mati", level: 2, order_index: 24 },
  { section_id: "2.3.2", chapter: "BAB II", title: "Beban Hidup", level: 2, order_index: 25 },
  { section_id: "2.3.3", chapter: "BAB II", title: "Beban Angin", level: 2, order_index: 26 },
  { section_id: "2.3.4", chapter: "BAB II", title: "Beban Hidup Atap", level: 2, order_index: 27 },
  { section_id: "2.3.5", chapter: "BAB II", title: "Beban Hujan", level: 2, order_index: 28 },
  { section_id: "2.3.6", chapter: "BAB II", title: "Beban Gempa Pra-Analisis", level: 2, order_index: 29 },
  { section_id: "3", chapter: "BAB III", title: "PERMODELAN STRUKTUR", level: 1, order_index: 30 },
  { section_id: "3.1", chapter: "BAB III", title: "Model Struktur dengan ETABS", level: 2, order_index: 31 },
  { section_id: "3.1.1", chapter: "BAB III", title: "Data Umum Bangunan", level: 2, order_index: 32 },
  { section_id: "3.1.2", chapter: "BAB III", title: "Pembuatan Grid", level: 2, order_index: 33 },
  { section_id: "3.2", chapter: "BAB III", title: "Permodelan Material dan Penampang", level: 2, order_index: 34 },
  { section_id: "3.3", chapter: "BAB III", title: "Permodelan Perletakan Pondasi", level: 2, order_index: 35 },
  { section_id: "3.4", chapter: "BAB III", title: "Pembuatan Load Pattern", level: 2, order_index: 36 },
  { section_id: "3.5", chapter: "BAB III", title: "Aplikasi Beban pada Struktur melalui ETABS", level: 2, order_index: 37 },
  { section_id: "3.6", chapter: "BAB III", title: "Load Cases dan Response Spectrum", level: 2, order_index: 38 },
  { section_id: "3.7", chapter: "BAB III", title: "Kombinasi Beban", level: 2, order_index: 39 },
  { section_id: "3.8", chapter: "BAB III", title: "Ringkasan Handoff ETABS", level: 2, order_index: 40 },
];

const FIGURE_TEMPLATE = [
  ["plan-grid", "1.2.2", "Denah dan grid struktur", "M3_GEOMETRY_PLAN", true],
  ["story-elevation", "1.2.2", "Elevasi dan susunan tingkat", "M3_GEOMETRY_ELEVATION", true],
  ["model-3d", "1.2.2", "Representasi tiga dimensi model struktur", "M3_GEOMETRY_3D", false],
  ["response-spectrum", "2.3.6", "Spektrum respons desain", "M6_RESPONSE_SPECTRUM", true],
  ["etabs-grid-reference", "3.1.2", "Grid System pada model ETABS", null, false],
  ["etabs-material-reference", "3.2", "Definisi material dan penampang pada ETABS", null, false],
  ["etabs-restraint-reference", "3.3", "Permodelan perletakan pada ETABS", null, false],
  ["etabs-load-pattern-reference", "3.4", "Definisi load pattern pada ETABS", null, false],
  ["etabs-load-assignment-reference", "3.5", "Aplikasi beban pada model ETABS", null, false],
  ["etabs-load-case-reference", "3.6", "Definisi load case dan response spectrum pada ETABS", null, false],
  ["etabs-combination-reference", "3.7", "Definisi kombinasi beban pada ETABS", null, false],
] as const;

const TABLE_TEMPLATE = [
  ["project-data", "1.2", "Data Bangunan", "M2 Project"],
  ["grid-x", "1.2.1", "Data Grid X", "M3 Geometry"],
  ["grid-y", "1.2.1", "Data Grid Y", "M3 Geometry"],
  ["story-data", "1.2.1", "Story Data", "M3 Geometry"],
  ["material-properties", "2.2", "Properti Material Struktur", "M4 Material"],
  ["reinforcement-diameters", "2.2", "Diameter Tulangan Tersedia", "M4 Material"],
  ["load-summary", "2.3", "Ringkasan Pembebanan", "M5 Loading"],
  ["load-assignments", "2.3", "Assignment Pembebanan", "M5 Loading"],
  ["seismic-input-provenance", "2.3.6", "Input dan Provenance Parameter Gempa", "M6 Seismic"],
  ["seismic-spectrum", "2.3.6", "Parameter Spektrum Respons Desain", "M6 Seismic"],
  ["seismic-kds", "2.3.6", "Penetapan Kategori Desain Seismik", "M6 Seismic"],
  ["seismic-system", "2.3.6", "Parameter Sistem Struktur", "M6 Seismic"],
  ["seismic-period", "2.3.6", "Periode Fundamental Struktur", "M6 Seismic"],
  ["seismic-cs", "2.3.6", "Koefisien Respons Seismik", "M6 Seismic"],
  ["seismic-weight", "2.3.6", "Berat Seismik per Tingkat", "M5/M6"],
  ["seismic-base-shear", "2.3.6", "Gaya Geser Dasar Seismik", "M6 Seismic"],
  ["story-forces", "2.3.6", "Distribusi Gaya Gempa per Tingkat", "M6 Seismic"],
  ["etabs-patterns", "3.4", "Referensi Load Pattern ETABS", "M7 ETABS Handoff"],
  ["etabs-cases", "3.6", "Referensi Load Case ETABS", "M7 ETABS Handoff"],
  ["load-combinations", "3.7", "Kombinasi Beban untuk Referensi ETABS", "M7 ETABS Handoff"],
  ["etabs-readiness", "3.8", "Checklist Handoff ETABS", "M7 ETABS Handoff"],
] as const;

export function createReportWorkspace(bundle: ProjectBundle, previous?: ReportWorkspace | null): ReportWorkspace {
  const handoff = createEtabsHandoff(bundle);
  const blocked = handoff.status === "BLOCKED";
  const previousFigures = new Map(previous?.figures.map((figure) => [figure.figure_id, figure]));
  const previousTables = new Map(previous?.tables.map((table) => [table.table_id, table]));
  const figures = FIGURE_TEMPLATE.map(([figure_id, section_id, default_caption, system_image_source], order_index): ReportFigure => {
    const prior = previousFigures.get(figure_id);
    const hasUpload = Boolean(prior?.uploaded_asset_reference);
    const source_type: FigureSourceType = hasUpload ? "USER_UPLOAD" : system_image_source ? "AUTO_GENERATED" : "REFERENCE_PLACEHOLDER";
    const required = FIGURE_TEMPLATE[order_index][4];
    return {
      figure_id, section_id, order_index, default_caption,
      caption_override: prior?.caption_override ?? "",
      effective_caption: prior?.caption_override.trim() || default_caption,
      source_type, system_image_source,
      uploaded_asset_reference: prior?.uploaded_asset_reference ?? null,
      reference_example_reference: REPORT_TEMPLATE_MANIFEST.figures[figure_id as keyof typeof REPORT_TEMPLATE_MANIFEST.figures]?.example ?? null,
      required,
      status: blocked && required ? "BLOCKED" : source_type === "REFERENCE_PLACEHOLDER" ? "WARNING" : "READY",
      project_revision: bundle.revision.id,
    };
  });
  const tables = TABLE_TEMPLATE.map(([table_id, section_id, default_caption, source_module], order_index): ReportTable => {
    const prior = previousTables.get(table_id);
    return {
      table_id, section_id, order_index, default_caption,
      caption_override: prior?.caption_override ?? "",
      effective_caption: prior?.caption_override.trim() || default_caption,
      source_module, data_revision: bundle.revision.id,
      required: true,
      status: blocked ? "BLOCKED" : "READY",
    };
  });
  return {
    project_id: bundle.project.id,
    project_revision: bundle.revision.id,
    template_reference: REPORT_TEMPLATE_REFERENCE,
    template_fidelity_status: "VERIFIED_REFERENCE_MAP",
    sections: SECTION_TEMPLATE.map((section) => ({ ...section, status: blocked ? "BLOCKED" : "READY" })),
    figures,
    tables,
  };
}

export function updateFigure(workspace: ReportWorkspace, figureId: string, patch: Partial<Pick<ReportFigure, "caption_override" | "uploaded_asset_reference">>): ReportWorkspace {
  return {
    ...workspace,
    figures: workspace.figures.map((figure) => {
      if (figure.figure_id !== figureId) return figure;
      const next = { ...figure, ...patch };
      next.effective_caption = next.caption_override.trim() || next.default_caption;
      next.source_type = next.uploaded_asset_reference ? "USER_UPLOAD" : next.system_image_source ? "AUTO_GENERATED" : "REFERENCE_PLACEHOLDER";
      next.status = next.source_type === "REFERENCE_PLACEHOLDER" ? "WARNING" : "READY";
      return next;
    }),
  };
}

export function updateTableCaption(workspace: ReportWorkspace, tableId: string, captionOverride: string): ReportWorkspace {
  return {
    ...workspace,
    tables: workspace.tables.map((table) => table.table_id === tableId
      ? { ...table, caption_override: captionOverride, effective_caption: captionOverride.trim() || table.default_caption }
      : table),
  };
}

export function validateReport(workspace: ReportWorkspace) {
  const blocked = [
    ...workspace.sections.filter(({ status }) => status === "BLOCKED").map(({ title }) => `Bagian ${title} belum siap.`),
    ...workspace.figures.filter(({ required, status }) => required && status === "BLOCKED").map(({ effective_caption }) => `Gambar wajib ${effective_caption} belum siap.`),
    ...workspace.tables.filter(({ required, status }) => required && status === "BLOCKED").map(({ effective_caption }) => `Tabel wajib ${effective_caption} belum siap.`),
  ];
  const warnings = [
    ...workspace.figures.filter(({ status }) => status === "WARNING").map(({ effective_caption }) => `Gambar opsional ${effective_caption} belum tersedia.`),
    ...workspace.tables.filter(({ status }) => status === "WARNING").map(({ effective_caption }) => `${effective_caption} belum tersedia; dicatat sebagai referensi.`),
  ];
  return { status: blocked.length ? "BLOCKED" as const : "READY" as const, blocked, warnings };
}

function hashSource(value: unknown) {
  const input = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function safeReportFileName(title: string) {
  const normalized = title.normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  return `${normalized || "StruCal"}-Generate-1.docx`;
}

export function createReportSnapshot(
  bundle: ProjectBundle,
  workspace: ReportWorkspace,
  id: () => string = () => crypto.randomUUID(),
  now: () => string = () => new Date().toISOString(),
): ReportSnapshot {
  if (validateReport(workspace).status === "BLOCKED") throw new Error("Laporan belum lolos validasi Generate #1.");
  return {
    report_snapshot_id: id(), generated_at: now(), project_id: bundle.project.id,
    project_revision: bundle.revision.id, geometry_revision: bundle.geometry.revision_id,
    material_revision: bundle.materials.revision_id, load_revision: bundle.loads.revision_id,
    seismic_revision: bundle.seismic.revision_id, registry_version: bundle.revision.registry_version,
    combination_registry_version: bundle.loads.combination_registry_version,
    template_reference: workspace.template_reference,
    template_fidelity_status: workspace.template_fidelity_status,
    figures: structuredClone(workspace.figures), tables: structuredClone(workspace.tables),
    uploaded_image_references: workspace.figures.flatMap(({ uploaded_asset_reference }) => uploaded_asset_reference ? [uploaded_asset_reference] : []),
    caption_overrides: Object.fromEntries([
      ...workspace.figures.filter(({ caption_override }) => caption_override.trim()).map(({ figure_id, caption_override }) => [figure_id, caption_override]),
      ...workspace.tables.filter(({ caption_override }) => caption_override.trim()).map(({ table_id, caption_override }) => [table_id, caption_override]),
    ]),
    source_input_hash: hashSource({ bundle, figures: workspace.figures, tables: workspace.tables }),
    file_name: safeReportFileName(bundle.project.title),
  };
}

export function isReportSnapshotStale(snapshot: ReportSnapshot, bundle: ProjectBundle) {
  return snapshot.project_revision !== bundle.revision.id
    || snapshot.geometry_revision !== bundle.geometry.revision_id
    || snapshot.material_revision !== bundle.materials.revision_id
    || snapshot.load_revision !== bundle.loads.revision_id
    || snapshot.seismic_revision !== bundle.seismic.revision_id
    || snapshot.registry_version !== bundle.revision.registry_version
    || snapshot.combination_registry_version !== bundle.loads.combination_registry_version;
}

export type AssumptionParameter = {
  category: "Material" | "Pembebanan" | "Seismik";
  parameter: string;
  value: string;
  standard_ref: string;
  status: "DEFAULT_SNI" | "OVERRIDE_USER";
  note: string;
};

export function deriveAssumptionsAndDefaults(bundle: ProjectBundle): AssumptionParameter[] {
  const items: AssumptionParameter[] = [];

  // 1. Material - Berat jenis beton bertulang
  const density = bundle.materials.concrete.density.value;
  const isDefaultDensity = density === 2400;
  items.push({
    category: "Material",
    parameter: "Berat jenis beton (Density)",
    value: `${density ?? "—"} kg/m³`,
    standard_ref: "TODO: verifikasi pasal (SNI 1727:2020 Tabel C3.1-2)",
    status: isDefaultDensity ? "DEFAULT_SNI" : "OVERRIDE_USER",
    note: isDefaultDensity ? "TODO: verifikasi tabel berat jenis beton bertulang (2.400 kg/m³)" : "Nilai disesuaikan oleh pengguna",
  });

  // 2. Material - Selimut beton (Cover)
  const cover = bundle.materials.concrete.cover.value;
  const isDefaultCover = cover === 40;
  const coverElement = cover === 40 ? "Balok / Kolom" : cover === 20 ? "Pelat / Dinding" : cover === 75 ? "Fondasi (kontak tanah permanen)" : "Komponen struktur umum";
  const coverExposure = cover === 75 ? "Dicor dan kontak permanen tanah" : cover === 50 ? "Terpapar cuaca langsung (D19–D57)" : "Tidak terpapar cuaca langsung / kontak tanah";
  items.push({
    category: "Material",
    parameter: `Tebal selimut beton (Cover: ${cover ?? "—"} mm)`,
    value: `${cover ?? "—"} mm · ${coverElement} · ${coverExposure}`,
    standard_ref: "SNI 2847:2019 Tabel 20.6.1.3.1 hlm. 460 (PDF hlm. 482)",
    status: isDefaultCover ? "DEFAULT_SNI" : "OVERRIDE_USER",
    note: `Elemen: ${coverElement}; Kondisi paparan: ${coverExposure}`,
  });

  // 3. Material - Tulangan transversal fys
  const fys = bundle.materials.transverse_rebar.fys.value;
  const fy = bundle.materials.longitudinal_rebar.fy.value;
  const expectedDefaultFys = Math.min(fy ?? 420, 420);
  const isDefaultFys = fys === expectedDefaultFys;
  items.push({
    category: "Material",
    parameter: "Kuat leleh tulangan transversal (fys)",
    value: `${fys ?? "—"} MPa`,
    standard_ref: "SNI 2847:2019 Tabel 20.2.2.4a hlm. 450 (PDF hlm. 472)",
    status: isDefaultFys ? "DEFAULT_SNI" : "OVERRIDE_USER",
    note: fys && fys > 420 ? "Melebihi batas izin geser (Maksimal 420 MPa)" : isDefaultFys ? "Mengikuti kuat leleh utama dengan batas izin geser 420 MPa" : "Nilai disesuaikan manual oleh pengguna",
  });

  // 4. Pembebanan - Beban Hidup
  const liveDef = bundle.loads.definitions.find((d) => d.category === "LIVE");
  if (liveDef) {
    const isLiveFromPreset = liveDef.source.includes("SNI 1727:2020");
    items.push({
      category: "Pembebanan",
      parameter: `Beban hidup (${liveDef.name})`,
      value: `${liveDef.value ?? "—"} ${liveDef.unit}`,
      standard_ref: liveDef.source || "SNI 1727:2020 Tabel 4.3-1 hlm. 26 (PDF hlm. 58)",
      status: isLiveFromPreset ? "DEFAULT_SNI" : "OVERRIDE_USER",
      note: liveDef.assumption || "Beban hidup seragam area lantai hunian/kantor",
    });
  }

  // 5. Pembebanan - Beban Mati Tambahan (SIDL / Partisi)
  const sidlDef = bundle.loads.definitions.find((d) => d.category === "SUPERIMPOSED_DEAD");
  if (sidlDef) {
    const isSidlFromPreset = sidlDef.source.includes("SNI 1727:2020");
    items.push({
      category: "Pembebanan",
      parameter: `Beban mati tambahan (${sidlDef.name})`,
      value: `${sidlDef.value ?? "—"} ${sidlDef.unit}`,
      standard_ref: sidlDef.source || "SNI 1727:2020 Pasal 3.1.2 hlm. 17 (PDF hlm. 49)",
      status: isSidlFromPreset ? "DEFAULT_SNI" : "OVERRIDE_USER",
      note: sidlDef.assumption || "Finishing spesi dan partisi dinding",
    });
  }

  // 6. Pembebanan - Faktor Berat Seismik W
  const swFactorsMatch = bundle.loads.definitions.every((d) => {
    if (d.category === "SELF_WEIGHT" || d.category === "SUPERIMPOSED_DEAD") return d.seismic_weight_factor === 1.0;
    if (d.category === "LIVE" || d.category === "ROOF_LIVE" || d.category === "WIND" || d.category === "RAIN") return d.seismic_weight_factor === 0.0;
    return true;
  });
  items.push({
    category: "Pembebanan",
    parameter: "Faktor pengali berat seismik efektif (W)",
    value: "Mati: 1,0 · Hidup: 0,0",
    standard_ref: "SNI 1726:2019 Pasal 7.7.2 hlm. 68 (PDF hlm. 76)",
    status: swFactorsMatch ? "DEFAULT_SNI" : "OVERRIDE_USER",
    note: "100% beban mati, 0% beban hidup hunian/kantor tipikal",
  });

  // 7. Seismik - Koefisien Situs Fa
  const isSfClass = bundle.seismic.raw_inputs.site_class === "SF";
  const faSource = getCoefficientSourceLabel(bundle.seismic.input_provenance.fa?.source);
  const isFaManual = faSource !== "otomatis SNI";
  items.push({
    category: "Seismik",
    parameter: `Koefisien situs Fa [Sumber: ${faSource}]`,
    value: bundle.seismic.raw_inputs.fa !== null ? String(bundle.seismic.raw_inputs.fa) : "—",
    standard_ref: "SNI 1726:2019 Tabel 6 hlm. 34 (PDF hlm. 42)",
    status: isFaManual ? "OVERRIDE_USER" : "DEFAULT_SNI",
    note: isSfClass
      ? "PERINGATAN: Kelas situs SF wajib penyelidikan geoteknik spesifik-situs (SNI 1726:2019 Pasal 6.10.1)"
      : isFaManual
        ? faSource
        : "Interpolasi otomatis Tabel 6",
  });

  // 8. Seismik - Koefisien Situs Fv
  const fvSource = getCoefficientSourceLabel(bundle.seismic.input_provenance.fv?.source);
  const isFvManual = fvSource !== "otomatis SNI";
  items.push({
    category: "Seismik",
    parameter: `Koefisien situs Fv [Sumber: ${fvSource}]`,
    value: bundle.seismic.raw_inputs.fv !== null ? String(bundle.seismic.raw_inputs.fv) : "—",
    standard_ref: "SNI 1726:2019 Tabel 7 hlm. 34 (PDF hlm. 42)",
    status: isFvManual ? "OVERRIDE_USER" : "DEFAULT_SNI",
    note: isSfClass
      ? "PERINGATAN: Kelas situs SF wajib penyelidikan geoteknik spesifik-situs (SNI 1726:2019 Pasal 6.10.1)"
      : isFvManual
        ? fvSource
        : "Interpolasi otomatis Tabel 7",
  });

  // 9. Seismik - Kategori Risiko
  items.push({
    category: "Seismik",
    parameter: "Kategori Risiko Bangunan",
    value: `Kategori ${bundle.seismic.raw_inputs.risk_category}`,
    standard_ref: "SNI 1726:2019 Tabel 3 & Tabel 4 hlm. 24–25 (PDF hlm. 32–33)",
    status: "DEFAULT_SNI",
    note: "Menentukan faktor keutamaan gempa (Ie)",
  });

  return items;
}

