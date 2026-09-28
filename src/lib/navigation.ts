export type NavigationItem = { label: string; href: string; number?: number };
export type NavigationGroup = { label: string; items: NavigationItem[] };

export const navigationGroups: NavigationGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Overview", href: "/" }],
  },
  {
    label: "Tahap 1 — Parameter Awal",
    items: [
      { number: 1, label: "Data Proyek", href: "/data-proyek" },
      { number: 2, label: "Geometri & Model", href: "/geometri-model" },
      { number: 3, label: "Material", href: "/material" },
      { number: 4, label: "Pembebanan", href: "/pembebanan" },
      { number: 5, label: "Analisa Gempa", href: "/analisa-gempa" },
      { number: 6, label: "Input ETABS", href: "/input-etabs" },
      { number: 7, label: "Generate #1", href: "/generate-1" },
    ],
  },
  {
    label: "Tahap 2 — Hasil Analisis",
    items: [
      { number: 8, label: "Hasil ETABS", href: "/hasil-etabs" },
      { number: 9, label: "Rekap Gaya", href: "/rekap-gaya" },
    ],
  },
  {
    label: "Tahap 3 — Desain",
    items: [
      { number: 10, label: "Desain Balok", href: "/desain-balok" },
      { number: 11, label: "Desain Kolom", href: "/desain-kolom" },
      { number: 12, label: "SCWB", href: "/scwb" },
      { number: 13, label: "Pondasi", href: "/pondasi" },
    ],
  },
  {
    label: "Output",
    items: [
      { number: 14, label: "Rekap Desain", href: "/rekap-desain" },
      { number: 15, label: "Generate #2", href: "/generate-2" },
    ],
  },
];

export const navigationItems = navigationGroups.flatMap((group) => group.items);
