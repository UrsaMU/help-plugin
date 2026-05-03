/**
 * renderer.ts — converts HelpEntry content to output formats.
 *
 * Formats:
 *   "ansi"     MUSH color codes for in-game terminal display
 *   "json"     Plain object (for REST responses)
 *   "markdown" Raw markdown string (REST ?format=md)
 */

import type { HelpEntry } from "./registry.ts";
import { evalFmt, currentTheme } from "./theme.ts";

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

/** Convert markdown to MUSH ANSI color codes using theme tokens. */
function markdownToAnsi(md: string): string {
  const t = currentTheme();
  let out = md;
  out = out.replace(/^# (.+)$/gm,   `${t.tokens.h1}$1%cn`);
  out = out.replace(/^## (.+)$/gm,  `${t.tokens.h2}$1%cn`);
  out = out.replace(/^### (.+)$/gm, `${t.tokens.h3}$1%cn`);
  out = out.replace(/\*\*([^*]+)\*\*/g, `${t.tokens.bold}$1%cn`);
  out = out.replace(/\*([^*]+)\*/g,     `${t.tokens.italic}$1%cn`);
  out = out.replace(/`([^`]+)`/g,       `${t.tokens.code}$1%cn`);
  out = out.replace(/^\s*-\s+(.+)$/gm,  `  ${t.tokens.bullet} $1`);
  return out;
}

/** Indent and word-wrap body content (2-space indent, 76-char wrap). */
function formatBody(content: string): string {
  const width   = 78;
  const BODY_PAD  = "  ";
  const BODY_WRAP = width - BODY_PAD.length;
  return markdownToAnsi(content)
    .split("\n")
    .map((line) => {
      return wordWrap(line, BODY_WRAP)
        .split("\n")
        .map((l) => (l.trim() === "" ? "" : BODY_PAD + l))
        .join("\n");
    })
    .join("\n");
}

/** Render a 4-column topic/section listing. */
function renderColumns(names: string[]): string {
  const width     = 78;
  const COL_COUNT = 4;
  const COL_WIDTH = Math.floor(width / COL_COUNT); // 19
  const BODY_PAD  = "  ";
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
export async function renderEntry(entry: HelpEntry): Promise<string> {
  const BODY_PAD = "  ";
  const t = currentTheme();

  const header = await evalFmt(t.headerfmt, entry.name.toUpperCase(), "", 78);
  const footer = await evalFmt(t.footerfmt, "", "", 78);

  const body = entry.content
    ? formatBody(entry.content)
    : `${BODY_PAD}${t.tokens.hint}(No detailed help available for this topic.)%cn`;

  // Only show section divider when entry has a real section (not general/unset)
  const hasSection = entry.section && entry.section.toLowerCase() !== "general";
  const sectionLine = hasSection
    ? "\n" + await evalFmt(t.dividerfmt, entry.section.toUpperCase(), "", 78) + "\n"
    : "\n";

  return `${header}${sectionLine}\n${body}\n\n${footer}`;
}

/** Render the top-level help index. */
export async function renderIndex(_sections: string[], totalCount: number): Promise<string> {
  const t = currentTheme();
  const header = await evalFmt(t.headerfmt, "HELP", String(totalCount), 78);
  const footer = await evalFmt(t.footerfmt, "", String(totalCount), 78);
  const body   = await evalFmt(t.indexfmt,  "", String(totalCount), 78);
  return `${header}\n${body}\n\n${footer}`;
}

/** Render a section listing. */
export async function renderSection(section: string, entries: HelpEntry[]): Promise<string> {
  const BODY_PAD = "  ";
  const t = currentTheme();

  const header = await evalFmt(t.headerfmt, section.toUpperCase(), "", 78);
  const footer = await evalFmt(t.footerfmt, "", "", 78);

  if (!entries.length) {
    return `${header}\n\n${BODY_PAD}${t.tokens.hint}(No topics in this section.)%cn\n\n${footer}`;
  }

  const cols = renderColumns(entries.map((e) => e.name));
  return `${header}\n\n${cols}\n${footer}`;
}
