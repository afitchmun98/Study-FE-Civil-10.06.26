# Question Bank table containment repair — 4.1.5.51.36

Lean-package note: this is a historical feature report. Its raw evidence remains in the earlier full .36 archive. Use `TOOLBAR_REPORT.md` and `TOOLBAR_RELEASE_QA/` for the current .38 candidate.

Build: EXP3.0.2.4.3.19 / 4154036. Date: September 26, 2026.

Authoritative file: `index.html`. SHA-256: `8d8df6690132c177a9be7b7ee09fa7ed1d2973941dfd7db8f3944530537e1d5e`.

## Defect and correction

The previous table assigned only 54 CSS pixels to the Solution column. Its label and sort button required about 61.3 pixels before cell padding, producing about 15.3 pixels of overflow. The unpinned selection column also let checkboxes move out of view during horizontal scrolling. Earlier layout checks measured outer containers and did not validate each header and checkbox against its own cell or the pane's visible edges.

The main Question Bank table now uses an explicit responsive column group. Selection, Difficulty, and Solution reserve 44, 92, and 84 CSS pixels respectively. ID, Topic, and Upload Source receive 13%, 14%, and 20% of table width; Question receives the remainder. Long identifiers and topic names can wrap rather than push the table wider. Header labels and sort arrows remain together inside their columns.

The table's minimum width is 640 CSS pixels, reduced from 870. At or above that width, all columns fit without unnecessary horizontal scrolling. Narrower panes retain intentional scrolling for the middle columns. The left selection column and right Solution column are pinned within the pane, with opaque backgrounds and matching hover/selection states. Checkboxes and Solution controls remain visible at either scroll edge. Native scrollbars are retained.

The adjustable divider, remembered split, keyboard/touch resizing, detail-pane minimum width, single-row toolbar, source filters, and previously repaired dropdown interactions are unchanged. The compact table does not change question content, solutions, prompts, parsers, review/apply behavior, AI routing, Firebase/Drive configuration, database version 4, study presets, or session recovery.

## Focused validation

The new `scripts/bank-table-fit-qa.mjs` test first checks every header against its own cell, then tests checkbox containment, visibility and click access, right-edge Solution containment, and overall content overflow. A controlled run against the original 4.1.5.51.35 file fails immediately on the Solution header's approximately 15.3-pixel overflow.

The corrected source passed 551 containment/accessibility assertions across 82 pane states, with no browser exceptions:

- Desktop viewports of 1024, 1280, 1440, 1920, and 2560 CSS pixels, with requested pane widths of 280, 440, 600, 640, 720, 900, and 1200 pixels (subject to the existing pane limits).
- Both horizontal scroll edges, a long-identifier fixture with enough rows to force a vertical scrollbar, sorting, and selection while horizontally scrolled.
- Stacked layouts at 320, 375, 768, and 980 pixels, plus light and dark themes.
- Five zoom-equivalent viewport/pixel-density settings from 100% to 200%. These model zoom geometry; they are not changes to the browser's UI zoom setting.

The fixture exists only in the test's in-memory HTML. It does not modify the shipping file or any existing user question bank. Screenshots wait for math rendering and fonts before capture.

## Release validation

All ten suites passed on the exact HTML hash above. Final results and logs are retained under `docs/TABLE_FIT_RELEASE_QA/`; `results.json` records each suite's successful exit status. The lean GitHub package omits captured screenshots; they remain in the unchanged full release ZIP. Test scripts and reviewed comparison baselines remain in this repository.

- 47 static verification checks.
- 551 focused table assertions across 82 pane states and five zoom-equivalent settings.
- 52 pane and toolbar interaction checks.
- 50 study workflow checks covering import, recovery, submission, review, export, and failure injection.
- 141 UI regression assertions.
- 88 repeated popover reopening checks.
- Large 48-option Bank and Practice dropdown scrolling checks, including mobile and direct standalone HTML.
- 93 responsive interaction assertions across 36 toolbar widths, sidebar states, and keyboard sliders.
- 330 app layout records across ten viewport sizes from 320×568 to 2560×1440, with no reported geometry issues or browser exceptions.
- 12/12 visual snapshot comparisons.

`original-35-regression.json` is deliberately failing negative-control evidence from the previous release, not a result from the repaired build.

Only the three intentionally changed Question Bank screenshot baselines at 375, 768, and 1440 pixels were reviewed and updated. The other nine Practice snapshots retain their previous baseline images. Screenshot-only scrollbar normalization remains in the visual test; actual scrollbar behavior is exercised in the interaction suites.

No deployment was performed. Historical reports retain their original release identities. The package includes the updated AI Studio preservation prompt and the separate future Google Drive import prompt.
