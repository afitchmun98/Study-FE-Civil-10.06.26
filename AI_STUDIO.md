# Google AI Studio Import Guide

## Import

1. Upload this folder's contents to the root of your GitHub repository, or create a repository from this folder and push the `main` branch. See `GITHUB_UPLOAD.md`; do not upload the ZIP itself or nest the named wrapper folder inside the repository.
2. Open Google AI Studio and enter Build mode for a web app.
3. In the prompt input, choose **Add files (+) → Import from GitHub**.
4. Select the repository and let AI Studio install and preview it.
5. If AI Studio asks how to run the app, use `npm run dev`. The server binds to `0.0.0.0` and honors the injected `PORT` environment variable.
6. Run `npm test` after any AI Studio edit. The test fails if the reviewed `index.html` bytes, build identity, database version, scoped Gemini delivery rule, or JavaScript syntax changes.

## Preservation boundary

The current app is a deliberate standalone HTML application. Importing it does not authorize conversion to React, splitting `index.html`, migrating persistence, moving browser-held provider configuration to new code, or changing prompts and parsers. Use the supplied import prompt to tell AI Studio to preview the exact artifact first. The separate Google Drive question-bank prompt authorizes only that narrowly scoped follow-up integration.

Google AI Studio can inject `GEMINI_API_KEY` into server-side projects, but this wrapper does not add a new server-side Gemini path because provider routing is frozen in this build. No secret is required merely to preview the app or exercise its Manual Copy/Paste workflow.

This build adds staged automatic API review and scoped request pacing. Preserve `app/api-batch-review.js` and `ui/api-batch-review.css`, and use `npm run sync:batch-workspace` after authorized edits to embed them into the standalone file. Keep the existing app database schema intact; API review tracking uses its own local database. The new runner does not save proposals until accepted. Hosted transports return rate-limit failures to the batch controller instead of silently retrying; Local AI retains protocol fallback.

The .46 API runner attempts the entire target list before automatically opening review. Temporary rate limits are handled by its explicit cooldown and retry loop; each hosted transport call remains single-attempt. It retries only the same provider request, up to three times, preserving earlier verifier and operation results. Manual Pause remains authoritative. Repeated temporary failures mark a question for retry and continue the remaining targets. Usage exhaustion, access errors, user Stop, and storage failures retain saved progress; none requires reviewing proposals before resuming generation.

Hosted validation remains a separate gate. Import readiness does not substitute for the real-provider and persistence checks listed in `docs/HOSTED_VALIDATION.md`.

## Local metadata performance

This release contains the verified Local metadata controller in `app/local-ai-metadata.js`, embedded in `index.html`. Keep its per-task budget/thinking controls separate from the general Local settings. Metadata-only automatic runs group up to the selected 1–20 questions (default ten) and stage results for explicit review. See `docs/LOCAL_METADATA_PERFORMANCE_REPORT.md`. The isolated live benchmark is opt-in (`scripts/local-metadata-live.mjs`) and uses the endpoint configured in that script; standard QA uses mocks.

Preserve `app/batch-approval.js`, the selectable approval groups in both review tools, bounded checkpoint/redraw work, decision journal/undo recovery, and the per-run Local metadata request size. Read `docs/STAGED_APPROVAL_REPORT.md` and run `npm run test:approval` plus the release gate before authorized changes. Keep the original per-question save/currentness guards and do not restore per-question full-session serialization/redraws in bulk approval.
