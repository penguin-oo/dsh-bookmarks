// dsh-bookmarks — host half: the `bookmarks` Remote service.
//
// A storage-domain sidecar that bookmarks finalized assistant replies across
// sessions. It inspects persisted Session history (never creates or resumes an
// Agent or Session), derives a short text snippet from the target message at
// put time, and stores one global row of items. Every mutation is serialized
// and uses per-item compare-and-set, mirroring the official
// @deepseek-ai/dsh-message-feedback contract so concurrent tabs stay coherent.
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { Service } from "@deepseek-ai/cordis";
import { deriveEventMessage, isAppendSurfaceEvent } from "@deepseek-ai/dsh-session/surface";
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { z } from "zod";

/** Single-row key: one global list of bookmarks. */
const GLOBAL_KEY = "global";
/** Immutable empty list reused only as an input to caller-owned copying. */
const EMPTY_ITEMS = Object.freeze([]);

// ── durable domain declaration ──────────────────────────────────────────────

const bookmarkItemSchema = z
  .object({
    sessionId: z.string().min(1).max(160),
    messageId: z.string().min(1).max(160),
    note: z.string().optional(),
    tags: z.array(z.string().min(1).max(32)),
    snippet: z.string().max(8192),
    version: z.string().uuid(),
    createdAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    updatedAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .refine((item) => item.updatedAt >= item.createdAt, {
    path: ["updatedAt"],
    message: "bookmarks: updatedAt must not precede createdAt",
  });

const bookmarkRowSchema = z.object({ items: z.array(bookmarkItemSchema) }).superRefine((row, ctx) => {
  const seen = new Set();
  const versions = new Set();
  row.items.forEach((item, index) => {
    const key = `${item.sessionId}\u0000${item.messageId}`;
    if (seen.has(key))
      ctx.addIssue({
        code: "custom",
        path: ["items", index, "messageId"],
        message: `bookmarks: duplicate bookmark '${key}'`,
      });
    seen.add(key);
    if (versions.has(item.version))
      ctx.addIssue({
        code: "custom",
        path: ["items", index, "version"],
        message: `bookmarks: duplicate version '${item.version}'`,
      });
    versions.add(item.version);
  });
});

const bookmarkDomainSpec = defineDomain({
  name: "bookmarks",
  version: 0,
  tables: { bookmarks: domainTable(bookmarkRowSchema) },
});

// ── small helpers ───────────────────────────────────────────────────────────

/** Copy and freeze one item before it crosses the service boundary. */
function snapshotItem(item) {
  return Object.freeze({
    sessionId: item.sessionId,
    messageId: item.messageId,
    ...(item.note === void 0 ? {} : { note: item.note }),
    tags: Object.freeze([...item.tags]),
    snippet: item.snippet,
    version: item.version,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  });
}

/** Freeze a replacement row so storage-domain never exposes mutable aliases. */
function rowSnapshot(items) {
  const copied = items.map(snapshotItem);
  Object.freeze(copied);
  return Object.freeze({ items: copied });
}

/** Build a frozen success branch. */
function success(value) {
  return Object.freeze({ ok: true, value });
}

/** Build a frozen business-failure branch. */
function rejected(error) {
  return Object.freeze({ ok: false, error: Object.freeze(error) });
}

/** Generate an opaque equality token for one material mutation. */
function nextVersion() {
  return randomUUID();
}

/** Whether two observations name the same persisted Session lifecycle. */
function sameHeaderIdentity(left, right) {
  return left.id === right.id && left.createdAt === right.createdAt && left.cwd === right.cwd;
}

/** First visible text block of a derived message, whitespace-collapsed. */
function messageText(message) {
  for (const block of message.content) if (block.type === "text" && block.text) return block.text;
  return "";
}

/** Trim one string to `max` UTF-16 code units with a trailing ellipsis. */
function truncate(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}\u2026`;
}

// ── service ─────────────────────────────────────────────────────────────────

let BookmarkService = class BookmarkService extends TypertRemoteService {
  static inject = ["storageDomain", "sessionPersistence", "sessions"];

  maxNoteBytes;
  maxSnippetChars;
  maxTags;
  table;
  operationTail = Promise.resolve();
  mutationAdmissionOpen = true;

  constructor(ctx, config) {
    super(ctx, "bookmarks");
    this.maxNoteBytes = resolvePositiveInt(config?.maxNoteBytes, 4096, "maxNoteBytes");
    this.maxSnippetChars = resolvePositiveInt(config?.maxSnippetChars, 300, "maxSnippetChars");
    this.maxTags = resolvePositiveInt(config?.maxTags, 8, "maxTags");
  }

  /** Open and own the one bookmarks domain. */
  async [Service.init]() {
    const domain = await this.ctx.storageDomain.open(bookmarkDomainSpec);
    this.ctx.effect(
      () => async () => {
        this.mutationAdmissionOpen = false;
        await this.operationTail;
        await domain.close();
      },
      "bookmarks.domainClose",
    );
    this.table = domain.table("bookmarks");
  }

  /** All bookmarks, newest first. Always succeeds once the domain is open. */
  list() {
    const stored = this.requireTable().get(GLOBAL_KEY);
    const items = stored?.items ?? EMPTY_ITEMS;
    return success(Object.freeze({ items: Object.freeze(items.map(snapshotItem)) }));
  }

  /**
   * Create or replace a bookmark for one finalized append-origin assistant
   * message. The server derives the snippet from the persisted log, so a put
   * with no note/tags still yields a useful center entry. Every request must
   * match the addressed item's current version; a matching no-op returns the
   * stored item without changing its revision.
   */
  put(request) {
    const note = this.resolveNote(request.note);
    if (!note.ok) return Promise.resolve(note);
    const tags = this.resolveTags(request.tags);
    if (!tags.ok) return Promise.resolve(tags);
    return this.enqueue(async () => {
      const known = await this.inspectSession(request.sessionId);
      if (!known.ok) return known;
      if (!this.hasBookmarkTarget(known.value, request.messageId))
        return rejected({
          code: "target-not-found",
          sessionId: request.sessionId,
          messageId: request.messageId,
        });
      const durable = await this.ensureTargetDurable(known.value);
      if (!sameHeaderIdentity(durable.meta, known.value.meta) || !this.hasBookmarkTarget(durable, request.messageId))
        return rejected({
          code: "target-not-found",
          sessionId: request.sessionId,
          messageId: request.messageId,
        });
      const table = this.requireTable();
      const stored = table.get(GLOBAL_KEY);
      const items = stored?.items ?? EMPTY_ITEMS;
      const index = items.findIndex(
        (item) => item.sessionId === request.sessionId && item.messageId === request.messageId,
      );
      const existing = items[index];
      if (request.ifVersion !== (existing?.version ?? null)) return rejected(this.versionConflict(existing ?? null));
      // Omitted fields keep the stored value; an explicit "" note clears it.
      const effectiveNote = note.value === void 0 ? existing?.note : note.value === null ? void 0 : note.value;
      const effectiveTags = tags.value === void 0 ? (existing?.tags ?? EMPTY_ITEMS) : tags.value;
      if (existing !== void 0 && existing.note === effectiveNote && sameTags(existing.tags, effectiveTags))
        return success(snapshotItem(existing));
      const now = Date.now();
      const item = snapshotItem({
        sessionId: request.sessionId,
        messageId: request.messageId,
        ...(effectiveNote === void 0 ? {} : { note: effectiveNote }),
        tags: effectiveTags,
        snippet: this.snippetOf(durable, request.messageId),
        version: nextVersion(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: existing === void 0 ? now : Math.max(now, existing.updatedAt),
      });
      const nextItems = [item, ...items.filter((_, at) => at !== index)];
      await table.put(GLOBAL_KEY, rowSnapshot(nextItems));
      return success(item);
    });
  }

  /**
   * Remove one bookmark. Absence is successful regardless of the supplied
   * version; an existing item requires an exact version match. Sessions are
   * deliberately not inspected here so bookmarks of deleted sessions stay
   * removable.
   */
  delete(request) {
    return this.enqueue(async () => {
      const table = this.requireTable();
      const stored = table.get(GLOBAL_KEY);
      const items = stored?.items ?? EMPTY_ITEMS;
      const index = items.findIndex(
        (item) => item.sessionId === request.sessionId && item.messageId === request.messageId,
      );
      const existing = items[index];
      if (existing === void 0) return success(Object.freeze({ absent: true }));
      if (request.ifVersion !== existing.version) return rejected(this.versionConflict(existing));
      await table.put(
        GLOBAL_KEY,
        rowSnapshot(items.filter((_, at) => at !== index)),
      );
      return success(Object.freeze({ absent: true }));
    });
  }

  // ── validation ────────────────────────────────────────────────────────────

  /**
   * Optional note: `undefined` keeps the stored value, `""` clears it, and
   * anything else must be non-blank text within the byte bound.
   */
  resolveNote(note) {
    if (note === void 0) return success(void 0);
    if (note === "") return success(null);
    if (note.trim().length === 0) return rejected({ code: "note-blank" });
    const actualBytes = Buffer.byteLength(note, "utf8");
    if (actualBytes > this.maxNoteBytes)
      return rejected({ code: "note-too-large", maxBytes: this.maxNoteBytes, actualBytes });
    return success(note);
  }

  /** Optional tags: `undefined` keeps the stored list; otherwise trimmed, deduplicated, bounded, capped. */
  resolveTags(tags) {
    if (tags === void 0) return success(void 0);
    if (!Array.isArray(tags)) return rejected({ code: "tags-invalid", message: "bookmarks: tags must be an array" });
    const normalized = [];
    for (const raw of tags) {
      if (typeof raw !== "string") return rejected({ code: "tags-invalid", message: "bookmarks: every tag must be a string" });
      const tag = raw.trim();
      if (tag.length === 0) return rejected({ code: "tags-invalid", message: "bookmarks: tags must not be blank" });
      if (tag.length > 32) return rejected({ code: "tags-invalid", message: `bookmarks: tag '${tag}' exceeds 32 characters` });
      if (!normalized.includes(tag)) normalized.push(tag);
    }
    if (normalized.length > this.maxTags)
      return rejected({ code: "tags-invalid", message: `bookmarks: at most ${this.maxTags} tags are allowed` });
    return success(Object.freeze(normalized));
  }

  // ── session inspection ────────────────────────────────────────────────────

  /** Resolve a live owner directly; otherwise use the storage catalog as the authority. */
  async inspectSession(sessionId) {
    if (this.ctx.sessions.get(sessionId) === void 0) {
      const snapshots = await this.ctx.sessionPersistence.listSnapshots();
      const persisted = snapshots.some((snapshot) => snapshot.header.id === sessionId);
      if (!persisted && this.ctx.sessions.get(sessionId) === void 0)
        return rejected({ code: "session-not-found", sessionId });
    }
    return success(await this.ctx.sessionPersistence.inspect(sessionId));
  }

  /** Whether the inspected log contains the finalized append-origin assistant message. */
  hasBookmarkTarget(inspection, messageId) {
    return inspection.events.some((event) => {
      if (event.type !== "assistant/message" || !isAppendSurfaceEvent(event)) return false;
      const message = deriveEventMessage(event);
      return message?.role === "assistant" && message.id === messageId;
    });
  }

  /** Put the target log prefix behind a durability barrier before its sidecar. */
  async ensureTargetDurable(inspection) {
    const live = this.ctx.sessions.get(inspection.meta.id);
    if (live !== void 0 && sameHeaderIdentity(live.header, inspection.meta)) {
      if (!(await this.ctx.sessions.flush(live)))
        throw new Error(`bookmarks: no durability listener participated for live session '${inspection.meta.id}'`);
      return await this.ctx.sessionPersistence.readFrom(inspection.meta.id, 0);
    }
    return await this.ctx.sessionPersistence.readFrom(inspection.meta.id, 0);
  }

  /** First visible text of the addressed message, trimmed to the configured bound. */
  snippetOf(inspection, messageId) {
    for (const event of inspection.events) {
      if (event.type !== "assistant/message" || !isAppendSurfaceEvent(event)) continue;
      const message = deriveEventMessage(event);
      if (message?.role === "assistant" && message.id === messageId)
        return truncate(messageText(message).replace(/\s+/g, " ").trim(), this.maxSnippetChars);
    }
    return "";
  }

  // ── mutation plumbing ─────────────────────────────────────────────────────

  /** Return the authoritative item needed to reconcile one failed comparison. */
  versionConflict(current) {
    return {
      code: "version-conflict",
      current: current === null ? null : snapshotItem(current),
    };
  }

  /** Queue a complete read/compare/write mutation behind the prior one. */
  enqueue(operation) {
    if (!this.mutationAdmissionOpen) return Promise.reject(new Error("bookmarks: service is disposing"));
    const result = this.operationTail.then(operation);
    this.operationTail = result.then(
      () => void 0,
      () => void 0,
    );
    return result;
  }

  /** Resolve the initialized durable table or fail a broken service lifecycle. */
  requireTable() {
    if (this.table === void 0) throw new Error("bookmarks: durable domain is not initialized");
    return this.table;
  }
};

function resolvePositiveInt(value, fallback, name) {
  if (value === void 0) return fallback;
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`bookmarks: ${name} must be a positive safe integer`);
  return value;
}

function sameTags(left, right) {
  return left.length === right.length && left.every((tag, index) => tag === right[index]);
}

// ── Remote markers ──────────────────────────────────────────────────────────
//
// Equivalent of @Remote("list") / @Remote("put") / @Remote("delete") without
// decorator syntax. Remote(method) returns a standard method decorator that
// records its marker through the supplied context's addInitializer; running
// the initializer against a dummy object whose prototype is
// BookmarkService.prototype writes exactly the table the real decorators would
// write, and `remoteMethods(instance)` reads it back.

for (const method of ["list", "put", "delete"]) {
  Remote(method)(void 0, {
    private: false,
    static: false,
    name: method,
    addInitializer(init) {
      init.call(Object.create(BookmarkService.prototype));
    },
  });
}

export { BookmarkService, BookmarkService as default, bookmarkDomainSpec };
