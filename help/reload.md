+HELP/RELOAD

Clear the file-provider cache and rescan all help directories.

  Use **+help/reload** after adding or editing `.md` files in any
  plugin's `help/` folder without restarting the server. Only
  affects file-based topics — **database entries** (**+help/set**)
  are read live and are never cached.

SYNTAX
  +help/reload

EXAMPLES
  +help/reload    Rescan all help directories.

SEE ALSO: help, +help/set
