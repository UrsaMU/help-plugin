# @ursamu/help-plugin

API-first help system framework for UrsaMU — aggregates command inline help,
per-plugin help folders, and runtime entries into a single searchable registry
with REST and in-game access.

## Features

- **Three providers, one registry** — command `help` fields, `./help/` markdown files, and runtime DB entries all merge transparently
- **Per-plugin help folders** — each plugin ships its own `help/` directory and registers it with one call
- **Theme system** — TinyMUX-style format strings evaluated as MUX softcode, with three-layer resolution (defaults → config file → in-game DB)
- **Hidden topics** — entries/files beginning with `_` are excluded from listings but still reachable by direct lookup
- **REST API** — help and theme routes for external tooling and AI access
- **Priority-based overrides** — DB entries beat files beat command inline text
- **Admin commands** — `+help/set`, `+help/del`, `+help/reload`, `+help/theme`, `+help/theme/set`, `+help/theme/reset`
- **Hookable** — `help:lookup`, `help:miss`, `help:register` events via `gameHooks`

## Install

Add to your game's plugin manifest:

```json
{
  "plugins": [
    { "name": "help", "url": "jsr:@ursamu/help-plugin" }
  ]
}
```

## Commands

| Command | Syntax | Lock | Description |
|---------|--------|------|-------------|
| `help` | `help [<topic>]` | connected | Show index or look up a topic |
| `help/section` | `help/section [<name>]` | connected | List topics in a section |
| `+help/set` | `+help/set <topic>=<text>` | admin+ | Create or update a DB entry |
| `+help/del` | `+help/del <topic>` | admin+ | Delete a DB entry |
| `+help/reload` | `+help/reload` | admin+ | Rescan help file directories |
| `+help/theme` | `+help/theme` | admin+ | Show current theme settings and their source layer |
| `+help/theme/set` | `+help/theme/set <key>=<value>` | admin+ | Set a format string or token in-game |
| `+help/theme/reset` | `+help/theme/reset` | admin+ | Clear in-game overrides, restore config file / defaults |

## Adding help to your plugin

### Option A — ship a `help/` folder (recommended)

```
src/plugins/myplugin/
└── help/
    ├── index.md        # section landing page ("help myplugin")
    ├── send.md         # shown for "help myplugin/send"
    └── _internal.md    # hidden — reachable by "help _internal" but not listed
```

Register the folder in your plugin's `init()`:

```typescript
import { registerHelpDir } from "jsr:@ursamu/help-plugin";

export const plugin: IPlugin = {
  name: "myplugin",
  init: () => {
    registerHelpDir(
      new URL("./help", import.meta.url).pathname,
      "myplugin",
    );
    return true;
  },
};
```

### Option B — use the `help` field on `addCmd`

The `CommandProvider` reads the `help` and `category` fields from every
registered command automatically:

```typescript
addCmd({
  name: "+send",
  category: "Mail",
  help: `+send <player>=<message>  — Send a mail message.

Examples:
  +send Alice=Hello!    Send Alice a message.`,
  exec: async (u) => { /* ... */ },
});
```

### Option C — explicit registration

```typescript
import { registerHelpEntry } from "jsr:@ursamu/help-plugin";

registerHelpEntry({
  name: "myplugin/send",
  section: "myplugin",
  content: "Send a thing.",
  source: "command",
  tags: ["mail/send"],  // aliases
});
```

## Hidden topics

Any entry or file whose name begins with `_` is excluded from `all()`,
`sections()`, and all index/listing output but is still returned by direct
lookup. Use this for staff-only reference material or internal docs.

```bash
# File approach
help/_staff-notes.md   # accessible as "help _staff-notes", invisible in index

# DB approach
+help/set _internal=Staff-only procedures.
```

## REST API

### Help routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/help` | None | List all sections and topics |
| `GET` | `/api/v1/help/:topic` | None | Get a single topic |
| `GET` | `/api/v1/help/:topic?format=md` | None | Raw markdown |
| `POST` | `/api/v1/help/:topic` | Bearer (admin) | Create or update |
| `DELETE` | `/api/v1/help/:topic` | Bearer (admin) | Delete |

### Theme routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/help/theme` | None | Return the full resolved theme |
| `PATCH` | `/api/v1/help/theme` | Bearer (admin) | Update format strings or tokens |
| `DELETE` | `/api/v1/help/theme` | Bearer (admin) | Clear in-game overrides |

`PATCH` body: a flat JSON object whose keys are format-string names
(`headerfmt`, `dividerfmt`, `footerfmt`, `indexfmt`) or token names (see table
below). Unknown keys and non-string values are ignored.

```json
PATCH /api/v1/help/theme
{ "headerfmt": "[ansicenter( %qtitle%0%cn ,%2,*)]", "sep": "%cb" }
```

## Theme system

### Three-layer resolution

Layers are merged at startup and on every in-game `+help/theme/set` call.
Higher layers override lower ones; unset keys fall through.

| Priority | Layer | How to edit |
|----------|-------|-------------|
| 1 (lowest) | `DEFAULT_THEME` — hardcoded fallback | Source code |
| 2 | `config/help-theme.json` — persistent partial overlay | Edit the JSON file, then `+help/reload` |
| 3 (highest) | DB record (`help.theme`) — in-game overlay | `+help/theme/set` or `PATCH /api/v1/help/theme` |

`+help/theme/reset` (or `DELETE /api/v1/help/theme`) removes only layer 3,
restoring the result of layers 1+2.

### Format strings

Four format strings control the chrome around every help page. They are
evaluated as MUX softcode by the `@ursamu/mushcode` engine.

| Key | Default | Used for |
|-----|---------|---------|
| `headerfmt` | `%qsep[ansicenter( %qtitle%0%cn%qsep ,%2,%qsmaj)]%cn` | Top border / title bar |
| `dividerfmt` | `%qsep[ansicenter( %qsection%0%cn%qsep ,%2,%qsmin)]%cn` | Section sub-header |
| `footerfmt` | `%qsep[repeat(%qsmaj,%2)]%cn` | Bottom border |
| `indexfmt` | `[sectionlist()]%r%r%b%b%qhint Type 'help <topic>' for a topic.%cn` | Body of the help index |

Positional args available in all format strings:

| Arg | Value |
|-----|-------|
| `%0` | Title or topic name |
| `%1` | Topic count (index) or empty string (entry/section) |
| `%2` | Terminal width (default `78`) |

### Tokens and `%q*` registers

Token values are pre-loaded into named `%q*` registers before each format
string is evaluated. Use them inside your format strings to keep colors
consistent without hardcoding.

| Token | `%q*` register | Default value | Used for |
|-------|---------------|---------------|---------|
| `sep` | `%qsep` | `%cr` | Separator / border color |
| `title` | `%qtitle` | `%ch%cw` | Page title text |
| `section` | `%qsection` | `%cy` | Section name in divider |
| `hint` | `%qhint` | `%cy` | Hint / instructional text |
| `h1` | `%qh1` | `%ch%cw` | Markdown `#` heading |
| `h2` | `%qh2` | `%ch%cw` | Markdown `##` heading |
| `h3` | `%qh3` | `%ch%cw` | Markdown `###` heading |
| `bold` | `%qbold` | `%ch` | Markdown `**bold**` |
| `italic` | `%qitalic` | `%ci` | Markdown `*italic*` |
| `code` | `%qcode` | `%ch%cg` | Markdown `` `inline code` `` |
| `codeblock` | `%qcodeblock` | `%ch%cg` | Markdown fenced code block |
| `bullet` | `%qbullet` | `-` | Markdown list bullet character |
| `smaj` | `%qsmaj` | `=` | Major separator fill character |
| `smin` | `%qsmin` | `-` | Minor separator fill character |
| `ititle` | `%qititle` | `%ch%cw` | Index title text |

### Custom eval functions

These MUX functions are available inside format strings:

| Function | Signature | Description |
|----------|-----------|-------------|
| `ansicenter` | `ansicenter(str, width[, fill])` | Center `str` in `width` columns, MUSH-color-aware. Optional `fill` character (default space). |
| `sectionlist` | `sectionlist()` | Returns a newline-separated, pre-colored list of section names using the current `section` and `hint` tokens. Used in the default `indexfmt`. |
| `sections` | `sections()` | Returns a space-separated list of all section names. |
| `topics` | `topics([section])` | Returns a space-separated list of topic names. With no arg: all topics. With a section arg: topics in that section only. |

### `config/help-theme.json`

Drop a partial theme JSON file at `config/help-theme.json` in your game root
to set persistent defaults without in-game commands. Keys follow the same names
as the theme object:

```json
{
  "headerfmt": "[ansicenter( %qtitle%0%cn ,%2,*)]",
  "tokens": {
    "sep": "%cb",
    "smaj": "*"
  }
}
```

Missing keys fall through to `DEFAULT_THEME`. The file is read once at plugin
startup (`loadTheme()`). To apply edits without a server restart, run
`+help/reload` after saving the file.

### Example: custom theme

```
+help/theme/set headerfmt=[ansicenter( %qtitle%0%cn ,%2,*)]
+help/theme/set sep=%cb
+help/theme/set smaj=*
+help/theme/set indexfmt=[sectionlist()]%r%r  %qhint Type 'help <topic>' for details.%cn
```

Reset to config-file defaults:

```
+help/theme/reset
```

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `help:lookup` | `{ topic: string }` | Fires before every topic lookup |
| `help:miss` | `{ topic: string }` | Fires when no entry is found |
| `help:register` | `{ entry: HelpEntry }` | Fires when a DB entry is saved |

```typescript
import { gameHooks } from "jsr:@ursamu/ursamu";

gameHooks.on("help:miss", ({ topic }) => {
  console.log(`Player looked up unknown topic: ${topic}`);
});
```

## Provider priority

| Priority | Provider | Source |
|----------|----------|--------|
| 100 | DbProvider | `+help/set` / REST POST |
| 50 | FileProvider | `./help/` and registered dirs |
| 10 | CommandProvider | `addCmd.help` fields |

Higher number wins on topic name collision. External providers can be added via
`helpRegistry.addProvider()` at any priority.

## Storage

| Collection | Purpose |
|------------|---------|
| `help.entries` | Runtime-editable help entries (`+help/set` / REST POST) |
| `help.theme` | In-game theme overlay (`+help/theme/set` / `PATCH /api/v1/help/theme`) |

## Notes

REST routes registered in `init()` persist until server restart. There is no
`removePluginRoute` — hot-unloading the plugin will stop commands and event
listeners but the REST endpoints remain until restart.

## License

MIT
