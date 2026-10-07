"use client";

import { useEffect, useRef, useState } from "react";
import {
  GEOMETRY_TOLERANCE,
  GeometryValidationError,
  generateUniformGeometry,
  generateUniformGrid,
  generateUniformStories,
  recalculateStories,
  replaceGridOrdinate,
  replaceGridSpacing,
  spacingsFromOrdinates,
  validateGeometry,
  type Axis,
  type Geometry,
  type GridLine,
} from "../lib/geometry";
import { useProjects } from "./project-provider";
import { GeometryViewer } from "./geometry-viewer";

type EditorTab = "grid" | "story";
type GridMode = "spacing" | "ordinate";

export function GeometryWorkspace() {
  const { active, createProject, markUnsaved, saveGeometry, saveStatus } = useProjects();
  if (!active) return <section className="panel empty-project"><h2>Belum ada proyek</h2><p>Buat proyek sebelum menyusun geometri.</p><button className="button button-primary" type="button" onClick={() => void createProject()}>Buat Proyek</button></section>;
  return <GeometryEditor key={active.project.id} initial={active.geometry} markUnsaved={markUnsaved} saveGeometry={saveGeometry} saveStatus={saveStatus} />;
}

function GeometryEditor({ initial, markUnsaved, saveGeometry, saveStatus }: {
  initial: Geometry;
  markUnsaved: () => void;
  saveGeometry: (geometry: Geometry, reason: "manual" | "autosave") => Promise<void>;
  saveStatus: string;
}) {
  const [geometry, setGeometry] = useState(initial);
  const [tab, setTab] = useState<EditorTab>("grid");
  const [modes, setModes] = useState<Record<Axis, GridMode>>({ X: "spacing", Y: "spacing" });
  const [inputError, setInputError] = useState("");
  const [genSpansX, setGenSpansX] = useState(4);
  const [genSpacingX, setGenSpacingX] = useState(6);
  const [genSpansY, setGenSpansY] = useState(3);
  const [genSpacingY, setGenSpacingY] = useState(5);
  const [genStoryCount, setGenStoryCount] = useState(5);
  const [genTypicalHeight, setGenTypicalHeight] = useState(3.5);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const issues = validateGeometry(geometry);


  useEffect(() => () => clearTimeout(timer.current), []);

  function apply(next: Geometry) {
    setGeometry(next);
    setInputError("");
    markUnsaved();
    clearTimeout(timer.current);
    if (!validateGeometry(next).length) timer.current = setTimeout(() => void saveGeometry(next, "autosave"), 800);
  }

  function editGrid(axis: Axis, update: (lines: GridLine[]) => GridLine[]) {
    try {
      const field = axis === "X" ? "grid_x" : "grid_y";
      apply({ ...geometry, [field]: update(geometry[field]) });
    } catch (error) {
      setInputError(error instanceof GeometryValidationError ? error.message : "Nilai grid tidak valid.");
    }
  }

  function addGrid(axis: Axis) {
    editGrid(axis, (lines) => {
      const last = lines.at(-1)!;
      const previous = lines.at(-2);
      const spacing = previous ? last.ordinate - previous.ordinate : 5;
      const label = axis === "X" ? String.fromCharCode(65 + lines.length) : String(lines.length + 1);
      return [...lines, { axis, label, ordinate: last.ordinate + spacing }];
    });
  }

  function removeGrid(axis: Axis, index: number) {
    editGrid(axis, (lines) => {
      if (lines.length <= 2) throw new GeometryValidationError(`Grid ${axis} minimal memiliki dua garis.`);
      return lines.filter((_, lineIndex) => lineIndex !== index);
    });
  }

  function editStory(index: number, field: "name" | "height" | "elevation", value: string | number) {
    const stories = geometry.stories.map((story, storyIndex) => storyIndex === index ? { ...story, [field]: value } : story);
    if (field === "height" && index > 0 && (typeof value !== "number" || value <= GEOMETRY_TOLERANCE)) {
      setInputError("Tinggi story harus lebih besar dari nol.");
      return;
    }
    apply({ ...geometry, stories: recalculateStories(stories) });
  }

  function addStory() {
    const stories = geometry.stories;
    apply({ ...geometry, stories: recalculateStories([...stories, { name: `Story ${stories.length}`, order: stories.length, height: stories.at(-1)?.height || 3.5, elevation: 0 }]) });
  }

  function removeStory(index: number) {
    if (index === 0 || geometry.stories.length <= 2) {
      setInputError("Level dasar tidak dapat dihapus dan geometri minimal memiliki dua level.");
      return;
    }
    apply({ ...geometry, stories: recalculateStories(geometry.stories.filter((_, storyIndex) => storyIndex !== index)) });
  }

  function moveStory(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (index === 0 || target <= 0 || target >= geometry.stories.length) return;
    const stories = [...geometry.stories];
    [stories[index], stories[target]] = [stories[target], stories[index]];
    apply({ ...geometry, stories: recalculateStories(stories) });
  }

  function applyUniformGridX() {
    try {
      const grid_x = generateUniformGrid("X", genSpansX, genSpacingX);
      apply({ ...geometry, grid_x });
    } catch (error) {
      setInputError(error instanceof GeometryValidationError ? error.message : "Generator grid X gagal.");
    }
  }

  function applyUniformGridY() {
    try {
      const grid_y = generateUniformGrid("Y", genSpansY, genSpacingY);
      apply({ ...geometry, grid_y });
    } catch (error) {
      setInputError(error instanceof GeometryValidationError ? error.message : "Generator grid Y gagal.");
    }
  }

  function applyUniformStories() {
    try {
      const stories = generateUniformStories(genStoryCount, genTypicalHeight, geometry.stories[0]?.elevation ?? 0);
      apply({ ...geometry, stories });
    } catch (error) {
      setInputError(error instanceof GeometryValidationError ? error.message : "Generator story gagal.");
    }
  }

  function applyAllUniformGeometry() {
    try {
      const next = generateUniformGeometry({
        spansX: genSpansX,
        spacingX: genSpacingX,
        spansY: genSpansY,
        spacingY: genSpacingY,
        storyCount: genStoryCount,
        typicalHeight: genTypicalHeight,
        groundElevation: geometry.stories[0]?.elevation ?? 0,
      }, geometry.revision_id);
      apply(next);
    } catch (error) {
      setInputError(error instanceof GeometryValidationError ? error.message : "Generator geometri gagal.");
    }
  }

  async function saveNow() {
    clearTimeout(timer.current);
    if (issues.length) {
      setInputError(issues[0].message);
      return;
    }
    await saveGeometry(geometry, "manual");
  }

  return (
    <div className="geometry-workspace">
      <section className="panel geometry-editor" aria-label="Editor geometri">
        <div className="geometry-generator" aria-label="Generator bentang dan tingkat seragam">
          <div className="data-section-heading">
            <div>
              <p className="eyebrow">Shortcut Geometri</p>
              <h3>Generator Bentang &amp; Tingkat Seragam</h3>
            </div>
            <span className="badge badge-neutral">Opsional</span>
          </div>
          <p className="field-note">
            Bangkitkan denah kisi dan elevasi bertingkat seragam dengan cepat. Nilai per bentang atau per lantai tetap dapat disesuaikan pada tabel di bawah.
          </p>
          <div className="generator-row">
            <label>
              <span>Bentang X (jumlah)</span>
              <input aria-label="Jumlah bentang X" type="number" min="1" step="1" value={genSpansX} onChange={(e) => setGenSpansX(Math.max(1, parseInt(e.target.value) || 1))} />
            </label>
            <label>
              <span>Jarak X (m)</span>
              <input aria-label="Jarak bentang X" type="number" min="0.1" step="any" value={genSpacingX} onChange={(e) => setGenSpacingX(parseFloat(e.target.value) || 0)} />
            </label>
            <label>
              <span>Bentang Y (jumlah)</span>
              <input aria-label="Jumlah bentang Y" type="number" min="1" step="1" value={genSpansY} onChange={(e) => setGenSpansY(Math.max(1, parseInt(e.target.value) || 1))} />
            </label>
            <label>
              <span>Jarak Y (m)</span>
              <input aria-label="Jarak bentang Y" type="number" min="0.1" step="any" value={genSpacingY} onChange={(e) => setGenSpacingY(parseFloat(e.target.value) || 0)} />
            </label>
            <label>
              <span>Jumlah Lantai</span>
              <input aria-label="Jumlah lantai" type="number" min="1" step="1" value={genStoryCount} onChange={(e) => setGenStoryCount(Math.max(1, parseInt(e.target.value) || 1))} />
            </label>
            <label>
              <span>Tinggi Tipikal (m)</span>
              <input aria-label="Tinggi lantai tipikal" type="number" min="0.1" step="any" value={genTypicalHeight} onChange={(e) => setGenTypicalHeight(parseFloat(e.target.value) || 0)} />
            </label>
          </div>
          <div className="generator-actions">
            <button type="button" className="button button-primary" onClick={applyAllUniformGeometry}>
              Bentuk Seluruh Geometri Seragam
            </button>
            <button type="button" className="button button-secondary" onClick={applyUniformGridX}>
              Terapkan Grid X
            </button>
            <button type="button" className="button button-secondary" onClick={applyUniformGridY}>
              Terapkan Grid Y
            </button>
            <button type="button" className="button button-secondary" onClick={applyUniformStories}>
              Terapkan Story
            </button>
          </div>
        </div>

        <div className="geometry-tabs" role="tablist" aria-label="Data geometri">
          <button role="tab" aria-selected={tab === "grid"} className={tab === "grid" ? "active" : ""} type="button" onClick={() => setTab("grid")}>Grid System</button>
          <button role="tab" aria-selected={tab === "story"} className={tab === "story" ? "active" : ""} type="button" onClick={() => setTab("story")}>Story Data</button>
        </div>


        {tab === "grid" ? <div className="axis-stack">
          {(["X", "Y"] as const).map((axis) => {
            const lines = axis === "X" ? geometry.grid_x : geometry.grid_y;
            const spacings = spacingsFromOrdinates(lines.map(({ ordinate }) => ordinate));
            return <section className="data-section" key={axis} aria-labelledby={`grid-${axis}-title`}>
              <div className="data-section-heading"><div><p className="eyebrow">Sumbu {axis}</p><h2 id={`grid-${axis}-title`}>Grid {axis}</h2></div><div className="segmented" aria-label={`Mode input grid ${axis}`}>
                <button type="button" className={modes[axis] === "spacing" ? "active" : ""} onClick={() => setModes({ ...modes, [axis]: "spacing" })}>Spacing</button>
                <button type="button" className={modes[axis] === "ordinate" ? "active" : ""} onClick={() => setModes({ ...modes, [axis]: "ordinate" })}>Ordinate</button>
              </div></div>
              <div className="table-scroll"><table className="geometry-table"><thead><tr><th>Label</th><th>{modes[axis] === "spacing" ? "Spacing (m)" : "Ordinate (m)"}</th><th><span className="sr-only">Aksi</span></th></tr></thead><tbody>
                {lines.map((line, index) => <tr key={`${axis}-${index}`}>
                  <td><input aria-label={`Label grid ${axis} ${index + 1}`} value={line.label} onChange={(event) => editGrid(axis, (current) => current.map((item, lineIndex) => lineIndex === index ? { ...item, label: event.target.value } : item))} /></td>
                  <td>{modes[axis] === "spacing" && index === 0 ? <span className="auto-value">0.000 <small>ORIGIN</small></span> : <input aria-label={`${modes[axis]} grid ${axis} ${line.label}`} type="number" step="any" value={modes[axis] === "spacing" ? spacings[index - 1] : line.ordinate} onChange={(event) => {
                    if (!event.target.value) return;
                    const value = event.target.valueAsNumber;
                    editGrid(axis, (current) => modes[axis] === "spacing" ? replaceGridSpacing(current, index, value) : replaceGridOrdinate(current, index, value));
                  }} />}</td>
                  <td><button className="icon-button" type="button" aria-label={`Hapus grid ${axis} ${line.label}`} onClick={() => removeGrid(axis, index)}>×</button></td>
                </tr>)}
              </tbody></table></div>
              <button className="button button-secondary add-row" type="button" onClick={() => addGrid(axis)}>+ Tambah Grid {axis}</button>
            </section>;
          })}
        </div> : <section className="data-section" aria-labelledby="story-title">
          <div className="data-section-heading"><div><p className="eyebrow">Level bangunan</p><h2 id="story-title">Story Data</h2></div><span className="badge badge-neutral">Elevasi otomatis</span></div>
          <div className="table-scroll"><table className="geometry-table story-table"><thead><tr><th>Urutan</th><th>Nama</th><th>Height (m)</th><th>Elevation (m)</th><th><span className="sr-only">Aksi</span></th></tr></thead><tbody>
            {geometry.stories.map((story, index) => <tr key={index}>
              <td><span className="order-actions"><button type="button" aria-label={`Turunkan ${story.name}`} disabled={index <= 1} onClick={() => moveStory(index, -1)}>↓</button><button type="button" aria-label={`Naikkan ${story.name}`} disabled={index === 0 || index === geometry.stories.length - 1} onClick={() => moveStory(index, 1)}>↑</button></span></td>
              <td><input aria-label={`Nama story ${index + 1}`} value={story.name} onChange={(event) => editStory(index, "name", event.target.value)} /></td>
              <td>{index === 0 ? <span className="auto-value">0.000 <small>BASE</small></span> : <input aria-label={`Tinggi ${story.name}`} type="number" min={GEOMETRY_TOLERANCE} step="any" value={story.height} onChange={(event) => event.target.value && editStory(index, "height", event.target.valueAsNumber)} />}</td>
              <td>{index === 0 ? <input aria-label="Elevasi dasar" type="number" step="any" value={story.elevation} onChange={(event) => event.target.value && editStory(0, "elevation", event.target.valueAsNumber)} /> : <span className="auto-value">{story.elevation.toFixed(3)} <small>AUTO</small></span>}</td>
              <td><button className="icon-button" type="button" aria-label={`Hapus ${story.name}`} disabled={index === 0} onClick={() => removeStory(index)}>×</button></td>
            </tr>)}
          </tbody></table></div>
          <button className="button button-secondary add-row" type="button" onClick={addStory}>+ Tambah Story</button>
        </section>}

        <div className={`geometry-validation ${issues.length || inputError ? "has-error" : "is-valid"}`} role="status">
          <strong>{issues.length || inputError ? "Geometri perlu diperbaiki" : "Geometri valid"}</strong>
          <span>{inputError || issues[0]?.message || `${geometry.grid_x.length} grid X · ${geometry.grid_y.length} grid Y · ${geometry.stories.length} level`}</span>
        </div>
        <button className="button button-primary save-geometry" type="button" disabled={Boolean(issues.length) || saveStatus === "saving"} onClick={() => void saveNow()}>Simpan Geometri</button>
      </section>

      <GeometryViewer geometry={geometry} />
    </div>
  );
}
