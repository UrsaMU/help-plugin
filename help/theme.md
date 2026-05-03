+HELP/THEME

Configure help output appearance at runtime.

SYNTAX
  +help/theme
  +help/theme/set <key>=<value>
  +help/theme/reset

DESCRIPTION
  Layers: **built-in defaults** < `config/help-theme.json` < **in-game**.
  reset clears only in-game values; falls back to config file.

  +help/theme         Show all settings and their source layer.
  +help/theme/set     Set a format string or color token.
  +help/theme/reset   Clear in-game overrides.

EXAMPLES
  +help/theme/set indexfmt=%qsep%0%cn
  +help/theme/set sep=%cb
  +help/theme/reset

SEE ALSO: theme/formats, theme/tokens
