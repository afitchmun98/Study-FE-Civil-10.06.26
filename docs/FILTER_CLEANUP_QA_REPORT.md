# Filter cleanup — simple QA report

**Build:** EXP3.0.2.4.3.35 · App 4.1.5.51.48

## What changed

- **Solutions** now combines All, Has a solution, Green, Yellow, Red, and Gray/Missing. Has a solution includes saved solutions marked yellow or red; Green shows only green indicators.
- **Origin & math repair** keeps the less-used solution criteria in an expandable section.
- **Sources & banks** groups original source, upload source, current bank, and bank membership. The bank lists are collapsed by default. Choices within one list match either value; separate lists apply together.
- **Difficulty** and **Question type** are in More filters. Topic and Sources & banks stay in the same toolbar positions at every width.
- **Sort** is beside the list and pagination. Every previous sort mode and table-header sorting remain available.
- Labels are shorter. Active chips, option search, independent clearing, selection, and no-match help are retained.

## QA result

**All 18 release test suites passed.**

- **203 focused filter checks** covered solution combinations, legacy restrictions, source/bank intersections, multi-selection, all sort modes, header sorting, clearing, targeted no-match help, and responsive panels.
- **83 review-control checks**, **276 manual batch review checks**, **199 bulk solution approval checks**, **95 batch UI checks**, and **63 metadata checks** passed.
- The layout audit covered **340 records across 10 screen sizes**. All **12 visual comparisons** passed. Only the three Question Bank baselines were refreshed after visual review; nine Practice baselines were retained.
- QA found and fixed fast edits closing native panels, source panels needing repositioning after expansion, and the color legend overlapping its own info button. Hover, click, keyboard, and touch checks passed.
- Source, built HTML, standalone HTML, and ZIP app bytes match. ZIP integrity and all manifest checksums were verified. The previous delivered build was preserved.

Browser QA used isolated Chrome banks and controlled pasted AI responses.

## Evidence

[All suite results](FILTER_CLEANUP_RELEASE_QA/results.json) · [Focused filters](FILTER_CLEANUP_RELEASE_QA/filters-results.json) · [Full test log](FILTER_CLEANUP_RELEASE_QA/release-tests.log)

[More filters](FILTER_CLEANUP_RELEASE_QA/desktop-more-filters.png) · [Sources & banks](FILTER_CLEANUP_RELEASE_QA/desktop-sources-and-banks.png) · [Phone panel](FILTER_CLEANUP_RELEASE_QA/phone-sources-and-banks.png)
