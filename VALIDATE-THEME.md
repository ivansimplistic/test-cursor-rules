## Overview

This linter validates theme source for consistency and best practices. Run it from the theme root:

```bash
node validate-theme.js
```

Use inline guards to disable/enable specific checks within a file section:
- HTML: `<!-- validation-disable:checkConsoleDebug -->` ... `<!-- validation-enable:checkConsoleDebug -->`
- CSS/JS: `/* validation-disable:checkConsoleDebug */` ... `/* validation-enable:checkConsoleDebug */`
- Liquid: `{% comment %}validation-disable:checkConsoleDebug{% endcomment %}` ... `{% comment %}validation-enable:checkConsoleDebug{% endcomment %}`

Disable all checks in a region with `...-disable:all` / `...-enable:all`.

You can also ignore checks per file via patterns in `FILE_IGNORES` inside `validate-theme.js`.


## Enabled checks

As currently configured (`CONFIG` in `validate-theme.js`):
- checkHardcodedText: enabled
- checkFontFamily: enabled
- checkConsoleDebug: enabled
- checkCssClassNaming: enabled
- checkJsonCustomCss: enabled

Disabled at this time:
- checkHexColors: disabled
- checkInlineStyles: disabled


### checkHardcodedText

Scans `.liquid` files in `snippets/` and `sections/` for customer‑facing text nodes that should live in `locales/en.default.json`.

- What it flags: visible text between HTML tags, e.g. `>Some text<`.
- What it ignores automatically:
  - URLs and paths (`/`, `//`, `./`, `../`, `http://`, `https://`)
  - CSS selectors and technical tokens (e.g., `.class`, `#id`, `data-*`)
  - File names with common extensions (`.js`, `.css`, `.png`, etc.)
  - Text inside `{% schema %} ... {% endschema %}` blocks
  - Text within `{% comment %} ... {% endcomment %}`
  - Lines that contain Liquid tags/expressions as the text
  - Attribute values like `alt`, `title`, `placeholder`, `aria-label` (use meaningful text there but not flagged here)
  - Technical/implementation fragments such as assignments (`location =`), DOM APIs (`querySelector`), routing keywords, etc.
  - Complex Liquid filter chains (e.g., `| replace:`, `| split:`, `| append:`) and filter fragments

Error format:
- `[checkHardcodedText] Error: Text [Some text] must be moved to locales/en.default.json in {file}:{line}`

Notes:
- Multi-line Liquid tags/expressions are skipped while open.
- You can suppress per region using the inline guards described above.


### checkFontFamily

Scans `.liquid` (in `snippets/`, `sections/`) and `.css`/`*.css.liquid` (in `assets/`) for hardcoded `font-family` declarations.

- Allowed values:
  - CSS variables (contain `var(`)
  - Liquid expressions (`{{ ... }}` or `{% ... %}`)
  - Keywords: `inherit`, `initial`, `unset`, `revert`, `revert-layer`
  - Generic families: `serif`, `sans-serif`, `monospace`, `cursive`, `fantasy`, `system-ui`, `ui-serif`, `ui-sans-serif`, `ui-monospace`, `ui-rounded`, `emoji`, `math`, `fangsong`
  - Approved custom fonts: `Linearicons-Free`, `Round_Monogram_Right`, `Round_Monogram_Left`, `Round_Monogram_Center`

- What it flags:
  - Any `font-family: ...;` where at least one comma‑separated token is not in the allowlists above and is not Liquid/CSS variable.

Error format:
- `[checkFontFamily] Error: Hardcoded font family in {file}:{line}: {value}`


### checkConsoleDebug

Scans `.liquid` (in `snippets/`, `sections/`) and `.js`/`*.js.liquid` (in `assets/`) for debugging statements.

- What it flags: occurrences of `console.log`, `console.debug`, or `debugger`.

Error format:
- `[checkConsoleDebug] Error: Debugging statement in {file}:{line}: {full line}`


### checkCssClassNaming

Validates CSS class names in both markup and styles to avoid underscores in class identifiers.

- In `.liquid` (snippets/sections):
  - Parses `class="..."` attributes.
  - Splits out static segments, ignoring Liquid blocks (`{{ ... }}`, `{% ... %}`) and variables.
  - Flags any static class token that matches the underscore pattern (internal `_` not part of Liquid), based on the internal regex.

- In `.css`/`*.css.liquid` (assets/):
  - Scans static CSS selectors in each line and flags class selectors that include underscores per the same rule.

Error format:
- `[checkCssClassNaming] Error: CSS class name with underscore '{className}' in {file}:{line}`


### checkJsonCustomCss

Scans JSON template files (`templates/*.json`) for hardcoded values inside any `custom_css` string field.

- What it flags:
  - Hardcoded hex colors inside the `custom_css` content
  - Hardcoded `font-family` values not allowed by the `checkFontFamily` rules

- What it allows:
  - CSS variables (e.g., `var(--color-primary)`)
  - Liquid expressions (e.g., `{{ settings.color_primary }}`)

Error formats:
- `[checkJsonCustomCss] Error: Hardcoded hex color in custom_css in {file}:{line}`
- `[checkJsonCustomCss] Error: Hardcoded font family in custom_css in {file}:{line}: {value}`

Notes:
- The line number is approximated by locating the next `"custom_css"` key occurrence in the raw JSON text.


## Disabled checks (documented for completeness)

These checks exist but are currently disabled in `CONFIG`.

### checkHexColors (disabled)
- Would flag raw hex colors where not provided via CSS variables or Liquid in `.liquid` and `.css` files.

### checkInlineStyles (disabled)
- Would scan inline `style="..."` in `.liquid` and only allow:
  - Any `display: ...`
  - CSS variable assignments (e.g., `--x: value`)
  - Values that are entirely a CSS var (`var(--...)`)
  - Pure Liquid values (`{{ ... }}`)
  - Liquid plus optional CSS unit (e.g., `{{ size }}px`)
  - Sequences composed only of CSS vars and/or Liquid tags
- Anything else would be reported as `[checkInlineStyles]` with the offending value.


## File-level ignores

Inside `validate-theme.js`, `FILE_IGNORES` contains glob patterns mapping to either:
- an array of check names to ignore for matching files, or
- the string `"all"` to ignore every check for those files.

Example entries (actual values live in the script):
```js
{
  'sections/test-hardcoded-text.liquid': ['checkHardcodedText'],
  'assets/photoswipe.css': ['checkCssClassNaming']
}
```


## Output and exit code

- When no issues are found: `Validation completed! No errors found.`
- When issues exist: prints a total count, a summary per check type, and exits with code `2`.


## Tips

- Prefer translations for customer‑visible strings via `{{ t 'key' }}` and maintain entries in `locales/en.default.json`.
- Use CSS variables or Liquid for design tokens (colors, fonts) instead of hardcoding values.
- Use inline guards judiciously and keep them temporary.