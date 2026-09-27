export const GEOMETRY_TOLERANCE = 1e-6;

export type Axis = "X" | "Y";
export type GridLine = { axis: Axis; label: string; ordinate: number };
export type Story = { name: string; order: number; height: number; elevation: number };
export type Geometry = {
  revision_id: string;
  grid_x: GridLine[];
  grid_y: GridLine[];
  stories: Story[];
};
export type GeometryIssue = { path: string; message: string };

export class GeometryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeometryValidationError";
  }
}

const rounded = (value: number) => Math.round(value / GEOMETRY_TOLERANCE) * GEOMETRY_TOLERANCE;
export const nearlyEqual = (left: number, right: number) => Math.abs(left - right) <= GEOMETRY_TOLERANCE;

export function ordinatesFromSpacings(spacings: number[], origin = 0) {
  if (!Number.isFinite(origin)) throw new GeometryValidationError("Ordinat awal harus berupa angka valid.");
  const ordinates = [origin];
  for (const spacing of spacings) {
    if (!Number.isFinite(spacing) || spacing <= GEOMETRY_TOLERANCE) {
      throw new GeometryValidationError("Jarak grid harus lebih besar dari nol.");
    }
    ordinates.push(rounded(ordinates.at(-1)! + spacing));
  }
  return ordinates;
}

export function spacingsFromOrdinates(ordinates: number[]) {
  return ordinates.slice(1).map((ordinate, index) => rounded(ordinate - ordinates[index]));
}

export function replaceGridSpacing(lines: GridLine[], index: number, spacing: number) {
  if (index <= 0 || index >= lines.length) throw new GeometryValidationError("Baris jarak grid tidak valid.");
  const spacings = spacingsFromOrdinates(lines.map(({ ordinate }) => ordinate));
  spacings[index - 1] = spacing;
  const ordinates = ordinatesFromSpacings(spacings, lines[0].ordinate);
  return lines.map((line, lineIndex) => ({ ...line, ordinate: ordinates[lineIndex] }));
}

export function replaceGridOrdinate(lines: GridLine[], index: number, ordinate: number) {
  if (index < 0 || index >= lines.length || !Number.isFinite(ordinate)) {
    throw new GeometryValidationError("Ordinat grid harus berupa angka valid.");
  }
  const next = lines.map((line, lineIndex) => lineIndex === index ? { ...line, ordinate } : line);
  const issue = validateGrid(next, lines[0]?.axis ?? "X")[0];
  if (issue) throw new GeometryValidationError(issue.message);
  return next;
}

export function recalculateStories(stories: Story[]) {
  if (!stories.length) return [];
  let elevation = stories[0].elevation;
  return stories.map((story, index) => {
    if (index > 0) elevation = rounded(elevation + story.height);
    return { ...story, order: index, height: index === 0 ? 0 : story.height, elevation };
  });
}

export function validateGrid(lines: GridLine[], axis: Axis): GeometryIssue[] {
  const issues: GeometryIssue[] = [];
  if (lines.length < 2) issues.push({ path: `grid_${axis.toLowerCase()}`, message: `Grid ${axis} minimal memiliki dua garis.` });
  const labels = new Set<string>();
  lines.forEach((line, index) => {
    const path = `grid_${axis.toLowerCase()}.${index}`;
    const label = line.label.trim().toLocaleLowerCase("id-ID");
    if (line.axis !== axis) issues.push({ path, message: `Sumbu grid harus ${axis}.` });
    if (!label) issues.push({ path: `${path}.label`, message: "Label grid wajib diisi." });
    else if (labels.has(label)) issues.push({ path: `${path}.label`, message: `Label grid ${line.label} duplikat.` });
    labels.add(label);
    if (!Number.isFinite(line.ordinate)) issues.push({ path: `${path}.ordinate`, message: "Ordinat grid harus berupa angka valid." });
    if (index > 0 && line.ordinate - lines[index - 1].ordinate <= GEOMETRY_TOLERANCE) {
      issues.push({ path: `${path}.ordinate`, message: "Ordinat grid harus berurutan naik dan tidak boleh duplikat." });
    }
  });
  return issues;
}

export function validateStories(stories: Story[]): GeometryIssue[] {
  const issues: GeometryIssue[] = [];
  if (stories.length < 2) issues.push({ path: "stories", message: "Story minimal terdiri dari level dasar dan satu level atas." });
  const names = new Set<string>();
  stories.forEach((story, index) => {
    const path = `stories.${index}`;
    const name = story.name.trim().toLocaleLowerCase("id-ID");
    if (!name) issues.push({ path: `${path}.name`, message: "Nama story wajib diisi." });
    else if (names.has(name)) issues.push({ path: `${path}.name`, message: `Nama story ${story.name} duplikat.` });
    names.add(name);
    if (story.order !== index) issues.push({ path: `${path}.order`, message: "Urutan story tidak konsisten." });
    if (!Number.isFinite(story.height) || (index === 0 ? !nearlyEqual(story.height, 0) : story.height <= GEOMETRY_TOLERANCE)) {
      issues.push({ path: `${path}.height`, message: index === 0 ? "Tinggi level dasar harus nol." : "Tinggi story harus lebih besar dari nol." });
    }
    if (!Number.isFinite(story.elevation)) issues.push({ path: `${path}.elevation`, message: "Elevasi story harus berupa angka valid." });
    if (index > 0 && !nearlyEqual(story.elevation, stories[index - 1].elevation + story.height)) {
      issues.push({ path: `${path}.elevation`, message: "Elevasi story harus sama dengan elevasi bawah ditambah tinggi story." });
    }
  });
  return issues;
}

export function validateGeometry(geometry: Geometry) {
  return [
    ...validateGrid(geometry.grid_x, "X"),
    ...validateGrid(geometry.grid_y, "Y"),
    ...validateStories(geometry.stories),
  ];
}

export function sameGeometry(left: Geometry, right: Geometry) {
  return JSON.stringify({ ...left, revision_id: "" }) === JSON.stringify({ ...right, revision_id: "" });
}

export function createDefaultGeometry(revisionId: string): Geometry {
  const grid = (axis: Axis, labels: string[], spacing: number): GridLine[] => labels.map((label, index) => ({ axis, label, ordinate: index * spacing }));
  return {
    revision_id: revisionId,
    grid_x: grid("X", ["A", "B", "C", "D"], 6),
    grid_y: grid("Y", ["1", "2", "3", "4"], 5),
    stories: recalculateStories([
      { name: "Ground", order: 0, height: 0, elevation: 0 },
      { name: "Story 1", order: 1, height: 3.5, elevation: 0 },
      { name: "Story 2", order: 2, height: 3.5, elevation: 0 },
      { name: "Roof", order: 3, height: 3.5, elevation: 0 },
    ]),
  };
}
