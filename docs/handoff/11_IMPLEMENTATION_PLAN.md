# IMPLEMENTATION PLAN — TOKEN-EFFICIENT TASKING

## Global Protocol
`READ MINIMUM SPEC → IMPLEMENT CURRENT TASK → TEST → FIX TASK-RELATED FAILURES → COMMIT → PUSH WHEN REQUIRED → STOP`

Jangan narrate routine work. Jangan restate PRD. Jangan kerja di modul lain. Jangan refactor unrelated code kecuali wajib untuk task.

Completion report hanya:
TASK: <id> COMPLETE
Changed: <short list>
Tests: <status>
Build: <status/not run>
Commit: <hash>
Push: <branch/status/not required>
Blockers: none

Blocker: attempt likely fix once, retry once, lalu stop dan laporkan exact error + attempt + required decision.

## M0 — Foundation
M0.1 GitHub repo + app + checks + commit/push.
M0.2 Railway connection + health deploy.
DoD: GitHub canonical + Railway baseline live.

## M1 — App Shell
M1.1 Sidebar/Header/Project shell.
M1.2 Overview.
DoD: navigation matches IA.

## M2 — Project Persistence
M2.1 Project storage.
M2.2 Revision/audit metadata.
M2.3 Save/reopen.

## M3 — Geometry
M3.1 Grid model.
M3.2 Grid editor spacing/ordinate.
M3.3 Story Data.
M3.4 Plan View.
M3.5 Elevation View.
M3.6 3D View.
M3.7 Tests.

## M4 — Material
M4.1 domain model.
M4.2 UI.
M4.3 derived properties + tests.

## M5 — Loads
M5.1 model.
M5.2 assignments.
M5.3 seismic weight.
M5.4 combination registry.
M5.5 tests.

## M6 — Seismic
M6.1 raw inputs.
M6.2 site/spectrum.
M6.3 design spectrum.
M6.4 KDS review.
M6.5 system eligibility.
M6.6 selection + code lookup.
M6.7 period/base shear.
M6.8 story distribution.
M6.9 spectrum chart/table.
M6.10 golden fixtures.

## M7 — ETABS Input Summary
M7.1 geometry/material/section summary.
M7.2 load patterns/assignments.
M7.3 seismic/load cases/combinations.
M7.4 readiness checklist.

## M8 — Generate #1
M8.1 ReportSnapshot.
M8.2 DOCX renderer.
M8.3 PDF renderer.
M8.4 validation.
M8.5 production release.
DoD: Generate #1 live on Railway. Tag v0.1-generate-1.

STOP POINT: jangan mulai Stage 2 sebelum acceptance Generate #1 dikonfirmasi.

M9 ETABS Import.
M10 Envelope.
M11 Beam.
M12 Column.
M13 SCWB.
M14 Foundation.
M15 Generate #2.
