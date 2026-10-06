# Batch Tools follow-up QA — EXP3.0.2.4.3.27

## Changes

- AI Batch Tools shows one status message inside the dialog, directly below its header. Quick actions replace that message instead of stacking notifications over question text. Error and warning colors remain distinct.
- Copy and Copy Next messages use the actual Manual Copy/Paste task name. Answer Choices and metadata messages no longer call their questions solution packages.
- The three broader toolbar/search tests now check the current Question Bank design: Question Type and Flag on the toolbar, specialised Sort in More filters, the selection menu available at zero, and search applied only on Search or Enter. The search workflow still verifies removal of the search filter and export of the matching selected questions.
- The full responsive sweep exposed a narrow mobile header overflow. At 480 CSS pixels and below, the Gemini and ChatGPT links show their marks without text labels; their accessible button names remain available.
- The study recovery test now waits for the asynchronous checkpoint banner before asserting its presence. No recovery behavior was changed.

## Verification

- **Full release gate: 11 of 11 suites passed.** This includes source checks, toolbar interactions, Bank table and workspace checks, study workflows, UI regression, popovers, dropdowns, responsive interactions, full responsive geometry, and visual snapshots.
- **Focused Batch Tools: 93 assertions passed.** This covers task wording, rapid notification replacement, mobile notice placement, 20-question batches, navigation, retry, import, review, and task exit.
- **Metadata batch regression: 63 assertions passed.**
- **Visual comparison: 12 of 12 passed.** Only the four 375-pixel images changed after reviewing the icon-only mobile header.
- **320- and 375-pixel responsive audit: no geometry issues.** The full release audit also passed at all ten tested viewport sizes.
- `index.html` parsed successfully, the standalone build matched it byte for byte, and package checksums passed.

The browser tests use local fixtures and do not call ChatGPT, Gemini, or another live AI provider. The app's existing copy/paste contracts and database version remain unchanged.
