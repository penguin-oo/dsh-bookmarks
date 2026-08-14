// CI-friendly host smoke test: module import, Remote markers, Typert manifest
// validation, and the Remote contribution descriptors.
import { remoteMethods } from "@deepseek-ai/dsh-typert-protocol";
import { validateTypertManifest } from "@deepseek-ai/dsh-typert-loader";
import { BookmarkService } from "../lib/index.js";
import { TYPERT } from "../lib/typert.host.js";
import { TYPERT_REMOTE } from "../lib/typert.remote-client.js";

const dummy = Object.create(BookmarkService.prototype);
const methods = remoteMethods(dummy).map((m) => `${m.method}/${m.invocation.kind}`);
const expected = ["list/direct", "put/direct", "delete/direct"];
if (methods.join(",") !== expected.join(",")) {
  throw new Error(`bookmarks: Remote markers mismatch — got [${methods.join(", ")}]`);
}
validateTypertManifest("dsh-bookmarks", TYPERT);
if (TYPERT_REMOTE.descriptors.length !== 3) {
  throw new Error(`bookmarks: expected 3 Remote descriptors, got ${TYPERT_REMOTE.descriptors.length}`);
}
console.log("smoke: OK —", methods.join(", "));
