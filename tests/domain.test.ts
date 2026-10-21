import test from "node:test";
import assert from "node:assert/strict";
import { Action, actionSchema, applyAction, localDate, seedState, stateSchema, streak } from "../src/lib/domain";

test("saved snapshots reject duplicate identities in each collection", () => {
  for (const collection of ["goals", "tasks", "entries"] as const) {
    const state = seedState();
    const duplicate = { ...state, [collection]: [...state[collection], state[collection][0]] };
    const result = stateSchema.safeParse(duplicate);
    assert.equal(result.success, false, collection);
    if (!result.success) assert.deepEqual(result.error.issues[0].path, [collection, state[collection].length, "id"]);
  }
});

test("saved snapshots reject orphan tasks and linked journal entries", () => {
  for (const collection of ["tasks", "entries"] as const) {
    const state = seedState();
    state[collection][0].goalId = "d0000000-0000-4000-8000-000000000001";
    const before = structuredClone(state);
    const result = stateSchema.safeParse(state);
    assert.equal(result.success, false, collection);
    if (!result.success) assert.deepEqual(result.error.issues[0].path, [collection, 0, "goalId"]);
    assert.deepEqual(state, before);
  }
});

test("valid snapshots allow unlinked journal entries and normal goal deletion", () => {
  const state = seedState();
  assert.equal(stateSchema.safeParse(state).success, true);
  const next = applyAction(state, { type: "goal.delete", id: state.goals[0].id });
  assert.equal(stateSchema.safeParse(next).success, true);
  assert.equal(next.entries[0].goalId, null);
  assert.equal(stateSchema.safeParse({ goals: [], tasks: [], entries: [] }).success, true);
});

test("deleting a goal cascades tasks and preserves journal entries", () => {
  const state = seedState();
  const next = applyAction(state, { type: "goal.delete", id: state.goals[0].id });
  assert.equal(next.goals.length, 1);
  assert.equal(next.tasks.length, 1);
  assert.equal(next.entries.length, 1);
  assert.equal(next.entries[0].goalId, null);
  assert.equal(state.goals.length, 2);
});
test("rejects orphan tasks and invalid input", () => {
  assert.throws(() => applyAction({ goals: [], tasks: [], entries: [] }, { type: "task.create", title: "Test", goalId: "a0000000-0000-4000-8000-000000000001" }));
  assert.equal(actionSchema.safeParse({ type: "goal.create", title: "   ", category: "Frontend" }).success, false);
  const entry = { type: "entry.create", title: "Test", content: "Learning", minutes: 30, date: "2026-02-30", goalId: null };
  assert.equal(actionSchema.safeParse(entry).success, false);
  assert.equal(actionSchema.safeParse({ ...entry, date: "2026-10-03", minutes: 0 }).success, false);
});
test("status transitions preserve task identity", () => {
  const state = seedState(); const id = state.tasks[2].id;
  const next = applyAction(state, { type: "task.status", id, status: "done" });
  assert.equal(next.tasks.find(t => t.id === id)?.status, "done");
  assert.equal(next.tasks.length, state.tasks.length);
});

test("stale updates and deletions reject without modifying the current snapshot", () => {
  const state = seedState();
  const before = structuredClone(state);
  const missingId = "d0000000-0000-4000-8000-000000000001";
  const actions: Action[] = [
    { type: "goal.delete", id: missingId },
    { type: "task.status", id: missingId, status: "done" },
    { type: "task.delete", id: missingId },
    { type: "entry.delete", id: missingId },
  ];
  for (const action of actions) {
    assert.throws(() => applyAction(state, action), /ไม่พบรายการ/);
    assert.deepEqual(state, before);
  }
});

test("a task removed by another tab cannot later be marked done", () => {
  const original = seedState();
  const id = original.tasks[0].id;
  const current = applyAction(original, { type: "task.delete", id });
  assert.throws(() => applyAction(current, { type: "task.status", id, status: "done" }), /โหลดข้อมูลใหม่/);
  assert.equal(current.tasks.length, original.tasks.length - 1);
  const entryId = current.entries[0].id;
  assert.equal(applyAction(current, { type: "entry.delete", id: entryId }).entries.length, 0);
});
test("streak counts distinct consecutive days and allows yesterday", () => {
  const sample = seedState().entries[0];
  const today = new Date(2026, 9, 3, 10);
  const entries = ["2026-10-03", "2026-10-03", "2026-10-02", "2026-10-01", "2026-09-29"].map(date => ({ ...sample, date }));
  assert.equal(streak(entries, today), 3);
  assert.equal(streak(entries.filter(e => e.date !== "2026-10-03"), today), 2);
  assert.equal(streak([{ ...sample, date: "2026-09-29" }], today), 0);
  assert.equal(localDate(today), "2026-10-03");
});


test("UUID actions match saved identities regardless of letter case", () => {
  const state = seedState();
  const taskId = state.tasks[0].id;
  const updated = applyAction(state, { type: "task.status", id: taskId.toUpperCase(), status: "doing" });
  assert.equal(updated.tasks.find(task => task.id === taskId)?.status, "doing");
  const deleted = applyAction(state, { type: "goal.delete", id: state.goals[0].id.toUpperCase() });
  assert.equal(deleted.goals.length, 1);
  assert.ok(deleted.tasks.every(task => task.goalId !== state.goals[0].id));
  assert.equal(deleted.entries[0].goalId, null);
});

test("loaded UUIDs normalize before relationship and duplicate checks", () => {
  const state = seedState();
  const mixed = structuredClone(state);
  mixed.goals[0].id = mixed.goals[0].id.toUpperCase();
  mixed.tasks[0].id = mixed.tasks[0].id.toUpperCase();
  mixed.entries[0].goalId = mixed.entries[0].goalId!.toUpperCase();
  assert.deepEqual(stateSchema.parse(mixed), state);
  assert.equal(mixed.goals[0].id, state.goals[0].id.toUpperCase());
  for (const collection of ["goals", "tasks", "entries"] as const) {
    const original = state[collection][0];
    const duplicate = { ...state, [collection]: [...state[collection], { ...original, id: original.id.toUpperCase() }] };
    assert.equal(stateSchema.safeParse(duplicate).success, false, collection);
  }
});
