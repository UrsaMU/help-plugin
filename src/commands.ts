/**
 * commands.ts — in-game help commands.
 *
 * Registered commands:
 *   help [<topic>]             connected  — browse or look up a topic
 *   help/section [<name>]      connected  — list topics in a section
 *   +help/set <topic>=<text>   admin+     — create/update a DB help entry
 *   +help/del <topic>          admin+     — delete a DB help entry
 *   +help/reload               admin+     — bust file provider cache
 */

import { addCmd } from "@ursamu/ursamu";
import type { IUrsamuSDK } from "@ursamu/ursamu";
import { emitHelp } from "./hooks.ts";
import { helpRegistry, slugify } from "./registry.ts";
import { upsertEntry, deleteEntry } from "./providers/database.ts";
import { bustCache } from "./providers/file.ts";
import {
  renderEntry,
  renderIndex,
  renderSection,
} from "./renderer.ts";
import { currentTheme, configTheme, saveThemeOverlay, resetThemeOverlay, DEFAULT_THEME } from "./theme.ts";
import type { HelpTheme } from "./theme.ts";

// ── help ────────────────────────────────────────────────────────────────────

addCmd({
  name: "help",
  pattern: /^help(?:\/(section))?\s*(.*)/i,
  lock: "connected",
  category: "General",
  help: `help [<topic>]           — Show help for a topic.
help/section [<name>]    — List all topics in a section.

Examples:
  help              Show the top-level section index.
  help mail         Show help for the "mail" topic or section.
  help mail/send    Show help for the sub-topic "mail/send".
  help/section mail List all topics in the "mail" section.`,
  exec: async (u: IUrsamuSDK) => {
    const sw    = (u.cmd.args[0] ?? "").toLowerCase().trim();
    const raw   = u.util.stripSubs(u.cmd.args[1] ?? "").trim();
    const topic = slugify(raw);

    if (sw === "section") {
      await showSection(u, topic);
      return;
    }

    if (!topic) {
      await showIndex(u);
      return;
    }

    await showTopic(u, topic);
  },
});

async function showIndex(u: IUrsamuSDK): Promise<void> {
  const sections = await helpRegistry.sections();
  const all      = await helpRegistry.all();
  u.send(await renderIndex(sections, all.length));
}

async function showSection(u: IUrsamuSDK, section: string): Promise<void> {
  if (!section) {
    await showIndex(u);
    return;
  }
  const entries = await helpRegistry.inSection(section);
  u.send(await renderSection(section, entries));
}

async function showTopic(u: IUrsamuSDK, topic: string): Promise<void> {
  emitHelp("help:lookup", { topic });

  const entry = await helpRegistry.lookup(topic);

  if (!entry) {
    // Check if topic matches a section name
    const sections = await helpRegistry.sections();
    if (sections.includes(topic)) {
      await showSection(u, topic);
      return;
    }
    emitHelp("help:miss", { topic });
    u.send(`No help available for '%ch${topic}%cn'.`);
    return;
  }

  u.send(await renderEntry(entry));
}

// ── +help/set ────────────────────────────────────────────────────────────────

addCmd({
  name: "+help/set",
  pattern: /^\+help\/set\s+(.+)=([\s\S]*)/i,
  lock: "connected admin+",
  category: "Admin",
  help: `+help/set <topic>=<text>  — Create or update a runtime help entry.

  <topic>  Lowercase slug. Use "/" for sub-topics, e.g. "mail/send".
  <text>   Markdown content. Supports headers, bold, lists, inline code.
  Topics starting with _ are hidden from listings but still lookup-able.

Examples:
  +help/set house-rules=# House Rules\\nNo griefing.
  +help/set combat/dodge=Dodge reduces incoming damage by 50%.
  +help/set _internal=Staff-only notes.`,
  exec: async (u: IUrsamuSDK) => {
    const rawTopic = u.util.stripSubs(u.cmd.args[0]).trim();
    const content  = u.util.stripSubs(u.cmd.args[1]).trim();

    if (!rawTopic) {
      u.send("Usage: +help/set <topic>=<text>");
      return;
    }

    const topic   = slugify(rawTopic);
    const section = topic.includes("/") ? topic.split("/")[0] : "general";

    const entry = await upsertEntry({
      name:      topic,
      section,
      content,
      tags:      [],
      source:    "database",
      createdBy: u.me.id,
    });

    emitHelp("help:register", {
      entry: { name: entry.name, section: entry.section, content: entry.content, source: "database", tags: entry.tags },
    });

    u.send(`%chHelp entry '%cn${topic}%ch' saved.%cn`);
  },
});

// ── +help/del ────────────────────────────────────────────────────────────────

addCmd({
  name: "+help/del",
  pattern: /^\+help\/del\s+(.*)/i,
  lock: "connected admin+",
  category: "Admin",
  help: `+help/del <topic>  — Delete a runtime help entry (database entries only).

Examples:
  +help/del house-rules     Remove the "house-rules" DB entry.
  +help/del combat/dodge    Remove the "combat/dodge" DB entry.`,
  exec: async (u: IUrsamuSDK) => {
    const rawTopic = u.util.stripSubs(u.cmd.args[0]).trim();

    if (!rawTopic) {
      u.send("Usage: +help/del <topic>");
      return;
    }

    const deleted = await deleteEntry(rawTopic);
    if (!deleted) {
      u.send(`No database entry found for '%ch${slugify(rawTopic)}%cn'.`);
      return;
    }

    u.send(`%chHelp entry '%cn${slugify(rawTopic)}%ch' deleted.%cn`);
  },
});

// ── +help/reload ──────────────────────────────────────────────────────────────

addCmd({
  name: "+help/reload",
  pattern: /^\+help\/reload$/i,
  lock: "connected admin+",
  category: "Admin",
  help: `+help/reload  — Clear the file provider cache and rescan all help directories.

Use this after adding or editing .md files in ./help/ or any registered
plugin help directory without restarting the server.

Examples:
  +help/reload    Rescan all help directories.`,
  exec: (u: IUrsamuSDK) => {
    bustCache();
    u.send("%chHelp file cache cleared. Topics will be rescanned on next lookup.%cn");
  },
});

// ── +help/theme ───────────────────────────────────────────────────────────────

addCmd({
  name: "+help/theme",
  pattern: /^\+help\/theme$/i,
  lock: "connected admin+",
  category: "Admin",
  help: `+help/theme  — Show the current help theme settings.

Examples:
  +help/theme    Display current headerfmt, dividerfmt, footerfmt, and tokens.`,
  exec: (u: IUrsamuSDK) => {
    const resolved = currentTheme();
    const cfgBase  = configTheme();

    // Mark each value with its source layer.
    function src(resolvedVal: string, cfgVal: string, defaultVal: string): string {
      if (resolvedVal !== cfgVal)    return "%cy[game]%cn";
      if (resolvedVal !== defaultVal) return "%cg[config]%cn";
      return "%cw[default]%cn";
    }

    const fmtKeys = ["headerfmt", "dividerfmt", "footerfmt", "indexfmt"] as const;
    const lines = [
      "%ch%cwHelp Theme  %cy[game]%cn=%cy in-game override  %cg[config]%cn=%cgconfig file%cn",
      ...fmtKeys.map((k) =>
        `  %ch%cw${k}:%cn ${resolved[k]}  ${src(resolved[k], cfgBase[k], DEFAULT_THEME[k])}`
      ),
      "%ch%cwTokens:%cn",
      ...Object.entries(resolved.tokens).map(([k, v]) =>
        `  %ch%cw${k}:%cn ${v}  ${src(v, cfgBase.tokens[k as keyof HelpTheme["tokens"]], DEFAULT_THEME.tokens[k as keyof HelpTheme["tokens"]])}`
      ),
    ];
    u.send(lines.join("%r"));
  },
});

// ── +help/theme/set ───────────────────────────────────────────────────────────

addCmd({
  name: "+help/theme/set",
  pattern: /^\+help\/theme\/set\s+(\S+)=([\s\S]*)/i,
  lock: "connected admin+",
  category: "Admin",
  help: `+help/theme/set <key>=<value>  — Set a theme format string or token.

  Keys: headerfmt, dividerfmt, footerfmt, indexfmt, or a token name
        (sep, title, section, hint, h1, h2, h3, bold, italic,
         code, codeblock, bullet, smaj, smin, ititle)

  Format strings may contain any MUX softcode, e.g.:
    [ansicenter( %qtitle%0%cn ,78,=)]
    [repeat(%qsmaj,%2)]

Examples:
  +help/theme/set headerfmt=[ansicenter( %qtitle%0%cn ,%2,*)]
  +help/theme/set smaj=-
  +help/theme/set sep=%cb`,
  exec: async (u: IUrsamuSDK) => {
    const key   = u.util.stripSubs(u.cmd.args[0]).trim().toLowerCase();
    const value = u.cmd.args[1] ?? "";

    const topLevelKeys = ["headerfmt", "dividerfmt", "footerfmt", "indexfmt"] as const;
    const tokenKeys = Object.keys(DEFAULT_THEME.tokens) as (keyof HelpTheme["tokens"])[];

    if ((topLevelKeys as readonly string[]).includes(key)) {
      await saveThemeOverlay({ [key]: value });
      u.send(`%chTheme '%cn${key}%ch' updated.%cn`);
      return;
    }

    if (tokenKeys.includes(key as keyof HelpTheme["tokens"])) {
      await saveThemeOverlay({ tokens: { [key]: value } });
      u.send(`%chToken '%cn${key}%ch' updated.%cn`);
      return;
    }

    u.send(`%crUnknown theme key '%cn${key}%cr'. Use +help/theme to see valid keys.%cn`);
  },
});

// ── +help/theme/reset ─────────────────────────────────────────────────────────

addCmd({
  name: "+help/theme/reset",
  pattern: /^\+help\/theme\/reset$/i,
  lock: "connected admin+",
  category: "Admin",
  help: `+help/theme/reset  — Clear in-game theme overrides, restoring the config file or built-in defaults.

Examples:
  +help/theme/reset    Remove all in-game overrides.`,
  exec: async (u: IUrsamuSDK) => {
    await resetThemeOverlay();
    u.send("%chIn-game theme overrides cleared. Restored to config file / defaults.%cn");
  },
});
