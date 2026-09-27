# TEST FIXTURES & ACCEPTANCE

## Test Pyramid
Domain unit tests, registry rule tests, golden calculation fixtures, import/data-contract tests, integration tests, UI component tests, minimal E2E smoke tests.

Browser automation bukan source of truth untuk engineering correctness.

## Golden Fixtures
Engineer-approved cases untuk grid, story, load calculations, seismic derivation, KDS, system eligibility, coefficient lookup, period/base shear/story force, beam, column, SCWB, each foundation type, ETABS envelope mapping.

Setiap fixture: expected value, unit, tolerance, registry version.

## Generate #1 Acceptance
- Project create/save/reopen.
- Grid System valid.
- Story Data valid.
- Plan/Elevation/3D sesuai geometry.
- Material valid.
- Load engine valid.
- Seismic engine valid.
- KDS review visible.
- System eligibility visible.
- Invalid system blocked dengan alasan.
- Valid system selection drives code parameters.
- ETABS Input Summary complete.
- DOCX generated.
- PDF generated.
- DOCX/PDF same snapshot.
- no NaN/Infinity.
- production build passes.
- Railway deployment healthy.

## Engineering UI Acceptance
Tidak meminta user mengisi derived seismic values yang bisa dihitung engine. Semua computed result punya provenance. Blocked stage menjelaskan dependency. No default OK. Stale state visible.

## Regression Gate
Golden fixture tidak berubah tanpa explicit version bump, reason, engineer approval.
