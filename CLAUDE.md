# help — UrsaMU Plugin

## Plugin identity

API-first help system for UrsaMU. **Targets ursamu `^2.3.0`.**

Beyond serving its own help topics, this plugin is the **central help host for
all other plugins**: it exposes `registerHelpDir(absPath, sectionName)` from
`./providers/file.ts`, which other plugins call in their `init()` to publish
their `help/*.md` files into the unified registry. Anything served by `help`,
`help/section`, and the REST endpoint comes through this provider chain
(database → file → command, by priority).

When working on this plugin, remember it owns its own theme/format pipeline
(`+help/theme`, `+help/theme/set`, `+help/theme/reset`) with `headerfmt`,
`dividerfmt`, `footerfmt`, `indexfmt`, and tokens — this is the equivalent
of (and richer than) ursamu's `FormatSlot` resolver pattern. Do NOT introduce
a parallel `@helpformat` slot; extend the existing theme system instead.

---

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
deno task test                   # full suite — must stay green
deno lint                        # must be clean
deno task showcase help-basic    # run the live showcase
deno task showcase --list        # list all showcases
```

## Pre-commit checklist (all must pass)

```bash
deno check --unstable-kv mod.ts                              # type check
deno lint                                                     # lint
deno test --allow-all --unstable-kv --no-check tests/        # unit tests
```

A commit is not ready if any step fails.

---

## Structure

```
src/
├── index.ts          IPlugin — init(), remove(), imports commands.ts
├── commands.ts       addCmd() registrations (module-load, NOT inside init)
├── theme.ts          Three-layer theming + MUX softcode evaluator
├── renderer.ts       renderEntry, renderIndex, renderSection
├── registry.ts       HelpRegistry + HelpProvider interface
└── providers/
    ├── command.ts    CommandProvider (priority 10)
    ├── file.ts       FileProvider (priority 50)
    └── database.ts   DbProvider (priority 100)
help/                 In-game help files served by FileProvider
showcases/            Showcase scripts for deno task showcase
tests/                Deno test files
tools/                showcase.ts runner + ursamu-shim.ts
```

---

## Import paths

```typescript
import { addCmd, DBO, gameHooks, registerPluginRoute } from "@ursamu/ursamu";
import type { IPlugin, IUrsamuSDK, IDBObj, SessionEvent } from "@ursamu/ursamu";
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

Switches:
  /switch   What this switch does.

Examples:
  +help foo    Does the thing.
  +help bar    Does the other thing.`,
  exec: async (u: IUrsamuSDK) => {
    const sw  = (u.cmd.args[0] ?? "").toLowerCase().trim();
    const arg = u.util.stripSubs(u.cmd.args[1] ?? "").trim();  // strip codes FIRST
  },
});
```

### Pattern cheat-sheet

| Intent | Pattern | args |
|--------|---------|------|
| No args | `/^inventory$/i` | — |
| One arg | `/^look\s+(.*)/i` | `[0]` |
| Switch + arg | `/^\+cmd(?:\/(\S+))?\s*(.*)/i` | `[0]`=sw, `[1]`=rest |
| Two parts (=) | `/^@name\s+(.+)=(.+)/i` | `[0]`, `[1]` |

### Catch-all switch pattern — critical gotcha

When a command uses `/^\+cmd(?:\/(\S+))?\s*(.*)/i`, any more-specific
`addCmd` registered for the same prefix is dead code — the catch-all
consumes `+cmd/anything` first. Handle sub-commands as switch branches
inside the main exec. Only use separate `addCmd` registrations when the
command roots are distinct (e.g. `+help` vs `+helpset`).

### Lock levels

| String | Who can use it |
|--------|----------------|
| `""` | Login screen (unauthenticated) |
| `"connected"` | Any logged-in player |
| `"connected builder+"` | Builder flag or higher |
| `"connected admin+"` | Admin flag or higher |
| `"connected wizard"` | Wizard only |

### Lockfunc system (ursamu v2.2+)

Lock strings support callable functions: `funcname(arg1, arg2)` combined
with `&&`, `||`, `!`, `()`. Built-ins: `flag`, `attr`, `type`, `is`,
`holds`, `perm`. Register custom lockfuncs via `registerLockFunc(name, fn)`.
Locks are fail-closed; built-in names are protected; max 4096 chars /
256 tokens.

---

## Plugin lifecycle (index.ts)

```typescript
import "./commands.ts";  // Phase 1 — addCmd() fires here, NOT in init()

const onLogin = (e: SessionEvent) => { /* named ref — required for remove() */ };

export const plugin: IPlugin = {
  name: "help",
  version: "1.1.0",
  description: "One sentence.",
  init:   () => { gameHooks.on("player:login", onLogin); return true; },
  remove: () => { gameHooks.off("player:login", onLogin); },  // same ref
};
```

Rules: `addCmd()` never inside `init()` · `init()` must return `true` · every `.on()` needs a matching `.off()` using the same named function.

**DBO namespace rule**: always prefix with `help.`:

```typescript
const records = new DBO<IRecord>("help.records");  // correct
const records = new DBO<IRecord>("records");        // wrong — collides
```

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

const isStaff = u.me.flags.has("admin") || u.me.flags.has("wizard") || u.me.flags.has("superuser");
```

## MUSH color codes

| Code | Effect | Code | Effect |
|------|--------|------|--------|
| `%ch` | Bold | `%cn` | Reset (always close with this) |
| `%cr` | Red | `%cg` | Green |
| `%cb` | Blue | `%cy` | Yellow |
| `%cw` | White | `%cc` | Cyan |
| `%r`  | Newline | `%t` | Tab |

---

## Showcase — executes real commands in-process

```bash
deno task showcase               # run first showcase
deno task showcase help-basic    # run by key
deno task showcase --list        # list all
```

**Step types:**

```json
{ "sub":    "Heading" }
{ "note":   "Narrative — not executed." }
{ "cmd":    "+help arg", "label": "optional comment", "as": "admin" }
{ "expect": "substring that must appear in the previous cmd's output" }
{ "reset":  true }
{ "emit":   "RP action text (display only)" }
```

**Template vars** (`vars` object in the JSON root): `{{player}}`, `{{anyKey}}`.

---

## Player-inline state pattern

```typescript
// Reading (always default)
const ps = (u.me.state.help ?? {}) as IHelpPlayerState;

// Writing (always spread to preserve other fields)
await u.db.modify(u.me.id, "$set", { "state.help": { ...ps, field: value } });
```

Use `state.help` for per-player state. Use `new DBO("help.collection")` for records with their own lifecycle.

---

## Test boilerplate

```typescript
const OPTS = { sanitizeResources: false, sanitizeOps: false };
Deno.test("happy path", OPTS, async () => { /* ... */ });
```

### Required test cases for every command

- Happy path — correct output and DB call
- Null target — graceful not-found message, no DB write
- Permission denied — `canEdit` false, no DB write
- DB op is `$set`/`$inc`/`$unset` (assert exact args)
- Admin guard — non-admin rejected (if admin command)
- `stripSubs` called before DB (MUSH codes stripped)

Add a `tests/security/` directory for exploit→fix tests; one file per bug found.

---

## Code style (non-negotiable)

- **Early return** over nested conditions
- **No function longer than 50 lines** — decompose
- **No file longer than 200 lines** — split
- **No bare `catch`** — always `catch (e: unknown)`
- **Library-first** — if the SDK does it, use the SDK
- **No deep nesting** — max 3 levels
- **No comments** unless the WHY is non-obvious

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
- [ ] Help file body uses subtle markdown (bold for key terms, backticks for values) — no headings, no HTML

---

## Help file format

Every `help/<name>.md` must follow this layout exactly (≤78-char width, ≤22 lines):

```
+COMMAND-NAME

One-sentence description of what **+command-name** does; use `value` for examples.

SYNTAX
  +command[/switch] <required> [<optional>]

SWITCHES
  /switch    What this switch does.

EXAMPLES
  +command foo       Does the thing.
  +command/switch x  Does the other thing.

SEE ALSO: +help related-topic
```

- Title is `+COMMAND-NAME` ALL CAPS, flush left — no decorative border lines.
- Section labels (`SYNTAX`, `SWITCHES`, `EXAMPLES`, `SEE ALSO`) are ALL CAPS, flush left.
- Body text indented 2 spaces.
- Exactly 1 blank line between sections. Max line width: 78 characters. Max content lines: 22.
- Long topics → split into subdirectory: `help/theme/formats.md`, `help/theme/tokens.md`.
  Overview file must end with `SEE ALSO:`. Sub-files must start with a back-reference.

### Markdown in body text

- `**bold**` → `%ch` — key terms, command names, important values.
- `` `backtick` `` → `%ch%cg` — inline code, slugs, paths, exact-match strings.
- Keep it subtle: one or two highlights per paragraph.
- **Do not use** `_italic_`, `### headings` (use ALL CAPS labels), HTML, or tables.

---

## PRs and commits

- No AI attribution in commit messages or code comments.
- Use squash-merge for feature PRs.
- Tag versions after squash-merge: `git tag v<version> && git push --tags`.

---

## Full API reference

`~/.claude/skills/ursamu-dev/references/api-reference.md` — every type, SDK method, event payload, and lock expression. Read it before writing any code.

Activate the full dev skill with: `/ursamu-dev`
