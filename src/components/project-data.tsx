"use client";

import { useEffect, useRef, useState } from "react";
import { useProjects, type SaveStatus } from "./project-provider";
import type { ProjectInput, ProjectRevision } from "../lib/projects";

export function ProjectData() {
  const { active, createProject, markUnsaved, saveProject, saveStatus } = useProjects();

  useEffect(() => {
    const warnBeforeClose = (event: BeforeUnloadEvent) => {
      if (saveStatus === "unsaved" || saveStatus === "saving" || saveStatus === "error") event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeClose);
    return () => window.removeEventListener("beforeunload", warnBeforeClose);
  }, [saveStatus]);

  if (!active) return <section className="panel empty-project"><h2>Belum ada proyek</h2><p>Buat proyek untuk mulai menyimpan data dan revisi.</p><button className="button button-primary" type="button" onClick={() => void createProject()}>Buat Proyek</button></section>;

  return <ProjectForm key={active.project.id} initial={active.project} revision={active.revision} markUnsaved={markUnsaved} saveProject={saveProject} saveStatus={saveStatus} />;
}

function ProjectForm({ initial, revision, markUnsaved, saveProject, saveStatus }: {
  initial: ProjectInput;
  revision: ProjectRevision;
  markUnsaved: () => void;
  saveProject: (input: ProjectInput, reason: "manual" | "autosave") => Promise<void>;
  saveStatus: SaveStatus;
}) {
  const [input, setInput] = useState<ProjectInput>(initial);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function update(field: keyof ProjectInput, value: string) {
    const next = { ...input, [field]: value };
    setInput(next);
    markUnsaved();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveProject(next, "autosave"), 800);
  }

  async function saveNow() {
    clearTimeout(timer.current);
    await saveProject(input, "manual");
  }

  return (
    <section className="panel project-form-panel">
      <div className="panel-heading"><div><p className="eyebrow">Identitas</p><h2>Identitas proyek</h2></div><button className="button button-primary" type="button" onClick={() => void saveNow()} disabled={saveStatus === "saving"}>Simpan</button></div>
      <form className="project-form" onSubmit={(event) => { event.preventDefault(); void saveNow(); }}>
        <label><span>Nama proyek</span><input required value={input.title} onChange={(event) => update("title", event.target.value)} /></label>
        <label><span>Lokasi</span><input value={input.location} onChange={(event) => update("location", event.target.value)} /></label>
        <label><span>Fungsi bangunan</span><input value={input.function} onChange={(event) => update("function", event.target.value)} /></label>
        <label><span>Pemilik</span><input value={input.owner} onChange={(event) => update("owner", event.target.value)} /></label>
      </form>
      <div className="revision-meta" aria-label="Metadata revisi"><span>Revisi {revision.revision_number}</span><span>Registry {revision.registry_version}</span><span>Dibuat {new Date(revision.created_at).toLocaleString("id-ID")}</span></div>
    </section>
  );
}
