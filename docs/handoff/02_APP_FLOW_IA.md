# APPLICATION FLOW & INFORMATION ARCHITECTURE

## Global Shell
Project selector/title, project revision/status, sidebar, header actions, autosave/save indicator, calculation/validation warning center.

## Sidebar
### OVERVIEW
- Overview

### TAHAP 1 — PARAMETER AWAL
1. Data Proyek
2. Geometri & Model
3. Material
4. Pembebanan
5. Analisa Gempa
6. Input ETABS
7. Generate #1

### TAHAP 2 — HASIL ANALISIS
8. Hasil ETABS
9. Rekap Gaya

### TAHAP 3 — DESAIN
10. Desain Balok
11. Desain Kolom
12. SCWB
13. Pondasi

### OUTPUT
14. Rekap Desain
15. Generate #2

## Overview
Status Stage 1/2/3, completeness, latest revision, stale dependencies, latest reports, continue button.

## Data Proyek
Tabs: Identitas, Data Bangunan, Kriteria Desain, Standar aktif project.

## Geometri & Model
Internal tabs: Grid System, Story Data, Sections/Elements.
Persistent viewer: Plan, Elevation, 3D.

Grid: X/Y, spacing/ordinate, add/edit/delete, label, validation.
Story: name, height, elevation, ordering.
Sections/Elements: section definition dan assignment rules harus dibekukan sebelum coding detail; agent tidak boleh mengarang rule diam-diam.

## Material
Concrete, Longitudinal Rebar, Transverse Rebar, Available Diameters.

## Pembebanan
Load Definitions, Area/Line Assignment, Gravity Loads, Wind/Rain, Seismic Weight, Combination Review, Summary.

## Analisa Gempa
Internal flow:
1. Input Dasar
2. Parameter Spektrum
3. Review KDS
4. Review Sistem Struktur
5. Hasil Analisis
6. Response Spectrum
7. Distribusi Story
8. Validation

## Input ETABS
Read-only/generated handoff: Geometry, Stories, Materials, Sections, Restraints, Load Patterns, Load Assignment, Seismic Setup, Load Cases, Load Combinations, Readiness Checklist.

## Generate #1
Snapshot/revision, completeness checks, report preview summary, Generate DOCX, Generate PDF, history.

## Hasil ETABS
Upload/import, validation, mapping, raw rows, corrections, accepted snapshot.

## Rekap Gaya
Beam envelope, column envelope, governing source trace.

## Tahap Desain
Balok, Kolom, SCWB, Pondasi masing-masing memiliki list, calculation workspace, detail result, summary.

## Rekap Desain
Dimensions, forces, As required/provided, reinforcement, shear reinforcement, D/C, status.

## Generate #2
Final validation, stale check, snapshot, DOCX/PDF, history.

## Navigation Rules
User boleh melihat halaman. Perhitungan next-stage diblokir hanya bila dependency mandatory invalid. Selalu jelaskan alasan blocked dan tindakan yang dibutuhkan.
