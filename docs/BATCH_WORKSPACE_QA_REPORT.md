# Batch Tools update — simple QA report

Build: **4.1.5.51.51 / EXP3.0.2.4.3.38**

## What changed

- The approved compact layout is now in the real app: **Setup → Batches → Review → Finish**.
- A joined side panel shows task progress and batch/question navigation.
- All questions in each batch are listed, with an explicit scrolling hint.
- Review decisions stay in the footer. Accepted questions can still be revisited and reversed.
- Finish shows the retry checklist and a clear **Finish Review & End Task** action.
- API Batch has Activity and Results views. Both diagram queues keep their existing controls.
- Questions awaiting a response are shown separately from actual errors in the new overview.

## What was checked

**All 22 release suites passed.** The separately delivered standalone HTML also passed seven smoke checks, including opening the actual file and resuming its batch after reload. Source, built HTML, and standalone HTML match exactly.

The focused automated suites cover **709 checks**, including:

- 20/20/5 question batches, Previous/Next/jump, and exact prompt re-copying;
- invalid and partial responses, staging without saving, Accept & Next, restore, bulk decisions, and later-edit protection;
- selective retries, rejected questions, preserved earlier decisions, and task completion;
- close/reopen, Escape, abandon confirmation, and persistence;
- all nine manual task choices, paired text/choice options, metadata groups, prompt targets, and solution profiles;
- both diagram queues, attachments, current/whole ZIP exports, skip/unskip, and reset;
- API scope/operations, activity/results, cancellation, preserved log scroll/focus, and no unwanted reopening;
- 24 real workspace layouts at 320, 375, 768, 1024, 1440, and 1920 pixels, plus keyboard controls.

The full app regression results are saved in [the release evidence](BATCH_WORKSPACE_RELEASE_QA/full-release/results.json).

The wider layout audit caught a text-field sizing rule stretching API checkboxes and radio buttons. After correcting that rule, all 340 layout records across ten screen sizes passed. Existing visual baselines also passed without being updated.

**No live AI requests were made.** API execution tests use local fixtures. Real-provider output quality was not retested because prompts and processing are unchanged.

## What stayed intact

A checksum test confirms the prior app is reproduced **byte for byte** after removing the new presentation blocks and normalizing only release labels. Existing prompts, parsers, frozen identities, guarded saving/undo, provider routing, and storage schema are preserved.

The original **EXP3.0.2.4.3.37** folder, standalone HTML, and ZIP remain available beside this release. The approved mockup is also preserved.

## Possible follow-ups

- Diagram queues still validate and save through their existing import workflow. Giving them the same staged accept/reject workflow as the other manual tasks would be a separate processing change.
- The new API panel shows the latest API batch. The complete activity history remains available at the bottom of the Question Bank.

## Files

- `index.html`: new app.
- `ui/batch-workspace.js` and `.css`: presentation source; synchronized into the standalone HTML.
- `scripts/presentation-integrity.mjs`: verifies unchanged app logic and prompt text.
- `docs/BATCH_WORKSPACE_RELEASE_QA/`: test results and screenshots.
