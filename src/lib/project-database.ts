import type { Project, ProjectBundle, ProjectRevision } from "./projects";

const DATABASE_NAME = "strucal";
const DATABASE_VERSION = 1;

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
      database.createObjectStore("projects", { keyPath: "id" });
      const revisions = database.createObjectStore("project_revisions", { keyPath: "id" });
      revisions.createIndex("project_id", "project_id");
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
    const transaction = database.transaction(["projects", "project_revisions"], "readonly");
    const project = await requestResult(transaction.objectStore("projects").get(projectId) as IDBRequest<Project | undefined>);
    if (!project) {
      await transactionDone(transaction);
      return null;
    }
    const revision = await requestResult(transaction.objectStore("project_revisions").get(project.active_revision_id) as IDBRequest<ProjectRevision | undefined>);
    await transactionDone(transaction);
    if (!revision) throw new Error("Revisi aktif proyek tidak ditemukan.");
    return { project, revision };
  } finally {
    database.close();
  }
}

export async function persistProjectBundle(bundle: ProjectBundle) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(["projects", "project_revisions"], "readwrite");
    transaction.objectStore("project_revisions").add(bundle.revision);
    transaction.objectStore("projects").put(bundle.project);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
