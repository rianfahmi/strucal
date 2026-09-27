# REPORT SPECIFICATION

## Principle
Report berasal dari calculation snapshot. Narrative values tidak boleh diketik ulang independen di template.

## Generate #1
Output DOCX + PDF dari snapshot sama.

Front Matter: cover, project metadata, optional approval sheet, TOC/list where implemented.

Bab I — Pendahuluan: project/building data, criteria/standards, geometry summary, figures.

Bab II — Material & Pembebanan: material, assumptions, calculated loads, combination review, formula/substitution where needed.

Bab III — Permodelan/Input ETABS sebelum result: model data, Grid System, Story Data, geometry images, sections, boundary, load patterns, load assignments, seismic setup, load cases, load combinations, readiness summary.

## Generate #2
Reuse upstream lineage lalu tambahkan ETABS result, force envelope summary, Bab IV design, conclusion/rebar summary, appendices, audit/version metadata.

## Bab III After ETABS
Dapat diperluas dengan Analysis Result/Output ETABS, governing force tables, uploaded diagrams/screenshots, Rekap Gaya.

## Conclusion Tables
Derive dari Envelope + DesignResult yang sama dengan detailed calculation. Tidak ada manual duplicate source.

## Calculation Presentation
Major checks: formula, substitution, unit, result, demand, capacity, ratio, status, standard reference.

## Snapshot Integrity
DOCX dan PDF memakai data payload ReportSnapshot yang sama.

## Blocking Conditions
Required calculation invalid, NaN/Infinity, unknown unit, required stale dependency, false engineering status risk.
