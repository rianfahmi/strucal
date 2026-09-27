# ETABS DATA CONTRACT

## Website → ETABS
Generated, bukan duplicate manual input.

Geometry: grid labels+ordinates, stories+elevations/heights.
Material: concrete/rebar properties.
Sections: required beam/column/sloof sections.
Boundary: restraint assumptions.
Load Patterns: name, category/type, self-weight multiplier, source.
Load Assignments: target, pattern, magnitude, unit, note.
Seismic Setup: selected system, registry coefficients, response spectrum parameters, directions.
Load Cases: generated review list.
Load Combinations: generated from active registry/project conditions.
Readiness: READY / INCOMPLETE / REVIEW REQUIRED.

## ETABS → Website
Minimum raw schema: model_version, story, frame/element_id, station, combo/load case, local orientation, P, V2, V3, T, M2, M3, unit system.

Target import channels: XLSX, CSV, manual correction/entry for exceptional rows. Exact ETABS export template harus dibekukan sebelum importer implementation.

## Validation
Reject/quarantine missing identity, unknown unit, nonnumeric data, unmapped combo, unconfirmed local orientation, ambiguous duplicate rows.

## Traceability
Envelope harus link ke raw source row, governing combo/station.

## Sign Convention
Wajib eksplisit dan diuji dengan known ETABS fixture. Jangan implement “abs everything”.
