# Gemini and ChatGPT manual prompts

## Recommendation

Keep one shared task prompt and output contract, with small adjustments for the selected AI service. The app already uses that structure. There is no need to maintain two independent sets of engineering instructions.

Keep the target selector for now. Remove or share an adjustment only after comparing actual returned answers from both services and checking that the app can import and review them correctly. Models can respond differently to the same instructions; [OpenAI's prompting guidance](https://developers.openai.com/api/docs/guides/prompt-engineering) recommends evaluating prompt behavior when changing prompts or models.

## What the current code does

| Task | Shared instructions | Target adjustments |
| --- | --- | --- |
| Metadata reclassification | Same selected groups, frozen question identities, response scaffold, and complete JSON delivery rule. | ChatGPT adds a short response preamble. Gemini uses the common prompt and delivery rule. These prompts are almost identical. |
| Frozen Question Text batches | Same task, identities, proposed results, and complete batch JSON delivery rule. | ChatGPT adds its preamble. The Question Text actions have no Gemini solution-concision profile. |
| Frozen Answer Choices batches | Same task, identities, proposed results, and complete batch JSON delivery rule. | These use the general batch route. Gemini can append solution-concision guidance because that adapter is selected by the batch action, even when the requested operation is Answer Choices. ChatGPT adds its preamble; its worked-solution addenda check the requested operations. |
| Worked Solutions | Common engineering task, output fields, independent solving, choice mapping, and validation requirements. | Gemini adds concise-step and output-identity guidance. ChatGPT adds explicit standard FE reference guidance and more detailed MathPrint/JSON escaping instructions for relevant routes. |
| Solution Diagrams | Same complete inline SVG delivery rules; individual routes require a title and one fenced SVG block. | Provider headings differ. ChatGPT also adds drafting guidance for arrows, dimensions, strokes, and spacing. |
| Generated questions | Common assigned scope and task instructions. | Gemini repeats exact topic/focus/official-parent identities, and adds solution concision guidance when solutions are requested. ChatGPT uses its target delivery contract. |

The app also records which target produced a copied prompt. Frozen batches retain their exact copied prompt, target, and identity data. Some Gemini import normalization is target-dependent, including answer-choice MathPrint and final-answer formatting. Removing the selector or changing target bookkeeping would therefore require more than deleting a prompt heading.

## A future cleanup that preserves functionality

1. Keep the task, response schema, identities, allowed edits, and review rules in the shared core.
2. Move useful instructions that apply to both services into that core, after checking for conflicting delivery rules.
3. Keep a short target adapter only where returned responses demonstrate that it helps.
4. Compare real responses from Gemini and ChatGPT using representative 20-question batches, including short and long solutions, rounded numeric answers, metadata, answer choices, and diagrams. Check completeness, usable JSON/SVG, field identities, MathPrint, and review/apply/retry behavior.
5. Simplify the selector only if the remaining target differences and import bookkeeping have been handled safely.

One caption currently describes Gemini as copying the trusted prompt unchanged. That description is too broad: relevant solution and generated-question routes add instructions. Update the caption when the prompt UI is next revised.

## Scope of this release

EXP3.0.2.4.3.37 adds collapsed sidebar labels. Prompt instructions, parsers, provider routing, manual review, and database schema were not rewritten. This comparison comes from the app's code. Browser QA uses controlled pasted responses; it does not establish equal response quality between live Gemini and ChatGPT sessions.

Relevant code in `index.html`: `manualPromptForTarget`, `geminiSolutionConcisionPrompt`, `geminiManualSolutionDeliveryPrompt`, `manualFEReferenceKnowledgeAddendum`, `manualChatGPTMathPrintPresentationAddendum`, `textbookDiagramManualSolutionDeliveryContract`, `geminiManualQuestionMetadataIdentityAddendum`, and `geminiManualChoiceMathPrintRecord`.
