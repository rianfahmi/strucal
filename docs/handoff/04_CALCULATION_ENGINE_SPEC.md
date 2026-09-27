# CALCULATION ENGINE SPECIFICATION

## Core Rule
UI tidak boleh memiliki duplikasi formula bisnis. Calculation logic ada di domain modules/services dengan typed inputs/outputs.

## Result Object
value, unit, status, provenance, formula_id, standard_ref, inputs_used, engine_version, registry_version, warnings.

## Units
Centralized typed unit conversion. Jangan parse unit dari string laporan.

## Dependency Graph
Project → Geometry → Material → Loads → Seismic → ETABS Setup → ETABS Import → Envelope → Design → Report.

## Geometry Engine
Input grid X/Y spacing/ordinate + stories. Output ordinates, total dimensions, elevations, geometry graph. Spacing↔ordinate round-trip within tolerance.

## Load Engine
Input geometry, density, load definitions, application targets, code-derived combination rules. Output normalized loads, assignments, seismic weight components, ETABS-ready summary.

## Seismic Engine Pipeline
1. Validate raw seismic inputs.
2. Lookup site/spectrum coefficients from approved registry.
3. Calculate design-spectrum parameters.
4. Determine KDS from applicable rule tables.
5. Expose KDS review + governing result.
6. Evaluate eligible structural systems based on KDS, risk category when applicable, material, height, other registry conditions.
7. User selects a valid system.
8. Lookup R, Ω0, Cd, Ct, x and related parameters.
9. Calculate approximate period + limits.
10. Calculate seismic coefficient(s).
11. Determine seismic weight.
12. Calculate base shear.
13. Calculate vertical distribution.
14. Generate response-spectrum data.
15. Produce ETABS setup payload.
16. Produce transparent formula trail.

## KDS Review Object
Store risk_category, SDS, SD1, rule/table checks, each result, governing_kds, references.
Actual rule values must come from approved licensed registry.

## Structural System Eligibility
Each system has label, eligibility allowed|conditional|blocked, reasons, limits, parameters R/Omega0/Cd/Ct/x.

## ETABS Import Engine
Raw row → normalized unit row → element mapping → orientation validation → combo/station validation → accepted ForceResult → Envelope.

## Beam Envelope
Preserve source rows for negative left, negative right, positive span, governing shear.

## Column Envelope
Preserve source rows for largest axial condition and governing moment condition. Pu/Mux/Muy stay grouped by source row.

## Design Modules
Each returns demand, capacity, ratio, reinforcement, status, formula trail, warnings.

Beam: flexure left/span/right, min/max controls, shear, reinforcement selection.
Column: axial-biaxial method, reinforcement, interaction/capacity, explicit method label.
SCWB: joint capacities, ratio, criterion, status.
Foundation: separate module per type.

## Safe Failure
Invalid mandatory input → invalid/review status, no false OK. Export blocked only if missing dependency affects requested report.

## Formula Registry
Every formula has stable Formula ID. Jangan gunakan text UI sebagai identity formula.

## Workbook Policy
Word/Excel lama hanya untuk benchmark, flow, report presentation, candidate formulas. Tidak boleh menjadi production truth tanpa reconstruction + validation.
