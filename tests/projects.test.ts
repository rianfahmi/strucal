import assert from "node:assert/strict";
import test from "node:test";
import { createProjectBundle, reviseProject } from "../src/lib/projects.ts";

const ids = (...values: string[]) => {
  let index = 0;
  return () => values[index++];
};

test("project creation identifies its initial active revision", () => {
  const bundle = createProjectBundle(
    { title: "Gedung A", location: "Bandung", function: "Kantor", owner: "Pemilik" },
    ids("project-1", "revision-1"),
    () => "2026-09-28T00:00:00.000Z",
  );

  assert.equal(bundle.project.active_revision_id, "revision-1");
  assert.equal(bundle.revision.project_id, "project-1");
  assert.equal(bundle.revision.revision_number, 1);
  assert.equal(bundle.revision.source_revision_id, null);
});

test("save creates traceable revision metadata and preserves the project id", () => {
  const initial = createProjectBundle(
    { title: "Gedung A", location: "", function: "", owner: "" },
    ids("project-1", "revision-1"),
    () => "2026-09-28T00:00:00.000Z",
  );
  const saved = reviseProject(
    initial,
    { title: "Gedung A", location: "Jakarta", function: "Kantor", owner: "Pemilik" },
    "autosave",
    ids("revision-2"),
    () => "2026-09-28T00:01:00.000Z",
  );

  assert.equal(saved.project.id, initial.project.id);
  assert.equal(saved.project.active_revision_id, "revision-2");
  assert.equal(saved.revision.revision_number, 2);
  assert.equal(saved.revision.source_revision_id, "revision-1");
  assert.equal(saved.revision.save_reason, "autosave");
});
