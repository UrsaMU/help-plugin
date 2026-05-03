import { describe, it, beforeEach } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import {
  currentTheme,
  configTheme,
  saveThemeOverlay,
  resetThemeOverlay,
  DEFAULT_THEME,
  evalFmt,
} from "../src/theme.ts";

describe({ name: "theme", sanitizeResources: false, sanitizeOps: false }, () => {
  beforeEach(async () => {
    await resetThemeOverlay();
  });

  it("currentTheme() matches DEFAULT_THEME when no overrides", () => {
    const t = currentTheme();
    assertEquals(t.headerfmt,   DEFAULT_THEME.headerfmt);
    assertEquals(t.dividerfmt,  DEFAULT_THEME.dividerfmt);
    assertEquals(t.footerfmt,   DEFAULT_THEME.footerfmt);
    assertEquals(t.tokens.smaj, "=");
    assertEquals(t.tokens.smin, "-");
  });

  it("saveThemeOverlay() applies a partial token override", async () => {
    await saveThemeOverlay({ tokens: { smaj: "*" } });
    assertEquals(currentTheme().tokens.smaj, "*");
    // Other tokens unaffected
    assertEquals(currentTheme().tokens.smin, DEFAULT_THEME.tokens.smin);
  });

  it("saveThemeOverlay() applies a top-level format override", async () => {
    await saveThemeOverlay({ footerfmt: "---" });
    assertEquals(currentTheme().footerfmt, "---");
    assertEquals(currentTheme().headerfmt, DEFAULT_THEME.headerfmt);
  });

  it("saveThemeOverlay() merges successive calls", async () => {
    await saveThemeOverlay({ tokens: { smaj: "!" } });
    await saveThemeOverlay({ tokens: { smin: "." } });
    assertEquals(currentTheme().tokens.smaj, "!");
    assertEquals(currentTheme().tokens.smin, ".");
  });

  it("resetThemeOverlay() clears DB layer, restores configTheme", async () => {
    await saveThemeOverlay({ tokens: { smaj: "!" } });
    await resetThemeOverlay();
    assertEquals(currentTheme().tokens.smaj, configTheme().tokens.smaj);
  });

  it("evalFmt() evaluates a simple static string", async () => {
    assertEquals(await evalFmt("hello %0", "world"), "hello world");
  });

  it("evalFmt() injects %2 as width", async () => {
    assertEquals(await evalFmt("%2", "", "", 78), "78");
  });

  it("evalFmt() pre-loads %qsmaj from theme", async () => {
    assertEquals(await evalFmt("%qsmaj", ""), currentTheme().tokens.smaj);
  });

  it("evalFmt() evaluates repeat() with overridden token", async () => {
    await saveThemeOverlay({ tokens: { smaj: "-" } });
    assertEquals(await evalFmt("[repeat(%qsmaj,%2)]", "", "", 4), "----");
  });
});
