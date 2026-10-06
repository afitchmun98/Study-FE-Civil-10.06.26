# Selection controls — simple QA report

**Build:** EXP3.0.2.4.3.32 · App 4.1.5.51.45

## What changed

- **Clear selected** and the selection count/menu now share one compact control with a dashed divider.
- The clear action and group outline appear only when questions are selected.
- **0 selected** remains available so you can use Select matching or Select all.
- Clearing returns keyboard focus to the selection menu. Clearing filters and clearing selection remain separate actions.

## QA result

**All 17 release test suites passed.**

- **61 focused checks** covered selection changes, both clear actions, keyboard focus, grouped controls at five screen widths, the color legend, and finishing batch reviews.
- **276 manual review checks**, **199 bulk solution approval checks**, **95 Batch Tools UI checks**, and **63 metadata checks** passed.
- Toolbar/search, solution indicators, study workflows, table fit, dropdowns, and responsive interactions passed.
- The layout audit checked **340 records across 10 screen sizes**. **12 of 12 visual comparisons passed**.
- Two Question Bank baselines (768 and 1440 pixels) were refreshed after visual inspection of the requested grouping. The 375-pixel Bank baseline and nine Practice baselines stayed unchanged.
- The standalone HTML, built HTML, source HTML, and ZIP app bytes match. ZIP integrity and every source manifest checksum were verified.

QA used isolated Chrome question banks and controlled pasted AI responses. Previous delivered builds were preserved.

## Evidence

[All suite results](SELECTION_GROUP_RELEASE_QA/results.json) · [Focused checks](SELECTION_GROUP_RELEASE_QA/review-controls-results.json) · [Manual review checks](SELECTION_GROUP_RELEASE_QA/manual-review-results.json)

[Desktop control](SELECTION_GROUP_RELEASE_QA/desktop-selection-group.png) · [Phone control](SELECTION_GROUP_RELEASE_QA/phone-selection-group.png)

Previously recorded items outside this change remain in [the earlier report](REVIEW_CONTROLS_QA_REPORT.md#notes-for-later).
