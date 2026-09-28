import assert from "node:assert/strict";
import test from "node:test";
import { generateReportDocx } from "../src/lib/report-docx.ts";
import { createReportSnapshot, createReportWorkspace, isReportSnapshotStale, updateFigure, updateTableCaption, validateReport } from "../src/lib/report.ts";
import { reviseGeometry } from "../src/lib/projects.ts";
import { completeProjectBundle } from "./fixtures/complete-project.ts";

const createSnapshot = () => {
  const bundle = completeProjectBundle();
  const workspace = createReportWorkspace(bundle);
  const snapshot = createReportSnapshot(bundle, workspace, () => "snapshot-1", () => "2026-09-28T01:00:00.000Z");
  return { bundle, workspace, snapshot };
};

test("report template map berhenti pada BAB III handoff", () => {
  const { workspace } = createSnapshot();
  assert.equal(workspace.sections.length, 14);
  assert.equal(workspace.template_fidelity_status, "UNVERIFIED_REFERENCE_MISSING");
  assert.deepEqual([...new Set(workspace.sections.map(({ chapter }) => chapter))], ["FRONT MATTER", "BAB I", "BAB II", "BAB III"]);
  assert.ok(!workspace.sections.some(({ chapter }) => chapter === "BAB IV"));
  assert.equal(validateReport(workspace).status, "READY");
});

test("snapshot mem-pin semua revisi dan menjadi stale setelah perubahan upstream", () => {
  const { bundle, snapshot } = createSnapshot();
  assert.equal(snapshot.project_revision, "revision-1");
  assert.equal(snapshot.geometry_revision, "revision-1");
  assert.equal(snapshot.material_revision, "revision-1");
  assert.equal(snapshot.load_revision, "revision-1");
  assert.equal(snapshot.seismic_revision, "revision-1");
  assert.ok(snapshot.source_input_hash);
  assert.equal(isReportSnapshotStale(snapshot, bundle), false);
  const changed = reviseGeometry(bundle, { ...bundle.geometry, grid_x: bundle.geometry.grid_x.map((line, index) => index === 1 ? { ...line, ordinate: 7 } : line) }, "manual", () => "revision-2");
  assert.equal(isReportSnapshotStale(snapshot, changed), true);
});

test("metadata gambar, upload override, fallback sistem, dan caption bertahan saat reopen", () => {
  const { workspace } = createSnapshot();
  const captioned = updateFigure(workspace, "plan-grid", { caption_override: "Denah grid revisi engineer", uploaded_asset_reference: "asset-1" });
  const uploaded = captioned.figures.find(({ figure_id }) => figure_id === "plan-grid")!;
  assert.equal(uploaded.source_type, "USER_UPLOAD");
  assert.equal(uploaded.effective_caption, "Denah grid revisi engineer");
  const reopened = structuredClone(captioned);
  assert.equal(reopened.figures.find(({ figure_id }) => figure_id === "plan-grid")?.uploaded_asset_reference, "asset-1");
  const fallback = updateFigure(reopened, "plan-grid", { uploaded_asset_reference: null });
  assert.equal(fallback.figures.find(({ figure_id }) => figure_id === "plan-grid")?.source_type, "AUTO_GENERATED");
});

test("caption tabel memakai id stabil dan override tersimpan", () => {
  const { workspace } = createSnapshot();
  const changed = updateTableCaption(workspace, "story-data", "Data tingkat bangunan");
  const table = changed.tables.find(({ table_id }) => table_id === "story-data")!;
  assert.equal(table.effective_caption, "Data tingkat bangunan");
  assert.equal(structuredClone(changed).tables.find(({ table_id }) => table_id === "story-data")?.caption_override, "Data tingkat bangunan");
});

test("DOCX memuat heading Word, field caption, TOC, daftar gambar/tabel, dan konten Stage 1", () => {
  const { bundle, snapshot } = createSnapshot();
  const docx = generateReportDocx({ bundle, snapshot, assets: [] });
  const packageText = new TextDecoder().decode(docx);
  assert.equal(String.fromCharCode(...docx.slice(0, 2)), "PK");
  assert.ok(docx.length > 20_000);
  assert.match(packageText, /w:styleId="Heading1"/);
  assert.match(packageText, /SEQ Gambar \\[*] ARABIC/);
  assert.match(packageText, /SEQ Tabel \\[*] ARABIC/);
  assert.match(packageText, /TOC \\o &quot;1-3&quot;/);
  assert.match(packageText, /TOC \\h \\z \\c &quot;Gambar&quot;/);
  assert.match(packageText, /TOC \\h \\z \\c &quot;Tabel&quot;/);
  assert.match(packageText, /StruCal tidak menghitung respons struktur dari kombinasi tersebut/);
  assert.match(packageText, /Belum dimuat dari dokumen referensi/);
  assert.doesNotMatch(packageText, /BAB IV|Reaksi Tumpuan|Gaya Dalam Elemen|Hasil Modal ETABS/);
  assert.equal(packageText.match(/<w:tbl>/g)?.length, 13);
});

test("gambar upload menggantikan media sistem pada DOCX", () => {
  const bundle = completeProjectBundle();
  const workspace = updateFigure(createReportWorkspace(bundle), "plan-grid", { uploaded_asset_reference: "asset-1" });
  const snapshot = createReportSnapshot(bundle, workspace, () => "snapshot-upload", () => "2026-09-28T01:00:00.000Z");
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgQIAH0o4WQAAAABJRU5ErkJggg==";
  const docx = generateReportDocx({ bundle, snapshot, assets: [{ asset_id: "asset-1", project_id: bundle.project.id, file_name: "plan.png", mime_type: "image/png", data_url: `data:image/png;base64,${png}`, created_at: "2026-09-28T00:30:00.000Z" }] });
  assert.ok(Buffer.from(docx).includes(Buffer.from(png, "base64")));
});
