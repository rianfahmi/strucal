# CODE REGISTRY & SNI GOVERNANCE

## Default Policy
Project baru default ke standar aktif terbaru yang sudah diverifikasi dan disetujui dalam product registry. Project lama tetap pinned ke registry version-nya kecuali dimigrasikan eksplisit.

## Verified Baseline — 27 Sep 2026
Katalog resmi BSN masih menunjukkan baseline berikut berstatus berlaku:
- SNI 1726:2019 — ketahanan gempa bangunan gedung/nongedung.
- SNI 1727:2020 — beban desain minimum dan kriteria terkait.
- SNI 2847:2019 — persyaratan beton struktural.

Jangan memakai label “SNI 1726:2022” tanpa verifikasi resmi baru.

Official references:
- https://pesta.bsn.go.id/produk/by_ics?ics_no=91.080&key=
- https://pesta.bsn.go.id/produk/detail/12927-sni17272020
- https://pesta.bsn.go.id/produk/detail/12731-sni28472019

## Copyright / Governance
Jangan commit full copyrighted SNI text/tables tanpa hak. Registry hanya memuat engineer-approved extracted rules yang diperlukan, identifiers/references, formula metadata, dan fixtures sesuai lisensi.

## Registry Entities
Standard, StandardVersion, TableRule, FormulaRule, StructuralSystem, StructuralSystemConstraint, CoefficientLookup, CombinationRule.

## Minimum Fields
registry_version, standard_number, standard_year, status, rule_id, rule_type, table_or_clause_ref, conditions, result, unit, effective_from, reviewed_by, reviewed_at, source_note.

## Seismic Registry Requirements
Site coefficient lookup, design spectrum rules, KDS rules, structural system eligibility, R/Ω0/Cd, Ct/x, height/usage restrictions, seismic combination rules.

## Review Gate
Technical extraction complete → engineer review → golden fixtures pass → registry version tagged → migration behavior defined.

## Project Pinning
ProjectRevision dan ReportSnapshot menyimpan code_registry_version. Tidak ada silent recalculation snapshot lama dengan registry baru.
