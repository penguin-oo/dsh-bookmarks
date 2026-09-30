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

// dsh 0.2: every strict codec needs a create() factory (memoized, as the
// official typert artifacts do).
let bookmarkListResultSchema$value;
const bookmarkListResultSchema$create = () => (bookmarkListResultSchema$value ??= bookmarkListResultSchema);
let bookmarkPutRequestSchema$value;
const bookmarkPutRequestSchema$create = () => (bookmarkPutRequestSchema$value ??= bookmarkPutRequestSchema);
let bookmarkPutResultSchema$value;
const bookmarkPutResultSchema$create = () => (bookmarkPutResultSchema$value ??= bookmarkPutResultSchema);
let bookmarkDeleteRequestSchema$value;
const bookmarkDeleteRequestSchema$create = () => (bookmarkDeleteRequestSchema$value ??= bookmarkDeleteRequestSchema);
let bookmarkDeleteResultSchema$value;
const bookmarkDeleteResultSchema$create = () => (bookmarkDeleteResultSchema$value ??= bookmarkDeleteResultSchema);

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
        create: bookmarkListResultSchema$create,
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
            create: bookmarkPutRequestSchema$create,
          },
        },
      ],
      result: {
        mode: "strict",
        typeSymbol: `${PACKAGE}#BookmarkPutResult`,
        create: bookmarkPutResultSchema$create,
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
            create: bookmarkDeleteRequestSchema$create,
          },
        },
      ],
      result: {
        mode: "strict",
        typeSymbol: `${PACKAGE}#BookmarkDeleteResult`,
        create: bookmarkDeleteResultSchema$create,
      },
      sourceLocation: { file: "lib/index.js", line: 1, column: 1 },
    },
  ],
};

export default TYPERT_REMOTE;
export { TYPERT_REMOTE };
