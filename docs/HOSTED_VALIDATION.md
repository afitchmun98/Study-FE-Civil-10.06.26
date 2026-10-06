# Hosted validation boundary — 4.1.5.51.55 / EXP3.0.2.4.3.42

This package contains the API review update identified by the exact `index.html` SHA-256 in `API_BATCH_REVIEW_REPORT.md`. See that report for local QA results. Packaging readiness does not establish that the app has already been imported, authenticated, or tested in the owner's Google AI Studio/Firebase account.

After GitHub import, preview the supplied app without redesigning or refactoring it. Confirm the visible build identity, Question Bank resizing/filtering, Practice/Exam sessions, and Worksheets. Keep the current database version, prompts, parsers, provider routes, and Firebase/Drive ownership boundaries unchanged.

Before accepting future hosted integration changes, verify actual provider prompt/response behavior, selection review/apply behavior, reload persistence, and the configured account's authentication/ownership checks in the target environment. Local QA uses isolated fixtures and is not a substitute for those live checks.

The separate `GEMINI_GOOGLE_DRIVE_QUESTION_BANK_PROMPT.md` is a future, narrowly scoped request, not a feature already implemented by this package. Do not add provider keys, OAuth tokens, private credentials, or user question-bank exports to GitHub.

No automatic deployment, cloud migration, or new server-side provider integration is included. Importing the repository does not authorize unrelated changes.
