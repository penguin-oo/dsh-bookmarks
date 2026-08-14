// dsh-bookmarks — shared zod wire schemas.
//
// Single source of truth for the wire vocabulary: the host service validates
// requests and returns results against these schemas, the Typert host manifest
// advertises them to the gateway, and the browser Remote contribution (bundled
// into lib/client.js) parses wire values with them. Do not hand-edit one
// consumer without the others.
import { z } from "zod";

/** One durable bookmark item as stored and returned. */
export const bookmarkItemSchema = z
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

/** Wire request for creating or replacing one bookmark. */
export const bookmarkPutRequestSchema = z.object({
  sessionId: z.string().min(1).max(160),
  messageId: z.string().min(1).max(160),
  note: z.string().optional(),
  tags: z.array(z.string()).optional(),
  ifVersion: z.union([z.null(), z.string()]),
});

/** Wire request for removing one bookmark. */
export const bookmarkDeleteRequestSchema = z.object({
  sessionId: z.string().min(1).max(160),
  messageId: z.string().min(1).max(160),
  ifVersion: z.string(),
});

/** Success payload of `bookmarks/list`. */
export const bookmarkListValueSchema = z.object({
  items: z.array(bookmarkItemSchema),
});

/** Success payload of `bookmarks/put`. */
export const bookmarkPutValueSchema = bookmarkItemSchema;

/** Success payload of `bookmarks/delete`. */
export const bookmarkDeleteValueSchema = z.object({
  absent: z.literal(true),
});

/** Precise failure branches so the gateway codec never strips payload fields. */
const versionConflictSchema = z.object({
  code: z.literal("version-conflict"),
  current: z.union([z.null(), bookmarkItemSchema]),
});
const sessionNotFoundSchema = z.object({
  code: z.literal("session-not-found"),
  sessionId: z.string(),
});
const targetNotFoundSchema = z.object({
  code: z.literal("target-not-found"),
  sessionId: z.string(),
  messageId: z.string(),
});
const noteBlankSchema = z.object({ code: z.literal("note-blank") });
const noteTooLargeSchema = z.object({
  code: z.literal("note-too-large"),
  maxBytes: z.number(),
  actualBytes: z.number(),
});
const tagsInvalidSchema = z.object({
  code: z.literal("tags-invalid"),
  message: z.string(),
});
/** Carrier/infrastructure failure; must stay the last union branch. */
const internalFailureSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

const success = (value) => z.object({ ok: z.literal(true), value });
const failureOf = (...branches) =>
  z.object({
    ok: z.literal(false),
    error: z.union([...branches, internalFailureSchema]),
  });

export const bookmarkListResultSchema = z.union([
  success(bookmarkListValueSchema),
  failureOf(),
]);
export const bookmarkPutResultSchema = z.union([
  success(bookmarkPutValueSchema),
  failureOf(
    versionConflictSchema,
    sessionNotFoundSchema,
    targetNotFoundSchema,
    noteBlankSchema,
    noteTooLargeSchema,
    tagsInvalidSchema,
  ),
]);
export const bookmarkDeleteResultSchema = z.union([
  success(bookmarkDeleteValueSchema),
  failureOf(versionConflictSchema),
]);
