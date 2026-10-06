# Upload this handoff to GitHub

1. Extract `FE_Civil_EXP3.0.2.4.3.48_GitHub_AI_Studio_Ready.zip`.
2. Open your GitHub repository and choose **Add file → Upload files**.
3. Upload the **contents** of the extracted folder to the repository root and commit them. `index.html` and `package.json` should appear directly at the root. Include `.gitignore` through GitHub Desktop/Git, or show hidden files in Finder with Command–Shift–Period.
4. In Google AI Studio Build mode, choose **Add files (+) → Import from GitHub** and select the repository.
5. Paste `AI_STUDIO_IMPORT_PROMPT.md` into Gemini and preview with `npm run dev`.

This package contains the latest **4.1.5.51.61 / EXP3.0.2.4.3.48** app unchanged. The lean handoff keeps each file below GitHub's 25 MiB browser upload limit. All build/test scripts and visual baselines are included. The QA summary JSON is included; larger screenshots and logs remain in the original full delivery.

Run `npm test` and `npm run build` to check the supplied artifact. The dev server uses `0.0.0.0` and honors `PORT`. Browser QA requires the development tools described in the scripts.

[Google's import guide](https://ai.google.dev/gemini-api/docs/aistudio-build-mode) · [GitHub upload guide](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
