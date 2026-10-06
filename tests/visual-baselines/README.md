# Reviewed visual baselines

These 12 Chromium snapshots cover Practice setup, the Session Setup card, no-match guidance, and active Question Bank filters at 375, 768, and 1440 CSS pixels (900 pixels high).

`npm run test:visual` compares against them. It fails if more than 0.3% of pixels differ, using pixelmatch's 0.12 per-pixel threshold. It writes actual and difference images under the temporary `fe-visual-regression` directory, overridable with `VISUAL_QA_OUTPUT`.

The version badge is masked in magenta; animations and caret blinking are disabled. Baselines were reviewed on macOS Chrome. OS fonts, browser builds, and rendering changes can produce legitimate differences, which must be reviewed rather than automatically accepted.

The screenshot fixture hides native scrollbar gutters to match the original overlay-scrollbar geometry, independent of the macOS "Show scroll bars" preference. This is test-only CSS; native scrollbars remain intact in the app and are exercised by the interaction and responsive suites. An unchanged 4.1.5.51.34 control run confirmed the system preference caused the same unrelated differences; after normalization all nine non-Bank snapshots matched without baseline changes.

Browser QA requires `playwright`, `pngjs`, and `pixelmatch` in the Node module path. Set `PLAYWRIGHT_CHROME_PATH` if Chrome is not installed at the default macOS location. The shipped app itself does not depend on these test packages.

After a deliberate UI change, inspect the actual/diff images. Only then use `UPDATE_VISUALS=1 node scripts/visual-regression.mjs`, review the new images, and rerun normal comparison. The release gate explicitly disables baseline updates.

For the 4.1.5.51.35 toolbar and split-pane change, only the three Question Bank `active-filters` snapshots were replaced after visual review. `UPDATE_VISUAL_NAMES=active-filters` restricts baseline updates to that scene; the other nine snapshots continue to compare against their prior baselines.

The 4.1.5.51.36 correction also updates only those three Bank snapshots after review, for responsive table columns and pinned selection/Solution controls. Individual cell and scroll-edge containment is checked by `scripts/bank-table-fit-qa.mjs`; a controlled run against 4.1.5.51.35 reproduces its overflowing Solution header.

`VISUAL_QA_INJECT_REGRESSION=1 node scripts/visual-regression.mjs` deliberately offsets the Session Setup card in the isolated test page to verify that comparison fails. It never modifies the app file or baselines.

For 4.1.5.51.37, only the three Bank `active-filters` snapshots were replaced after reviewing the intentionally simplified toolbar. The other nine Practice snapshots passed unchanged. Sources and Tools panel geometry, interaction, stable DOM, scroll, repeated reopening, standalone-file operation, and responsive filter placement are additionally checked by `scripts/toolbar-simplification-qa.mjs`.

For 4.1.5.51.38, the three Bank snapshots were reviewed for the restored Search button and its compact field spacing. Only those three baselines were refreshed; the nine Practice baselines remain unchanged. The toolbar suite now verifies explicit submission and that slow typing/pauses do not update or remount the results.

For EXP3.0.2.4.3.26, all 12 scenes were reviewed and refreshed after adding Gemini and ChatGPT marks to shortcut buttons and showing the zero-selection menu in the Bank toolbar. The previously stale 768 px active-filters image was also aligned with the current Question Type and flag controls after visual inspection. A normal comparison run passed 12/12 after the update. The practice-session origin change is covered separately by the focused UI suite because these 12 scenes show Practice setup, not an active session.

For EXP3.0.2.4.3.27, the four 375 px scenes were reviewed and refreshed after mobile header provider links became icon-only at narrow widths. The marks retain accessible names. The eight 768/1440 px baselines remain unchanged.

For EXP3.0.2.4.3.30, the four 1440 px desktop scenes were reviewed and refreshed for the requested combined logo/menu control and compact sidebar header. Their main content is unchanged. The eight 375/768 px scenes passed their previous baselines without updates. Dedicated bulk QA additionally checks the expanded sidebar, collapsed rail and open mobile drawer at 320, 375, 768, 781, 1024 and 1440 px.

For EXP3.0.2.4.3.31 / App 4.1.5.51.44, the three Bank `active-filters` snapshots were visually reviewed and refreshed for the independent Clear filters / Clear selected buttons and toolbar space allocation. The nine Practice snapshots remain unchanged. The circled info legend, hover/pin/touch dismissal, review footer containment, independent reset semantics, and finish persistence are checked by `scripts/review-controls-qa.mjs`; each manual batch operation’s finish behavior is also covered by `scripts/manual-review-qa.mjs`.

For EXP3.0.2.4.3.32 / App 4.1.5.51.45, the 768 and 1440 px Bank active-filter snapshots were reviewed and refreshed after Clear selected moved into the conditional selection group. The 375 px Bank snapshot and all nine Practice snapshots remain unchanged. The focused control suite additionally checks the joined dashed-divider layout, zero-selection visibility, keyboard focus after clearing, and real selection transitions across five screen widths.

For EXP3.0.2.4.3.33 / App 4.1.5.51.46, the 12 existing baselines are retained. The focused control suite verifies the compact count/menu followed by the labelled × clear action, its 34 × 34 pixel target, keyboard operation, conditional visibility, and desktop/phone appearance with selected questions.

For EXP3.0.2.4.3.34 / App 4.1.5.51.47, the 768 and 1440 px Bank active-filter scenes were visually reviewed and refreshed for the compact × joined to More filters and the recovered toolbar space. The 375 px Bank snapshot remains byte-identical, and the nine Practice baselines remain unchanged. Focused QA checks conditional visibility, unsubmitted search drafts, open Sources panel updates, keyboard activation/focus, and joined-control geometry at five screen sizes.

For App 4.1.5.51.48 / EXP3.0.2.4.3.35, only the three Bank active-filter baselines were refreshed after reviewing the stable toolbar and footer Sort control. The nine Practice baselines were retained. Source/bank panels, merged solution criteria, native panel persistence, info-popup geometry, and interactive behavior have dedicated checks in `scripts/filter-cleanup-qa.mjs` and `scripts/review-controls-qa.mjs`.

For App 4.1.5.51.49 / EXP3.0.2.4.3.36, only the three Question Bank active-filter baselines were refreshed after reviewing adaptive overflow placement and the compact search field. All nine Practice scenes retain their previous baselines. `scripts/adaptive-filters-qa.mjs` checks 18 window widths, compact toolbar height, unique/reachable filter controls, compact popup bounds, preserved selections/drafts/focus, source menus and pinned legends during resizing, independent clearing, and standalone operation. The normal release gate disables baseline updates.
