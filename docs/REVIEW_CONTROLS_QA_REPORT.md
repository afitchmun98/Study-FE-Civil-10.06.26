# Review controls — simple QA report

**Build:** EXP3.0.2.4.3.31 · App 4.1.5.51.44

## What changed

- **Circled info icon:** hover to see the visual color legend; move away to hide it. Click or tap to keep it open. Click away or press Escape to close it. Keyboard focus also opens it.
- **Finish Review & End Task:** available in every manual batch review, including Question Text and generated draft solutions/diagrams. It keeps accepted changes, closes the dialog, and ends that task’s review and retry tracking. Unreviewed proposals require an explicit discard confirmation. Continue Reviewing returns to the same task.
- **Clear filters:** clears filters, search (including an unsubmitted query), and sorting. Selected questions remain selected.
- **Clear selected:** clears only the selection. Filters and search remain active. The selection menu keeps its own Clear Selection option.
- **Toolbar fit:** Difficulty and Topic move into More filters when needed to keep room for the explicit clear buttons. Sources stays on the toolbar. Narrow phone/tablet toolbars retain horizontal scrolling.

Finish ends the task’s batch undo history. Before finishing, you can still revisit accepted questions and reject them.

## QA result

**All 17 release test suites passed.**

- **44 focused checks:** hover, pinned legend, click-away/Escape, keyboard and touch use, independent clearing, early-finish confirmation, task isolation, reload, and review footer fit at 320, 375, 768, and 1440 pixels.
- **276 manual review checks:** all 17 Question Bank operations, both Question Text modes, draft solutions, and both draft diagram types. Included accept/advance, back navigation, reversal, bulk decisions, retries, finishing, and preservation of saved changes.
- **68 solution indicator checks**, **199 bulk approval checks**, **95 Batch Tools UI checks**, and **63 metadata regression checks** passed.
- Toolbar/search, table fit, pane resizing, study sessions/recovery, dropdown reopening, and responsive interactions passed. The layout audit checked 340 records across 10 screen sizes.
- **12 of 12 visual comparisons passed.** Three Question Bank baselines were updated after visual review of the requested controls and responsive placement; the nine Practice baselines stayed unchanged.
- Source syntax/build checks passed; the standalone HTML and source ZIP were checked for matching app bytes and ZIP integrity.

QA used isolated Chrome question banks and controlled pasted AI responses.

## Notes for later

- General notifications outside Batch Tools can still stack; Batch Tools replaces its own message.
- Existing legacy imports with a missing answer key and no recognized missing-key status can fall back to Choice A. That import behavior needs a separate audit. Supported `not_found` records retained their missing keys in these tests.

## Evidence

[All suite results](REVIEW_CONTROLS_RELEASE_QA/results.json) · [New control checks](REVIEW_CONTROLS_RELEASE_QA/review-controls-results.json) · [Manual review checks](REVIEW_CONTROLS_RELEASE_QA/manual-review-results.json)

[Desktop legend](REVIEW_CONTROLS_RELEASE_QA/desktop-legend.png) · [Phone legend](REVIEW_CONTROLS_RELEASE_QA/phone-legend.png) · [Finish control](REVIEW_CONTROLS_RELEASE_QA/review-finish-control.png)
