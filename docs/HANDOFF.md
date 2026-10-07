# Handoff Branch `input-minimum` — StruCal

## 1. Tujuan & Prinsip
- **Tujuan**: Memangkas friksi input formulir struktur (147 aksi → 22 aksi) dengan parameter minimum dan progressive disclosure.
- **Prinsip**: Default cerdas berbasis SNI (1726:2019, 1727:2020, 2847:2019); rumus kalkulasi lama **tidak diubah** (hanya fungsi aditif); data/fixture lama tetap menghasilkan output identik.

## 2. Status Implementasi (Langkah 1–6)
| Langkah | Hash Commit | Deskripsi | Status |
| :--- | :--- | :--- | :--- |
| Langkah 1 | `07fe8ea` | Jaring pengaman (safety net regression test) | Selesai |
| Langkah 2 | `95b3563` | Material preset (fc', fy, fys ≤ 420 MPa, selimut, diameter) | Selesai |
| Langkah 3 | `141b0c3` | Fa & Fv otomatis dari Tabel 6 & 7 SNI 1726:2019 + override | Selesai |
| Langkah 4 | `5fa85fd` | Shortcut generator bentang & tingkat, preset beban SNI 1727 | Selesai |
| Langkah 5 | `a8d38f2` | UI Progressive Disclosure (Opsi A) & validasi bhs Indonesia | Selesai |
| Langkah 6 | `cd8b41b` | Blok Laporan "Asumsi & Default", ekspor DOCX & print PDF | Selesai |
*Hasil 4 Pemeriksaan Terakhir*: `lint` (0 warning), `typecheck` (0 error), `test` (83 passed), `build` (sukses).

### Batas engine dan sumber Fa/Fv

- Otomatisasi workspace mengisi Fa/Fv dan provenance sebelum kalkulasi. Engine M6 dan adapter registry approved menerima nilai tersimpan tanpa lookup/interpolasi ulang; trace koefisien tetap `INPUT`. Rumus dan kebijakan registry tidak berubah.
- Nama test batas engine: "Engine M6 memakai Fa/Fv tersimpan tanpa interpolasi ulang"; nama test kebijakan registry: "Registry approved M6 V1 mempertahankan kebijakan input koefisien".
- Label mengikuti `input_provenance.fa.source`/`fv.source`, bukan flag override: `otomatis SNI`, `manual` (termasuk PUSKIM), atau `Input manual (data lama, sumber tidak tercatat)` bila sumber kosong/hilang. UI, cetak, dan DOCX memakai helper label yang sama; DOCX tetap diblokir bila sumber wajib belum diisi.
- Commit lokal `7c1f2a8` membuktikan payload JSON lama dengan tujuh raw input tetap menghasilkan seluruh hasil M6 identik dan snapshot tidak stale melalui normalisasi pemuatan. Commit `500c1f2` memperbaiki label dan menambah test provenance/DOCX. Jalur IndexedDB/browser belum dibuktikan test otomatis.
- Checklist uji UI tersedia di [MANUAL-TEST.md](MANUAL-TEST.md), dengan hasil yang belum diisi. Library test UI belum ditambahkan.

## 3. Cara Menjalankan (Windows)
```cmd
npm.cmd install
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

## 4. Ekstraksi Dokumen SNI
File PDF standar teknis di-ignore (`.gitignore`). Untuk membaca teks standar:
1. Salin PDF ke `docs/sni/` (misal `SNI 1726-2019.pdf`, `SNI 1727-2020.pdf`, `SNI 2847-2019.pdf`).
2. Jalankan `python scripts/extract_pdfs.py` (hasil teks disimpan di `docs/sni/extracted/`).

## 5. Item Terbuka (Perlu Tindak Lanjut)
1. **Berat jenis beton**: Nilai 2.400 kg/m³ masih berstatus `TODO: verifikasi pasal` pada UI dan laporan.
2. **Reopen Proyek Lama di Browser**: Bukti normalisasi payload JSON dan snapshot sudah ada di `tests/report.test.ts`; pemuatan IndexedDB dan label sumber perlu uji manual sesuai checklist.
3. **Verifikasi Numerik**: Uji manual end-to-end dan verifikasi perbandingan nilai gaya geser dasar $V$ dan berat seismik $W$ terhadap branch `main`.
4. **Test Otomatis UI**: Komponen UI Langkah 5 belum memiliki integration test end-to-end berbasis browser (Playwright/Cypress).

## 6. Aturan Kerja Agen
- **DILARANG** mengubah rumus perhitungan yang sudah ada.
- **DILARANG** menebak pasal atau dokumen SNI tanpa verifikasi teks resmi (gunakan `TODO: verifikasi pasal` bila belum yakin).
- **DILARANG** commit atau push file PDF SNI ke repositori.
- Merge ke `main` **hanya** dapat dilakukan via Pull Request setelah disetujui pengguna (Pak Rian Fahmi).
