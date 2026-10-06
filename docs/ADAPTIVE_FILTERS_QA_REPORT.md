# Adaptive filters — simple QA report

**Build:** EXP3.0.2.4.3.36 · App 4.1.5.51.49

## What changed

- Search is shorter and does not stretch across the toolbar.
- Filters appear directly when they fit. Only spillover moves into **More** as the window shrinks; More disappears when everything fits.
- The menu is smaller, contains only overflow controls, and uses one column on phones.
- Filter values, selected questions, search drafts, keyboard focus, open source lists, and pinned color legends survive resizing.
- Independent clear actions, source/bank combinations, solution colors, sorting, and all batch tools are retained.

## QA result

**All 19 release test suites passed.**

- **238 adaptive checks** covered 18 window widths, filter reachability, resizing, popup bounds, focus, source menus, pinned legends, clearing, and standalone operation.
- **203 filter checks** covered solution/origin/math combinations, legacy restrictions, source/bank intersections, sorting, clearing, and no-match help.
- Full manual batch review, batch UI, metadata, bulk solution approval, toolbar/search, study workflow, and app regression suites passed.
- The layout audit covered **340 records across 10 screen sizes**. All **12 visual comparisons** passed. Only the three intentional Question Bank baselines were refreshed after review; nine Practice baselines were retained.
- QA found and fixed keyboard focus loss during relocation, unnecessary source-list moves resetting scroll, extra blank space in More, toolbar width/checkbox-height mismatch, and a pinned legend closing when More disappeared.
- Source, built HTML, standalone HTML, and the ZIP app match. ZIP integrity and all manifest checksums were verified. The previous delivered build was preserved.

Browser QA used isolated Chrome banks and controlled pasted AI responses. No live AI provider calls were needed.

## Evidence

[All suite results](ADAPTIVE_FILTERS_RELEASE_QA/results.json) · [Resize checks](ADAPTIVE_FILTERS_RELEASE_QA/adaptive-results.json) · [Full test log](ADAPTIVE_FILTERS_RELEASE_QA/release-tests.log)

[All filters visible](ADAPTIVE_FILTERS_RELEASE_QA/wide-all-filters.png) · [Compact More](ADAPTIVE_FILTERS_RELEASE_QA/desktop-overflow.png) · [Phone More](ADAPTIVE_FILTERS_RELEASE_QA/phone-overflow.png)
