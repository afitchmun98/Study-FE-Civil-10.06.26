# Batch Tools update — simple QA report

Build: **4.1.5.51.54 / EXP3.0.2.4.3.41**

**Result: Passed.**

## What changed

- Copy controls, batch questions, and the response editor stay together in one card. **Go to paste** scrolls to the editor; it does not open another screen.
- The question list starts collapsed. Expand it to select questions, with **Select all**, **Clear selection**, and **Copy selected prompt**.
- Selected copies create a fresh, separately tracked batch. Earlier batches and accepted content remain available. Returned changes still require review before saving.
- Question numbers, IDs, previews, checkboxes, and status labels line up consistently.
- Drafts and checkbox selections survive moving between batches and task stages while the app stays open. Clear pasted text affects only the current editor.
- Task buttons have matching widths. The copied-batch dropdown replaces the redundant second list of batch cards.
- A fresh copy of an accepted question correctly asks for its new response before review.

The existing theme, navigation, review, guarded undo, retries, finish, abandon, API workflows, and diagram queues remain available.

## QA results

| Check | Result |
|---|---|
| Complete release gate | **23 of 23 suites passed** |
| New inline copy/paste and selection workflow | **42 checks passed** |
| Existing batch workspace | **117 checks passed** |
| API and diagram queues | **118 checks passed** |
| Manual review and guarded undo | **276 checks passed** |
| Batch layout sweep | **288 states passed** |
| Wider app layout sweep | **340 records passed** |
| Existing visual baselines | **12 of 12 passed** |
| Delivered standalone HTML | **9 checks passed** |

The batch sweep checks six window sizes, including 320-pixel phones and short landscape windows. It covers all nine task setups, 17 proposal-review paths, copy/paste, retries, finish/abandon, diagrams, and API setup/activity/results. Checks cover overflow, button overlap, adjacent navigation, readable statuses, usable scrolling space, and matching question columns. Screenshots are also inspected in light and dark themes.

The new workflow test uses 50-question and 20-question fixtures. It checks selected copies, original prompt preservation, draft retention, malformed responses, per-batch import identity, review before saving, and copying previously accepted questions.

QA caught and fixed checkbox restoration, direct entry into paste when the dialog was closed, and stale next-step guidance after copying an accepted question.

[Notes for a later update](BATCH_INLINE_FOLLOW_UP_NOTES.md) cover math snippets and legacy history timestamps.

## Preservation and limits

The previous **.40, .39, .38, and .37** builds remain separate and retain their original app checksums. A checksum check confirms that prompt templates, parsers, validation, guarded saving/undo, provider routing, and storage code are unchanged outside the presentation layer. The source, built app, and standalone file match.

Tests use isolated question data and API fixtures. No live provider requests or edits to the user's question bank were made. Unsaved editor drafts and row selections are retained during in-app navigation; this update does not add draft persistence across a browser reload.

[Release results](BATCH_INLINE_RELEASE_QA/release/results.json) · [Standalone results](BATCH_INLINE_RELEASE_QA/standalone/results.json) · [Artifact verification](BATCH_INLINE_RELEASE_QA/artifact-verification.json) · [Previous builds](BATCH_INLINE_RELEASE_QA/preservation.json)
