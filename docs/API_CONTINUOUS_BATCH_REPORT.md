# Continuous API batches — simple QA report

**App 4.1.5.51.59 · EXP3.0.2.4.3.46**

## What changed

- The entire target list runs before the dialog automatically opens Review. No intermediate acceptance or review decision is required.
- Temporary rate limits wait for the provider cooldown, then retry the same request automatically. Earlier verifier calls and completed operations stay intact.
- Retries are limited to three per request. If that request keeps failing, its question is marked for retry and the remaining batch continues. Failed output also leaves a retry entry while the other questions continue.
- Live delay changes apply to the current wait and the provider transport on the next attempt.
- Manual Pause remains in control. Stop, Save & Exit, usage/access exhaustion, or recovery-storage failure retains progress and stays on Activity with an explanation. Available proposals can still be reviewed voluntarily.
- A question with exhausted retries keeps its earlier operation checkpoint, so Resume Unfinished Work continues the missing operation.
- Question Bank changes still require explicit acceptance. Accept/Reject All, individual review, guarded undo, selective retries, and Start Over remain available.

## What I found

The previous target loop already had no question-count cap. Its temporary rate-limit handler required manual Resume, and its completion handler also switched interrupted runs to Review. The new controller handles temporary cooldowns automatically and opens Review automatically only after the target list finishes.

## Checks completed

| Check | Result |
|---|---|
| Full app regression suites | **24 passed** |
| API generation, review, recovery, and restart | **216 passed** |
| Standalone app | **11 passed** |
| API layout states across six window sizes | **180 checked; no fit/overlap issues** |

Real-controller tests use mocked provider responses. They verify a 20-question run through the actual Start button; continued generation after five ready proposals; a temporary limit after question five; an ordinary failure in the middle; and 20 combined metadata/solution questions. They also cover identical-request retry, Full quality verifier preservation, bounded repeated failures, manual Pause/Resume, Stop during cooldown, checkpoint continuation, hard usage suspension, storage failure, review/undo, and all 12 operation families.

The wider suites check manual batches, Question Bank, filters, sidebar, study workflows, and responsive/visual behavior. No paid generation calls were made. Real provider/account limits still need a hosted check with the user’s configured access.

## Preserved and follow-up

The previous .45 app and ZIP remain unchanged. Manual workspace JavaScript/CSS and API layout CSS are byte-for-byte unchanged. The integrity check confirms existing prompts, schemas, provider transports, the main database schema, and individual API actions remain unchanged outside the API review module and release labels.

The included offline simulator retains its earlier behavior; use the real app or this release’s controller QA to verify automatic cooldown continuation. The previously noted narrow-screen Close-label wrapping remains outside this behavior fix.

**App SHA-256:** `58e75d825b1b5e70e03b3485209054d46ca31aa5e5371ffd21ee9f2e90ce9e68`

Detailed evidence: `API_CONTINUOUS_QA/release-46-final/results.json`, `API_CONTINUOUS_QA/release-46-final/api-review/results.json`, `API_CONTINUOUS_QA/api-layout-results.json`, `API_CONTINUOUS_QA/standalone-final/results.json`, and `API_CONTINUOUS_QA/preservation.json`.
