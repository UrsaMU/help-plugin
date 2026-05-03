# help — UrsaMU Plugin

## Setup (do this first)

```bash
npx @lhi/ursamu-dev         # install the dev skill
ursamu-dev --install-hooks  # block commits that fail the audit
```

Activate in Claude Code: `/ursamu-dev`

The skill enforces a six-stage pipeline (Design → Generate → Audit → Refine → Test → Docs)
and knows every import path, SDK method, lock level, and security pattern.
Use it for every feature — no exceptions.

---

## Commands

```bash
deno task test                       # full suite — must stay green
deno lint                            # must be clean
deno task showcase --list            # list this plugin's showcases
deno task showcase help-basic     # render the basic showcase
ursamu-audit --fix                   # auto-fix common violations
ursamu-audit --watch                 # live violation feedback on save
```

---

## Structure

```
help/
├── index.ts               IPlugin — init(), remove(), imports commands.ts
├── commands.ts            addCmd() registrations (module-load, NOT inside init)
├── tests/plugin.test.ts   Deno unit tests
├── showcases/help.json demo steps  →  deno task showcase help-basic
├── deno.json              tasks: test, showcase
└── ursamu.plugin.json     package manifest
```

---

## Import paths

```typescript
import { addCmd, DBO, gameHooks, registerPluginRoute } from "jsr:@ursamu/ursamu";
import type { IPlugin, IUrsamuSDK, IDBObj, SessionEvent } from "jsr:@ursamu/ursamu";
```

---

## addCmd skeleton

```typescript
addCmd({
  name: "+help",
  pattern: /^\+help(?:\/(\S+))?\s*(.*)/i,  // args[0]=switch, args[1]=rest
  lock: "connected",
  category: "General",
  help: `+help[/switch] <arg>  — Description.

Examples:
  +help foo    Does the thing.
  +help bar    Does the other thing.`,
  exec: async (u: IUrsamuSDK) => {
    const sw  = (u.cmd.args[0] ?? "").toLowerCase().trim();
    const arg = u.util.stripSubs(u.cmd.args[1] ?? "").trim();  // strip codes FIRST
  },
});
```

---

## Plugin lifecycle (index.ts)

```typescript
import "./commands.ts";  // Phase 1 — addCmd() fires here, NOT in init()

const onLogin = (e: SessionEvent) => { /* named ref — required for remove() */ };

export const plugin: IPlugin = {
  name: "help",
  version: "1.0.0",
  description: "One sentence.",
  init:   () => { gameHooks.on("player:login", onLogin); return true; },
  remove: () => { gameHooks.off("player:login", onLogin); },  // same ref
};
```

Rules: `addCmd()` never inside `init()` · `init()` must return `true` · every `.on()` needs a matching `.off()` using the same named function.

---

## Key SDK calls

```typescript
const target = await u.util.target(u.me, arg, true);  // true = global search
if (!target) { u.send("Not found."); return; }

if (!(await u.canEdit(u.me, target))) { u.send("Permission denied."); return; }

await u.db.modify(target.id, "$set",  { "data.field": value });
await u.db.modify(target.id, "$inc",  { "data.score": 1 });
await u.db.modify(target.id, "$unset",{ "data.tmp": "" });

u.send("Message.", target.id);  // optional second arg = recipient socket id
```

---

## Showcase — executes real commands in-process

```bash
deno task showcase               # interactive menu
deno task showcase help-basic # run one showcase by key
deno task showcase --list        # list all available showcases
```

The showcase runner in `tools/showcase.ts` is **not a documentation renderer** — it
imports `commands.ts`, matches `cmd` steps against the real registered commands, and
calls `cmd.exec(u)` against an in-memory mock SDK. The output you see is the actual
output from your handlers.

**How `cmd` steps execute:**
1. Runner calls `import("../commands.ts")` — your `addCmd()` calls fire.
2. Each step's `cmd` string is matched against the live `cmds` registry (same regex as the engine).
3. A mock SDK is built: `send()` collects messages, `db.modify()` writes to an in-memory store and mirrors updates back onto the player object immediately so subsequent commands see fresh state.
4. `cmd.exec(u)` is called. Output is rendered with MUSH→ANSI color conversion.

**`reset` clears the in-memory DBO store** between scenarios. Use it before each independent scenario so state from the previous one doesn't bleed in.

**Step types:**

```json
{ "sub":    "Heading" }
{ "note":   "Narrative — not executed." }
{ "cmd":    "+help arg", "label": "optional comment", "as": "admin" }
{ "expect": "substring that must appear in the previous cmd's output" }
{ "reset":  true }
{ "emit":   "RP action text (display only — not executed)" }
```

**Template vars** (`vars` object in the JSON root): `{{player}}`, `{{anyKey}}` — interpolated into every `cmd` and `note` string before execution.

**Writing good showcases:**
- Write showcases *before* finalizing command syntax — if a step is awkward to write, the command is awkward to use.
- Cover the full happy path of each user-facing flow, not just individual commands.
- Use `reset` between independent scenarios; share state within a single narrative flow.
- Add `"as": "admin"` on steps that test admin-only commands.

**Expanding the mock SDK:**
The `buildMockSDK()` function in `tools/showcase.ts` stubs `util.target`, `canEdit`, etc. with sensible defaults. If a command needs a specific target to resolve, add it to the `target` stub in that file. The store in `buildMockDb()` handles `$set`, `$inc`, and `$unset` with dot-path notation and mirrors changes onto the live player object.

---

## Player-inline state pattern

```typescript
// Reading (always default)
const ps = (u.me.state.help ?? {}) as IHelpPlayerState;

// Writing (always spread to preserve other fields)
await u.db.modify(u.me.id, "$set", { "state.help": { ...ps, field: value } });
```

Use `state.help` for per-player condition (chargen stage, HP, active status).
Use `new DBO("help.collection")` for records with their own lifecycle (markets, jobs, combat rounds).

---

## Test boilerplate

```typescript
const OPTS = { sanitizeResources: false, sanitizeOps: false };

Deno.test("happy path", OPTS, async () => { /* ... */ });
// Required: happy path · null target · perm denied · correct DB op ($set/$inc/$unset) · admin guard · stripSubs
```

Write pure engine/ function tests first — they need no mocks and catch the most regressions.
Add a `tests/security/` directory for exploit→fix tests; one file per bug found.

---

## Audit checklist

- [ ] `u.util.stripSubs()` on all user strings before DB ops or length checks
- [ ] `await u.canEdit()` before modifying any object not owned by `u.me`
- [ ] DB writes use `"$set"` / `"$inc"` / `"$unset"` — never raw overwrite
- [ ] `u.util.target()` null-checked before use
- [ ] All `%c*` color codes closed with `%cn`
- [ ] `gameHooks.on()` in `init()` paired with matching `gameHooks.off()` in `remove()` (same ref)
- [ ] DBO collection prefixed: `"help.<collection>"`
- [ ] REST route returns 401 before any work when `userId` is null
- [ ] `init()` returns `true`
- [ ] Every `addCmd` has `help:` with syntax line + examples
- [ ] Every help file ≤ 22 content lines
- [ ] Every help file line ≤ 78 characters
- [ ] Multi-page topics linked with `SEE ALSO:`
- [ ] Sub-files open with a back-reference to the parent topic
- [ ] Help file body uses subtle markdown (bold for key terms, backticks for
  values) — no headings, no HTML

---

## Help file format

Every `help/<name>.md` must follow this layout exactly (≤78-char width, ≤22 lines):

```
+COMMAND-NAME

One-sentence description of what **+command-name** does; use `value` for
an example value.

SYNTAX
  +command[/switch] <required> [<optional>]

SWITCHES
  /switch    What this switch does.

EXAMPLES
  +command foo       Does the thing.
  +command/switch x  Does the other thing.

SEE ALSO: +help related-topic
```

Rules:
- Title is `+COMMAND-NAME` in ALL CAPS, flush left — no decorative border lines.
- Section labels (`SYNTAX`, `SWITCHES`, `EXAMPLES`, `SEE ALSO`) are ALL CAPS, flush left.
- Body text indented 2 spaces.
- Max line width: 78 characters. Max content lines: 22.
- Long topics → split into subdirectory: `help/help/syntax.md`, `help/help/examples.md`.
  The overview file must end with `SEE ALSO:`. Sub-files must start with a back-reference.

### Markdown in body text

Help files are processed by the MUSH markdown renderer, which maps common
markdown to MUSH color codes before display. Use formatting sparingly so the
terminal output stays readable.

- Use `**bold**` for key terms, command names, and important values — renders
  as `%ch` (bright) in terminal.
- Use `` `backticks` `` for inline code, file paths, and exact-match values —
  renders as `%ch%cg` (bright green) in terminal.
- Keep formatting subtle — one or two highlights per paragraph, not walls of
  bold.
- Avoid `_italic_` — terminal rendering is subtle and often lost.
- Avoid `### headings` inside body text — use ALL CAPS section labels
  (`SYNTAX`, `EXAMPLES`, etc.) instead.
- No HTML, no tables inside help files.

---

## Full API reference

`~/.claude/skills/ursamu-dev/references/api-reference.md` — every type, SDK method, event payload, and lock expression. Read it before writing any code.

Activate the full dev skill with: `/ursamu-dev`
