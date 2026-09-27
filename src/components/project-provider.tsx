"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getProjectBundle, listProjects, persistProjectBundle } from "../lib/project-database";
import { createProjectBundle, reviseProject, sameProjectInput, type Project, type ProjectBundle, type ProjectInput } from "../lib/projects";

export type SaveStatus = "loading" | "saved" | "saving" | "unsaved" | "error";
type ProjectContextValue = {
  projects: Project[];
  active: ProjectBundle | null;
  saveStatus: SaveStatus;
  createProject: () => Promise<void>;
  selectProject: (id: string) => Promise<void>;
  saveProject: (input: ProjectInput, reason: "manual" | "autosave") => Promise<void>;
  markUnsaved: () => void;
};

const ACTIVE_PROJECT_KEY = "strucal.activeProjectId";
const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<ProjectBundle | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const activeRef = useRef<ProjectBundle | null>(null);
  const queue = useRef(Promise.resolve());

  const applyActive = useCallback((bundle: ProjectBundle | null) => {
    activeRef.current = bundle;
    setActive(bundle);
    if (bundle) localStorage.setItem(ACTIVE_PROJECT_KEY, bundle.project.id);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const storedProjects = await listProjects();
        setProjects(storedProjects);
        const requestedId = localStorage.getItem(ACTIVE_PROJECT_KEY);
        const projectId = storedProjects.some(({ id }) => id === requestedId) ? requestedId : storedProjects[0]?.id;
        applyActive(projectId ? await getProjectBundle(projectId) : null);
        setSaveStatus("saved");
      } catch (error) {
        console.error("Gagal memuat proyek", error);
        setSaveStatus("error");
      }
    })();
  }, [applyActive]);

  const createProject = useCallback(async () => {
    setSaveStatus("saving");
    try {
      const bundle = createProjectBundle({ title: "Proyek Tanpa Judul", location: "", function: "", owner: "" });
      await persistProjectBundle(bundle);
      setProjects((current) => [bundle.project, ...current]);
      applyActive(bundle);
      setSaveStatus("saved");
    } catch (error) {
      console.error("Gagal membuat proyek", error);
      setSaveStatus("error");
    }
  }, [applyActive]);

  const selectProject = useCallback(async (id: string) => {
    await queue.current;
    setSaveStatus("loading");
    try {
      applyActive(await getProjectBundle(id));
      setSaveStatus("saved");
    } catch (error) {
      console.error("Gagal membuka proyek", error);
      setSaveStatus("error");
    }
  }, [applyActive]);

  const saveProject = useCallback(async (input: ProjectInput, reason: "manual" | "autosave") => {
    queue.current = queue.current.then(async () => {
      const current = activeRef.current;
      if (!current || sameProjectInput(current.project, input)) {
        setSaveStatus("saved");
        return;
      }
      setSaveStatus("saving");
      try {
        const next = reviseProject(current, input, reason);
        await persistProjectBundle(next);
        applyActive(next);
        setProjects((items) => [next.project, ...items.filter(({ id }) => id !== next.project.id)]);
        setSaveStatus("saved");
      } catch (error) {
        console.error("Gagal menyimpan proyek", error);
        setSaveStatus("error");
      }
    });
    await queue.current;
  }, [applyActive]);

  return <ProjectContext.Provider value={{ projects, active, saveStatus, createProject, selectProject, saveProject, markUnsaved: () => setSaveStatus("unsaved") }}>{children}</ProjectContext.Provider>;
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error("useProjects harus digunakan di dalam ProjectProvider.");
  return context;
}
