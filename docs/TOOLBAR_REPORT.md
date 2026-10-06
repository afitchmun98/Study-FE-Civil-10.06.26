# Explicit search and simplified Question Bank toolbar — 4.1.5.51.38

Build: EXP3.0.2.4.3.21 / 4154038. Date: September 26, 2026.

Authoritative file: `index.html`. SHA-256: `464cb5bca4e96702fb6d2e4b5460503202347040605e032780ea9bec9f074032`.

## Changes

Normal desktop order: Search → Topic → Sources → Difficulty → More filters → Clear | Tools → + Question. The controls use one aligned 34 CSS-pixel row. The question count remains in the footer, and active-filter chips remain removable without increasing toolbar height.

The Search button fits inside the existing field, with room for query text and inline clear. At 820 CSS pixels and below, New Question uses its labelled plus-icon button to reserve space for search without wrapping the toolbar. Intentional toolbar scrolling remains available on the smallest screens.

- Sources combines the Original Source multi-select and Upload Source single-select in one panel. Their distinct meanings are explained inside it. There is no nested source popover. Each original source can be selected independently; Clear original resets only that group, while Clear sources resets both source restrictions.
- Question Type and specialised Sort move into More filters. Table-header sorting still works. Current Bank, Included In, solution/review status, flagged-only, and existing AI-data options remain available.
- Tools combines the old Bank and AI Tools menus into labelled Import & export, AI, and Maintenance sections. Import, selected JSON/CSV export, batch tools, provider/manual routing, recovery, formatting repair, maintenance, and pane reset remain accessible. Export choices no longer require a second submenu.
- The selection menu is hidden when nothing is selected and appears when needed. Tools always exposes Select all matching, including matches on other pages.
- Search now waits for the visible Search button inside the field or Enter. Typing, pausing, and editing only update the draft: they do not apply a query or remount the input/results. The previous results remain until submission. Inline clear immediately resets both draft and applied query, and remains available if draft text is deleted while a prior query is active. Global Clear stays outside menus and can discard an unsubmitted draft as well as reset search, all filters, and non-default sorting.
- At smaller available toolbar widths, Difficulty moves into More filters first, then Topic. Sources remains outside. Very narrow screens use contained horizontal toolbar scrolling instead of wrapping. Selection actions reserve space before choosing the responsive tier.

Sources selection, clearing, and native Upload Source changes preserve the live source panel, focus, and scroll position rather than remounting it. Toolbar menus are anchored within the viewport and can scroll vertically when the screen is short. Existing reopening/closing animations and reduced-motion behavior are retained.

QA found and corrected three integration defects: an inherited vertical flex basis made the Sources field too tall; responsive placement could become stale after Clear reset the bank UI state; and the taller Tools panel could cover its own trigger on short screens. The tier observer now compares the rendered toolbar tier with the available width rather than inferring it from reset state. Tools panel height is limited to the available space above or below its trigger, with internal scrolling and a trigger-hit-test regression check.

## Preserved boundaries

The resizable list/detail split, table-fit correction, pinned selection/Solution columns, sidebar rail, Practice setup/presets, local session recovery, and Worksheets behavior remain. Database version 4, question content, prompt generation, parsers, fingerprints, solution review/apply, provider routing, and Firebase/Drive integration are unchanged. The Google Drive import prompt is updated to target Tools → Import & export; the feature itself has not been implemented.

Earlier standalone and handoff artifacts remain untouched. This package is a new candidate for comparison, not a replacement of the user's deployed app.

## Validation

Final release results are recorded in `TOOLBAR_RELEASE_QA/results.json`, with suite logs and JSON evidence beside it. The release gate contains eleven suites, including the new combined-toolbar interaction suite. Browser fixtures are isolated in memory and are absent from the delivered HTML.

Validation coverage:

- 50 static checks on the exact source hash and JavaScript syntax.
- 139 combined-toolbar checks, including slow typing/pauses without applying search, stable input/results and focus while typing, Search/Enter submission, editing an applied query, clearing pending drafts and applied searches, stable Sources DOM/scroll, both source restrictions, grouped actions, contextual selection, cross-page Select all matching, rapid reopening, responsive priority, uncovered Tools triggers, and standalone/reduced-motion operation.
- 551 table-containment/accessibility checks across 82 pane states and five zoom-equivalent settings.
- 52 pane-workspace and 50 study-workflow checks.
- 140 UI regression and 88 repeated-popover checks, plus long-list Bank/Practice dropdown diagnostics.
- 93 responsive-interaction checks across 36 toolbar widths, icon-rail layouts, light-theme sliders, and keyboard input.
- 340 app-wide audit records across ten viewport sizes, covering all tabs, dialogs, popup panels, populated lists, and live Practice/Exam layouts.
- Twelve fixed-size screenshot comparisons.

The three intentionally changed Question Bank screenshot baselines were visually reviewed before replacement; the nine Practice baselines were retained. The release gate disables baseline updates. Screenshots cover 375, 768, and 1440 CSS-pixel layouts. Additional interaction and geometry tests cover smaller and larger widths, short landscape windows, light/dark themes, and direct standalone-file use.

Local tests do not establish that the app has been uploaded to GitHub, imported into Google AI Studio, or authenticated with the owner's live provider/Firebase/Drive accounts. See `HOSTED_VALIDATION.md` for those checks. No push or deployment was performed.

## Lean handoff

Current logs/results, these four feature reports, hosted-validation guidance, all test scripts, and twelve reviewed visual baselines are included. Captured screenshots, older raw QA directories, and generated `dist/` files are excluded from the GitHub ZIP. `npm run build` regenerates `dist/` from the exact supplied source. The separately delivered standalone HTML is byte-identical to `index.html`.

The lean handoff has 64 files total, including 23 under `docs/`. No file reaches 25 MiB. Complete current screenshot evidence is retained locally in the working candidate's `docs/TOOLBAR_RELEASE_QA/`; previous release evidence remains with the previous archives.
