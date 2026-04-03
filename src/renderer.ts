/**
 * renderer.ts — converts HelpEntry content to output formats.
 *
 * Formats:
 *   "ansi"     MUSH color codes for in-game terminal display (MUX plushelp style)
 *   "json"     Plain object (for REST responses)
 *   "markdown" Raw markdown string (REST ?format=md)
 */

import type { HelpEntry } from "./registry.ts";

// ── Constants ───────────────────────────────────────────────────────────────

const WIDTH     = 78;
const COL_COUNT = 4;
const COL_WIDTH = Math.floor(WIDTH / COL_COUNT); // 19
const BODY_PAD  = "  "; // 2-space MUX-style indent
const BODY_WRAP = WIDTH - BODY_PAD.length;       // 76

// Subtle cyan separator, matches MUX plushelp aesthetic
const SEP = "%ch%cb" + "-".repeat(WIDTH) + "%cn";

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripColors(text: string): string {
  return text.replace(/%(ch|cn|c[rgbcmyw]|b[rgbcmyw]|[rnthiub])/gi, "");
}

function padRight(text: string, width: number): string {
  const visible = stripColors(text).length;
  return text + " ".repeat(Math.max(1, width - visible));
}

function wordWrap(text: string, width: number): string {
  return text
    .split("\n")
    .map((line) => {
      if (stripColors(line).length <= width) return line;
      const words = line.split(" ");
      let current = "";
      const result: string[] = [];
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (stripColors(candidate).length <= width) {
          current = candidate;
        } else {
          if (current) result.push(current);
          current = word;
        }
      }
      if (current) result.push(current);
      return result.join("\n");
    })
    .join("\n");
}

/** Convert markdown to MUSH ANSI color codes. */
function markdownToAnsi(md: string): string {
  let out = md;
  // Headers — bold white, then back to plain
  out = out.replace(/^# (.+)$/gm,   "%ch%cw$1%cn");
  out = out.replace(/^## (.+)$/gm,  "%ch%cw$1%cn");
  out = out.replace(/^### (.+)$/gm, "%ch%cw$1%cn");
  // Bold / italic
  out = out.replace(/\*\*([^*]+)\*\*/g, "%ch$1%cn");
  out = out.replace(/\*([^*]+)\*/g,     "%ci$1%cn");
  // Inline code
  out = out.replace(/`([^`]+)`/g, "%ch%cg$1%cn");
  // Lists — MUX uses plain bullet
  out = out.replace(/^\s*-\s+(.+)$/gm, "  - $1");
  return out;
}

/** Indent and word-wrap body content MUX-style (2-space indent, 76-char wrap). */
function formatBody(content: string): string {
  const converted = markdownToAnsi(content);
  return converted
    .split("\n")
    .map((line) => {
      const wrapped = wordWrap(line, BODY_WRAP);
      return wrapped
        .split("\n")
        .map((l) => (l.trim() === "" ? "" : BODY_PAD + l))
        .join("\n");
    })
    .join("\n");
}

/** Render a 4-column topic/section listing. */
function renderColumns(names: string[]): string {
  if (!names.length) return "";
  let out = "";
  for (let i = 0; i < names.length; i += COL_COUNT) {
    const row = names.slice(i, i + COL_COUNT);
    out += BODY_PAD + row.map((n) => padRight(n.toUpperCase(), COL_WIDTH)).join("") + "\n";
  }
  return out;
}

// ── Public render functions ──────────────────────────────────────────────────

/** Render a single topic entry for in-game display. */
export function renderEntry(entry: HelpEntry): string {
  const title = `%ch%cw${entry.name.toUpperCase()}%cn`;

  const body = entry.content
    ? formatBody(entry.content)
    : `${BODY_PAD}%cy(No detailed help available for this topic.)%cn`;

  return `${SEP}\n${title}\n\n${body}\n${SEP}`;
}

/** Render the top-level help index (lists sections). */
export function renderIndex(sections: string[], totalCount: number): string {
  const title = `%ch%cwHelp System%cn  %cy(${totalCount} topic${totalCount === 1 ? "" : "s"})%cn`;

  const cols = renderColumns(sections);

  const hint =
    `${BODY_PAD}%cyType '%ch%cwhelp <topic>%cn%cy' to look up a topic.%cn\n` +
    `${BODY_PAD}%cyType '%ch%cwhelp/section <name>%cn%cy' to list topics in a section.%cn`;

  return `${SEP}\n${title}\n\n${cols}\n${hint}\n${SEP}`;
}

/** Render a section listing. */
export function renderSection(section: string, entries: HelpEntry[]): string {
  const title = `%ch%cwSection: ${section.toUpperCase()}%cn`;

  if (!entries.length) {
    return `${SEP}\n${title}\n\n${BODY_PAD}%cy(No topics in this section.)%cn\n${SEP}`;
  }

  const cols = renderColumns(entries.map((e) => e.name));

  return `${SEP}\n${title}\n\n${cols}${SEP}`;
}
