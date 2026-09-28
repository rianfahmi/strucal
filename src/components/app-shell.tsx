"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { navigationGroups } from "../lib/navigation";
import { useProjects } from "./project-provider";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { active, createProject, projects, saveStatus, selectProject } = useProjects();
  const saveLabels = { loading: "Memuat…", saved: "Tersimpan", saving: "Menyimpan…", unsaved: "Belum tersimpan", error: "Gagal menyimpan" };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Lewati ke konten utama</a>
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`} aria-label="Navigasi utama">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">S</span>
          <div><strong>StruCal</strong><span>Concrete workspace</span></div>
        </div>
        <nav className="sidebar-nav">
          {navigationGroups.map((group) => (
            <section className="nav-group" key={group.label}>
              <h2>{group.label}</h2>
              <ul>
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link className={active ? "nav-link active" : "nav-link"} href={item.href} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)}>
                        <span className="nav-index" aria-hidden="true">{item.number ?? "•"}</span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" aria-hidden="true" />Workspace lokal</div>
      </aside>

      {menuOpen && <button className="sidebar-backdrop" aria-label="Tutup navigasi" onClick={() => setMenuOpen(false)} />}

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-project">
            <button className="menu-button" type="button" aria-label="Buka navigasi" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
              <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
            </button>
            <label className="project-selector">
              <span>Proyek</span>
              <select aria-label="Pilih proyek" value={active?.project.id ?? ""} onChange={(event) => void selectProject(event.target.value)} disabled={!projects.length || saveStatus !== "saved"}>
                {!projects.length && <option value="">Belum ada proyek</option>}
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
            </label>
            <button className="new-project-button" type="button" onClick={() => void createProject()} disabled={saveStatus !== "saved"}>+ Proyek</button>
            <div className="project-meta" aria-label="Status proyek"><span className="badge badge-neutral">Draft</span><span>Revisi {active?.revision.revision_number ?? "—"}</span></div>
          </div>
          <div className="topbar-actions">
            <div className={`save-state save-state-${saveStatus}`} role="status"><span className="status-dot" aria-hidden="true" />{saveLabels[saveStatus]}</div>
            <button className="validation-button" type="button" title="Belum ada validasi proyek"><span aria-hidden="true">!</span><span className="validation-label">Pusat validasi</span></button>
          </div>
        </header>
        <main id="main-content" className="main-content">{children}</main>
      </div>
    </div>
  );
}
