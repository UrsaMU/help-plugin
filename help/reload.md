+HELP/RELOAD

Clear the file provider cache and rescan all help directories.

SYNTAX
  +help/reload

DESCRIPTION
  Use after adding or editing `.md` files in `./help/` or any
  plugin's help/ folder without restarting the server.

  Only affects file-based topics. **Database entries** (**+help/set**)
  are read live and are not cached.

EXAMPLES
  +help/reload    Rescan all help directories.

SEE ALSO: help, +help/set
