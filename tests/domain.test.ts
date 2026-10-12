import test from "node:test";
import assert from "node:assert/strict";
import { Action, actionSchema, applyAction, localDate, seedState, streak } from "../src/lib/domain";

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
