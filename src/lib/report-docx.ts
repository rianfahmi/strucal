import { deflateSync } from "node:zlib";
import { createEtabsHandoff } from "./etabs-handoff.ts";
import { spacingsFromOrdinates } from "./geometry.ts";
import type { LoadCategory } from "./loads.ts";
import type { ProjectBundle } from "./projects.ts";
import type { ReportAsset, ReportFigure, ReportSnapshot } from "./report.ts";

export type ReportGenerationInput = { bundle: ProjectBundle; snapshot: ReportSnapshot; assets: ReportAsset[] };
type TableData = { id: string; headers: string[]; rows: (string | number | null | undefined)[][] };
type Media = { id: string; name: string; contentType: string; data: Uint8Array };

const encoder = new TextEncoder();
const xml = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
const fixed = (value: number | null | undefined, unit = "") => value === null || value === undefined ? "—" : `${Number(value.toFixed(4))}${unit ? ` ${unit}` : ""}`;

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function integer(value: number, bytes: 2 | 4, littleEndian = true) {
  const output = new Uint8Array(bytes);
  const view = new DataView(output.buffer);
  if (bytes === 2) view.setUint16(0, value, littleEndian); else view.setUint32(0, value, littleEndian);
  return output;
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
    const localHeader = join([integer(0x04034b50, 4), integer(20, 2), integer(0x0800, 2), integer(0, 2), integer(0, 2), integer(0, 2), integer(crc, 4), integer(file.data.length, 4), integer(file.data.length, 4), integer(name.length, 2), integer(0, 2), name]);
    local.push(localHeader, file.data);
    central.push(join([integer(0x02014b50, 4), integer(20, 2), integer(20, 2), integer(0x0800, 2), integer(0, 2), integer(0, 2), integer(0, 2), integer(crc, 4), integer(file.data.length, 4), integer(file.data.length, 4), integer(name.length, 2), integer(0, 2), integer(0, 2), integer(0, 2), integer(0, 2), integer(0, 4), integer(offset, 4), name]));
    offset += localHeader.length + file.data.length;
  }
  const directory = join(central);
  return join([...local, directory, integer(0x06054b50, 4), integer(0, 2), integer(0, 2), integer(files.length, 2), integer(files.length, 2), integer(directory.length, 4), integer(offset, 4), integer(0, 2)]);
}

function paragraph(text: string, style = "Normal", options: { align?: "center" | "both" | "right" | "left"; pageBreakBefore?: boolean; bold?: boolean; italic?: boolean; keepNext?: boolean; firstLine?: boolean } = {}) {
  const properties = [`<w:pStyle w:val="${style}"/>`, options.align ? `<w:jc w:val="${options.align}"/>` : "", options.pageBreakBefore ? "<w:pageBreakBefore/>" : "", options.keepNext ? "<w:keepNext/>" : "", options.firstLine === false ? '<w:ind w:firstLine="0"/>' : ""].join("");
  const run = options.bold || options.italic ? `<w:rPr>${options.bold ? "<w:b/>" : ""}${options.italic ? "<w:i/>" : ""}</w:rPr>` : "";
  const content = text.split("\n").map((line) => `<w:t xml:space="preserve">${xml(line)}</w:t>`).join("<w:br/>");
  return `<w:p><w:pPr>${properties}</w:pPr><w:r>${run}${content}</w:r></w:p>`;
}

function field(instruction: string, display: string) {
  return `<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> ${xml(instruction)} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${xml(display)}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
}

function fieldParagraph(instruction: string, display: string) {
  return `<w:p><w:pPr><w:keepNext/><w:ind w:firstLine="0"/></w:pPr>${field(instruction, display)}</w:p>`;
}

function caption(label: "Gambar" | "Tabel", title: string) {
  return `<w:p><w:pPr><w:pStyle w:val="Caption"/><w:jc w:val="center"/><w:keepNext/><w:ind w:firstLine="0"/></w:pPr><w:r><w:t xml:space="preserve">${label} </w:t></w:r>${field(`SEQ ${label} \\* ARABIC`, "1")}<w:r><w:t xml:space="preserve"> ${xml(title)}</w:t></w:r></w:p>`;
}

function table(data: TableData) {
  const compact = data.id === "etabs-readiness";
  const padding = compact ? 35 : 70;
  const size = compact ? 16 : 20;
  const line = compact ? 190 : 240;
  const cell = (value: unknown, header = false) => `<w:tc><w:tcPr><w:tcMar><w:top w:w="${padding}" w:type="dxa"/><w:left w:w="${padding}" w:type="dxa"/><w:bottom w:w="${padding}" w:type="dxa"/><w:right w:w="${padding}" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:spacing w:after="0" w:line="${line}" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="${header ? "center" : "left"}"/></w:pPr><w:r><w:rPr>${header ? "<w:b/>" : ""}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p></w:tc>`;
  const row = (values: unknown[], header = false) => `<w:tr><w:trPr><w:cantSplit/>${header ? "<w:tblHeader/>" : ""}</w:trPr>${values.map((value) => cell(value, header)).join("")}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="autofit"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="000000"/><w:left w:val="single" w:sz="6" w:color="000000"/><w:bottom w:val="single" w:sz="6" w:color="000000"/><w:right w:val="single" w:sz="6" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:color="000000"/></w:tblBorders></w:tblPr>${row(data.headers, true)}${data.rows.map((values) => row(values)).join("")}</w:tbl>`;
}

function picture(media: Media, title: string, drawingId: number, width = 4389120, height = 2633472) {
  return `<w:p><w:pPr><w:jc w:val="center"/><w:keepNext/><w:ind w:firstLine="0"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width}" cy="${height}"/><wp:docPr id="${drawingId}" name="${xml(title)}" descr="${xml(title)}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${xml(media.name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${media.id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function placeholder(title: string) {
  return `<w:p><w:pPr><w:pBdr><w:top w:val="dashed" w:sz="4" w:color="7F7F7F"/><w:left w:val="dashed" w:sz="4" w:color="7F7F7F"/><w:bottom w:val="dashed" w:sz="4" w:color="7F7F7F"/><w:right w:val="dashed" w:sz="4" w:color="7F7F7F"/></w:pBdr><w:spacing w:before="360" w:after="360"/><w:jc w:val="center"/><w:ind w:firstLine="0"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="666666"/></w:rPr><w:t>${xml(`Slot dokumentasi: ${title} — unggah bukti dari model proyek untuk ditampilkan.`)}</w:t></w:r></w:p>`;
}

function sectionBreak(format: "none" | "lowerRoman" | "decimal", cover = false) {
  const footer = format === "none" ? "" : '<w:footerReference w:type="default" r:id="rIdFooter"/>';
  const numbering = format === "none" ? "" : `<w:pgNumType w:fmt="${format}" w:start="1"/>`;
  const margins = cover ? '<w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/>' : '<w:pgMar w:top="1701" w:right="1701" w:bottom="1701" w:left="2268" w:header="720" w:footer="720" w:gutter="0"/>';
  return `<w:p><w:pPr><w:sectPr>${footer}<w:type w:val="nextPage"/><w:pgSz w:w="11906" w:h="16838"/>${margins}${numbering}</w:sectPr></w:pPr></w:p>`;
}

function tableData(bundle: ProjectBundle): TableData[] {
  const handoff = createEtabsHandoff(bundle);
  const result = handoff.result;
  const grids = (axis: "X" | "Y") => {
    const lines = axis === "X" ? bundle.geometry.grid_x : bundle.geometry.grid_y;
    const spacings = spacingsFromOrdinates(lines.map(({ ordinate }) => ordinate));
    return lines.map((line, index) => [line.label, fixed(line.ordinate, "m"), index ? fixed(spacings[index - 1], "m") : "—"]);
  };
  const traces = (items: { label: string; trace: { value: number; unit: string; formula: string; substitution: string; standard_ref: string } | null | undefined }[]) => items.map(({ label, trace }) => [label, trace ? fixed(trace.value, trace.unit === "dimensionless" ? "" : trace.unit) : "—", trace?.formula ?? "—", trace?.substitution ?? "—", trace?.standard_ref ?? "—"]);
  return [
    { id: "project-data", headers: ["Data", "Keterangan"], rows: [["Nama proyek", bundle.project.title], ["Lokasi", bundle.project.location], ["Fungsi", bundle.project.function], ["Pemilik", bundle.project.owner], ["Revisi", bundle.revision.revision_number]] },
    { id: "grid-x", headers: ["Grid", "Ordinat", "Jarak Sebelumnya"], rows: grids("X") },
    { id: "grid-y", headers: ["Grid", "Ordinat", "Jarak Sebelumnya"], rows: grids("Y") },
    { id: "story-data", headers: ["Story", "Tinggi", "Elevasi"], rows: bundle.geometry.stories.map((story) => [story.name, fixed(story.height, "m"), fixed(story.elevation, "m")]) },
    { id: "material-properties", headers: ["Material", "Mutu", "Nilai", "Provenance"], rows: [
      ["Beton", bundle.materials.concrete.grade, fixed(bundle.materials.concrete.fc.value, "MPa"), bundle.materials.concrete.fc.provenance],
      ["Modulus elastis beton", bundle.materials.concrete.grade, fixed(bundle.materials.concrete.elastic_modulus.value, "MPa"), bundle.materials.concrete.elastic_modulus.formula_id],
      ["Berat jenis beton", bundle.materials.concrete.grade, fixed(bundle.materials.concrete.density.value, "kg/m³"), bundle.materials.concrete.density.provenance],
      ["Selimut beton", bundle.materials.concrete.grade, fixed(bundle.materials.concrete.cover.value, "mm"), bundle.materials.concrete.cover.provenance],
      ["Tulangan longitudinal", bundle.materials.longitudinal_rebar.grade, fixed(bundle.materials.longitudinal_rebar.fy.value, "MPa"), bundle.materials.longitudinal_rebar.fy.provenance],
      ["Tulangan transversal", bundle.materials.transverse_rebar.grade, fixed(bundle.materials.transverse_rebar.fys.value, "MPa"), bundle.materials.transverse_rebar.fys.provenance],
    ] },
    { id: "reinforcement-diameters", headers: ["ID", "Diameter Nominal", "Provenance"], rows: bundle.materials.available_diameters.map((item) => [item.id, fixed(item.nominal_diameter.value, "mm"), item.nominal_diameter.provenance]) },
    { id: "load-summary", headers: ["Nama", "Kategori", "Nilai", "Sumber", "Asumsi", "Faktor W"], rows: handoff.patterns.map((load) => [load.name, load.categoryLabel, fixed(load.value, load.unit), load.source, load.assumption, load.seismic_weight_factor]) },
    { id: "load-assignments", headers: ["Load", "Target", "Aplikasi", "Asumsi"], rows: handoff.assignments.map((assignment) => [assignment.definition?.name ?? assignment.load_id, assignment.target?.label ?? assignment.target_id, assignment.application, assignment.assumption]) },
    { id: "seismic-input-provenance", headers: ["Parameter", "Nilai", "Sumber", "Penginput", "Revisi"], rows: (["site_class", "ss", "s1", "tl", "fa", "fv"] as const).map((key) => [key.toUpperCase(), key === "site_class" ? handoff.rawSeismic[key] : fixed(handoff.rawSeismic[key], key === "tl" ? "s" : key === "ss" || key === "s1" ? "g" : ""), handoff.inputProvenance[key].source, handoff.inputProvenance[key].entered_by, handoff.inputProvenance[key].project_revision]) },
    { id: "seismic-spectrum", headers: ["Parameter", "Nilai", "Rumus", "Substitusi", "Referensi"], rows: result?.spectrum ? traces(Object.entries(result.spectrum).map(([label, trace]) => ({ label: label.toUpperCase(), trace }))) : [] },
    { id: "seismic-kds", headers: ["Pemeriksaan", "Input", "Hasil", "Substitusi", "Referensi"], rows: result?.kds_review?.checks.map((check) => [check.label, fixed(check.input_value, check.input_unit), `KDS ${check.result}`, check.substitution, check.standard_ref]) ?? [] },
    { id: "seismic-system", headers: ["Parameter", "Nilai", "Rumus / Klasifikasi", "Referensi"], rows: result?.system_parameters ? [
      ["Sistem terpilih", handoff.selectedSystem?.label, result.system_parameters.period_classification.label, handoff.selectedSystem?.standard_ref],
      ["R", fixed(result.system_parameters.R.value), result.system_parameters.R.formula, result.system_parameters.R.standard_ref],
      ["Ω₀", fixed(result.system_parameters.omega0.value), result.system_parameters.omega0.formula, result.system_parameters.omega0.standard_ref],
      ["Cd", fixed(result.system_parameters.Cd.value), result.system_parameters.Cd.formula, result.system_parameters.Cd.standard_ref],
      ["Ct", fixed(result.system_parameters.Ct.value), result.system_parameters.Ct.formula, result.system_parameters.Ct.standard_ref],
      ["x", fixed(result.system_parameters.x.value), result.system_parameters.x.formula, result.system_parameters.x.standard_ref],
    ] : [] },
    { id: "seismic-period", headers: ["Parameter", "Nilai", "Rumus", "Substitusi", "Referensi"], rows: result?.period ? traces([
      { label: "Ta", trace: result.period.ta }, { label: "Cu", trace: result.period.cu }, { label: "CuTa / Tmax", trace: result.period.tmax }, { label: "T analitis", trace: result.period.analytical_period }, { label: "T digunakan", trace: result.period.used },
    ]) : [] },
    { id: "seismic-cs", headers: ["Parameter", "Nilai", "Rumus", "Substitusi", "Referensi"], rows: result?.response_coefficient ? traces([
      { label: "Cs nominal", trace: result.response_coefficient.nominal }, { label: "Batas atas Cs", trace: result.response_coefficient.upper_bound },
      ...result.response_coefficient.lower_bounds.map((trace, index) => ({ label: `Batas bawah Cs ${index + 1}`, trace })), { label: "Cs menentukan", trace: result.response_coefficient.governing },
    ]) : [] },
    { id: "seismic-weight", headers: ["Story", "Berat Seismik"], rows: result ? handoff.stories.filter(({ order }) => order > 0).map((story) => [story.name, fixed(result.story_forces.find(({ story: name }) => name === story.name)?.weight, "kN")]) : [] },
    { id: "seismic-base-shear", headers: ["Hasil", "Nilai", "Rumus", "Substitusi", "Referensi"], rows: result ? [
      ["Berat seismik efektif, W", fixed(result.seismic_weight?.value, "kN"), result.seismic_weight?.formula, result.seismic_weight?.substitution, result.seismic_weight?.standard_ref],
      ["Koefisien respons, Cs", fixed(result.response_coefficient?.governing.value), result.response_coefficient?.governing.formula, result.response_coefficient?.governing.substitution, result.response_coefficient?.governing.standard_ref],
      ["Gaya geser dasar, V", fixed(result.base_shear?.value, "kN"), result.base_shear?.formula, result.base_shear?.substitution, result.base_shear?.standard_ref],
      ["Eksponen distribusi, k", fixed(result.story_exponent?.value), result.story_exponent?.formula, result.story_exponent?.substitution, result.story_exponent?.standard_ref],
    ] : [] },
    { id: "story-forces", headers: ["Story", "Elevasi", "W", "Cvx", "Fx", "Referensi"], rows: result?.story_forces.map((row) => [row.story, fixed(row.elevation, "m"), fixed(row.weight, "kN"), fixed(row.cvx.value), fixed(row.force.value, "kN"), row.force.standard_ref]) ?? [] },
    { id: "etabs-patterns", headers: ["Nama", "Kategori", "Nilai", "Assignment"], rows: handoff.patterns.map((item) => [item.name, item.categoryLabel, fixed(item.value, item.unit), item.assignmentCount]) },
    { id: "etabs-cases", headers: ["Nama", "Kategori", "Sumber", "Status Setup"], rows: handoff.loadCases.map((item) => [item.name, item.category, item.source, "Ditetapkan dan diverifikasi di ETABS"]) },
    { id: "load-combinations", headers: ["ID", "Kombinasi", "Referensi"], rows: handoff.combinations.length ? handoff.combinations.map((item) => [item.id, item.expression, item.standard_ref]) : [["REFERENCE", "Belum dimuat dari registry aktif", handoff.combinationNote]] },
    { id: "etabs-readiness", headers: ["Item", "Status", "Klasifikasi", "Keterangan"], rows: handoff.readiness.map((item) => [item.label, item.status, item.classification, item.detail]) },
  ];
}

function pngChunk(type: string, data: Uint8Array) {
  const kind = encoder.encode(type);
  return join([integer(data.length, 4, false), kind, data, integer(crc32(join([kind, data])), 4, false)]);
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
  const line = (x0: number, y0: number, x1: number, y1: number, color: [number, number, number] = [15, 104, 123], thickness = 2) => {
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
    for (const x of normalized(bundle.geometry.grid_x.map(({ ordinate }) => ordinate), 130, 740)) line(x, 70, x, 530);
    for (const y of normalized(bundle.geometry.grid_y.map(({ ordinate }) => ordinate), 90, 420)) line(100, y, 900, y);
  } else if (figureId === "story-elevation") {
    const levels = normalized(bundle.geometry.stories.map(({ elevation }) => elevation), 510, -420);
    for (const y of levels) line(150, y, 850, y);
    line(250, 70, 250, 530); line(750, 70, 750, 530);
  } else if (figureId === "model-3d") {
    const levels = normalized(bundle.geometry.stories.map(({ elevation }) => elevation), 500, -340);
    for (const y of levels) { line(270, y, 650, y); line(650, y, 790, y - 80); line(790, y - 80, 410, y - 80); line(410, y - 80, 270, y); }
    for (const [x, offset] of [[270, 0], [650, 0], [790, -80], [410, -80]] as const) line(x, levels[0] + offset, x, levels.at(-1)! + offset);
  } else {
    const points = createEtabsHandoff(bundle).spectrum;
    line(100, 60, 100, 520, [30, 30, 30]); line(100, 520, 920, 520, [30, 30, 30]);
    if (points.length) {
      const maxX = Math.max(...points.map(({ period }) => period), 1);
      const maxY = Math.max(...points.map(({ acceleration }) => acceleration.value), 1);
      points.slice(1).forEach((point, index) => {
        const previous = points[index];
        line(100 + previous.period / maxX * 820, 520 - previous.acceleration.value / maxY * 420, 100 + point.period / maxX * 820, 520 - point.acceleration.value / maxY * 420, [15, 104, 123]);
      });
    }
  }
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) { raw[y * (width * 4 + 1)] = 0; raw.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1); }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width, false); view.setUint32(4, height, false); header.set([8, 6, 0, 0, 0], 8);
  return join([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", new Uint8Array())]);
}

function mediaFor(input: ReportGenerationInput) {
  const assets = new Map(input.assets.map((asset) => [asset.asset_id, asset]));
  const media: { figure: ReportFigure; media: Media }[] = [];
  for (const figure of input.snapshot.figures) {
    const asset = figure.uploaded_asset_reference ? assets.get(figure.uploaded_asset_reference) : null;
    if (!asset && !figure.system_image_source) continue;
    const match = asset?.data_url.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
    if (asset && !match) continue;
    const contentType = match?.[1] ?? "image/png";
    const data = match ? Uint8Array.from(Buffer.from(match[2], "base64")) : renderSystemFigure(figure.figure_id, input.bundle);
    const index = media.length + 1;
    media.push({ figure, media: { id: `rIdImage${index}`, name: `figure-${index}.${contentType === "image/jpeg" ? "jpg" : "png"}`, contentType, data } });
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
  const figureMeta = new Map(snapshot.figures.map((entry) => [entry.figure_id, entry]));
  const blocks: string[] = [];
  const addTable = (id: string) => { const data = tables.get(id); const meta = tableMeta.get(id); if (data && meta) blocks.push(caption("Tabel", meta.effective_caption), table(data), paragraph("", "Normal", { firstLine: false })); };
  const addFigure = (id: string, showPlaceholder = false) => { const entry = figures.get(id); const meta = figureMeta.get(id); if (!meta) return; if (entry) blocks.push(picture(entry.media, meta.effective_caption, media.indexOf(entry) + 1), caption("Gambar", meta.effective_caption)); else if (showPlaceholder) blocks.push(placeholder(meta.effective_caption), paragraph("", "Normal", { firstLine: false })); };
  const chapter = (number: string, title: string) => blocks.push(paragraph(`BAB ${number}`, "Heading1", { pageBreakBefore: true, align: "center" }), paragraph(title, "ChapterTitle", { align: "center", keepNext: true }));
  const section = (number: string, title: string) => blocks.push(paragraph(`${number}.    ${title}`, "Heading2"));
  const subsection = (number: string, title: string) => blocks.push(paragraph(`${number}.    ${title}`, "Heading3"));
  const body = (text: string) => blocks.push(paragraph(text, "Normal", { align: "both" }));
  const loadText = (category: LoadCategory, label: string) => {
    const items = bundle.loads.definitions.filter((item) => item.category === category);
    body(items.length ? `${label} pada model aktif terdiri dari ${items.map((item) => `${item.name} sebesar ${fixed(item.value, item.unit)}, bersumber dari ${item.source}, dengan asumsi ${item.assumption}`).join("; ")}. Nilai tersebut diterapkan melalui assignment yang tercatat pada tabel pembebanan.` : `${label} belum tersedia pada revisi proyek aktif.`);
  };

  blocks.push(paragraph(String(new Date(snapshot.generated_at).getFullYear()), "CoverYear", { align: "right", firstLine: false }), paragraph("LAPORAN\nPERHITUNGAN", "CoverTitle", { align: "left", firstLine: false }), paragraph("ANALISIS DAN PERENCANAAN\nSTRUKTUR BETON BERTULANG", "CoverSubtitle", { align: "left", firstLine: false }), paragraph(bundle.project.title.toUpperCase(), "CoverProject", { align: "left", firstLine: false }), paragraph(`${bundle.project.location || "LOKASI PROYEK"} · ${bundle.project.owner || "PEMILIK PROYEK"}`, "CoverBand", { align: "left", firstLine: false }));
  const coverModel = figures.get("model-3d");
  if (coverModel) blocks.push(picture(coverModel.media, "Model struktur", media.indexOf(coverModel) + 100, 4937760, 2962656));
  blocks.push(sectionBreak("none", true));
  blocks.push(paragraph("DAFTAR ISI", "FrontHeading", { align: "center", firstLine: false }), fieldParagraph('TOC \\o "1-3" \\h \\z \\u', "Perbarui field untuk menampilkan daftar isi."));
  blocks.push(paragraph("DAFTAR GAMBAR", "FrontHeading", { pageBreakBefore: true, align: "center", firstLine: false }), fieldParagraph('TOC \\h \\z \\c "Gambar"', "Perbarui field untuk menampilkan daftar gambar."));
  blocks.push(paragraph("DAFTAR TABEL", "FrontHeading", { pageBreakBefore: true, align: "center", firstLine: false }), fieldParagraph('TOC \\h \\z \\c "Tabel"', "Perbarui field untuk menampilkan daftar tabel."), sectionBreak("lowerRoman"));

  chapter("I", "PENDAHULUAN");
  section("1.1", "Data Perencanaan");
  body(`Laporan ini disusun sebagai dokumen perhitungan tahap pra-analisis untuk ${bundle.project.title}. Data perencanaan mencakup geometri bangunan, material beton bertulang, pembebanan gravitasi dan lingkungan, perhitungan gempa statik ekivalen, serta paket data yang diperlukan untuk membentuk dan memeriksa model ETABS.`);
  body("Setiap angka yang disajikan berasal dari revisi proyek aktif. Hasil analisis struktur, gaya dalam elemen, reaksi tumpuan, simpangan, desain penampang, dan output ETABS tidak termasuk dalam Generate #1 karena memerlukan model analisis yang telah dibangun dan diverifikasi oleh engineer.");
  section("1.2", "Data Bangunan"); addTable("project-data");
  subsection("1.2.1", "Data Struktur");
  body(`Bangunan dimodelkan sebagai struktur beton bertulang dengan ${bundle.geometry.stories.filter(({ order }) => order > 0).length} tingkat di atas level dasar. Rentang grid X dan Y serta elevasi tingkat menjadi acuan tunggal untuk denah, estimasi area pembebanan, distribusi berat seismik, dan handoff ke ETABS.`);
  addTable("grid-x"); addTable("grid-y"); addTable("story-data");
  subsection("1.2.2", "Gambar Rencana");
  body("Gambar rencana berikut dibentuk langsung dari ordinat grid dan data tingkat pada revisi aktif. Gambar ini berfungsi sebagai kontrol geometri awal dan tidak menggantikan gambar kerja atau model ETABS.");
  addFigure("plan-grid"); addFigure("story-elevation"); addFigure("model-3d");
  section("1.3", "Diagram Alir Perencanaan");
  body("Alur kerja Generate #1 dimulai dari data proyek dan geometri, dilanjutkan dengan penetapan material, definisi serta assignment beban, perhitungan gempa, pemeriksaan kesiapan handoff, lalu penyusunan dokumen. Model ETABS dibangun setelah data pra-analisis dinyatakan siap. Hasil analisis ETABS menjadi tahap lanjutan di luar batas dokumen ini.");
  blocks.push(table({ id: "workflow", headers: ["Urutan", "Tahap", "Keluaran"], rows: [[1, "Data proyek dan geometri", "Grid, story, elevasi"], [2, "Material", "fc′, fy, fys, berat jenis, selimut"], [3, "Pembebanan", "Definisi, assignment, berat seismik"], [4, "Gempa", "Spektrum, KDS, sistem, Cs, V, Fx"], [5, "Handoff ETABS", "Grid, load pattern, case, kombinasi, checklist"]] }));
  section("1.4", "Dasar-Dasar Perencanaan");
  body("Perencanaan menggunakan pendekatan keadaan batas dengan pemisahan antara data input, nilai yang dihitung oleh registry, dan keputusan yang tetap harus diverifikasi oleh engineer. Semua nilai turunan penting disertai rumus, substitusi, referensi, versi registry, dan revisi proyek agar jejak perhitungan dapat diaudit.");
  subsection("1.4.1", "Peraturan yang Digunakan");
  body(`Registry standar aktif adalah ${bundle.revision.registry_version.replaceAll("|", ", ")}. Standar tersebut menjadi dasar untuk ketentuan beton struktural, pembebanan minimum, dan tata cara perencanaan ketahanan gempa yang digunakan oleh modul perhitungan proyek.`);

  chapter("II", "MATERIAL DAN PEMBEBANAN");
  section("2.1", "Konsep Perancangan Struktur Beton Bertulang");
  body("Sistem beton bertulang memanfaatkan beton untuk menahan gaya tekan dan tulangan baja untuk menahan gaya tarik serta meningkatkan daktilitas elemen. Mutu material, selimut, dan pilihan diameter tulangan harus konsisten dengan kebutuhan kekuatan, layan, durabilitas, detailing, serta kondisi pelaksanaan proyek.");
  body("Pada tahap ini StruCal menyusun data material dan beban sebagai dasar model. Dimensi penampang dan detailing elemen belum tersedia pada model proyek, sehingga pemilihan penampang, kekakuan efektif, modifier, dan assignment elemen harus ditetapkan serta diperiksa pada ETABS sebelum analisis dijalankan.");
  section("2.2", "Material Properties");
  body("Properti material pada tabel berikut berasal dari modul material proyek aktif. Provenance INPUT menunjukkan nilai yang dimasukkan pengguna, sedangkan CODE menunjukkan nilai turunan berdasarkan registry aktif.");
  addTable("material-properties"); addTable("reinforcement-diameters");
  section("2.3", "Pembebanan");
  body("Pembebanan disusun menurut fungsi bangunan dan target geometri. Besaran beban, sumber, asumsi, bentuk aplikasi, serta faktor kontribusi terhadap berat seismik disimpan bersama sehingga penerapannya dapat ditelusuri saat model ETABS dibentuk.");
  addTable("load-summary"); addTable("load-assignments");
  subsection("2.3.1", "Beban Mati"); loadText("SELF_WEIGHT", "Beban mati sendiri"); loadText("SUPERIMPOSED_DEAD", "Beban mati tambahan");
  subsection("2.3.2", "Beban Hidup"); loadText("LIVE", "Beban hidup lantai");
  subsection("2.3.3", "Beban Angin"); loadText("WIND", "Beban angin");
  subsection("2.3.4", "Beban Hidup Atap"); loadText("ROOF_LIVE", "Beban hidup atap");
  subsection("2.3.5", "Beban Hujan"); loadText("RAIN", "Beban hujan");
  subsection("2.3.6", "Beban Gempa Pra-Analisis");
  body("Perhitungan beban gempa menggunakan metode statik ekivalen dan spektrum respons desain berdasarkan SNI 1726:2019. Urutan perhitungan meliputi verifikasi input dan provenance, pembentukan parameter spektrum, penetapan Kategori Desain Seismik, pemilihan sistem struktur, pembatasan periode, penentuan koefisien respons, perhitungan gaya geser dasar, dan distribusi gaya lateral per tingkat.");
  body("Input peta gempa, kelas situs, serta koefisien situs tidak diambil secara otomatis tanpa sumber. Tabel berikut mempertahankan sumber, penginput, dan revisi untuk setiap parameter sehingga penggunaan nilai dapat ditelusuri kembali.");
  addTable("seismic-input-provenance");
  subsection("2.3.6.1", "Parameter Spektrum Respons Desain");
  body("Nilai SMS dan SM1 diperoleh dari parameter percepatan spektral yang telah dikoreksi koefisien situs. Nilai SDS dan SD1 kemudian digunakan untuk membentuk titik transisi T0 dan Ts serta ordinat spektrum respons desain.");
  addTable("seismic-spectrum"); addFigure("response-spectrum");
  subsection("2.3.6.2", "Kategori Desain Seismik");
  body(`Kategori risiko bangunan ditetapkan sebagai ${handoff.rawSeismic.risk_category}. Kategori Desain Seismik ditentukan dari pemeriksaan SDS dan SD1; hasil yang lebih berat menjadi kategori pengendali.`);
  addTable("seismic-kds");
  subsection("2.3.6.3", "Sistem Struktur dan Parameter Desain");
  body(`Sistem struktur yang dipilih adalah ${handoff.selectedSystem?.label ?? "—"}. Kelayakannya telah diperiksa terhadap Kategori Desain Seismik dan batas yang tersedia pada registry. Parameter R, Ω₀, dan Cd digunakan sebagai masukan perhitungan gaya gempa serta kontrol respons.`);
  addTable("seismic-system");
  subsection("2.3.6.4", "Periode Fundamental Struktur");
  body("Periode pendekatan Ta dihitung dari tinggi struktur dan parameter sistem. Periode yang digunakan dibatasi oleh CuTa sesuai ketentuan registry; jika periode analitis belum tersedia, perhitungan pra-analisis menggunakan periode pendekatan yang tercatat.");
  addTable("seismic-period");
  subsection("2.3.6.5", "Koefisien Respons dan Gaya Geser Dasar");
  body("Koefisien respons seismik nominal diperiksa terhadap batas atas dan batas bawah. Nilai yang mengendalikan dikalikan dengan berat seismik efektif untuk memperoleh gaya geser dasar statik ekivalen.");
  addTable("seismic-cs"); addTable("seismic-weight"); addTable("seismic-base-shear");
  subsection("2.3.6.6", "Distribusi Gaya Lateral per Tingkat");
  body("Gaya geser dasar didistribusikan ke setiap tingkat berdasarkan berat tingkat, elevasi terhadap dasar, dan eksponen distribusi k. Jumlah Cvx harus sama dengan 1,0 dan jumlah Fx harus kembali sama dengan gaya geser dasar sebagai kontrol keseimbangan.");
  addTable("story-forces");

  chapter("III", "PERMODELAN STRUKTUR");
  section("3.1", "Model Struktur dengan ETABS");
  body("ETABS digunakan sebagai perangkat analisis struktur eksternal. Data pada bab ini merupakan paket handoff untuk membentuk model secara konsisten. Engineer tetap bertanggung jawab atas idealisasi elemen, connectivity, diaphragm, kekakuan efektif, mass source, load case, dan pemeriksaan model sebelum analisis.");
  subsection("3.1.1", "Data Umum Bangunan"); addTable("project-data"); addTable("story-data");
  subsection("3.1.2", "Pembuatan Grid");
  body("Grid ETABS dibentuk dari ordinat Grid X dan Grid Y pada modul geometri. Story data mengikuti tinggi dan elevasi yang sama. Dokumentasi tangkapan layar dapat ditempatkan pada slot berikut setelah model proyek dibangun.");
  addTable("grid-x"); addTable("grid-y"); addFigure("etabs-grid-reference", true);
  section("3.2", "Permodelan Material dan Penampang");
  body("Definisi material mengikuti properti pada BAB II. Dimensi penampang dan assignment elemen belum tersedia dalam data proyek Generate #1; engineer harus menetapkan serta memeriksa penampang pada model ETABS dan mengunggah dokumentasi bila ingin dicantumkan.");
  addFigure("etabs-material-reference", true);
  section("3.3", "Permodelan Perletakan Pondasi");
  body("Kondisi tumpuan dan restraint ditetapkan pada ETABS sesuai sistem pondasi serta idealisasi interaksi tanah-struktur. Data ini belum dihitung oleh StruCal dan harus diverifikasi engineer sebelum analisis.");
  addFigure("etabs-restraint-reference", true);
  section("3.4", "Pembuatan Load Pattern");
  body("Load pattern dibentuk dari definisi beban aktif. Self-weight multiplier harus diperiksa pada ETABS agar berat sendiri tidak dihitung ganda. Nilai pada tabel menjadi referensi setup dan bukan bukti bahwa load pattern telah dibuat pada file ETABS.");
  addTable("etabs-patterns"); addFigure("etabs-load-pattern-reference", true);
  section("3.5", "Aplikasi Beban pada Struktur melalui ETABS");
  body("Beban diterapkan pada area lantai atau garis grid sesuai target assignment. Arah, sistem koordinat, tributary area, dan satuan harus diperiksa pada model ETABS. Dokumentasi visual hanya ditampilkan bila berasal dari model proyek.");
  addTable("load-assignments"); addFigure("etabs-load-assignment-reference", true);
  section("3.6", "Load Cases dan Response Spectrum");
  body("Load case gravitasi dan seismik disiapkan berdasarkan load pattern serta hasil M6. Damping, arah eksitasi, modal case, faktor skala, dan ketentuan kombinasi modal ditetapkan serta diverifikasi pada ETABS. Generate #1 tidak menyatakan bahwa analisis telah dijalankan.");
  addTable("etabs-cases"); addFigure("etabs-load-case-reference", true);
  section("3.7", "Kombinasi Beban");
  body("Kombinasi beban berikut merupakan referensi untuk setup ETABS berdasarkan registry aktif. Respons struktur dari kombinasi tersebut belum dihitung pada tahap ini.");
  addTable("load-combinations"); addFigure("etabs-combination-reference", true);
  section("3.8", "Ringkasan Handoff ETABS");
  body("Checklist berikut membedakan data yang siap, peringatan yang perlu ditinjau, dan item yang tetap menjadi tanggung jawab ETABS atau engineer. Dokumen berakhir pada kesiapan pra-analisis dan tidak memuat output analisis ETABS.");
  addTable("etabs-readiness");

  const bodySect = '<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1701" w:right="1701" w:bottom="1701" w:left="2268" w:header="720" w:footer="720" w:gutter="0"/><w:pgNumType w:fmt="decimal" w:start="1"/></w:sectPr>';
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${blocks.join("")}${bodySect}</w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="240" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/><w:ind w:firstLine="720"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="3. Normal"/></w:style><w:style w:type="paragraph" w:styleId="CoverYear"><w:name w:val="Cover Year"/><w:pPr><w:spacing w:after="700"/><w:ind w:firstLine="0"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="CoverTitle"><w:name w:val="Cover Title"/><w:pPr><w:spacing w:after="160" w:line="620"/><w:ind w:firstLine="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="60"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="CoverSubtitle"><w:name w:val="Cover Subtitle"/><w:pPr><w:spacing w:after="160" w:line="360"/><w:ind w:firstLine="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="CoverProject"><w:name w:val="Cover Project"/><w:pPr><w:spacing w:after="200"/><w:ind w:firstLine="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="CoverBand"><w:name w:val="Cover Band"/><w:pPr><w:spacing w:after="420"/><w:ind w:firstLine="0"/><w:shd w:fill="0F687B"/></w:pPr><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="FrontHeading"><w:name w:val="Front Heading"/><w:pPr><w:keepNext/><w:spacing w:after="240"/><w:jc w:val="center"/><w:ind w:firstLine="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="1. BAB"/><w:basedOn w:val="Normal"/><w:next w:val="ChapterTitle"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:after="0" w:line="240"/><w:jc w:val="center"/><w:ind w:firstLine="0"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ChapterTitle"><w:name w:val="Chapter Title"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:after="240" w:line="240"/><w:jc w:val="center"/><w:ind w:firstLine="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="2. SUB-BAB"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:after="120" w:line="240"/><w:ind w:left="720" w:hanging="720"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="3. SUB-BAB"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:after="120" w:line="240"/><w:ind w:left="720" w:hanging="720"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="80" w:after="200" w:line="240"/><w:jc w:val="center"/><w:ind w:firstLine="0"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style></w:styles>`;
  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/><w:ind w:firstLine="0"/></w:pPr>${field("PAGE", "1")}</w:p></w:ftr>`;
  const imageRels = media.map(({ media: item }) => `<Relationship Id="${item.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${item.name}"/>`).join("");
  const files = [
    { name: "[Content_Types].xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`) },
    { name: "_rels/.rels", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`) },
    { name: "word/document.xml", data: encoder.encode(document) },
    { name: "word/styles.xml", data: encoder.encode(styles) },
    { name: "word/settings.xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`) },
    { name: "word/footer1.xml", data: encoder.encode(footer) },
    { name: "word/_rels/document.xml.rels", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${imageRels}</Relationships>`) },
    { name: "docProps/core.xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(bundle.project.title)} Generate 1</dc:title><dc:creator>StruCal</dc:creator><dc:description>Template map verified against ${xml(snapshot.template_reference)}</dc:description><dcterms:created xsi:type="dcterms:W3CDTF">${xml(snapshot.generated_at)}</dcterms:created></cp:coreProperties>`) },
    { name: "docProps/app.xml", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>StruCal</Application></Properties>`) },
    ...media.map(({ media: item }) => ({ name: `word/media/${item.name}`, data: item.data })),
  ];
  return zip(files);
}
