/**
 * src/index.ts — IPlugin bootstrap for the help system.
 *
 * Phase 1 (module load): imports commands.ts — all addCmd() calls run immediately.
 * Phase 2 (init):        registers providers, wires REST routes, primes file cache.
 * Phase 3 (remove):      removes providers from the registry.
 */

import "./commands.ts";
import "./hooks.ts";
import "./routes.ts";
import type { IPlugin } from "@ursamu/ursamu";
import { gameHooks } from "@ursamu/ursamu";
import { helpRegistry } from "./registry.ts";
import { CommandProvider } from "./providers/command.ts";
import { FileProvider, registerHelpDir, bustCache } from "./providers/file.ts";
import { DbProvider } from "./providers/database.ts";
import { fromFileUrl } from "jsr:@std/path";

const commandProvider = new CommandProvider();
const fileProvider    = new FileProvider();
const dbProvider      = new DbProvider();

// Named reference so remove() can deregister it and prevent listener accumulation
// across hot-reload cycles (gameHooks.on() deduplicates by reference — anonymous
// arrows create a new ref each call and cannot be deduplicated or removed).
async function _onEngineReady(): Promise<void> {
  bustCache();
  await fileProvider.all();
}

export const plugin: IPlugin = {
  name:        "help",
  version:     "1.0.0",
  description: "API-first help system — aggregates command inline help, per-plugin help folders, and runtime entries.",

  init: async () => {
    // Register this plugin's own help/ directory
    registerHelpDir(
      fromFileUrl(new URL("../help", import.meta.url)),
      "help",
    );

    helpRegistry.addProvider(dbProvider);
    helpRegistry.addProvider(fileProvider);
    helpRegistry.addProvider(commandProvider);

    // Prime the file cache eagerly so the first lookup is fast
    await fileProvider.all();

    // Re-scan once the engine finishes loading all plugins, picking up any
    // help directories that other plugins registered in their own init().
    // Uses a named function so remove() can deregister it cleanly.
    gameHooks.on("engine:ready", _onEngineReady);

    return true;
  },

  remove: () => {
    helpRegistry.removeProvider(dbProvider);
    helpRegistry.removeProvider(fileProvider);
    helpRegistry.removeProvider(commandProvider);
    gameHooks.off("engine:ready", _onEngineReady);
  },
};

export default plugin;
