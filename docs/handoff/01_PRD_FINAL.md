# PRD FINAL — KALKULATOR STRUKTUR BETON BERTULANG V1

## 1. Product Definition
Aplikasi web untuk membantu engineer menghitung struktur beton bertulang dari input minimum, menyusun input teknis yang diperlukan untuk ETABS, menerima kembali hasil analisis ETABS, menghitung desain elemen, dan menghasilkan laporan formal.

Website **bukan ETABS mini**. Analisis global tetap dilakukan di ETABS.

## 2. Product Principle
**Minimal Input → Maximum Deterministic Calculation → Transparent Engineering Output**

Sumber nilai harus jelas: USER INPUT, INHERITED, CODE LOOKUP, CALCULATED, ENGINEERING SELECTION, dan OVERRIDE bila kelak diizinkan.

## 3. Workflow
### Tahap 1 — Parameter Awal
Input: data proyek, Grid System X/Y, Story Data, section/element definition, material, pembebanan, parameter dasar gempa.

Engine: validasi geometri, hitung pembebanan, hitung analisa gempa, tentukan KDS, review sistem struktur yang diizinkan, hitung parameter sistem terpilih, susun ringkasan input ETABS.

Output: Geometry Viewer, calculation results, ETABS Input Summary, **Generate #1**.

### Tahap 2 — Hasil Analisis ETABS
Import hasil ETABS, normalisasi unit, mapping elemen, validasi combo/station/orientation, pembentukan envelope.

### Tahap 3 — Desain
Balok, kolom, SCWB, pondasi terpilih, Rekap Desain, **Generate #2**.

## 4. Geometry System
Grid mengikuti pola kerja familiar ETABS.
- Grid X/Y: Spacing atau Ordinate.
- Grid tidak seragam didukung.
- Story Data: Story name, Height, Elevation.
- Viewer: Plan View, Elevation View, 3D View.
- Viewer untuk validasi geometri, bukan analytical FEM model.

## 5. Material
- Beton: fc', density, cover, derived Ec sesuai registry/formula.
- Rebar longitudinal: fy.
- Rebar transversal: fys.
- Daftar diameter tulangan.

## 6. Pembebanan
Kategori minimum: Self Weight, Superimposed Dead Load, Live Load, Roof Live Load, Wind, Rain, seismic-related load definitions, kombinasi pembebanan dari code registry.

Setiap load menyimpan value, unit, source, application, assumption, revision.

## 7. Analisa Gempa
User hanya memberi parameter dasar yang memang harus berasal dari proyek/sumber eksternal. Engine menghitung parameter turunan.

Pipeline:
1. Validasi raw input.
2. Lookup koefisien spektrum/site dari registry.
3. Hitung parameter spektrum desain.
4. Tentukan KDS dari rule tabel standar.
5. Tampilkan review KDS dan governing result.
6. Evaluasi sistem struktur yang diizinkan.
7. User memilih salah satu sistem valid.
8. Lookup R, Ω0, Cd, Ct, x dan parameter terkait.
9. Period checks.
10. Seismic coefficient, base shear, vertical distribution.
11. Response spectrum table/graph.
12. Checks tambahan registry V1.

### KDS Review
Harus memperlihatkan input, hasil rule/tabel, KDS pengendali, dan referensi.

### Structural System Review
Bukan dropdown bebas. Status: available, conditional, blocked. Opsi invalid tetap terlihat untuk review, tetapi tidak dapat dipilih.

## 8. ETABS Input Summary
Generated output Tahap 1, bukan input ulang:
- Grid System
- Story Data
- Material Properties
- Section Properties
- Element/layout assumptions
- Boundary/Restraint
- Load Patterns
- Load Assignments
- Seismic Parameters
- Load Cases
- Load Combinations
- Readiness Checklist

## 9. Generate #1
Menu sidebar: **Generate #1**.
Output DOCX + PDF dari snapshot yang sama.
Isi: Front Matter, Bab I Pendahuluan, Bab II Material & Pembebanan, Bab III Permodelan/Input ETABS sampai sebelum hasil analisis ETABS.

## 10. Hasil ETABS
Raw import immutable per snapshot. Envelope harus traceable ke source row.

Beam target envelope:
- Mu negatif kiri
- Mu negatif kanan
- Mu positif lapangan
- Vu governing

Column target envelope:
- kondisi Pu terbesar + Mux + Muy
- kondisi momen terbesar + Pu + Mux + Muy

## 11. Desain Balok
Tumpuan kiri, lapangan, tumpuan kanan, flexure, shear, reinforcement selection, demand/capacity, governing combo, formula trail.

## 12. Desain Kolom
Axial-biaxial demand, reinforcement, capacity, ratio/status, method explicitly stated.

## 13. SCWB
Joint-based check, column/beam moment capacities, ratio, criterion, status, traceable source inputs.

## 14. Pondasi
Empat module tersedia, user memilih satu per case/project:
- footplate
- driven pile + pilecap
- bored pile + pilecap
- cerucuk galam

## 15. Generate #2
Laporan lengkap: front matter, Bab I–III termasuk hasil ETABS dan rekap gaya, Bab IV desain, Kesimpulan, Lampiran, audit/version metadata.

## 16. Status Engineering
Allowed: OK, TIDAK MEMENUHI, BELUM DIHITUNG, PERLU REVIEW. Tidak ada default OK.

## 17. Invalidasi Downstream
Perubahan upstream menandai downstream stale. Contoh: Geometry berubah → ETABS result stale → Envelope stale → Design stale → Generate #2 stale.

## 18. Auditability
Setiap hasil penting: formula, substitution, unit, source, standard reference, Formula ID, engine version, registry version, input hash.

## 19. Output Naming
Sidebar menggunakan Generate #1 dan Generate #2, bukan nama bab sebagai menu utama.
