import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { generateReportDocx } from "../src/lib/report-docx.ts";
import { createReportSnapshot, createReportWorkspace } from "../src/lib/report.ts";
import { completeProjectBundle } from "../tests/fixtures/complete-project.ts";

const bundle = completeProjectBundle();
const workspace = createReportWorkspace(bundle);
const snapshot = createReportSnapshot(bundle, workspace, () => "m8-fixture-snapshot", () => "2026-09-28T01:00:00.000Z");
const output = resolve("artifacts", "m8", snapshot.file_name);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, generateReportDocx({ bundle, snapshot, assets: [] }));
console.log(output);
