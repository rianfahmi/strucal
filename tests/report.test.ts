import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { inflateRawSync } from "node:zlib";
import { generateReportDocx } from "../src/lib/report-docx.ts";
import { REPORT_MASTER_FILE, REPORT_MASTER_SHA256, REPORT_TEMPLATE_MANIFEST } from "../src/lib/report-template-manifest.ts";
import { createReportSnapshot, createReportWorkspace, isReportSnapshotStale, updateFigure, updateTableCaption, validateReport } from "../src/lib/report.ts";
import { reviseGeometry } from "../src/lib/projects.ts";
import { completeProjectBundle } from "./fixtures/complete-project.ts";

const decoder = new TextDecoder();
const masterPath = resolve("templates", REPORT_MASTER_FILE);

function unzip(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let eocd = data.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd -= 1;
  assert.ok(eocd >= 0, "ZIP central directory tidak ditemukan");
  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const files = new Map<string, Uint8Array>();
  for (let index = 0; index < count; index += 1) {
    assert.equal(view.getUint32(cursor, true), 0x02014b50);
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(data.subarray(cursor + 46, cursor + 46 + nameLength));
    const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    const compressed = data.subarray(start, start + compressedSize);
    files.set(name, method === 0 ? compressed.slice() : inflateRawSync(compressed));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

const text = (files: Map<string, Uint8Array>, name: string) => decoder.decode(files.get(name));
const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex").toUpperCase();

const createSnapshot = () => {
  const bundle = completeProjectBundle();
  const workspace = createReportWorkspace(bundle);
  const snapshot = createReportSnapshot(bundle, workspace, () => "snapshot-1", () => "2026-09-28T01:00:00.000Z");
  return { bundle, workspace, snapshot };
};

test("manifest template mengklasifikasikan KEEP, REPLACE, REMOVE_SUBSTITUTE, dan REMOVE hingga BAB III", () => {
  const { workspace } = createSnapshot();
  assert.equal(REPORT_TEMPLATE_MANIFEST.strategy, "CLONE_PATCH");
  assert.deepEqual(new Set(REPORT_TEMPLATE_MANIFEST.sections.map(({ behavior }) => behavior)), new Set(["KEEP", "REPLACE", "REMOVE_SUBSTITUTE", "REMOVE"]));
  assert.equal(workspace.sections.length, 30);
  assert.equal(workspace.template_fidelity_status, "VERIFIED_REFERENCE_MAP");
  assert.equal(workspace.template_reference, REPORT_MASTER_FILE);
  assert.deepEqual([...new Set(workspace.sections.map(({ chapter }) => chapter))], ["FRONT MATTER", "BAB I", "BAB II", "BAB III"]);
  assert.ok(!workspace.sections.some(({ chapter }) => chapter === "BAB IV"));
  assert.equal(validateReport(workspace).status, "READY");
});

test("snapshot mem-pin revisi dan menjadi stale setelah perubahan upstream", () => {
  const { bundle, snapshot } = createSnapshot();
  assert.equal(snapshot.project_revision, "revision-1");
  assert.ok(snapshot.source_input_hash);
  assert.equal(isReportSnapshotStale(snapshot, bundle), false);
  const changed = reviseGeometry(bundle, { ...bundle.geometry, grid_x: bundle.geometry.grid_x.map((line, index) => index === 1 ? { ...line, ordinate: 7 } : line) }, "manual", () => "revision-2");
  assert.equal(isReportSnapshotStale(snapshot, changed), true);
});

test("caption gambar/tabel dan upload override bertahan saat reopen", () => {
  const { workspace } = createSnapshot();
  const captioned = updateFigure(workspace, "plan-grid", { caption_override: "Denah grid revisi engineer", uploaded_asset_reference: "asset-1" });
  const uploaded = captioned.figures.find(({ figure_id }) => figure_id === "plan-grid")!;
  assert.equal(uploaded.source_type, "USER_UPLOAD");
  assert.equal(uploaded.effective_caption, "Denah grid revisi engineer");
  const fallback = updateFigure(structuredClone(captioned), "plan-grid", { uploaded_asset_reference: null });
  assert.equal(fallback.figures.find(({ figure_id }) => figure_id === "plan-grid")?.source_type, "AUTO_GENERATED");
  const table = updateTableCaption(workspace, "story-data", "Data tingkat bangunan");
  assert.equal(structuredClone(table).tables.find(({ table_id }) => table_id === "story-data")?.caption_override, "Data tingkat bangunan");
});

test("DOCX mengklon paket master, mempatch data proyek, dan tidak mengubah master", () => {
  const masterBefore = readFileSync(masterPath);
  assert.equal(sha256(masterBefore), REPORT_MASTER_SHA256);
  const { bundle, snapshot } = createSnapshot();
  const output = generateReportDocx({ bundle, snapshot, assets: [] });
  const master = unzip(masterBefore);
  const generated = unzip(output);
  assert.equal(sha256(readFileSync(masterPath)), REPORT_MASTER_SHA256);
  for (const name of ["word/styles.xml", "word/theme/theme1.xml", "word/numbering.xml", "word/footer1.xml", "word/footer2.xml"]) {
    assert.deepEqual(generated.get(name), master.get(name), `${name} harus identik dengan master`);
  }
  const document = text(generated, "word/document.xml");
  assert.match(document, /GEDUNG A/);
  assert.match(document, /Bandung/);
  assert.match(text(generated, "word/settings.xml"), /<w:updateFields w:val="true"\/>/);
});

test("DOCX mempertahankan field, heading satu paragraf dengan line break, OMML, dan format Indonesia", () => {
  const { bundle, snapshot } = createSnapshot();
  const document = text(unzip(generateReportDocx({ bundle, snapshot, assets: [] })), "word/document.xml");
  assert.match(document, /TOC \\o &quot;1-3&quot; \\h \\z \\u/);
  assert.match(document, /TOC \\h \\z \\c &quot;Gambar&quot;/);
  assert.match(document, /TOC \\h \\z \\c &quot;Tabel&quot;/);
  assert.match(document, /SEQ Gambar \\[*] ARABIC/);
  assert.match(document, /SEQ Tabel \\[*] ARABIC/);
  assert.match(document, /<w:p><w:pPr><w:pStyle w:val="1BAB"\/>[\s\S]*?<w:t xml:space="preserve">BAB I<\/w:t><w:br\/><w:t xml:space="preserve">PENDAHULUAN<\/w:t>[\s\S]*?<\/w:p>/);
  assert.ok((document.match(/<m:oMathPara>/g)?.length ?? 0) >= REPORT_TEMPLATE_MANIFEST.equations.length * 3);
  for (const formula of ["SMS = Fa × Ss", "T0 = 0,2 × SD1 / SDS", "Ta = Ct × hnˣ", "Cs = SDS / (R / Ie)", "V = Cs × W"]) assert.ok(document.includes(formula));
  assert.match(document, /SDS = ⅔ × 0,900/);
  assert.doesNotMatch(document, /\d+\.\d{5,}/);
});

test("tabel dinamis mengikuti properti tabel sumber dan COMB 1–28 tetap sebagai referensi", () => {
  const master = text(unzip(readFileSync(masterPath)), "word/document.xml");
  const { bundle, snapshot } = createSnapshot();
  const document = text(unzip(generateReportDocx({ bundle, snapshot, assets: [] })), "word/document.xml");
  const sourceTableProperties = master.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0];
  assert.ok(sourceTableProperties);
  assert.ok(document.includes(sourceTableProperties));
  assert.match(document, /COMB 1/);
  assert.match(document, /COMB 28/);
  assert.match(document, /Analisis respons struktur terhadap kombinasi dilakukan pada tahap analisis model/);
  assert.doesNotMatch(document, /Belum dimuat dari registry aktif|kombinasi.*dihitung oleh aplikasi/i);
});

test("gambar upload masuk sebagai media, sedangkan gambar opsional yang hilang tidak membuat placeholder", () => {
  const bundle = completeProjectBundle();
  const workspace = updateFigure(createReportWorkspace(bundle), "plan-grid", { uploaded_asset_reference: "asset-1" });
  const snapshot = createReportSnapshot(bundle, workspace, () => "snapshot-upload", () => "2026-09-28T01:00:00.000Z");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgQIAH0o4WQAAAABJRU5ErkJggg==", "base64");
  const files = unzip(generateReportDocx({ bundle, snapshot, assets: [{ asset_id: "asset-1", project_id: bundle.project.id, file_name: "plan.png", mime_type: "image/png", data_url: `data:image/png;base64,${png.toString("base64")}`, created_at: "2026-09-28T00:30:00.000Z" }] }));
  const uploaded = [...files].find(([name, data]) => name.startsWith("word/media/strucal-figure-") && Buffer.from(data).equals(png));
  assert.ok(uploaded);
  const document = text(files, "word/document.xml");
  assert.doesNotMatch(document, /Slot dokumentasi|unggah gambar|Gambar [^<]*Definisi Material/i);
});

test("DOCX berhenti pada handoff pra-analisis tanpa hasil Stage 2 atau bahasa internal", () => {
  const { bundle, snapshot } = createSnapshot();
  const document = text(unzip(generateReportDocx({ bundle, snapshot, assets: [] })), "word/document.xml");
  assert.match(document, /Ringkasan Kesiapan Model/);
  assert.doesNotMatch(document, /Analysis Result\/Output ETABS|BAB IV|BAB V|Reaksi Tumpuan|Gaya Dalam Elemen|Hasil Modal ETABS/);
  assert.doesNotMatch(document, /Generate #1|\bM[3-7]\b|registry|ENGINEER_APPROVED|source[_ ]hash|debug/i);
  assert.doesNotMatch(document, /Konsep Perancangan Struktur Baja Tahan Gempa/);
});
