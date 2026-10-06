# API batch recovery — simple report

**4.1.5.51.56 · EXP3.0.2.4.3.43**

## How to pick up where you left off

1. Click **Save & Exit** to stop generation and keep the task. **Stop Batch** also keeps it. The top **Close** button continues to hide the window while an active run keeps going.
2. Reopen Question Bank → Tools → AI Batch Tools → API Batch.
3. Choose **Resume Unfinished Work** to continue generation, or **Resume API Review** to return to your proposals and decisions.

The app saves a checkpoint after each completed operation. Resuming skips completed operations and fully processed questions. Accepted and rejected questions keep their decisions. If you accepted a partial proposal, its remaining operations can still be resumed; later acceptance and rejection retain the original undo history.

## When API usage runs out

Recognized credit, spending, usage, daily quota, or access errors suspend the task at the first failure. Earlier proposals and decisions are kept. Update the API key or task route in Settings, or wait for access to return, then resume explicitly. The resumed operations use the currently configured routes; existing explicit task overrides remain authoritative. Changing a key does not necessarily restore a shared account allowance.

Temporary rate limits keep the existing Pause/Resume and cooldown behavior. A saved cooldown is respected when continuing an unfinished task. The app does not keep retrying usage exhaustion or automatically restart paid work after a reload.

[Official OpenAI error guidance](https://developers.openai.com/api/docs/guides/error-codes) distinguishes temporary rate limits from credit, spending, and usage limits.

## Checks

The targeted API recovery suite passed **157 functional checks**, including all 12 operations and the existing review workflows. New checks cover operation checkpoints, Save & Exit, resuming without duplicate completed work, accepted partial proposals, combined undo, keeping rejected decisions, stale checkpoints, exhausted usage, reopening after a reload, current provider/key routes, and failed checkpoint storage. API responses are mocked; no paid requests are made.

All **24 release regression suites passed on the final, unchanged source**, covering the existing manual batch tools, bank/filter/toolbar controls, sidebar, study tools, responsive layouts, and visual comparisons. Results are in `API_BATCH_RECOVERY_QA/release-43/results.json`. The standalone smoke check passed **11 checks**; its results are in `API_BATCH_RECOVERY_QA/standalone/results.json`. Larger screenshots and logs remain in the working delivery folder.

The separate interactive demo also includes **Save & Exit**, **Resume Unfinished Work**, and an **API usage exhausted on question 3** scenario. Its **113 checks** passed, including offline use and eight window sizes.

## Limits

Recovery is local to the same browser and app origin. Clearing browser storage removes the task. Provider keys are not stored in the review ledger; session-only keys must be entered again after a reload. An interrupted operation without a saved result can need another API request; checkpointing does not guarantee that the provider never charged for the cancelled request. A later question edit invalidates an old checkpoint and requires an explicit fresh Retry. A failed browser storage write stops generation and is reported rather than being described as saved.

Earlier .42 files remain preserved. Prompt templates, response schemas, provider transport code, manual batch logic, and the main app database schema are unchanged. The new source SHA-256 is:

`85da2e4365ee11936c34dc3ffe517fec1329807b37418ca384f0d006791a08eb`
