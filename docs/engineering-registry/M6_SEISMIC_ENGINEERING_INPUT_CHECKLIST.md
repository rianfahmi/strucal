# Checklist Review Engineering M6 — SNI 1726:2019

Data kandidat: `registry/seismic/sni-1726-2019.engineer-review.json`

Sistem: `registry/seismic/sni-1726-2019.table-12.systems.json`

Fixture: `registry/seismic/golden-fixtures.candidate.json`

- [ ] Verifikasi transkripsi Tabel 3-9, 12, 17, dan 18 terhadap PDF sumber.
- [ ] Tetapkan aturan interpolasi Fa dan Fv; sumber 6.2/Tabel 6-7 tidak menyatakannya.
- [ ] Tetapkan operator pada batas bersama kelas situs Tabel 5.
- [ ] Validasi lookup TL dari Gambar 20; peta belum didigitalkan.
- [ ] Rekonsiliasi batas tinggi Tabel 12 (48/30 m), catatan e/f (72/48 m), dan 7.2.5.4 (50→75 m; 30→50 m).
- [ ] Setujui seluruh kondisi khusus/footnote Tabel 12 dan pemetaan `system_id` ke tipe Ct/x Tabel 18.
- [ ] Tetapkan aturan Cu antar titik Tabel 17; sumber tidak menyatakan interpolasi.
- [ ] Tetapkan periode maksimum dan step tabel spektrum digital; 6.4 hanya mendefinisikan kurva kontinu.
- [ ] Review kandidat golden fixtures, toleransi, dan pilihan `k` pada 0,5<T<2,5.
- [ ] Ubah ke `APPROVED`, isi reviewer/waktu, dan tag versi hanya setelah semua butir di atas selesai.

Engine produksi wajib menolak data `ENGINEER_REVIEW`.
