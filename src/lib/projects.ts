import { createDefaultGeometry, validateGeometry, type Geometry } from "./geometry.ts";

export const REGISTRY_VERSION = "SNI-1726:2019|SNI-1727:2020|SNI-2847:2019";
export const ENGINE_VERSION = "0.0.0";

export type ProjectStatus = "draft";
export type SaveReason = "create" | "manual" | "autosave";

export type Project = {
  id: string;
  title: string;
  location: string;
  function: string;
  owner: string;
  created_by: string;
  active_revision_id: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

export type ProjectRevision = {
  id: string;
  project_id: string;
  revision_number: number;
  registry_version: string;
  engine_version: string;
  created_at: string;
  frozen_at: string | null;
  source_revision_id: string | null;
  save_reason: SaveReason;
};

export type ProjectBundle = { project: Project; revision: ProjectRevision; geometry: Geometry };
export type ProjectInput = Pick<Project, "title" | "location" | "function" | "owner">;

export function createProjectBundle(
  input: ProjectInput,
  id: () => string = () => crypto.randomUUID(),
  now: () => string = () => new Date().toISOString(),
): ProjectBundle {
  const createdAt = now();
  const projectId = id();
  const revisionId = id();
  return {
    project: {
      id: projectId,
      ...input,
      created_by: "local-user",
      active_revision_id: revisionId,
      status: "draft",
      created_at: createdAt,
      updated_at: createdAt,
    },
    revision: {
      id: revisionId,
      project_id: projectId,
      revision_number: 1,
      registry_version: REGISTRY_VERSION,
      engine_version: ENGINE_VERSION,
      created_at: createdAt,
      frozen_at: null,
      source_revision_id: null,
      save_reason: "create",
    },
    geometry: createDefaultGeometry(revisionId),
  };
}

export function reviseProject(
  current: ProjectBundle,
  input: ProjectInput,
  reason: Exclude<SaveReason, "create">,
  id: () => string = () => crypto.randomUUID(),
  now: () => string = () => new Date().toISOString(),
): ProjectBundle {
  const createdAt = now();
  const revisionId = id();
  return {
    project: { ...current.project, ...input, active_revision_id: revisionId, updated_at: createdAt },
    revision: {
      id: revisionId,
      project_id: current.project.id,
      revision_number: current.revision.revision_number + 1,
      registry_version: current.revision.registry_version,
      engine_version: ENGINE_VERSION,
      created_at: createdAt,
      frozen_at: null,
      source_revision_id: current.revision.id,
      save_reason: reason,
    },
    geometry: { ...current.geometry, revision_id: revisionId },
  };
}

export function reviseGeometry(
  current: ProjectBundle,
  geometry: Geometry,
  reason: Exclude<SaveReason, "create">,
  id: () => string = () => crypto.randomUUID(),
  now: () => string = () => new Date().toISOString(),
): ProjectBundle {
  const issues = validateGeometry(geometry);
  if (issues.length) throw new Error(issues[0].message);
  const createdAt = now();
  const revisionId = id();
  return {
    project: { ...current.project, active_revision_id: revisionId, updated_at: createdAt },
    revision: {
      id: revisionId,
      project_id: current.project.id,
      revision_number: current.revision.revision_number + 1,
      registry_version: current.revision.registry_version,
      engine_version: ENGINE_VERSION,
      created_at: createdAt,
      frozen_at: null,
      source_revision_id: current.revision.id,
      save_reason: reason,
    },
    geometry: { ...geometry, revision_id: revisionId },
  };
}

export function sameProjectInput(project: Project, input: ProjectInput) {
  return project.title === input.title && project.location === input.location && project.function === input.function && project.owner === input.owner;
}
