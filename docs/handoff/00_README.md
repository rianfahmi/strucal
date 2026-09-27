# STRUCAL — CODEX HANDOFF PACKAGE V1

Tanggal baseline: 27 September 2026

## Tujuan Paket
Paket ini adalah source of truth untuk memulai coding aplikasi web **Kalkulator Struktur Beton Bertulang V1** dengan Codex.

Produk bukan sekadar generator laporan. Produk adalah **calculation engine + engineering workflow + report engine** yang menghubungkan:

`Input minimum → Calculation Engine → Generate #1 → ETABS eksternal → Import hasil ETABS → Envelope → Design → Generate #2`

## Hierarki Source of Truth
Jika ada konflik, gunakan urutan ini:
1. Keputusan eksplisit user yang terbaru.
2. Dokumen dalam paket ini.
3. PRD hasil audit.
4. File Word/Excel referensi proyek.
5. Asumsi implementasi agent.

Jangan menaikkan asumsi menjadi requirement tanpa mencatatnya.

## Scope V1
- Beton bertulang.
- ETABS tetap dijalankan di luar website.
- 3 tahap workflow.
- 2 checkpoint generate.
- Geometry model berbasis Grid System + Story Data.
- Plan View, Elevation View, 3D View.
- Material, pembebanan, analisa gempa.
- ETABS Input Summary.
- Hasil ETABS, envelope, desain balok, kolom, SCWB, pondasi.
- DOCX/PDF.

## Non-scope V1
- Engine analisis global pengganti ETABS.
- Baja/mixed structure sebagai modul desain produksi.
- Integrasi langsung API ETABS.
- Pelat/dinding geser sebagai modul desain utama V1, kecuali diaktifkan kemudian melalui perubahan scope.

## Target Delivery Bertahap
Milestone produksi pertama: **Generate #1 sudah live di Railway**.

GitHub adalah canonical source of truth sejak awal project. Local dipakai untuk development/testing.

## Dokumen Paket
- 01_PRD_FINAL.md
- 02_APP_FLOW_IA.md
- 03_UI_UX_BLUEPRINT.md
- 04_CALCULATION_ENGINE_SPEC.md
- 05_CODE_REGISTRY_SNI.md
- 06_DATA_MODEL.md
- 07_ETABS_DATA_CONTRACT.md
- 08_REPORT_SPEC.md
- 09_TEST_AND_ACCEPTANCE.md
- 10_GIT_GITHUB_RAILWAY.md
- 11_IMPLEMENTATION_PLAN.md
- 12_CODEX_MASTER_PROMPT.md
- 13_DECISION_LOG.md
- tasks.yaml

## Aturan Safety Engineering
Template Excel/Word lama adalah referensi workflow, formula, tampilan dan benchmark, **bukan engine produksi yang boleh disalin mentah**.
Semua formula produksi harus typed-units, deterministik, memiliki Formula ID, standard/code registry version, test fixture, audit trail, dan review engineer sebelum production use.
