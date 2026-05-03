import { assertEquals } from "jsr:@std/assert";
import { describe, it, beforeEach } from "jsr:@std/testing/bdd";
import { _registeredDirs, registerTextDir } from "../src/providers/textdir.ts";
import { registerHelpDir, bustCache } from "../src/providers/file.ts";

const OPTS = { sanitizeResources: false, sanitizeOps: false };

describe("registerTextDir", () => {
  beforeEach(() => {
    _registeredDirs.length = 0;
    bustCache();
  });

  it("registers a single path", () => {
    registerTextDir("/some/path", "myplugin");
    assertEquals(_registeredDirs.length, 1);
    assertEquals(_registeredDirs[0], { path: "/some/path", section: "myplugin" });
  });

  it("registers an array of paths", () => {
    registerTextDir(["/path/a", "/path/b"], "news");
    assertEquals(_registeredDirs.length, 2);
    assertEquals(_registeredDirs[0].path, "/path/a");
    assertEquals(_registeredDirs[1].path, "/path/b");
  });

  it("deduplicates exact (path + section) pairs", () => {
    registerTextDir("/path/a", "news");
    registerTextDir("/path/a", "news");
    assertEquals(_registeredDirs.length, 1);
  });

  it("allows same path under different sections", () => {
    registerTextDir("/path/a", "news");
    registerTextDir("/path/a", "motd");
    assertEquals(_registeredDirs.length, 2);
  });

  it("deduplicates across array call and individual call", () => {
    registerTextDir(["/x", "/y"], "sec");
    registerTextDir("/x", "sec");
    assertEquals(_registeredDirs.length, 2);
  });
});

describe("registerHelpDir shim", () => {
  beforeEach(() => {
    _registeredDirs.length = 0;
    bustCache();
  });

  it("adds one entry via the shim", () => {
    registerHelpDir("/help/path", "myplugin");
    assertEquals(_registeredDirs.length, 1);
    assertEquals(_registeredDirs[0], { path: "/help/path", section: "myplugin" });
  });

  it("shim deduplicates on repeated calls", () => {
    registerHelpDir("/help/path", "myplugin");
    registerHelpDir("/help/path", "myplugin");
    assertEquals(_registeredDirs.length, 1);
  });

  it("shim and registerTextDir share the same registry", () => {
    registerHelpDir("/help/path", "myplugin");
    registerTextDir(["/other/path"], "myplugin");
    assertEquals(_registeredDirs.length, 2);
  });
});
