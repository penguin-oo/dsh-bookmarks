# dsh-bookmarks

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com/) [![ci](https://github.com/penguin-oo/dsh-bookmarks/actions/workflows/ci.yml/badge.svg)](https://github.com/penguin-oo/dsh-bookmarks/actions/workflows/ci.yml)

Bookmark assistant replies in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) Web UI: bookmark any finalized assistant reply with a note and tags, browse every bookmark from every session in one center panel, and export them to Markdown in one click.

[中文说明](./README.zh.md)

## Screenshots

![Bookmark action on an assistant reply](docs/screenshot-actions.png)

![The standalone bookmark center](docs/screenshot-center.png)

## Features

- **Per-message bookmark** — an archive button on each finalized assistant reply (right next to the 👍/👎 feedback buttons), with an inline editor for a note and comma-separated tags.
- **Server-derived snippet** — the bookmark stores a text preview of the actual reply, so the center stays useful even without a note.
- **Cross-session center** — one panel listing bookmarks from all sessions and workspaces, with full-text search, tag filter, inline editing and deletion.
- **Jump back** — every entry opens its session in one click.
- **Markdown export** — one click downloads all bookmarks as `dsh-bookmarks.md`.
- **Keyboard** — `Alt+B` toggles the center from anywhere.
- **Safe writes** — per-item compare-and-set versions (multi-tab safe), server-side validation, and durable storage via the DSH storage domain.

## Install

```sh
dsh plugin --profile web add dsh-bookmarks
```

Then restart DSH (`dsh web`). The plugin appends itself to the profile bundle layer automatically; nothing else to configure.

For a local checkout:

```sh
# from the plugin repo
dsh plugin --profile web add file:./        # relative file spec, anchored to your cwd
```

## Config

The bundle row exposes three limits (all optional):

| Key | Default | Meaning |
|---|---|---|
| `maxNoteBytes` | `4096` | Max UTF-8 bytes of one note (`""` clears a note; omitting the field keeps it). |
| `maxSnippetChars` | `300` | Max characters of the server-derived reply snippet. |
| `maxTags` | `8` | Max tags per bookmark; each tag ≤ 32 chars, trimmed and deduplicated. |

Override them in the profile patch layer (`$DSH_HOME/profiles/web/cordis.patch.yml`):

```yaml
- id: bookmarks
  config:
    maxNoteBytes: 2048
    maxSnippetChars: 200
    maxTags: 5
```

## How it works

One npm package hosts both halves of the plugin:

- **Host half** (`lib/index.js`) — the `bookmarks` Remote service (Typert), backed by a storage-domain table (`$DSH_HOME/storages/bookmarks.json`). `put` inspects the persisted session log to validate the target reply and derive its snippet, mirrors the official `message-feedback` durability barrier, and serializes mutations with per-item version tokens.
- **Browser half** (`src/client`, bundled to `lib/client.js`) — mounts the Remote contribution through `ctx.remote.$mount`, then registers two UI slots: `conversation.chat.assistant-actions` (the per-message button) and `sidebar.footer.action` (the center toggle).

## Development

```sh
npm install            # zod + esbuild (dev only)
npm run build          # bundles src/client into lib/client.js
```

`lib/client.js` is committed and shipped; no build step runs on install.

## Limitations

- Bookmarks are stored in one global row: fine for personal use, not a shared multi-user store.
- The center panel jumps to the bookmarked *session*; it does not auto-scroll to the exact message yet.
- The panel toggle lives in the sidebar footer; use `Alt+B` when the sidebar is collapsed.

## License

[MIT](./LICENSE)

## Acknowledgements

This project is promoted on the [LINUX DO](https://linux.do) community.

