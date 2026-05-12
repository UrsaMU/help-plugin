// Showcase shim for @ursamu/ursamu.
// Re-exports the real package but overrides addCmd to collect registrations
// in a local `cmds` array the showcase dispatcher can iterate.
// deno-lint-ignore-file no-explicit-any

export * from "@ursamu/ursamu";

export const cmds: any[] = [];

import { addCmd as _engine } from "@ursamu/ursamu";

export function addCmd(cmd: any): void {
  cmds.push(cmd);
  _engine(cmd);
}
