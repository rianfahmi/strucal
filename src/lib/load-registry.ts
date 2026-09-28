export type CombinationRule = {
  id: string;
  label: string;
  expression: string;
  standard_ref: string;
  reviewed_by: string;
  reviewed_at: string;
};

export type CombinationRegistry = {
  registry_version: string;
  status: "APPROVED" | "PENDING_ENGINEER_APPROVAL";
  rules: CombinationRule[];
  note: string;
};

export function getCombinationRegistry(registryVersion: string): CombinationRegistry {
  return {
    registry_version: registryVersion,
    status: "PENDING_ENGINEER_APPROVAL",
    rules: [],
    note: "Belum ada ekstraksi aturan kombinasi yang disetujui engineer pada registry proyek.",
  };
}
