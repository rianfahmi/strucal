# StruCal

Kalkulator Struktur Beton Bertulang V1.

## Prasyarat

- Node.js 24 atau lebih baru
- npm 11 atau lebih baru

## Pengembangan

```bash
npm install
cp .env.example .env.local
npm run dev
```

Aplikasi tersedia di `http://localhost:3000`. Health endpoint tersedia di `GET /health`.

## Pemeriksaan

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deployment

Railway menjalankan `npm run build` dan `npm start`. Production mengikuti branch `main`.

Production: <https://strucal-production-7d9b.up.railway.app>

Health: <https://strucal-production-7d9b.up.railway.app/health>

## Dokumentasi produk

Handoff proyek tersimpan di [`docs/handoff`](docs/handoff). Ikuti `00_README.md`, `tasks.yaml`, dan `11_IMPLEMENTATION_PLAN.md` sebelum memulai milestone.
