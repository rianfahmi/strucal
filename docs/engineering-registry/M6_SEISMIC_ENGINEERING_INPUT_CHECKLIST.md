# Checklist Input Engineering M6

Registry target: **SNI 1726:2019**, mengikuti versi yang dipin pada proyek.

## Data yang wajib diisi engineer

- [ ] Fa: seluruh sumbu tabel, nilai sel, aturan interpolasi, batas, dan referensi.
- [ ] Fv: seluruh sumbu tabel, nilai sel, aturan interpolasi, batas, dan referensi.
- [ ] Spektrum desain: SMS, SM1, SDS, SD1, T0, Ts, TL, dan seluruh segmen Sa(T).
- [ ] KDS: seluruh tabel keputusan SDS/SD1, kategori risiko, dan aturan governing.
- [ ] Sistem struktur: daftar lengkap, material/famili, KDS, batas tinggi, kategori risiko, kondisi khusus, status, alasan, dan referensi.
- [ ] Parameter sistem: R, Ω0, Cd, Ct, x, serta parameter tambahan yang diwajibkan.
- [ ] Periode: Ta, lookup koefisien, batas, dan aturan periode maksimum.
- [ ] Cs: rumus utama, batas atas/bawah, kondisi transisi, dan referensi.
- [ ] Base shear: rumus V dan penggunaan W dari M5.
- [ ] Distribusi vertikal: aturan k, Fx, kebutuhan wi/hi, batas, dan referensi.
- [ ] Response spectrum: rentang periode, segmen, unit, sampling, dan titik validasi.
- [ ] Golden fixtures: input, output, unit, toleransi, versi registry, sumber, dan persetujuan engineer.

## Gate persetujuan

- [ ] Setiap item memiliki `clause_or_table_reference` yang dapat diaudit.
- [ ] Setiap nilai/formula berstatus `APPROVED`; `DRAFT` atau `ENGINEER_REVIEW` tidak boleh dipakai engine produksi.
- [ ] Interpolasi dan boundary behavior dinyatakan eksplisit.
- [ ] Semua golden fixture memakai registry version yang sama.
- [ ] Engineer menandatangani nama, waktu review, dan catatan sumber berlisensi.
- [ ] Golden fixtures lulus sebelum registry ditag dan dipakai proyek.

Template mesin berada di `registry/seismic/`. Semua nilai engineering masih unresolved.
