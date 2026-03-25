# @ursamu/help-plugin

API-first help system framework for UrsaMU — aggregates command inline help,
per-plugin help folders, and runtime entries into a single searchable registry
with REST and in-game access.

## Features

- **Three providers, one registry** — command `help?` fields, `./help/` markdown files, and runtime DB entries all merge transparently
- **Per-plugin help folders** — each plugin ships its own `help/` directory and registers it with one call
- **REST API** — `GET /api/v1/help` and `GET /api/v1/help/:topic` for external tooling and AI access
- **Priority-based overrides** — DB entries beat files beat command inline text
- **Admin commands** — `+help/set`, `+help/del`, `+help/reload` for live editing
- **hookable** — `help:lookup`, `help:miss`, `help:register` events via `gameHooks`

## Prerequisites

Requires the engine PR that exports `cmds` from `mod.ts`:

```typescript
// mod.ts — add cmds to the existing export line
export { addCmd, registerScript, cmds } from "./src/services/commands/cmdParser.ts";
```

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

## Adding help to your plugin

### Option A — ship a `help/` folder (recommended for documentation)

```
src/plugins/myplugin/
└── help/
    ├── index.md        # section landing page (shown for "help myplugin")
    ├── send.md         # shown for "help myplugin/send"
    └── receive.md
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

### Option B — use the `help?` field on `addCmd`

The `CommandProvider` reads the `help` and `category` fields from every
registered command automatically. No extra calls needed — just fill in the
fields:

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

## REST API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/help` | None | List all sections and topics |
| `GET` | `/api/v1/help/:topic` | None | Get a single topic |
| `GET` | `/api/v1/help/:topic?format=md` | None | Raw markdown |
| `POST` | `/api/v1/help/:topic` | Bearer (admin) | Create or update |
| `DELETE` | `/api/v1/help/:topic` | Bearer (admin) | Delete |

### Example response

```json
GET /api/v1/help/mail/send

{
  "entry": {
    "name": "mail/send",
    "section": "mail",
    "content": "Send a mail message...",
    "source": "file",
    "tags": []
  }
}
```

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `help:lookup` | `{ topic: string }` | Fires before every lookup |
| `help:miss` | `{ topic: string }` | Fires when no entry is found |
| `help:register` | `{ entry: HelpEntry }` | Fires when a DB entry is saved |

```typescript
import { gameHooks } from "@ursamu/ursamu";

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

Higher number wins on topic name collision.

## Storage

| Collection | Schema | Purpose |
|------------|--------|---------|
| `help.entries` | `{ id, name, section, content, tags, source, createdBy, updatedAt }` | Runtime-editable help entries |

## REST Routes

REST routes registered in `init()` persist until server restart. There is no
`removePluginRoute` — a hot-unload will stop the commands and event listeners
but the REST endpoints remain until restart.

## License

MIT
