# API Batch update — simple QA report

**App 4.1.5.51.57 · EXP3.0.2.4.3.44**

## What changed

- **Start Over**, beside Close, resets an API task from Activity, Review, Finish, or saved-task Setup. It also works during Pause, an active Retry, or API usage suspension.
- Confirming stops generation, waits for the worker and saved writes to settle, then discards that task’s unaccepted proposals, checkpoints, and review history. Accepted Question Bank changes stay saved. The confirmation explains that the task’s undo history is also cleared. Cancel keeps the task.
- Review saves finish before restarting is allowed. Inputs lock while restarting. Closing during restart stays closed. A storage deletion failure keeps the task and shows an error.
- API panels use tighter spacing, a narrower overview, and fewer separate rows. Request pacing sits beside activity on wide screens. Previous/Next stay adjacent to the question selector. Longer saving and resume explanations expand on demand.
- The separate offline simulator demonstrates the same restart behavior.

## Checks completed

| Check | Result |
|---|---|
| API generation, review, recovery, and restart | **181 passed** |
| Full app release regression suites | **24 passed** |
| Standalone app smoke checks | **11 passed** |
| Offline simulator checks | **124 passed** |
| API layout states across six window sizes | **156 passed; no fit/overlap issues** |

The API checks use mocked provider output with the real app generators, parsers, and guarded bank commits. They cover all 12 operations, acceptance and undo, bulk decisions, pacing, pause/stop/skip, retries, saved checkpoints, usage suspension, storage failures, and restart in active and saved states. They verify that restart keeps accepted fields, stops later requests, deletes the recovery ledger, stays deleted after reload, and permits a fresh run.

The full release suites also check manual batches, navigation, import/review, Question Bank controls, filters, sidebar, study sessions, and responsive/visual behavior. No live generation calls or paid API usage were made.

## Space comparison

With identical fixtures at 1440 × 1000 pixels, the activity panel is **45% shorter**, the overview **29% shorter**, review **9% shorter**, and setup **7% shorter** than .43. Readable text and controls remain; smaller screens wrap into one column.

## Preserved

The previous .43 standalone app and ZIP remain unchanged. Manual workspace JavaScript/CSS are byte-for-byte unchanged. The integrity check confirms that existing prompts, provider routes, parsers, and database schema remain unchanged outside the API module and release labels.

Accepted data remains in the Question Bank. Recovery remains local to the same browser and app address. Start Over clears a task; it does not revert accepted data. Live provider response quality and account limits were simulated in these tests.

**App SHA-256:** `fe64b359c14dae7aee78b7434bd4b10346ad4c78f46b30bebd43d0ab3412965a`

Detailed evidence: `API_BATCH_RESTART_QA/release-44/results.json`, `API_BATCH_RESTART_QA/release-44/api-review/results.json`, `API_BATCH_RESTART_QA/standalone/results.json`, `API_BATCH_RESTART_QA/demo-results.json`, `API_BATCH_RESTART_QA/compact-measurements.json`, and `API_BATCH_RESTART_QA/preservation.json`.
