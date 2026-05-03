+THEME/FORMATS

**Format strings** are MUX softcode evaluated before display.
SEE ALSO: **+help/theme**, `theme/tokens`

FORMATS
  `headerfmt`   Top of every topic or section page.
  `dividerfmt`  Separator above a section name inside a topic.
  `footerfmt`   Bottom of every topic or section page.
  `indexfmt`    Body of the help index (between header and footer).

FUNCTIONS
  `topiclist()`         TinyMUX-style: bold section headers, topics in columns.
  `sectionlist()`       Newline-separated list of section names only.
  `sections()`          Space-separated section names.
  `topics([section])`   Topic names, optionally filtered by section.

POSITIONAL ARGS
  `%0` topic/section  `%1` count  `%2` width (default `78`)
  Registers: `%qsep`, `%qtitle`, `%qsection`, `%qhint`, etc.

EXAMPLES
  +help/theme/set indexfmt=[topiclist()]%cn
  +help/theme/set headerfmt=%qsep[repeat(%qsmaj,%2)]%cn
