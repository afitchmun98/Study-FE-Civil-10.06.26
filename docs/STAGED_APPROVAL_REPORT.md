# Staged approvals and selectable Local API request size

**App 4.1.5.51.61 · EXP3.0.2.4.3.48 · October 5, 2026**

## How to use it

In either API or Manual review, choose **Approval group size** (10, 25, 50, 100 or 200; default 50), then click **Approve next**. It approves that many waiting proposals in the original selection order. Accepted, reviewed, rejected and invalid proposals are skipped. The last group can be smaller. Review navigation and individual Accept/Reject remain available afterward, including undoing accepted changes.

**Accept All** still follows the existing eligibility rules, but now saves in groups instead of redrawing and copying the whole session for every question. Reject All also uses groups. While either runs, progress shows saved/checks/attention counts; **Stop saving** finishes the current question and leaves the rest untouched. Escape requests the same stop. Conflicting task actions are locked until saving and its checkpoint finish. No approval action makes a model request.

In API Setup, **Local metadata batch size** chooses 1–20 questions per request (default 10). This applies to Local metadata-only generation. The chosen size is remembered and frozen into the run, including recovery/retry. Large question context can reduce an actual group, and the last group may be smaller. Mixed workflows and other operations/providers continue using individual requests, preserving their existing dependencies and output contracts. The API runner still attempts the entire target list before automatic review; this option does not introduce intermediate review pauses.

Approval group size and generation request size are separate controls: one determines how many proposals you save at a time; the other controls how many Local metadata questions share a model request.

## What caused the approval slowdown

The API bulk loop called the individual decision function for each question. That function copied/persisted the complete review run and called `renderApp()` every time. For 2,000 proposals that meant about 2,000 complete-session copies and redraws.

Manual bulk decisions already avoided per-question redraws, but their helpers repeatedly normalized/deep-cloned the entire ledger and serialized it into localStorage. This multiplies work as the review grows. localStorage writes also silently failed when a large session exceeded its quota.

The fix retains the original guarded per-question writers. Inside an exclusively locked approval job it reuses normalized live ledger objects, defers full review checkpoints/redraws, and yields to browser input every five decisions. A small decision journal saves each result and undo patch before the worker advances. A complete session checkpoint is saved after each group; only one final app redraw occurs.

Large manual review recovery uses a separate IndexedDB approval store and a small legacy-key pointer, so it does not serialize a huge review into localStorage repeatedly. Subsequent individual decisions wait for their recovery write before controls unlock. On reload, the app restores the saved session and any journaled decisions from an interrupted group. API proposals continue using the existing API review database; the separate journal stores only the in-flight decisions and run identity and is cleared after their checkpoint completes.

## Preservation and limits

Question Bank database version, metadata schemas, provider routing, inference budgets/thinking controls, manual prompts, currentness/stale checks, protected-field merges, and existing undo guards are preserved. The .47 app and ZIP remain byte-for-byte unchanged. A large .48 manual approval checkpoint requires this version or later for review recovery; saved Question Bank records remain compatible with the previous version.

The new large-session recovery starts when grouped approval is initiated; earlier manual imports/prompt queues retain their existing persistence. This fix bounds approval work, not the size of the loaded proposal collection. Very large reviews containing many embedded images or long solutions still require browser memory/disk space. The stress timings below use compact question fixtures and a deliberately large saved manual prompt. They are verification samples rather than guaranteed times for arbitrary question banks. Browser storage failure stops approval and reports the error instead of continuing silently. Bank and review journal writes use separate transactions; a browser/process crash in the narrow interval between those writes can leave a saved question whose review decision was not journaled. Its later currentness check protects the saved record from blind reapplication.

## Verification

The final release results are in `STAGED_APPROVAL_QA/release-48/results.json`. The focused suite exercises real question writers using an isolated browser with no provider calls:

- 2,000 API approvals and 2,000 manual approvals; all question changes saved.
- Group limits, smaller final groups, disabled state when no waiting proposals remain, remembered size, and skipped rejected/invalid proposals.
- Accepted-question undo; stale proposals preserve later edits while remaining valid questions continue.
- Stop during an in-flight save, continue later, reload between groups, and reload during a group with the prior decisions/undo restored.
- A six-megabyte manual prompt exceeding localStorage capacity, followed by reload and reversal of accepted changes. Finishing that review clears its recovery marker immediately, including when disk cleanup is delayed and the page is reloaded at once.
- Dedicated Question Text review, desktop/phone layout, and absence of browser/provider errors.
- Actual metadata request construction at selected sizes 1, 3 and 20, including stable-ID matching, aggregate budgets and all 23 target questions reaching review.

The final source (`00356c5c6c5c6c407f35fa7fb17db708702e2ed041a55caa6cbc8fb1beeff7fc`) passed 42 focused approval checks and 81 Local metadata checks. The 2,000-question API fixture took 3.8 seconds including setup, using 40 full-session checkpoints and one app redraw. The 2,000-question manual fixture took 2.9 seconds, using 41 full-session checkpoints (including its initial recovery authority) and one redraw. Both made zero provider calls. All 26 wider release suites passed on that unchanged source, including 216 API controller checks. The standalone build passed 11 checks, and the API/approval layouts passed 216 states with no layout issues. Static/protected-source verification passed 79 checks. No paid or live Local model calls were made for this release’s approval tests. The complete regression gate also covers all API operations, manual tools, generation Stop/Pause/Skip/Resume, recovery, filters, Question Bank, study workflows, and visual baselines.

## Changed files

- `app/batch-approval.js`: controls, grouped approval worker, live-ledger reuse, decision journal, recovery, locking/Stop and API request-size setting.
- `app/api-batch-review.js`: optional per-decision checkpoint/render deferral, and freezing the selected request size into configuration.
- `app/local-ai-metadata.js`: use the configured per-run group limit, retaining the context-size safety reduction.
- `ui/api-batch-review.css`: shared responsive approval controls scoped to the new UI.
- `index.html`: synchronized modules and release identity.
- `scripts/batch-approval-qa.mjs`, `scripts/local-metadata-qa.mjs`: staged approval stress/recovery QA and request-size transport coverage.
- Sync, integrity, release/verification scripts, package metadata and handoff documentation.
