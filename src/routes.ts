/**
 * routes.ts — REST API for the help system.
 *
 * GET    /api/v1/help              → { sections, topics }   (no auth)
 * GET    /api/v1/help/:topic       → { entry }              (no auth, lock-gated)
 * POST   /api/v1/help/:topic       → { entry }              (admin only)
 * DELETE /api/v1/help/:topic       → 204                    (admin only)
 */

import { registerPluginRoute, dbojs } from "@ursamu/ursamu";
import { currentTheme, saveThemeOverlay, resetThemeOverlay, DEFAULT_THEME } from "./theme.ts";
import type { PartialTheme } from "./theme.ts";
import { helpRegistry, slugify } from "./registry.ts";
import { upsertEntry, deleteEntry } from "./providers/database.ts";
import { emitHelp } from "./hooks.ts";

/** Resolve whether a userId belongs to an admin or wizard. */
async function isAdmin(userId: string): Promise<boolean> {
  const actor = await dbojs.queryOne({ id: userId });
  if (!actor) return false;
  const flagSet = new Set((actor.flags as unknown as string).split(" "));
  return flagSet.has("admin") || flagSet.has("wizard") || flagSet.has("superuser");
}

/**
 * Evaluate a HelpEntry lock expression against an HTTP caller.
 *
 * Lock expressions follow the same syntax as addCmd lock strings.
 * Supported forms:
 *   undefined / ""        — no restriction, always true
 *   "connected"           — any authenticated caller (userId non-null)
 *   "connected builder+"  — builder, admin, wizard, or superuser
 *   "connected admin+"    — admin, wizard, or superuser
 *   "connected wizard"    — wizard or superuser only
 *
 * Returns false for any lock when userId is null (unauthenticated).
 * Exported for unit testing.
 */
export async function routePassesLock(
  userId: string | null,
  lock: string | undefined,
): Promise<boolean> {
  if (!lock) return true;
  if (!userId) return false;

  const actor = await dbojs.queryOne({ id: userId });
  if (!actor) return false;
  const flags = new Set((actor.flags as unknown as string).split(" "));

  const expr = lock.replace(/^connected\s*/i, "").toLowerCase().trim();
  if (!expr) return true; // bare "connected" — any authenticated user passes

  if (expr === "wizard")    return flags.has("wizard") || flags.has("superuser");
  if (expr === "admin+")    return flags.has("admin")   || flags.has("wizard") || flags.has("superuser");
  if (expr === "builder+")  return flags.has("builder") || flags.has("admin")  || flags.has("wizard") || flags.has("superuser");
  if (expr === "superuser") return flags.has("superuser");

  // Unknown expression — default deny
  return false;
}

registerPluginRoute("/api/v1/help", async (req, userId) => {
  // Route: GET /api/v1/help
  if (req.method === "GET") {
    const all     = await helpRegistry.all();
    const checks  = await Promise.all(all.map((e) => routePassesLock(userId, e.lock)));
    const topics  = all.filter((_, i) => checks[i]);
    const sections = [...new Set(topics.map((e) => e.section))].sort();
    return Response.json({ sections, topics });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
});

registerPluginRoute("/api/v1/help/:topic", async (req, userId) => {
  const url    = new URL(req.url);
  // Extract topic from path: /api/v1/help/<topic>
  const topic  = slugify(url.pathname.replace(/^\/api\/v1\/help\//, ""));

  if (!topic) {
    return Response.json({ error: "Topic is required" }, { status: 400 });
  }

  // GET — public (lock-gated)
  if (req.method === "GET") {
    const entry = await helpRegistry.lookup(topic);
    if (!entry || !(await routePassesLock(userId, entry.lock))) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    // Support raw markdown via ?format=md
    if (url.searchParams.get("format") === "md") {
      return new Response(entry.content, {
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      });
    }
    return Response.json({ entry });
  }

  // Write operations require auth
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // POST — create/update (admin only)
  if (req.method === "POST") {
    if (!(await isAdmin(userId))) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { content?: unknown; section?: unknown; tags?: unknown };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body.content !== "string" || !body.content.trim()) {
      return Response.json({ error: "content is required" }, { status: 400 });
    }

    const section = typeof body.section === "string" && body.section
      ? body.section.toLowerCase()
      : (topic.includes("/") ? topic.split("/")[0] : "general");

    const tags = Array.isArray(body.tags) && body.tags.every((t) => typeof t === "string")
      ? body.tags as string[]
      : [];

    const entry = await upsertEntry({
      name:      topic,
      section,
      content:   body.content.trim(),
      tags,
      source:    "database",
      createdBy: userId,
    });

    emitHelp("help:register", {
      entry: { name: entry.name, section: entry.section, content: entry.content, source: "database", tags: entry.tags },
    });

    return Response.json({ entry }, { status: 201 });
  }

  // DELETE (admin only)
  if (req.method === "DELETE") {
    if (!(await isAdmin(userId))) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const deleted = await deleteEntry(topic);
    if (!deleted) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
});

// ── Theme routes ──────────────────────────────────────────────────────────────

registerPluginRoute("/api/v1/help/theme", async (req, userId) => {
  // GET — public: return current theme
  if (req.method === "GET") {
    return Response.json({ theme: currentTheme() });
  }

  // Write operations require auth + admin
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin(userId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // PATCH — update one or more keys
  if (req.method === "PATCH") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const topLevelKeys = ["headerfmt", "dividerfmt", "footerfmt", "indexfmt"] as const;
    const tokenKeys = Object.keys(DEFAULT_THEME.tokens) as string[];
    const overlay: PartialTheme = {};

    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== "string") continue;
      if ((topLevelKeys as readonly string[]).includes(key)) {
        (overlay as Record<string, string>)[key] = value;
      } else if (tokenKeys.includes(key)) {
        overlay.tokens = { ...overlay.tokens, [key]: value };
      }
    }

    await saveThemeOverlay(overlay);
    return Response.json({ theme: currentTheme() });
  }

  // DELETE — clear in-game overrides, fall back to config file / defaults
  if (req.method === "DELETE") {
    await resetThemeOverlay();
    return Response.json({ theme: currentTheme() });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
});
