import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { downloadJson } from "../src/lib/download";

function browser(t: TestContext, click: () => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  const anchor = { href: "", download: "", click };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: (tag: string) => { assert.equal(tag, "a"); return anchor; } },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  });
  const blobs: Blob[] = [];
  const revoked: string[] = [];
  t.mock.method(URL, "createObjectURL", (blob: Blob) => { blobs.push(blob); return "blob:backup"; });
  t.mock.method(URL, "revokeObjectURL", (url: string) => { revoked.push(url); });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  return { anchor, blobs, revoked };
}

test("JSON backup remains readable after the click before its URL is released", async t => {
  let clicks = 0;
  const env = browser(t, () => { clicks++; });
  const data = { title: "บันทึกภาษาไทย", minutes: 30 };
  downloadJson(data, "devquest-backup.json");
  assert.equal(clicks, 1);
  assert.equal(env.anchor.download, "devquest-backup.json");
  assert.equal(env.anchor.href, "blob:backup");
  assert.equal(env.blobs[0].type, "application/json");
  assert.deepEqual(JSON.parse(await env.blobs[0].text()), data);
  assert.deepEqual(env.revoked, []);
  t.mock.timers.tick(1000);
  assert.deepEqual(env.revoked, ["blob:backup"]);
});

test("a failed download still releases the allocated URL and preserves the error", t => {
  const failure = new Error("download blocked");
  const env = browser(t, () => { throw failure; });
  assert.throws(() => downloadJson({}, "backup.json"), error => error === failure);
  t.mock.timers.tick(1000);
  assert.deepEqual(env.revoked, ["blob:backup"]);
});
