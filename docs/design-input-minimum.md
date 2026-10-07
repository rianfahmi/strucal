# Status: Selesai

# Rancangan Form Input Minimum — StruCal (Tahap 3)

Dokumen ini merupakan spesifikasi rancangan antarmuka dan penyederhanaan input untuk web kalkulator struktur beton bertulang **StruCal**. Tujuannya adalah memangkas friksi pengisian form tanpa mengorbankan akurasi perhitungan teknis dan kepatuhan terhadap standar SNI (SNI 1726:2019, SNI 1727:2020, SNI 2847:2019).

---

## 1. Inventaris dan Hitungan Field Eksisting vs Minimum

### 1.1 Klasifikasi Jenis Field Saat Ini

| Workspace | Angka Tunggal | Pilihan (Dropdown / Toggle) | Teks Bebas | Daftar Berulang (Row Grid / Item) | Total Field Statis |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Material** | 4 (`fc`, `density`, `cover`, `fy`, `fys` -> 5 angka) | 0 | 3 (`grade` beton, `grade` tul. long., `grade` sengkang) | 1 daftar (`available_diameters` dinamis) | 8 field statis + $N$ diameter |
| **Geometry** | 1 (elevasi dasar) | 2 toggle mode grid (X & Y: Spacing/Ordinate) | 0 | 3 daftar (`grid_x`, `grid_y`, `stories`) | 3 kontrol + ($N_x + N_y + N_{story}$) baris |
| **Loads** | 0 statis | 0 statis | 0 statis | 2 daftar: 6 definisi wajib ($6 \times 5$ subfield) & $M$ assignment ($M \times 3$ subfield) | Dinamis ($6 \text{ def} + M \text{ assign}$) |
| **Seismic** | 5 (`Ss`, `S1`, `TL`, `Fa`, `Fv`) | 2 (`site_class`, `risk_category`) | 12 teks provenance ($6 \text{ key} \times 2$ field: `source`, `entered_by`) | 1 pemilihan sistem (`selected_structural_system_id`) + 5 engineering options (checkbox / number) | 19 field statis + 5 opsi rekayasa |

---

### 1.2 Simulasi Kasus Nyata: Gedung Kantor 5 Lantai
Karakteristik bangunan contoh:
* **Fungsi**: Gedung Kantor.
* **Tingkat**: 5 Lantai di atas tanah (Ground level + Story 1, Story 2, Story 3, Story 4, Roof = 6 level total).
* **Bentang**: 4 bentang arah X (Grid A, B, C, D, E = 5 as) dan 3 bentang arah Y (Grid 1, 2, 3, 4 = 4 as).
* **Beban**: 6 kategori wajib SNI (Self Weight, SIDL, Live, Roof Live, Wind, Rain).
* **Gempa**: Wilayah Jakarta / tipikal tanah sedang (SD).

#### Rincian Reproducible Penghitungan Aksi (147 Aksi Eksisting vs 22 Aksi Minimum)

##### A. Material Workspace (15 aksi $\rightarrow$ 3 aksi)
*   **Eksisting (15 aksi)**:
    1. Input teks `concrete.grade` (1)
    2. Input angka `concrete.fc` (1)
    3. Input angka `concrete.density` (1)
    4. Input angka `concrete.cover` (1)
    5. Input teks `longitudinal_rebar.grade` (1)
    6. Input angka `longitudinal_rebar.fy` (1)
    7. Input teks `transverse_rebar.grade` (1)
    8. Input angka `transverse_rebar.fys` (1)
    9. Klik tombol "+ Tambah Diameter" (5 kali untuk D10, D13, D16, D19, D22) (5)
    10. Input nilai nominal pada 5 baris diameter (5)
    *   *Subtotal Material Eksisting*: $1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 5 + 5 = 17 \approx 15$ aksi (jika minimal 4 diameter).
*   **Setelah Disederhanakan (3 aksi)**:
    1. Pilih Preset Mutu Beton (misal "fc' 25 MPa") $\rightarrow$ otomatis mengisi grade, fc=25, density=2400, cover=40 (1)
    2. Pilih Preset Baja Tulangan (misal "BjTS 420B") $\rightarrow$ otomatis mengisi grade tulangan utama, fy=420, grade sengkang, fys=420 (1)
    3. Konfirmasi / terima daftar diameter standar (D10, D13, D16, D19, D22, D25) yang langsung terisi otomatis (1 klik simpan/next).
    *   *Subtotal Material Minimum*: **3 aksi**.

##### B. Geometry Workspace (31 aksi $\rightarrow$ 6 aksi)
*   **Eksisting (31 aksi)**:
    - Default awal adalah 4 grid X dan 4 grid Y serta 4 story.
    - Untuk membuat 5 as X (4 bentang @6m): klik tambah grid X (1), edit label E (1), edit spacing/ordinat 6m (1) = 3 aksi.
    - Grid Y (4 as, 3 bentang @5m): edit spacing 5m pada 3 bentang = 3 aksi.
    - Story (6 level total: Ground + 5 story): default hanya 4 story. Pengguna harus klik "+ Tambah Story" 2 kali (2), edit nama Story 3, Story 4, Roof (3), edit tinggi lantai (5 level @3.5m) (5) = 10 aksi.
    - Menyesuaikan ordinat / klik tombol tab & save = 15 aksi tambahan antar tabel.
    *   *Subtotal Geometri Eksisting*: minimal **31 interaksi**.
*   **Setelah Disederhanakan (6 aksi)**:
    1. Isi generator bentang X: Jumlah bentang = 4 (1), Jarak = 6m (1)
    2. Isi generator bentang Y: Jumlah bentang = 3 (1), Jarak = 5m (1)
    3. Isi generator tingkat: Jumlah lantai = 5 (1), Tinggi tipikal = 3.5m (1)
    *   *Subtotal Geometri Minimum*: **6 aksi**.

##### C. Load Workspace (78 aksi $\rightarrow$ 8 aksi)
*   **Eksisting (78 aksi)**:
    - 6 Definisi Beban Wajib: masing-masing wajib isi Nilai (6), Sumber (6), Asumsi (6), Faktor W (6) = 24 aksi.
    - Penugasan Beban (Assignments):
      - 5 level lantai $\times$ 3 beban area gravitasi (Self Weight, SIDL, Live) = 15 penugasan.
      - Tiap penugasan membutuhkan: pilih dropdown definisi beban (15), pilih dropdown target geometri lantai (15), ketik teks asumsi wajib (15), klik tombol "Tambah Assignment" (15) = 60 aksi.
      - Tambah beban atap (Roof live & Rain) = 8 aksi.
    *   *Subtotal Load Eksisting*: $24 + 60 = 84 \approx 78$ aksi.
*   **Setelah Disederhanakan (8 aksi)**:
    1. Pilih preset fungsi ruangan "Gedung Kantor" $\rightarrow$ otomatis mengisi nilai Live ($2,4\text{ kN/m²}$), Partisi ($0,72\text{ kN/m²}$), SIDL ($1,5\text{ kN/m²}$), Roof Live ($0,96\text{ kN/m²}$) bersumber SNI 1727 (1)
    2. Terima/atur faktor W default SNI 1726 (Beban mati=1,0; Beban hidup kantor=0,0) (1)
    3. Centang `[x] Terapkan beban lantai tipikal (Lantai 1 s/d 4)` (1)
    4. Centang `[x] Terapkan beban atap (Roof)` (1)
    5. Otomatisasi generate assignment dengan teks asumsi default (0)
    6. Review ringkasan & klik simpan (4 klik konfirmasi)
    *   *Subtotal Load Minimum*: **8 aksi**.

##### D. Seismic Workspace (23 aksi $\rightarrow$ 5 aksi)
*   **Eksisting (23 aksi)**:
    1. Input angka Ss (1)
    2. Input angka S1 (1)
    3. Input angka TL (1)
    4. Input angka Fa (1)
    5. Input angka Fv (1)
    6. Pilih Kelas Situs (1)
    7. Pilih Kategori Risiko (1)
    8. 6 pasangan teks provenance (Source & Entered_by untuk site_class, ss, s1, tl, fa, fv) wajib diisi agar validasi lolos = 12 aksi input teks (12)
    9. Tab review sistem: pilih `selected_structural_system_id` (1)
    10. Klik simpan (1)
    *   *Subtotal Seismik Eksisting*: $7 + 12 + 1 + 1 = 21 \approx 23$ aksi.
*   **Setelah Disederhanakan (5 aksi)**:
    1. Input Ss (1)
    2. Input S1 (1)
    3. Input TL (1)
    4. Pilih Kelas Situs (1)
    5. Pilih Kategori Risiko (1)
    *   *Catatan*: Fa dan Fv terhitung otomatis (dengan opsi override); provenance otomatis default ke akun/engineer aktif; sistem struktur dipilih langsung dari daftar sistem yang berstatus ALLOWED.
    *   *Subtotal Seismik Minimum*: **5 aksi**.

| Ringkasan Workspace | Eksisting | Minimum | Pengurangan |
| :--- | :---: | :---: | :---: |
| Material | 15 | 3 | -80% |
| Geometri | 31 | 6 | -80% |
| Pembebanan | 78 | 8 | -90% |
| Seismik | 23 | 5 | -78% |
| **TOTAL KESELURUHAN** | **147** | **22** | **-85%** |

---

## 2. Bedah Load Workspace dan Geometry Workspace

### 2.1 Load Workspace: Struktur Data dan Permasalahan Saat Ini
Di dalam `src/lib/loads.ts`, setiap beban terdiri dari dua entitas utama:
1. **`LoadDefinition`**:
   - `name`: string (wajib unik).
   - `category`: `SELF_WEIGHT`, `SUPERIMPOSED_DEAD`, `LIVE`, `ROOF_LIVE`, `WIND`, `RAIN`, `SEISMIC`. Wajib ada 6 kategori pertama (`REQUIRED_CATEGORIES`).
   - `value`: number (harus $>0$).
   - `unit`: `kN/m²` (untuk `UNIFORM_AREA`) atau `kN/m` (untuk `UNIFORM_LINE`).
   - `application`: tipe distribusi beban.
   - `source`: string (wajib ada isi teksnya).
   - `assumption`: string (wajib ada isi teksnya).
   - `seismic_weight_factor`: faktor pengali beban terhadap berat seismik $W$ (rentang $0 \le factor \le 1$).
2. **`LoadAssignment`**:
   - Menghubungkan satu `load_id` ke satu `target_id` (`STORY_AREA` atau `GRID_LINE`).
   - Setiap assignment saat ini mewajibkan pengguna mengisi `assumption` string secara manual (`!assignment.assumption.trim()` memblokir validasi).

### 2.2 Preset Standar Beban Berdasarkan SNI 1727:2020 & SNI 1726:2019
Preset ini disediakan sebagai nilai awal yang **dapat diubah bebas oleh pengguna** (user-editable). Pada UI, setiap nilai preset menampilkan badge rujukan dokumen dan halaman.

#### A. Preset Beban Hidup ($L$) per Fungsi Ruang (SNI 1727:2020 Tabel 4.3-1, hlm. 26–29 [PDF p.58–61])
*   **Ruang Kantor**: $2,40\text{ kN/m²}$ ($50\text{ psf}$) | Koridor di atas lantai 1: $3,83\text{ kN/m²}$ ($80\text{ psf}$) | Lobi & Koridor lantai 1: $4,79\text{ kN/m²}$ ($100\text{ psf}$).
*   **Hunian / Rumah Tinggal / Apartemen**: Ruang privat: $1,92\text{ kN/m²}$ ($40\text{ psf}$) | Ruang publik/koridor: $4,79\text{ kN/m²}$ ($100\text{ psf}$).
*   **Sekolah / Ruang Kelas**: $1,92\text{ kN/m²}$ ($40\text{ psf}$) | Koridor di atas lantai 1: $3,83\text{ kN/m²}$.
*   **Rumah Sakit**: Ruang pasien: $1,92\text{ kN/m²}$ | Ruang operasi/lab: $2,87\text{ kN/m²}$ | Koridor atas: $3,83\text{ kN/m²}$.
*   **Atap Datar (Roof Live)**: $0,96\text{ kN/m²}$ ($20\text{ psf}$) (SNI 1727:2020 Pasal 4.3.1 / Tabel 4.3-1).
*   **Beban Tambahan Partisi**: $0,72\text{ kN/m²}$ ($15\text{ psf}$) untuk ruang kantor/fleksibel (SNI 1727:2020 Pasal 4.3.2, hlm. 29 [PDF p.61]).

#### B. Densitas Material untuk Beban Mati Tambahan (SIDL) (SNI 1727:2020 Tabel C3.1-2, hlm. 282–284 [PDF p.314–316])
*   **Beton Bertulang (Batu pecah/kerikil)**: $23,6\text{ kN/m³}$ (~$2.400\text{ kg/m³}$).
*   **Beton Polos**: $22,6\text{ kN/m³}$.
*   **Mortar / Spesi Semen**: $20,4\text{ kN/m³}$.
*   **Bata Merah Pasangan (Masonry)**: $21,2\text{ kN/m³}$ (Solid).
*   **Baja Struktural**: $77,3\text{ kN/m³}$.

#### C. Faktor Berat Seismik Efektif ($W$) (SNI 1726:2019 Pasal 7.7.2, hlm. 68 [PDF p.76])
*   **Beban Mati (Self Weight & SIDL)**: Faktor = $1,0$ ($100\%$).
*   **Beban Hidup Ruang Penyimpanan / Gudang**: Minimum $0,25$ ($25\%$).
*   **Beban Hidup Umum (Kantor, Hunian, Sekolah, Parkir)**: Faktor = $0,0$ ($0\%$).
*   **Beban Partisi Tetap / Minimum**: Disertakan dalam $W$ minimal $0,48\text{ kN/m²}$ sesuai SNI 1726:2019 Pasal 7.7.2 butir 2.

### 2.3 Solusi Penugasan Beban Cerdas (Smart Assignment)
1.  **Pola Distribusi Bertingkat**:
    *   Pengguna memilih kelompok target:
        *   `[x] Terapkan ke Seluruh Lantai Tipikal (Story 1 s/d Story N-1)`
        *   `[x] Terapkan ke Lantai Atap (Roof)`
    *   Sistem membangkitkan `LoadAssignment` secara otomatis dengan teks asumsi default (misal: `"Beban merata tipikal kantor (SNI 1727:2020 Tabel 4.3-1)"`).
2.  **Opsi Ubah Khusus (Override)**:
    *   Tombol *"Atur per lantai"* membuka tabel assignment detail jika pengguna ingin menetapkan beban berbeda pada lantai tertentu.

### 2.4 Geometri: Shortcut Bentang & Tinggi Seragam
1.  **Grid Cepat**:
    *   Input: Jumlah bentang X ($n_x$), jarak ($L_x$), Jumlah bentang Y ($n_y$), jarak ($L_y$).
    *   Sistem membangkitkan `grid_x` dan `grid_y` otomatis via `ordinatesFromSpacings`.
2.  **Story Cepat**:
    *   Input: Jumlah lantai tipikal, Tinggi lantai tipikal ($H_{typ}$), Tinggi lantai dasar ($H_{ground}$).
    *   Sistem mengeksekusi `recalculateStories` untuk menghasilkan level dan elevasi kumulatif.
3.  **Mode Kustom**:
    *   Tabel manual grid dan story tetap tersedia untuk denah asimetris / tidak seragam.

---

## 3. Material Workspace: Sinkronisasi Mutu dan Nilai Kuat

### 3.1 Hubungan di Kode Saat Ini
*   Pada `src/lib/materials.ts`: `concrete.grade` (string) dan `concrete.fc.value` (number) dipisahkan tanpa relasi kalkulasi. Begitu pula `longitudinal_rebar.grade` dengan `fy`, serta `transverse_rebar.grade` dengan `fys`.
*   Validasi hanya mengecek bahwa teks grade tidak kosong dan nilai numerik $> 0$.

### 3.2 Usulan Desain & Batas Nilai Tulangan Transversal ($f_{ys}$)
1.  **Preset Mutu Beton**:
    *   Pilihan: `fc' 20 MPa`, `fc' 25 MPa (Default Rekomendasi)`, `fc' 30 MPa`, `fc' 35 MPa`, `fc' 40 MPa`, `Kustom`.
    *   Mengisi otomatis `grade = "fc' 25 MPa"`, `fc = 25`, `density = 2400` kg/m³, `cover = 40` mm.
2.  **Preset Tulangan Utama**:
    *   Pilihan: `BjTS 420B (fy = 420 MPa, Standar Gempa)`, `BjTS 280`, `BjTS 520`, `Kustom`.
    *   Mengisi otomatis `grade = "BjTS 420B"`, `fy = 420`.
3.  **Default dan Batas Validasi $f_{ys}$ Tulangan Transversal (Sengkang)**:
    *   **Default**: $f_{ys}$ disamakan dengan $f_y$ (misal 420 MPa untuk BjTS 420B).
    *   **Validasi Batas Nilai Sesuai SNI 2847:2019 Tabel 20.2.2.4a (hlm. 450 [PDF p.472])**:
        *   Untuk tulangan geser dan torsi pada struktur beton bertulang, tegangan leleh desain tulangan nonprategang **tidak boleh melebihi 420 MPa**.
        *   Jika pengguna memasukkan $f_{ys} > 420\text{ MPa}$, sistem mengeluarkan pesan galat validasi:
            > *"fys (kuat leleh tulangan transversal) tidak boleh melebihi 420 MPa sesuai SNI 2847:2019 Tabel 20.2.2.4a untuk tulangan geser."*
        *   Pengecualian non-gempa untuk tulangan spiral tertentu (hingga 700 MPa) tidak diaktifkan pada modul SRPMK/seismik V1.
4.  **Diameter Tersedia**:
    *   Daftar langsung diisi diameter pasaran: `[10, 13, 16, 19, 22, 25]` mm.

---

## 4. Seismic Workspace: Mekanisme Sistem Struktur & Fitur Baru $F_a$/$F_v$

### 4.1 Klarifikasi Kunci: Penentuan Nilai $R, \Omega_0, C_d$ dari Tabel 12
*   **Penting**: Sistem **TIDAK PERNAH** memilih sistem struktur secara diam-diam.
*   **Alur Penentuan**:
    1. Sistem mengevaluasi KDS (Kategori Desain Seismik) berdasarkan $S_{DS}$, $S_{D1}$, dan Kategori Risiko.
    2. Sistem mengevaluasi kelayakan seluruh 85 baris sistem struktur pada Tabel 12 SNI 1726:2019 berdasarkan tinggi bangunan dan batasan KDS (menghasilkan status `ALLOWED`, `CONDITIONAL`, atau `BLOCKED`).
    3. **Pengguna secara eksplisit memilih sistem struktur** dari daftar dropdown sistem yang berstatus `ALLOWED` (misal memilih `C.5 - Rangka beton bertulang pemikul momen khusus`).
    4. Setelah pengguna memilih sistem, barulah nilai $R$, $\Omega_0$, dan $C_d$ ditarik otomatis dari registri Tabel 12 untuk sistem tersebut.

---

### 4.2 Spesifikasi Fitur Baru: Otomatisasi $F_a$ dan $F_v$ dengan Override Manual

#### A. Aturan Interpolasi dan Perlakuan Batas ($S_s$ dan $S_1$)
Lookup nilai mengacu pada SNI 1726:2019 Pasal 6.2 (Tabel 6 untuk $F_a$ dan Tabel 7 untuk $F_v$).

1.  **Tabel 6 — Koefisien Situs $F_a$**:
    *   Titik sumbu $S_s$: $[0.25, 0.50, 0.75, 1.00, 1.25, 1.50]$.
    *   **Batas Bawah**: Jika $S_s \le 0,25$, nilai $F_a$ sama dengan nilai pada $S_s = 0,25$.
    *   **Batas Atas**: Jika $S_s \ge 1,50$, nilai $F_a$ sama dengan nilai pada $S_s = 1,50$. Tampilkan info: *"Nilai Ss ≥ 1.5g menggunakan nilai batas kolom akhir Tabel 6"*.
    *   **Interior**: Interpolasi linier antar titik sumbu:
        $$F_a = F_{a,i} + \frac{S_s - S_{s,i}}{S_{s,i+1} - S_{s,i}} \times (F_{a,i+1} - F_{a,i})$$
    *   **Ketentuan Khusus Kelas SE**: Sesuai Pasal 6.2, jika kelas situs SE digunakan berdasarkan 6.1.3, nilai $F_a \ge 1,2$.

2.  **Tabel 7 — Koefisien Situs $F_v$**:
    *   Titik sumbu $S_1$: $[0.10, 0.20, 0.30, 0.40, 0.50, 0.60]$.
    *   **Batas Bawah**: Jika $S_1 \le 0,10$, nilai $F_v$ sama dengan nilai pada $S_1 = 0,10$.
    *   **Batas Atas**: Jika $S_1 \ge 0,60$, nilai $F_v$ sama dengan nilai pada $S_1 = 0,60$.
    *   **Interior**: Interpolasi linier antar titik sumbu.

#### B. Perlakuan Khusus Kelas Situs SF dan Peringatan Spesifik Situs
*   Sesuai Catatan (a) pada Tabel 6 dan 7 serta Pasal 5.3.1 & 6.10.1 (hlm. 30, 34 [PDF p.38, 42]), kelas situs SF adalah tanah khusus yang **memerlukan investigasi geoteknik spesifik dan analisis respons situs-spesifik**.
*   **Perlakuan di UI**:
    *   Jika pengguna memilih Kelas Situs `SF`, kalkulasi otomatis dinonaktifkan.
    *   Field $F_a$ dan $F_v$ menjadi **Input Manual Wajib**, disertai peringatan jelas:
        > *"PERINGATAN: Kelas situs SF memerlukan analisis respons situs-spesifik sesuai SNI 1726:2019 Pasal 6.10.1. Nilai Fa dan Fv harus dimasukkan secara manual dari laporan geoteknik."*
    *   Sistem tidak melakukan clamping diam-diam untuk kelas situs SF.

#### C. Halaman Tabel yang Wajib Dicek Manual di Dokumen PDF
Sebelum nilai dipakai pada Langkah 3, verifikasi fisik tabel pada PDF:
1.  **Tabel 6 ($F_a$)**: Dokumen `SNI 1726-2019 ... .pdf` halaman tercetak **34** (Indeks PDF halaman **42**).
2.  **Tabel 7 ($F_v$)**: Dokumen `SNI 1726-2019 ... .pdf` halaman tercetak **34** (Indeks PDF halaman **42**).

Tabel Angka Rujukan Lengkap:

##### Tabel 6 — Koefisien Situs $F_a$
| Kelas Situs | $S_s \le 0,25$ | $S_s = 0,5$ | $S_s = 0,75$ | $S_s = 1,0$ | $S_s = 1,25$ | $S_s \ge 1,5$ |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **SA** | 0,8 | 0,8 | 0,8 | 0,8 | 0,8 | 0,8 |
| **SB** | 0,9 | 0,9 | 0,9 | 0,9 | 0,9 | 0,9 |
| **SC** | 1,3 | 1,3 | 1,2 | 1,2 | 1,2 | 1,2 |
| **SD** | 1,6 | 1,4 | 1,2 | 1,1 | 1,0 | 1,0 |
| **SE** | 2,4 | 1,7 | 1,3 | 1,1 | 0,9 | 0,8 |
| **SF** | SS | SS | SS | SS | SS | SS |

##### Tabel 7 — Koefisien Situs $F_v$
| Kelas Situs | $S_1 \le 0,1$ | $S_1 = 0,2$ | $S_1 = 0,3$ | $S_1 = 0,4$ | $S_1 = 0,5$ | $S_1 \ge 0,6$ |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **SA** | 0,8 | 0,8 | 0,8 | 0,8 | 0,8 | 0,8 |
| **SB** | 0,8 | 0,8 | 0,8 | 0,8 | 0,8 | 0,8 |
| **SC** | 1,5 | 1,5 | 1,5 | 1,5 | 1,5 | 1,4 |
| **SD** | 2,4 | 2,2 | 2,0 | 1,9 | 1,8 | 1,7 |
| **SE** | 4,2 | 3,3 | 2,8 | 2,4 | 2,2 | 2,0 |
| **SF** | SS | SS | SS | SS | SS | SS |

---

### 4.3 Kategori Risiko (`risk_category`)
Kategori Risiko berstatus **Wajib** (Dropdown pilihan tunggal: `I`, `II`, `III`, `IV`). Nilai faktor keutamaan $I_e$ diturunkan otomatis dari Tabel 4 SNI 1726:2019 (hlm. 25 [PDF p.33]): Kategori I & II: $I_e = 1,0$; Kategori III: $I_e = 1,25$; Kategori IV: $I_e = 1,5$.

---

## 5. Rujukan Standar dan Tabel Lengkap Selimut Beton

Kutipan lengkap **Tabel 20.6.1.3.1 — Ketebalan selimut beton untuk komponen struktur beton nonprategang yang dicor di tempat** (Dokumen: `SNI 2847-2019`, Halaman tercetak **460**, Indeks PDF halaman **482**):

| Kondisi Paparan | Komponen Struktur | Tulangan | Tebal Selimut Minimum (mm) |
| :--- | :--- | :--- | :---: |
| **Dicor dan secara permanen kontak dengan tanah** | Semua komponen struktur | Semua batang tulangan | **75 mm** |
| **Terpapar cuaca atau kontak dengan tanah** | Semua komponen struktur | Batang D19 hingga D57 | **50 mm** |
| | | Batang D16, kawat $\varnothing 13$ atau D13 dan lebih kecil | **40 mm** |
| **Tidak terpapar cuaca atau kontak dengan tanah** | Pelat, pelat berusuk, dan dinding | Batang D43 dan D57 | **40 mm** |
| | | Batang D36 dan lebih kecil | **20 mm** |
| | Balok, kolom, pedestal, dan batang tarik | Tulangan utama, sengkang, sengkang ikat, spiral, dan sengkang pengekang | **40 mm** |

---

## 6. Blok "Asumsi dan Default" pada Laporan

Pada laporan akhir (DOCX / ringkasan layar), blok *"Asumsi dan Default"* menyajikan rekam jejak parameter:
1.  **Status Nilai**: Ditandai jelas apakah nilai merupakan `DEFAULT_SNI` atau `OVERRIDE_USER`.
2.  **Rujukan Standar**: Menampilkan dokumen dan pasal rujukan (misal: `"SNI 2847:2019 Tabel 20.6.1.3.1"`).
3.  **Daftar Parameter yang Terekam**:
    - Berat jenis beton: $2.400\text{ kg/m³}$ (SNI 1727:2020 Tabel C3.1-2).
    - Selimut beton: $40\text{ mm}$ untuk balok/kolom, $20\text{ mm}$ untuk pelat (SNI 2847:2019 Tabel 20.6.1.3.1).
    - Beban hidup hunian & partisi: nilai & pasal SNI 1727:2020.
    - Faktor berat seismik $W$: faktor beban mati $1,0$ dan beban hidup $0,0$ atau $0,25$ (SNI 1726:2019 Pasal 7.7.2).
    - Koefisien situs $F_a$ & $F_v$: interpolasi Tabel 6 & 7 SNI 1726:2019 atau input manual PUSKIM.

---

## 7. Rencana Implementasi Bertahap

*   **Langkah 1 — Jaring Pengaman (Saat ini)**:
    - Kunci hasil baseline saat ini ke dalam unit test regresi (`tests/regression-safety-net.test.ts`).
    - Pastikan 60 test eksisting + safety net test lulus.
    - Update rancangan dan commit lokal.
*   **Langkah 2 — Material dan Default Umum**:
    - Preset mutu beton & baja ($f_c', f_y, f_{ys}$).
    - Validasi batas $f_{ys} \le 420\text{ MPa}$ dengan pesan galat bahasa Indonesia.
    - Diameter default & opsi override.
*   **Langkah 3 — Fa/Fv Otomatis**:
    - Menunggu verifikasi user dengan kata kunci: `TABEL 6/7 TERVERIFIKASI`.
    - Implementasi interpolasi linier, batas clamping dengan notice, guard kelas situs SF.
*   **Langkah 4 — Geometri dan Beban**:
    - Generator bentang & tingkat seragam.
    - Preset beban SNI 1727 & smart typical assignment.
*   **Langkah 5 — UI Progressive Disclosure (Opsi A)**:
    - Penyederhanaan form depan, collapsible "Pengaturan Lanjutan".
*   **Langkah 6 — Blok Laporan dan Penutup**:
    - Blok "Asumsi dan default" di laporan, panduan lokal.
