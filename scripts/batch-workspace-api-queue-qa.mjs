import {auditBatchLayout,finishBatchLayoutAudit} from './batch-layout-audit.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=process.env.BATCH_WORKSPACE_API_QUEUE_QA_OUTPUT||path.join(os.tmpdir(),'fe-batch-workspace-api-queue-qa');
fs.mkdirSync(output,{recursive:true});
let source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const anchor='  state.activityRecords = function() {';
if(!source.includes(anchor)||!source.includes('const batchWorkspaceRunBase=runBatchSolutions;'))throw new Error('Missing isolated QA fixture anchors');
source=source.replace(anchor,`  setTimeout(()=>window.__batchWorkspaceQA={state,dbPut,dbGet,showBatchSolutions,ensureManualBankDiagramQueues,renderApp,refreshBatchActivityPresentation,batchWorkspaceShowAPIStage,batchWorkspaceAPIActivity,runBatchSolutions,closeModal,getUI:()=>({...batchWorkspaceUI})},0);\n${anchor}`);
const checks=[],errors=[],providerRequests=[];
const check=(value,message)=>{checks.push({message,passed:Boolean(value)});if(!value)throw new Error(`Check ${checks.length}: ${message}`);};
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let page;
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/api\.openai\.com|generativelanguage\.googleapis\.com/.test(request.url()))providerRequests.push(request.url());});
  await page.route('http://fe-batch-workspace-extra.local/',route=>route.fulfill({contentType:'text/html',body:source}));
  await page.goto('http://fe-batch-workspace-extra.local/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__batchWorkspaceQA?.state.questions.length);
  await page.evaluate(async()=>{
    const qa=window.__batchWorkspaceQA,seed=structuredClone(qa.state.questions[0]),now='2026-09-30T19:00:00.000Z';
    const questions=Array.from({length:2},(_,index)=>({...structuredClone(seed),id:`QUEUE-QA-${index+1}`,question:`A beam of length ${index+2} m is simply supported. What is the support reaction?`,choices:['1 kN','2 kN','3 kN','4 kN'],answerIndex:1,answerLetter:'B',solution:'Use equilibrium. The support reaction is 2 kN.',solutionBody:'Use equilibrium. The support reaction is 2 kN.',diagram:null,additionalMetadata:{},generationMetadata:{},updatedAt:now}));
    for(const question of questions)await qa.dbPut('questions',question);
    qa.state.questions=questions;qa.state.bank.selection=new Set(questions.map(q=>q.id));qa.state.batchActivity=null;qa.state.activityHistory.records=[];qa.showBatchSolutions({fresh:true,tab:'manual'});qa.showBatchSolutions({tab:'manual'});
  });
  const stage=key=>page.locator(`.batch-workspace-stages [data-stage="${key}"]`);
  const tasks=await page.locator('#manual-batch-operation option').evaluateAll(options=>options.map(option=>option.value));
  check(tasks.length===9&&new Set(tasks).size===9,'Manual setup exposes all nine distinct task families');
  const required={
    metadata:['[data-selective-metadata-manual-group]','[data-action="selective-metadata-manual-select-all"]','[data-action="selective-metadata-manual-clear-all"]'],
    questionText:['#manual-question-text-batch-size','[data-manual-question-text-batch-safe-option-group]','[data-manual-question-text-batch-safe-option="whitespaceCleanup"]','[data-manual-question-text-batch-safe-option="mathPrintNotation"]','#manual-question-text-batch-advanced'],
    answerChoices:['#manual-solution-batch-size','#manual-answer-grammar','#manual-answer-mathprint','#manual-answer-general','#manual-answer-ocr','#manual-answer-key'],
    solutionPolish:['#manual-solution-batch-size','[data-action="copy-manual-solution-batch-prompt"]'],
    generateSolutions:['#manual-solution-batch-size','#manual-batch-replace-existing','[data-question-bank-solution-prompt-profile]','[data-action="copy-manual-solution-batch-prompt"]'],
    questionDiagrams:['#manual-batch-replace-existing','[data-action="start-manual-bank-diagram-queue"][data-diagram-type="question"]'],
    solutionDiagrams:['#manual-batch-replace-existing','#manual-solution-diagram-context-mode','[data-action="start-manual-bank-diagram-queue"][data-diagram-type="solution"]'],
    aiData:['#manual-solution-batch-size','#manual-batch-replace-existing','[data-action="copy-manual-solution-batch-prompt"]'],
    validateQuestions:['#manual-solution-batch-size','[data-action="copy-manual-solution-batch-prompt"]']
  };
  for(const task of tasks){
    await page.locator('#manual-batch-operation').selectOption(task);
    await auditBatchLayout(page,'setup-'+task);
    check(await page.locator('#manual-batch-operation').inputValue()===task,`${task}: task selection survives layout mounting`);
    for(const selector of required[task])check(await page.locator(selector).count()>0,`${task}: retains ${selector}`);
    check(await page.locator('[data-manual-prompt-target]').count()===2,`${task}: retains Gemini and ChatGPT targets`);
    check(await stage('setup').getAttribute('aria-current')==='step',`${task}: Setup stage matches setup controls`);
    if(task==='metadata'){
      check(await page.locator('[data-selective-metadata-manual-group]').count()===5,'Metadata preserves all five independently selectable groups');
      await page.locator('[data-action="selective-metadata-manual-clear-all"]').click();
      check(await page.locator('[data-selective-metadata-manual-group]:checked').count()===0&&await page.locator('[data-action="copy-manual-solution-batch-prompt"]').isDisabled(),'Metadata Clear All removes groups and prevents empty copy');
      await page.locator('[data-action="selective-metadata-manual-select-all"]').click();
      check(await page.locator('[data-selective-metadata-manual-group]:checked').count()===5,'Metadata Select All restores all groups');
    }
  }
  await page.locator('#manual-batch-operation').selectOption('questionText');
  await page.locator('#manual-question-text-batch-advanced').check();
  check(await page.locator('#manual-question-text-batch-risk-ack').count()===1,'Advanced Question Text preserves its risk acknowledgment');
  check(await page.locator('[data-manual-question-text-batch-safe-option-group]').isDisabled(),'Advanced Question Text disables ordinary safe cleanup');
  await page.locator('#manual-question-text-batch-advanced').uncheck();

  for(const type of ['question','solution']){
    await page.locator('#manual-batch-operation').selectOption(type==='question'?'questionDiagrams':'solutionDiagrams');
    await page.locator(`[data-action="start-manual-bank-diagram-queue"][data-diagram-type="${type}"]`).click();
    await page.waitForSelector('.manual-bank-diagram-queue');
    await auditBatchLayout(page,type+'-diagram-queue');
    check(await stage('review').isDisabled(),`${type} diagram: Review is explicitly unavailable for direct-import queue`);
    check(await stage('batches').getAttribute('aria-current')==='step',`${type} diagram: queue opens in Batches`);
    check(await page.locator('.manual-bank-diagram-queue-nav').count()===1&&await page.locator('.manual-bank-diagram-queue-statuses').count()===1,`${type} diagram: queue has one navigator and status group`);
    await page.locator('[data-action="manual-bank-diagram-queue-next"]').click();
    check(await page.evaluate(type=>window.__batchWorkspaceQA.ensureManualBankDiagramQueues().sessions[type].currentIndex,type)===1,`${type} diagram: Next changes current item`);
    await page.locator('[data-action="manual-bank-diagram-queue-prev"]').click();
    check(await page.evaluate(type=>window.__batchWorkspaceQA.ensureManualBankDiagramQueues().sessions[type].currentIndex,type)===0,`${type} diagram: Previous returns to first item`);
    await page.locator('[data-manual-bank-diagram-queue-jump]').selectOption('1');
    check(await page.evaluate(type=>window.__batchWorkspaceQA.ensureManualBankDiagramQueues().sessions[type].currentIndex,type)===1,`${type} diagram: jump selects second item`);
    await page.locator('[data-action="toggle-manual-bank-diagram-queue-skip"]').click();
    check(await page.evaluate(type=>window.__batchWorkspaceQA.ensureManualBankDiagramQueues().sessions[type].items[1].skipOrigin,type)==='user',`${type} diagram: Skip uses voluntary skip authority`);
    await page.locator('[data-action="toggle-manual-bank-diagram-queue-skip"]').click();
    check(await page.evaluate(type=>window.__batchWorkspaceQA.ensureManualBankDiagramQueues().sessions[type].items[1].status,type)==='not_started',`${type} diagram: Unskip restores ready status`);
    await page.locator('[data-action="copy-manual-bank-diagram-queue-prompt"]').click();
    check(await page.locator('[data-action="paste-manual-bank-diagram-queue-result"]').isEnabled(),`${type} diagram: copied prompt enables bound paste`);
    await page.locator('[data-action="paste-manual-bank-diagram-queue-result"]').click();
    await auditBatchLayout(page,type+'-diagram-paste');
    check(await page.locator('#manual-bank-diagram-queue-item-id').inputValue()===await page.evaluate(type=>window.__batchWorkspaceQA.ensureManualBankDiagramQueues().sessions[type].items[1].id,type),`${type} diagram: paste remains bound to selected queue item`);
    await page.locator('.modal-footer [data-action="close-modal"]').click();
    await page.evaluate(()=>window.__batchWorkspaceQA.showBatchSolutions({tab:'manual'}));
    await page.evaluate(type=>{const qa=window.__batchWorkspaceQA;qa.ensureManualBankDiagramQueues().sessions[type].items[1].status='failed_validation';qa.showBatchSolutions({tab:'manual'});},type);
    await page.locator('[data-action="reset-manual-bank-diagram-queue-item"]').click();
    check(await page.evaluate(type=>window.__batchWorkspaceQA.ensureManualBankDiagramQueues().sessions[type].items[1].status,type)==='not_started',`${type} diagram: Reset freezes fresh ready snapshot`);
    check(await page.locator('.manual-bank-diagram-queue-nav').count()===1&&await page.locator('.batch-workspace-grid').count()===1,`${type} diagram: refresh creates no duplicate navigator or grid`);
    for(const action of ['export-manual-bank-diagram-queue-item','export-manual-bank-diagram-queue-all']){
      const downloadPromise=page.waitForEvent('download');await page.locator(`[data-action="${action}"]`).click();const download=await downloadPromise,filename=path.join(output,download.suggestedFilename());await download.saveAs(filename);
      const bytes=fs.readFileSync(filename);check(bytes[0]===0x50&&bytes[1]===0x4b&&bytes.length>500,`${type} diagram: ${action} produces a ZIP package`);
    }
    await stage('finish').click();
    await auditBatchLayout(page,type+'-diagram-finish');
    check(await stage('finish').getAttribute('aria-current')==='step'&&(await page.locator('.batch-workspace-main').innerText()).includes('Finish diagram queue'),`${type} diagram: Finish content and navigation agree`);
    check(await page.locator('[data-action="end-manual-bank-diagram-queue"]').isVisible(),`${type} diagram: Finish retains explicit queue exit`);
    page.once('dialog',dialog=>dialog.accept());await page.locator('[data-action="end-manual-bank-diagram-queue"]').click();
    check(await page.evaluate(type=>window.__batchWorkspaceQA.ensureManualBankDiagramQueues().sessions[type],type)===null,`${type} diagram: confirmed abandonment clears only queue tracking`);
  }
  await page.evaluate(()=>{const qa=window.__batchWorkspaceQA;qa.state.batchActivity={id:'INDIVIDUAL-QA',mode:'individual',status:'completed',operation:'Manual paste',providerCallCount:0};qa.state.activityHistory.records=qa.state.activityHistory.records.filter(record=>record.mode==='individual');qa.showBatchSolutions({tab:'api'});});
  check(await page.locator('[data-action="api-batch-stage"][data-stage="activity"]').isDisabled()&&await page.locator('[data-action="api-batch-stage"][data-stage="review"]').isDisabled(),'Individual/manual activity does not enable API Activity or Review');
  check(await page.evaluate(()=>window.__batchWorkspaceQA.batchWorkspaceAPIActivity())===null,'Individual activity is excluded by the API activity selector');
  // API staging, cancellation, recovery, and request pacing are exercised with
  // the production runner in api-batch-review-qa.mjs. The old synthetic engine
  // persisted immediately and cannot represent the new review authority.
  check(providerRequests.length===0,'No provider request was made');
  check(errors.length===0,`No browser exceptions: ${errors.join('; ')}`);
  finishBatchLayoutAudit();
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({status:'passed',checks,errors,providerRequests,fixture:'Provider engine replaced only in isolated browser source; production wrappers and queue authorities unchanged'},null,2));
  console.log(`PASS: ${checks.length} manual queue and API setup checks. Zero provider calls. Report: ${output}`);
}catch(error){
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({status:'failed',message:error.message,checks,errors,providerRequests},null,2));
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;
}finally{await browser.close();}
