export interface RegisteredDir {
  path: string;
  section: string;
}

export const _registeredDirs: RegisteredDir[] = [];

/**
 * Register one or more directories to be scanned for text/help files.
 * Duplicate (path + section) pairs are silently ignored.
 * Call bustCache() (from file.ts) after this if you need immediate effect.
 *
 * @param paths   One path or an array of absolute paths
 * @param section Section label applied to all entries found in these dirs
 */
export function registerTextDir(paths: string | string[], section: string): void {
  const list = Array.isArray(paths) ? paths : [paths];
  for (const path of list) {
    const isDupe = _registeredDirs.some(d => d.path === path && d.section === section);
    if (!isDupe) _registeredDirs.push({ path, section });
  }
}
