/**
 * theme.ts — runtime theming for the help plugin.
 *
 * Three-layer resolution (lowest → highest priority):
 *   1. DEFAULT_THEME  — hardcoded fallback
 *   2. config/help-theme.json — admin edits this file; partial overrides
 *   3. DB record (help.theme)  — set in-game via +help/theme/set
 *
 * Format string positional args:
 *   %0 = title/name   %1 = count   %2 = width (default 78)
 *
 * Named registers pre-loaded from theme.tokens:
 *   %qsep, %qtitle, %qsection, %qhint, %qh1–%qh3,
 *   %qbold, %qitalic, %qcode, %qcodeblock, %qbullet,
 *   %qsmaj, %qsmin, %qititle
 */

import { EvalEngine, makeContext, registerStdlib } from "@ursamu/mushcode";
import { DBO } from "@ursamu/ursamu";
import { fromFileUrl } from "@std/path";
import { helpRegistry } from "./registry.ts";

// ── Engine ───────────────────────────────────────────────────────────────────

const engine = new EvalEngine({
  getAttr:       () => Promise.resolve(null),
  resolveTarget: () => Promise.resolve(null),
  getName:       () => Promise.resolve(""),
  hasFlag:       () => Promise.resolve(false),
});
registerStdlib(engine);

function visLen(str: string): number {
  return str
    // deno-lint-ignore no-control-regex
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/%c[xXrRgGbBcCmMyYwWhHuUiIfFnN]/gi, "")
    .replace(/%c\{[^}]*\}/g, "")
    .replace(/%[rnthiub]/gi, "")
    .length;
}

engine.registerFunction("ansicenter", {
  minArgs: 2,
  maxArgs: 3,
  exec(args: unknown[]) {
    const str  = String(args[0] ?? "");
    const w    = parseInt(String(args[1] ?? "78"), 10);
    const fill = String(args[2] ?? " ").charAt(0) || " ";
    const vis  = visLen(str);
    const pad  = Math.max(0, w - vis);
    const left = Math.floor(pad / 2);
    return fill.repeat(left) + str + fill.repeat(pad - left);
  },
});

// sections() — returns space-separated list of all section names.
engine.registerFunction("sections", {
  minArgs: 0,
  maxArgs: 0,
  async exec() {
    const names = await helpRegistry.sections();
    return names.join(" ");
  },
});

// topics([section]) — returns space-separated list of topic names.
// With no arg: all topics. With a section arg: only that section.
engine.registerFunction("topics", {
  minArgs: 0,
  maxArgs: 1,
  async exec(args: unknown[]) {
    const section = args[0] ? String(args[0]).trim() : "";
    if (section) {
      const entries = await helpRegistry.inSection(section);
      return entries.map((e) => e.name).join(" ");
    }
    const all = await helpRegistry.all();
    return all.map((e) => e.name).join(" ");
  },
});

// sectionlist() — returns a newline-separated, pre-colored list of section names.
engine.registerFunction("sectionlist", {
  minArgs: 0,
  maxArgs: 0,
  async exec() {
    const names = await helpRegistry.sections();
    const t = currentTheme();
    if (!names.length) return `  ${t.tokens.hint}(No sections available.)%cn`;
    return names.map((n) => `  ${t.tokens.section}${n}%cn`).join("\n");
  },
});

// topiclist() — TinyMUX-style index: each section as a bold header with its
// topics listed in 4-column rows beneath it.
engine.registerFunction("topiclist", {
  minArgs: 0,
  maxArgs: 0,
  async exec() {
    const sections = await helpRegistry.sections();
    const t = currentTheme();
    if (!sections.length) return `  ${t.tokens.hint}(No topics available.)%cn`;

    const COL_W = 18;
    const COLS  = 4;
    const lines: string[] = [];

    for (const section of sections) {
      if (lines.length) lines.push("");
      lines.push(`  ${t.tokens.section}${t.tokens.bold}${section.toUpperCase()}%cn`);
      const entries = await helpRegistry.inSection(section);
      const names   = entries.map((e) => e.name);
      for (let i = 0; i < names.length; i += COLS) {
        const row = names.slice(i, i + COLS);
        const cols = row.map((n) => n.padEnd(COL_W)).join("").trimEnd();
        lines.push(`    ${cols}`);
      }
    }

    return lines.join("\n");
  },
});

// ── Types ────────────────────────────────────────────────────────────────────

export interface HelpTheme {
  headerfmt:  string;
  dividerfmt: string;
  footerfmt:  string;
  indexfmt:   string;
  tokens: {
    sep:       string;
    title:     string;
    section:   string;
    hint:      string;
    h1:        string;
    h2:        string;
    h3:        string;
    bold:      string;
    italic:    string;
    code:      string;
    codeblock: string;
    bullet:    string;
    smaj:      string;
    smin:      string;
    ititle:    string;
  };
}

// Partial version for JSON config and DB overlay — tokens can be partial too.
export type PartialTheme = Partial<Omit<HelpTheme, "tokens">> & {
  tokens?: Partial<HelpTheme["tokens"]>;
};

interface ThemeRecord {
  id:      string;
  overlay: PartialTheme;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_THEME: HelpTheme = {
  headerfmt:  "%qsep[ansicenter( %qtitle%0%cn%qsep ,%2,%qsmaj)]%cn",
  dividerfmt: "%qsep[ansicenter( %qsection%0%cn%qsep ,%2,%qsmin)]%cn",
  footerfmt:  "%qsep[repeat(%qsmaj,%2)]%cn",
  indexfmt:   "[topiclist()]%r%r  %qhint Type 'help <topic>' for more information.%cn",
  tokens: {
    sep:       "%cr",
    title:     "%ch%cw",
    section:   "%cy",
    hint:      "%cy",
    h1:        "%ch%cw",
    h2:        "%ch%cw",
    h3:        "%ch%cw",
    bold:      "%ch",
    italic:    "%ci",
    code:      "%ch%cg",
    codeblock: "%ch%cg",
    bullet:    "-",
    smaj:      "=",
    smin:      "-",
    ititle:    "%ch%cw",
  },
};

// ── Merge ─────────────────────────────────────────────────────────────────────

function mergeTheme(base: HelpTheme, overlay: PartialTheme): HelpTheme {
  return {
    headerfmt:  overlay.headerfmt  ?? base.headerfmt,
    dividerfmt: overlay.dividerfmt ?? base.dividerfmt,
    footerfmt:  overlay.footerfmt  ?? base.footerfmt,
    indexfmt:   overlay.indexfmt   ?? base.indexfmt,
    tokens: { ...base.tokens, ...overlay.tokens },
  };
}

// ── Config file ───────────────────────────────────────────────────────────────

const CONFIG_PATH = fromFileUrl(new URL("../../config/help-theme.json", import.meta.url));

async function readJsonConfig(): Promise<PartialTheme> {
  try {
    const raw = await Deno.readTextFile(CONFIG_PATH);
    return JSON.parse(raw) as PartialTheme;
  } catch {
    return {};
  }
}

// ── Persistence ───────────────────────────────────────────────────────────────

const themeDb = new DBO<ThemeRecord>("help.theme");
const THEME_ID = "singleton";

// Resolved theme — the three layers merged.
let _theme: HelpTheme = structuredClone(DEFAULT_THEME);
// JSON config layer, cached after loadTheme().
let _configTheme: HelpTheme = structuredClone(DEFAULT_THEME);

export function currentTheme(): HelpTheme {
  return _theme;
}

/** The JSON-config-merged theme (DEFAULT + config file). In-game overrides sit on top. */
export function configTheme(): HelpTheme {
  return _configTheme;
}

export async function loadTheme(): Promise<void> {
  const jsonOverlay = await readJsonConfig();
  _configTheme = mergeTheme(DEFAULT_THEME, jsonOverlay);

  const rows = await themeDb.find({ id: THEME_ID });
  _theme = rows.length > 0
    ? mergeTheme(_configTheme, rows[0].overlay)
    : structuredClone(_configTheme);
}

/**
 * Save an in-game overlay. Only the provided partial is persisted —
 * the JSON config and defaults remain independent.
 */
export async function saveThemeOverlay(overlay: PartialTheme): Promise<void> {
  const rows = await themeDb.find({ id: THEME_ID });
  const existing = rows.length > 0 ? rows[0].overlay : {};
  const merged: PartialTheme = {
    ...existing,
    ...overlay,
    tokens: { ...existing.tokens, ...overlay.tokens },
  };

  if (rows.length > 0) {
    await themeDb.update({ id: THEME_ID }, { id: THEME_ID, overlay: merged });
  } else {
    await themeDb.create({ id: THEME_ID, overlay: merged });
  }

  _theme = mergeTheme(_configTheme, merged);
}

/** Clear only the in-game DB overlay. Falls back to JSON config + defaults. */
export async function resetThemeOverlay(): Promise<void> {
  await themeDb.delete({ id: THEME_ID });
  _theme = structuredClone(_configTheme);
}

// ── Evaluator ─────────────────────────────────────────────────────────────────

export async function evalFmt(
  fmt: string,
  title: string,
  count: string | number = "",
  width: string | number = 78,
): Promise<string> {
  const t = currentTheme();
  const registers = new Map<string, string>([
    ["sep",       t.tokens.sep],
    ["title",     t.tokens.title],
    ["section",   t.tokens.section],
    ["hint",      t.tokens.hint],
    ["h1",        t.tokens.h1],
    ["h2",        t.tokens.h2],
    ["h3",        t.tokens.h3],
    ["bold",      t.tokens.bold],
    ["italic",    t.tokens.italic],
    ["code",      t.tokens.code],
    ["codeblock", t.tokens.codeblock],
    ["bullet",    t.tokens.bullet],
    ["smaj",      t.tokens.smaj],
    ["smin",      t.tokens.smin],
    ["ititle",    t.tokens.ititle],
  ]);

  const ctx = makeContext({
    enactor:  "#0",
    executor: "#0",
    args:     [title, String(count), String(width)],
    registers,
  });

  return await engine.evalString(fmt, ctx);
}
