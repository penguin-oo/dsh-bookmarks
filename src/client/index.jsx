// dsh-bookmarks — browser half. Bundled by scripts/build-client.mjs into
// lib/client.js in the window.__ModuleLoader__.load shape.
//
// - A bookmark action in the `conversation.chat.assistant-actions` strip with
//   an inline note/tags editor.
// - A standalone full-screen bookmark center mounted on the app shell's
//   `shell.overlay` slot (toggle: sidebar footer button or Alt+B), with
//   search, tag filter, session jump, inline editing and Markdown export.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  IconArchiveOutline20,
  IconCheckOutline16,
  IconChevronLeftOutline14,
  IconCloseOutline16,
  IconDownloadOutline16,
  IconEditOutline16,
  IconRightUpOutline16,
  IconSearchOutline16,
  IconTrashOutline16,
  Tooltip,
} from "@deepseek-ai/dsh-client-ui-primitives";
import { TYPERT_REMOTE } from "../../lib/typert.remote-client.js";

// ── styles ───────────────────────────────────────────────────────────────────

const cssText = `
.dshbm_action{width:28px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:28px;justify-content:center;align-items:center;padding:6px;display:inline-flex}
.dshbm_action:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.dshbm_action:disabled{cursor:default;opacity:.4}
.dshbm_action[data-active]{color:#4d6bfe}
.dshbm_editor{align-items:flex-start;gap:6px;display:inline-flex;flex-wrap:wrap}
.dshbm_field{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);width:240px;color:var(--dsw-alias-label-primary);font:inherit;resize:vertical;border-radius:8px;padding:6px 8px;font-size:13px}
.dshbm_field:focus{outline:1px solid #4d6bfe}
.dshbm_btn{cursor:pointer;border:none;border-radius:14px;height:28px;padding:0 10px;font-size:13px}
.dshbm_btn:disabled{cursor:default;opacity:.4}
.dshbm_save{background:#4d6bfe;color:#fff}
.dshbm_save:hover{background:#3a56e4}
.dshbm_cancel{color:var(--dsw-alias-label-secondary);background:0 0}
.dshbm_cancel:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.dshbm_danger{color:var(--dsw-alias-label-secondary);background:0 0}
.dshbm_danger:hover{background:var(--dsw-alias-bg-layer-1);color:#e5484d}
.dshbm_failure{color:var(--dsw-alias-label-secondary);padding-left:4px;font-size:13px;line-height:28px}
.dshbm_footerAction{position:relative;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:8px;padding:6px;display:inline-flex;align-items:center}
.dshbm_footerAction:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.dshbm_badge{position:absolute;top:1px;right:1px;background:#4d6bfe;color:#fff;border-radius:7px;font-size:10px;line-height:13px;min-width:13px;text-align:center;padding:0 2px}
.dshbm_overlay{position:fixed;inset:0;z-index:120;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);pointer-events:auto;color:var(--dsw-alias-label-primary)}
.dshbm_head{display:flex;align-items:center;gap:10px;padding:16px 32px;background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l2)}
.dshbm_back{display:inline-flex;align-items:center;gap:4px;cursor:pointer;background:0 0;border:none;border-radius:8px;padding:5px 10px 5px 6px;color:var(--dsw-alias-label-secondary);font-size:13px;font-family:inherit}
.dshbm_back:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.dshbm_headIcon{color:#4d6bfe;display:inline-flex}
.dshbm_title{flex:1;font-size:17px;font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshbm_count{font-size:12px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:2px 10px;line-height:18px}
.dshbm_close{color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:8px;padding:6px;display:inline-flex}
.dshbm_close:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.dshbm_body{flex:1;overflow-y:auto;padding:24px 32px 48px;display:flex;justify-content:center;align-items:flex-start}
.dshbm_inner{width:100%;max-width:860px;display:flex;flex-direction:column;gap:14px}
.dshbm_toolbar{display:flex;flex-direction:column;gap:10px}
.dshbm_toolbarRow{display:flex;gap:10px;align-items:center}
.dshbm_search{position:relative;display:flex;align-items:center;flex:1}
.dshbm_searchIcon{position:absolute;left:10px;color:var(--dsw-alias-label-secondary);pointer-events:none}
.dshbm_searchInput{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);width:100%;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:7px 10px 7px 32px;font-size:13px}
.dshbm_searchInput:focus{outline:1px solid #4d6bfe}
.dshbm_tags{display:flex;gap:6px;flex-wrap:wrap}
.dshbm_tag{cursor:pointer;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:12px;font-size:12px;line-height:18px;padding:2px 10px}
.dshbm_tag:hover{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}
.dshbm_tag[data-on]{background:#4d6bfe;color:#fff;border-color:transparent}
.dshbm_list{display:flex;flex-direction:column;gap:10px}
.dshbm_empty{padding:64px 12px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.8;display:flex;flex-direction:column;align-items:center;gap:12px}
.dshbm_emptyIcon{color:var(--dsw-alias-label-secondary);opacity:.7}
.dshbm_card{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 1px 2px rgba(0,0,0,.06)}
.dshbm_card:hover{border-color:#4d6bfe}
.dshbm_snippet{font-size:13px;line-height:1.7;color:var(--dsw-alias-label-primary);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.dshbm_note{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-left:3px solid #4d6bfe;border-radius:0 6px 6px 0;padding:6px 10px;word-break:break-word}
.dshbm_meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dshbm_time{font-size:11px;color:var(--dsw-alias-label-secondary)}
.dshbm_rowTags{display:flex;gap:4px;flex-wrap:wrap}
.dshbm_rowTag{font-size:11px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:0 6px;line-height:16px;background:var(--dsw-alias-bg-layer-2)}
.dshbm_spacer{flex:1}
.dshbm_iconBtn{color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:6px;padding:4px;display:inline-flex}
.dshbm_iconBtn:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.dshbm_iconBtn:disabled{cursor:default;opacity:.4}
.dshbm_export{cursor:pointer;border:none;border-radius:8px;height:32px;padding:0 14px;font-size:13px;font-weight:500;background:#4d6bfe;color:#fff;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.dshbm_export:hover{background:#3a56e4}
.dshbm_export:disabled{cursor:default;opacity:.5}
`;

const css = {
  action: "dshbm_action",
  editor: "dshbm_editor",
  field: "dshbm_field",
  btn: "dshbm_btn",
  save: "dshbm_save",
  cancel: "dshbm_cancel",
  danger: "dshbm_danger",
  failure: "dshbm_failure",
  footerAction: "dshbm_footerAction",
  badge: "dshbm_badge",
  overlay: "dshbm_overlay",
  head: "dshbm_head",
  back: "dshbm_back",
  headIcon: "dshbm_headIcon",
  title: "dshbm_title",
  count: "dshbm_count",
  close: "dshbm_close",
  body: "dshbm_body",
  inner: "dshbm_inner",
  toolbar: "dshbm_toolbar",
  toolbarRow: "dshbm_toolbarRow",
  search: "dshbm_search",
  searchIcon: "dshbm_searchIcon",
  searchInput: "dshbm_searchInput",
  tags: "dshbm_tags",
  tag: "dshbm_tag",
  list: "dshbm_list",
  empty: "dshbm_empty",
  emptyIcon: "dshbm_emptyIcon",
  card: "dshbm_card",
  snippet: "dshbm_snippet",
  note: "dshbm_note",
  meta: "dshbm_meta",
  time: "dshbm_time",
  rowTags: "dshbm_rowTags",
  rowTag: "dshbm_rowTag",
  spacer: "dshbm_spacer",
  iconBtn: "dshbm_iconBtn",
  export: "dshbm_export",
};

const cssTagId = "dsh-bookmarks/client.css";
if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css=${JSON.stringify(cssTagId)}]`) === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-bookmarks";
  tag.dataset.pluginCss = cssTagId;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

// ── locales ──────────────────────────────────────────────────────────────────

const zh = {
  "action.bookmark": "收藏这条回复",
  "action.remove": "取消收藏",
  "action.edit": "编辑收藏",
  "action.delete": "删除",
  "action.jump": "跳转到会话",
  "note.placeholder": "为什么收藏这条回复？（可选）",
  "note.aria": "收藏备注",
  "note.save": "保存",
  "note.cancel": "取消",
  "tags.placeholder": "标签，用逗号分隔（可选）",
  "tags.aria": "收藏标签",
  "center.title": "收藏中心",
  "center.back": "返回",
  "center.empty": "还没有收藏。把鼠标移到某条 AI 回复上，点归档图标即可收藏。",
  "center.search": "搜索收藏…",
  "center.all": "全部",
  "center.export": "导出 Markdown",
  "center.noResults": "没有匹配的收藏",
  "center.editNote": "编辑备注",
  "export.exportedAt": "导出时间",
  "export.session": "会话",
  "export.tags": "标签",
  "error.conflict": "这条收藏已在别处改动，已显示最新状态",
  "error.load": "收藏状态加载失败",
  "error.generic": "收藏保存失败",
  "error.session-gone": "会话已不存在",
  "error.target-gone": "目标消息不存在",
  "error.note-blank": "备注不能为空",
  "error.note-too-large": "备注太长",
  "error.tags-invalid": "标签无效",
};

const en = {
  "action.bookmark": "Bookmark this reply",
  "action.remove": "Remove bookmark",
  "action.edit": "Edit bookmark",
  "action.delete": "Delete",
  "action.jump": "Open session",
  "note.placeholder": "Why bookmark this reply? (optional)",
  "note.aria": "Bookmark note",
  "note.save": "Save",
  "note.cancel": "Cancel",
  "tags.placeholder": "Tags, comma separated (optional)",
  "tags.aria": "Bookmark tags",
  "center.title": "Bookmarks",
  "center.back": "Back",
  "center.empty": "No bookmarks yet. Hover an assistant reply and click the archive icon to bookmark it.",
  "center.search": "Search bookmarks…",
  "center.all": "All",
  "center.export": "Export Markdown",
  "center.noResults": "No matching bookmarks",
  "center.editNote": "Edit note",
  "export.exportedAt": "Exported at",
  "export.session": "Session",
  "export.tags": "Tags",
  "error.conflict": "This bookmark changed elsewhere; the latest state is shown",
  "error.load": "Could not load bookmarks",
  "error.generic": "Could not save bookmark",
  "error.session-gone": "The session no longer exists",
  "error.target-gone": "The target message no longer exists",
  "error.note-blank": "The note must not be blank",
  "error.note-too-large": "The note is too long",
  "error.tags-invalid": "Invalid tags",
};

// ── shared plumbing ──────────────────────────────────────────────────────────

const OK = Object.freeze({ ok: true });
const DISPOSED = Object.freeze({
  ok: false,
  error: Object.freeze({ code: "disposed", message: "bookmark store is disposed" }),
});
const INITIAL_VIEW = Object.freeze({ status: "cold", items: new Map(), error: null });

const keyOf = (sessionId, messageId) => `${sessionId}\u0000${messageId}`;

/** Human-readable text for one business failure code. */
function describe(code) {
  switch (code) {
    case "session-not-found":
      return "error.session-gone";
    case "target-not-found":
      return "error.target-gone";
    case "version-conflict":
      return "error.conflict";
    case "note-blank":
      return "error.note-blank";
    case "note-too-large":
      return "error.note-too-large";
    case "tags-invalid":
      return "error.tags-invalid";
    default:
      return code;
  }
}

function fail(code) {
  return { ok: false, error: { code, message: describe(code) } };
}

function carrierFailure(error) {
  return { ok: false, error: { code: error.code, message: error.message } };
}

/** Open/close cell shared by the sidebar toggle, the overlay, and Alt+B. */
const centerOpen = (() => {
  let open = false;
  const listeners = new Set();
  const emit = () => {
    for (const listener of listeners)
      try {
        listener();
      } catch {
        /* subscriber failure is isolated */
      }
  };
  return {
    get: () => open,
    set: (value) => {
      if (open !== value) {
        open = value;
        emit();
      }
    },
    toggle: () => {
      open = !open;
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
})();

// ── store ────────────────────────────────────────────────────────────────────

/**
 * One global object layer over the `bookmarks` Remote. A single list read
 * seeds every per-message control and the center; mutations are serialized and
 * reconcile compare-and-set conflicts the way the official message-feedback
 * controller does.
 */
class BookmarkStore {
  remote;
  view = INITIAL_VIEW;
  listeners = new Set();
  loadPromise = null;
  operationTail = Promise.resolve();
  disposed = false;

  constructor(remote) {
    this.remote = remote;
  }

  getSnapshot = () => this.view;
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  ensure() {
    if (this.view.status === "ready") return Promise.resolve(OK);
    return this.refresh();
  }

  refresh() {
    if (this.loadPromise !== null) return this.loadPromise;
    this.publish({ status: "loading", items: this.view.items, error: null });
    const pending = this.load();
    this.loadPromise = pending;
    return pending.finally(() => {
      this.loadPromise = null;
    });
  }

  resync() {
    return this.mutate(() => this.refresh(), { seed: false });
  }

  /** Create a bookmark when absent; an existing bookmark is left untouched. */
  bookmark(sessionId, messageId) {
    return this.mutate(async () => {
      const observed = this.view.items.get(keyOf(sessionId, messageId));
      if (observed !== void 0) return OK;
      return await this.putCommitted(sessionId, messageId, void 0, [], null);
    });
  }

  /** Create or replace note/tags for one bookmark. */
  update(sessionId, messageId, note, tags) {
    return this.mutate(async () => {
      const observed = this.view.items.get(keyOf(sessionId, messageId));
      return await this.putCommitted(sessionId, messageId, note, tags, observed?.version ?? null);
    });
  }

  /** Remove one bookmark. */
  remove(sessionId, messageId) {
    return this.mutate(async () => {
      const observed = this.view.items.get(keyOf(sessionId, messageId));
      if (observed === void 0) return OK;
      return await this.deleteCommitted(sessionId, messageId, observed);
    });
  }

  async putCommitted(sessionId, messageId, note, tags, ifVersion) {
    const carried = await this.remote.put({
      sessionId,
      messageId,
      ...(note === void 0 ? {} : { note }),
      tags,
      ifVersion,
    });
    if (!carried.ok) return carrierFailure(carried.error);
    const result = carried.value;
    if (result.ok) {
      this.commit(keyOf(sessionId, messageId), result.value);
      return OK;
    }
    if (result.error.code === "version-conflict") this.commit(keyOf(sessionId, messageId), result.error.current);
    return fail(result.error.code);
  }

  async deleteCommitted(sessionId, messageId, observed) {
    const carried = await this.remote.delete({
      sessionId,
      messageId,
      ifVersion: observed.version,
    });
    if (!carried.ok) return carrierFailure(carried.error);
    const result = carried.value;
    if (result.ok) {
      this.commit(keyOf(sessionId, messageId), null);
      return OK;
    }
    if (result.error.code === "version-conflict") this.commit(keyOf(sessionId, messageId), result.error.current);
    return fail(result.error.code);
  }

  dispose() {
    this.disposed = true;
    this.listeners.clear();
  }

  async load() {
    try {
      const carried = await this.remote.list();
      if (this.disposed) return OK;
      if (!carried.ok) {
        this.publish({ status: "error", items: this.view.items, error: carried.error.message });
        return carrierFailure(carried.error);
      }
      const result = carried.value;
      if (!result.ok) {
        this.publish({ status: "error", items: this.view.items, error: describe(result.error.code) });
        return fail(result.error.code);
      }
      const items = new Map();
      for (const item of result.value.items) items.set(keyOf(item.sessionId, item.messageId), item);
      this.publish({ status: "ready", items, error: null });
      return OK;
    } catch (error) {
      if (this.disposed) return OK;
      const message = error instanceof Error ? error.message : "bookmark list failed";
      this.publish({ status: "error", items: this.view.items, error: message });
      return { ok: false, error: { code: "transport", message } };
    }
  }

  mutate(operation, options = {}) {
    const guarded = async () => {
      if (this.disposed) return DISPOSED;
      if (options.seed !== false) {
        const loaded = await this.ensure();
        if (!loaded.ok) return loaded;
        if (this.disposed) return DISPOSED;
      }
      try {
        return await operation();
      } catch (error) {
        return {
          ok: false,
          error: {
            code: "transport",
            message: error instanceof Error ? error.message : "bookmark mutation failed",
          },
        };
      }
    };
    const result = this.operationTail.then(guarded, guarded);
    this.operationTail = result.then(
      () => void 0,
      () => void 0,
    );
    return result;
  }

  commit(key, item) {
    const items = new Map(this.view.items);
    if (item === null) items.delete(key);
    else items.set(key, item);
    this.publish({ status: "ready", items, error: null });
  }

  publish(view) {
    this.view = Object.freeze(view);
    for (const listener of this.listeners)
      try {
        listener();
      } catch (error) {
        console.error("[dsh-bookmarks] subscriber threw:", error);
      }
  }
}

// ── components ───────────────────────────────────────────────────────────────

/** Per-message bookmark action with an inline note/tags editor. */
function BookmarkAction({ messageId, sessionId, ensure, bookmark, update, remove, useBookmarks, t }) {
  const item = useBookmarks((view) => view.items.get(keyOf(sessionId, messageId)));
  const loadFailed = useBookmarks((view) => view.status === "error");
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState(null);
  const seeded = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
  }, []);
  const seed = useCallback(() => {
    if (seeded.current) return;
    seeded.current = true;
    ensure();
  }, [ensure]);
  const settle = useCallback(
    (result) => {
      if (!alive.current) return;
      setPending(false);
      if (result.ok) {
        setFailure(null);
        return;
      }
      setFailure(t(describe(result.error?.code ?? "error.generic")));
    },
    [t],
  );

  const onToggle = useCallback(() => {
    if (item !== void 0) {
      setFailure(null);
      if (!editorOpen) {
        setDraftNote(item.note ?? "");
        setDraftTags((item.tags ?? []).join(", "));
      }
      setEditorOpen(!editorOpen);
      return;
    }
    setPending(true);
    setFailure(null);
    bookmark(sessionId, messageId).then((result) => {
      settle(result);
      if (result.ok && alive.current) {
        setDraftNote("");
        setDraftTags("");
        setEditorOpen(true);
      }
    });
  }, [bookmark, editorOpen, item, messageId, sessionId, settle]);

  const onSave = useCallback(() => {
    setPending(true);
    setFailure(null);
    const note = draftNote.trim();
    const tags = draftTags
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    update(sessionId, messageId, note, tags).then((result) => {
      settle(result);
      if (result.ok && alive.current) setEditorOpen(false);
    });
  }, [draftNote, draftTags, messageId, sessionId, settle, update]);

  const onDelete = useCallback(() => {
    setPending(true);
    setFailure(null);
    remove(sessionId, messageId).then((result) => {
      settle(result);
      if (result.ok && alive.current) setEditorOpen(false);
    });
  }, [messageId, remove, sessionId, settle]);

  const label = item === void 0 ? t("action.bookmark") : t("action.edit");
  return (
    <>
      <Tooltip label={label} side="bottom">
        <button
          type="button"
          className={css.action}
          aria-label={label}
          aria-pressed={item !== void 0}
          data-active={item !== void 0 || undefined}
          disabled={pending}
          onFocus={seed}
          onPointerEnter={seed}
          onClick={onToggle}
        >
          <IconArchiveOutline20 size={16} />
        </button>
      </Tooltip>
      {item !== void 0 && editorOpen && (
        <span className={css.editor}>
          <textarea
            className={css.field}
            aria-label={t("note.aria")}
            placeholder={t("note.placeholder")}
            value={draftNote}
            rows={2}
            onChange={(event) => setDraftNote(event.target.value)}
          />
          <input
            className={css.field}
            aria-label={t("tags.aria")}
            placeholder={t("tags.placeholder")}
            value={draftTags}
            onChange={(event) => setDraftTags(event.target.value)}
          />
          <button type="button" className={`${css.btn} ${css.save}`} disabled={pending} onClick={onSave}>
            {t("note.save")}
          </button>
          <button type="button" className={`${css.btn} ${css.danger}`} disabled={pending} onClick={onDelete}>
            {t("action.delete")}
          </button>
          <button type="button" className={`${css.btn} ${css.cancel}`} onClick={() => setEditorOpen(false)}>
            {t("note.cancel")}
          </button>
        </span>
      )}
      {failure === null && loadFailed && (
        <span className={css.failure} role="status">
          {t("error.load")}
        </span>
      )}
      {failure !== null && (
        <span className={css.failure} role="status">
          {failure}
        </span>
      )}
    </>
  );
}

/** Sidebar footer toggle for the bookmark center. */
function BookmarkCenterToggle({ ensure, useBookmarks, t }) {
  const view = useBookmarks((value) => value);
  const seeded = useRef(false);
  const seed = useCallback(() => {
    if (seeded.current) return;
    seeded.current = true;
    ensure();
  }, [ensure]);
  const count = view.items.size;
  return (
    <button
      type="button"
      className={css.footerAction}
      aria-label={t("center.title")}
      title={t("center.title")}
      onClick={() => {
        seed();
        centerOpen.toggle();
      }}
    >
      <IconArchiveOutline20 size={16} />
      {count > 0 && <span className={css.badge}>{count > 99 ? "99+" : String(count)}</span>}
    </button>
  );
}

/** shell.overlay entry: renders the standalone center only while it is open. */
function BookmarkCenterEntry({ ensure, remove, update, jumpTo, useBookmarks, t }) {
  const open = useSyncExternalStore(centerOpen.subscribe, centerOpen.get);
  const view = useBookmarks((value) => value);
  const seeded = useRef(false);
  useEffect(() => {
    if (open && !seeded.current) {
      seeded.current = true;
      ensure();
    }
  }, [open, ensure]);
  if (!open) return null;
  return (
    <BookmarkCenterOverlay
      t={t}
      view={view}
      remove={remove}
      update={update}
      jumpTo={jumpTo}
      onClose={() => centerOpen.set(false)}
    />
  );
}

/** The standalone, opaque bookmark center. */
function BookmarkCenterOverlay({ t, view, remove, update, jumpTo, onClose }) {
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [draftNote, setDraftNote] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [pendingKey, setPendingKey] = useState(null);
  const [failure, setFailure] = useState(null);

  const items = useMemo(() => [...view.items.values()], [view]);
  const allTags = useMemo(() => {
    const set = new Set();
    for (const item of items) for (const tag of item.tags) set.add(tag);
    return [...set].sort();
  }, [items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (tagFilter !== null && !item.tags.includes(tagFilter)) return false;
      if (q === "") return true;
      return `${item.snippet} ${item.note ?? ""} ${item.tags.join(" ")} ${item.sessionId}`.toLowerCase().includes(q);
    });
  }, [items, query, tagFilter]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const settle = (key, result) => {
    setPendingKey(null);
    if (result.ok) {
      setFailure(null);
      setEditingKey(null);
      return;
    }
    setFailure(t(describe(result.error?.code ?? "error.generic")));
    if (editingKey !== key) setEditingKey(null);
  };

  const startEdit = (item) => {
    setFailure(null);
    setEditingKey(keyOf(item.sessionId, item.messageId));
    setDraftNote(item.note ?? "");
    setDraftTags((item.tags ?? []).join(", "));
  };

  const saveEdit = (item) => {
    setPendingKey(keyOf(item.sessionId, item.messageId));
    const note = draftNote.trim();
    const tags = draftTags
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    update(item.sessionId, item.messageId, note, tags).then((result) => settle(keyOf(item.sessionId, item.messageId), result));
  };

  const deleteItem = (item) => {
    setPendingKey(keyOf(item.sessionId, item.messageId));
    remove(item.sessionId, item.messageId).then((result) => settle(keyOf(item.sessionId, item.messageId), result));
  };

  const exportMarkdown = () => {
    const lines = ["# DSH 书签", "", `> ${t("export.exportedAt")}: ${new Date().toLocaleString()}`, ""];
    for (const item of items) {
      lines.push("---", "");
      if (item.tags.length > 0) lines.push(`**${t("export.tags")}:** ${item.tags.map((tag) => `\`${tag}\``).join(" ")}`, "");
      if (item.note) lines.push(`> ${item.note}`, "");
      if (item.snippet) lines.push(item.snippet, "");
      lines.push(`<small>${t("export.session")}: \`${item.sessionId}\` · ${new Date(item.createdAt).toLocaleString()}</small>`, "");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "dsh-bookmarks.md";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={css.overlay} role="dialog" aria-label={t("center.title")}>
      <div className={css.head}>
        <button type="button" className={css.back} onClick={onClose}>
          <IconChevronLeftOutline14 />
          <span>{t("center.back")}</span>
        </button>
        <span className={css.headIcon}>
          <IconArchiveOutline20 size={18} />
        </span>
        <span className={css.title}>{t("center.title")}</span>
        <span className={css.count}>{String(items.length)}</span>
        <button type="button" className={css.close} aria-label={t("note.cancel")} onClick={onClose}>
          <IconCloseOutline16 />
        </button>
      </div>
      <div className={css.body}>
        <div className={css.inner}>
          <div className={css.toolbar}>
            <div className={css.toolbarRow}>
              <label className={css.search}>
                <span className={css.searchIcon}>
                  <IconSearchOutline16 />
                </span>
                <input
                  className={css.searchInput}
                  type="text"
                  value={query}
                  placeholder={t("center.search")}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button type="button" className={css.export} disabled={items.length === 0} onClick={exportMarkdown}>
                <IconDownloadOutline16 />
                {t("center.export")}
              </button>
            </div>
            {allTags.length > 0 && (
              <div className={css.tags}>
                <button type="button" className={css.tag} data-on={tagFilter === null || undefined} onClick={() => setTagFilter(null)}>
                  {t("center.all")}
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={css.tag}
                    data-on={tagFilter === tag || undefined}
                    onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={css.list}>
            {view.status === "loading" && items.length === 0 && <div className={css.empty}>…</div>}
            {view.status !== "loading" && items.length === 0 && (
              <div className={css.empty}>
                <span className={css.emptyIcon}>
                  <IconArchiveOutline20 size={32} />
                </span>
                <span>{t("center.empty")}</span>
              </div>
            )}
            {items.length > 0 && filtered.length === 0 && <div className={css.empty}>{t("center.noResults")}</div>}
            {filtered.map((item) => {
              const key = keyOf(item.sessionId, item.messageId);
              const isEditing = editingKey === key;
              const isPending = pendingKey === key;
              return (
                <div className={css.card} key={key}>
                  {isEditing ? (
                    <>
                      <textarea
                        className={css.field}
                        aria-label={t("note.aria")}
                        value={draftNote}
                        rows={2}
                        onChange={(event) => setDraftNote(event.target.value)}
                      />
                      <input
                        className={css.field}
                        aria-label={t("tags.aria")}
                        value={draftTags}
                        placeholder={t("tags.placeholder")}
                        onChange={(event) => setDraftTags(event.target.value)}
                      />
                    </>
                  ) : (
                    <>
                      {item.snippet && <div className={css.snippet}>{item.snippet}</div>}
                      {item.note && <div className={css.note}>{item.note}</div>}
                    </>
                  )}
                  <div className={css.meta}>
                    {item.tags.length > 0 && (
                      <span className={css.rowTags}>
                        {item.tags.map((tag) => (
                          <span className={css.rowTag} key={tag}>
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                    <span className={css.time}>{new Date(item.createdAt).toLocaleString()}</span>
                    <span className={css.spacer} />
                    {isEditing ? (
                      <>
                        <button type="button" className={css.iconBtn} disabled={isPending} onClick={() => saveEdit(item)} aria-label={t("note.save")}>
                          <IconCheckOutline16 />
                        </button>
                        <button type="button" className={css.iconBtn} onClick={() => setEditingKey(null)} aria-label={t("note.cancel")}>
                          <IconCloseOutline16 />
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className={css.iconBtn} onClick={() => jumpTo(item.sessionId)} aria-label={t("action.jump")} title={t("action.jump")}>
                          <IconRightUpOutline16 />
                        </button>
                        <button type="button" className={css.iconBtn} onClick={() => startEdit(item)} aria-label={t("center.editNote")} title={t("center.editNote")}>
                          <IconEditOutline16 />
                        </button>
                        <button type="button" className={css.iconBtn} disabled={isPending} onClick={() => deleteItem(item)} aria-label={t("action.delete")} title={t("action.delete")}>
                          <IconTrashOutline16 />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {failure !== null && (
            <div className={css.failure} role="status">
              {failure}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── plugin body ──────────────────────────────────────────────────────────────

/** Dictionary namespace owned by this plugin. */
const NS = "bookmarks";
/** Required services: slots, the Remote root (for $mount), copy, sessions. */
const inject = ["slots", "remote", "locale", "sessions"];

/**
 * Client plugin body: mount the `bookmarks` Remote contribution, then
 * contribute the per-message action, the sidebar center toggle, and the
 * standalone center overlay.
 * @param ctx - client root context.
 */
async function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "bookmarks: dictionaries");
  await ctx.remote.$mount(TYPERT_REMOTE);
  const remote = ctx.get("remote.bookmarks");
  const store = new BookmarkStore(remote);
  ctx.on("connection/reset", () => {
    if (store.getSnapshot().status !== "cold") store.resync();
  });
  ctx.effect(
    () => () => {
      store.dispose();
    },
    "bookmarks: store dispose",
  );

  ctx.effect(() => {
    const onKey = (event) => {
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === "KeyB") {
        event.preventDefault();
        centerOpen.toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, "bookmarks: alt-b toggle");

  ctx.slots.inject("conversation.chat.assistant-actions", () => {
    const dispose = ctx.slots.register(
      {
        name: "conversation.chat.assistant-actions",
        id: "bookmark",
        order: 20,
        locale: NS,
        inject: () => ({
          hooks: { bookmarks: store },
          ensure: () => store.ensure(),
          bookmark: (sessionId, messageId) => store.bookmark(sessionId, messageId),
          update: (sessionId, messageId, note, tags) => store.update(sessionId, messageId, note, tags),
          remove: (sessionId, messageId) => store.remove(sessionId, messageId),
        }),
      },
      BookmarkAction,
    );
    return () => {
      dispose();
    };
  });

  ctx.slots.inject("sidebar.footer.action", () => {
    const dispose = ctx.slots.register(
      {
        name: "sidebar.footer.action",
        id: "bookmarks",
        order: 20,
        locale: NS,
        inject: () => ({
          hooks: { bookmarks: store },
          ensure: () => store.ensure(),
        }),
      },
      BookmarkCenterToggle,
    );
    return () => {
      dispose();
    };
  });

  ctx.slots.inject("shell.overlay", () => {
    const dispose = ctx.slots.register(
      {
        name: "shell.overlay",
        id: "bookmarks",
        order: 10,
        locale: NS,
        inject: () => ({
          hooks: { bookmarks: store },
          ensure: () => store.ensure(),
          update: (sessionId, messageId, note, tags) => store.update(sessionId, messageId, note, tags),
          remove: (sessionId, messageId) => store.remove(sessionId, messageId),
          jumpTo: (sessionId) => {
            centerOpen.set(false);
            ctx.sessions.open(sessionId);
          },
        }),
      },
      BookmarkCenterEntry,
    );
    return () => {
      dispose();
    };
  });
}

export { apply, inject };
