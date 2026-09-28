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
