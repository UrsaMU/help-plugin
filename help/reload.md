# +help/reload

Clears the file provider cache and rescans all registered help directories.

## Syntax

```
+help/reload
```

## When to use

After adding or editing `.md` files in `./help/` or any plugin's `help/` folder
without restarting the server. The cache is also rebuilt automatically on the next
lookup after a reload.

## Notes

This only affects file-based topics. Database entries (`+help/set`) are
read live and are not cached.
