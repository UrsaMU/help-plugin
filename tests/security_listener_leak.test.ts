/**
 * SECURITY [M-01] — engine:ready listener accumulation on hot-reload
 *
 * Regression test: plugin.remove() MUST deregister the engine:ready handler
 * so that hot-reload cycles do not accumulate stale listeners.
 *
 * Attack vector: an admin issues @reload (or sys.reboot fires) N times.
 * Each init() stacks another anonymous handler.  On the next engine:ready
 * emission every accumulated handler fires — N filesystem rescans run
 * concurrently, creating a DoS amplification path.
 */

import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { gameHooks } from "@ursamu/ursamu";
import { plugin } from "../src/index.ts";

describe("SECURITY [M-01]: engine:ready listener accumulation", () => {
  it("[EXPLOIT] remove() does not deregister engine:ready handler — listeners accumulate", async () => {
    // Intercept on()/off() so we can track the net handler count for "engine:ready"
    // without needing access to the internal _handlers Map.
    const registrations: ((...a: unknown[]) => unknown)[] = [];

    const origOn  = gameHooks.on.bind(gameHooks);
    const origOff = gameHooks.off.bind(gameHooks);

    // deno-lint-ignore no-explicit-any
    (gameHooks as any).on = (event: string, handler: (...a: unknown[]) => unknown) => {
      if (event === "engine:ready") registrations.push(handler);
      return origOn(event as never, handler as never);
    };
    // deno-lint-ignore no-explicit-any
    (gameHooks as any).off = (event: string, handler: (...a: unknown[]) => unknown) => {
      if (event === "engine:ready") {
        const idx = registrations.indexOf(handler);
        if (idx !== -1) registrations.splice(idx, 1);
      }
      return origOff(event as never, handler as never);
    };

    try {
      await plugin.init();

      // One handler must have been registered
      assertEquals(registrations.length, 1, "init() must register exactly one engine:ready handler");

      plugin.remove();

      // [RED] This assertion FAILS before the fix:
      // remove() does not call gameHooks.off(), so registrations.length stays 1.
      assertEquals(
        registrations.length,
        0,
        "remove() MUST deregister the engine:ready handler (listener leak)",
      );
    } finally {
      // deno-lint-ignore no-explicit-any
      (gameHooks as any).on  = origOn;
      // deno-lint-ignore no-explicit-any
      (gameHooks as any).off = origOff;
      // Ensure clean state for other tests
      plugin.remove();
    }
  });
});
