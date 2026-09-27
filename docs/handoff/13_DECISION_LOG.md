# DECISION LOG

## Product
- V1 beton bertulang.
- Calculation engine, bukan report-filling tool.
- ETABS eksternal.
- 3 stage, 2 generate checkpoint.

## Geometry
- ETABS-familiar Grid System.
- X/Y spacing atau ordinate.
- Story Data terpisah.
- Plan, Elevation, 3D.
- Viewer bukan FEM analysis.

## Seismic
- Minimal raw input.
- Engine derives downstream values.
- KDS review harus terlihat.
- Structural system bukan early unrestricted dropdown.
- Eligibility dievaluasi setelah KDS dan kondisi relevan.
- Invalid systems terlihat tapi disabled.
- Code coefficients auto lookup setelah valid system selected.

## Standards
- Project baru default latest active verified registry.
- Existing revision pinned.
- Verified 27 Sep 2026 baseline active: SNI 1726:2019, SNI 1727:2020, SNI 2847:2019.
- Jangan label seismic standard sebagai SNI 1726:2022 tanpa official verification.

## ETABS
- Tahap 1 menghasilkan ETABS Input Summary.
- Hasil ETABS kembali ke website pada Tahap 2.
- Exact import template harus dibekukan sebelum coding importer.

## Reports
- Sidebar: Generate #1, Generate #2.
- Generate #1 = production milestone v0.1.

## Git/Deployment
- GitHub dibuat saat project start.
- GitHub canonical.
- Commit per logical task.
- Push per completed stage/milestone.
- main production.
- Railway connected from M0.
- Generate #1 harus sudah published via Railway.

## Codex Behavior
Concise, current task only, clear DoD, commit after task, stop after completion, no repetitive summaries, no unrelated refactors.
