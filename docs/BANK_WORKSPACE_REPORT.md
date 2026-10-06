# Adjustable Question Bank workspace — 4.1.5.51.35

Lean-package note: this is a historical feature report. Its companion `BANK_RELEASE_QA` raw evidence remains in the earlier full release archive, not this trimmed repository. Use `TOOLBAR_REPORT.md` and `TOOLBAR_RELEASE_QA/` for the current release.

Build: EXP3.0.2.4.3.18 / 4154035. Date: September 26, 2026.

Authoritative file: `index.html`. SHA-256: `42aeb545c6ce74d9d886e44f157b6169a6cece8781e48bd024ad8ff9c13daf1e`.

## Adjustable list and detail panes

The Question Bank now has a visible draggable divider between the question table and question details. Moving it allocates more width to either side without rerendering questions. The preferred split is saved locally under `fepl-bank-pane-width-v1` and restored after filtering, tab navigation, and reloads, including direct standalone-file use.

- Drag with a mouse or touch input.
- Focus the divider and press Left/Right to resize by 16 pixels, or Shift + Left/Right for 48 pixels.
- Home/End move to the pane limits.
- Double-click or press Enter to restore the default 54% list / 46% detail split.
- Bank → Reset pane widths provides a discoverable reset action.
- Escape cancels a drag; cancelled touches also restore the starting width.

The separator has an accessible name, orientation, controlled-pane IDs, and live size values. Pointer capture maintains dragging outside the handle. Completion, cancellation, focus loss, and layout replacement clear the resize cursor.

The list keeps at least 280 pixels and details at least 320 pixels at supported desktop widths. A smaller viewport clamps the current layout without overwriting the preferred split; increasing the viewport restores it. Screens of 980 CSS pixels or less keep the existing stacked layout. The question table retains its horizontal scrolling, with a minimum table width of 870 pixels. In-place source filtering now also preserves horizontal table scroll.

The question header responds to its own pane width: narrow detail panes place action buttons below the title and metadata instead of squeezing the title beside a three-line Edit button. The saved split is included in new layout markup before the first paint to avoid a default-width jump during filtering.

The preference is browser-local. If browser storage is unavailable, resizing still works for the current visit. Cloud syncing and backup export for this preference are not added.

## Compact toolbar refinement

The toolbar remains one row, with 34-pixel controls and a total height of about 51 pixels. The extra nested border and padding are removed, leaving more vertical room for questions. Search, filters, and actions have consistent heights, corner radii, typography, and spacing. Filters use quieter borders; a subtle divider separates actions; New Question retains primary emphasis.

Search has a quieter submit button and one clear icon. Active primary filters use the same accent styling. More filters highlights only when its additional filters are active. Topic, Difficulty, Question Type, Upload Source, Original Source, and Sort retain the existing promotion priority as space permits. Narrow screens retain horizontal toolbar scrolling and the More filters menu. The question count stays in the footer.

Existing multi-select menus keep their open state, focus, and scroll during selection. The prior menu reopening and closing animation repairs are retained.

## Validation and handoff

The release gate includes `scripts/bank-workspace-qa.mjs` alongside the existing workflow, dropdown, responsive, and visual suites. Evidence is supplied under `docs/BANK_RELEASE_QA/`; its `results.json` identifies every completed suite.

All nine release suites passed on the exact HTML hash above:

- 47 static verification checks.
- 52 Question Bank pane and toolbar interaction checks, with no browser exceptions.
- 50 study workflow checks, including import, recovery, submission, review, export, and failure injection.
- 141 UI regression assertions.
- 88 repeated popover reopening checks.
- Large 48-option Bank and Practice dropdown scrolling checks, including mobile and direct standalone HTML.
- 93 responsive interaction assertions covering 36 toolbar widths, sidebar states, and keyboard sliders.
- 330 app layout records across ten viewport sizes from 320×568 to 2560×1440, with no reported geometry issues or browser exceptions.
- 12/12 visual snapshot comparisons.

The new pane suite checks mouse and touch dragging, limits, keyboard controls, cancellation, resets, persistence, malformed/unavailable storage, native and multi-select filtering, horizontal scroll retention, light/dark layouts, stacking, and direct file use. Desktop pane checks span 1024–2560 CSS pixels; stacked checks span 320–980 pixels. The toolbar breakpoint sweep covers 36 viewport widths and expanded/collapsed sidebars.

Only the three Question Bank visual baselines at 375, 768, and 1440 pixels are replaced for the intended UI changes. All nine Practice snapshots retain their prior baseline images. Screenshot fixtures normalize scrollbar gutters because the macOS scrollbar preference changed the layout of an unchanged 4.1.5.51.34 control run by the same amount. This normalization exists only in the screenshot test; the shipped app retains native scrollbars, and other suites test their actual behavior.

Question content, prompts, parsers, review/apply behavior, AI routing, Firebase/Drive configuration, main database version 4, saved study presets, and session recovery remain unchanged. No deployment was performed. The package includes the revised AI Studio handoff prompt and the separate future Google Drive import prompt.
