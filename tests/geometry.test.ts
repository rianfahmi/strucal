import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultGeometry,
  generateUniformGeometry,
  generateUniformGrid,
  generateUniformStories,
  GEOMETRY_TOLERANCE,
  ordinatesFromSpacings,
  recalculateStories,
  replaceGridOrdinate,
  replaceGridSpacing,
  spacingsFromOrdinates,
  validateGeometry,
  validateGrid,
  validateStories,
  type GridLine,
} from "../src/lib/geometry.ts";

test("spacing dan ordinate round-trip untuk grid tidak seragam dalam toleransi", () => {
  const spacing = [4.25, 6, 3.75, 8.5];
  const ordinates = ordinatesFromSpacings(spacing, -2);
  const roundTrip = spacingsFromOrdinates(ordinates);

  assert.deepEqual(ordinates, [-2, 2.25, 8.25, 12, 20.5]);
  roundTrip.forEach((value, index) => assert.ok(Math.abs(value - spacing[index]) <= GEOMETRY_TOLERANCE));
});

test("mengubah spacing menurunkan semua ordinate berikutnya", () => {
  const lines: GridLine[] = [0, 5, 11].map((ordinate, index) => ({ axis: "X", label: String(index + 1), ordinate }));
  assert.deepEqual(replaceGridSpacing(lines, 1, 7).map(({ ordinate }) => ordinate), [0, 7, 13]);
});

test("ordinate duplikat, turun, dan tidak valid diblokir", () => {
  const lines = createDefaultGeometry("revision-1").grid_x;
  assert.throws(() => replaceGridOrdinate(lines, 1, 0), /berurutan naik/);
  assert.throws(() => replaceGridOrdinate(lines, 1, -1), /berurutan naik/);
  assert.throws(() => replaceGridOrdinate(lines, 1, Number.NaN), /angka valid/);
});

test("validasi grid menolak label duplikat dan sumbu yang salah", () => {
  const lines: GridLine[] = [
    { axis: "X", label: "A", ordinate: 0 },
    { axis: "Y", label: "a", ordinate: 4 },
  ];
  const messages = validateGrid(lines, "X").map(({ message }) => message);
  assert.ok(messages.some((message) => message.includes("duplikat")));
  assert.ok(messages.some((message) => message.includes("Sumbu")));
});

test("story dihitung ulang dari urutan dan tinggi", () => {
  const stories = recalculateStories([
    { name: "Ground", order: 9, height: 2, elevation: -1.5 },
    { name: "Lantai 1", order: 8, height: 4, elevation: 99 },
    { name: "Atap", order: 7, height: 3.25, elevation: 99 },
  ]);
  assert.deepEqual(stories.map(({ order, height, elevation }) => ({ order, height, elevation })), [
    { order: 0, height: 0, elevation: -1.5 },
    { order: 1, height: 4, elevation: 2.5 },
    { order: 2, height: 3.25, elevation: 5.75 },
  ]);
  assert.deepEqual(validateStories(stories), []);
});

test("validasi story menolak tinggi, elevasi, urutan, dan nama yang inkonsisten", () => {
  const issues = validateStories([
    { name: "Lantai", order: 1, height: 0, elevation: 0 },
    { name: "lantai", order: 1, height: -3, elevation: 5 },
  ]);
  assert.ok(issues.length >= 4);
});

test("geometry default valid dan menyediakan sumber bersama untuk semua view", () => {
  const geometry = createDefaultGeometry("revision-1");
  assert.deepEqual(validateGeometry(geometry), []);
  assert.equal(geometry.revision_id, "revision-1");
  assert.equal(geometry.stories.at(-1)?.elevation, 10.5);
});

test("generateUniformGrid menghasilkan label dan ordinat seragam yang valid", () => {
  const gridX = generateUniformGrid("X", 4, 6);
  assert.equal(gridX.length, 5);
  assert.deepEqual(gridX.map((g) => g.label), ["A", "B", "C", "D", "E"]);
  assert.deepEqual(gridX.map((g) => g.ordinate), [0, 6, 12, 18, 24]);

  const gridY = generateUniformGrid("Y", 3, 5);
  assert.equal(gridY.length, 4);
  assert.deepEqual(gridY.map((g) => g.label), ["1", "2", "3", "4"]);
  assert.deepEqual(gridY.map((g) => g.ordinate), [0, 5, 10, 15]);

  assert.throws(() => generateUniformGrid("X", 0, 5), /minimal 1/);
  assert.throws(() => generateUniformGrid("X", 2, 0), /lebih besar dari nol/);
});

test("generateUniformStories menghasilkan level bertingkat dan elevasi kumulatif", () => {
  const stories = generateUniformStories(5, 3.5);
  assert.equal(stories.length, 6);
  assert.deepEqual(stories.map((s) => s.name), ["Ground", "Story 1", "Story 2", "Story 3", "Story 4", "Roof"]);
  assert.deepEqual(stories.map((s) => s.elevation), [0, 3.5, 7, 10.5, 14, 17.5]);
  assert.deepEqual(stories.map((s) => s.order), [0, 1, 2, 3, 4, 5]);

  assert.throws(() => generateUniformStories(0, 3.5), /minimal 1/);
  assert.throws(() => generateUniformStories(3, 0), /lebih besar dari nol/);
});

test("generateUniformGeometry menghasilkan model gedung lengkap yang lolos validasi", () => {
  const geometry = generateUniformGeometry({
    spansX: 4,
    spacingX: 6,
    spansY: 3,
    spacingY: 5,
    storyCount: 5,
    typicalHeight: 3.5,
  }, "rev-gen-1");

  assert.equal(geometry.revision_id, "rev-gen-1");
  assert.equal(geometry.grid_x.length, 5);
  assert.equal(geometry.grid_y.length, 4);
  assert.equal(geometry.stories.length, 6);
  assert.deepEqual(validateGeometry(geometry), []);
});

