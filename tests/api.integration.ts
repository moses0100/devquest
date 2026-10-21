import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { QuestState } from "../src/lib/domain";

// Run against a local development/test database; creates only uniquely named test data.
const base = process.env.API_BASE ?? "http://127.0.0.1:3000";
const key = process.env.API_KEY ?? "";
const headers = { "Content-Type": "application/json", Origin: base, Authorization: `Bearer ${key}` };
async function send(body: unknown, expected = 200, override: Record<string, string> = {}) {
  const response = await fetch(`${base}/api/quests`, { method: "POST", headers: { ...headers, ...override }, body: JSON.stringify(body) });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}
async function read(): Promise<QuestState> {
  const response = await fetch(`${base}/api/quests`, { headers });
  assert.equal(response.status, 200);
  return response.json();
}
async function main() {
  const title = `API test ${randomUUID()}`;
  let goalId = "", entryId = "";
  try {
    if (key) {
      const rejected = await fetch(`${base}/api/quests`, { headers: { Authorization: "Bearer invalid-test-key" } });
      assert.equal(rejected.status, 401);
    }
    await send({ type: "goal.create", title, category: "Backend" }, 403, { Origin: "https://invalid.example" });
    await send({ type: "goal.create", title: " ", category: "Backend" }, 400);
    await send({ type: "task.create", title: "Orphan", goalId: randomUUID() }, 409);
    await send({ type: "goal.create", title, category: "Backend" });
    goalId = (await read()).goals.find(g => g.title === title)!.id;
    assert.ok(goalId);
    await send({ type: "task.create", title, goalId });
    const taskId = (await read()).tasks.find(t => t.goalId === goalId)!.id;
    await send({ type: "task.status", id: taskId.toUpperCase(), status: "doing" });
    assert.equal((await read()).tasks.find(t => t.id === taskId)?.status, "doing");
    await send({ type: "task.status", id: taskId, status: "done" });
    assert.equal((await read()).tasks.find(t => t.id === taskId)?.status, "done");
    await send({ type: "entry.create", title, content: "Integration test entry", minutes: 25, date: "2026-10-03", goalId });
    entryId = (await read()).entries.find(e => e.title === title)!.id;
    await send({ type: "goal.delete", id: goalId });
    const final = await read();
    assert.equal(final.goals.some(g => g.id === goalId), false);
    assert.equal(final.tasks.some(t => t.goalId === goalId), false);
    assert.equal(final.entries.find(e => e.id === entryId)?.goalId, null);
    goalId = "";
    await send({ type: "task.status", id: taskId, status: "todo" }, 409);
    await send({ type: "entry.delete", id: entryId }); entryId = "";
    const tooLarge = await fetch(`${base}/api/quests`, { method: "POST", headers, body: JSON.stringify({ content: "x".repeat(40000) }) });
    assert.equal(tooLarge.status, 413);
    console.log("API integration passed: CRUD, validation, origin, request limit, cascade and journal preservation" + (key ? ", access-key authentication" : ""));
  } finally {
    if (entryId) await send({ type: "entry.delete", id: entryId });
    if (goalId) await send({ type: "goal.delete", id: goalId });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
