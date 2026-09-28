import type { Project, ProjectBundle, ProjectRevision } from "./projects";
import { createDefaultGeometry, type Geometry } from "./geometry";
import { createDefaultMaterials, type Materials } from "./materials";
import { createDefaultLoads, type Loads } from "./loads";

const DATABASE_NAME = "strucal";
const DATABASE_VERSION = 4;

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Operasi database gagal."));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Transaksi database gagal."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Transaksi database dibatalkan."));
  });
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("projects")) database.createObjectStore("projects", { keyPath: "id" });
      if (!database.objectStoreNames.contains("project_revisions")) {
        const revisions = database.createObjectStore("project_revisions", { keyPath: "id" });
        revisions.createIndex("project_id", "project_id");
      }
      if (!database.objectStoreNames.contains("geometries")) database.createObjectStore("geometries", { keyPath: "revision_id" });
      if (!database.objectStoreNames.contains("materials")) database.createObjectStore("materials", { keyPath: "revision_id" });
      if (!database.objectStoreNames.contains("loads")) database.createObjectStore("loads", { keyPath: "revision_id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Database proyek tidak dapat dibuka."));
  });
}

export async function listProjects() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction("projects", "readonly");
    const projects = await requestResult(transaction.objectStore("projects").getAll() as IDBRequest<Project[]>);
    await transactionDone(transaction);
    return projects.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  } finally {
    database.close();
  }
}

export async function getProjectBundle(projectId: string): Promise<ProjectBundle | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(["projects", "project_revisions", "geometries", "materials", "loads"], "readonly");
    const project = await requestResult(transaction.objectStore("projects").get(projectId) as IDBRequest<Project | undefined>);
    if (!project) {
      await transactionDone(transaction);
      return null;
    }
    const revision = await requestResult(transaction.objectStore("project_revisions").get(project.active_revision_id) as IDBRequest<ProjectRevision | undefined>);
    const geometry = await requestResult(transaction.objectStore("geometries").get(project.active_revision_id) as IDBRequest<Geometry | undefined>);
    const materials = await requestResult(transaction.objectStore("materials").get(project.active_revision_id) as IDBRequest<Materials | undefined>);
    const loads = await requestResult(transaction.objectStore("loads").get(project.active_revision_id) as IDBRequest<Loads | undefined>);
    await transactionDone(transaction);
    if (!revision) throw new Error("Revisi aktif proyek tidak ditemukan.");
    return {
      project,
      revision,
      geometry: geometry ?? createDefaultGeometry(revision.id),
      materials: materials ?? createDefaultMaterials(revision.id),
      loads: loads ?? createDefaultLoads(revision.id, revision.registry_version),
    };
  } finally {
    database.close();
  }
}

export async function persistProjectBundle(bundle: ProjectBundle) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(["projects", "project_revisions", "geometries", "materials", "loads"], "readwrite");
    transaction.objectStore("project_revisions").add(bundle.revision);
    transaction.objectStore("geometries").put(bundle.geometry);
    transaction.objectStore("materials").put(bundle.materials);
    transaction.objectStore("loads").put(bundle.loads);
    transaction.objectStore("projects").put(bundle.project);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
