// dsh-bookmarks — hand-written Typert host manifest (equivalent of the
// generated ./typert artifact). Consumed by @deepseek-ai/dsh-typert-loader,
// which validates the shape at load time.
import {
  bookmarkDeleteRequestSchema,
  bookmarkDeleteResultSchema,
  bookmarkListResultSchema,
  bookmarkPutRequestSchema,
  bookmarkPutResultSchema,
} from "./schemas.js";

const PACKAGE = "dsh-bookmarks";

export const TYPERT = {
  package: PACKAGE,
  face: "host",
  schemas: [],
  invocations: [
    {
      id: `${PACKAGE}#bookmarks/list`,
      service: "bookmarks",
      namespace: "bookmarks",
      method: "list",
      invocation: { kind: "direct" },
      parameters: [],
      result: {
        mode: "strict",
        typeSymbol: `${PACKAGE}#BookmarkListResult`,
        schema: bookmarkListResultSchema,
      },
      sourceLocation: { file: "lib/index.js", line: 1, column: 1 },
    },
    {
      id: `${PACKAGE}#bookmarks/put`,
      service: "bookmarks",
      namespace: "bookmarks",
      method: "put",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "request",
          wire: "request",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: `${PACKAGE}#BookmarkPutRequest`,
            schema: bookmarkPutRequestSchema,
          },
        },
      ],
      result: {
        mode: "strict",
        typeSymbol: `${PACKAGE}#BookmarkPutResult`,
        schema: bookmarkPutResultSchema,
      },
      sourceLocation: { file: "lib/index.js", line: 1, column: 1 },
    },
    {
      id: `${PACKAGE}#bookmarks/delete`,
      service: "bookmarks",
      namespace: "bookmarks",
      method: "delete",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "request",
          wire: "request",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: `${PACKAGE}#BookmarkDeleteRequest`,
            schema: bookmarkDeleteRequestSchema,
          },
        },
      ],
      result: {
        mode: "strict",
        typeSymbol: `${PACKAGE}#BookmarkDeleteResult`,
        schema: bookmarkDeleteResultSchema,
      },
      sourceLocation: { file: "lib/index.js", line: 1, column: 1 },
    },
  ],
  model: {
    services: [
      {
        key: "bookmarks",
        exportName: "BookmarkService",
        tags: [],
        description:
          "Storage-domain sidecar service for bookmarking finalized assistant replies across sessions. It inspects persisted Session history and never creates or resumes an Agent or Session.",
        summary: "Cross-session reply bookmark store.",
        jsDoc: "/**\n * Storage-domain sidecar service for reply bookmarks.\n */",
        members: [
          {
            kind: "method",
            name: "list",
            signature: "@Remote('list') list(): BookmarkListResult",
          },
          {
            kind: "method",
            name: "put",
            signature: "@Remote('put') put(request: BookmarkPutRequest): Promise<BookmarkPutResult>",
          },
          {
            kind: "method",
            name: "delete",
            signature: "@Remote('delete') delete(request: BookmarkDeleteRequest): Promise<BookmarkDeleteResult>",
          },
        ],
        types: [],
      },
    ],
    events: [],
    objects: [],
  },
};
