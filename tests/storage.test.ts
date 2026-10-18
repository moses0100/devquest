import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, seedState } from "../src/lib/domain";
import { parseSavedState } from "../src/lib/storage";

test("a removed snapshot cannot be used to recreate old data during a mutation", () => {
  const old = seedState();
  assert.throws(() => applyAction(parseSavedState(null), { type: "task.status", id: old.tasks[0].id, status: "done" }), /ถูกลบ.*โหลดหน้าใหม่/);
});

test("empty or malformed saved data is rejected rather than treated as a first visit", () => {
  for (const saved of ["", "{", "null", "{}", '{"goals":[]}' ]) {
    assert.throws(() => parseSavedState(saved));
  }
});

test("saved data validates relationships and permits a deliberately empty workspace", () => {
  const state = seedState();
  state.goals = [];
  assert.throws(() => parseSavedState(JSON.stringify(state)));
  const empty = { goals: [], tasks: [], entries: [] };
  assert.deepEqual(parseSavedState(JSON.stringify(empty)), empty);
});

test("a valid snapshot can be read again after the stored data is repaired", () => {
  const state = seedState();
  assert.deepEqual(parseSavedState(JSON.stringify(state)), state);
});
