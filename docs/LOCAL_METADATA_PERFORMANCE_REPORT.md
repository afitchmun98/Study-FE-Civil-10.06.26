# Local AI metadata — investigation and fix

**App 4.1.5.51.60 · EXP3.0.2.4.3.47 · October 4, 2026**

## Cause and measured improvement

The slow question metadata workflow normally made **one primary-model request**, not an unconditional primary-plus-support sequence. The expensive work was inside that request: its 4,096-token allowance let Gemma generate thousands of reasoning tokens for a short classification result. The existing `enableThinking: false` field also did not turn thinking off on this LM Studio installation.

I added request diagnostics before changing the behavior, then ran the actual app action in an isolated browser using a disposable question and the specified endpoint/model. The model's response verified the cause:

| Same question, actual app action | Before | After |
|---|---:|---:|
| Primary model requests | 1 | 1 |
| Support/finalizer requests | 0 | 0 |
| Output allowance | 4,096 | 512 |
| Prompt tokens | 1,980 | 852 |
| Completion tokens, including reasoning | 3,782 | 218 |
| Reasoning tokens | 3,556 | 0 |
| Provider request time | 72.1 seconds | 5.5 seconds |
| Analyze through preview/application | 72.5 seconds | 5.8 seconds |

The reasoning represented about 94% of the original completion. The prompt shrank from 7,908 to 4,038 characters. Two short control probes also showed the difference: `enableThinking:false` still generated 99 reasoning tokens; `reasoning_effort:"none"` generated zero. After the final metadata test, a general request without that control still generated 99 reasoning tokens, confirming that the server thinking default remained enabled.

A separate ten-question automatic metadata test completed in **one request taking 33.6 seconds**, with 1,681 prompt tokens, 1,732 completion tokens, zero reasoning tokens, and ten usable proposals. This batch used recognition-style statistics questions; it is a throughput sample rather than the same-question before/after comparison.

These are small controlled samples on `google/gemma-4-12b-qat` at `http://192.168.1.72:1234`. They establish the request/token behavior and a substantial measured latency reduction; timings will vary with question length, model cache, other server work, and hardware. No real Question Bank records were edited. The release evidence contains a compact benchmark summary and a final-source live confirmation.

## Exact question-to-save path

### Individual Metadata Reclassification

1. The Analyze with API button dispatches `selectiveMetadataAction` to `selectiveMetadataAnalyzeWithAPI`.
2. The tool freezes the question ID, selected groups, visible question context, current selected metadata, and request fingerprint. Unselected groups remain protected.
3. For Local AI, the new adapter builds the compact prompt and calls `localMetadataSelective` → `localMetadataInfer` → `callAI` → the Local route → `callLocalAI` → `fetchLocalAI`.
4. The normal OpenAI-compatible request goes to `/v1/chat/completions` using the primary model, `max_tokens:512`, temperature zero, `reasoning_effort:"none"`, and `response_format:json_schema`. No `max_completion_tokens` is sent. No general solution, diagram, verifier, worksheet, or support generator runs on this successful path.
5. The response decoder separates final content from reasoning and records usage/timing. Deterministic parsing handles common JSON formatting issues. The unchanged selective metadata validator checks exact keys, stable ID, fingerprint, requested groups, taxonomy, types, and score range. Stale content is checked before preview.
6. A valid response opens the existing before/after preview. Analyze **does not save** the metadata.
7. Apply dispatches `selectiveMetadataApplyPending` → the existing `selectiveMetadataApply`, which rechecks currentness, changes only selected groups on a cloned question, records the original metadata audit/history, and writes through `dbPut("questions", ...)` and the existing persistence guard. Active study records refresh afterward. Apply makes **zero model requests**.

### Broad legacy classification

`classifyQuestionMetadata` now uses the same efficient Local inference helper, the existing `QUESTION_CLASSIFICATION_JSON_SCHEMA`, and `parseQuestionClassification`. It then calls the existing `applyQuestionClassificationResult`. Fill/replace semantics, unit-system classification, tag ownership, confidence, provenance, and persistence remain intact. Hosted routes retain their previous path.

### Automatic API batch

`runBatchSolutions` freezes targets and calls `apiBatchExecute`. Local runs selecting **only metadata** group up to ten questions through `apiBatchProcessLocalMetadataGroup` and `localMetadataMany`. A shared taxonomy and output contract appear once; each question retains its ID and fingerprint. Results are matched by ID, never array position.

Each usable question gets its own detached proposal, original snapshot, patch, and recovery state. Nothing reaches the saved Question Bank until the existing `apiBatchResolve` / `apiBatchCommit` acceptance writer commits it. Reject/undo keeps its guard against overwriting later edits. Review opens after the entire target list is attempted. Pause, Stop, Skip, delay, Start Over, recovery, and selective retry remain available. Only the displayed question is skipped when a provider group must be aborted.

Mixed operations remain in their existing dependency order; their metadata step uses the efficient single-question path. Very long question records reduce grouping instead of truncating classification context.

## All ten investigation points

| Area | Finding / change |
|---|---|
| Requests for one regeneration | Before and after: one successful primary POST. Apply: zero. Invalid output now permits one bounded fallback. |
| Repeated primary calls | No unconditional repetition before or after. A single repair with the primary is allowed only when output fails and no separate support model is configured. |
| Support or diagram finalization | No unconditional call in the question metadata path. The new optional support call is fallback only. Diagram and solution generators are never invoked by metadata-only generation. |
| Invalid JSON | Previously the downstream parser rejected unusable metadata; generic Local transport could negotiate formats/protocols on certain errors. Now deterministic parsing runs first, then at most one output fallback for recoverable parse/schema failures. Unsafe identity/currentness failures are not repaired by guessing. |
| Output budget | Question classification and selective metadata: 4,096 → 512 per question. Ten-question response: 5,120 aggregate tokens. Local connection test: 40 → 512, with thinking disabled. General Local settings remain configurable and unchanged. |
| Reasoning control | Metadata sends the verified OpenAI-compatible `reasoning_effort:"none"`. Ollama retains its native `think:false` control. General tasks keep their existing settings/defaults. Unsupported controls allow one explicit HTTP compatibility retry and are cached for that endpoint/model. |
| Excess reasoning | Confirmed live: 3,556 reasoning tokens on the original question; zero on the optimized request. Diagnostics show whether the server honored the requested control when counts are available. |
| Context | The individual selective prompt repeated instructions and the full schema. The older broad classifier also sent up to 12,000 solution characters plus key/hint/equations. Local classification now sends the instructions, necessary visible question/choices/diagram text, required taxonomy, and minimal identity/preservation context. No question bank, examples, solutions, hints, keys, or unrelated audit data are sent. |
| Sequential work / batching | Previously automatic metadata generated one question per request. Metadata-only Local runs now use groups of up to ten: 20 questions normally use two primary requests. Mixed workflows remain sequential to preserve dependencies. |
| Unconditional support | Not found in the previous question metadata implementation. Successful metadata still uses no support call. Similar support/finalizer code elsewhere serves other operations and was preserved. |

## Fallback and retry bounds

- A successful request ends immediately after local validation.
- Fences, trailing commas, safe JSON escaping repairs, and extractable JSON containers are handled deterministically without a new model call. The code never invents a missing ID, fingerprint, or classification value.
- A recoverable invalid response permits one support inference, or one primary repair if support is not configured. This request uses the same small budget/thinking control. Prior private reasoning is not forwarded.
- A partially valid batch checkpoints valid rows before fallback; only failed or omitted rows are sent again. Their fallback models are recorded in per-question provenance.
- An unknown/duplicate ID, wrong fingerprint, or stale snapshot is rejected. Authentication/access failures, timeouts, and ordinary HTTP failures do not trigger a JSON cleanup inference.
- An explicit rejected optional HTTP parameter permits one compatibility retry per inference; rejected capabilities are cached. These rejected requests are recorded separately and may involve no model generation.
- The previously implemented API runner still performs its bounded temporary-rate cooldown retries. This behavior applies to actual rate limits rather than malformed JSON and honors Pause/Stop. Usage/access exhaustion preserves progress for an explicit Resume.

## Connection test

The previous test action explicitly sent `maxTokens:40`, overriding the 7,168-token global Local setting. That explains the previously observed `finish_reason:length`, 40 completion tokens, and 37 reasoning tokens: the tiny allowance was spent almost entirely on thinking.

The Local probe now requests `{"connected":true}` with a 512-token allowance, structured output and the metadata-style no-reasoning control. It is a connectivity probe, not a benchmark of the general output setting. Errors from a metadata reasoning-only response explain this separate allowance instead of advising a change to the unrelated general Local budget.

## Diagnostics

Open browser developer tools and run:

```js
FE_LOCAL_AI_DIAGNOSTICS.table()
FE_LOCAL_AI_DIAGNOSTICS.export()
FE_LOCAL_AI_DIAGNOSTICS.pipelines()
```

Each Local request has operation/model, global request number, pipeline request/retry number, role, support/repair flags, output allowance, requested thinking mode, prompt/completion/reasoning counts when reported, elapsed milliseconds, HTTP/finish status, and JSON/metadata validation status. Prompt character estimates are labeled estimates, never reported as measured tokens. Aggregate metadata timing is also available for failed pipelines.

The log retains the latest 200 calls and 100 metadata pipelines, lives only in memory, and resets on reload. `clear()` clears it manually. Console updates share the same request number; they are status updates for that request, not extra inference. API credentials, prompt bodies, questions, answers, and private reasoning text are excluded.

## Verification and remaining limits

Focused mocked tests cover the actual Analyze/Apply UI, budgets and thinking controls, deterministic parsing, single support fallback, primary-only repair, persistent failures, identity/currentness rejection, cached HTTP negotiation, general Local settings, broad classification, connection testing, Gemini/OpenAI/Ollama routing, two ten-question batches, reversed output order, partial failures, acceptance/undo, Stop/Resume/Skip/Pause, and conservative grouping for long context. All final gates passed on the unchanged release source (`c0d2a1bffd4a9858bf5ab490fbe7ebc7ec3426b7c931a91dbc8c116a7920e84f`):

| Verification | Result |
|---|---|
| Complete release regression gate | 25 suites passed |
| Focused Local metadata tests | 75 checks passed; no browser errors |
| API controller/recovery/review tests | 216 checks passed; no browser errors |
| API layout checks | 180 layouts; no overflow/overlap issues |
| Standalone build checks | 11 checks passed; source and built HTML match |
| Protected source/static checks | 78 checks passed |
| Final-source live single question | 1 request; 5.8 seconds; 0 reasoning tokens; preview and save succeeded |

Hosted-provider and failure-path tests use mocks; the timings above use real LM Studio inference. The isolated live browser forwarded requests to the LAN endpoint, so it validates the app payload, decoder, validators and persistence, but does not independently test LAN browser CORS/security permissions.

The live server reports one loaded processing slot (`parallel:1`) and a 141,056-token loaded context. Increasing client concurrency would queue more work and complicate cancellation without demonstrated throughput benefit. The fix keeps concurrency at one and improves work per request. I did not change the server's model loading, context, KV cache, or hardware settings. A large loaded context, model-loading time for an occasional support fallback, prompt prefill, long records, and other server users remain possible latency sources.

Other model/server versions may reject or ignore the no-reasoning control. The diagnostics expose that behavior. A thinking-only model can still fail the small metadata allowance; bounded fallback/retry preserves the question rather than silently increasing the general budget. The offline batch simulator retains its previous behavior and is not evidence for this live Local fix.

## Files changed

- `app/local-ai-metadata.js`: diagnostics, compact Local prompts, task budgets/control, parsing/fallback, single-question adapters, connection probe, batching and per-row recovery.
- `app/api-batch-review.js`: Local metadata dispatch and grouped iteration; other operation generators remain intact.
- `index.html`: synchronized modules, release labels, and five explicit diagnostic/connection/help adapters.
- `scripts/sync-batch-workspace.mjs`, `scripts/presentation-integrity.mjs`, `scripts/local-metadata-core-adapters.json`: embedding and exact reversal checks for the authorized core changes.
- `scripts/local-metadata-qa.mjs`, `scripts/local-metadata-live.mjs`: focused regression coverage and opt-in isolated live measurements.
- `scripts/api-batch-review-qa.mjs`: existing operation matrix isolates its one-question mock fixtures; the new suite tests real ten-row transport behavior.
- `scripts/release-qa.mjs`, `scripts/verify.mjs`, `package.json`: release gate, verification identity and commands.
- README/import/upload documentation and this report: release handoff and behavior contracts.

Manual workspace JavaScript/CSS and API layout CSS are byte-for-byte unchanged. The protected baseline check reverses the five explicit core adapters and strips the synchronized modules to verify that existing engines, manual/hosted prompts, metadata schemas, main database schema, and unrelated code remain intact. The .46 app and ZIP are preserved.

Evidence: `LOCAL_METADATA_QA/live-benchmark-summary.json`, `LOCAL_METADATA_QA/release-47/results.json`, `LOCAL_METADATA_QA/release-47/local-metadata/results.json`, `LOCAL_METADATA_QA/standalone/results.json`, and `LOCAL_METADATA_QA/preservation.json`.

LM Studio documents [JSON-schema structured output](https://lmstudio.ai/docs/developer/openai-compat/structured-output); Gemma documents [per-template thinking controls](https://ai.google.dev/gemma/docs/capabilities/thinking). This server's exact OpenAI-compatible no-reasoning behavior was established by the live probes and token usage rather than assumed from those documents.
