# +help/set

Create or update a runtime help entry stored in the database.

## Syntax

```
+help/set <topic>=<text>
```

- `topic` — lowercase slug. Use `/` for sub-topics (e.g. `combat/dodge`).
- `text` — markdown content. Supports `# headers`, **bold**, *italic*, lists, and `code`.

## Notes

Database entries have the highest priority. They override file-based and
command-inline help for the same topic name.

## Examples

```
+help/set house-rules=# House Rules\nNo griefing.
+help/set combat/dodge=Dodge reduces incoming damage by 50%.
```
