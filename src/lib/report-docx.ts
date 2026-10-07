import { readFileSync } from "node:fs";
import { join as joinPath } from "node:path";
import { deflateRawSync, deflateSync, inflateRawSync } from "node:zlib";
import { createEtabsHandoff } from "./etabs-handoff.ts";
import { spacingsFromOrdinates } from "./geometry.ts";
import type { LoadCategory } from "./loads.ts";
import type { ProjectBundle } from "./projects.ts";
import { deriveAssumptionsAndDefaults, type ReportAsset, type ReportFigure, type ReportSnapshot } from "./report.ts";
import { REPORT_MASTER_FILE, REPORT_TEMPLATE_MANIFEST } from "./report-template-manifest.ts";

export type ReportGenerationInput = { bundle: ProjectBundle; snapshot: ReportSnapshot; assets: ReportAsset[] };
type TableData = { id: string; headers: string[]; rows: (string | number | null | undefined)[][] };
type Media = { id: string; name: string; contentType: "image/png" | "image/jpeg"; data: Uint8Array };
type PackageFile = { name: string; data: Uint8Array };

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const masterPath = () => joinPath(process.cwd(), "templates", REPORT_MASTER_FILE);
const xml = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
const decodeXml = (value: string) => value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const number = (value: number | null | undefined, digits = 3) => value === null || value === undefined ? "—" : new Intl.NumberFormat("id-ID", { useGrouping: false, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const value = (input: number | null | undefined, unit = "", digits = 3) => input === null || input === undefined ? "—" : `${number(input, digits)}${unit ? ` ${unit}` : ""}`;
const reportText = (input: string) => input.split(";").map((part) => part.trim()).filter((part) => part && !/ENGINEER_APPROVED|\bM[3-7]\b|\bM[3-7]\s+V\d+|active revision|registry|source[_ ]hash|debug/i.test(part)).join("; ") || "—";

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

function readZip(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let eocd = data.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error("Master DOCX tidak memiliki ZIP central directory yang valid.");
  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const files = new Map<string, Uint8Array>();
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("Master DOCX memiliki central entry yang tidak valid.");
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(data.subarray(cursor + 46, cursor + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = data.subarray(start, start + compressedSize);
    files.set(name, method === 0 ? compressed.slice() : method === 8 ? inflateRawSync(compressed) : (() => { throw new Error(`Metode ZIP ${method} pada master tidak didukung.`); })());
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function zip(files: PackageFile[]) {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const deflated = deflateRawSync(file.data, { level: 6 });
    const compressed = deflated.length < file.data.length ? deflated : file.data;
    const method = compressed === file.data ? 0 : 8;
    const crc = crc32(file.data);
    const localHeader = join([integer(0x04034b50, 4), integer(20, 2), integer(0x0800, 2), integer(method, 2), integer(0, 2), integer(0, 2), integer(crc, 4), integer(compressed.length, 4), integer(file.data.length, 4), integer(name.length, 2), integer(0, 2), name]);
    local.push(localHeader, compressed);
    central.push(join([integer(0x02014b50, 4), integer(20, 2), integer(20, 2), integer(0x0800, 2), integer(method, 2), integer(0, 2), integer(0, 2), integer(crc, 4), integer(compressed.length, 4), integer(file.data.length, 4), integer(name.length, 2), integer(0, 2), integer(0, 2), integer(0, 2), integer(0, 2), integer(0, 4), integer(offset, 4), name]));
    offset += localHeader.length + compressed.length;
  }
  const directory = join(central);
  return join([...local, directory, integer(0x06054b50, 4), integer(0, 2), integer(0, 2), integer(files.length, 2), integer(files.length, 2), integer(directory.length, 4), integer(offset, 4), integer(0, 2)]);
}

function splitBody(documentXml: string) {
  const open = documentXml.match(/<w:body(?:\s[^>]*)?>/);
  if (!open?.index) throw new Error("Master DOCX tidak memiliki body Word yang dapat dipetakan.");
  const contentStart = open.index + open[0].length;
  const contentEnd = documentXml.lastIndexOf("</w:body>");
  const source = documentXml.slice(contentStart, contentEnd);
  const children: string[] = [];
  const tags = /<[^>]+>/g;
  let depth = 0;
  let childStart = -1;
  for (let match = tags.exec(source); match; match = tags.exec(source)) {
    const token = match[0];
    if (token.startsWith("<?") || token.startsWith("<!--") || token.startsWith("<!")) continue;
    const closing = token.startsWith("</");
    const selfClosing = token.endsWith("/>");
    if (!closing) {
      if (depth === 0) childStart = match.index;
      if (!selfClosing) depth += 1;
      else if (depth === 0 && childStart >= 0) { children.push(source.slice(childStart, tags.lastIndex)); childStart = -1; }
    } else {
      depth -= 1;
      if (depth === 0 && childStart >= 0) { children.push(source.slice(childStart, tags.lastIndex)); childStart = -1; }
    }
  }
  return { prefix: documentXml.slice(0, contentStart), suffix: documentXml.slice(contentEnd), children };
}

function textOf(block: string) {
  return decodeXml([...block.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join(" ")).replace(/\s+/g, " ").trim();
}

function styleOf(block: string) {
  return block.match(/<w:pStyle[^>]*w:val="([^"]+)"/)?.[1] ?? "";
}

function nextTable(children: string[], start: number) {
  return children.slice(start + 1).find((child) => child.startsWith("<w:tbl")) ?? "";
}

function findBlock(children: string[], text: string, style?: string) {
  const index = children.findIndex((child) => textOf(child).startsWith(text) && (!style || styleOf(child) === style));
  if (index < 0) throw new Error(`Anchor master DOCX tidak ditemukan: ${text}`);
  return index;
}

function sectionParagraph(block: string) {
  const properties = block.match(/<w:pPr>[\s\S]*?<w:sectPr[\s\S]*?<\/w:sectPr>[\s\S]*?<\/w:pPr>/)?.[0];
  if (!properties) throw new Error("Section break master DOCX tidak dapat dikloning.");
  return `<w:p>${properties}</w:p>`;
}

function sourceTable(data: TableData, exemplar: string) {
  const properties = exemplar.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? "<w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/></w:tblPr>";
  const cellProperties = exemplar.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/)?.[0] ?? "<w:tcPr/>";
  const compact = data.id === "etabs-readiness";
  const size = compact ? 16 : 20;
  const line = compact ? 190 : 240;
  const cell = (content: unknown, header = false) => `<w:tc>${cellProperties}<w:p><w:pPr><w:spacing w:after="0" w:line="${line}" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="${header ? "center" : "left"}"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>${header ? "<w:b/>" : ""}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(content)}</w:t></w:r></w:p></w:tc>`;
  const row = (items: unknown[], header = false) => `<w:tr><w:trPr><w:cantSplit/>${header ? "<w:tblHeader/>" : ""}</w:trPr>${items.map((item) => cell(item, header)).join("")}</w:tr>`;
  const grid = `<w:tblGrid>${data.headers.map(() => '<w:gridCol w:w="2000"/>').join("")}</w:tblGrid>`;
  return `<w:tbl>${properties}${grid}${row(data.headers, true)}${data.rows.map((items) => row(items)).join("")}</w:tbl>`;
}

function paragraph(text: string, style = "3Normal", options: { align?: "center" | "both" | "right" | "left"; pageBreakBefore?: boolean; bold?: boolean; firstLine?: boolean } = {}) {
  const properties = [`<w:pStyle w:val="${style}"/>`, options.pageBreakBefore ? "<w:pageBreakBefore/>" : "", options.firstLine === false ? '<w:ind w:firstLine="0"/>' : "", options.align ? `<w:jc w:val="${options.align}"/>` : ""].join("");
  const content = text.split("\n").map((line) => `<w:t xml:space="preserve">${xml(line)}</w:t>`).join("<w:br/>");
  return `<w:p><w:pPr>${properties}</w:pPr><w:r>${options.bold ? "<w:rPr><w:b/></w:rPr>" : ""}${content}</w:r></w:p>`;
}

function coverParagraph(text: string, size: number, options: { bold?: boolean; align?: "left" | "right" | "center"; fill?: string; before?: number; after?: number } = {}) {
  const content = text.split("\n").map((line) => `<w:t xml:space="preserve">${xml(line)}</w:t>`).join("<w:br/>");
  return `<w:p><w:pPr>${options.fill ? `<w:shd w:val="clear" w:fill="${options.fill}"/>` : ""}<w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? 120}"/><w:ind w:left="900" w:right="900"/><w:jc w:val="${options.align ?? "left"}"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>${options.bold ? "<w:b/>" : ""}${options.fill ? '<w:color w:val="FFFFFF"/>' : ""}<w:sz w:val="${size}"/></w:rPr>${content}</w:r></w:p>`;
}

function field(instruction: string, display = "") {
  return `<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> ${xml(instruction)} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${display ? `<w:r><w:t>${xml(display)}</w:t></w:r>` : ""}<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
}

function fieldParagraph(instruction: string) {
  return `<w:p><w:pPr><w:ind w:firstLine="0"/></w:pPr>${field(instruction)}</w:p>`;
}

function caption(label: "Gambar" | "Tabel", title: string) {
  return `<w:p><w:pPr><w:pStyle w:val="Caption"/><w:keepNext/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:r><w:t xml:space="preserve">${label} </w:t></w:r>${field(`SEQ ${label} \\* ARABIC`, "1")}<w:r><w:t xml:space="preserve"> ${xml(title)}</w:t></w:r></w:p>`;
}

function equation(line: string) {
  return `<w:p><w:pPr><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><m:oMathPara><m:oMath><m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>${xml(line)}</m:t></m:r></m:oMath></m:oMathPara></w:p>`;
}

function equationTriplet(general: string, substitution: string, result: string) {
  return [equation(general), equation(substitution), equation(result)];
}

function picture(media: Media, title: string, drawingId: number, exemplar?: string) {
  if (exemplar) {
    const embeddings = [...exemplar.matchAll(/r:embed="([^"]+)"/g)];
    if (embeddings.length === 1) return exemplar.replace(`r:embed="${embeddings[0][1]}"`, `r:embed="${media.id}"`).replace(/(<wp:docPr\b[^>]*\bdescr=")[^"]*(")/, `$1${xml(title)}$2`);
  }
  const width = 4937760;
  const height = 2962656;
  return `<w:p><w:pPr><w:keepNext/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width}" cy="${height}"/><wp:docPr id="${drawingId}" name="${xml(title)}" descr="${xml(title)}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${xml(media.name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${media.id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function tableData(bundle: ProjectBundle): TableData[] {
  const handoff = createEtabsHandoff(bundle);
  const result = handoff.result;
  const grids = (axis: "X" | "Y") => {
    const lines = axis === "X" ? bundle.geometry.grid_x : bundle.geometry.grid_y;
    const spacings = spacingsFromOrdinates(lines.map(({ ordinate }) => ordinate));
    return lines.map((line, index) => [line.label, value(line.ordinate, "m"), index ? value(spacings[index - 1], "m") : "—"]);
  };
  const tables: TableData[] = [
    { id: "project-data", headers: ["Data", "Keterangan"], rows: [["Nama bangunan", bundle.project.title], ["Lokasi", bundle.project.location], ["Fungsi bangunan", bundle.project.function], ["Pemilik", bundle.project.owner]] },
    { id: "grid-x", headers: ["Grid", "Ordinat", "Jarak sebelumnya"], rows: grids("X") },
    { id: "grid-y", headers: ["Grid", "Ordinat", "Jarak sebelumnya"], rows: grids("Y") },
    { id: "story-data", headers: ["Story", "Tinggi", "Elevasi"], rows: bundle.geometry.stories.map((story) => [story.name, value(story.height, "m"), value(story.elevation, "m")]) },
    { id: "material-properties", headers: ["Material", "Mutu", "Nilai", "Asal data"], rows: [
      ["Beton", bundle.materials.concrete.grade, value(bundle.materials.concrete.fc.value, "MPa"), "Masukan"],
      ["Modulus elastis beton", bundle.materials.concrete.grade, value(bundle.materials.concrete.elastic_modulus.value, "MPa"), "Perhitungan"],
      ["Berat jenis beton", bundle.materials.concrete.grade, value(bundle.materials.concrete.density.value, "kg/m³"), "Masukan"],
      ["Selimut beton", bundle.materials.concrete.grade, value(bundle.materials.concrete.cover.value, "mm"), "Masukan"],
      ["Tulangan longitudinal", bundle.materials.longitudinal_rebar.grade, value(bundle.materials.longitudinal_rebar.fy.value, "MPa"), "Masukan"],
      ["Tulangan transversal", bundle.materials.transverse_rebar.grade, value(bundle.materials.transverse_rebar.fys.value, "MPa"), "Masukan"],
    ] },
    { id: "reinforcement-diameters", headers: ["Diameter tulangan tersedia"], rows: bundle.materials.available_diameters.map((item) => [value(item.nominal_diameter.value, "mm", 0)]) },
    { id: "load-summary", headers: ["Nama beban", "Kategori", "Nilai", "Sumber", "Asumsi", "Faktor berat seismik"], rows: handoff.patterns.map((load) => [load.name, load.categoryLabel, value(load.value, load.unit), load.source, load.assumption, number(load.seismic_weight_factor)]) },
    { id: "load-assignments", headers: ["Beban", "Target", "Aplikasi", "Asumsi"], rows: handoff.assignments.map((assignment) => [assignment.definition?.name ?? assignment.load_id, assignment.target?.label ?? assignment.target_id, assignment.application === "UNIFORM_AREA" ? "Beban merata area" : "Beban merata garis", assignment.assumption]) },
    { id: "seismic-input-provenance", headers: ["Parameter", "Nilai", "Sumber"], rows: (["site_class", "ss", "s1", "tl", "fa", "fv"] as const).map((key) => [key === "site_class" ? "Kelas situs" : key.toUpperCase(), key === "site_class" ? handoff.rawSeismic[key] : value(handoff.rawSeismic[key], key === "tl" ? "detik" : key === "ss" || key === "s1" ? "g" : ""), handoff.inputProvenance[key].source]) },
    { id: "seismic-spectrum", headers: ["Parameter", "Nilai", "Referensi"], rows: result?.spectrum ? Object.entries(result.spectrum).map(([label, trace]) => [label.toUpperCase(), value(trace.value, trace.unit === "dimensionless" ? "" : trace.unit), trace.standard_ref]) : [] },
    { id: "seismic-kds", headers: ["Pemeriksaan", "Input", "Hasil", "Referensi"], rows: result?.kds_review?.checks.map((check) => [check.label, value(check.input_value, check.input_unit), `KDS ${check.result}`, check.standard_ref]) ?? [] },
    { id: "seismic-system", headers: ["Parameter", "Nilai", "Keterangan"], rows: result?.system_parameters ? [["Sistem struktur", handoff.selectedSystem?.label, handoff.selectedSystem?.standard_ref], ["R", number(result.system_parameters.R.value), "Koefisien modifikasi respons"], ["Ω₀", number(result.system_parameters.omega0.value), "Faktor kuat lebih"], ["Cd", number(result.system_parameters.Cd.value), "Faktor pembesaran defleksi"], ["Ct", number(result.system_parameters.Ct.value, 4), "Koefisien periode"], ["x", number(result.system_parameters.x.value), "Eksponen periode"]] : [] },
    { id: "seismic-period", headers: ["Parameter", "Nilai", "Referensi"], rows: result?.period ? [["Ta", value(result.period.ta.value, "detik", 4), result.period.ta.standard_ref], ["Cu", number(result.period.cu.value), result.period.cu.standard_ref], ["T maksimum", value(result.period.tmax.value, "detik", 4), result.period.tmax.standard_ref], ["T digunakan", value(result.period.used.value, "detik", 4), result.period.used.standard_ref]] : [] },
    { id: "seismic-cs", headers: ["Pemeriksaan", "Nilai", "Referensi"], rows: result?.response_coefficient ? [["Cs nominal", number(result.response_coefficient.nominal.value, 4), result.response_coefficient.nominal.standard_ref], ["Batas atas", number(result.response_coefficient.upper_bound.value, 4), result.response_coefficient.upper_bound.standard_ref], ...result.response_coefficient.lower_bounds.map((trace, index) => [`Batas bawah ${index + 1}`, number(trace.value, 4), trace.standard_ref]), ["Cs digunakan", number(result.response_coefficient.governing.value, 4), result.response_coefficient.governing.standard_ref]] : [] },
    { id: "seismic-weight", headers: ["Story", "Berat seismik"], rows: result?.story_forces.map((row) => [row.story, value(row.weight, "kN")]) ?? [] },
    { id: "seismic-base-shear", headers: ["Hasil", "Nilai", "Referensi"], rows: result ? [["Berat seismik efektif, W", value(result.seismic_weight?.value, "kN"), result.seismic_weight?.standard_ref], ["Koefisien respons, Cs", number(result.response_coefficient?.governing.value, 4), result.response_coefficient?.governing.standard_ref], ["Gaya geser dasar, V", value(result.base_shear?.value, "kN"), result.base_shear?.standard_ref], ["Eksponen distribusi, k", number(result.story_exponent?.value), result.story_exponent?.standard_ref]] : [] },
    { id: "story-forces", headers: ["Story", "Elevasi", "W", "Cvx", "Fx"], rows: result?.story_forces.map((row) => [row.story, value(row.elevation, "m"), value(row.weight, "kN"), number(row.cvx.value, 4), value(row.force.value, "kN")]) ?? [] },
    { id: "etabs-patterns", headers: ["Nama", "Kategori", "Nilai", "Jumlah assignment"], rows: handoff.patterns.map((item) => [item.name, item.categoryLabel, value(item.value, item.unit), item.assignmentCount]) },
    { id: "etabs-cases", headers: ["Nama", "Kategori", "Keterangan"], rows: handoff.loadCases.map((item) => [item.name, item.category, "Ditetapkan dan diverifikasi pada model ETABS"]) },
    { id: "etabs-readiness", headers: ["Item", "Status", "Keterangan"], rows: handoff.readiness.map((item) => [item.label, item.status === "READY" ? "Siap" : "Perlu tinjau", item.detail.replace(/M[3-7]/g, "tahap sebelumnya").replace(/registry/gi, "referensi")]) },
  ];
  return tables.map((table) => ({ ...table, rows: table.rows.map((row) => row.map((cell) => typeof cell === "string" ? reportText(cell) : cell)) }));
}

function pngChunk(type: string, data: Uint8Array) {
  const kind = encoder.encode(type);
  return join([integer(data.length, 4, false), kind, data, integer(crc32(join([kind, data])), 4, false)]);
}

const glyphs: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"], "2": ["111", "001", "111", "100", "111"], "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"], "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "111"], "A": ["010", "101", "111", "101", "101"], "D": ["110", "101", "101", "101", "110"],
  "E": ["111", "100", "110", "100", "111"], "G": ["111", "100", "101", "101", "111"], "I": ["111", "010", "010", "010", "111"], "K": ["101", "101", "110", "101", "101"],
  "L": ["100", "100", "100", "100", "111"], "S": ["111", "100", "111", "001", "111"], "T": ["111", "010", "010", "010", "010"], "(": ["01", "10", "10", "10", "01"],
  ")": ["10", "01", "01", "01", "10"], ".": ["0", "0", "0", "0", "1"], ",": ["0", "0", "0", "1", "1"], " ": ["0", "0", "0", "0", "0"],
};

function renderSystemFigure(figureId: string, bundle: ProjectBundle) {
  const width = 1000;
  const height = 600;
  const pixels = new Uint8Array(width * height * 4).fill(255);
  const set = (x: number, y: number, color: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = (Math.round(y) * width + Math.round(x)) * 4;
    [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]] = [...color, 255];
  };
  const line = (x0: number, y0: number, x1: number, y1: number, color: [number, number, number] = [13, 119, 143], thickness = 2) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let step = 0; step <= steps; step += 1) {
      const x = x0 + (x1 - x0) * step / steps;
      const y = y0 + (y1 - y0) * step / steps;
      for (let dx = -thickness; dx <= thickness; dx += 1) for (let dy = -thickness; dy <= thickness; dy += 1) set(x + dx, y + dy, color);
    }
  };
  const text = (label: string, x: number, y: number, scale = 3) => {
    let cursor = x;
    for (const raw of label.toUpperCase()) {
      const glyph = glyphs[raw] ?? glyphs[" "];
      glyph.forEach((row, rowIndex) => [...row].forEach((pixel, column) => { if (pixel === "1") for (let dx = 0; dx < scale; dx += 1) for (let dy = 0; dy < scale; dy += 1) set(cursor + column * scale + dx, y + rowIndex * scale + dy, [45, 55, 52]); }));
      cursor += (glyph[0].length + 1) * scale;
    }
  };
  const normalized = (values: number[], start: number, size: number) => {
    const min = Math.min(...values);
    const span = Math.max(Math.max(...values) - min, 1);
    return values.map((item) => start + (item - min) / span * size);
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
    const handoff = createEtabsHandoff(bundle);
    const points = handoff.spectrum;
    line(105, 55, 105, 515, [45, 55, 52]); line(105, 515, 920, 515, [45, 55, 52]);
    text("SA (G)", 20, 25); text("T (DETIK)", 780, 550);
    if (points.length) {
      const maxX = Math.max(...points.map(({ period }) => period), 1);
      const maxY = Math.max(...points.map(({ acceleration }) => acceleration.value), 1);
      points.slice(1).forEach((point, index) => {
        const previous = points[index];
        line(105 + previous.period / maxX * 815, 515 - previous.acceleration.value / maxY * 420, 105 + point.period / maxX * 815, 515 - point.acceleration.value / maxY * 420);
      });
      const spectrum = handoff.result?.spectrum;
      for (const [label, period] of [["T0", spectrum?.t0.value], ["TS", spectrum?.ts.value], ["TL", handoff.rawSeismic.tl]] as const) {
        if (period === null || period === undefined || period > maxX) continue;
        const x = 105 + period / maxX * 815;
        line(x, 75, x, 515, [155, 165, 161], 1); text(label, x - 8, 525, 2);
      }
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
    const contentType = (match?.[1] ?? "image/png") as Media["contentType"];
    const data = match ? Uint8Array.from(Buffer.from(match[2], "base64")) : renderSystemFigure(figure.figure_id, input.bundle);
    const index = media.length + 1;
    media.push({ figure, media: { id: `rIdStruCalImage${index}`, name: `strucal-figure-${index}.${contentType === "image/jpeg" ? "jpg" : "png"}`, contentType, data } });
  }
  return media;
}

export function generateReportDocx(input: ReportGenerationInput) {
  const { bundle, snapshot } = input;
  const handoff = createEtabsHandoff(bundle);
  if (handoff.status !== "READY") throw new Error("Kesiapan handoff ETABS harus READY sebelum DOCX dibuat.");
  if (snapshot.project_revision !== bundle.revision.id) throw new Error("Snapshot tidak sesuai dengan revisi proyek aktif.");

  const masterBytes = readFileSync(masterPath());
  const files = readZip(masterBytes);
  const originalDocument = decoder.decode(files.get("word/document.xml"));
  const body = splitBody(originalDocument);
  const sourceBodyStart = findBlock(body.children, REPORT_TEMPLATE_MANIFEST.body_anchor.text, REPORT_TEMPLATE_MANIFEST.body_anchor.style);
  const sourceStop = findBlock(body.children, REPORT_TEMPLATE_MANIFEST.stop_anchor.text, REPORT_TEMPLATE_MANIFEST.stop_anchor.style);
  if (sourceStop <= sourceBodyStart) throw new Error("Batas Stage 1 pada master DOCX tidak valid.");
  const coverSection = sectionParagraph(body.children[0]);
  const frontSection = sectionParagraph(body.children[sourceBodyStart - 1]);
  const finalSection = [...body.children].reverse().find((child) => child.startsWith("<w:sectPr"));
  if (!frontSection?.includes("<w:sectPr") || !finalSection) throw new Error("Section break master DOCX tidak lengkap.");

  const standardCaption = findBlock(body.children, REPORT_TEMPLATE_MANIFEST.table_exemplars.standard);
  const standardTable = nextTable(body.children, standardCaption);
  const combinationIntro = findBlock(body.children, REPORT_TEMPLATE_MANIFEST.table_exemplars.combinations);
  const combinationTable = nextTable(body.children, combinationIntro);
  if (!standardTable || !combinationTable || !textOf(combinationTable).includes("COMB 28")) throw new Error("Tabel master untuk data dinamis atau COMB 1–28 tidak tersedia.");

  const tableMap = new Map(tableData(bundle).map((entry) => [entry.id, entry]));
  const tableMeta = new Map(snapshot.tables.map((entry) => [entry.table_id, entry]));
  const media = mediaFor(input);
  const figures = new Map(media.map((entry) => [entry.figure.figure_id, entry]));
  const figureMeta = new Map(snapshot.figures.map((entry) => [entry.figure_id, entry]));
  const figureTemplates = new Map(Object.entries(REPORT_TEMPLATE_MANIFEST.figures).map(([id, map]) => {
    const captionIndex = findBlock(body.children, map.source_caption);
    const pictureBlock = body.children.slice(Math.max(0, captionIndex - 5), captionIndex).reverse().find((child) => child.includes("<w:drawing"));
    return [id, pictureBlock];
  }));
  const blocks: string[] = [];
  const addTable = (id: string) => { const data = tableMap.get(id); const meta = tableMeta.get(id); if (data && meta) blocks.push(caption("Tabel", meta.effective_caption), sourceTable(data, standardTable), paragraph("", "3Normal", { firstLine: false })); };
  const addFigure = (id: string) => { const entry = figures.get(id); const meta = figureMeta.get(id); if (!entry || !meta) return; blocks.push(picture(entry.media, meta.effective_caption, media.indexOf(entry) + 1, figureTemplates.get(id)), caption("Gambar", meta.effective_caption)); };
  const chapter = (roman: string, title: string) => blocks.push(paragraph(`BAB ${roman}\n${title}`, "1BAB", { pageBreakBefore: true, align: "center", firstLine: false }));
  const section = (numbering: string, title: string) => blocks.push(paragraph(`${numbering}.\t${title}`, numbering.split(".").length > 2 ? "3SUB-BAB" : "2SUB-BAB", { firstLine: false }));
  const narrative = (content: string) => blocks.push(paragraph(content, "3Normal", { align: "both" }));
  const loadNarrative = (category: LoadCategory, title: string) => {
    const loads = bundle.loads.definitions.filter((item) => item.category === category);
    narrative(loads.length ? `${title} yang digunakan terdiri atas ${loads.map((item) => `${reportText(item.name)} sebesar ${value(item.value, item.unit)}, berdasarkan ${reportText(item.source)}, dengan asumsi ${reportText(item.assumption)}`).join("; ")}. Beban diterapkan pada elemen sesuai target assignment yang telah ditetapkan.` : `${title} tidak digunakan pada bangunan ini.`);
  };

  const cover = [
    coverParagraph(String(new Date(snapshot.generated_at).getFullYear()), 18, { align: "right", after: 900 }),
    coverParagraph("LAPORAN\nPERHITUNGAN", 42, { bold: true, after: 180 }),
    coverParagraph("ANALISIS DAN PERENCANAAN\nSTRUKTUR BETON BERTULANG", 24, { bold: true, after: 180 }),
    coverParagraph(bundle.project.title.toUpperCase(), 24, { bold: true, after: 180 }),
    coverParagraph(`${bundle.project.location || "LOKASI PROYEK"} · ${bundle.project.owner || "PEMILIK PROYEK"}`, 18, { bold: true, fill: "146B7D", after: 480 }),
  ];
  const coverModel = figures.get("model-3d");
  if (coverModel) cover.push(picture(coverModel.media, "Model struktur", 100));
  cover.push(coverSection);
  const frontMatter = [
    paragraph("DAFTAR ISI", "1BAB", { align: "center", firstLine: false }), fieldParagraph('TOC \\o "1-3" \\h \\z \\u'),
    paragraph("DAFTAR GAMBAR", "1BAB", { pageBreakBefore: true, align: "center", firstLine: false }), fieldParagraph('TOC \\h \\z \\c "Gambar"'),
    paragraph("DAFTAR TABEL", "1BAB", { pageBreakBefore: true, align: "center", firstLine: false }), fieldParagraph('TOC \\h \\z \\c "Tabel"'),
  ];

  chapter("I", "PENDAHULUAN");
  section("1.1", "Data Perencanaan");
  narrative(`Laporan ini disusun untuk memberikan penjelasan teknis mengenai perencanaan struktur beton bertulang ${bundle.project.title}. Lingkup perencanaan meliputi data bangunan, geometri, material, pembebanan, ketahanan gempa, serta penyiapan data untuk pemodelan struktur.`);
  narrative("Perhitungan pada dokumen ini merupakan tahap pra-analisis. Analisis respons struktur, gaya dalam elemen, reaksi tumpuan, simpangan, dan desain penampang dilakukan setelah model analisis selesai dibentuk serta diverifikasi.");
  section("1.2", "Data Bangunan"); addTable("project-data");
  section("1.2.1", "Data Struktur");
  narrative(`Bangunan direncanakan menggunakan sistem struktur beton bertulang dengan ${bundle.geometry.stories.filter(({ order }) => order > 0).length} tingkat di atas level dasar. Grid dan elevasi berikut menjadi acuan geometri model struktur.`);
  addTable("grid-x"); addTable("grid-y"); addTable("story-data");
  section("1.2.2", "Gambar Rencana");
  narrative("Denah grid, elevasi tingkat, dan perspektif tiga dimensi berikut disusun dari data geometri bangunan. Gambar berfungsi sebagai kontrol awal sebelum pemodelan rinci dilakukan.");
  addFigure("plan-grid"); addFigure("story-elevation"); addFigure("model-3d");
  section("1.3", "Diagram Alir Perencanaan");
  narrative("Tahapan perencanaan mencakup pengumpulan data, penetapan geometri dan material, penyusunan pembebanan dan ketahanan gempa, serta penyiapan model ETABS untuk diperiksa sebelum analisis.");
  blocks.push(sourceTable({ id: "workflow", headers: ["Urutan", "Tahap", "Keluaran"], rows: [[1, "Data bangunan", "Fungsi, lokasi, geometri"], [2, "Material", "Beton dan tulangan"], [3, "Pembebanan", "Beban dan assignment"], [4, "Ketahanan gempa", "Spektrum, KDS, Cs, V, Fx"], [5, "Pemodelan ETABS", "Grid, story, load case, kombinasi"]] }, standardTable));
  section("1.4", "Dasar-Dasar Perencanaan");
  narrative("Perencanaan memenuhi persyaratan kekuatan, kemampuan layan, stabilitas, daktilitas, dan durabilitas. Nilai input serta hasil perhitungan disajikan agar dapat ditelusuri.");
  section("1.4.1", "Peraturan yang Digunakan");
  narrative("Perencanaan mengacu pada SNI 2847:2019 untuk beton struktural, SNI 1727:2020 untuk beban desain minimum, serta SNI 1726:2019 untuk ketahanan gempa.");
  narrative("Parameter default dan asumsi teknis yang digunakan pada tahap pra-analisis disajikan pada tabel berikut.");
  blocks.push(
    caption("Tabel", "Daftar Asumsi dan Nilai Default Perencanaan"),
    sourceTable({
      id: "assumptions-defaults",
      headers: ["Kategori", "Parameter", "Nilai Aktif", "Status", "Rujukan Standar", "Catatan"],
      rows: deriveAssumptionsAndDefaults(bundle).map((item) => [
        item.category,
        item.parameter,
        item.value,
        item.status === "DEFAULT_SNI" ? "Default SNI" : "Override Pengguna",
        item.standard_ref,
        item.note,
      ]),
    }, standardTable),
    paragraph("", "3Normal", { firstLine: false })
  );

  chapter("II", "MATERIAL DAN PEMBEBANAN");
  section("2.1", "Konsep Perancangan Struktur Beton Bertulang");
  narrative("Struktur beton bertulang memanfaatkan beton untuk menahan gaya tekan dan tulangan baja untuk menahan gaya tarik. Sistem struktur dipilih agar memiliki kekuatan, kekakuan, dan daktilitas yang memadai terhadap beban gravitasi maupun beban lateral.");
  narrative("Mutu beton, mutu tulangan, selimut, serta pilihan diameter tulangan ditetapkan sebagai dasar perencanaan elemen. Dimensi dan detailing akhir elemen ditentukan setelah hasil analisis struktur tersedia.");
  section("2.2", "Material Properties"); addTable("material-properties"); addTable("reinforcement-diameters");
  section("2.3", "Pembebanan");
  narrative("Pembebanan struktur ditetapkan berdasarkan fungsi bangunan dan ketentuan yang berlaku. Setiap beban memiliki besaran, sumber, asumsi, bentuk aplikasi, dan target penerapan yang digunakan sebagai dasar pemodelan.");
  addTable("load-summary"); addTable("load-assignments");
  section("2.3.1", "Beban Mati"); loadNarrative("SELF_WEIGHT", "Beban mati sendiri"); loadNarrative("SUPERIMPOSED_DEAD", "Beban mati tambahan");
  section("2.3.2", "Beban Hidup"); loadNarrative("LIVE", "Beban hidup");
  section("2.3.3", "Beban Angin"); loadNarrative("WIND", "Beban angin");
  section("2.3.4", "Beban Hidup Atap"); loadNarrative("ROOF_LIVE", "Beban hidup atap");
  section("2.3.5", "Beban Hujan"); loadNarrative("RAIN", "Beban hujan");
  section("2.3.6", "Beban Gempa");
  narrative("Beban gempa ditentukan dengan metode statik ekivalen dan spektrum respons desain sesuai SNI 1726:2019. Tahapan perhitungan meliputi penetapan parameter gempa, pembentukan spektrum desain, penentuan Kategori Desain Seismik, pemilihan sistem struktur, periode fundamental, koefisien respons seismik, gaya geser dasar, dan distribusi gaya lateral per tingkat.");
  addTable("seismic-input-provenance");
  section("2.3.6.1", "Parameter Spektrum Respons Desain");
  addTable("seismic-spectrum");
  const spectrum = handoff.result?.spectrum;
  if (spectrum) {
    blocks.push(...equationTriplet("SMS = Fa × Ss", `SMS = ${number(handoff.rawSeismic.fa)} × ${number(handoff.rawSeismic.ss)}`, `SMS = ${number(spectrum.sms.value)} g`));
    blocks.push(...equationTriplet("SM1 = Fv × S1", `SM1 = ${number(handoff.rawSeismic.fv)} × ${number(handoff.rawSeismic.s1)}`, `SM1 = ${number(spectrum.sm1.value)} g`));
    blocks.push(...equationTriplet("SDS = ⅔ × SMS", `SDS = ⅔ × ${number(spectrum.sms.value)}`, `SDS = ${number(spectrum.sds.value)} g`));
    blocks.push(...equationTriplet("SD1 = ⅔ × SM1", `SD1 = ⅔ × ${number(spectrum.sm1.value)}`, `SD1 = ${number(spectrum.sd1.value)} g`));
    blocks.push(...equationTriplet("T0 = 0,2 × SD1 / SDS", `T0 = 0,2 × ${number(spectrum.sd1.value)} / ${number(spectrum.sds.value)}`, `T0 = ${number(spectrum.t0.value)} detik`));
    blocks.push(...equationTriplet("Ts = SD1 / SDS", `Ts = ${number(spectrum.sd1.value)} / ${number(spectrum.sds.value)}`, `Ts = ${number(spectrum.ts.value)} detik`));
  }
  addFigure("response-spectrum");
  section("2.3.6.2", "Kategori Desain Seismik");
  narrative(`Kategori risiko bangunan ditetapkan sebagai kategori ${handoff.rawSeismic.risk_category}. Kategori Desain Seismik ditentukan dari pemeriksaan nilai SDS dan SD1, dengan hasil yang lebih berat sebagai kategori pengendali.`); addTable("seismic-kds");
  section("2.3.6.3", "Sistem Struktur dan Parameter Desain");
  narrative(`Sistem penahan gaya seismik yang digunakan adalah ${handoff.selectedSystem?.label ?? "—"}. Parameter desain sistem ditunjukkan pada tabel berikut.`); addTable("seismic-system");
  section("2.3.6.4", "Periode Fundamental Struktur"); addTable("seismic-period");
  const period = handoff.result?.period;
  const parameters = handoff.result?.system_parameters;
  if (period && parameters) {
    const height = Math.max(...bundle.geometry.stories.map(({ elevation }) => elevation)) - Math.min(...bundle.geometry.stories.map(({ elevation }) => elevation));
    blocks.push(...equationTriplet("Ta = Ct × hnˣ", `Ta = ${number(parameters.Ct.value, 4)} × ${number(height)}^${number(parameters.x.value)}`, `Ta = ${number(period.ta.value, 4)} detik`));
    blocks.push(...equationTriplet("Tmax = Cu × Ta", `Tmax = ${number(period.cu.value)} × ${number(period.ta.value, 4)}`, `Tmax = ${number(period.tmax.value, 4)} detik`));
  }
  section("2.3.6.5", "Koefisien Respons dan Gaya Geser Dasar"); addTable("seismic-cs"); addTable("seismic-weight"); addTable("seismic-base-shear");
  const response = handoff.result?.response_coefficient;
  const seismicWeight = handoff.result?.seismic_weight;
  const baseShear = handoff.result?.base_shear;
  if (response && seismicWeight && baseShear && spectrum && parameters) {
    blocks.push(...equationTriplet("Cs = SDS / (R / Ie)", `Cs = ${number(spectrum.sds.value)} / (${number(parameters.R.value)} / 1,000)`, `Cs = ${number(response.governing.value, 4)}`));
    blocks.push(...equationTriplet("V = Cs × W", `V = ${number(response.governing.value, 4)} × ${number(seismicWeight.value)}`, `V = ${number(baseShear.value)} kN`));
  }
  section("2.3.6.6", "Distribusi Gaya Lateral per Tingkat");
  narrative("Gaya geser dasar didistribusikan pada setiap tingkat berdasarkan berat tingkat, elevasi terhadap dasar, dan eksponen distribusi. Jumlah koefisien distribusi vertikal sama dengan satu dan jumlah gaya tingkat sama dengan gaya geser dasar."); addTable("story-forces");

  chapter("III", "PERMODELAN STRUKTUR");
  section("3.1", "Model Struktur dengan ETABS");
  narrative("Analisis struktur dilakukan menggunakan perangkat lunak ETABS setelah data geometri, material, pembebanan, dan ketahanan gempa tersedia. Model harus diperiksa terhadap connectivity, diaphragm, kekakuan efektif, mass source, load case, dan asumsi pemodelan sebelum analisis dijalankan.");
  section("3.1.1", "Data Umum Bangunan"); addTable("project-data"); addTable("story-data");
  section("3.1.2", "Pembuatan Grid");
  narrative("Grid model dibuat dari ordinat arah X dan Y serta elevasi tingkat yang telah ditetapkan. Data berikut digunakan sebagai acuan pada menu Grid Systems dan Story Data ETABS."); addTable("grid-x"); addTable("grid-y"); addFigure("etabs-grid-reference");
  section("3.2", "Permodelan Material dan Penampang");
  narrative("Definisi material mengikuti data pada BAB II. Dimensi penampang, kekakuan efektif, dan assignment elemen ditetapkan serta diperiksa pada model ETABS sebelum analisis."); addFigure("etabs-material-reference");
  section("3.3", "Permodelan Perletakan Pondasi");
  narrative("Kondisi tumpuan dan restraint ditetapkan sesuai sistem pondasi dan idealisasi interaksi tanah-struktur. Penetapan tersebut harus diperiksa oleh perencana pada model ETABS."); addFigure("etabs-restraint-reference");
  section("3.4", "Pembuatan Load Pattern");
  narrative("Load pattern disusun berdasarkan jenis beban yang bekerja. Self-weight multiplier diperiksa agar berat sendiri tidak dihitung ganda."); addTable("etabs-patterns"); addFigure("etabs-load-pattern-reference");
  section("3.5", "Aplikasi Beban pada Struktur melalui ETABS");
  narrative("Beban diterapkan pada elemen area atau garis sesuai target assignment. Arah, sistem koordinat, luas tributari, dan satuan diperiksa pada model."); addTable("load-assignments"); addFigure("etabs-load-assignment-reference");
  section("3.6", "Load Cases dan Response Spectrum");
  narrative("Load case gravitasi dan gempa disusun dari pola beban yang telah didefinisikan. Damping, arah eksitasi, modal case, faktor skala, dan metode kombinasi modal ditetapkan serta diverifikasi pada ETABS."); addTable("etabs-cases"); addFigure("etabs-load-case-reference");
  section("3.7", "Kombinasi Beban");
  narrative("Kombinasi pembebanan berikut digunakan sebagai referensi penyusunan kombinasi pada ETABS. Analisis respons struktur terhadap kombinasi dilakukan pada tahap analisis model.");
  const comboMeta = tableMeta.get("load-combinations");
  blocks.push(caption("Tabel", comboMeta?.effective_caption ?? "Kombinasi Beban"), combinationTable); addFigure("etabs-combination-reference");
  section("3.8", "Ringkasan Kesiapan Model");
  narrative("Daftar berikut digunakan untuk memeriksa kelengkapan data sebelum analisis struktur dijalankan. Item yang memerlukan peninjauan tetap menjadi tanggung jawab perencana pada model ETABS."); addTable("etabs-readiness");

  const documentXml = `${body.prefix}${cover.join("")}${frontMatter.join("")}${frontSection}${blocks.join("")}${finalSection}${body.suffix}`;
  files.set("word/document.xml", encoder.encode(documentXml));
  const relationshipsName = "word/_rels/document.xml.rels";
  const relationships = decoder.decode(files.get(relationshipsName)).replace("</Relationships>", `${media.map(({ media: item }) => `<Relationship Id="${item.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${item.name}"/>`).join("")}</Relationships>`);
  files.set(relationshipsName, encoder.encode(relationships));
  for (const { media: item } of media) files.set(`word/media/${item.name}`, item.data);
  const settingsName = "word/settings.xml";
  let settings = decoder.decode(files.get(settingsName));
  settings = settings.includes("<w:updateFields") ? settings.replace(/<w:updateFields[^>]*\/>/, '<w:updateFields w:val="true"/>') : settings.replace("<w:hdrShapeDefaults", '<w:updateFields w:val="true"/><w:hdrShapeDefaults');
  files.set(settingsName, encoder.encode(settings));
  const coreName = "docProps/core.xml";
  const core = decoder.decode(files.get(coreName)).replace(/<dc:title>[\s\S]*?<\/dc:title>/, `<dc:title>${xml(bundle.project.title)} — Laporan Perhitungan Struktur</dc:title>`);
  files.set(coreName, encoder.encode(core));
  return zip([...files].map(([name, data]) => ({ name, data })));
}
