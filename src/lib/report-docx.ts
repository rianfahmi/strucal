import { deflateSync } from "node:zlib";
import { createEtabsHandoff } from "./etabs-handoff.ts";
import { spacingsFromOrdinates } from "./geometry.ts";
import type { ProjectBundle } from "./projects.ts";
import type { ReportAsset, ReportFigure, ReportSnapshot } from "./report.ts";

export type ReportGenerationInput = { bundle: ProjectBundle; snapshot: ReportSnapshot; assets: ReportAsset[] };
type TableData = { id: string; headers: string[]; rows: (string | number | null | undefined)[][] };
type Media = { id: string; name: string; contentType: string; data: Uint8Array };

const encoder = new TextEncoder();
const xml = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
const fixed = (value: number | null | undefined, unit = "") => value === null || value === undefined ? "—" : `${Number(value.toFixed(3))}${unit ? ` ${unit}` : ""}`;

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function join(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

function zip(files: { name: string; data: Uint8Array }[]) {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const localHeader = join([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(file.data.length), u32(file.data.length), u16(name.length), u16(0), name]);
    local.push(localHeader, file.data);
    central.push(join([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(file.data.length), u32(file.data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += localHeader.length + file.data.length;
  }
  const directory = join(central);
  return join([...local, directory, u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(directory.length), u32(offset), u16(0)]);
}

function paragraph(text: string, style?: string, options: { align?: "center" | "both" | "right"; pageBreakBefore?: boolean; bold?: boolean } = {}) {
  const properties = [style ? `<w:pStyle w:val="${style}"/>` : "", options.align ? `<w:jc w:val="${options.align}"/>` : "", options.pageBreakBefore ? "<w:pageBreakBefore/>" : ""].join("");
  return `<w:p><w:pPr>${properties}</w:pPr><w:r>${options.bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
}

function field(instruction: string, display: string) {
  return `<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> ${xml(instruction)} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${xml(display)}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
}

function fieldParagraph(instruction: string, display: string) {
  return `<w:p><w:pPr><w:keepNext/></w:pPr>${field(instruction, display)}</w:p>`;
}

function caption(label: "Gambar" | "Tabel", title: string) {
  return `<w:p><w:pPr><w:pStyle w:val="Caption"/><w:jc w:val="center"/><w:keepNext/></w:pPr><w:r><w:t xml:space="preserve">${label} </w:t></w:r>${field(`SEQ ${label} \\* ARABIC`, "1")}<w:r><w:t xml:space="preserve"> ${xml(title)}</w:t></w:r></w:p>`;
}

function table(data: TableData) {
  const keepTogether = data.rows.length <= 4;
  const cell = (value: unknown, header = false, keepNext = false) => `<w:tc><w:tcPr><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar>${header ? "<w:shd w:fill=\"D9E2F3\"/>" : ""}</w:tcPr><w:p><w:pPr><w:spacing w:after="0"/>${keepNext ? "<w:keepNext/>" : ""}</w:pPr><w:r>${header ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t>${xml(value)}</w:t></w:r></w:p></w:tc>`;
  const row = (values: unknown[], header = false, keepNext = false) => `<w:tr><w:trPr><w:cantSplit/>${header ? "<w:tblHeader/>" : ""}</w:trPr>${values.map((value) => cell(value, header, keepNext)).join("")}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="autofit"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9D9D9"/><w:left w:val="single" w:sz="4" w:color="D9D9D9"/><w:bottom w:val="single" w:sz="4" w:color="D9D9D9"/><w:right w:val="single" w:sz="4" w:color="D9D9D9"/><w:insideH w:val="single" w:sz="4" w:color="D9D9D9"/><w:insideV w:val="single" w:sz="4" w:color="D9D9D9"/></w:tblBorders></w:tblPr>${row(data.headers, true, true)}${data.rows.map((values, index) => row(values, false, keepTogether && index < data.rows.length - 1)).join("")}</w:tbl>`;
}

function picture(media: Media, title: string, drawingId: number) {
  return `<w:p><w:pPr><w:jc w:val="center"/><w:keepNext/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="5486400" cy="3291840"/><wp:docPr id="${drawingId}" name="${xml(title)}" descr="${xml(title)}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${xml(media.name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${media.id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5486400" cy="3291840"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function tableData(bundle: ProjectBundle): TableData[] {
  const handoff = createEtabsHandoff(bundle);
  const result = handoff.result;
  const grids = (axis: "X" | "Y") => {
    const lines = axis === "X" ? bundle.geometry.grid_x : bundle.geometry.grid_y;
    const spacings = spacingsFromOrdinates(lines.map(({ ordinate }) => ordinate));
    return lines.map((line, index) => [line.label, fixed(line.ordinate, "m"), index ? fixed(spacings[index - 1], "m") : "—"]);
  };
  return [
    { id: "grid-x", headers: ["Grid", "Ordinat", "Jarak Sebelumnya"], rows: grids("X") },
    { id: "grid-y", headers: ["Grid", "Ordinat", "Jarak Sebelumnya"], rows: grids("Y") },
    { id: "story-data", headers: ["Story", "Tinggi", "Elevasi"], rows: bundle.geometry.stories.map((story) => [story.name, fixed(story.height, "m"), fixed(story.elevation, "m")]) },
    { id: "material-properties", headers: ["Material", "Mutu", "Nilai", "Provenance"], rows: [
      ["Beton", bundle.materials.concrete.grade, fixed(bundle.materials.concrete.fc.value, "MPa"), bundle.materials.concrete.fc.provenance],
      ["Berat jenis beton", bundle.materials.concrete.grade, fixed(bundle.materials.concrete.density.value, "kg/m³"), bundle.materials.concrete.density.provenance],
      ["Selimut beton", bundle.materials.concrete.grade, fixed(bundle.materials.concrete.cover.value, "mm"), bundle.materials.concrete.cover.provenance],
      ["Tulangan longitudinal", bundle.materials.longitudinal_rebar.grade, fixed(bundle.materials.longitudinal_rebar.fy.value, "MPa"), bundle.materials.longitudinal_rebar.fy.provenance],
      ["Tulangan transversal", bundle.materials.transverse_rebar.grade, fixed(bundle.materials.transverse_rebar.fys.value, "MPa"), bundle.materials.transverse_rebar.fys.provenance],
    ] },
    { id: "load-summary", headers: ["Nama", "Kategori", "Nilai", "Sumber", "Faktor W"], rows: handoff.patterns.map((load) => [load.name, load.categoryLabel, fixed(load.value, load.unit), load.source, load.seismic_weight_factor]) },
    { id: "load-assignments", headers: ["Load", "Target", "Aplikasi", "Asumsi"], rows: handoff.assignments.map((assignment) => [assignment.definition?.name ?? assignment.load_id, assignment.target?.label ?? assignment.target_id, assignment.application, assignment.assumption]) },
    { id: "seismic-parameters", headers: ["Parameter", "Nilai", "Sumber"], rows: [
      ["Kelas situs", handoff.rawSeismic.site_class, handoff.inputProvenance.site_class.source], ["Kategori risiko", handoff.rawSeismic.risk_category, "M6"],
      ["Ss", fixed(handoff.rawSeismic.ss, "g"), handoff.inputProvenance.ss.source], ["S1", fixed(handoff.rawSeismic.s1, "g"), handoff.inputProvenance.s1.source],
      ["TL", fixed(handoff.rawSeismic.tl, "s"), handoff.inputProvenance.tl.source], ["Fa", fixed(handoff.rawSeismic.fa), handoff.inputProvenance.fa.source], ["Fv", fixed(handoff.rawSeismic.fv), handoff.inputProvenance.fv.source],
    ] },
    { id: "seismic-results", headers: ["Hasil", "Nilai", "Formula / Referensi"], rows: result ? [
      ["SDS", fixed(result.spectrum?.sds.value, "g"), result.spectrum?.sds.formula_id], ["SD1", fixed(result.spectrum?.sd1.value, "g"), result.spectrum?.sd1.formula_id],
      ["KDS", result.kds_review?.governing_kds, result.kds_review?.standard_ref], ["Sistem struktur", handoff.selectedSystem?.label, handoff.selectedSystem?.standard_ref],
      ["Periode digunakan", fixed(result.period?.used.value, "s"), result.period?.used.formula_id], ["Cs", fixed(result.response_coefficient?.governing.value), result.response_coefficient?.governing.formula_id],
      ["Berat seismik", fixed(result.seismic_weight?.value, "kN"), result.seismic_weight?.formula_id], ["Geser dasar", fixed(result.base_shear?.value, "kN"), result.base_shear?.formula_id],
    ] : [["Hasil M6", "Tidak tersedia", "BLOCKED"]] },
    { id: "story-forces", headers: ["Story", "Elevasi", "W", "Cvx", "Fx"], rows: result?.story_forces.map((row) => [row.story, fixed(row.elevation, "m"), fixed(row.weight, "kN"), fixed(row.cvx.value), fixed(row.force.value, "kN")]) ?? [] },
    { id: "etabs-patterns", headers: ["Nama", "Kategori", "Nilai", "Assignment"], rows: handoff.patterns.map((item) => [item.name, item.categoryLabel, fixed(item.value, item.unit), item.assignmentCount]) },
    { id: "etabs-cases", headers: ["Nama", "Kategori", "Sumber", "Status Setup"], rows: handoff.loadCases.map((item) => [item.name, item.category, item.source, "Ditetapkan di ETABS"]) },
    { id: "load-combinations", headers: ["ID", "Kombinasi", "Referensi"], rows: handoff.combinations.length ? handoff.combinations.map((item) => [item.id, item.expression, item.standard_ref]) : [["REFERENCE", "Belum dimuat dari dokumen referensi", handoff.combinationNote]] },
    { id: "etabs-readiness", headers: ["Item", "Status", "Klasifikasi", "Keterangan"], rows: handoff.readiness.map((item) => [item.label, item.status, item.classification, item.detail]) },
  ];
}

function pngChunk(type: string, data: Uint8Array) {
  const kind = encoder.encode(type);
  return join([u32be(data.length), kind, data, u32be(crc32(join([kind, data])))]);
}

function u32be(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function renderSystemFigure(figureId: string, bundle: ProjectBundle) {
  const width = 1000;
  const height = 600;
  const pixels = new Uint8Array(width * height * 4).fill(255);
  const set = (x: number, y: number, color: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = (Math.round(y) * width + Math.round(x)) * 4;
    [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]] = [...color, 255];
  };
  const line = (x0: number, y0: number, x1: number, y1: number, color: [number, number, number] = [35, 90, 76], thickness = 3) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let step = 0; step <= steps; step += 1) {
      const x = x0 + (x1 - x0) * step / steps;
      const y = y0 + (y1 - y0) * step / steps;
      for (let dx = -thickness; dx <= thickness; dx += 1) for (let dy = -thickness; dy <= thickness; dy += 1) set(x + dx, y + dy, color);
    }
  };
  const normalized = (values: number[], start: number, size: number) => {
    const min = Math.min(...values);
    const span = Math.max(Math.max(...values) - min, 1);
    return values.map((value) => start + (value - min) / span * size);
  };
  if (figureId === "plan-grid") {
    const xs = normalized(bundle.geometry.grid_x.map(({ ordinate }) => ordinate), 130, 740);
    const ys = normalized(bundle.geometry.grid_y.map(({ ordinate }) => ordinate), 90, 420);
    for (const x of xs) line(x, 70, x, 530);
    for (const y of ys) line(100, y, 900, y);
  } else if (figureId === "story-elevation") {
    const levels = normalized(bundle.geometry.stories.map(({ elevation }) => elevation), 510, -420);
    for (const y of levels) line(150, y, 850, y);
    line(250, 70, 250, 530); line(750, 70, 750, 530);
  } else if (figureId === "model-3d") {
    const levels = normalized(bundle.geometry.stories.map(({ elevation }) => elevation), 500, -340);
    for (const y of levels) {
      line(270, y, 650, y); line(650, y, 790, y - 80); line(790, y - 80, 410, y - 80); line(410, y - 80, 270, y);
    }
    for (const [x, offset] of [[270, 0], [650, 0], [790, -80], [410, -80]] as const) line(x, levels[0] + offset, x, levels.at(-1)! + offset);
  } else {
    const points = createEtabsHandoff(bundle).spectrum;
    line(100, 60, 100, 520, [90, 100, 96], 2); line(100, 520, 920, 520, [90, 100, 96], 2);
    if (points.length) {
      const maxX = Math.max(...points.map(({ period }) => period), 1);
      const maxY = Math.max(...points.map(({ acceleration }) => acceleration.value), 1);
      points.slice(1).forEach((point, index) => {
        const previous = points[index];
        line(100 + previous.period / maxX * 820, 520 - previous.acceleration.value / maxY * 420, 100 + point.period / maxX * 820, 520 - point.acceleration.value / maxY * 420, [35, 90, 76], 2);
      });
    }
  }
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    raw.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width, false); view.setUint32(4, height, false); header.set([8, 6, 0, 0, 0], 8);
  return join([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", new Uint8Array())]);
}

function mediaFor(input: ReportGenerationInput) {
  const assets = new Map(input.assets.map((asset) => [asset.asset_id, asset]));
  const media: { figure: ReportFigure; media: Media }[] = [];
  let index = 1;
  for (const figure of input.snapshot.figures) {
    const asset = figure.uploaded_asset_reference ? assets.get(figure.uploaded_asset_reference) : null;
    if (!asset && !figure.system_image_source) continue;
    const match = asset?.data_url.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
    if (asset && !match) continue;
    const contentType = match?.[1] ?? "image/png";
    const data = match ? Uint8Array.from(Buffer.from(match[2], "base64")) : renderSystemFigure(figure.figure_id, input.bundle);
    media.push({ figure, media: { id: `rIdImage${index}`, name: `figure-${index}.${contentType === "image/jpeg" ? "jpg" : "png"}`, contentType, data } });
    index += 1;
  }
  return media;
}

export function generateReportDocx(input: ReportGenerationInput) {
  const { bundle, snapshot } = input;
  const handoff = createEtabsHandoff(bundle);
  if (handoff.status !== "READY") throw new Error("M7 readiness harus READY sebelum Generate #1.");
  if (snapshot.project_revision !== bundle.revision.id) throw new Error("Snapshot tidak sesuai dengan revisi proyek aktif.");
  const tables = new Map(tableData(bundle).map((entry) => [entry.id, entry]));
  const media = mediaFor(input);
  const figures = new Map(media.map((entry) => [entry.figure.figure_id, entry]));
  const tableMeta = new Map(snapshot.tables.map((entry) => [entry.table_id, entry]));
  const blocks: string[] = [];
  const addTable = (id: string) => { const data = tables.get(id); const meta = tableMeta.get(id); if (data && meta) blocks.push(caption("Tabel", meta.effective_caption), table(data), paragraph("")); };
  const addFigure = (id: string) => { const entry = figures.get(id); const meta = snapshot.figures.find((figure) => figure.figure_id === id); if (entry && meta) blocks.push(picture(entry.media, meta.effective_caption, media.indexOf(entry) + 1), caption("Gambar", meta.effective_caption)); };
  const chapter = (title: string) => blocks.push(paragraph(title, "Heading1", { pageBreakBefore: true, align: "center" }));
  const section = (title: string) => blocks.push(paragraph(title, "Heading2"));

  blocks.push(paragraph("LAPORAN PERHITUNGAN STRUKTUR BETON BERTULANG", "Title", { align: "center" }), paragraph(bundle.project.title.toUpperCase(), "Subtitle", { align: "center" }), paragraph(""), paragraph(`Lokasi: ${bundle.project.location || "—"}`, undefined, { align: "center" }), paragraph(`Pemilik: ${bundle.project.owner || "—"}`, undefined, { align: "center" }), paragraph(`Fungsi bangunan: ${bundle.project.function || "—"}`, undefined, { align: "center" }), paragraph(""), paragraph(`Generate #1 · Revisi ${bundle.revision.revision_number}`, undefined, { align: "center" }), paragraph(new Date(snapshot.generated_at).toLocaleDateString("id-ID"), undefined, { align: "center" }));
  blocks.push(paragraph("DAFTAR ISI", "FrontHeading", { pageBreakBefore: true, align: "center" }), fieldParagraph('TOC \\o "1-3" \\h \\z \\u', "Perbarui field untuk menampilkan daftar isi."));
  blocks.push(paragraph("DAFTAR GAMBAR", "FrontHeading", { pageBreakBefore: true, align: "center" }), fieldParagraph('TOC \\h \\z \\c "Gambar"', "Perbarui field untuk menampilkan daftar gambar."));
  blocks.push(paragraph("DAFTAR TABEL", "FrontHeading", { pageBreakBefore: true, align: "center" }), fieldParagraph('TOC \\h \\z \\c "Tabel"', "Perbarui field untuk menampilkan daftar tabel."));

  chapter("BAB I PENDAHULUAN");
  section("1.1 Data Perencanaan");
  blocks.push(paragraph(`Laporan ini menyajikan data perencanaan awal struktur beton bertulang untuk ${bundle.project.title}. Tahap ini mencakup geometri, material, pembebanan, perhitungan seismik, dan data handoff untuk pemodelan ETABS.`, undefined, { align: "both" }));
  section("1.2 Data Bangunan");
  blocks.push(paragraph(`Bangunan berfungsi sebagai ${bundle.project.function || "bangunan sesuai data proyek"} dan berlokasi di ${bundle.project.location || "lokasi sesuai data proyek"}. Data pada laporan ini terikat pada revisi proyek ${bundle.revision.revision_number}.`, undefined, { align: "both" }));
  section("1.3 Data Struktur dan Gambar Rencana");
  blocks.push(paragraph("Sistem struktur menggunakan beton bertulang. Susunan grid dan tingkat berikut menjadi dasar geometri untuk pemodelan struktur.", undefined, { align: "both" }));
  addTable("grid-x"); addTable("grid-y"); addTable("story-data"); addFigure("plan-grid"); addFigure("story-elevation"); addFigure("model-3d");
  section("1.4 Dasar Perencanaan dan Peraturan");
  blocks.push(paragraph(`Standar aktif pada revisi proyek adalah ${bundle.revision.registry_version.replaceAll("|", " · ")}. Perhitungan seismik dan material menggunakan registry aktif yang tercatat pada snapshot. Referensi kombinasi beban disajikan khusus untuk dokumentasi dan setup ETABS.`, undefined, { align: "both" }));

  chapter("BAB II MATERIAL DAN PEMBEBANAN");
  section("2.1 Material Struktur");
  blocks.push(paragraph("Properti material berikut berasal dari modul material proyek aktif. Nilai dan provenance dipertahankan untuk penelusuran data.", undefined, { align: "both" })); addTable("material-properties");
  section("2.2 Pembebanan");
  blocks.push(paragraph("Beban mati, beban hidup, beban hidup atap, angin, dan hujan dicatat sesuai asumsi serta sumber pada modul pembebanan. Assignment menunjukkan target penerapan pada geometri aktif.", undefined, { align: "both" })); addTable("load-summary"); addTable("load-assignments");
  section("2.3 Analisis Beban Gempa");
  blocks.push(paragraph("Parameter seismik, hasil spektrum, gaya geser dasar, dan distribusi gaya tingkat dihasilkan oleh M6 dari input serta registry aktif. ETABS tetap menjadi mesin analisis struktur eksternal.", undefined, { align: "both" })); addTable("seismic-parameters"); addTable("seismic-results"); addFigure("response-spectrum"); addTable("story-forces");

  chapter("BAB III PERMODELAN STRUKTUR");
  section("3.1 Data Model");
  blocks.push(paragraph("Data grid, story, material, dan beban pada bab ini merupakan paket handoff untuk pembentukan model ETABS. Gambar ETABS hanya dicantumkan bila pengguna mengunggah bukti proyek yang sesuai.", undefined, { align: "both" })); addFigure("etabs-grid-reference");
  section("3.2 Referensi Beban dan Kombinasi");
  blocks.push(paragraph("Load pattern dan load case berikut disiapkan sebagai referensi setup manual. Kombinasi beban merupakan konten laporan dan referensi ETABS; StruCal tidak menghitung respons struktur dari kombinasi tersebut.", undefined, { align: "both" })); addTable("etabs-patterns"); addTable("etabs-cases"); addTable("load-combinations");
  section("3.3 Ringkasan Handoff ETABS");
  blocks.push(paragraph("Checklist berikut mencatat kesiapan data dan item yang tetap menjadi tanggung jawab engineer saat membangun serta memverifikasi model ETABS. Laporan berhenti pada tahap pra-analisis dan tidak memuat hasil analisis ETABS.", undefined, { align: "both" })); addTable("etabs-readiness");

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${blocks.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1701" w:right="1701" w:bottom="1701" w:left="2268" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:before="3600" w:after="240"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:pPr><w:spacing w:after="960"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="FrontHeading"><w:name w:val="Front Heading"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="240"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="240"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="100" w:after="160"/><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr></w:style></w:styles>`;
  const rels = media.map(({ media: item }) => `<Relationship Id="${item.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${item.name}"/>`).join("");
  const files = [
    { name: "[Content_Types].xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`) },
    { name: "_rels/.rels", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`) },
    { name: "word/document.xml", data: encoder.encode(document) },
    { name: "word/styles.xml", data: encoder.encode(styles) },
    { name: "word/settings.xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/></w:settings>`) },
    { name: "word/_rels/document.xml.rels", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${rels}</Relationships>`) },
    { name: "docProps/core.xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(bundle.project.title)} Generate 1</dc:title><dc:creator>StruCal</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${xml(snapshot.generated_at)}</dcterms:created></cp:coreProperties>`) },
    { name: "docProps/app.xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>StruCal</Application></Properties>`) },
    ...media.map(({ media: item }) => ({ name: `word/media/${item.name}`, data: item.data })),
  ];
  return zip(files);
}
