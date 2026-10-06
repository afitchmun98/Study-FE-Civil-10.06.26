# Manual Batch Tools task exit — EXP3.0.2.4.3.24

## Change

- Active Manual Copy/Paste tasks now show **Abandon Task** in the workspace and whole-selection review. A confirmation shows how many unaccepted changed proposals will be discarded. **Keep Working** returns without changing the session. **Discard Pending Work & End Task** clears the session, staged proposals, retry state, and copied-batch tracking.
- Dedicated Question Text batching has the same confirmed abandon path. Its unsaved inline paste draft is also cleared.
- Guided Question Text and Question/Solution Diagram queues now show **Abandon Queue**. Confirmation explains that queue tracking and unreviewed work are discarded.
- Already accepted or directly saved question changes remain in the Question Bank. The selected Question Bank rows remain selected. API Batch already has **Cancel Batch** and was not changed.

## QA/QC

- `scripts/manual-metadata-regression.mjs` passed 63 Chrome assertions. New cases covered an incomplete 20-question task, staged Answer Choices proposal, confirmation copy, Keep Working, confirmed discard, saved question data, selection retention, dedicated Question Text staging, and cancel/confirm behavior for guided queues.
- `scripts/verify.mjs` checks JavaScript parsing, build identity, the exact source hash, and the exit controls in addition to the existing static invariants.
- The browser test uses synthetic question records. It does not exercise a live external AI service.
