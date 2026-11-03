import assert from "node:assert/strict";
import { test } from "node:test";
import { BookmarkService } from "../lib/index.js";
import { bookmarkPutResultSchema } from "../lib/schemas.js";

const header = { id: "session-1", createdAt: 1, cwd: "/workspace" };
const event = {
  seq: 0, time: 1, type: "assistant/message", surfaceOp: "append",
  data: { message: { id: "message-1", role: "assistant", content: [{ type: "text", text: "Hello\n world" }] } },
};
const request = { sessionId: header.id, messageId: "message-1", ifVersion: null };

function fixture({ legacy = false, live = false, missing = false, stale = false, readError = false, flush = true } = {}) {
  let row;
  let closed = 0;
  let flushed = false;
  let writes = 0;
  const inspection = () => ({ meta: header, events: stale || (live && !flushed) ? [] : [event] });
  const owner = { header, snapshotEvents: () => [event] };
  const persistence = legacy ? {
    listSnapshots: async () => missing ? [] : [{ header }],
    inspect: async () => ({ meta: header, events: [event] }),
    readFrom: async () => inspection(),
  } : {
    stat: async () => missing ? undefined : { header },
    open: async (id, access) => {
      assert.equal(id, header.id);
      assert.equal(access, "read");
      return {
        header,
        read: async () => {
          if (readError) throw new Error("read failed");
          return { events: inspection().events };
        },
        close: async () => { closed++; },
      };
    },
  };
  // No Cordis lifecycle needed: exercise the real mutation pipeline with the
  // public persistence contracts, deliberately omitting removed methods.
  const service = Object.assign(Object.create(BookmarkService.prototype), {
    ctx: { sessionPersistence: persistence, sessions: {
      get: () => live ? owner : undefined,
      flush: async () => { flushed = true; return flush; },
    } },
    maxNoteBytes: 4096, maxSnippetChars: 300, maxTags: 8,
    operationTail: Promise.resolve(), mutationAdmissionOpen: true,
    table: { get: () => row, put: async (_, value) => { row = value; writes++; } },
  });
  return { service, closed: () => closed, flushed: () => flushed, writes: () => writes };
}

for (const legacy of [false, true]) {
  for (const live of [false, true]) {
    test(`${legacy ? "legacy" : "handle"} API: bookmark ${live ? "live" : "stored"} reply, edit, conflict, delete`, async () => {
      const f = fixture({ legacy, live });
      const saved = bookmarkPutResultSchema.parse(await f.service.put(request));
      assert.equal(saved.ok, true);
      assert.equal(saved.value.snippet, "Hello world");
      assert.equal(f.service.list().value.items.length, 1);
      if (live) assert.equal(f.flushed(), true);
      const conflict = await f.service.put(request);
      assert.equal(conflict.error.code, "version-conflict");
      assert.deepEqual(conflict.error.current, saved.value);
      const edited = await f.service.put({ ...request, ifVersion: saved.value.version, note: "Useful", tags: [" tag ", "tag"] });
      assert.equal(edited.ok, true);
      assert.deepEqual(edited.value.tags, ["tag"]);
      assert.equal(edited.value.note, "Useful");
      assert.equal((await f.service.put({ ...request, ifVersion: edited.value.version })).value.version, edited.value.version);
      assert.equal((await f.service.delete({ ...request, ifVersion: saved.value.version })).error.code, "version-conflict");
      assert.equal((await f.service.delete({ ...request, ifVersion: edited.value.version })).ok, true);
      assert.deepEqual(f.service.list().value.items, []);
    });
  }
}

test("missing session is a business failure", async () => {
  const f = fixture({ missing: true });
  assert.equal((await f.service.put(request)).error.code, "session-not-found");
  assert.equal(f.writes(), 0);
});

test("missing target is rejected and read handle closes", async () => {
  const f = fixture();
  assert.equal((await f.service.put({ ...request, messageId: "absent" })).error.code, "target-not-found");
  assert.equal(f.closed(), 1);
  assert.equal(f.writes(), 0);
});

test("read failure closes the handle", async () => {
  const f = fixture({ readError: true });
  await assert.rejects(f.service.put(request), /read failed/);
  assert.equal(f.closed(), 1);
  assert.equal(f.writes(), 0);
});

test("live target must be durable even when a flush listener participates", async () => {
  const f = fixture({ live: true, stale: true });
  await assert.rejects(f.service.put(request), /prefix is not durable/);
  assert.equal(f.closed(), 1);
  assert.equal(f.writes(), 0);
});

test("missing durability listener never writes a bookmark", async () => {
  const f = fixture({ live: true, flush: false });
  await assert.rejects(f.service.put(request), /no durability listener/);
  assert.equal(f.writes(), 0);
});

test("simultaneous creates reconcile using the committed version", async () => {
  const f = fixture();
  const results = await Promise.all([f.service.put(request), f.service.put(request)]);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].error.code, "version-conflict");
  assert.equal(f.writes(), 1);
});

test("Zod 4 infrastructure failure details survive the wire codec", () => {
  const failure = { ok: false, error: { code: "gateway/internal", message: "read failed", details: { endpoint: "bookmarks/put" } } };
  assert.deepEqual(bookmarkPutResultSchema.parse(failure), failure);
});
