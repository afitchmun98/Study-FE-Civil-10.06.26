import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Run with: NODE_PATH=<bundled node_modules> node scripts/manual-metadata-regression.mjs
// This browser test creates a test-only hook in memory. The shipped HTML stays unchanged.
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const hookAnchor = "  state.activityRecords = function() {";
if (!html.includes(hookAnchor)) throw new Error("Could not install the isolated metadata QA hook.");
const hookedHtml = html.replace(hookAnchor, `  setTimeout(() => { window.__manualMetadataQA = {
    state, dbPut, dbGet, buildManualSolutionBatchPackages, showManualSolutionBatchPaste,
    importManualSolutionBatchResults, ensureManualSolutionBatchState,
    manualWholeSelectionEnsureLedger, showManualWholeSelectionReview,
    manualWholeSelectionResolveReview, endManualBatchTask, resetManualSolutionBatchSession,
    showAbandonManualBatchTaskConfirmation, confirmAbandonManualBatchTask,
    showAbandonManualQuestionTextBatchConfirmation, confirmAbandonManualQuestionTextBatch,
    ensureManualQuestionTextBatchState, manualQuestionTextBatchDefaultState, questionTextRepairHash,
    ensureManualQuestionTextQueueState, manualQuestionTextQueueDefaultState, endManualQuestionTextQueue,
    ensureManualBankDiagramQueues, endManualBankDiagramQueue,
    manualBatchGenerationPrompt, normalizeManualGenerationBatchResponse,
    parseManualGenerationBatchJSON, manualBatchEffectiveRoundSize,
    manualQuestionTextBatchCorePrompt, manualQuestionTextBatchValidateEnvelope,
    manualQuestionTextBatchEffectiveRoundSize, manualPromptForTarget
  }; }, 0);\n${hookAnchor}`);

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
});
let assertions = 0;
function check(value, message) {
  assertions += 1;
  if (!value) throw new Error(`assertion ${assertions}: ${message}`);
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("http://fe-metadata-qa.local/", route => route.fulfill({ status: 200, contentType: "text/html", body: hookedHtml }));
  await page.goto("http://fe-metadata-qa.local/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  try {
    await page.waitForFunction(() => window.__manualMetadataQA?.state?.questions?.length > 0, undefined, { timeout: 30_000 });
  } catch (error) {
    const diagnosis = await page.evaluate(() => ({ hook: Boolean(window.__manualMetadataQA), questionCount: window.__manualMetadataQA?.state?.questions?.length, body: document.body.innerText.slice(0, 400) }));
    throw new Error(`${error.message}; ${JSON.stringify(diagnosis)}; page errors: ${pageErrors.join("; ")}`);
  }

  const initial = await page.evaluate(async () => {
    const qa = window.__manualMetadataQA;
    const seed = structuredClone(qa.state.questions[0]);
    const now = "2026-09-28T12:00:00.000Z";
    const questions = Array.from({ length: 20 }, (_, index) => {
      const question = structuredClone(seed);
      question.id = `META-Q${String(index + 1).padStart(2, "0")}`;
      question.question = `For a civil engineering project, classify the primary topic and subtopic of this independent sample question ${index + 1}.`;
      question.updatedAt = now;
      return question;
    });
    for (const question of questions) await qa.dbPut("questions", question);
    qa.state.questions = questions;
    qa.state.batchConfigSelection = questions.map(question => question.id);
    qa.state.aiBatchToolsManualOperation = "metadata";
    const controls = document.createElement("div");
    controls.id = "metadata-qa-controls";
    controls.hidden = true;
    controls.innerHTML = '<input id="manual-solution-batch-size" value="20"><input type="checkbox" data-selective-metadata-manual-group value="topic" checked><input type="checkbox" data-selective-metadata-manual-group value="subtopic" checked><input id="manual-answer-grammar" type="checkbox" checked>';
    document.body.append(controls);
    const built = await qa.buildManualSolutionBatchPackages({});
    const scaffoldText = built.prompt.split("RESPONSE SCAFFOLD — fill only metadata values:\n")[1];
    const scaffold = scaffoldText ? JSON.parse(scaffoldText) : null;
    return {
      count: built.packages.length,
      operations: built.batch.requestedOperations,
      selectedGroups: built.batch.selectiveMetadataGroups,
      promptHasResponseEnvelope: built.prompt.includes("schemaVersion") && built.prompt.includes("batchFingerprint"),
      packagesHaveFrozenRequest: built.packages.every(pkg => pkg.selectiveMetadataRequest?.requestFingerprint && pkg.requiredOperations?.includes("selectiveMetadata")),
      scaffoldMetadataObjects: scaffold?.results?.length === 20 && scaffold.results.every(item => {
        const metadata = item.outputs?.selectiveMetadata?.metadata;
        return metadata && typeof metadata === "object" && !Array.isArray(metadata) && Object.keys(metadata).sort().join(",") === "subtopic,topic";
      }),
      sharedTaxonomyOnce: built.prompt.split("CANONICAL TOPIC AND SUBTOPIC TAXONOMY (shared by every item):").length === 2,
      noRepeatedIndividualPrompt: !built.prompt.includes("selectiveMetadataPrompt"),
      promptLength: built.prompt.length,
      before: questions.map(question => ({ id: question.id, topic: question.topic, subtopic: question.subtopic, question: question.question, choices: question.choices }))
    };
  });
  check(initial.count === 20, "a 20-question metadata batch freezes all selected questions");
  check(JSON.stringify(initial.operations) === JSON.stringify(["selectiveMetadata"]), "the task requests only selective metadata");
  check(JSON.stringify(initial.selectedGroups) === JSON.stringify(["topic", "subtopic"]), "Topic and Subtopic are the only selected groups");
  check(initial.promptHasResponseEnvelope && initial.packagesHaveFrozenRequest, "the prompt carries the batch and individual frozen identities");
  check(initial.scaffoldMetadataObjects, "the response scaffold has a concrete Topic and Subtopic metadata object for every item");
  check(initial.sharedTaxonomyOnce && initial.noRepeatedIndividualPrompt, "the visible prompt uses one shared taxonomy instead of repeated individual prompts");
  check(initial.promptLength < 65_000, `the 20-item prompt stays compact (${initial.promptLength} characters)`);

  async function buildResponse({ resultCount = 20, invalidIndex = -1, duplicateIndex = -1, directNested = false } = {}) {
    return page.evaluate(({ resultCount, invalidIndex, duplicateIndex, directNested }) => {
      const memory = window.__manualMetadataQA.ensureManualSolutionBatchState();
      const batch = memory.batches.find(item => item.batchFingerprint === memory.selectedBatchFingerprint);
      const results = batch.packages.slice(0, resultCount).map((pkg, index) => {
        const frozen = pkg.selectiveMetadataRequest;
        const taxonomy = frozen.modelProjection.taxonomy;
        const currentTopic = memory.reviewBaselines?.[pkg.questionId]?.snapshot?.metadata?.topic;
        const topic = Object.keys(taxonomy).find(value => value !== currentTopic && taxonomy[value]?.length) || Object.keys(taxonomy).find(value => taxonomy[value]?.length);
        const metadata = { topic, subtopic: taxonomy[topic][0] };
        if (index === invalidIndex) metadata.subtopic = "A subtopic outside the canonical taxonomy";
        const selectiveMetadata = {
          schemaVersion: "1.0", questionId: frozen.questionId,
          requestFingerprint: frozen.requestFingerprint,
          requestedGroups: [...frozen.requestedGroups], metadata
        };
        return {
          questionId: pkg.questionId,
          questionRevision: pkg.questionRevision,
          packageFingerprint: pkg.packageFingerprint,
          ...(directNested ? { selectiveMetadata } : { outputs: { selectiveMetadata } })
        };
      });
      if (duplicateIndex >= 0) results.push(structuredClone(results[duplicateIndex]));
      return {
        schemaVersion: "2.0", batchFingerprint: batch.batchFingerprint,
        requestedOperations: [...batch.requestedOperations], results
      };
    }, { resultCount, invalidIndex, duplicateIndex, directNested });
  }

  async function importResponse(text) {
    return page.evaluate(async responseText => {
      const qa = window.__manualMetadataQA;
      const memory = qa.ensureManualSolutionBatchState();
      qa.showManualSolutionBatchPaste(memory.selectedBatchFingerprint);
      document.querySelector("#manual-solution-batch-results").value = responseText;
      const results = await qa.importManualSolutionBatchResults();
      const latest = qa.ensureManualSolutionBatchState();
      const review = qa.manualWholeSelectionEnsureLedger(latest);
      return {
        resultStatuses: Array.isArray(results) ? results.map(item => item.status) : null,
        outcomeStatuses: Object.fromEntries(Object.entries(latest.outcomes).map(([id, outcome]) => [id, outcome.status])),
        reviewStatuses: Object.fromEntries(review.map(item => [item.questionId, item.status])),
        proposals: review.filter(item => item.status === "proposal_pending").map(item => item.questionId),
        currentQuestions: qa.state.questions.map(item => ({ id: item.id, topic: item.topic, subtopic: item.subtopic, question: item.question, choices: item.choices })),
        modalText: document.querySelector(".modal-layer")?.innerText || ""
      };
    }, text);
  }

  const complete = await importResponse(JSON.stringify(await buildResponse()));
  check(complete.resultStatuses?.length === 20, "a complete response produces one result per question");
  check(complete.proposals.length === 20, "all 20 valid classifications are staged for review");
  check(!Object.values(complete.outcomeStatuses).some(status => ["failed_validation", "missing_response", "stale_echo", "stale_current_snapshot"].includes(status)), "valid items do not spuriously require retry");
  check(complete.currentQuestions.every((question, index) => question.topic === initial.before[index].topic && question.subtopic === initial.before[index].subtopic), "paste never commits staged metadata");
  const reviewButton = page.locator('.batch-workspace-next-step [data-action="review-all-manual-whole-selection"][data-review-mode="all"]');
  check(await reviewButton.isVisible() && await reviewButton.isEnabled(), "review is available immediately after import for all 20 staged classifications");

  await page.evaluate(() => window.__manualMetadataQA.resetManualSolutionBatchSession());
  await page.evaluate(async () => window.__manualMetadataQA.buildManualSolutionBatchPackages({}));
  const partialPayload = await buildResponse({ resultCount: 4, invalidIndex: 3, directNested: true });
  const partialText = `Here is the requested JSON:\n\n\`\`\`json\n${JSON.stringify(partialPayload, null, 2)}\n\`\`\`\n\nI classified the four supplied items.`;
  const partial = await importResponse(partialText);
  check(partial.proposals.length === 3, "valid siblings stage when one of four returned items has invalid metadata");
  check(Object.values(partial.outcomeStatuses).filter(status => status === "missing_response").length === 16, "16 unreturned questions remain retryable");
  check(partial.outcomeStatuses["META-Q04"] === "failed_validation", "the invalid item alone needs validation retry");
  check(partial.currentQuestions.every((question, index) => question.topic === initial.before[index].topic && question.subtopic === initial.before[index].subtopic), "partial paste does not commit proposals");
  const endTask = await page.evaluate(() => {
    const qa = window.__manualMetadataQA;
    qa.endManualBatchTask();
    const layer = document.querySelector(".modal-layer");
    return {
      text: layer?.innerText || "",
      buttons: [...(layer?.querySelectorAll("button") || [])].map(button => ({ text: button.textContent.trim(), action: button.dataset.action || "" })),
      proposalCount: qa.manualWholeSelectionEnsureLedger(qa.ensureManualSolutionBatchState()).filter(item => item.status === "proposal_pending").length
    };
  });
  check(endTask.proposalCount === 3, "opening End Task retains the three staged classifications");
  const reviewRoute = endTask.buttons.find(button => button.action !== 'batch-workspace-stage' && /review/i.test(button.text) && !/discard/i.test(button.text));
  check(Boolean(reviewRoute?.action), "End Task offers a direct route to review staged changes");
  await page.locator(`.modal-layer [data-action="${reviewRoute.action}"]`).click();
  await page.waitForSelector('.manual-whole-review[data-review-kind="generic"]');
  const reviewScope = await page.evaluate(() => ({
    position: document.querySelector(".manual-whole-review-position")?.textContent || "",
    filters: [...document.querySelectorAll(".manual-whole-review-filters button")].map(button => ({ text: button.textContent.trim(), primary: button.classList.contains("primary") }))
  }));
  check(reviewScope.position === "Question 1 of 3" && reviewScope.filters.some(filter => filter.text === "Changed Questions (3)" && filter.primary) && reviewScope.filters.some(filter => filter.text === "All Selected (20)"), "early review defaults to the three changed questions and can still show all 20");
  const earlyReview = await page.evaluate(async () => {
    const qa = window.__manualMetadataQA;
    qa.showManualWholeSelectionReview("generic");
    const memory = qa.ensureManualSolutionBatchState();
    const staged = qa.manualWholeSelectionEnsureLedger(memory).find(item => item.status === "proposal_pending");
    const before = structuredClone(qa.state.questions.find(item => item.id === staged.questionId));
    const proposed = structuredClone(staged.proposed.metadata);
    const reviewText = document.querySelector(".modal-layer")?.innerText || "";
    await qa.manualWholeSelectionResolveReview(staged.id, "accept", { refresh: false });
    const after = structuredClone(qa.state.questions.find(item => item.id === staged.questionId));
    return { reviewText, before, after, proposed, stillStaged: qa.manualWholeSelectionEnsureLedger(qa.ensureManualSolutionBatchState()).filter(item => item.status === "proposal_pending").length };
  });
  check(earlyReview.reviewText.includes("META-Q01"), "review remains openable before the full batch is complete");
  check(earlyReview.after.topic === earlyReview.proposed.topic && earlyReview.after.subtopic === earlyReview.proposed.subtopic, "Accept commits the reviewed Topic and Subtopic");
  check(earlyReview.after.question === earlyReview.before.question && JSON.stringify(earlyReview.after.choices) === JSON.stringify(earlyReview.before.choices), "metadata Accept preserves question content and choices");
  check(earlyReview.stillStaged === 2, "accepting one early proposal retains the other staged changes");

  await page.evaluate(() => window.__manualMetadataQA.resetManualSolutionBatchSession());
  await page.evaluate(async () => window.__manualMetadataQA.buildManualSolutionBatchPackages({}));
  const duplicatePayload = await buildResponse({ resultCount: 4, duplicateIndex: 0 });
  const duplicate = await importResponse(JSON.stringify(duplicatePayload));
  check(duplicate.proposals.length === 3, "duplicate identity does not discard unrelated valid classifications");
  check(duplicate.outcomeStatuses["META-Q01"] === "failed_validation", "the duplicated question is isolated for retry");
  check(duplicate.proposals.every(id => id !== "META-Q01"), "ambiguous duplicate is never staged");
  const generic = await page.evaluate(async () => {
    const qa = window.__manualMetadataQA;
    qa.resetManualSolutionBatchSession();
    qa.state.aiBatchToolsManualOperation = "answerChoices";
    document.querySelector("#metadata-qa-controls #manual-solution-batch-size").value = "10";
    for (const question of qa.state.questions) {
      question.choices = ["1 m", "2 m", "3 m", "4 m"];
      await qa.dbPut("questions", question);
    }
    const first = await qa.buildManualSolutionBatchPackages({});
    const scaffold = JSON.parse(first.prompt.split("RESPONSE SCAFFOLD — keep identities and structure; replace example output content:\n")[1].split("\n\nIMMUTABLE QUESTION PACKAGES:")[0]);
    const next = await qa.buildManualSolutionBatchPackages({ next: true });
    const make = pkg => ({
      questionId:pkg.questionId, questionRevision:pkg.questionRevision, packageFingerprint:pkg.packageFingerprint,
      outputs:{ answerChoicesPresentation:{
        schemaVersion:"1.0", questionId:pkg.questionId,
        questionFingerprint:pkg.answerChoicesPresentationProjection.questionFingerprint,
        choices:[...pkg.answerChoicesPresentationProjection.choices]
      } }
    });
    const results=first.packages.slice(0,4).map(make);
    const response={schemaVersion:"2.0",batchFingerprint:first.batchFingerprint,results:[...results,structuredClone(results[1]),{questionId:"UNKNOWN",outputs:{}}]};
    const fence=String.fromCharCode(96).repeat(3);
    const pasted="Here is the response:\n\n"+fence+"json\n"+JSON.stringify(response)+"\n"+fence+"\n\nDone.";
    const normalized=qa.normalizeManualGenerationBatchResponse(qa.parseManualGenerationBatchJSON(pasted),first.batch);
    let wrongBatch=false,wrongOperations=false,wrongOptions=false;
    try { qa.normalizeManualGenerationBatchResponse({...response,batchFingerprint:"wrong"},first.batch); } catch { wrongBatch=true; }
    try { qa.normalizeManualGenerationBatchResponse({...response,requestedOperations:["aiData"]},first.batch); } catch { wrongOperations=true; }
    try { qa.normalizeManualGenerationBatchResponse({...response,manualOptions:{answerChoices:{grammar:false}}},first.batch); } catch { wrongOptions=true; }
    qa.showManualSolutionBatchPaste(first.batchFingerprint);
    document.querySelector("#manual-solution-batch-results").value=pasted;
    const imported=await qa.importManualSolutionBatchResults(),memory=qa.ensureManualSolutionBatchState();
    return {
      count:first.packages.length,nextCount:next.packages.length,nextFirst:next.packages[0].questionId,
      scaffoldIds:scaffold.results.map(item=>item.questionId),
      scaffoldOutputs:scaffold.results.map(item=>Object.keys(item.outputs)),
      normalizedIds:normalized.payload.results.map(item=>item.questionId),
      duplicate:normalized.preflightErrors.has(first.packages[1].questionId),
      warnings:normalized.warnings.length,
      wrongBatch,wrongOperations,wrongOptions,
      imported:Array.isArray(imported),
      outcomes:Object.fromEntries(Object.entries(memory.outcomes).map(([id,item])=>[id,item.status])),
      importWarnings:memory.batches.find(item=>item.batchFingerprint===first.batchFingerprint)?.importWarnings||[]
    };
  });
  check(generic.count===10 && generic.nextCount===10 && generic.nextFirst==="META-Q11", "20 Answer Choices selections copy in two ten-question rounds");
  check(generic.scaffoldIds.length===10 && generic.scaffoldIds[0]==="META-Q01" && generic.scaffoldIds.at(-1)==="META-Q10", "the generic prompt has one real identity per frozen question");
  check(generic.scaffoldOutputs.every(names=>names.length===1&&names[0]==="answerChoicesPresentation"), "the generic scaffold shows only the required operation");
  check(generic.normalizedIds.join(",")==="META-Q01,META-Q03,META-Q04" && generic.duplicate && generic.warnings===1, "a duplicate and stray ID do not discard valid siblings");
  check(generic.wrongBatch && generic.wrongOperations && generic.wrongOptions, "wrong frozen batch, operations, and options are rejected");
  check(generic.imported && !["failed_validation","missing_response","stale_echo"].includes(generic.outcomes["META-Q01"]), "a valid Answer Choices result imports from prose plus fenced JSON");
  check(generic.outcomes["META-Q02"]==="failed_validation" && generic.outcomes["META-Q05"]==="missing_response", "duplicate and missing results alone need retry");
  check(generic.importWarnings.length===1, "the stray result is reported");
  const answerReview = await page.evaluate(async () => {
    const qa=window.__manualMetadataQA;
    qa.resetManualSolutionBatchSession();
    qa.state.aiBatchToolsManualOperation="answerChoices";
    document.querySelector("#manual-answer-grammar").checked=false;
    const ocr=document.createElement("input");ocr.id="manual-answer-ocr";ocr.type="checkbox";ocr.checked=true;document.body.append(ocr);
    const built=await qa.buildManualSolutionBatchPackages({}),pkg=built.packages[0];
    const response={schemaVersion:"2.0",batchFingerprint:built.batchFingerprint,results:[{
      questionId:pkg.questionId,questionRevision:pkg.questionRevision,packageFingerprint:pkg.packageFingerprint,
      outputs:{answerChoicesOCRRepair:{choices:["1.0 m","2 m","3 m","4 m"],evidence:"Supplied conversion text supports the first choice notation.",confidence:"medium"}}
    }]};
    qa.showManualSolutionBatchPaste(built.batchFingerprint);
    document.querySelector("#manual-solution-batch-results").value=JSON.stringify(response);
    await qa.importManualSolutionBatchResults();
    const memory=qa.ensureManualSolutionBatchState(),changed=qa.manualWholeSelectionEnsureLedger(memory).filter(item=>item.status==="proposal_pending");
    qa.endManualBatchTask();
    const modalText=document.querySelector(".modal-layer")?.innerText||"";
    return {changedIds:changed.map(item=>item.questionId),missing:Object.values(memory.outcomes).filter(item=>item.status==="missing_response").length,modalText,currentChoice:qa.state.questions[0].choices[0]};
  });
  check(answerReview.changedIds.join(",")==="META-Q01" && answerReview.missing===9, "a changed Answer Choices proposal remains staged while other items need retry");
  check(answerReview.modalText.includes("Review Changed Questions (1)") && answerReview.currentChoice==="1 m", "ending early offers review without applying an Answer Choices change");
  check(await page.locator('.modal-layer [data-action="show-abandon-manual-batch-task"]').count() === 1, "incomplete generic task offers an explicit abandon path");
  const savedBeforeAbandon = await page.evaluate(() => {
    const qa = window.__manualMetadataQA;
    return { topic: qa.state.questions[0].topic, selected: [...qa.state.batchConfigSelection] };
  });
  await page.locator('.modal-layer [data-action="show-abandon-manual-batch-task"]').click();
  const abandonPrompt = await page.locator('.modal-layer').innerText();
  check(abandonPrompt.includes("1 staged change") && abandonPrompt.includes("Already accepted or saved changes remain"), "abandon confirmation explains staged work and saved data");
  await page.locator('.modal-layer [data-action="return-manual-batch-workspace"]').click();
  const stillWorking = await page.evaluate(() => {
    const qa = window.__manualMetadataQA, memory = qa.ensureManualSolutionBatchState();
    return { sessionID: memory.sessionID, pending: memory.reviewItems.filter(item => item.status === "proposal_pending").length };
  });
  check(Boolean(stillWorking.sessionID) && stillWorking.pending === 1, "Keep Working preserves the active task and staged proposal");
  await page.locator('.modal-layer [data-action="show-abandon-manual-batch-task"]').click();
  await page.locator('.modal-layer [data-action="confirm-abandon-manual-batch-task"]').click();
  const abandoned = await page.evaluate(async () => {
    const qa = window.__manualMetadataQA, memory = qa.ensureManualSolutionBatchState();
    return {
      sessionID: memory.sessionID, reviews: memory.reviewItems.length, batches: memory.batches.length,
      choice: qa.state.questions[0].choices[0], topic: qa.state.questions[0].topic,
      savedChoice: (await qa.dbGet("questions", "META-Q01"))?.choices?.[0],
      selected: [...qa.state.batchConfigSelection]
    };
  });
  check(!abandoned.sessionID && abandoned.reviews === 0 && abandoned.batches === 0, "confirming abandon clears task, staged reviews, and copied batches");
  check(abandoned.choice === "1 m" && abandoned.savedChoice === "1 m" && abandoned.topic === savedBeforeAbandon.topic, "abandon preserves saved question data, including an earlier accepted classification");
  check(JSON.stringify(abandoned.selected) === JSON.stringify(savedBeforeAbandon.selected), "abandon preserves Question Bank selection");

  const questionTextPrepared = await page.evaluate(() => {
    const qa = window.__manualMetadataQA, original = qa.state.questions[1].question;
    qa.state.aiBatchToolsManualOperation = "questionText";
    qa.state.manualQuestionTextBatch = {
      ...qa.manualQuestionTextBatchDefaultState(), sessionID: "QA-TEXT-EXIT",
      targetQuestionIDs: ["META-Q02"],
      reviewItems: [{ id: "QA-TEXT-EXIT:whole-review:META-Q02", questionId: "META-Q02", originalQuestion: original, proposedQuestion: original + " Revised.", recordFingerprint: qa.questionTextRepairHash(original), status: "pending" }]
    };
    qa.state.manualQuestionTextBatchLoaded = true;
    qa.showAbandonManualQuestionTextBatchConfirmation();
    return { original, sessionID: qa.ensureManualQuestionTextBatchState().sessionID };
  });
  check(questionTextPrepared.sessionID === "QA-TEXT-EXIT", "Question Text abandon opens for an active staged task");
  check((await page.locator('.modal-layer').innerText()).includes("1 staged change"), "Question Text confirmation counts its staged proposal");
  await page.locator('.modal-layer [data-action="return-manual-batch-workspace"]').click();
  check((await page.evaluate(() => window.__manualMetadataQA.ensureManualQuestionTextBatchState().reviewItems.length)) === 1, "Question Text Keep Working retains the proposal");
  await page.locator('.modal-layer [data-action="show-abandon-manual-question-text-batch"]').click();
  await page.locator('.modal-layer [data-action="confirm-abandon-manual-question-text-batch"]').click();
  const textAbandoned = await page.evaluate(async () => {
    const qa = window.__manualMetadataQA, memory = qa.ensureManualQuestionTextBatchState();
    return { sessionID: memory.sessionID, reviews: memory.reviewItems.length, question: qa.state.questions[1].question, savedQuestion: (await qa.dbGet("questions", "META-Q02"))?.question, selected: qa.state.batchConfigSelection.length };
  });
  check(!textAbandoned.sessionID && textAbandoned.reviews === 0, "Question Text abandon clears its staged task");
  check(textAbandoned.question === questionTextPrepared.original && textAbandoned.savedQuestion === questionTextPrepared.original && textAbandoned.selected === 20, "Question Text abandon preserves saved text and selection");
  const queueExits = await page.evaluate(() => {
    const qa = window.__manualMetadataQA, originalConfirm = window.confirm;
    qa.state.manualQuestionTextQueue = { ...qa.manualQuestionTextQueueDefaultState(), sessionID: "QA-TEXT-QUEUE", targetQuestionIDs: ["META-Q02"] };
    qa.state.manualQuestionTextQueueLoaded = true;
    window.confirm = () => false;
    qa.endManualQuestionTextQueue();
    const textRetained = qa.ensureManualQuestionTextQueueState().sessionID === "QA-TEXT-QUEUE";
    window.confirm = () => true;
    qa.endManualQuestionTextQueue();
    const textCleared = !qa.ensureManualQuestionTextQueueState().sessionID;
    const manager = qa.ensureManualBankDiagramQueues();
    manager.sessions.question = { sessionID: "QA-DIAGRAM-QUEUE", diagramType: "question", items: [] };
    window.confirm = () => false;
    qa.endManualBankDiagramQueue("question");
    const diagramRetained = manager.sessions.question?.sessionID === "QA-DIAGRAM-QUEUE";
    window.confirm = () => true;
    qa.endManualBankDiagramQueue("question");
    const diagramCleared = manager.sessions.question === null;
    window.confirm = originalConfirm;
    return { textRetained, textCleared, diagramRetained, diagramCleared };
  });
  check(queueExits.textRetained && queueExits.diagramRetained, "canceling either guided-queue exit keeps its session");
  check(queueExits.textCleared && queueExits.diagramCleared, "confirming either guided-queue exit clears its session");

  const formatContracts = await page.evaluate(() => {
    const qa=window.__manualMetadataQA;
    const pkg=(id,requiredOperations)=>({questionId:id,questionRevision:"revision",packageFingerprint:"fp-"+id,requiredOperations});
    const diagramPrompt=qa.manualBatchGenerationPrompt([pkg("D1",["solutionDiagrams"])],{batchFingerprint:"diagram-batch",requestedOperations:["solutionDiagrams"],solutionDiagramContextMode:"standard",replaceExisting:false});
    const diagram=JSON.parse(diagramPrompt.split("RESPONSE SCAFFOLD — keep identities and structure; replace example output content:\n")[1].split("\n\nIMMUTABLE QUESTION PACKAGES:")[0]);
    const aiPrompt=qa.manualBatchGenerationPrompt([pkg("A1",["aiData"]),pkg("A2",[])],{batchFingerprint:"ai-batch",requestedOperations:["aiData"],replaceExisting:false});
    const ai=JSON.parse(aiPrompt.split("RESPONSE SCAFFOLD — keep identities and structure; replace example output content:\n")[1].split("\n\nIMMUTABLE QUESTION PACKAGES:")[0]);
    const textBatch={batchFingerprint:"text-batch",mode:"safe",safeOptions:{grammar:true,mathPrint:false,general:false,ocrRepair:false},packages:[pkg("T1",[]),pkg("T2",[])]};
    const textPrompt=qa.manualQuestionTextBatchCorePrompt(textBatch);
    const text=JSON.parse(textPrompt.split("RESPONSE SCAFFOLD — keep identities and structure; replace example Question Text:\n")[1].split("\n\nFROZEN PACKAGES:")[0]);
    const keyed=qa.manualQuestionTextBatchValidateEnvelope(textBatch,{batchFingerprint:"text-batch",results:{T1:text.results[0]}});
    const delivery=qa.manualPromptForTarget(diagramPrompt,"json_batch","chatgpt","copy-manual-solution-batch-prompt");
    const solutionPrompt=qa.manualBatchGenerationPrompt([pkg("S1",["generateSolutions"])],{batchFingerprint:"solution-batch",requestedOperations:["generateSolutions"],replaceExisting:false});
    const solution=JSON.parse(solutionPrompt.split("RESPONSE SCAFFOLD — keep identities and structure; replace example output content:\n")[1].split("\n\nIMMUTABLE QUESTION PACKAGES:")[0]);
    const polishPrompt=qa.manualBatchGenerationPrompt([pkg("P1",["polishPresentation"])],{batchFingerprint:"polish-batch",requestedOperations:["polishPresentation"],replaceExisting:false});
    const polish=JSON.parse(polishPrompt.split("RESPONSE SCAFFOLD — keep identities and structure; replace example output content:\n")[1].split("\n\nIMMUTABLE QUESTION PACKAGES:")[0]);
    const questionDiagramPrompt=qa.manualBatchGenerationPrompt([pkg("QD1",["questionDiagrams"])],{batchFingerprint:"question-diagram-batch",requestedOperations:["questionDiagrams"],replaceExisting:false});
    const questionDiagram=JSON.parse(questionDiagramPrompt.split("RESPONSE SCAFFOLD — keep identities and structure; replace example output content:\n")[1].split("\n\nIMMUTABLE QUESTION PACKAGES:")[0]);
    const validationPkg={...pkg("V1",["validateQuestions"]),validationRequest:{prompt:"Return one validation object and no fence.",problemPackage:{questionId:"V1",questionRevision:"revision",packageFingerprint:"validation-fp"}}};
    const validationPrompt=qa.manualBatchGenerationPrompt([validationPkg],{batchFingerprint:"validation-batch",requestedOperations:["validateQuestions"],replaceExisting:false});
    const validation=JSON.parse(validationPrompt.split("RESPONSE SCAFFOLD — keep identities and structure; replace example output content:\n")[1].split("\n\nIMMUTABLE QUESTION PACKAGES:")[0]);
    const ocrPkg={...pkg("O1",["manualAnswerChoicesOCRRepair","manualAnswerKeyReassessment"]),answerChoicesOCRRepairProjection:{choices:["one","two","three","four"]}};
    const ocrPrompt=qa.manualBatchGenerationPrompt([ocrPkg],{batchFingerprint:"ocr-batch",requestedOperations:["manualAnswerChoicesOCRRepair","manualAnswerKeyReassessment"],manualOptions:{answerChoices:{ocrRepair:true,keyReassessment:true}},replaceExisting:false});
    const ocr=JSON.parse(ocrPrompt.split("RESPONSE SCAFFOLD — keep identities and structure; replace example output content:\n")[1].split("\n\nIMMUTABLE QUESTION PACKAGES:")[0]);
    let badTextFingerprint=false,badTextMode=false,badTextOptions=false;
    try{qa.manualQuestionTextBatchValidateEnvelope(textBatch,{batchFingerprint:"wrong",results:[]});}catch{badTextFingerprint=true;}
    try{qa.manualQuestionTextBatchValidateEnvelope(textBatch,{batchFingerprint:"text-batch",mode:"risky_ocr",results:[]});}catch{badTextMode=true;}
    try{qa.manualQuestionTextBatchValidateEnvelope(textBatch,{batchFingerprint:"text-batch",safeOptions:{grammar:false},results:[]});}catch{badTextOptions=true;}
    return {
      diagram:diagram.results[0].outputs.solutionDiagram,
      questionDiagram:questionDiagram.results[0].outputs.questionDiagram,
      aiOutputs:ai.results.map(item=>Object.keys(item.outputs)),aiFields:Object.keys(ai.results[0].outputs.aiData),
      textIds:text.results.map(item=>item.questionId),keyedCount:keyed.length,badTextFingerprint,badTextMode,badTextOptions,
      riskyCap:qa.manualQuestionTextBatchEffectiveRoundSize({batchSize:20,mode:"risky_ocr"}),
      solution:solution.results[0].outputs.solution,polish:polish.results[0].outputs.polishPresentation,
      validation:validation.results[0].outputs.validation,validationPrompt,
      ocr:ocr.results[0].outputs,delivery,
      solutionCap:qa.manualBatchEffectiveRoundSize(20,["generateSolutions"]),
      validationCap:qa.manualBatchEffectiveRoundSize(20,["validateQuestions"])
    };
  });
  check(Array.isArray(formatContracts.diagram.stages) && !Object.hasOwn(formatContracts.diagram,"svg"), "Solution Diagram scaffold uses the staged format");
  check(formatContracts.aiOutputs[0].join(",")==="aiData" && formatContracts.aiOutputs[1].length===0, "conditional AI Data output is omitted where not required");
  check(formatContracts.textIds.join(",")==="T1,T2" && formatContracts.keyedCount===1, "Question Text has concrete IDs and accepts keyed results");
  check(formatContracts.riskyCap===20, "source/OCR Question Text rounds honor the requested size");
  check(formatContracts.delivery.includes("omitted items can be retried") && !formatContracts.delivery.includes("Do not omit later packages"), "ChatGPT batch delivery agrees with partial response recovery");
  check(Array.isArray(formatContracts.questionDiagram.stages) && !Object.hasOwn(formatContracts.questionDiagram,"svg"), "Question Diagram scaffold uses the staged format");
  check(formatContracts.aiFields.length===8, "AI Data scaffold keeps all eight required fields");
  check(Object.keys(formatContracts.solution).length===12 && formatContracts.solution.selectedChoiceIndex===null, "Worked Solution scaffold keeps its twelve fields without biasing the choice");
  check(Object.keys(formatContracts.polish).length===12 && formatContracts.polish.selectedChoiceIndex===null, "Solution Polish scaffold keeps its protected output shape");
  check(formatContracts.validation.packageFingerprint==="validation-fp" && formatContracts.validationPrompt.includes("applies to outputs.validation only"), "Validation scaffold echoes its nested identity and resolves format scope");
  check(formatContracts.ocr.answerChoicesOCRRepair.choices.join(",")==="one,two,three,four" && formatContracts.ocr.answerKeyReassessment.answerIndex===null, "Answer Choices OCR scaffold copies actual choices without suggesting a key");
  check(formatContracts.badTextFingerprint && formatContracts.badTextMode && formatContracts.badTextOptions, "Question Text keeps frozen fingerprint, mode, and option checks");
  check(formatContracts.solutionCap===20 && formatContracts.validationCap===20, "solution and validation rounds honor the requested size");
  check(!pageErrors.length, `no browser errors: ${pageErrors.join("; ")}`);
  console.log(`PASS: ${assertions} manual metadata regression assertions`);
} finally {
  await browser.close();
}
