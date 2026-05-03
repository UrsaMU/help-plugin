+HELP/SET

Create, update, or delete a runtime help entry stored in the database.

  **Database entries** have the highest priority and override file-based
  or command-inline help for the same topic name. The `<topic>` argument
  is a lowercase slug; use `/` for sub-topics (`combat/dodge`). Slugs
  beginning with `_` are hidden from index listings but reachable by
  direct lookup (e.g. `help _staff-notes`).

SYNTAX
  +help/set <topic>=<text>
  +help/del <topic>

EXAMPLES
  +help/set house-rules=No griefing.
  +help/set combat/dodge=Dodge reduces incoming damage by 50%.
  +help/del house-rules

SEE ALSO: help, +help/reload
