# Compact selection control — simple QA report

**Build:** EXP3.0.2.4.3.33 · App 4.1.5.51.46

## What changed

- The selection count/menu comes first, followed by a small **×** that clears selected questions.
- The clear icon has a **Clear selected questions** tooltip and accessible name, with a **34 × 34 CSS pixel** target.
- The icon and group outline appear only when questions are selected. **0 selected** remains available for Select matching and Select all.
- With one selected question, the combined control measures **128 CSS pixels**, down from 191 in the previous build (about one-third narrower).
- The toolbar reserves only 34 extra pixels for selection clearing. This keeps Topic on the toolbar at more widths when questions are selected.
- Clearing selected questions preserves filters and search, and returns keyboard focus to the selection menu.

## QA result

**All 17 release test suites passed.**

- **65 focused checks** covered the compact layout, icon name/tooltip, keyboard navigation and activation, conditional visibility, both clear actions, grouped controls at five screen widths, the color legend, and finishing batch reviews.
- **276 manual review checks**, **199 bulk solution approval checks**, **95 Batch Tools UI checks**, and **63 metadata checks** passed.
- Toolbar/search, solution indicators, study workflows, table fit, dropdowns, and responsive interactions passed.
- The layout audit checked **340 records across 10 screen sizes**. **12 of 12 visual comparisons passed**, retaining all previous baselines.
- The standalone HTML, built HTML, source HTML, and ZIP app bytes match. ZIP integrity and every source manifest checksum were verified.

QA used isolated Chrome question banks and controlled pasted AI responses. Previous delivered builds were preserved.

## Filter suggestions for a future change

These are recommendations; this release preserves the existing filter functions.

| Area | Suggested design | Function to preserve |
| --- | --- | --- |
| Solution status + Solution indicator | One **Solutions** section: All, Has a solution, Green, Yellow, Red, Missing. Keep origin and math repair as advanced options. | Has a solution includes green, yellow, and red. Green alone excludes solutions that need review. Missing Solution and No Solution (Gray) use the same presence check. Imported/AI origin and math repair provide additional information. |
| Sources + bank filters | One **Sources & banks** panel with Original source and Upload source, plus a collapsed Bank membership section. | Current bank is one assigned bank; Included in matches any recorded membership. Both restrictions can be active together, so merging their presentation must preserve their separate criteria. |
| Repeated labels | Put each label above its field and use a short value such as **All** inside it. Rename Included in to **Bank membership**. | Keep visible selected values, tooltips for long names, and removable active-filter chips. |
| Sort order | A compact **Sort** control beside the table, with table-header sorting retained. | Sorting changes order; it does not narrow results. Preserve all specialised sort choices, including Review Priority. |
| Main toolbar | Prioritise Search, Topic, Sources, and More filters. Keep Difficulty and Question type in the filter panel where space is tight. | Keep all existing filters accessible, active-filter counts, and separate clear-filter/clear-selection actions. |

The safest next step is to group the solution controls first, then the source/bank controls, retaining every filter criterion and testing intersections after each change.

## Evidence

[All suite results](COMPACT_SELECTION_RELEASE_QA/results.json) · [Focused checks](COMPACT_SELECTION_RELEASE_QA/review-controls-results.json) · [Manual review checks](COMPACT_SELECTION_RELEASE_QA/manual-review-results.json)

[Desktop control](COMPACT_SELECTION_RELEASE_QA/desktop-selection-group.png) · [Phone control](COMPACT_SELECTION_RELEASE_QA/phone-selection-group.png)

Previously recorded items outside this change remain in [the earlier report](REVIEW_CONTROLS_QA_REPORT.md#notes-for-later).
