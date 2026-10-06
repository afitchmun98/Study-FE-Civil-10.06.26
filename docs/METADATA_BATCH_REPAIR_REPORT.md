# Metadata batch repair — EXP3.0.2.4.3.22

## What changed

- Manual metadata reclassification now sends one shared Topic/Subtopic taxonomy and a concrete JSON response scaffold for the batch. Each result's question ID, revision, package fingerprint, and request fingerprint are prefilled in that scaffold.
- The importer accepts one fenced JSON block with optional surrounding ChatGPT text and common per-question envelope placements. It checks the frozen identities before staging any classification. A malformed or duplicated question result is isolated, so valid siblings can still reach review.
- Valid metadata proposals stay staged until explicitly accepted. **Review Changed Questions** shows only changed proposals, even while other selected questions remain unprocessed or need retry. **All Selected** remains available inside review. Ending a task with staged changes offers the review path first.
- The collapsed desktop sidebar hides expanded labels and keeps icon navigation usable. The Manual AI Batch Tools dialog can use a wider and taller viewport area.

## Verification

- `scripts/manual-metadata-regression.mjs`: 27 browser assertions passed, including a 20-question batch, partial response, alternate response placement, malformed and duplicate item isolation, early review, and protected question content on Accept.
- `scripts/ui-regression.mjs`: the new collapsed rail and dialog-bound checks passed in Chrome. The broader script later stopped at a desktop **More filters** count assertion, outside the changed sidebar and dialog paths.
- `scripts/verify.mjs`: static checks and main JavaScript parse passed after registering this build's hash.

Question text, choices, answer keys, solutions, study progress, and the IndexedDB schema were not changed by the metadata batch repair. Accept still writes only authorized metadata fields.
