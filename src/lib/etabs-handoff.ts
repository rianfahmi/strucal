import { spacingsFromOrdinates, validateGeometry } from "./geometry.ts";
import { calculateSeismicWeight, loadTargets, validateLoads, LOAD_CATEGORY_LABELS, type SeismicWeightResult } from "./loads.ts";
import { getCombinationRegistry, type CombinationRegistry } from "./load-registry.ts";
import { validateMaterials } from "./materials.ts";
import { ENGINE_VERSION, type ProjectBundle } from "./projects.ts";
import { calculateSeismic, seismicContext, type SeismicResult } from "./seismic.ts";
import { getSeismicRegistry } from "./seismic-registry.ts";

export type ReadinessStatus = "READY" | "WARNING" | "BLOCKED";
export type ReadinessClassification = "READY_REQUIREMENT" | "WARNING_ONLY" | "ETABS_RESPONSIBILITY" | "REFERENCE_ONLY";
export type ReadinessItem = { label: string; status: ReadinessStatus; classification: ReadinessClassification; detail: string; href: string };

export function createEtabsHandoff(bundle: ProjectBundle, registry: CombinationRegistry = getCombinationRegistry(bundle.loads.combination_registry_version)) {
  const { project, revision, geometry, materials, loads, seismic } = bundle;
  const geometryIssues = validateGeometry(geometry);
  const weight: SeismicWeightResult = geometryIssues.length ? {
    value: 0, unit: "kN", status: "INVALID", provenance: "CALCULATED", formula_id: "LOAD.SW.AGGREGATE.1",
    registry_version: revision.registry_version, components: [], by_story: [], warnings: ["Geometri belum valid."],
  } : calculateSeismicWeight(loads, geometry, revision.registry_version);
  const calculated = calculateSeismic(seismic, seismicContext(geometry.stories, weight, materials.concrete.type === "concrete", ENGINE_VERSION), getSeismicRegistry(revision.registry_version));
  const activeRevision = project.active_revision_id === revision.id && [geometry.revision_id, materials.revision_id, loads.revision_id, seismic.revision_id].every((id) => id === revision.id);
  const seismicStale = !activeRevision || (seismic.derived_results ? seismic.derived_results.status !== calculated.status
    || seismic.derived_results.base_shear?.value !== calculated.base_shear?.value
    || seismic.derived_results.spectrum?.sds.value !== calculated.spectrum?.sds.value
    : seismic.raw_inputs.ss !== null || seismic.selected_structural_system_id !== null);
  const result: SeismicResult | null = seismicStale || !seismic.derived_results ? null : calculated;
  const materialIssues = validateMaterials(materials);
  const loadIssues = geometryIssues.length ? [{ path: "assignments", message: "Geometri belum valid." }] : validateLoads(loads, geometry);
  const selected = calculated.system_eligibility.find(({ id }) => id === seismic.selected_structural_system_id);
  const combinations = loads.combination_registry_version === registry.registry_version
    ? registry.rules.filter(({ id }) => loads.combination_rule_ids.includes(id)) : [];
  const readiness: ReadinessItem[] = [
    { label: "Geometri", status: geometryIssues.some(({ path }) => path.startsWith("grid_")) ? "BLOCKED" : "READY", classification: "READY_REQUIREMENT", detail: geometryIssues.find(({ path }) => path.startsWith("grid_"))?.message ?? "Grid X/Y valid.", href: "/geometri-model" },
    { label: "Story data", status: geometryIssues.some(({ path }) => path.startsWith("stories")) ? "BLOCKED" : "READY", classification: "READY_REQUIREMENT", detail: geometryIssues.find(({ path }) => path.startsWith("stories"))?.message ?? "Tinggi dan elevasi valid.", href: "/geometri-model" },
    { label: "Material", status: materialIssues.length ? "BLOCKED" : "READY", classification: "READY_REQUIREMENT", detail: materialIssues[0]?.message ?? "Properti material lengkap.", href: "/material" },
    { label: "Definisi beban", status: loadIssues.some(({ path }) => path.startsWith("definitions")) ? "BLOCKED" : "READY", classification: "READY_REQUIREMENT", detail: loadIssues.find(({ path }) => path.startsWith("definitions"))?.message ?? "Definisi dan unit valid.", href: "/pembebanan" },
    { label: "Assignment beban", status: !loads.assignments.length || loadIssues.some(({ path }) => path.startsWith("assignments")) ? "BLOCKED" : "READY", classification: "READY_REQUIREMENT", detail: !loads.assignments.length ? "Belum ada assignment." : loadIssues.find(({ path }) => path.startsWith("assignments"))?.message ?? "Target dan aplikasi valid.", href: "/pembebanan" },
    { label: "Input seismik", status: calculated.status === "REQUIRES_INPUT" ? "BLOCKED" : "READY", classification: "READY_REQUIREMENT", detail: calculated.status === "REQUIRES_INPUT" ? calculated.warnings[0] ?? "Input belum lengkap." : "Input mentah valid.", href: "/analisa-gempa" },
    { label: "KDS", status: calculated.kds_review ? "READY" : "BLOCKED", classification: "READY_REQUIREMENT", detail: calculated.kds_review ? `KDS ${calculated.kds_review.governing_kds}.` : "KDS belum dapat ditentukan.", href: "/analisa-gempa" },
    { label: "Sistem struktur", status: selected?.status === "ALLOWED" ? "READY" : "BLOCKED", classification: "READY_REQUIREMENT", detail: selected?.status === "ALLOWED" ? selected.label : selected?.reason ?? "Pilih sistem berstatus ALLOWED.", href: "/analisa-gempa" },
    { label: "Perhitungan seismik", status: result?.status === "VALID" ? "READY" : "BLOCKED", classification: "READY_REQUIREMENT", detail: seismicStale ? "Hasil M6 belum tersimpan untuk data aktif; hitung dan simpan ulang." : !seismic.derived_results ? "Hasil M6 belum tersedia." : calculated.warnings[0] ?? (calculated.status === "VALID" ? "Hasil valid." : calculated.status), href: "/analisa-gempa" },
    { label: "Kombinasi beban", status: combinations.length ? "READY" : "WARNING", classification: "REFERENCE_ONLY", detail: combinations.length ? `${combinations.length} kombinasi referensi tersedia.` : "Referensi kombinasi belum tersedia; tidak memblokir kesiapan Stage 1.", href: "/pembebanan" },
    { label: "Section / elemen", status: "WARNING", classification: "WARNING_ONLY", detail: "Dimensi dan assignment elemen belum tersedia pada model proyek; review manual di ETABS.", href: "/geometri-model" },
    { label: "Boundary / restraint", status: "WARNING", classification: "ETABS_RESPONSIBILITY", detail: "Kondisi restraint ditetapkan dan diverifikasi engineer di model ETABS.", href: "/geometri-model" },
    { label: "Self-weight multiplier", status: "WARNING", classification: "ETABS_RESPONSIBILITY", detail: "Multiplier dikonfirmasi engineer saat membuat load pattern ETABS untuk mencegah penghitungan ganda.", href: "/pembebanan" },
    { label: "Setup load case", status: "WARNING", classification: "ETABS_RESPONSIBILITY", detail: "Jenis case, arah analisis, dan parameter case ditetapkan di ETABS.", href: "/pembebanan" },
    { label: "Setup response spectrum", status: "WARNING", classification: "ETABS_RESPONSIBILITY", detail: "Damping dan faktor skala ditetapkan serta diverifikasi di ETABS.", href: "/analisa-gempa" },
  ];
  if (!activeRevision) readiness.unshift({ label: "Revisi aktif", status: "BLOCKED", classification: "READY_REQUIREMENT", detail: "Data modul tidak cocok dengan revisi proyek aktif.", href: "/data-proyek" });
  const status: ReadinessStatus = readiness.some((item) => item.status === "BLOCKED") ? "BLOCKED" : "READY";
  const targets = new Map((geometryIssues.length ? [] : loadTargets(geometry)).map((target) => [target.id, target]));
  return {
    status, readiness, stale: seismicStale, revision: revision.revision_number, revisionId: revision.id,
    registryVersion: revision.registry_version, combinationRegistryVersion: registry.registry_version,
    grids: (["X", "Y"] as const).map((axis) => {
      const lines = axis === "X" ? geometry.grid_x : geometry.grid_y;
      return { axis, lines, spacings: spacingsFromOrdinates(lines.map(({ ordinate }) => ordinate)) };
    }),
    stories: geometry.stories, materials,
    patterns: loads.definitions.map((definition) => ({ ...definition, categoryLabel: LOAD_CATEGORY_LABELS[definition.category], assignmentCount: loads.assignments.filter(({ load_id }) => load_id === definition.id).length })),
    assignments: loads.assignments.map((assignment) => ({ ...assignment, definition: loads.definitions.find(({ id }) => id === assignment.load_id), target: targets.get(assignment.target_id) })),
    rawSeismic: seismic.raw_inputs, inputProvenance: seismic.input_provenance, selectedSystem: selected,
    result, loadCases: [
      ...loads.definitions.map(({ id, name, category }) => ({ id, name, category: LOAD_CATEGORY_LABELS[category], source: "M5" })),
      ...(result?.status === "VALID" ? [{ id: "m6-equivalent-static", name: "Hasil gempa statik ekivalen (V, Fx)", category: "Seismic", source: "M6" }] : []),
    ],
    combinations, combinationStatus: registry.status, combinationNote: registry.note,
    spectrum: result?.response_spectrum ?? [], spectrumSource: result?.spectrum?.sds.standard_ref ?? "SNI 1726:2019 · M6",
  };
}
