# Browser and installation verification

Pre-existing baseline: `operations-density.css` from the previous precision-alignment patch, with `system-topology.css` from the last topology patch.

The existing compact-layout style had a more specific `.xmc-ops-compact .xmc-systems-grid { display:block; column-count:3 }` declaration, which kept overriding the lower-specificity `.xmc-systems-grid { display:grid }` from the previous patch. The new scoped rule overrides it without modifying other prior fixes.

Tested with Chromium headless using the previous CSS and the new override:

- At 1680, 1450, 1300 CSS px: `display:grid`, 3 columns and both rows aligned at identical `top` / `bottom` coordinates.
- At 1180 CSS px: 2 columns, paired row bounds align.
- At 720 CSS px: 1 column.
- Running installer a second time is a no-op.
- `--check` is parsed as an option and not mistaken for a directory.

This simulates a representative component layout. The actual user's full Windows application and simulator have not been compiled or tested here.
