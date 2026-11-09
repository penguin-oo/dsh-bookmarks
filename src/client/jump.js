/** Search the loaded history, then ask DSH for older pages as needed. */
export async function loadBookmarkTarget({ session, eventSource }, messageId, signal) {
  for (;;) {
    signal.throwIfAborted();
    const { entries, hasMore } = eventSource.getSnapshot();
    if (entries.some(({ event }) => event.type === "assistant/message"
      && event.surfaceOp === "append" && event.data.message.id === messageId)) return true;
    if (!hasMore) return false;

    if (session.getSnapshot().loadingOlder) {
      const settled = await waitFor(() => !session.getSnapshot().loadingOlder, signal, 15000);
      if (!settled) throw new Error("History loading timed out");
      continue;
    }
    await session.loadOlder();
    const next = eventSource.getSnapshot();
    if (next.hasMore && next.entries[0]?.event.seq === entries[0]?.event.seq)
      throw new Error("Could not load older history");
  }
}

/** React commits the selected transcript asynchronously after navigation and paging. */
async function waitFor(read, signal, timeout = 5000) {
  const deadline = performance.now() + timeout;
  for (;;) {
    signal.throwIfAborted();
    const result = read();
    if (result || performance.now() >= deadline) return result;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
}

/** Open the owning session and land on the exact bookmarked reply. */
export async function jumpToBookmark(ctx, { sessionId, messageId }, signal) {
  signal.throwIfAborted();
  const sessions = ctx.sessions;
  const workspace = ctx.get("uiWorkspace");
  if (typeof workspace?.openSession === "function") workspace.openSession(sessionId);
  else await sessions.open(sessionId);

  const sessionSelector = `[data-dshbm-session="${CSS.escape(sessionId)}"]`;
  const replySelector = `${sessionSelector}[data-dshbm-message="${CSS.escape(messageId)}"]`;
  if (typeof sessions.using === "function") {
    const found = await sessions.using(sessionId, { source: "bookmarks", signal }, async ({ binding }) => {
      const state = binding.session.getSnapshot();
      if (state.openState !== "open" || state.removed) throw new Error(state.openError?.message ?? "Could not open session");
      return loadBookmarkTarget(binding, messageId, signal);
    });
    if (!found) return false;
  }

  // Chat is DSH's fixed first tab. Wait for this session's header before
  // selecting it so a pending render cannot change the previous session.
  const surface = await waitFor(() => document.querySelector(replySelector)
    ?? document.querySelector(`[data-dshbm-header]${sessionSelector}`), signal);
  if (!surface) throw new Error("Could not display session");
  const header = surface.closest('[data-slot="conversation.session.header"]');
  header?.querySelector('[data-conversation-tabs] [role="tab"][aria-selected="false"]:first-child')?.click();

  const action = await waitFor(() => document.querySelector(replySelector), signal);
  if (!action) return false;
  const chat = ctx.get("uiConversation")?.binding(sessionId).target?.("chat").getSnapshot();
  const node = chat?.nodes?.values?.().find(candidate => candidate.kind === "assistant-step"
    && candidate.data.finalNode?.messageId === messageId);
  const flow = action.closest("[data-chat-flow]");
  const reply = node && flow?.querySelector(`[data-chat-node-key="${CSS.escape(node.key)}"]:not([data-turn-process-hidden]):not([hidden] *)`);
  const target = reply || action.closest("[data-turn-tail]") || action;
  target.classList.add("dshbm_landing");
  target.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" });
  setTimeout(() => target.classList.remove("dshbm_landing"), 1800);
  return true;
}
