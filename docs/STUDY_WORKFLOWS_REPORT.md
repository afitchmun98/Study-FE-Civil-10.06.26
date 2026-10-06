# Study workflow improvements — 4.1.5.51.34

Lean-package note: this is a historical feature report. Its companion `STUDY_RELEASE_QA` raw evidence remains in the earlier full release archive, not this trimmed repository. Use `TOOLBAR_REPORT.md` and `TOOLBAR_RELEASE_QA/` for the current release.

Build: EXP3.0.2.4.3.17 / 4154034.

Authoritative entry point: `index.html`.

SHA-256: `ed7b81425ed3e572765949976c15b69a4c5132f0a85e198ae7e78dd1fb5a7aa6`.

## 1. Saved study presets

Practice now has a Saved study presets bar. Configure a session, choose **Save New**, and name the setup. **Apply** restores it without starting a session. **Manage** supports rename, updating from the current setup, and confirmed deletion.

Presets retain topics, per-topic subtopics, source/type selections, difficulty range, question count, repeat/answered/flagged restrictions, shuffle options, and feedback/presentation settings. They do not change global AI provider configuration or explicit provider routes. Duplicate names are rejected and storage failures are reported without replacing existing presets. Up to 100 presets are supported.

## 2. Active filter summary

Question Bank shows removable chips immediately above the result-count footer when filters are active. This includes search, sources, topic, difficulty, question type, flags, solution/review/AI-data restrictions, and non-default sorting. Each chip removes only its own restriction. Long labels have full accessible names and tooltips; the strip scrolls horizontally instead of increasing the toolbar height.

The original single-row toolbar remains. Source selection updates the results, chip strip, and counts without remounting the open picker. Global Clear now also resets the AI-data restriction.

## 3. Actionable no-match guidance

Practice and Question Bank explain empty filtered results. Suggestions are calculated by trying one relaxation against the existing filters, and show the number of questions that would become available. Examples include widening difficulty, including previously answered questions, clearing source/type restrictions, or removing a specific bank filter.

No changes occur until an action is selected. If several restrictions must change together, the UI offers a complete matching-filter reset. Practice retains question count and presentation settings when resetting matching filters. Selecting no topics now correctly yields no matching questions instead of treating an empty selection as all topics. An empty bank offers Import Bank.

## 4. Unfinished-session recovery

Practice and Exam sessions save locally while in progress. **Exit** saves and returns home; it no longer discards unfinished responses. Home, Practice, and Exam show **Resume Session** and a confirmed **Discard** action. Starting a different session requires confirmation before replacing an existing recovery copy.

Recovery preserves the presented question and answer order, selected answers, current question, flags, scratchpad, revealed solutions, tools visibility, timer, pause, and break state. A full checkpoint is stored in a separate IndexedDB database; a compact local-storage journal catches recent answer/note changes. Journal recovery checks that its answer presentation matches the full checkpoint. Malformed journals fall back to the valid full checkpoint.

Running timed exams count time away against the remaining time. Paused exams remain paused. Scheduled break time is consumed before additional time is deducted from the exam clock. An expired exam submits its saved responses when the user resumes it. Practice does not add time spent away from the app.

Completed answers, progress, and results commit in one transaction. A failed submission rolls back and leaves the session open for retry, preventing partial progress writes and duplicate answer counts. Successful submissions remove the recovery copy; initialization also suppresses recovery for an already-completed result.

The save status is visible in the session header. If recovery storage fails, the user is warned and Exit keeps the session open rather than silently losing work.

### Storage boundaries

- These conveniences are local to the browser and origin. They are not Firebase/Drive sync features.
- The main app database remains version 4; recovery uses a separate `FE-Civil-Study-Recovery` database, version 1. Presets use a separate local-storage key.
- Use one active study tab at a time; this is a single unfinished-session slot, not a multi-tab collaborative session manager.
- Clearing site data, private-browsing cleanup, changing browser/origin, or browser eviction can remove local presets and recovery. Existing portable HTML and backup exports do not include these new convenience stores. Do not treat them as a cloud backup.
- Recovery does not claim that a save succeeded when its database write failed. A crash before the first successful checkpoint may still prevent recovery.

## 5. Release regression gate

`npm run test:release` runs static integrity checks, the new workflow suite, the existing UI and dropdown suites, responsive interaction checks, the ten-resolution geometry audit, and visual screenshot comparison. It fails on the first failing suite and saves logs/results. `npm run release` builds only after the gate passes.

The workflow suite exercises a real JSON file import, source filtering, practice, refresh recovery, saved results, and selected-question JSON export. It also tests preset CRUD/persistence and failure handling, targeted no-match actions, atomic result rollback, timed/paused/expired exam recovery, malformed journals, and recovery write failures.

Twelve reviewed screenshot baselines cover Practice, Session Setup, no-match guidance, and active bank filters at 375, 768, and 1440 pixels. The comparison creates actual/difference images and fails on meaningful pixel changes. A deliberate 80-pixel card offset was rejected in a negative-control test. Baseline updates require explicit review and are disabled in the release gate.

The app remains a standalone, zero-runtime-dependency HTML application. Browser testing requires Playwright, pngjs, pixelmatch, and Chrome. See `tests/visual-baselines/README.md` for setup and comparison limits.

## Validation

Release-gate logs and results are included under `docs/STUDY_RELEASE_QA/`. Earlier UI/audit reports retain their original build identities and are historical evidence.

All eight release suites passed:

| Suite | Result |
| --- | --- |
| Static integrity and syntax | 47 checks passed |
| Study workflow and recovery | 50 checks passed; no browser exceptions |
| Existing UI/motion regression | 141 checks passed |
| Repeated dropdown reopening | 88 checks passed |
| Large-list dropdown scrolling | Passed, including 48-option lists and direct-file loading |
| Responsive interactions | 93 checks passed across 36 toolbar widths, icon rail, and keyboard sliders |
| App-wide responsive geometry | 320 view/size combinations; zero detected layout issues or browser exceptions |
| Visual comparison | 12 of 12 snapshots passed |

The geometry sweep covers 320×568, 375×812, 600×900, 768×1024, 844×390, 1024×768, 1280×800, 1440×900, 1920×1080, and 2560×1440. The built `dist/index.html` is byte-identical to the standalone entry point.

An additional smoke check opened the actual standalone HTML through `file://`, saved an answer and scratchpad, refreshed and resumed, then refreshed immediately after typing another note. Both the selected answer and latest note were restored. At 375 pixels, Exit produced an in-bounds recovery banner with an accessible Resume action.

## Boundaries

No deployment was performed. Question content, AI prompts, provider credentials/routing, Firebase configuration, and Drive integration were not changed. This is local Chrome testing with isolated fixtures, not live-provider/cloud validation or exhaustive Safari/Firefox/device coverage. The separate Gemini Drive-import prompt remains a future integration task.
