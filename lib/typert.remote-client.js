// dsh-bookmarks — hand-written Typert client Remote contribution (equivalent
// of the generated ./remote artifact). The browser half imports this module
// and mounts it through ctx.remote.$mount(...); exporting it also keeps the
// descriptors available to future client-side aggregation.
import {
  bookmarkDeleteRequestSchema,
  bookmarkDeleteResultSchema,
  bookmarkListResultSchema,
  bookmarkPutRequestSchema,
  bookmarkPutResultSchema,
} from "./schemas.js";

const PACKAGE = "dsh-bookmarks";

const TYPERT_REMOTE = {
  package: PACKAGE,
  descriptors: [
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
};

export default TYPERT_REMOTE;
export { TYPERT_REMOTE };
