+THEME/FORMATS — SEE ALSO: +help/theme

**Format strings** evaluated as MUX softcode before display.

FORMATS
  `headerfmt`   Top of every topic or section.
  `dividerfmt`  Separator above a section name inside a topic.
  `footerfmt`   Bottom of every topic or section.
  `indexfmt`    Body of the help index (between header/footer).

FUNCTIONS (available inside format strings)
  `topiclist()`         TinyMUX-style: sections bold, topics in columns.
  `sectionlist()`       Newline list of section names only.
  `sections()`          Space-separated section names.
  `topics([section])`   Topic names, optionally filtered by section.

POSITIONAL ARGS
  `%0`  Topic/section  `%1`  Count  `%2`  Width (default 78)
  Registers: `%qsep`, `%qtitle`, `%qsection`, `%qhint`, etc.

EXAMPLES
  +help/theme/set indexfmt=[sectionlist()]%cn
  +help/theme/set headerfmt=%qsep[repeat(%qsmaj,%2)]%cn

SEE ALSO: theme/tokens
