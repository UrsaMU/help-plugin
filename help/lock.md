HELP LOCK

Control who can read a help topic with an access **lock**.

SYNTAX
  +help/lock <topic>=<lock>
  +help/lock <topic>=

SWITCHES
  (none)

EXAMPLES
  +help/lock staff-notes=connected admin+
  +help/lock op-guide=connected wizard
  +help/lock house-rules=connected builder+
  +help/lock staff-notes=

NOTES
  Locks use the same expressions as command locks. Players who fail
  the lock see "No help available" — the topic does not appear in
  listings or section views. Only **database** entries can be locked
  in-game; lock file-based topics via frontmatter in the `.md` file.

  Clear a lock by leaving the right-hand side empty.

SEE ALSO: help set, help del
