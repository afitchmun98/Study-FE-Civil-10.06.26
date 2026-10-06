# Gemini follow-up prompt: import a Question Bank from Google Drive

Use this prompt only after the supplied FE Civil Practice Lab `4.1.5.51.41` / `EXP3.0.2.4.3.28` build is previewing correctly.

---

Implement one scoped feature in the existing standalone FE Civil Practice Lab: import a question-bank file from Google Drive.

Preserve the current single-file architecture and all existing behavior. Do not convert the app to React, split or reformat `index.html`, change `DB_VERSION`, migrate IndexedDB stores, rewrite prompts/parsers, alter provider routing, or change Firebase ownership rules. Do not add secrets to the repository.

## User experience

In Question Bank → Tools → Import & export, turn **Import Bank…** into a compact import submenu with these two choices in this order:

1. **Import from this device…** — runs the existing local file-picker path unchanged.
2. **Import from Google Drive…** — opens a Google Drive file picker for question-bank files.

Keep both choices inside the existing Tools menu so the top Question Bank command bar remains one row high. Do not add another permanent toolbar button. Preserve the combined Sources panel, contextual selection actions, and existing labelled Tools sections.

For the Drive choice:

- If Firebase is not configured or the local profile is not linked, show the app’s existing actionable Firebase/profile guidance.
- If the Firebase user and linked owner do not match, fail closed with the existing account-mismatch behavior.
- If Drive is not connected or its runtime token expired, use the existing `connectGoogleDrive()` flow and require the same Firebase user.
- Open Google Picker and allow one or more `.json` and `.csv` question-bank files. Prefer JSON in the UI copy.
- Use the existing `https://www.googleapis.com/auth/drive.file` scope. Do not broaden it to full-Drive read access. A user-selected Picker file is the authorization boundary.
- Download each selected file with the existing `driveFetch`/Drive token path, create browser `File` objects that retain the selected filenames and MIME types, and pass them to the existing `importQuestionFiles(files, false)` pipeline.
- Do not create a second parser or a Drive-only normalization path. The existing strict JSON parsing, CSV handling, lineage, replacement rules, bounded persistence, warnings, and toasts must remain authoritative.
- Clear `state.bank.utilityPopup`, close the Tools menu cleanly, and preserve the current selection/filter state after import.
- Show progress while Picker files are downloading. Disable duplicate import actions while the operation is active.
- If one selected file fails, report its filename and continue safely with the remaining selected files when possible. Never claim a failed file was imported.
- On success, use the existing import summary/warning presentation from `importQuestionFiles` and refresh the Question Bank.
- Do not automatically upload or modify anything in Drive. This feature is read/import only.

## Integration requirements

Reuse the existing constants and helpers wherever applicable:

- `DRIVE_SCOPE`
- `DRIVE_API_BASE`
- `driveRequireIdentity()`
- `driveFetch()`
- `driveFriendlyError()`
- `connectGoogleDrive()`
- `driveOwnerMatchesFirebase()`
- `importQuestionFiles(files, false)`
- the existing Firebase configuration and signed-in user

Load the Google Picker script lazily only when the user chooses **Import from Google Drive…**. Use the Firebase web configuration/API key already supplied by the hosted environment where Picker requires a developer key; never hard-code a new key. If the hosted Firebase/Google Cloud project still needs the Picker API enabled or an authorized origin added, stop with a precise setup message instead of weakening authentication or inserting a credential.

Keep OAuth access tokens in runtime memory only, matching the existing Drive implementation. Do not put them in localStorage, IndexedDB, portable HTML, backups, logs, URLs, or error messages.

## Acceptance checks

Before returning the edited build:

1. Run `npm test` and report the exact `index.html` SHA-256.
2. Confirm the Question Bank command bar is still a single row at normal desktop widths.
3. Confirm local-device import still uses the same file input and behavior as before.
4. Confirm canceling Google Picker makes no data changes.
5. Confirm a valid selected JSON bank imports through `importQuestionFiles(files, false)` and survives reload.
6. Confirm malformed JSON produces the same warnings as local import.
7. Confirm duplicate question IDs follow the existing replacement/lineage rules.
8. Confirm account mismatch, expired token, offline mode, Picker API misconfiguration, and download failure all fail safely without partial false-success messaging.
9. Confirm no OAuth token, Firebase secret, or API key is added to source control or exported data.
10. Report any Google Cloud Console step that still requires the owner to enable an API or authorize the hosted origin.

Make only this Google Drive question-bank import change. Do not redesign other screens or opportunistically refactor unrelated code.

---
