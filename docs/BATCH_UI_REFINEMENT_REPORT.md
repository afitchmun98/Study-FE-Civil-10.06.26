# Batch size and Question Bank UI fixes — EXP3.0.2.4.3.26

## What changed

- **A batch of 20 now contains 20 questions.** An internal five-item limit caused the screen you showed: the task included 337 selected questions, but the copied round held only five. Manual Copy/Paste now uses the Batch size you enter for every task, including Question Text and long-answer tasks. The final round contains however many questions remain. The app still warns that larger AI responses may be incomplete and lets you retry missing results.
- **Selection is easier to understand.** The selection menu always shows its count, including **0 selected**. It contains **Select matching** (questions matching current filters), **Select all** (the entire Question Bank), and **Clear Selection**. The top **Clear** button resets filters, search, and selection together, so it cannot leave 337 selected after the list changes. The toolbar spacing was adjusted so these controls fit with the sidebar open at 1440 pixels.
- **The Gemini and ChatGPT sidebar links have vector marks.** The marks remain visible in the collapsed sidebar and fit within the expanded sidebar.
- **Practice question origin appears once.** The header shows the question title and one source label; the repeated Title/Source box above the question is gone. Full record details remain available in the collapsed details section.

## Checks completed

- 85 focused browser checks passed, including 20-item copying, next/previous batch navigation, imports, review, retry, selection controls, Clear, provider marks, and the Practice header.
- 63 existing manual batch checks passed. Their older ten-item test case now explicitly requests ten items.
- 52 Question Bank workspace checks, 551 table layout/accessibility checks, 93 responsive interaction checks, and 88 popover reopening checks passed.
- All 12 screenshots passed after reviewing and refreshing baselines for the intended icon and toolbar changes. The previously outdated 768-pixel toolbar image was also reviewed before replacement.
- 63 source checks passed, including JavaScript parsing and the exact app-file hash. The built app matches the source file byte for byte.

The browser checks used test questions. They did not call a live AI provider. A 20-question prompt with long answers may exceed what an external AI returns in one response; smaller sizes remain available when that happens.

Three older, broader release tests still have toolbar/search expectations that failed in the previous build. Those test expectations are separate from these fixes and remain for a later pass.
