# Compact clear controls — simple QA report

**Build:** EXP3.0.2.4.3.34 · App 4.1.5.51.47

## What changed

- **More filters** now has a compact **×** beside it, matching the selection control.
- The icon has a **34 × 34 CSS pixel** target. Its tooltip and accessible name explain that it clears **filters, search, and sorting**.
- It appears only when something can be reset, including an unsubmitted nonblank search draft. Clearing returns keyboard focus to More filters.
- Selected questions stay selected. The separate selection-clear icon keeps its existing behavior.
- Live search input and open source-picker changes update the icon and group outline immediately.

## QA result

**All 17 release test suites passed.**

- **83 focused checks** covered both compact clear controls, conditional visibility, draft search, keyboard navigation/activation and focus, independent clearing, five screen widths, the color legend, and finishing batch reviews.
- Toolbar checks included open-source-picker updates without remounting the panel, search submission, sorting, light mode, standalone-file operation, and responsive toolbar/menu behavior.
- **276 manual review checks**, **199 bulk solution approval checks**, **95 Batch Tools UI checks**, and **63 metadata checks** passed.
- Solution indicators, study workflows, table fit, dropdowns, and responsive interactions passed.
- The layout audit checked **340 records across 10 screen sizes**. **12 of 12 visual comparisons passed**.
- The 768/1440 px Question Bank baselines were refreshed after visual inspection. The 375 px Bank baseline and nine Practice baselines stayed unchanged.
- Source, built HTML, standalone HTML, and ZIP app bytes match. ZIP integrity and every source manifest checksum were verified. The previous delivered build was preserved.

QA used isolated Chrome question banks and controlled pasted AI responses.

## Evidence

[All suite results](COMPACT_CLEAR_RELEASE_QA/results.json) · [Focused checks](COMPACT_CLEAR_RELEASE_QA/review-controls-results.json) · [Manual review checks](COMPACT_CLEAR_RELEASE_QA/manual-review-results.json)

[Desktop control](COMPACT_CLEAR_RELEASE_QA/desktop-filter-clear.png) · [Phone control](COMPACT_CLEAR_RELEASE_QA/phone-filter-clear.png)

Earlier filter redesign suggestions remain in [the previous report](COMPACT_SELECTION_QA_REPORT.md#filter-suggestions-for-a-future-change).
