import assert from "node:assert/strict";
import { test } from "node:test";
import { loadBookmarkTarget } from "../src/client/jump.js";

function reply(seq, id, surfaceOp = "append") {
  return { event: { seq, type: "assistant/message", surfaceOp, data: { message: { id } } } };
}

function pagedHistory(pages) {
  let page = 0;
  return {
    get loads() { return page; },
    session: {
      getSnapshot: () => ({ loadingOlder: false }),
      loadOlder: async () => { page++; },
    },
    eventSource: {
      getSnapshot: () => ({ entries: pages[page], hasMore: page < pages.length - 1 }),
    },
  };
}

test("finds the exact reply in the first page without loading more", async () => {
  const history = pagedHistory([[reply(50, "wanted")], [reply(10, "other")]]);
  assert.equal(await loadBookmarkTarget(history, "wanted", new AbortController().signal), true);
  assert.equal(history.loads, 0);
});

test("loads older pages until it finds the original reply", async () => {
  const replacement = reply(80, "wanted", { op: "replace" });
  const middle = reply(50, "other");
  const history = pagedHistory([[replacement], [middle, replacement], [reply(10, "wanted"), middle, replacement]]);
  assert.equal(await loadBookmarkTarget(history, "wanted", new AbortController().signal), true);
  assert.equal(history.loads, 2);
});

test("reports an absent reply after history is exhausted", async () => {
  const history = pagedHistory([[reply(50, "other")]]);
  assert.equal(await loadBookmarkTarget(history, "wanted", new AbortController().signal), false);
});

test("stops if a history request makes no progress", async () => {
  const history = pagedHistory([[reply(50, "other")], []]);
  history.session.loadOlder = async () => {};
  await assert.rejects(loadBookmarkTarget(history, "wanted", new AbortController().signal), /Could not load older history/);
});

test("cancellation stops additional history requests", async () => {
  const history = pagedHistory([[reply(50, "other")], []]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(loadBookmarkTarget(history, "wanted", controller.signal), { name: "AbortError" });
  assert.equal(history.loads, 0);
});
