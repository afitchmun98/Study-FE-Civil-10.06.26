# Solution status update — EXP3.0.2.4.3.28

App version: **4.1.5.51.41**. Based on the delivered `.27` release.

## What changed

- **Green:** a saved solution is present. It does not certify mathematical correctness.
- **Yellow:** review is recommended because the question changed, the answer cannot be mapped confidently, the key is missing, or math formatting may obscure the solution.
- **Red:** the solution maps to a different choice than the stored answer key.
- **Gray:** no saved solution.
- The **Solution indicator** filter, **Review Priority** sort, and **Solution** column sort use this same definition. Priority is red, yellow, gray, then green; clicking the column again reverses it.
- **Reviewed — solution still applies** clears a changed-question warning for the reviewed content. **Undo review** restores it. Another question, choice, key, context, or solution edit expires the confirmation. Flag and timestamp changes preserve it.
- Imported solutions without AI fingerprints can be green. A failed or historical replacement attempt describes that attempt and does not itself change the saved solution's dot.
- Normal decimal precision is supported: **8.336 matches 8.34**. Units, sign, and ambiguous choices still receive appropriate comparison checks. Whole-number rounding requires approximation context. Solution prompts explicitly explain these rules and retain independent solving.
- Gemini and ChatGPT buttons fit in equal-width sidebar columns. Names stay accessible in the collapsed rail and mobile icon buttons.
- Fixed a small desktop toolbar overflow also reproduced in `.27`; the search field can shrink enough to keep the Question button visible.

## QA results

**All 14 release suites passed.**

- 68 solution indicator, rounding, review, filter, sorting, and sidebar checks.
- 93 Batch Tools UI checks and 63 metadata batch regression checks.
- 146 wider UI checks; bank, table, toolbar, study, menu and responsive suites passed.
- All 12 screenshot comparisons passed with the existing baselines.
- Responsive audit: 340 records across 10 viewport sizes, with no geometry or browser errors.
- A 337-question test bank color filter completed in about 58 ms on this machine.

Historical .28 evidence remains in the separately delivered .28 folder. This handoff includes [latest release results](BULK_SOLUTION_REVIEW_RELEASE_QA/results.json), [rerun solution checks](BULK_SOLUTION_REVIEW_RELEASE_QA/solutions/results.json), and [visual comparisons](BULK_SOLUTION_REVIEW_RELEASE_QA/visuals/results.json).

## Safeguards

The database version, stored answer keys, independent result, and strict import/currentness/recovery guards remain unchanged by the indicator and review controls. The existing detailed **Needs Math Repair** filter retains its diagnostic behavior; it is separate from the conservative colored indicator.

QA checks application behavior and the prompt text without making external provider calls. An external model's output still needs the app's normal validation and review.

## Note for later

Several quick actions outside the Batch Tools dialog can still stack general notifications over lower content. The batch dialog keeps its single inline notification bar. Extending that behavior to the wider app would improve readability.
