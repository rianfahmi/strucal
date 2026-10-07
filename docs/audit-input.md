# Audit Input StruCal

## 1. Alur Pengguna
Alur data bergerak secara sekuensial antar *workspace* dan mempengaruhi perhitungan akhir di modul gempa:
1. **Material Workspace**: Pengguna mengisi mutu material (beton dan baja tulangan) dan diameter tulangan yang diizinkan. Data ini menentukan sifat material bangunan (apakah beton/baja) yang nantinya berpengaruh pada faktor penahan gempa (contoh: pembedaan struktur beton vs baja pada Tabel 12 SNI 1726).
2. **Geometry Workspace**: Pengguna menetapkan grid (bentang X dan Y) dan definisi tingkat/story (ketinggian dan urutan). Ini sangat penting karena menentukan nilai tinggi bangunan keseluruhan ($h_n$ yang digunakan untuk periode fundamental pendekatan $T_a$) serta menjadi tempat / referensi penempatan beban.
3. **Load Workspace**: Pengguna mendefinisikan beban (berat sendiri, mati tambahan, hidup, dsb) lalu meng-assign beban tersebut ke area (STORY_AREA) atau garis grid (GRID_LINE). Sistem mengagregasi beban mati ini menjadi Berat Seismik Efektif ($W$).
4. **Seismic Workspace**: Pengguna memasukkan respon spektrum ($S_s, S_1, T_L$, site class, fa, fv, kategori risiko). Modul ini akan menyerap nilai dari Material (tipe material), Geometri (tinggi bangunan $h_n$), dan Load (Berat seismik $W$) untuk mengevaluasi Kategori Desain Seismik (KDS), syarat sistem struktur, batasan $C_s$, hingga nilai geser dasar ($V$).

## 2. Tabel Inventaris Input

| Workspace | Nama Field | Satuan | Tipe | Fungsi Terkait | Asal Nilai | Kategori |
| --- | --- | --- | --- | --- | --- | --- |
| **Material** | `concrete.grade` | - | Teks | `validateMaterials` | Input | Wajib |
| **Material** | `concrete.fc` | MPa | Angka | `validateMaterials` | Input | Wajib |
| **Material** | `concrete.density` | kg/m³ | Angka | `validateMaterials` | Input | Bisa default SNI |
| **Material** | `concrete.cover` | mm | Angka | `validateMaterials` | Input | Bisa default SNI |
| **Material** | `longitudinal_rebar.grade` | - | Teks | `validateMaterials` | Input | Wajib |
| **Material** | `longitudinal_rebar.fy` | MPa | Angka | `validateMaterials` | Input | Wajib |
| **Material** | `transverse_rebar.grade` | - | Teks | `validateMaterials` | Input | Wajib |
| **Material** | `transverse_rebar.fys` | MPa | Angka | `validateMaterials` | Input | Wajib |
| **Material** | `available_diameters` | mm | Angka | `validateMaterials` | Input | Bisa default SNI |
| **Geometry** | `grid_x` (ordinate) | m | Angka | `spacingsFromOrdinates` | Input | Wajib |
| **Geometry** | `grid_y` (ordinate) | m | Angka | `spacingsFromOrdinates` | Input | Wajib |
| **Geometry** | `stories` (height) | m | Angka | `recalculateStories` | Input | Wajib |
| **Load** | `definitions` (value, cat) | var | Angka/Pilih | `seismicWeightResult` | Input | Wajib |
| **Seismic** | `ss` | g | Angka | `deriveSpectrum` | Input | Wajib |
| **Seismic** | `s1` | g | Angka | `deriveSpectrum` | Input | Wajib |
| **Seismic** | `tl` | s | Angka | `deriveSpectrum` | Input | Wajib |
| **Seismic** | `site_class` | - | Pilihan | `deriveSpectrum` | Input | Wajib |
| **Seismic** | `fa` | - | Angka | `deriveSpectrum` | Input | Bisa dihitung otomatis |
| **Seismic** | `fv` | - | Angka | `deriveSpectrum` | Input | Bisa dihitung otomatis |
| **Seismic** | `risk_category` | - | Pilihan | `deriveKds` | Input | Bisa default SNI / Wajib |

## 3. Jumlah Field
- **Saat ini**: Terdapat sekitar **20+ input manual** (tergantung banyaknya grid, story, dan definisi beban). Di *Seismic Workspace* terdapat 7 field murni manual, dan di *Material Workspace* terdapat 9 field/area isian.
- **Perkiraan disederhanakan**: Sekitar **4-6 field dapat disembunyikan** ke "Pengaturan Lanjutan" (seperti *density*, *concrete cover*, kumpulan diameter standar, dan perhitungan interpolasi $F_a$/$F_v$). Sehingga form utama hanya meminta nilai mutu material inti ($f_c'$, $f_y$), geometri bangunan, beban hidup dasar, dan $S_s, S_1, T_L$ dari Peta Gempa.

## 4. Kandidat Default
*   `concrete.density`: **2400 kg/m³** -> `TODO: verifikasi pasal (SNI 1727)`
*   `concrete.cover`: **40 mm** -> **SNI 2847-2019 Pasal 20.6.1.3** / Tabel 20.6.1.3.1 (Tebal selimut beton untuk komponen tidak terpapar cuaca). Dokumen: `SNI 2847-2019 Persyaratan Beton Struktural Untuk Bangunan Gedung.pdf`
*   `available_diameters`: **D10, D13, D16, D19, D22, D25** -> Nilai praktis/pasar yang umum dipakai.
*   `fa`: Dihitung otomatis (interpolasi linier $S_s$ & Kelas Situs) -> **SNI 1726-2019 Pasal 6.2** / Tabel 6 (Koefisien Situs Fa). Dokumen: `SNI 1726-2019 Tata cara perencanaan ketahanan gempa untuk struktur bangunan gedung dan non gedung (Koreksi).pdf`
*   `fv`: Dihitung otomatis (interpolasi linier $S_1$ & Kelas Situs) -> **SNI 1726-2019 Pasal 6.2** / Tabel 7 (Koefisien Situs Fv). Dokumen: `SNI 1726-2019 Tata cara perencanaan ketahanan gempa untuk struktur bangunan gedung dan non gedung (Koreksi).pdf`

## 5. Risiko
*   **Kehilangan Fleksibilitas Engineer**: Menutup $F_a$ dan $F_v$ dari form utama bisa menjadi masalah apabila user biasa menyalin langsung hasil dari web Puskim (Desain Spektra Indonesia), karena pembulatan interpolasi program vs Puskim kadang bisa berbeda di angka desimal ketiga, yang berdampak pada validasi sistem jika ada perbedaan parameter akhir.
*   **Refactoring Test & Fixture**: Beberapa file di `tests/seismic.test.ts` dan fixture json saat ini menganggap `fa` dan `fv` wajib ada dari input (karena note: "Tidak ada lookup atau interpolasi otomatis... pada M6 V1"). Menghapusnya dari level input membutuhkan mock/update pada logika dan file test ini.

## 6. Pertanyaan Terbuka untuk Tahap Selanjutnya
1. Untuk `fa` dan `fv`, apakah Anda ingin murni **dihitung otomatis melalui interpolasi**, atau hanya dijadikan **opsional** (jika dikosongkan baru dikalkulasi otomatis, jika diisi maka pakai nilai dari pengguna Puskim)?
2. Kategori risiko (`risk_category`) sangat bergantung pada fungsi bangunan (contoh: rumah sakit vs ruko). Apakah ini tetap dibiarkan sebagai input wajib (Pilihan), atau difasilitasi dengan form "Fungsi Bangunan" yang mana akan me-map otomatis ke beban minimum SNI 1727 sekaligus kategori risiko SNI 1726?
