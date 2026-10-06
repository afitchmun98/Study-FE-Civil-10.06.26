# FE Civil Practice Lab — Staged approvals

**App 4.1.5.51.61 · EXP3.0.2.4.3.48**

Both review tools now offer **Approval group size** and **Approve next**. Choose 10, 25, 50, 100 or 200 questions per approval group. Accept All and Reject All also save in stages, show progress and allow **Stop saving**. Decisions retain their existing undo and stale-edit protection. Large manual review checkpoints use IndexedDB instead of exceeding localStorage limits.

API Setup also provides **Local metadata batch size**, from 1 to 20 questions per request, default 10. The chosen size is remembered and preserved when resuming a run. This applies to Local metadata-only operations; mixed workflows and other providers/operations still process questions individually. Generation continues through the full target list before automatic review.

Read the [staged approval and QA report](docs/STAGED_APPROVAL_REPORT.md). The previous .47 build and ZIP are preserved. Existing Local metadata reasoning/output controls, general budgets, hosted/manual prompts, schemas, provider routing and Question Bank persistence remain intact.

## Local metadata diagnostics

Read the [investigation and QA report](docs/LOCAL_METADATA_PERFORMANCE_REPORT.md) for the traced click-to-save path, call counts, measured tokens, fallback rules, and limitations.

Open browser developer tools and run:

```js
FE_LOCAL_AI_DIAGNOSTICS.table()
FE_LOCAL_AI_DIAGNOSTICS.export()
```

The bounded log records operation, model, request/retry number, measured prompt/completion/reasoning tokens when provided, output allowance, duration, validation, and fallback role. It excludes API credentials, prompt bodies, and reasoning text. Logs reset on reload; `clear()` clears them manually. `pipelines()` gives aggregate metadata timing. Character-based prompt estimates are labeled separately when the server omits actual token counts.

Successful metadata requires no support call. Deterministic parsing handles common JSON formatting problems first. One support fallback (or one repair with the primary model if support is unconfigured) is allowed for unusable output. HTTP compatibility rejections permit one cached negotiation retry; identity mismatches, stale snapshots, authentication failures, and request timeouts do not trigger output repair. The existing bounded temporary-rate retry behavior of the API runner is retained.

Local metadata batches retain the existing per-question Accept/Reject review, undo, Pause, Stop, Skip, recovery, and selective retry. Only metadata-only Local runs are grouped. Mixed operations retain their dependency order and use the efficient single-question metadata request. Unusually large records reduce grouping instead of truncating question context. Requests remain serial; the measured LM Studio instance advertises one processing slot.

The Local connection test now requests short structured JSON with reasoning disabled and a 512-token allowance, instead of the former hard-coded 40 tokens. The configurable general Local budget remains unchanged.

## Using API Batch

1. Open Question Bank → Tools → AI Batch Tools → API Batch.
2. Choose the scope, operations, and seconds between API requests. The default delay is one second; your chosen delay is remembered.
3. Generate proposals. Activity processes every question without intermediate review checkpoints. Temporary rate limits wait for the provider cooldown and retry the same request automatically, up to three times. Repeated failures mark that question for retry and continue the remaining batch. Pause/Resume, Skip Current Question, Stop Batch, and the editable request delay remain available.
4. Review the original and proposed content. Accept & Next saves and advances. Previous/Next and the question selector let you revisit decisions. Reject can restore accepted fields while protecting later edits. Accept All and Reject All are also available.
5. Finish & Retry lists questions needing attention, with selected checkboxes, Select all, and Clear all. Retry only your chosen questions, or Finish Review & End Task.

Closing the dialog preserves drafts and allows an active run to continue. Reloading the app recovers the task without restarting API requests. Use Resume API Review to return to review, or Resume Unfinished Work to continue generation. Save & Exit stops generation and saves the task for later. Usage, spend, or credit exhaustion suspends the run immediately; update API access in Settings before resuming. Completed operation checkpoints avoid rerunning earlier work. Finish retains accepted changes and clears only this task’s tracking; discarding unfinished proposals requires confirmation.

Review opens automatically after the entire target list has been attempted. You can open available proposals earlier while generation continues. Stop, usage suspension, or storage failure stays on Activity with its reason and recovery controls; review is optional. Saved questions still change only after explicit acceptance.

## Starting over

**Start Over** appears beside Close whenever an API task exists. It works during generation, Pause, Retry, saved recovery, review, and usage suspension. Confirming stops the worker and clears that task’s unaccepted proposals, checkpoints, and review history. Accepted Question Bank changes stay saved; clearing the task also removes its undo history. Cancel keeps the current task. No new API requests start until you choose operations and click Generate Proposals again.

The API workspace now uses tighter spacing, a narrower overview, side-by-side request pacing on wide screens, and a combined question navigator. Longer saving/resume explanations are expandable. Controls retain readable labels and wrap on smaller screens.

## Operation setup

Metadata, Solutions, Question content, and Diagrams and AI data share one aligned list. The original 12 operation controls and their settings remain available. Metadata groups and solution generation settings appear below the relevant options. Solution Diagram context appears when Generate solution diagrams is selected; hiding it preserves its chosen value. Instructions expand under “How this batch works,” freeing the former sidebar for the operation controls. Narrow windows stack the choices.

## GitHub / Google AI Studio

Extract the ZIP and upload its **contents** to your repository root. Use `AI_STUDIO_IMPORT_PROMPT.md` after importing the repository into AI Studio. See [import instructions](AI_STUDIO.md) and [GitHub upload notes](GITHUB_UPLOAD.md).

```bash
npm test
npm run build
npm run dev
```

Node.js 20+ is required. The preview server honors `PORT`; `index.html` also works as a standalone app. Building creates `dist/index.html`. Runtime and build commands require no npm dependencies. Browser QA requires Playwright and Chrome as documented in the test scripts.

## Verification

Read the [staged approval report](docs/STAGED_APPROVAL_REPORT.md) and the historical [Local metadata report](docs/LOCAL_METADATA_PERFORMANCE_REPORT.md). The release gate includes the new API tests and the existing manual batch, Question Bank, filters, sidebar, study, and visual regression suites. API QA uses mocked provider responses with the actual generators and validators; no paid API requests are made. This release also includes the controlled live LM Studio measurements; hosted provider QA uses mocks.

Historical reports retain their original release identities. Provider routes, app database schema, Firebase configuration, manual batch behavior, and individual API actions outside this metadata/connection fix are preserved. API proposals use a separate local IndexedDB review store; they are not added to the saved Question Bank until accepted. Review tracking contains no provider keys and is local to the current browser/origin.
