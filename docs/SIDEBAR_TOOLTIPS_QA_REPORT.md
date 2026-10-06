# Sidebar button names — simple QA report

**Build:** EXP3.0.2.4.3.37 · App 4.1.5.51.50

## What changed

- Hover over any collapsed sidebar button to see its name immediately.
- Keyboard focus shows the same label; Escape dismisses it without moving focus.
- All nine navigation buttons, both AI links, profile, and expand are covered.
- Labels fit inside short windows and work in light and dark themes.

## QA result

**All 20 release test suites passed.**

- **359 sidebar checks** covered every label at four desktop widths, keyboard navigation, short-window scrolling, cleanup after actions/redraw/resizing, native titles, accessible descriptions, AI destinations, profile access, mobile navigation, reload, and standalone HTML.
- Filters, search, selection, solution indicators/approval, manual batch tools, review/retry, and study workflow regression suites passed.
- All **12 screenshot comparisons** passed using unchanged baselines. Sidebar screenshots were also visually reviewed.
- Prompt constants, target adapters, and the checked Gemini answer-choice import compiler match the previous build byte for byte. See [the prompt comparison](MANUAL_PROMPT_COMPARISON.md) for the recommendation.
- Source, built HTML, standalone HTML, and ZIP app match. ZIP integrity and manifest checksums were verified; the previous delivered build was preserved.

Browser QA used isolated banks and controlled pasted AI responses. No live provider calls were made; this release does not compare Gemini and ChatGPT response quality.

## Evidence

[All suite results](SIDEBAR_TOOLTIPS_RELEASE_QA/results.json) · [Sidebar checks](SIDEBAR_TOOLTIPS_RELEASE_QA/sidebar-results.json) · [Full test log](SIDEBAR_TOOLTIPS_RELEASE_QA/release-tests.log)

[Dark theme label](SIDEBAR_TOOLTIPS_RELEASE_QA/dark-sidebar-label.png) · [Light theme label](SIDEBAR_TOOLTIPS_RELEASE_QA/light-sidebar-label.png)
