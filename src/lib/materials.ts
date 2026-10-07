export type MaterialProvenance = "INPUT" | "AUTO" | "CODE";
export type MaterialUnit = "MPa" | "kg/m³" | "mm";
export type MaterialValue<U extends MaterialUnit = MaterialUnit> = {
  value: number | null;
  unit: U;
  provenance: MaterialProvenance;
};

export type DerivedMaterialValue<U extends MaterialUnit = MaterialUnit> = MaterialValue<U> & {
  status: "AVAILABLE" | "UNAVAILABLE";
  formula_id: string | null;
  standard_ref: string | null;
};

export type ConcreteMaterial = {
  type: "concrete";
  grade: string;
  fc: MaterialValue<"MPa">;
  density: MaterialValue<"kg/m³">;
  cover: MaterialValue<"mm">;
  elastic_modulus: DerivedMaterialValue<"MPa">;
};

export type LongitudinalRebarMaterial = {
  type: "longitudinal_rebar";
  grade: string;
  fy: MaterialValue<"MPa">;
};

export type TransverseRebarMaterial = {
  type: "transverse_rebar";
  grade: string;
  fys: MaterialValue<"MPa">;
};

export type ReinforcementDiameter = {
  id: string;
  nominal_diameter: MaterialValue<"mm">;
};

export type Materials = {
  revision_id: string;
  concrete: ConcreteMaterial;
  longitudinal_rebar: LongitudinalRebarMaterial;
  transverse_rebar: TransverseRebarMaterial;
  available_diameters: ReinforcementDiameter[];
};

export type MaterialIssue = { path: string; message: string };

function validatePositive(path: string, label: string, value: number | null): MaterialIssue[] {
  return value === null || !Number.isFinite(value) || value <= 0
    ? [{ path, message: `${label} harus lebih besar dari nol.` }]
    : [];
}

function validateGrade(path: string, label: string, grade: string): MaterialIssue[] {
  return grade.trim() ? [] : [{ path, message: `Mutu ${label} wajib diisi.` }];
}

export const MAX_FYS_LIMIT = 420;

export type ConcretePreset = {
  id: string;
  label: string;
  grade: string;
  fc: number;
  density: number;
  cover: number;
  standard_ref: string;
};

export const CONCRETE_PRESETS: ConcretePreset[] = [
  { id: "fc-20", label: "fc' 20 MPa (Struktur Sederhana)", grade: "fc' 20 MPa", fc: 20, density: 2400, cover: 40, standard_ref: "SNI 2847:2019 Tabel 19.2.1.1 & Tabel 20.6.1.3.1; SNI 1727:2020 Tabel C3.1-2" },
  { id: "fc-25", label: "fc' 25 MPa (Standar Rekomendasi)", grade: "fc' 25 MPa", fc: 25, density: 2400, cover: 40, standard_ref: "SNI 2847:2019 Tabel 19.2.1.1 & Tabel 20.6.1.3.1; SNI 1727:2020 Tabel C3.1-2" },
  { id: "fc-30", label: "fc' 30 MPa (Menengah / Tinggi)", grade: "fc' 30 MPa", fc: 30, density: 2400, cover: 40, standard_ref: "SNI 2847:2019 Tabel 19.2.1.1 & Tabel 20.6.1.3.1; SNI 1727:2020 Tabel C3.1-2" },
  { id: "fc-35", label: "fc' 35 MPa (Gedung Tinggi)", grade: "fc' 35 MPa", fc: 35, density: 2400, cover: 40, standard_ref: "SNI 2847:2019 Tabel 19.2.1.1 & Tabel 20.6.1.3.1; SNI 1727:2020 Tabel C3.1-2" },
  { id: "fc-40", label: "fc' 40 MPa (Kekuatan Tinggi)", grade: "fc' 40 MPa", fc: 40, density: 2400, cover: 40, standard_ref: "SNI 2847:2019 Tabel 19.2.1.1 & Tabel 20.6.1.3.1; SNI 1727:2020 Tabel C3.1-2" },
];

export type RebarPreset = {
  id: string;
  label: string;
  grade: string;
  fy: number;
  standard_ref: string;
};

export const REBAR_PRESETS: RebarPreset[] = [
  { id: "bjts-420b", label: "BjTS 420B (fy = 420 MPa — Standar Seismik)", grade: "BjTS 420B", fy: 420, standard_ref: "SNI 2847:2019 20.2.2.4 & Tabel 20.2.2.4a" },
  { id: "bjts-280", label: "BjTS 280 (fy = 280 MPa)", grade: "BjTS 280", fy: 280, standard_ref: "SNI 2847:2019 20.2.2.4" },
  { id: "bjts-520", label: "BjTS 520 (fy = 520 MPa)", grade: "BjTS 520", fy: 520, standard_ref: "SNI 2847:2019 20.2.2.4 & Tabel 20.2.2.4a" },
];

export type CoverPreset = {
  id: string;
  label: string;
  element: string;
  exposure: string;
  cover: number;
  standard_ref: string;
};

export const COVER_PRESETS: CoverPreset[] = [
  { id: "beam-col-interior", label: "Balok / Kolom (Tidak Terpapar Cuaca) — 40 mm", element: "Balok, kolom, pedestal, batang tarik", exposure: "Tidak terpapar cuaca atau kontak tanah", cover: 40, standard_ref: "SNI 2847:2019 Tabel 20.6.1.3.1, hlm. 460" },
  { id: "slab-wall-interior", label: "Pelat / Dinding (Tidak Terpapar Cuaca) — 20 mm", element: "Pelat, pelat berusuk, dinding (D36 ke bawah)", exposure: "Tidak terpapar cuaca atau kontak tanah", cover: 20, standard_ref: "SNI 2847:2019 Tabel 20.6.1.3.1, hlm. 460" },
  { id: "weather-exposed-d19", label: "Komponen Terpapar Cuaca (Tul. D19–D57) — 50 mm", element: "Semua komponen struktur (D19–D57)", exposure: "Terpapar cuaca atau kontak tanah", cover: 50, standard_ref: "SNI 2847:2019 Tabel 20.6.1.3.1, hlm. 460" },
  { id: "weather-exposed-d16", label: "Komponen Terpapar Cuaca (Tul. ≤ D16) — 40 mm", element: "Semua komponen struktur (D16 ke bawah)", exposure: "Terpapar cuaca atau kontak tanah", cover: 40, standard_ref: "SNI 2847:2019 Tabel 20.6.1.3.1, hlm. 460" },
  { id: "earth-contact-permanent", label: "Dicor & Kontak Permanen Tanah — 75 mm", element: "Semua komponen struktur fondasi/tanah", exposure: "Dicor dan secara permanen kontak tanah", cover: 75, standard_ref: "SNI 2847:2019 Tabel 20.6.1.3.1, hlm. 460" },
];

export const STANDARD_REBAR_DIAMETERS = [10, 13, 16, 19, 22, 25];

export function applyConcretePreset(materials: Materials, presetId: string): Materials {
  const preset = CONCRETE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return materials;
  return {
    ...materials,
    concrete: {
      ...materials.concrete,
      grade: preset.grade,
      fc: { ...materials.concrete.fc, value: preset.fc },
      density: { ...materials.concrete.density, value: preset.density },
      cover: { ...materials.concrete.cover, value: preset.cover },
    },
  };
}

export function applyRebarPreset(materials: Materials, presetId: string): Materials {
  const preset = REBAR_PRESETS.find((p) => p.id === presetId);
  if (!preset) return materials;
  const transverseFys = Math.min(preset.fy, MAX_FYS_LIMIT);
  return {
    ...materials,
    longitudinal_rebar: {
      ...materials.longitudinal_rebar,
      grade: preset.grade,
      fy: { ...materials.longitudinal_rebar.fy, value: preset.fy },
    },
    transverse_rebar: {
      ...materials.transverse_rebar,
      grade: preset.grade,
      fys: { ...materials.transverse_rebar.fys, value: transverseFys },
    },
  };
}

export function applyCoverPreset(materials: Materials, coverPresetId: string): Materials {
  const preset = COVER_PRESETS.find((p) => p.id === coverPresetId);
  if (!preset) return materials;
  return {
    ...materials,
    concrete: {
      ...materials.concrete,
      cover: { ...materials.concrete.cover, value: preset.cover },
    },
  };
}

export function applyStandardDiameters(materials: Materials): Materials {
  return {
    ...materials,
    available_diameters: STANDARD_REBAR_DIAMETERS.map((d) => ({
      id: `D${d}`,
      nominal_diameter: { value: d, unit: "mm", provenance: "INPUT" },
    })),
  };
}

function validateFysLimit(path: string, value: number | null): MaterialIssue[] {
  if (value !== null && Number.isFinite(value) && value > MAX_FYS_LIMIT) {
    return [{
      path,
      message: `fys (${value} MPa) melebihi batas maksimum ${MAX_FYS_LIMIT} MPa untuk tulangan geser/torsi sesuai SNI 2847:2019 Tabel 20.2.2.4a.`,
    }];
  }
  return [];
}

export function validateMaterials(materials: Materials): MaterialIssue[] {
  const issues = [
    ...validateGrade("concrete.grade", "beton", materials.concrete.grade),
    ...validatePositive("concrete.fc", "fc'", materials.concrete.fc.value),
    ...validatePositive("concrete.density", "Berat jenis beton", materials.concrete.density.value),
    ...validatePositive("concrete.cover", "Selimut beton", materials.concrete.cover.value),
    ...validateGrade("longitudinal_rebar.grade", "tulangan longitudinal", materials.longitudinal_rebar.grade),
    ...validatePositive("longitudinal_rebar.fy", "fy", materials.longitudinal_rebar.fy.value),
    ...validateGrade("transverse_rebar.grade", "tulangan transversal", materials.transverse_rebar.grade),
    ...validatePositive("transverse_rebar.fys", "fys", materials.transverse_rebar.fys.value),
    ...validateFysLimit("transverse_rebar.fys", materials.transverse_rebar.fys.value),
  ];

  if (!materials.available_diameters.length) {
    issues.push({ path: "available_diameters", message: "Tambahkan minimal satu diameter tulangan." });
  }
  const seen = new Set<number>();
  materials.available_diameters.forEach(({ nominal_diameter }, index) => {
    const path = `available_diameters.${index}.nominal_diameter`;
    issues.push(...validatePositive(path, "Diameter tulangan", nominal_diameter.value));
    if (nominal_diameter.value !== null && seen.has(nominal_diameter.value)) {
      issues.push({ path, message: `Diameter ${nominal_diameter.value} mm duplikat.` });
    }
    if (nominal_diameter.value !== null) seen.add(nominal_diameter.value);
  });
  return issues;
}

export function createDefaultMaterials(revisionId: string): Materials {
  const input = <U extends MaterialUnit>(unit: U): MaterialValue<U> => ({ value: null, unit, provenance: "INPUT" });
  return {
    revision_id: revisionId,
    concrete: {
      type: "concrete",
      grade: "",
      fc: input("MPa"),
      density: input("kg/m³"),
      cover: input("mm"),
      elastic_modulus: { value: null, unit: "MPa", provenance: "CODE", status: "UNAVAILABLE", formula_id: null, standard_ref: null },
    },
    longitudinal_rebar: { type: "longitudinal_rebar", grade: "", fy: input("MPa") },
    transverse_rebar: { type: "transverse_rebar", grade: "", fys: input("MPa") },
    available_diameters: [],
  };
}

export function sameMaterials(left: Materials, right: Materials) {
  return JSON.stringify({ ...left, revision_id: "" }) === JSON.stringify({ ...right, revision_id: "" });
}
