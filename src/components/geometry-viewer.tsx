"use client";

import { useRef, useState, type PointerEvent, type WheelEvent } from "react";
import type { Axis, Geometry, GridLine, Story } from "../lib/geometry";

type ViewerMode = "plan" | "elevation" | "3d";
type Point = { x: number; y: number };

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 520;
const number = (value: number) => value.toLocaleString("id-ID", { maximumFractionDigits: 3 });
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function fit2d(horizontal: number[], vertical: number[], padding = 76) {
  const minX = Math.min(...horizontal);
  const maxX = Math.max(...horizontal);
  const minY = Math.min(...vertical);
  const maxY = Math.max(...vertical);
  const scale = Math.min((VIEW_WIDTH - padding * 2) / (maxX - minX), (VIEW_HEIGHT - padding * 2) / (maxY - minY));
  return {
    x: (value: number) => VIEW_WIDTH / 2 + (value - (minX + maxX) / 2) * scale,
    y: (value: number) => VIEW_HEIGHT / 2 - (value - (minY + maxY) / 2) * scale,
  };
}

function PlanView({ geometry, story }: { geometry: Geometry; story: Story }) {
  const xValues = geometry.grid_x.map(({ ordinate }) => ordinate);
  const yValues = geometry.grid_y.map(({ ordinate }) => ordinate);
  const map = fit2d(xValues, yValues, 88);
  const left = map.x(xValues[0]);
  const right = map.x(xValues.at(-1)!);
  const top = map.y(yValues.at(-1)!);
  const bottom = map.y(yValues[0]);

  return <g className="drawing-plan">
    <text className="drawing-caption" x="22" y="28">PLAN · {story.name} · EL. {number(story.elevation)} m</text>
    {geometry.grid_x.map((line, index) => <g key={`x-${line.label}`}>
      <line className="grid-line" x1={map.x(line.ordinate)} y1={top - 22} x2={map.x(line.ordinate)} y2={bottom + 22} />
      <circle className="grid-bubble" cx={map.x(line.ordinate)} cy={top - 32} r="12" />
      <text className="grid-label" x={map.x(line.ordinate)} y={top - 28}>{line.label}</text>
      {index > 0 && <text className="dimension-label" x={(map.x(line.ordinate) + map.x(xValues[index - 1])) / 2} y={bottom + 48}>{number(line.ordinate - xValues[index - 1])} m</text>}
    </g>)}
    {geometry.grid_y.map((line, index) => <g key={`y-${line.label}`}>
      <line className="grid-line" x1={left - 22} y1={map.y(line.ordinate)} x2={right + 22} y2={map.y(line.ordinate)} />
      <circle className="grid-bubble" cx={left - 32} cy={map.y(line.ordinate)} r="12" />
      <text className="grid-label" x={left - 32} y={map.y(line.ordinate) + 4}>{line.label}</text>
      {index > 0 && <text className="dimension-label dimension-vertical" x={right + 48} y={(map.y(line.ordinate) + map.y(yValues[index - 1])) / 2}>{number(line.ordinate - yValues[index - 1])} m</text>}
    </g>)}
    {geometry.grid_x.flatMap((xLine) => geometry.grid_y.map((yLine) => <circle className="grid-node" key={`${xLine.label}-${yLine.label}`} cx={map.x(xLine.ordinate)} cy={map.y(yLine.ordinate)} r="3.5" />))}
    <line className="dimension-line" x1={left} y1={bottom + 34} x2={right} y2={bottom + 34} />
    <line className="dimension-line" x1={right + 34} y1={top} x2={right + 34} y2={bottom} />
  </g>;
}

function ElevationView({ geometry, axis, line }: { geometry: Geometry; axis: Axis; line: GridLine }) {
  const horizontalLines = axis === "X" ? geometry.grid_y : geometry.grid_x;
  const horizontal = horizontalLines.map(({ ordinate }) => ordinate);
  const vertical = geometry.stories.map(({ elevation }) => elevation);
  const map = fit2d(horizontal, vertical, 90);
  const left = map.x(horizontal[0]);
  const right = map.x(horizontal.at(-1)!);
  const top = map.y(vertical.at(-1)!);
  const bottom = map.y(vertical[0]);

  return <g className="drawing-elevation">
    <text className="drawing-caption" x="22" y="28">ELEVATION · GRID {axis} {line.label} · ORD. {number(line.ordinate)} m</text>
    {horizontalLines.map((gridLine) => <g key={gridLine.label}>
      <line className="grid-line" x1={map.x(gridLine.ordinate)} y1={top - 20} x2={map.x(gridLine.ordinate)} y2={bottom + 20} />
      <circle className="grid-bubble" cx={map.x(gridLine.ordinate)} cy={bottom + 32} r="12" />
      <text className="grid-label" x={map.x(gridLine.ordinate)} y={bottom + 36}>{gridLine.label}</text>
    </g>)}
    {geometry.stories.map((story, index) => <g key={story.name}>
      <line className="story-line" x1={left - 24} y1={map.y(story.elevation)} x2={right + 24} y2={map.y(story.elevation)} />
      <text className="story-label" x={left - 30} y={map.y(story.elevation) - 7}>{story.name}</text>
      <text className="elevation-label" x={right + 32} y={map.y(story.elevation) + 4}>EL. {number(story.elevation)} m</text>
      {index > 0 && <text className="dimension-label dimension-vertical" x={right + 54} y={(map.y(story.elevation) + map.y(geometry.stories[index - 1].elevation)) / 2}>{number(story.height)} m</text>}
    </g>)}
    {horizontalLines.flatMap((gridLine) => geometry.stories.map((story) => <circle className="grid-node" key={`${gridLine.label}-${story.name}`} cx={map.x(gridLine.ordinate)} cy={map.y(story.elevation)} r="3.5" />))}
    <line className="dimension-line" x1={right + 40} y1={top} x2={right + 40} y2={bottom} />
  </g>;
}

function ThreeDimensionalView({ geometry, rotation, tilt }: { geometry: Geometry; rotation: number; tilt: number }) {
  const xValues = geometry.grid_x.map(({ ordinate }) => ordinate);
  const yValues = geometry.grid_y.map(({ ordinate }) => ordinate);
  const zValues = geometry.stories.map(({ elevation }) => elevation);
  const centerX = (xValues[0] + xValues.at(-1)!) / 2;
  const centerY = (yValues[0] + yValues.at(-1)!) / 2;
  const centerZ = (zValues[0] + zValues.at(-1)!) / 2;
  const angle = rotation * Math.PI / 180;
  const incline = tilt * Math.PI / 180;
  const raw = (x: number, y: number, z: number): Point => {
    const dx = x - centerX;
    const dy = y - centerY;
    const depth = dx * Math.sin(angle) + dy * Math.cos(angle);
    return { x: dx * Math.cos(angle) - dy * Math.sin(angle), y: -(z - centerZ) * Math.cos(incline) + depth * Math.sin(incline) };
  };
  const corners = xValues.flatMap((x) => yValues.flatMap((y) => zValues.map((z) => raw(x, y, z))));
  const minX = Math.min(...corners.map(({ x }) => x));
  const maxX = Math.max(...corners.map(({ x }) => x));
  const minY = Math.min(...corners.map(({ y }) => y));
  const maxY = Math.max(...corners.map(({ y }) => y));
  const scale = Math.min(650 / (maxX - minX), 400 / (maxY - minY));
  const project = (x: number, y: number, z: number) => {
    const point = raw(x, y, z);
    return { x: VIEW_WIDTH / 2 + (point.x - (minX + maxX) / 2) * scale, y: VIEW_HEIGHT / 2 + (point.y - (minY + maxY) / 2) * scale };
  };
  const line = (start: [number, number, number], end: [number, number, number], key: string, className: string) => {
    const a = project(...start);
    const b = project(...end);
    return <line className={className} key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
  };

  return <g className="drawing-3d">
    <text className="drawing-caption" x="22" y="28">3D WIREFRAME · {geometry.grid_x.length} × {geometry.grid_y.length} GRID · {geometry.stories.length} LEVEL</text>
    {geometry.stories.flatMap((story) => [
      ...geometry.grid_x.map((gridLine) => line([gridLine.ordinate, yValues[0], story.elevation], [gridLine.ordinate, yValues.at(-1)!, story.elevation], `x-${gridLine.label}-${story.name}`, "model-line")),
      ...geometry.grid_y.map((gridLine) => line([xValues[0], gridLine.ordinate, story.elevation], [xValues.at(-1)!, gridLine.ordinate, story.elevation], `y-${gridLine.label}-${story.name}`, "model-line")),
    ])}
    {geometry.grid_x.flatMap((xLine) => geometry.grid_y.map((yLine) => line([xLine.ordinate, yLine.ordinate, zValues[0]], [xLine.ordinate, yLine.ordinate, zValues.at(-1)!], `v-${xLine.label}-${yLine.label}`, "vertical-model-line")))}
    {geometry.stories.map((story) => {
      const point = project(xValues[0], yValues[0], story.elevation);
      return <text className="story-label" key={story.name} x={point.x - 10} y={point.y - 7}>{story.name} · {number(story.elevation)} m</text>;
    })}
  </g>;
}

export function GeometryViewer({ geometry }: { geometry: Geometry }) {
  const [mode, setMode] = useState<ViewerMode>("plan");
  const [storyIndex, setStoryIndex] = useState(geometry.stories.length - 1);
  const [elevationAxis, setElevationAxis] = useState<Axis>("X");
  const [elevationIndex, setElevationIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(35);
  const [tilt, setTilt] = useState(30);
  const pointer = useRef<Point | null>(null);
  const selectedStoryIndex = Math.min(storyIndex, geometry.stories.length - 1);
  const elevationLines = elevationAxis === "X" ? geometry.grid_x : geometry.grid_y;
  const selectedElevationIndex = Math.min(elevationIndex, elevationLines.length - 1);

  function fit() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function reset() {
    fit();
    setRotation(35);
    setTilt(30);
  }

  function move(event: PointerEvent<SVGSVGElement>) {
    if (!pointer.current) return;
    const dx = event.clientX - pointer.current.x;
    const dy = event.clientY - pointer.current.y;
    pointer.current = { x: event.clientX, y: event.clientY };
    if (mode === "3d" && !event.shiftKey) {
      setRotation((value) => value + dx * .45);
      setTilt((value) => clamp(value - dy * .3, 10, 70));
    } else {
      setPan((value) => ({ x: value.x + dx, y: value.y + dy }));
    }
  }

  function wheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    setZoom((value) => clamp(value * (event.deltaY > 0 ? .9 : 1.1), .5, 4));
  }

  return <section className="panel viewer-panel" aria-label="Viewer geometri">
    <div className="viewer-toolbar">
      <div className="viewer-modes" role="tablist" aria-label="Mode viewer">
        {(["plan", "elevation", "3d"] as const).map((viewerMode) => <button role="tab" aria-selected={mode === viewerMode} className={mode === viewerMode ? "active" : ""} type="button" key={viewerMode} onClick={() => { setMode(viewerMode); fit(); }}>{viewerMode === "3d" ? "3D" : viewerMode === "plan" ? "Plan" : "Elevation"}</button>)}
      </div>
      <div className="viewer-actions">
        <button type="button" onClick={fit}>Fit</button>
        <button type="button" onClick={reset}>Reset</button>
        <button type="button" aria-label="Perkecil" onClick={() => setZoom((value) => clamp(value / 1.2, .5, 4))}>−</button>
        <span aria-label={`Zoom ${Math.round(zoom * 100)} persen`}>{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Perbesar" onClick={() => setZoom((value) => clamp(value * 1.2, .5, 4))}>+</button>
        {mode === "3d" && <><button type="button" aria-label="Putar ke kiri" onClick={() => setRotation((value) => value - 15)}>↺</button><button type="button" aria-label="Putar ke kanan" onClick={() => setRotation((value) => value + 15)}>↻</button></>}
      </div>
    </div>

    <div className="viewer-context">
      {mode === "plan" && <label>Story<select value={selectedStoryIndex} onChange={(event) => setStoryIndex(Number(event.target.value))}>{geometry.stories.map((story, index) => <option value={index} key={story.name}>{story.name} · EL. {number(story.elevation)} m</option>)}</select></label>}
      {mode === "elevation" && <><label>Sumbu<select value={elevationAxis} onChange={(event) => { setElevationAxis(event.target.value as Axis); setElevationIndex(0); }}><option>X</option><option>Y</option></select></label><label>Grid line<select value={selectedElevationIndex} onChange={(event) => setElevationIndex(Number(event.target.value))}>{elevationLines.map((gridLine, index) => <option value={index} key={gridLine.label}>{elevationAxis} {gridLine.label} · {number(gridLine.ordinate)} m</option>)}</select></label></>}
      {mode === "3d" && <span>Drag untuk orbit · Shift + drag untuk pan · Scroll untuk zoom</span>}
    </div>

    <div className="viewer-canvas">
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-label={`${mode === "3d" ? "3D" : mode === "plan" ? "Plan" : "Elevation"} geometri`} tabIndex={0}
        onPointerDown={(event) => { pointer.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={move} onPointerUp={(event) => { pointer.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { pointer.current = null; }} onWheel={wheel}>
        <title>Viewer validasi geometri</title><desc>Visualisasi wireframe berdasarkan Grid System dan Story Data yang sama dengan editor.</desc>
        <rect className="canvas-background" width={VIEW_WIDTH} height={VIEW_HEIGHT} />
        <g transform={`translate(${pan.x} ${pan.y}) translate(${VIEW_WIDTH / 2} ${VIEW_HEIGHT / 2}) scale(${zoom}) translate(${-VIEW_WIDTH / 2} ${-VIEW_HEIGHT / 2})`}>
          {mode === "plan" && <PlanView geometry={geometry} story={geometry.stories[selectedStoryIndex]} />}
          {mode === "elevation" && <ElevationView geometry={geometry} axis={elevationAxis} line={elevationLines[selectedElevationIndex]} />}
          {mode === "3d" && <ThreeDimensionalView geometry={geometry} rotation={rotation} tilt={tilt} />}
        </g>
      </svg>
    </div>
    <div className="viewer-status"><span className="status-dot" aria-hidden="true" />Semua view berasal dari model geometri aktif · Viewer validasi, bukan analisis FEM</div>
  </section>;
}
