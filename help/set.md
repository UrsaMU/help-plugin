+HELP/SET

Create or update a runtime help entry stored in the database.

SYNTAX
  +help/set <topic>=<text>
  +help/del <topic>

DESCRIPTION
  topic  Lowercase slug. Use / for sub-topics: `combat/dodge`.
  text   Markdown content. Supports headers, bold, lists, code.

  **Database entries** have the highest priority and override
  file-based or command-inline help for the same topic name.
  Slugs beginning with `_` are hidden from index listings but
  remain accessible by direct lookup (e.g. `help _staff-notes`).

EXAMPLES
  +help/set house-rules=No griefing.
  +help/set combat/dodge=Dodge reduces incoming damage by 50%.
  +help/del house-rules

SEE ALSO: help, +help/reload
