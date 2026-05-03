+HELP

Overview of the help system and how to browse it.

SYNTAX
  help [<topic>]
  help/section [<name>]

DESCRIPTION
  Type help alone to see all sections. Type help <topic> to read
  a topic. Use / for sub-topics, e.g. `help theme/tokens`.

  Topics come from `.md` files, command inline help, and runtime
  entries (**+help/set**). **Database entries** take priority.
  Admins: manage topics with **+help/set** and **+help/reload**;
  customise appearance with **+help/theme**.

EXAMPLES
  help                  Show the section index.
  help mail             Look up the "mail" topic.
  help/section combat   List all topics in a section.

SEE ALSO: +help/set, +help/reload, +help/theme
