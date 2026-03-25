# Help System

The help system aggregates topics from three sources:

- **Commands** — inline help declared in `addCmd()` registrations
- **Files** — markdown files in `./help/` and per-plugin `help/` folders
- **Database** — runtime entries created with `+help/set`

## Browsing

Type `help` to see all sections. Type `help <topic>` for a specific topic.
Use `/` to navigate sub-topics: `help mail/send`.

## Sections

Topics are grouped into sections. `help/section <name>` lists everything in a section.

## For Admins

- `+help/set` — add or update a help entry at runtime
- `+help/del` — remove a runtime entry
- `+help/reload` — rescan help files without restarting
