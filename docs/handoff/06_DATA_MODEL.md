# DATA MODEL BLUEPRINT

## Core Entities
Project: id, title, location, function, owner, created_by, active_revision_id, status.

ProjectRevision: id, project_id, revision_number, registry_version, engine_version, created_at, frozen_at, source_revision_id.

Geometry: revision_id, grid_x, grid_y, stories, derived_dimensions.
GridLine: axis, label, ordinate.
Story: name, order, height, elevation.
Material: type, grade, fc, fy, fys, density, elastic_modulus, source.
Section: id, type, dimensions, material_id.
Element: id, type, story, section_id, connectivity, local_axis, length.
LoadDefinition: type, value, unit, source, assumption.
LoadAssignment: load_id, target_type, target_id, application.
SeismicModel: raw_inputs, derived_results, kds_review, selected_structural_system_id, registry_version.
EtabsSetupSnapshot: revision_id, payload, readiness_status, generated_at.
EtabsImport: revision_id, model_version, units, file_metadata, accepted_at, immutable_hash.
ForceResult: import_id, element_id, story, combo, station, P, V2, V3, T, M2, M3, units, source_row.
Envelope: revision_id, element_id, envelope_type, governing_force_result_id, demand_values.
DesignResult: revision_id, element_id, module, method, inputs_hash, demand, capacity, ratio, reinforcement, status, formula_trace.
FoundationCase: revision_id, type, soil_data, geometry, governing_forces.
ReportSnapshot: revision_id, report_type, chapters, data_hash, registry_version, engine_version, generated_at, docx_file, pdf_file.

## Revision Rules
Generate #1 membuat ReportSnapshot. Upstream edits membuat revision baru/updated state dan downstream stale. Accepted ETABS import terikat revision tertentu. Generate #2 tidak boleh memakai ETABS import dari revision lain tanpa migration/revalidation.

## Stale Graph
Geometry/Material/Load/Seismic change → ETABS Setup stale → ETABS Import stale → Envelope stale → Design stale → Generate #2 stale.
