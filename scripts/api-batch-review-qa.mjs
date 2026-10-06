import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {auditBatchLayout,finishBatchLayoutAudit} from './batch-layout-audit.mjs';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output=process.env.API_BATCH_REVIEW_QA_OUTPUT||path.join(os.tmpdir(),'fe-api-review-qa');fs.mkdirSync(output,{recursive:true});
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
// This operation matrix isolates one-question transport fixtures; the real
// 10-question Local transport is covered separately by local-metadata-qa.
html=html.replace('LOCAL_METADATA_BATCH_SIZE=10','LOCAL_METADATA_BATCH_SIZE=1');
html=html.replace('const apiBatchCallBase=callAI;','const apiBatchCallBase=async (prompt,options)=>window.__apiMock(prompt,options);');
html=html.replace('async function apiBatchCommit(item,decision) {','async function apiBatchCommit(item,decision) { if(window.__commitGate)await window.__commitGate;');
html=html.replace('async function apiBatchGenerateOperation(question,key,config) {','async function apiBatchGenerateOperation(question,key,config) { window.__workingQuestion=question;');
html=html.replace('  async function initialize() {',`  setTimeout(()=>window.__apiQA={state,dbPut,dbGet,showBatchSolutions,apiBatchReview,apiBatchReviewReady,apiBatchShow,apiBatchResolve,apiBatchBulk,apiBatchRetry,apiBatchEnd,apiBatchRestart,apiBatchExecute,apiBatchGenerateOperation,apiBatchReviewPersist,apiBatchReviewStorage,apiBatchContentIdentity,apiBatchPatch,apiBatchOperationKeys,apiBatchResumeWork,apiBatchSaveExit,apiBatchUnfinished,apiBatchAccessIssue,batchConfigurationFromModal,batchTargetsForConfig,hasSolutionDiagram,answerCheckIsCurrent,canonicalStableStringify,manualReviewPatchMatches,manualReviewFieldPatch,selectiveMetadataFreezeRequest,classificationSubtopicOptions,answerFormattingRepairRequestFingerprint,apiBatchDraftSnapshot,answerCheckPromptArtifacts,closeModal,runBatchSolutions,refreshActiveSessionQuestionRecord},0);\n  async function initialize() {`);
const checks=[],errors=[],requests=[];const check=(value,message)=>{checks.push({message,passed:Boolean(value)});if(!value)throw new Error(message);};
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let page;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/api\.openai\.com|generativelanguage\.googleapis\.com/.test(r.url())&&!(r.method()==='GET'&&/\/models(?:\?|$)/.test(r.url())))requests.push(r.url());});
 await page.route('**/generativelanguage.googleapis.com/**',route=>route.request().method()==='GET'&&/\/models(?:\?|$)/.test(route.request().url())?route.fulfill({contentType:'application/json',body:JSON.stringify({models:[{name:'models/fixture-resumed-model',supportedGenerationMethods:['generateContent']}]})}):route.abort());
 await page.route('http://fe-api-review.local/',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://fe-api-review.local/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__apiQA?.state.questions.length);await page.evaluate(()=>window.__apiQA.apiBatchReviewReady);
 const installFixtures=()=>{
  const qa=window.__apiQA;window.__calls=[];window.__fail='';window.__gate=null;window.__responses={};
  qa.state.settings.aiProvider='local';qa.state.settings.localAIEndpoint='http://localhost:11434/api/chat';qa.state.settings.localAIModel='test-model';
  window.__seed=structuredClone(qa.state.questions[0]);
  window.__question=(id,key='')=>{
    const q={...structuredClone(window.__seed),id,question:'Compute  the sum of 2 and 2.',choices:['4','5','6','7'],answerIndex:0,answerLetter:'A',topic:'Mathematics and Statistics',nceesTopic:'Mathematics and Statistics',subtopic:'Statistics',solution:'',solutionBody:'',equations:[],hint:'',diagram:null,additionalMetadata:{},generationMetadata:{},updatedAt:new Date().toISOString()};
    if(['polishPresentation','repairMath','solutionDiagrams'].includes(key)){q.solution=window.__solution().solution;q.solutionBody=q.solution;q.additionalMetadata.solutionGeneration={finalAnswer:'4',solutionType:'computational'};}
    if(key==='repairMath'||key==='polishPresentation')q.solution+=' Use \\(x=4.';
    if(key==='formatAnswerChoicesPresentation')q.choices[0]='4.0';
    if(key==='repairChoices')q.choices[2]='';
    if(key==='repairQuestionText')q.question+=' Use \\(2+2.';
    return q;
  };
  window.__solution=()=>({solutionType:'computational',solution:'**Step-by-Step Solution**\n\n**Step 1 — Add the terms**\nAdding the two given terms gives:\n\\[2+2=4\\]\n\n**Step 2 — Check the sum**\nSubtracting either term from the result recovers the other given term. This verifies the calculation using the original data.',equations:['S=a+b','S=2+2=4'],hint:'Add the two given terms.',answerCheck:'Subtracting 2 from 4 recovers 2 and confirms the sum.',finalAnswer:'4',choiceMatchAnswer:'4',choiceStatus:'matched_choice',selectedChoiceIndex:0,selectedChoiceLetter:'A',selectedChoiceText:'4',format:'latex-mathprint'});
  window.__svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 360"><path d="M100 180H700" stroke="currentColor"/><text x="100" y="140">Given length</text></svg>';
  window.__config=(key)=>({scope:'selected',selectedQuestionIDs:[],selectiveMetadataGroups:['topic','subtopic'],solutionMode:'fast',replaceExisting:true,solutionDiagramContextMode:'standard',[key]:true});
  window.__setup=async(key,count=2)=>{
    const questions=Array.from({length:count},(_,i)=>window.__question(`API-${key}-${i+1}`,key));
    for(const q of questions)await qa.dbPut('questions',q);qa.state.questions=questions;qa.state.bank.selection=new Set(questions.map(q=>q.id));
    window.__before=await Promise.all(questions.map(q=>qa.dbGet('questions',q.id)));window.__calls=[];window.__fail='';window.__failID='';window.__rate=false;window.__rateRemaining=null;window.__rateGenerationOnly=false;window.__quota='';window.__holdKey='';window.__holdID='';window.__releaseHeld=null;window.__closeStorage=false;window.__responses={};
    const config=window.__config(key);config.selectedQuestionIDs=questions.map(q=>q.id);
    const run={schemaVersion:1,runID:'RUN-'+key+'-'+Date.now(),config,delaySeconds:0,reviewIndex:0,status:'active',items:questions.map(q=>({questionId:q.id,status:'queued',retrySelected:true}))};
    qa.apiBatchReview.run=run;qa.apiBatchReview.error='';return run;
  };
  window.__apiMock=async(prompt,options)=>{
    const qa=window.__apiQA,run=qa.apiBatchReview.run,id=qa.state.batchActivity?.currentID||qa.state.questions[0].id,key=qa.state.batchActivity?.currentOperationKey||window.__directKey,q=window.__workingQuestion||qa.state.questions.find(q=>q.id===id);
    window.__calls.push({id,key,prompt,time:Date.now(),options:{...options,config:{provider:options.config.provider,model:options.config.model,profileID:options.config.profileID}}});
    if(window.__gate){const gate=window.__gate;window.__gate=null;await gate;}
    if(window.__holdKey===key&&(!window.__holdID||window.__holdID===id)){window.__holdKey='';await new Promise(resolve=>window.__releaseHeld=resolve);}
    if(window.__quota===key){const error=new Error('OpenAI credit, spend, or usage limit reached (429).');error.status=429;error.providerCode='credit_balance_exhausted';error.openAIDiagnostic={classification:'credit_spend_or_usage_limit'};throw error;}
    if(window.__closeStorage){window.__closeStorage=false;qa.apiBatchReview.database.close();}
    if(window.__fail===key&&(!window.__failID||window.__failID===id)&&(!window.__rateGenerationOnly||!options.jsonSchema?.properties?.questionValid)){if(window.__rate&&(window.__rateRemaining===null||window.__rateRemaining>0)){if(window.__rateRemaining!==null)window.__rateRemaining--;const e=new Error('429 rate limit');e.status=429;e.retryAfter=.4;throw e;}if(!window.__rate)throw new Error('Fixture malformed output');}
    if(window.__responses[key])return JSON.stringify(window.__responses[key]);
    let value;
    if(key==='selectiveMetadata'){const f=qa.selectiveMetadataFreezeRequest(q,run.config.selectiveMetadataGroups),topic='Mathematics and Statistics';value={schemaVersion:'1.0',questionId:id,requestFingerprint:f.requestFingerprint,requestedGroups:f.requestedGroups,metadata:{topic,subtopic:qa.classificationSubtopicOptions(topic).find(s=>s!==q.subtopic)||qa.classificationSubtopicOptions(topic)[0]}};}
    if(key==='formatQuestionPresentation')value={question:q.question.replace('Compute  the','Compute the')};
    if(key==='formatAnswerChoicesPresentation')value={schemaVersion:'1.0',questionId:id,questionFingerprint:qa.answerFormattingRepairRequestFingerprint(q),choices:['\\(4.0\\)','5','6','7']};
    if(key==='repairQuestionText')value={question:q.question.replace('\\(2+2.','\\(2+2\\).')};
    if(key==='repairChoices'){if(options.jsonSchema?.properties?.questionValid)value={questionValid:true,hasMatchingChoice:true,answerIndex:0,answerLetter:'A',computedResult:'4',confidence:'high',verification:'2+2=4',issue:''};else value={choices:['4','5','6','7'],answerIndex:0,answerLetter:'A'};}
    if(['generateSolutions','polishPresentation','repairMath'].includes(key)){value=options.jsonSchema?.properties?.questionValid?{questionValid:true,hasMatchingChoice:true,answerIndex:0,answerLetter:'A',computedResult:'4',confidence:'high',verification:'2+2=4',issue:''}:window.__solution();}
    if(key==='questionDiagrams')value={stages:[{title:'Given Geometry',svg:window.__svg}]};
    if(key==='solutionDiagrams')value={recommendedTotalStages:1,hasMoreStages:false,stages:[{title:'Equilibrium',svg:window.__svg}],remainingStageBlueprints:[]};
    if(key==='aiData')value={diagramTextAlternative:'The given terms are 2 and 2.',solutionGenerationData:{givens:[{name:'First term',value:'2'},{name:'Second term',value:'2'}],target:'Sum'},generationPrompts:{},referenceRequirements:[],referenceData:{entries:[]},aiDataStatus:'complete',requiresHumanReview:false,reviewWarnings:[]};
    if(key==='validateQuestions'){const snapshot=qa.apiBatchDraftSnapshot(q,'validate answer blind'),f=qa.answerCheckPromptArtifacts(q,snapshot.savedAIContext,snapshot);value={schemaVersion:'1.2',questionId:id,questionRevision:f.questionRevision,packageFingerprint:f.packageFingerprint,status:'answered',independentAnswer:'4',choiceStatus:'matched_choice',selectedChoiceIndex:0,selectedChoiceLetter:'A',selectedChoiceText:'4',confidence:'high',briefVerification:'Adding 2 and 2 gives 4.',issue:''};}
    if(!value)throw new Error('Missing provider fixture '+key);return JSON.stringify(value);
  };
 };
 await page.evaluate(installFixtures);
 const evaluate=fn=>page.evaluate(fn),action=(key)=>page.locator(`[data-action="${key}"]`);
 await evaluate(()=>window.__apiQA.showBatchSolutions({fresh:true,tab:'api'}));
 check(await page.locator('#api-batch-delay').inputValue()==='1','Setup exposes the existing one-second delay');
 check(await page.locator('[data-batch-operation]').count()===12,'All 12 existing API operations remain available');
 check(await action('start-batch-solutions').isDisabled(),'No operation starts preselected');
 await auditBatchLayout(page,'api-setup');
 // Compact operation rows retain real checkbox listeners and conditional settings.
 check(await page.locator('.api-batch-setup-grid .batch-workspace-aside').isHidden(),'Setup gives operations the full width instead of reserving an empty sidebar');
 check(await page.locator('.api-batch-operation-rows > .batch-operation-group').count()===4,'All four operation categories use compact rows');
 check(await page.locator('.api-batch-setup-guide').getAttribute('open')===null,'Setup instructions are available in a closed disclosure');
 await page.locator('.api-batch-setup-guide > summary').click();check(await page.locator('.api-batch-setup-guide li').count()===4&&await page.locator('.api-batch-setup-guide ol').isVisible(),'Expanding setup help displays every workflow step');await page.locator('.api-batch-setup-guide > summary').click();
 await evaluate(()=>document.documentElement.dataset.theme='dark');await page.waitForTimeout(600);await page.screenshot({path:path.join(output,'api-operation-rows-default.png')});
 await page.locator('input[name=batch-scope][value=all]').check();await page.locator('#batch-selective-metadata').check();
 check(await page.locator('#batch-selective-metadata-controls').isVisible()&&await page.locator('[data-selective-metadata-batch-group]:checked').count()===5,'Selecting metadata still reveals all five selectable groups');
 await page.locator('[data-action=selective-metadata-batch-clear-all]').click();check(await action('start-batch-solutions').isDisabled()&&await page.locator('[data-selective-metadata-batch-group]:checked').count()===0,'Metadata Clear All updates the original validity guard after relocation');
 await page.locator('[data-action=selective-metadata-batch-select-all]').click();check(await action('start-batch-solutions').isEnabled()&&await page.locator('[data-selective-metadata-batch-group]:checked').count()===5,'Metadata Select All restores matching targets');
 await auditBatchLayout(page,'api-setup-metadata-options');
 await page.locator('#batch-generate-solutions').check();check(await page.locator('#batch-solution-mode-controls').isVisible(),'Selecting generation reveals the existing quality controls');
 await page.locator('input[name=batch-solution-mode][value=full]').check();check(await page.locator('#batch-polish-new-solutions-control').isVisible()&&await page.locator('#batch-polish-new-solutions').isEnabled(),'Full quality retains optional polishing');await page.locator('#batch-polish-new-solutions').check();
 await auditBatchLayout(page,'api-setup-full-quality-options');
 await page.locator('#batch-generate-solutions').uncheck();check(await page.locator('#batch-solution-mode-controls').isHidden()&&await page.locator('#batch-polish-new-solutions-control').isHidden()&&await page.locator('#batch-polish-new-solutions').isDisabled(),'Turning generation off hides and disables its dependent settings');
 await page.locator('#batch-generate-solutions').check();check(await page.locator('input[name=batch-solution-mode][value=full]').isChecked()&&await page.locator('#batch-polish-new-solutions').isChecked(),'Generation options retain the chosen quality and polishing preference');
 check(await page.locator('[data-solution-diagram-context-scope=api]').isHidden(),'Solution diagram settings take no space before that operation is selected');await page.locator('#batch-solution-diagrams').check();check(await page.locator('#batch-solution-diagram-context-mode').isVisible(),'Selecting solution diagrams reveals its context selector');
 await page.locator('#batch-solution-diagram-context-mode').selectOption('full');await page.locator('#batch-solution-diagrams').uncheck();check(await page.locator('[data-solution-diagram-context-scope=api]').isHidden(),'Disabling solution diagrams hides its extra settings');await page.locator('#batch-solution-diagrams').check();check(await page.locator('#batch-solution-diagram-context-mode').inputValue()==='full','Diagram context remains selected when its operation is re-enabled');
 const operationIDs=await page.locator('[data-batch-operation]').evaluateAll(nodes=>nodes.map(n=>n.id));for(const id of operationIDs)await page.locator('#'+id).check();
 check(await evaluate(()=>{const q=window.__apiQA,c=q.batchConfigurationFromModal();return q.apiBatchOperationKeys(c).length===12&&c.scope==='all'&&c.solutionMode==='full'&&c.polishNewSolutionsPreference&&c.solutionDiagramContextMode==='full'&&c.selectiveMetadataGroups.length===5;}),'All 12 relocated operations and their selected settings reach the original configuration reader');
 check(new Set(operationIDs).size===12&&await page.locator('[data-batch-operation]:checked').count()===12,'Layout provides exactly one live checkbox for each operation');
 await auditBatchLayout(page,'api-setup-all-operation-options');
 check(await page.locator('[data-batch-operation]:checked').count()===12&&await page.locator('#batch-solution-diagram-context-mode').inputValue()==='full'&&await page.locator('#batch-polish-new-solutions').isChecked(),'Resizing preserves operation choices and dependent settings');
 check(await evaluate(()=>!window.__calls.length),'Setup and option selection make no generation requests');
 await page.screenshot({path:path.join(output,'api-operation-rows-all-selected.png')});
 await evaluate(()=>{const q=window.__apiQA;q.closeModal();q.showBatchSolutions({fresh:true,tab:'api'});});check(await page.locator('[data-batch-operation]:checked').count()===0&&await action('start-batch-solutions').isDisabled(),'Fresh setup retains the rule that no operation is preselected');
 const operations=['formatQuestionPresentation','formatAnswerChoicesPresentation','repairQuestionText','selectiveMetadata','aiData','generateSolutions','polishPresentation','repairMath','repairChoices','questionDiagrams','solutionDiagrams','validateQuestions'];
 for(const key of operations){
   await page.evaluate(async key=>{const run=await window.__setup(key);await window.__apiQA.apiBatchExecute(run,run.items);},key);
   const result=await evaluate(async()=>{const q=window.__apiQA,r=q.apiBatchReview.run;return {items:r.items,untouched:(await Promise.all(window.__before.map(i=>q.dbGet('questions',i.id)))).every((i,n)=>q.canonicalStableStringify(i)===q.canonicalStableStringify(window.__before[n]))};});
   fs.writeFileSync(path.join(output,key+'.json'),JSON.stringify(result,null,2));
   check(result.untouched,`${key}: generation writes no Question Bank fields`);
   check(result.items.every(i=>['pending','unchanged'].includes(i.status)),`${key}: valid results stage (${result.items.map(i=>i.error||i.status).join('; ')})`);
   check(await page.locator('.manual-whole-review-comparison,.manual-whole-review-table').count()>0,`${key}: actual before/after content is displayed`);
   await action('api-batch-decide').filter({hasText:'Accept'}).click();await page.waitForFunction(()=>window.__apiQA.apiBatchReview.run.reviewIndex===1&&!window.__apiQA.apiBatchReview.busy);
   check(await evaluate(()=>window.__apiQA.apiBatchReview.run.items[0].status==='accepted'||window.__apiQA.apiBatchReview.run.items[0].status==='reviewed_unchanged'),`${key}: Accept saves and advances`);
   await action('api-batch-nav').filter({hasText:'Previous'}).click();
   check(await page.locator('[data-api-batch-jump]').inputValue()==='0',`${key}: Previous revisits accepted question`);
   await action('api-batch-decide').filter({hasText:'Reject'}).click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.busy);
   const undone=await evaluate(async()=>{const q=window.__apiQA,r=q.apiBatchReview.run,i=r.items[0],saved=await q.dbGet('questions',i.questionId);return {status:i.status,diff:q.manualReviewFieldPatch(window.__before[0],saved)};});
   check(undone.status==='rejected'&&!undone.diff.length,`${key}: Reject restores original fields (${JSON.stringify(undone.diff)})`);
   await action('api-batch-bulk').filter({hasText:'Accept All'}).click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.busy);
   check(await evaluate(()=>window.__apiQA.apiBatchReview.run.items.every(i=>['accepted','reviewed_unchanged'].includes(i.status))),`${key}: bulk acceptance processes usable proposals`);
   if(key==='validateQuestions'){check((await page.locator('.manual-whole-review').innerText()).includes('Agrees with stored key')&&!(await page.locator('.manual-whole-review').innerText()).includes('No answer returned'),'Validation review displays the actual stored independent answer and comparison');check(await evaluate(async()=>{const q=window.__apiQA;return (await Promise.all(q.apiBatchReview.run.items.map(i=>q.dbGet('questions',i.questionId)))).every(record=>q.answerCheckIsCurrent(record));}), 'Accepted validation remains current in the saved Question Bank');}
   if(['selectiveMetadata','generateSolutions','questionDiagrams','solutionDiagrams','validateQuestions'].includes(key)){await auditBatchLayout(page,'api-review-'+key);await page.screenshot({path:path.join(output,key+'-review.png')});}
   await action('api-batch-stage').filter({hasText:'Finish & Retry'}).first().click();await auditBatchLayout(page,'api-finish-'+key);
   await action('api-batch-end').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.run&&!window.__apiQA.apiBatchReview.busy);
   check(await page.locator('#api-batch-delay').count()===1,`${key}: Finish returns to setup and ends task`);
 }
 // Full quality uses the same verifier and current-choice generator.
 await evaluate(async()=>{const r=await window.__setup('generateSolutions',1);r.config.solutionMode='full';await window.__apiQA.apiBatchExecute(r,r.items);});
 check(await evaluate(()=>window.__calls.length>=2&&window.__apiQA.apiBatchReview.run.items[0].status==='pending'),'Full quality retains verifier and stages the final result');
 // Twenty-question run through the real Start button has no intermediate review gate.
 await evaluate(async()=>{await window.__setup('formatQuestionPresentation',20);window.__apiQA.apiBatchReview.run=null;window.__apiQA.showBatchSolutions({fresh:true,tab:'api'});window.__holdKey='formatQuestionPresentation';window.__holdID='API-formatQuestionPresentation-6';});
 await page.locator('#batch-format-question-presentation').check();await page.locator('#api-batch-delay').fill('0');await action('start-batch-solutions').click();await page.waitForFunction(()=>window.__calls.length===6&&window.__releaseHeld);
 check(await evaluate(()=>{const q=window.__apiQA,r=q.apiBatchReview.run;return q.apiBatchReview.running&&!r.paused&&q.apiBatchReview.stage==='activity'&&r.items.length===20&&r.items.slice(0,5).every(i=>i.status==='pending')&&r.items.slice(6).every(i=>i.status==='queued');})&&await page.locator('.api-batch-review-navigation').count()===0,'After five questions the full 20-question run stays on Activity without requiring review');
 await auditBatchLayout(page,'api-continuous-middle');await page.screenshot({path:path.join(output,'api-continuous-20-in-progress.png')});
 await evaluate(()=>window.__releaseHeld());await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running);
 check(await evaluate(()=>{const q=window.__apiQA,r=q.apiBatchReview.run;return r.status==='completed'&&q.apiBatchReview.stage==='review'&&r.items.every(i=>i.status==='pending')&&window.__calls.length===20&&new Set(window.__calls.map(c=>c.id)).size===20&&r.summary.startsWith('20 of 20 questions processed.');}),'One Start processes all 20 targets and opens Review only after generation finishes');
 check(await evaluate(async()=>{const q=window.__apiQA;return (await Promise.all(window.__before.map(i=>q.dbGet('questions',i.id)))).every((record,n)=>!q.manualReviewFieldPatch(window.__before[n],record).length);}), 'A full continuous run stages all proposals without accepting or modifying the saved bank');
 await page.screenshot({path:path.join(output,'api-continuous-20-completed.png')});
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',20);window.__fail='formatQuestionPresentation';window.__failID=r.items[5].questionId;await window.__apiQA.apiBatchExecute(r,r.items);});
 check(await evaluate(()=>{const r=window.__apiQA.apiBatchReview.run;return window.__calls.length===20&&r.status==='completed'&&r.items[5].status==='failed'&&r.items.filter(i=>i.status==='pending').length===19&&r.items.at(-1).status==='pending';}),'A question failure halfway through keeps its retry entry and processes every remaining target');
 await evaluate(async()=>{const r=await window.__setup('generateSolutions',20);r.config.selectiveMetadata=true;await window.__apiQA.apiBatchExecute(r,r.items);});
 check(await evaluate(()=>{const r=window.__apiQA.apiBatchReview.run;return window.__calls.length===40&&r.status==='completed'&&r.items.length===20&&r.items.every(i=>i.status==='pending'&&!i.retryAttention&&i.operations.includes('generateSolutions')&&i.operations.includes('selectiveMetadata')&&i.proposed.solution);}), 'Twenty combined metadata and worked-solution questions finish without any acceptance or intermediate review');
 // Real Start button, pacing, pause while a request is in flight, and early stop.
 await evaluate(async()=>{await window.__setup('formatQuestionPresentation',3);window.__apiQA.apiBatchReview.run=null;window.__apiQA.showBatchSolutions({fresh:true,tab:'api'});window.__gate=new Promise(resolve=>window.__release=resolve);});
 await page.locator('#batch-format-question-presentation').check();await page.locator('#api-batch-delay').fill('0.5');await action('start-batch-solutions').click();await page.waitForFunction(()=>window.__calls.length===1);
 await action('api-batch-pause').click();await evaluate(()=>window.__release());
 await page.waitForTimeout(700);
 check(await evaluate(()=>window.__calls.length===1&&window.__apiQA.apiBatchReview.run.paused),'Pause lets the current request finish and blocks the next request');
 await auditBatchLayout(page,'api-paused-activity');
 await action('api-batch-pause').click();await page.waitForFunction(()=>window.__calls.length===2);
 check(await evaluate(()=>window.__calls[1].time-window.__calls[0].time>=500),'Configured spacing is enforced');
 await action('api-batch-stop').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running);
 check(await evaluate(()=>window.__apiQA.apiBatchReview.run.items.some(i=>i.proposed)&&window.__apiQA.apiBatchReview.run.items.some(i=>['interrupted','cancelled'].includes(i.status))&&window.__calls.length===2),'Stopping keeps completed proposals and exposes unfinished targets without another provider request');
 await action('api-batch-stage').filter({hasText:'Finish & Retry'}).first().click();
 check(await page.locator('[data-api-retry]:checked').count()>0,'Retry list is expanded and selected by default');
 await action('api-batch-select-retries').filter({hasText:'Clear all'}).click();check(await action('api-batch-retry-selected').isDisabled(),'Clear all disables empty retry');
 await action('api-batch-select-retries').filter({hasText:'Select all'}).click();check(await action('api-batch-retry-selected').isEnabled(),'Select all restores retry');
 // Retry only the checked interrupted target through the real Finish control.
 const retryIDs=await page.locator('[data-api-retry]').evaluateAll(nodes=>nodes.map(n=>n.dataset.apiRetry));
 await action('api-batch-select-retries').filter({hasText:'Clear all'}).click();await page.locator(`[data-api-retry="${retryIDs[0]}"]`).check();
 const beforeRetry=await evaluate(()=>window.__calls.length);await action('api-batch-retry-selected').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running&&!window.__apiQA.apiBatchReview.busy);
 check(await page.evaluate(({beforeRetry,id})=>window.__calls.slice(beforeRetry).length===1&&window.__calls.slice(beforeRetry).every(c=>c.id===id),{beforeRetry,id:retryIDs[0]}),'Retry Selected processes only checked targets');
 // A combined request uses the evolving draft, including hidden context and generated solutions.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',1);Object.assign(r.config,{selectiveMetadata:true,aiData:true,generateSolutions:true,solutionDiagrams:true,validateQuestions:true});await window.__apiQA.apiBatchExecute(r,r.items);});
 check(await evaluate(()=>{const i=window.__apiQA.apiBatchReview.run.items[0];return i.status==='pending'&&!i.retryAttention&&i.operations.length===6&&i.proposed.question==='Compute the sum of 2 and 2.'&&i.proposed.solution&&window.__apiQA.hasSolutionDiagram(i.proposed);}),'Combined operations share the evolving draft and stage all six results');
 check(await evaluate(async()=>{const q=window.__apiQA;return q.canonicalStableStringify(await q.dbGet('questions',window.__before[0].id))===q.canonicalStableStringify(window.__before[0]);}),'Combined generation preserves the saved original');
 await action('api-batch-bulk').filter({hasText:'Reject All'}).click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.busy);
 check(await evaluate(async()=>{const q=window.__apiQA;return q.apiBatchReview.run.items[0].status==='rejected'&&!q.manualReviewFieldPatch(window.__before[0],await q.dbGet('questions',window.__before[0].id)).length;}),'Reject All discards combined proposals without changing the bank');
 await action('api-batch-bulk').filter({hasText:'Accept All'}).click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.busy);
 await action('api-batch-bulk').filter({hasText:'Reject All'}).click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.busy);
 check(await evaluate(async()=>{const q=window.__apiQA;return !q.manualReviewFieldPatch(window.__before[0],await q.dbGet('questions',window.__before[0].id)).length;}),'Reject All can undo accepted combined fields');
 // Pacing covers the verifier and generation requests within one question.
 await evaluate(async()=>{const r=await window.__setup('generateSolutions',1);r.config.solutionMode='full';r.delaySeconds=.3;await window.__apiQA.apiBatchExecute(r,r.items);});
 check(await evaluate(()=>window.__calls.length>=2&&window.__calls.every((c,n)=>!n||c.time-window.__calls[n-1].time>=300)),'Full quality spaces requests inside the same question');
 // Hosted batching disables hidden rate-limit resends, retaining the task route.
 await evaluate(async()=>{const q=window.__apiQA,r=await window.__setup('aiData',1);q.state.settings.aiProvider='gemini';q.state.settings.geminiModel='fixture-gemini';q.state.keyProfiles=[{id:'mock-profile',key:'not-a-real-key'}];q.state.activeKeyID='mock-profile';await q.apiBatchExecute(r,r.items);q.state.settings.aiProvider='local';});
 check(await evaluate(()=>window.__calls.length===1&&window.__calls[0].options.singleAttempt===true&&window.__calls[0].options.config.provider==='gemini'&&window.__calls[0].options.requestSpacingSeconds===0),'Hosted batch uses its configured route, explicit spacing, and a single transport attempt');
 // Review updates as further proposals arrive, without waiting for the whole run.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',3);window.__gate=new Promise(resolve=>window.__releaseFirst=resolve);window.__execute=window.__apiQA.apiBatchExecute(r,r.items);});await page.waitForFunction(()=>window.__calls.length===1);
 await action('api-batch-pause').click();await evaluate(()=>window.__releaseFirst());await page.waitForFunction(()=>window.__apiQA.apiBatchReview.run.items[0].status==='pending');
 await action('api-batch-stage').filter({hasText:'Review Available Results'}).click();await action('api-batch-decide').filter({hasText:'Accept'}).click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.busy&&window.__apiQA.apiBatchReview.run.reviewIndex===1);
 check(await action('api-batch-decide').filter({hasText:'Accept'}).isDisabled(),'Unfinished question cannot be accepted during generation');
 await evaluate(()=>{window.__gate=new Promise(resolve=>window.__releaseSecond=resolve);window.__apiQA.apiBatchReview.run.paused=false;});await page.waitForFunction(()=>window.__calls.length===2);
 await evaluate(()=>{window.__gate=new Promise(resolve=>window.__releaseThird=resolve);window.__releaseSecond();});await page.waitForFunction(()=>window.__calls.length===3&&window.__apiQA.apiBatchReview.run.items[1].status==='pending');
 await action('api-batch-decide').filter({hasText:'Accept'}).waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[data-action="api-batch-decide"][data-decision="accept"]').disabled);
 check(await evaluate(()=>window.__apiQA.apiBatchReview.running)&&await action('api-batch-decide').filter({hasText:'Accept'}).isEnabled(),'Visible review becomes usable when its proposal arrives while other requests continue');
 await action('api-batch-decide').filter({hasText:'Accept'}).click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.busy);await evaluate(()=>window.__releaseThird());await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running);
 // Close does not hijack the screen on completion, and recovery remains explicit.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',1);window.__gate=new Promise(resolve=>window.__release=resolve);window.__execute=window.__apiQA.apiBatchExecute(r,r.items);});await page.waitForFunction(()=>window.__calls.length===1);
 await page.locator('.modal-header [data-action="close-modal"]').click();await evaluate(()=>window.__release());await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running);
 check(await page.locator('.modal-layer').count()===0,'Closing an active API task does not reopen the dialog on completion');
 await evaluate(()=>window.__apiQA.showBatchSolutions({tab:'api'}));await action('api-batch-stage').filter({hasText:'Resume API Review'}).click();check(await page.locator('.manual-whole-review').isVisible(),'Closed task reopens with its staged review');
 page.once('dialog',dialog=>dialog.dismiss());await evaluate(()=>window.__apiQA.apiBatchEnd());check(await evaluate(()=>Boolean(window.__apiQA.apiBatchReview.run)),'Cancelling early Finish retains proposals');
 page.once('dialog',dialog=>dialog.accept());await evaluate(()=>window.__apiQA.apiBatchEnd());check(await evaluate(()=>!window.__apiQA.apiBatchReview.run),'Confirmed early Finish clears task tracking');
 // Editing the delay during a wait takes effect without restarting the batch.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',2);r.delaySeconds=5;window.__execute=window.__apiQA.apiBatchExecute(r,r.items);});await page.waitForFunction(()=>window.__calls.length===1&&window.__apiQA.apiBatchReview.run.waitUntil>Date.now());
 await page.locator('[data-api-batch-live-delay]').fill('0');await page.locator('[data-api-batch-live-delay]').dispatchEvent('change');await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running);
 check(await evaluate(()=>window.__calls.length===2&&window.__calls[1].time-window.__calls[0].time<3000&&window.__calls[1].options.requestSpacingSeconds===0),'Live delay changes apply to both the current wait and the provider transport');
 // Skip cancels the queued request and continues other questions when resumed.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',3);r.delaySeconds=3;window.__execute=window.__apiQA.apiBatchExecute(r,r.items);});await page.waitForFunction(()=>window.__calls.length===1&&window.__apiQA.apiBatchReview.run.waitUntil>Date.now());
 await action('api-batch-pause').click();await action('skip-current-question').click();await page.waitForFunction(()=>window.__apiQA.apiBatchReview.run.items.some(i=>i.status==='skipped'));
 await page.locator('[data-api-batch-live-delay]').fill('0');await page.locator('[data-api-batch-live-delay]').dispatchEvent('change');await action('api-batch-pause').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running);
 check(await evaluate(()=>window.__calls.length===2&&window.__apiQA.apiBatchReview.run.items[1].status==='skipped'&&window.__apiQA.apiBatchReview.run.items[2].status==='pending'),'Skip while paused sends no skipped request and preserves remaining targets');
 // Scope and replace-existing options retain their original eligibility logic.
 await evaluate(async()=>{const r=await window.__setup('generateSolutions',2);const q=window.__apiQA.state.questions[0];q.solution=window.__solution().solution;q.solutionBody=q.solution;await window.__apiQA.dbPut('questions',q);r.config.replaceExisting=false;r.config.scope='missing';window.__scopeTargets=window.__apiQA.batchTargetsForConfig(r.config).map(q=>q.id);r.config.scope='all';await window.__apiQA.apiBatchExecute(r,r.items);});
 check(await evaluate(()=>window.__scopeTargets.length===1&&window.__calls.length===1&&window.__apiQA.apiBatchReview.run.items[0].status==='unchanged'),'Only-needing scope and Replace Existing off preserve existing solutions');
 // Temporary rate limits wait and resume the same request without a review gate.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',2);window.__rate=true;window.__fail='formatQuestionPresentation';window.__execute=window.__apiQA.apiBatchExecute(r,r.items);});
 await page.waitForFunction(()=>window.__apiQA.apiBatchReview.run.rateUntil>Date.now());await page.waitForTimeout(600);
 check(await evaluate(()=>window.__calls.length===1&&!window.__apiQA.apiBatchReview.run.paused&&window.__apiQA.apiBatchReview.stage==='activity'),'429 waits on Activity without requiring manual Resume or review');
 await auditBatchLayout(page,'api-rate-limited-activity');
 await evaluate(()=>{window.__fail='';window.__rate=false;});await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running);
 check(await evaluate(()=>window.__calls.length===3&&window.__calls[0].id===window.__calls[1].id&&window.__apiQA.apiBatchReview.run.items.every(i=>i.status==='pending'&&!i.retryAttention)),'The rate-limited request retries automatically, then all remaining questions finish');
 check(await evaluate(()=>window.__calls[1].time-window.__calls[0].time>=1000),'Automatic retry honors the provider cooldown');
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',20);window.__fail='formatQuestionPresentation';window.__failID=r.items[5].questionId;window.__rate=true;window.__rateRemaining=1;await window.__apiQA.apiBatchExecute(r,r.items);});
 check(await evaluate(()=>{const r=window.__apiQA.apiBatchReview.run,limited=window.__calls.filter(c=>c.id===r.items[5].questionId);return r.status==='completed'&&r.items.every(i=>i.status==='pending'&&!i.retryAttention)&&window.__calls.length===21&&limited.length===2&&limited[0].prompt===limited[1].prompt&&limited[1].time-limited[0].time>=1000;}),'A temporary limit after five questions retries the identical request, then finishes the entire 20-question batch');
 await evaluate(async()=>{const r=await window.__setup('generateSolutions',1);r.config.solutionMode='full';window.__rate=true;window.__rateRemaining=1;window.__rateGenerationOnly=true;window.__fail='generateSolutions';await window.__apiQA.apiBatchExecute(r,r.items);});
 check(await evaluate(()=>window.__calls.length===3&&window.__calls.filter(c=>c.options.jsonSchema?.properties?.questionValid).length===1&&window.__apiQA.apiBatchReview.run.items[0].status==='pending'),'A generation retry preserves the already-completed Full quality verifier request');
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',3);window.__rate=true;window.__fail='formatQuestionPresentation';window.__failID=r.items[0].questionId;window.__execute=window.__apiQA.apiBatchExecute(r,r.items);});await page.waitForFunction(()=>window.__apiQA.apiBatchReview.run.rateUntil>Date.now());await action('api-batch-pause').click();await page.waitForTimeout(1100);
 check(await evaluate(()=>window.__calls.length===1&&window.__apiQA.apiBatchReview.run.paused&&window.__apiQA.apiBatchReview.running),'Manual Pause overrides automatic cooldown continuation');
 await evaluate(()=>{window.__fail='';window.__rate=false;});await action('api-batch-pause').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running);
 check(await evaluate(()=>window.__calls.length===4&&window.__apiQA.apiBatchReview.run.items.every(i=>i.status==='pending')),'Manual Resume completes the delayed request and all remaining questions');
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',3);window.__rate=true;window.__fail='formatQuestionPresentation';window.__failID=r.items[0].questionId;await window.__apiQA.apiBatchExecute(r,r.items);});
 check(await evaluate(()=>{const r=window.__apiQA.apiBatchReview.run;return window.__calls.length===6&&r.status==='completed'&&r.items[0].status==='failed'&&document.querySelector('[data-api-count="attention"]').textContent==='1'&&r.items.slice(1).every(i=>i.status==='pending');}),'Repeated rate failures are bounded to three retries, appear in Needs retry, and do not block the remaining batch');
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',3);r.config.aiData=true;window.__rate=true;window.__fail='aiData';window.__failID=r.items[0].questionId;await window.__apiQA.apiBatchExecute(r,r.items);});
 check(await evaluate(()=>{const r=window.__apiQA.apiBatchReview.run;return window.__calls.length===9&&r.status==='completed'&&r.items[0].status==='pending'&&r.items[0].retryAttention&&r.items[0].checkpoint.completed.join(',')==='formatQuestionPresentation'&&r.items.slice(1).every(i=>i.status==='pending'&&!i.retryAttention);}), 'Exhausted retries retain an earlier successful operation while the remaining combined batch finishes');
 await evaluate(()=>{window.__rate=false;window.__fail='';window.__calls=[];});await action('api-batch-resume-work').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running&&!window.__apiQA.apiBatchReview.busy);
 check(await evaluate(()=>window.__calls.length===1&&window.__calls[0].key==='aiData'&&window.__apiQA.apiBatchReview.run.items.every(i=>i.status==='pending'&&!i.retryAttention)), 'Resume after exhausted retries runs only the unfinished operation, preserving the other completed questions');
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',2);r.config.aiData=true;window.__rate=true;window.__fail='aiData';window.__execute=window.__apiQA.apiBatchExecute(r,r.items);});await page.waitForFunction(()=>window.__calls.length===2&&window.__apiQA.apiBatchReview.run.rateUntil>Date.now());await action('api-batch-stop').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running);
 check(await evaluate(()=>window.__calls.length===2&&window.__apiQA.apiBatchReview.run.status==='stopped'&&window.__apiQA.apiBatchReview.stage==='activity'&&window.__apiQA.apiBatchReview.run.items[0].checkpoint.completed.join(',')==='formatQuestionPresentation'),'Stop during cooldown sends no retry, preserves completed operations, and remains on Activity');
 await evaluate(()=>{window.__rate=false;window.__fail='';window.__calls=[];});await action('api-batch-resume-work').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running&&!window.__apiQA.apiBatchReview.busy);
 check(await evaluate(()=>window.__calls.length===3&&window.__calls[0].key==='aiData'&&window.__apiQA.apiBatchReview.run.items.every(i=>i.status==='pending')),'Resuming a stopped cooldown completes its checkpoint and untouched targets without repeating earlier operations');
 // Failure in a later operation preserves the earlier valid staged proposal.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',1);r.config.formatAnswerChoicesPresentation=true;window.__fail='formatAnswerChoicesPresentation';await window.__apiQA.apiBatchExecute(r,r.items);});
 check(await evaluate(()=>{const i=window.__apiQA.apiBatchReview.run.items[0];return i.status==='pending'&&i.retryAttention&&i.proposed.question==='Compute the sum of 2 and 2.'&&i.proposed.choices[0]==='4';}),'Partial failure stages only successful operations and preserves other fields');
 const prior=await evaluate(()=>JSON.stringify(window.__apiQA.apiBatchReview.run.items[0].proposed));
 await evaluate(async()=>{window.__fail='formatQuestionPresentation';await window.__apiQA.apiBatchRetry([window.__apiQA.apiBatchReview.run.items[0].questionId]);});
 check(await page.evaluate(prior=>JSON.stringify(window.__apiQA.apiBatchReview.run.items[0].proposed)===prior,prior),'Failed retry preserves the earlier valid proposal');
 // Failed retries retain both rejected and accepted decisions.
 await action('api-batch-decide').filter({hasText:'Reject'}).click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.busy);
 await evaluate(async()=>{window.__responses.formatAnswerChoicesPresentation={};await window.__apiQA.apiBatchRetry([window.__apiQA.apiBatchReview.run.items[0].questionId]);});
 check(await evaluate(()=>window.__apiQA.apiBatchReview.run.items[0].status==='rejected'&&window.__apiQA.apiBatchReview.run.items[0].proposed),'Failed retry retains a previous Reject decision');
 await evaluate(async()=>{const q=window.__apiQA,r=await window.__setup('formatQuestionPresentation',1);await q.apiBatchExecute(r,r.items);await q.apiBatchResolve(r.items[0],'accept');window.__fail='formatQuestionPresentation';await q.apiBatchRetry([r.items[0].questionId]);});
 check(await evaluate(()=>window.__apiQA.apiBatchReview.run.items[0].status==='accepted'&&window.__apiQA.apiBatchReview.run.items[0].acceptedPatch),'Failed retry retains a previous Accept decision and undo patch');
 await action('api-batch-decide').filter({hasText:'Reject'}).click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.busy);
 check(await evaluate(async()=>{const q=window.__apiQA;return !q.manualReviewFieldPatch(window.__before[0],await q.dbGet('questions',window.__before[0].id)).length;}),'A failed accepted retry can still restore the original saved fields');
 // Save & Exit persists a partial question; Resume skips already completed operations.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',2);r.config.aiData=true;window.__holdKey='aiData';window.__execute=window.__apiQA.apiBatchExecute(r,r.items);});
 await page.waitForFunction(()=>window.__calls.length===2&&window.__releaseHeld);
 check(await evaluate(async()=>{const q=window.__apiQA,s=await q.apiBatchReviewStorage('get');return s.items[0].checkpoint.completed.join(',')==='formatQuestionPresentation'&&s.items[0].proposed.question==='Compute the sum of 2 and 2.';}),'A completed operation and its valid proposal are saved before the next provider call');
 await action('api-batch-save-exit').click();await evaluate(()=>window.__releaseHeld());await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running);
 check(await evaluate(()=>window.__apiQA.apiBatchReview.run.status==='suspended'&&!document.querySelector('[data-api-review-run]')),'Save & Exit stops generation, saves, and closes the task window');
 await evaluate(()=>window.__apiQA.showBatchSolutions({fresh:true,tab:'api'}));
 check(await action('api-batch-resume-work').isVisible(),'Reopening setup provides Resume Unfinished Work');
 await evaluate(()=>window.__calls=[]);await action('api-batch-resume-work').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running&&!window.__apiQA.apiBatchReview.busy);
 check(await evaluate(()=>window.__calls.length===3&&window.__calls[0].key==='aiData'&&window.__calls.filter(c=>c.key==='formatQuestionPresentation').length===1),'Resume continues at the saved operation and avoids repeating completed work');
 check(await evaluate(async()=>{const q=window.__apiQA;return (await Promise.all(window.__before.map(i=>q.dbGet('questions',i.id)))).every((record,n)=>!q.manualReviewFieldPatch(window.__before[n],record).length);}), 'Resumed proposals remain unsaved until accepted');
 // A partial acceptance can be continued, accepted again, and fully restored.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',1);r.config.aiData=true;window.__quota='aiData';await window.__apiQA.apiBatchExecute(r,r.items);});
 check(await evaluate(()=>{const q=window.__apiQA;return !q.apiBatchReview.running&&q.apiBatchReview.run.status==='suspended'&&q.apiBatchReview.run.accessBlock.kind==='usage'&&window.__calls.length===2;}),'Usage exhaustion saves and suspends immediately without trying another question or key');
 check(await evaluate(()=>window.__apiQA.apiBatchReview.stage==='activity')&&await page.locator('[data-api-review-live]').isVisible(),'Usage suspension stays on Activity and explains recovery without requiring review');
 await action('api-batch-stage').filter({hasText:'Review Available Results'}).click();await auditBatchLayout(page,'api-usage-suspended-review');await page.screenshot({path:path.join(output,'api-usage-suspended.png')});
 await action('api-batch-decide').filter({hasText:'Accept'}).click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.busy);
 check(await evaluate(()=>window.__apiQA.apiBatchReview.run.items[0].status==='accepted'&&window.__apiQA.apiBatchReview.run.items[0].checkpoint),'Accepting a partial proposal retains its unfinished operations');
 await evaluate(()=>{window.__quota='';window.__calls=[];});await action('api-batch-resume-work').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running&&!window.__apiQA.apiBatchReview.busy);
 check(await evaluate(()=>window.__calls.length===1&&window.__calls[0].key==='aiData'&&window.__apiQA.apiBatchReview.run.items[0].status==='pending'),'Resuming an accepted partial question continues only the remaining operation');
 await action('api-batch-decide').filter({hasText:'Accept'}).click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.busy);
 await action('api-batch-decide').filter({hasText:'Reject'}).click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.busy);
 check(await evaluate(async()=>{const q=window.__apiQA;return !q.manualReviewFieldPatch(window.__before[0],await q.dbGet('questions',window.__before[0].id)).length;}),'Reject after resumed acceptance restores all original fields across both acceptances');
 // Resume never automatically reruns a rejected question or a completed proposal.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',3);await window.__apiQA.apiBatchExecute(r,r.items);r.items[0].checkpoint={before:r.items[0].before,draft:r.items[0].proposed,identity:r.items[0].identity,completed:['formatQuestionPresentation'],successful:['formatQuestionPresentation'],warnings:[]};await window.__apiQA.apiBatchResolve(r.items[0],'accept',false);await window.__apiQA.apiBatchResolve(r.items[1],'reject',false);r.items[2].status='interrupted';window.__calls=[];window.__completedExcluded=!window.__apiQA.apiBatchUnfinished(r.items[0]);await window.__apiQA.apiBatchResumeWork();});
 check(await evaluate(()=>window.__completedExcluded),'A fully completed checkpoint recovered at the end of a request never makes an accepted question unfinished');
 check(await evaluate(()=>window.__calls.length===1&&window.__calls[0].id.endsWith('-3')&&window.__apiQA.apiBatchReview.run.items[0].status==='accepted'&&window.__apiQA.apiBatchReview.run.items[1].status==='rejected'),'Resume keeps existing Accept and Reject decisions and runs only unfinished targets');
 // Checkpoint identity protects user edits made while the task is suspended.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',1);r.config.aiData=true;window.__quota='aiData';await window.__apiQA.apiBatchExecute(r,r.items);const saved=await window.__apiQA.dbGet('questions',r.items[0].questionId);saved.question+=' Later edit.';await window.__apiQA.dbPut('questions',saved);window.__quota='';window.__calls=[];await window.__apiQA.apiBatchResumeWork();});
 check(await evaluate(async()=>{const q=window.__apiQA;return window.__calls.length===0&&q.apiBatchReview.run.items[0].status==='stale'&&(await q.dbGet('questions',q.apiBatchReview.run.items[0].questionId)).question.endsWith('Later edit.');}),'Stale checkpoints preserve later edits and require an explicit fresh retry');
 // Persisted usage suspension survives a reload; current settings are used on Resume.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',2);r.config.aiData=true;window.__quota='aiData';await window.__apiQA.apiBatchExecute(r,r.items);});
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__apiQA?.state.questions.length);await evaluate(()=>window.__apiQA.apiBatchReviewReady);await page.evaluate(installFixtures);
 check(await evaluate(()=>window.__apiQA.apiBatchReview.run.status==='suspended'&&window.__apiQA.apiBatchReview.run.items[0].checkpoint.completed.length===1&&!window.__apiQA.apiBatchReview.running),'Reload recovers operation checkpoints and usage suspension without issuing requests');
 await evaluate(()=>{const q=window.__apiQA;q.state.settings.aiProvider='gemini';q.state.settings.geminiModel='fixture-resumed-model';q.state.keyProfiles=[{id:'resumed-key-profile',key:'not-a-real-key'}];q.state.activeKeyID='resumed-key-profile';q.showBatchSolutions({fresh:true,tab:'api'});});
 await action('api-batch-resume-work').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running&&!window.__apiQA.apiBatchReview.busy);
 check(await evaluate(()=>window.__calls.length===3&&window.__calls.every(c=>c.options.config.provider==='gemini'&&c.options.config.model==='fixture-resumed-model'&&c.options.config.profileID==='resumed-key-profile')&&!window.__apiQA.apiBatchReview.run.accessBlock),'Resume after API access is updated uses the current provider route and completes remaining work');
 await evaluate(()=>{window.__apiQA.state.settings.aiProvider='local';});
 check(await evaluate(()=>['credit_balance_exhausted','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded','insufficient_quota'].every(providerCode=>window.__apiQA.apiBatchAccessIssue({providerCode,status:429})==='usage')&&window.__apiQA.apiBatchAccessIssue({status:429,message:'Requests per minute exceeded.'})===''),'Usage exhaustion is distinguished from temporary request-rate limits');
 check(await evaluate(()=>window.__apiQA.apiBatchAccessIssue({status:401})==='access'&&window.__apiQA.apiBatchAccessIssue({message:'Quota limit: GenerateRequestsPerDayPerProjectPerModel-FreeTier'})==='usage'),'Missing access and explicit daily quota errors preserve the task for later recovery');
 // A checkpoint write failure prevents the next provider call.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',1);r.config.aiData=true;window.__closeStorage=true;await window.__apiQA.apiBatchExecute(r,r.items);});
 check(await evaluate(()=>window.__calls.length===1&&window.__apiQA.apiBatchReview.run.status==='interrupted'&&window.__apiQA.apiBatchReview.error.includes('Drafts could not be saved')),'Failure to save a completed checkpoint stops before another provider request');
 await evaluate(()=>{window.__apiQA.apiBatchReview.database=null;});
 // Acceptance cannot overwrite a changed record; undo cannot overwrite later edits.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',2);await window.__apiQA.apiBatchExecute(r,r.items);const q=await window.__apiQA.dbGet('questions',r.items[0].questionId);q.question+=' Later edit.';await window.__apiQA.dbPut('questions',q);});
 await action('api-batch-decide').filter({hasText:'Accept'}).click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.busy);
 check(await evaluate(()=>window.__apiQA.apiBatchReview.run.items[0].status==='stale'),'Acceptance rejects stale proposals');
 await page.locator('[data-api-batch-jump]').selectOption('1');await action('api-batch-decide').filter({hasText:'Accept'}).click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.busy);
 await evaluate(async()=>{const q=window.__apiQA,i=q.apiBatchReview.run.items[1],saved=await q.dbGet('questions',i.questionId);saved.question+=' Later accepted edit.';await q.dbPut('questions',saved);});
 await action('api-batch-decide').filter({hasText:'Reject'}).click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.busy);
 check(await evaluate(async()=>{const q=window.__apiQA,i=q.apiBatchReview.run.items[1];return i.status==='accepted'&&(await q.dbGet('questions',i.questionId)).question.includes('Later accepted edit.');}),'Undo protects edits made after acceptance');
 // Reload retains proposals and decisions, with no provider restart.
 await evaluate(()=>window.__apiQA.apiBatchReviewPersist());await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__apiQA?.state.questions.length);await evaluate(()=>window.__apiQA.apiBatchReviewReady);
 check(await evaluate(()=>window.__apiQA.apiBatchReview.run.items[0].status==='stale'&&window.__apiQA.apiBatchReview.run.items[1].status==='accepted'&&!window.__apiQA.apiBatchReview.running),'Reload recovers decisions without automatically rerunning requests');
 await evaluate(()=>window.__apiQA.showBatchSolutions({fresh:true,tab:'api'}));check(await page.locator('[data-api-resume]').isVisible(),'Reopening setup exposes Resume API Review');
 await action('api-batch-stage').filter({hasText:'Resume API Review'}).click();await auditBatchLayout(page,'api-resumed-review');
 // An interrupted run recovers drafts but never silently resumes paid work.
 await evaluate(async()=>{const q=window.__apiQA,r=q.apiBatchReview.run;r.status='active';r.items[0].status='processing';await q.apiBatchReviewPersist();});
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__apiQA?.state.questions.length);await evaluate(()=>window.__apiQA.apiBatchReviewReady);
 check(await evaluate(()=>{const q=window.__apiQA;return q.apiBatchReview.run.status==='interrupted'&&q.apiBatchReview.run.items[0].status==='pending'&&!q.apiBatchReview.running;}),'Reloading an active run marks it interrupted and retains its completed proposal');
 await evaluate(()=>{document.documentElement.dataset.theme='dark';window.__apiQA.apiBatchShow('review');});await page.screenshot({path:path.join(output,'api-review-dark.png')});await auditBatchLayout(page,'api-dark-review');
 // A bank acceptance must finish before the session can be discarded.
 await page.evaluate(installFixtures);
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',1);await window.__apiQA.apiBatchExecute(r,r.items);window.__commitGate=new Promise(resolve=>window.__releaseCommit=resolve);});
 await action('api-batch-decide').filter({hasText:'Accept'}).click();await page.waitForFunction(()=>window.__apiQA.apiBatchReview.busy);
 check(await action('api-batch-restart').isDisabled(),'Start Over waits while an acceptance transaction is saving');
 await evaluate(()=>{window.__releaseCommit();window.__commitGate=null;});await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.busy);
 check(await action('api-batch-restart').isEnabled()&&await evaluate(()=>window.__apiQA.apiBatchReview.run.items[0].status==='accepted'),'Start Over becomes available after acceptance completes');
 // Start Over ends the ledger without undoing accepted changes or reviving old work.
 await page.evaluate(installFixtures);
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',3);await window.__apiQA.apiBatchExecute(r,r.items);await window.__apiQA.apiBatchResolve(r.items[0],'accept',false);window.__acceptedSaved=await window.__apiQA.dbGet('questions',r.items[0].questionId);window.__apiQA.apiBatchShow('review');});
 check(await action('api-batch-restart').isVisible(),'Start Over is visible beside Close in review');
 page.once('dialog',d=>d.dismiss());await action('api-batch-restart').click();
 check(await evaluate(()=>window.__apiQA.apiBatchReview.run.items[0].status==='accepted'&&!window.__apiQA.apiBatchReview.restarting),'Cancel Start Over retains proposals and the accepted decision');
 await action('api-batch-stage').filter({hasText:'Setup'}).click();
 check(await action('api-batch-restart').isVisible()&&await action('start-batch-solutions').isDisabled(),'Saved-task setup offers Start Over when Generate is disabled');
 page.once('dialog',d=>{check(d.message().includes('1 accepted question')&&d.message().includes('no longer be able to undo'),'Restart confirmation explains saved changes and loss of session undo');return d.accept();});await action('api-batch-restart').click();
 await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.run&&!window.__apiQA.apiBatchReview.restarting);
 check(await evaluate(async()=>{const q=window.__apiQA;return !await q.apiBatchReviewStorage('get')&&q.canonicalStableStringify(await q.dbGet('questions',window.__acceptedSaved.id))===q.canonicalStableStringify(window.__acceptedSaved);}), 'Restart clears recovery ledger and keeps accepted Question Bank fields exactly');
 check(await page.locator('#api-batch-delay').isVisible()&&!await action('api-batch-restart').count()&&!await page.locator('[data-api-resume]').count(),'Restart returns to clean setup with no stale task controls');
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__apiQA?.state.questions.length);await evaluate(()=>window.__apiQA.apiBatchReviewReady);await page.evaluate(installFixtures);
 check(await evaluate(()=>!window.__apiQA.apiBatchReview.run&&!window.__calls.length),'Reload after restart restores no deleted task and makes no requests');
 // Cancel a restart while a request is in flight, then confirm and wait for its final write.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',3);window.__holdKey='formatQuestionPresentation';void window.__apiQA.apiBatchExecute(r,r.items);});await page.waitForFunction(()=>window.__releaseHeld&&window.__apiQA.apiBatchReview.running);
 page.once('dialog',d=>d.dismiss());await action('api-batch-restart').click();
 check(await evaluate(()=>window.__apiQA.apiBatchReview.running&&!window.__apiQA.apiBatchReview.run.cancelRequested),'Cancelling active restart leaves the run operating normally');
 page.once('dialog',d=>d.accept());await action('api-batch-restart').click();await page.waitForFunction(()=>window.__apiQA.apiBatchReview.restarting);
 check(await action('api-batch-restart').isDisabled()&&await page.locator('[data-api-running-status]').innerText()==='Stopping before starting over…','Confirmed active restart displays a stopping state and blocks repeated restart');
 await evaluate(()=>window.__releaseHeld());await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.run&&!window.__apiQA.apiBatchReview.restarting);
 await page.waitForTimeout(350);
 check(await evaluate(async()=>{const q=window.__apiQA;return window.__calls.length===1&&!q.apiBatchReview.running&&!await q.apiBatchReviewStorage('get')&&(await Promise.all(window.__before.map(i=>q.dbGet('questions',i.id)))).every((record,n)=>!q.manualReviewFieldPatch(window.__before[n],record).length);}), 'Active restart stops subsequent requests, waits for final writes, and leaves no resurrected task or unaccepted bank changes');
 // Closing while restart is waiting must not reopen the dialog afterward.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',2);window.__releaseHeld=null;window.__holdKey='formatQuestionPresentation';void window.__apiQA.apiBatchExecute(r,r.items);});await page.waitForFunction(()=>window.__releaseHeld&&window.__apiQA.apiBatchReview.running);
 page.once('dialog',d=>d.accept());await action('api-batch-restart').click();await page.waitForFunction(()=>window.__apiQA.apiBatchReview.restarting);
 check(await page.locator('[data-api-batch-live-delay]').isDisabled(),'Restart locks checkpoint inputs while worker writes settle');
 await page.locator('.modal-header [data-action=close-modal]').click();await evaluate(()=>window.__releaseHeld());await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.run&&!window.__apiQA.apiBatchReview.restarting);
 check(!await page.locator('.api-batch-modal').count(),'Closing during restart stays closed after task cleanup');
 await evaluate(()=>window.__apiQA.showBatchSolutions({fresh:true,tab:'api'}));
 // A new run can be generated using the real start control after restart.
 await evaluate(()=>window.__apiQA.showBatchSolutions({fresh:true,tab:'api'}));await page.locator('#batch-format-question-presentation').check();await page.locator('#api-batch-delay').fill('0');await action('start-batch-solutions').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.running&&window.__apiQA.apiBatchReview.run?.status==='completed');
 check(await evaluate(()=>window.__apiQA.apiBatchReview.run.items.length===2&&window.__calls.length===3),'Generate starts a fresh full batch after restart');
 // Restart remains available during a retry, even though the retry handler is busy.
 await evaluate(()=>{window.__releaseHeld=null;window.__holdKey='formatQuestionPresentation';});await action('api-batch-retry-one').click();await page.waitForFunction(()=>window.__releaseHeld&&window.__apiQA.apiBatchReview.running&&window.__apiQA.apiBatchReview.busy);
 check(await action('api-batch-restart').isEnabled(),'Start Over remains available during an active retry');
 page.once('dialog',d=>d.accept());await action('api-batch-restart').click();await evaluate(()=>window.__releaseHeld());await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.run&&!window.__apiQA.apiBatchReview.busy&&!window.__apiQA.apiBatchReview.restarting);
 check(await page.locator('#api-batch-delay').isVisible(),'Restart during retry returns to usable setup after the old handler settles');
 // Paused, quota-suspended, and Save & Exit tasks all support the same fresh start.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',2);window.__fail='formatQuestionPresentation';window.__rate=true;void window.__apiQA.apiBatchExecute(r,r.items);});await page.waitForFunction(()=>window.__apiQA.apiBatchReview.run.rateUntil>Date.now());await action('api-batch-pause').click();
 page.once('dialog',d=>d.accept());await action('api-batch-restart').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.run&&!window.__apiQA.apiBatchReview.restarting);
 check(await evaluate(()=>window.__calls.length===1&&!window.__apiQA.apiBatchReview.running),'Restart exits a rate-limit pause without sending another request');await evaluate(()=>window.__rate=false);
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',2);r.config.aiData=true;window.__quota='aiData';await window.__apiQA.apiBatchExecute(r,r.items);await window.__apiQA.apiBatchResolve(r.items[0],'accept',false);window.__acceptedSaved=await window.__apiQA.dbGet('questions',r.items[0].questionId);window.__apiQA.apiBatchShow('review');});
 check(await action('api-batch-restart').isVisible(),'Usage-suspended task exposes Start Over');page.once('dialog',d=>d.accept());await action('api-batch-restart').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.run&&!window.__apiQA.apiBatchReview.restarting);
 check(await evaluate(async()=>{const q=window.__apiQA;return q.canonicalStableStringify(await q.dbGet('questions',window.__acceptedSaved.id))===q.canonicalStableStringify(window.__acceptedSaved)&&!await q.apiBatchReviewStorage('get');}),'Restart discards suspended checkpoints while retaining accepted partial changes');
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',1);await window.__apiQA.apiBatchExecute(r,r.items);await window.__apiQA.apiBatchSaveExit();window.__apiQA.showBatchSolutions({fresh:true,tab:'api'});});page.once('dialog',d=>d.accept());await action('api-batch-restart').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.run&&!window.__apiQA.apiBatchReview.restarting);
 check(await page.locator('#api-batch-delay').isVisible(),'Reopened Save & Exit task can start over directly');
 // Ledger deletion failure must not pretend the task has been cleared.
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',1);await window.__apiQA.apiBatchExecute(r,r.items);window.__apiQA.apiBatchReview.database.close();});page.once('dialog',d=>d.accept());await action('api-batch-restart').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.restarting&&window.__apiQA.apiBatchReview.error.includes('Could not clear'));
 check(await evaluate(()=>Boolean(window.__apiQA.apiBatchReview.run?.items[0].proposed))&&await page.locator('[role=alert]').isVisible(),'Failed restart deletion keeps the proposal and reports the failure');
 await evaluate(()=>window.__apiQA.apiBatchReview.database=null);page.once('dialog',d=>d.accept());await action('api-batch-restart').click();await page.waitForFunction(()=>!window.__apiQA.apiBatchReview.run&&!window.__apiQA.apiBatchReview.restarting);
 check(await evaluate(async()=>!await window.__apiQA.apiBatchReviewStorage('get')),'Restart can be retried after recovery storage is restored');
 await evaluate(async()=>{const r=await window.__setup('formatQuestionPresentation',2);await window.__apiQA.apiBatchExecute(r,r.items);document.documentElement.dataset.theme='dark';window.__apiQA.apiBatchShow('review');});await auditBatchLayout(page,'api-compact-review');await page.screenshot({path:path.join(output,'api-compact-review.png')});
 await action('api-batch-stage').filter({hasText:'Activity'}).click();await auditBatchLayout(page,'api-compact-activity');await page.screenshot({path:path.join(output,'api-compact-activity.png')});
 await action('api-batch-stage').filter({hasText:'Setup'}).click();await auditBatchLayout(page,'api-compact-saved-setup');
 await action('api-batch-stage').filter({hasText:'Resume API Review'}).click();
 check(await page.evaluate(()=>{const nav=document.querySelector('.api-batch-review-navigation'),pair=nav.querySelector('.batch-workspace-navigation-pair');return nav.contains(document.querySelector('[data-api-batch-jump]'))&&pair.children[0].getBoundingClientRect().top===pair.children[1].getBoundingClientRect().top;}),'Compact review combines jump control with adjacent Previous/Next navigation');
 // Failed recovery storage cannot start provider work or modify saved content.
 await evaluate(async()=>{const q=window.__apiQA,r=q.apiBatchReview.run;window.__calls=[];q.apiBatchReview.database.close();await q.apiBatchExecute(r,r.items);});
 check(await evaluate(()=>window.__calls.length===0&&window.__apiQA.apiBatchReview.run.status==='interrupted'&&window.__apiQA.apiBatchReview.error.includes('Drafts could not be saved')),'Storage failure stops generation before the first provider request');
 check(!errors.length,'No uncaught browser errors: '+errors.join('; '));check(!requests.length,'No live provider calls made during QA');finishBatchLayoutAudit();
}catch(error){if(page){await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'failure.txt'),await page.locator('body').innerText().catch(()=>''));}checks.push({message:error.stack,passed:false});throw error;}
finally{fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:checks.every(c=>c.passed),checks,errors,requests},null,2));await browser.close();console.log(`API review: ${checks.filter(c=>c.passed).length}/${checks.length} checks; ${output}`);}
