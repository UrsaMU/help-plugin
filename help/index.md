+HELP

Browse the help system — type **+help** alone to see all sections, or
**+help `<topic>`** to read a specific topic.

  Topics come from `.md` files, command inline help, and runtime
  entries (**+help/set**). **Database entries** always win on collision.
  Use `/` for sub-topics: `help theme/tokens`. Slugs beginning with
  `_` are hidden from the index but reachable by direct lookup.

SYNTAX
  help [<topic>]
  help/section [<name>]

EXAMPLES
  help                  Show the section index.
  help mail             Look up the `mail` topic.
  help/section combat   List all topics in a section.

SEE ALSO: +help/set, +help/reload, +help/theme
