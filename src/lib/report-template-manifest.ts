export type TemplateBehavior = "KEEP" | "REPLACE" | "REMOVE_SUBSTITUTE" | "REMOVE";

export type TemplateSectionMap = {
  section_id: string;
  source_heading: string;
  source_style: "1BAB" | "2SUB-BAB" | "3SUB-BAB";
  behavior: TemplateBehavior;
  data_source: string;
};

export const REPORT_MASTER_FILE = "185.1. Laporan Bagian Depan(1).docx";
export const REPORT_MASTER_SHA256 = "C9F19728FF480221327A3751FB0DA312DAD24838097E38C36CDCFF63256DE528";

export const REPORT_TEMPLATE_MANIFEST = {
  version: "M8.1-TEMPLATE-FIRST-1",
  strategy: "CLONE_PATCH" as const,
  master_file: REPORT_MASTER_FILE,
  body_anchor: { style: "1BAB", text: "BAB I PENDAHULUAN" },
  stop_anchor: { style: "2SUB-BAB", text: "Analysis Result/Output ETABS" },
  sections: [
    { section_id: "front", source_heading: "DAFTAR ISI", source_style: "1BAB", behavior: "KEEP", data_source: "Master Word fields" },
    { section_id: "1", source_heading: "BAB I PENDAHULUAN", source_style: "1BAB", behavior: "REPLACE", data_source: "Project, geometry" },
    { section_id: "1.1", source_heading: "Data Perencanaan", source_style: "2SUB-BAB", behavior: "KEEP", data_source: "Engineering narrative" },
    { section_id: "1.2", source_heading: "Data Bangunan", source_style: "2SUB-BAB", behavior: "REPLACE", data_source: "Project" },
    { section_id: "1.2.1", source_heading: "Data Struktur", source_style: "3SUB-BAB", behavior: "REPLACE", data_source: "Geometry" },
    { section_id: "1.2.2", source_heading: "Gambar Rencana", source_style: "3SUB-BAB", behavior: "REPLACE", data_source: "System or uploaded figures" },
    { section_id: "1.3", source_heading: "Diagram Alir Perencanaan", source_style: "2SUB-BAB", behavior: "KEEP", data_source: "Engineering narrative" },
    { section_id: "1.4", source_heading: "Dasar-Dasar Perencanaan", source_style: "2SUB-BAB", behavior: "KEEP", data_source: "Engineering narrative" },
    { section_id: "2", source_heading: "BAB II MATERIAL DAN PEMBEBANAN", source_style: "1BAB", behavior: "REPLACE", data_source: "Materials, loads, seismic" },
    { section_id: "2.1", source_heading: "Konsep Perancangan Struktur Baja Tahan Gempa", source_style: "2SUB-BAB", behavior: "REMOVE_SUBSTITUTE", data_source: "Reinforced-concrete narrative" },
    { section_id: "2.2", source_heading: "Material Properties", source_style: "2SUB-BAB", behavior: "REPLACE", data_source: "Materials" },
    { section_id: "2.3", source_heading: "Pembebanan", source_style: "2SUB-BAB", behavior: "REPLACE", data_source: "Loads" },
    { section_id: "2.3.6", source_heading: "Beban Gempa", source_style: "3SUB-BAB", behavior: "REPLACE", data_source: "Seismic calculation" },
    { section_id: "2.3.7", source_heading: "Analisis Beban Gempa", source_style: "3SUB-BAB", behavior: "REMOVE", data_source: "Stage 2 ETABS results" },
    { section_id: "3", source_heading: "BAB III PERMODELAN STRUKTUR", source_style: "1BAB", behavior: "REPLACE", data_source: "ETABS handoff" },
    { section_id: "3.1", source_heading: "Model Struktur dengan ETABS", source_style: "2SUB-BAB", behavior: "KEEP", data_source: "Engineering narrative" },
    { section_id: "3.1.2", source_heading: "Pembuatan Grid", source_style: "3SUB-BAB", behavior: "REPLACE", data_source: "Geometry" },
    { section_id: "3.2", source_heading: "Permodelan Balok", source_style: "2SUB-BAB", behavior: "REMOVE_SUBSTITUTE", data_source: "Material and section handoff" },
    { section_id: "3.3", source_heading: "Permodelan Kolom", source_style: "2SUB-BAB", behavior: "REMOVE_SUBSTITUTE", data_source: "Material and section handoff" },
    { section_id: "3.4", source_heading: "Permodelan Perletakan Pondasi", source_style: "2SUB-BAB", behavior: "REPLACE", data_source: "ETABS responsibility" },
    { section_id: "3.5", source_heading: "Pembuatan Load Pattern", source_style: "2SUB-BAB", behavior: "REPLACE", data_source: "Load definitions" },
    { section_id: "3.6", source_heading: "Aplikasi Beban pada Struktur Melalui ETABS", source_style: "2SUB-BAB", behavior: "REPLACE", data_source: "Load assignments" },
    { section_id: "3.7", source_heading: "Kombinasi Beban", source_style: "2SUB-BAB", behavior: "KEEP", data_source: "Master COMB 1–28 reference" },
    { section_id: "3.8", source_heading: "Analysis Result/Output ETABS", source_style: "2SUB-BAB", behavior: "REMOVE", data_source: "Stage 2" },
  ] satisfies TemplateSectionMap[],
  table_exemplars: {
    standard: "Tabel 15 Spacing Grid Arah X",
    wide: "Tabel 14 Kontrol Perbandingan Gaya Gempa Dinamik dengan Gaya Gempa Statik",
    combinations: "Kombinasi pembebanan yang dipakai pada struktur dalam laporan ini",
  },
  figures: {
    "plan-grid": { source_caption: "Gambar 30 Grid yang telah dibuat", example: "/report-reference/grid-system-example.png" },
    "story-elevation": { source_caption: "Gambar 29 Pengaturan story data", example: "/report-reference/story-data-example.png" },
    "model-3d": { source_caption: "Gambar 31 Perspektif Model Struktur 3D", example: "/report-reference/model-3d-example.png" },
    "response-spectrum": { source_caption: "Gambar 22 Respons spectrum", example: "/report-reference/response-spectrum-example.png" },
    "etabs-grid-reference": { source_caption: "Gambar 28 Pengaturan Ordinat Grid Arah X dan Y", example: "/report-reference/grid-system-example.png" },
    "etabs-material-reference": { source_caption: "Gambar 32 Define", example: null },
    "etabs-restraint-reference": { source_caption: "Gambar 40 Permodelan sistem pondasi", example: "/report-reference/restraint-example.png" },
    "etabs-load-pattern-reference": { source_caption: "Gambar 41 Load Patterns Definition", example: "/report-reference/load-pattern-example.png" },
    "etabs-load-assignment-reference": { source_caption: "Gambar 44 Atur besaran beban", example: "/report-reference/load-assignment-example.png" },
    "etabs-load-case-reference": { source_caption: "Gambar 42 Input Load Cases", example: "/report-reference/load-case-example.png" },
    "etabs-combination-reference": { source_caption: "Gambar 45 Input Load Combination", example: "/report-reference/load-combination-example.png" },
  },
  equations: ["SMS", "SM1", "SDS", "SD1", "T0", "Ts", "Ta", "Tmax", "Cs", "V"],
} as const;
