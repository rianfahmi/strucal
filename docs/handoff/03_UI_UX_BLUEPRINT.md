# UI/UX BLUEPRINT

## Product Character
Professional engineering workspace. Dense namun readable. Jangan terasa seperti consumer/marketing dashboard.

## Layout
Desktop-first, responsive tablet. Mobile untuk review/basic input; technical tables boleh contained horizontal scroll.

## Value Provenance
Badge universal: INPUT, AUTO, INHERITED, CODE, SELECTED, OVERRIDE.

## Calculation Detail Drawer
Klik computed value → Formula, Formula ID, Substitution, Result, Unit, Source Inputs, Standard Reference, Engine Version, Registry Version.

## Validation
Status visual: valid, warning, error, stale, review required. Tidak ada hijau hanya karena angka terisi.

## Geometry Workspace
Split layout: editor/table kiri, persistent viewer kanan.
Viewer toolbar: Plan, Elevation, 3D, Fit, Reset, Zoom.

Plan: story selector, grid labels, dimensions, framing.
Elevation: grid-line selector, story elevations/heights, framing.
3D: orbit/rotate, pan, zoom, fit/reset, wireframe.

## Analisa Gempa
Bukan satu form besar.

Step 1 Input Dasar — raw inputs saja.
Step 2 Parameter Spektrum — auto calculation cards.
Step 3 Review KDS — table-driven classification + governing KDS.
Step 4 Review Sistem Struktur — matrix allowed/conditional/blocked + reason + reference, lalu selector valid.
Step 5 Hasil — period/coefficient/seismic weight/base shear/check cards.
Step 6 Spectrum — graph + table.
Step 7 Story Distribution — technical table.

## Input ETABS
Read-only handoff sheet. Tiap section copy/export friendly. Checklist READY/INCOMPLETE.

## Generate Pages
Show: report scope, revision, warnings, generate buttons, history.

## Empty State
Jelaskan prerequisite spesifik. Contoh: “Analisa Gempa belum dapat dihitung karena Site Class belum dipilih.”

## Stale State
Contoh: “Grid System berubah setelah ETABS Snapshot #2. Hasil ETABS dan desain downstream perlu diperbarui.”

## Tables
Sticky header, compact density, unit di header, deterministic sorting, filter where useful, no page-level horizontal overflow.

## Accessibility
Keyboard navigation, semantic labels, linked errors, AA target, status tidak bergantung warna saja.
