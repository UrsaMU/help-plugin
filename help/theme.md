+HELP/THEME

Configure help output appearance at runtime via three-layer theming.

  Layers resolve in order: **built-in defaults** → `config/help-theme.json`
  → **in-game** (highest). **+help/theme/reset** clears only in-game
  values and falls back to the config file.

SYNTAX
  +help/theme
  +help/theme/set <key>=<value>
  +help/theme/reset

SWITCHES
  (none)    Show all current settings and their source layer.
  /set      Set a format string or color token by key.
  /reset    Clear all in-game overrides.

EXAMPLES
  +help/theme
  +help/theme/set sep=%cb
  +help/theme/set indexfmt=[topiclist()]%cn
  +help/theme/reset

SEE ALSO: theme/formats, theme/tokens
