# Notes for a later update

- **Math in list previews:** some existing question snippets show raw LaTeX commands, such as `6\,m`, instead of a clean unit label. The full question renderer and stored question are separate. A future display-only preview formatter could make these snippets easier to scan while preserving the original question and AI prompt.
- **Batch import timestamps:** metadata proposals can be staged even when a legacy batch timestamp has not yet updated. This release's next-step guide checks batch-bound proposals and returned outcomes as well as the timestamp. A later cleanup could consolidate the history timestamps with the authoritative result ledger.

These observations are separate from the completed inline paste, selection, and row alignment changes. No prompt or processing changes were made for them.
