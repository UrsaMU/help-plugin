#!/usr/bin/env -S deno run -A --unstable-kv
// Showcase runner — executes help-plugin commands in-process against real providers.
// Usage: deno task showcase [key] [--list]
import { parse }       from "@std/flags";
import { expandGlob }  from "@std/fs";
import { join }        from "@std/path";

// ── Types ─────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type IDBObj = { id: string; name?: string; flags: Set<string>; state: Record<string, any>; contents: unknown[]; [k: string]: unknown };
// deno-lint-ignore no-explicit-any
type IUrsamuSDK = any;
interface ShowcaseStep { sub?: string; note?: string; reset?: boolean; emit?: string; expect?: string; cmd?: string; as?: string; label?: string }
interface ShowcaseFile { key: string; label: string; vars?: Record<string, string>; steps: ShowcaseStep[] }

// ── ANSI / MUSH ───────────────────────────────────────────────────────────────

const RESET = "\x1b[0m", BOLD = "\x1b[1m", DIM = "\x1b[2m";
const MUSH: Record<string, string> = {
  "%ch": BOLD, "%cn": RESET,
  "%cr": "\x1b[31m", "%cg": "\x1b[32m", "%cb": "\x1b[34m",
  "%cy": "\x1b[33m", "%cw": "\x1b[37m", "%cc": "\x1b[36m",
  "%r": "\n", "%t": "\t",
};
const mush = (s: string) => s.replace(/%c[a-z]|%[rtnb]/g, (m) => MUSH[m] ?? "");
const itrp = (s: string, v: Record<string, string>) =>
  s.replace(/{{(\w+)}}/g, (_, k) => v[k] ?? "{{" + k + "}}");

// ── Mock SDK ──────────────────────────────────────────────────────────────────

function buildMockPlayer(name: string, flags: string[] = []): IDBObj {
  return {
    id: "mock-" + name.toLowerCase().replace(/\s+/g, "-"),
    name,
    flags: new Set(["connected", ...flags]),
    state: {},
    contents: [],
  };
}

function buildMockSDK(player: IDBObj, cmdName: string, args: (string | undefined)[], output: string[]): IUrsamuSDK {
  return {
    me: player,
    cmd: { name: cmdName, original: "", args: args as string[] },
    here: { id: "mock-room", name: "Room", flags: new Set(), state: {}, contents: [], broadcast: () => {} },
    send(msg: string) { output.push(msg); },
    broadcast: () => {},
    util: {
      // deno-lint-ignore no-control-regex
      stripSubs: (s: string) => s.replace(/\x1b\[[^m]*m/g, "").replace(/%c[a-z]/gi, ""),
      center: (s: string, len: number, fill = " ") => {
        const plain = s.replace(/%c[a-z]/gi, "").replace(/%[rtnb]/gi, "");
        const pad = Math.max(0, len - plain.length);
        return fill.repeat(Math.floor(pad / 2)) + s + fill.repeat(pad - Math.floor(pad / 2));
      },
      target: (_actor: IDBObj, query: string) =>
        Promise.resolve(query.toLowerCase() === "admin" ? buildMockPlayer("Admin", ["admin"]) : undefined),
      displayName: (o: IDBObj) => o.name ?? o.id,
      ljust: (s: string, w: number) => s.padEnd(w),
      rjust: (s: string, w: number) => s.padStart(w),
    },
    canEdit: () => Promise.resolve(true),
  } as unknown as IUrsamuSDK;
}

// ── Bootstrap — providers + commands ─────────────────────────────────────────
// Registers FileProvider (pointing at ./help/) and DbProvider on the shared
// helpRegistry singleton before commands are imported, so `help` commands have
// real content to query against.

let _loaded = false;
async function ensureLoaded() {
  if (_loaded) return;
  _loaded = true;

  const { helpRegistry }                  = await import("../src/registry.ts");
  const { FileProvider, registerHelpDir } = await import("../src/providers/file.ts");
  const { DbProvider }                    = await import("../src/providers/database.ts");

  registerHelpDir(new URL("../help", import.meta.url).pathname, "general");
  helpRegistry.addProvider(new FileProvider());
  helpRegistry.addProvider(new DbProvider());

  await import("../src/commands.ts");
}

async function execCmd(raw: string, player: IDBObj): Promise<string[]> {
  await ensureLoaded();
  const { cmds } = await import("@ursamu/ursamu");
  const output: string[] = [];
  for (const cmd of cmds) {
    const m = raw.trim().match(cmd.pattern);
    if (!m) continue;
    const u = buildMockSDK(player, cmd.name, m.slice(1), output);
    try { await cmd.exec(u); } catch (e) { output.push("%ch%cr>> exec error: " + (e as Error).message + "%cn"); }
    return output;
  }
  output.push("%cw>> no command matched: " + raw + "%cn");
  return output;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

async function renderStep(step: ShowcaseStep, vars: Record<string, string>, player: IDBObj, admin: IDBObj): Promise<void> {
  if (step.sub    != null) { console.log("\n" + DIM + "── " + step.sub + " " + "─".repeat(Math.max(0, 66 - step.sub.length)) + RESET); return; }
  if (step.note   != null) { console.log("  " + DIM + itrp(step.note, vars) + RESET); return; }
  if (step.reset)          { console.log("  " + DIM + "[state reset]" + RESET); return; }
  if (step.emit   != null) { console.log("  " + BOLD + "emit " + RESET + mush(itrp(step.emit, vars)) + (step.label ? "  " + DIM + "# " + step.label + RESET : "")); return; }
  if (step.expect != null) { console.log("  " + DIM + "expect → " + step.expect + RESET); return; }
  if (step.cmd    != null) {
    const raw    = itrp(step.cmd, vars);
    const actor  = step.as === "admin" ? admin : player;
    const roleNt = step.as ? "  " + DIM + "[as: " + step.as + "]" + RESET : "";
    const lbl    = step.label ? "  " + DIM + "# " + step.label + RESET : "";
    // Only show first line of multiline cmds in the prompt echo
    console.log("  " + BOLD + "> " + raw.split("\n")[0] + (raw.includes("\n") ? " …" : "") + RESET + roleNt + lbl);
    const lines = await execCmd(raw, actor);
    for (const line of lines) for (const r of mush(line).split("\n")) console.log(r.trim() ? "     " + r : "");
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parse(Deno.args, { boolean: ["list", "help"], alias: { h: "help", l: "list" } });
  if (args.help) { console.log("Usage: deno task showcase [key] [--list]\n  --list  List all showcases\n  --help  Show help"); return; }

  const files: ShowcaseFile[] = [];
  for await (const e of expandGlob(join(Deno.cwd(), "showcases", "*.json"))) {
    try { files.push(JSON.parse(await Deno.readTextFile(e.path)) as ShowcaseFile); } catch { /* skip */ }
  }
  if (files.length === 0) { console.log("No showcase files found in showcases/"); return; }

  if (args.list) {
    console.log("\nAvailable showcases:\n");
    for (const f of files) console.log("  " + BOLD + f.key + RESET + "  " + DIM + f.label + RESET);
    return;
  }

  const key    = args._[0]?.toString();
  const chosen = key ? files.find((f) => f.key === key) : files[0];
  if (!chosen) { console.error("Showcase '" + (key ?? "") + "' not found. Run --list to see keys."); return; }

  const player = buildMockPlayer(chosen.vars?.player ?? "Showcase Player");
  const admin  = buildMockPlayer("Admin", ["admin", "wizard"]);
  const vars   = chosen.vars ?? {};

  console.log("\n" + BOLD + "═".repeat(70) + RESET);
  console.log(BOLD + "  " + chosen.label + RESET);
  console.log(BOLD + "═".repeat(70) + RESET);
  for (const step of chosen.steps) await renderStep(step, vars, player, admin);
  console.log("\n" + DIM + "─".repeat(70) + RESET + "\n");
}

await main();
Deno.exit(0);
