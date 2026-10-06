import {openBankMore,revealBankFilter} from './qa-bank-filter-helpers.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=process.env.SOLUTION_QA_OUTPUT||path.join(os.tmpdir(),'fe-solution-indicator-qa');
fs.mkdirSync(output,{recursive:true});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const anchor='  state.activityRecords = function() {';
if(!html.includes(anchor))throw new Error('Missing isolated QA hook anchor');
const hooked=html.replace(anchor,`  setTimeout(()=>window.__solutionQA={state,dbPut,dbGet,renderApp,solutionIndicatorState,solutionVerificationState,aiQuestionPackageFingerprint,aiLocalComparisonFingerprint,canonicalSavedAIProblemContext,markSolutionStaleForCanonicalContextChange,canonicalContextFingerprint,reviewSolutionApplicability,filteredQuestions,questionBankSolutionPrompt,manualBatchSolutionSharedContract,consolidatedManualBatchSolutionSharedContract},0);\n${anchor}`);
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let assertions=0;const checks=[];
const check=(ok,message)=>{assertions++;checks.push({message,passed:!!ok});if(!ok)throw new Error(`Assertion ${assertions}: ${message}`);};
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://fe-solution-qa.local/',r=>r.fulfill({contentType:'text/html',body:hooked}));
 await page.goto('http://fe-solution-qa.local/');
 await page.waitForFunction(()=>window.__solutionQA?.state.questions.length>0);
 const cases=await page.evaluate(async()=>{
  const a=window.__solutionQA,seed=structuredClone(a.state.questions[0]);
  const make=(id,finalAnswer='',extra={})=>({...structuredClone(seed),id,topic:'Mathematics and Statistics',subtopic:'Statistics',question:'Find the computed value.',choices:['8.34','10.00','12.00','14.00'],answerIndex:0,answerLetter:'A',solution:'The calculation gives the required value.',equations:[],hint:'',updatedAt:'2026-09-29T12:00:00.000Z',additionalMetadata:finalAnswer?{solutionGeneration:{finalAnswer}}:{},...extra});
  const current=q=>{const g=q.additionalMetadata.solutionGeneration||{};q.additionalMetadata.solutionGeneration={...g,questionRevision:q.updatedAt,packageFingerprint:a.aiQuestionPackageFingerprint(q,a.canonicalSavedAIProblemContext(q),'solution')};q.additionalMetadata.solutionGeneration.localComparisonFingerprint=a.aiLocalComparisonFingerprint(q,q.additionalMetadata.solutionGeneration.packageFingerprint);return q;};
  const fixtures=[
   make('S-IMPORTED'),make('S-ROUND','8.336'),make('S-EXACT','8.34'),make('S-FALSE-RED','8.336',{question:'Calculate the value (no approximation keyword).'}),
   make('S-OUTSIDE','8.346'),make('S-MISMATCH','12.00'),make('S-SIGN','-8.336',{choices:['8.34','-8.34','12.00','14.00']}),
   make('S-UNITS','8.336 ft',{choices:['8.34 ft','10.00 ft','12.00 ft','14.00 ft']}),make('S-UNKNOWN-UNITS','8.336 furlongs'),
   make('S-AMBIGUOUS','8.336',{choices:['8.34','8.34','12.00','14.00']}),make('S-INTEGER','8.3',{choices:['8','10','12','14']}),
   make('S-INTEGER-APPROX','8.3',{question:'What is most nearly the value?',choices:['8','10','12','14']}),
   make('S-NO-KEY','8.336',{answerIndex:-1,answerLetter:''}),make('S-MISSING','',{solution:''}),
   make('S-COSMETIC','',{solution:'The cost is $100. The area is 8 m². A readable imported derivation.'}),
   make('S-FORMAT','',{solution:'Use \\(x = 8.34 to compute the answer.'}),
   make('S-FAILED','8.336',{additionalMetadata:{solutionGeneration:{finalAnswer:'8.336'},solutionRequest:{operationStatus:'failed',errorMessage:'Invalid replacement JSON'}}}),
   current(make('S-HISTORICAL','8.336',{additionalMetadata:{solutionGeneration:{finalAnswer:'8.336'},solutionRequest:{operationStatus:'historical'}}})),
   current(make('S-STALE','8.336')),current(make('S-STALE-MISMATCH','12.00')),
   current(make('S-STRUCTURED','',{additionalMetadata:{solutionGeneration:{structuredChoiceMapping:{operationStatus:'completed',structuredFieldState:'present',choiceStatus:'matched_choice',selectedChoiceIndex:2,selectedChoiceLetter:'C',selectedChoiceText:'12.00'},localComparison:{structuredMapping:true,outcome:'not_compared',selectedChoiceIndex:2,selectedChoiceText:'12.00'}}}})),
   current(make('S-MAPPING-CONFLICT','8.336',{additionalMetadata:{solutionGeneration:{finalAnswer:'8.336',structuredChoiceMapping:{operationStatus:'completed',structuredFieldState:'present',choiceStatus:'matched_choice',selectedChoiceIndex:2,selectedChoiceLetter:'C',selectedChoiceText:'12.00'}}}}))
  ];
  fixtures.find(q=>q.id==='S-STALE').question+=' Readable wording added.';
  fixtures.find(q=>q.id==='S-STALE-MISMATCH').question+=' Readable wording added.';
  for(const q of fixtures)await a.dbPut('questions',q);
  a.state.questions=fixtures;a.state.section='bank';a.state.focusedQuestionID='S-STALE';a.renderApp();
  window.__fixtureMake=make;window.__fixtureCurrent=current;
  return fixtures.map(q=>({id:q.id,indicator:a.solutionIndicatorState(q),gate:a.solutionVerificationState(q).gate}));
 });
 const expected={ 'S-IMPORTED':'present','S-ROUND':'present','S-EXACT':'present','S-FALSE-RED':'present','S-OUTSIDE':'review','S-MISMATCH':'critical','S-SIGN':'critical','S-UNITS':'present','S-UNKNOWN-UNITS':'review','S-AMBIGUOUS':'review','S-INTEGER':'review','S-INTEGER-APPROX':'present','S-NO-KEY':'review','S-MISSING':'missing','S-COSMETIC':'present','S-FORMAT':'review','S-FAILED':'present','S-HISTORICAL':'present','S-STALE':'review','S-STALE-MISMATCH':'critical','S-STRUCTURED':'critical','S-MAPPING-CONFLICT':'review'};
 for(const c of cases)check(c.indicator.state===expected[c.id],`${c.id}: ${expected[c.id]} (${c.indicator.reason})`);
 check(cases.find(c=>c.id==='S-IMPORTED').gate==='stale','Imported green indicator does not weaken strict currentness gate');
 check(cases.find(c=>c.id==='S-FAILED').gate==='failure','Failed replacement keeps strict import failure gate');
 check(cases.find(c=>c.id==='S-ROUND').indicator.comparison.method==='displayed_choice_precision','8.336 vs 8.34 uses bounded displayed decimal precision');
 const benchmark=await page.evaluate(()=>{const a=window.__solutionQA,original=a.state.questions,seed=structuredClone(original.find(q=>q.id==='S-ROUND'));try{a.state.questions=Array.from({length:337},(_,i)=>({...structuredClone(seed),id:`BENCH-${i}`}));const t=performance.now(),rows=a.filteredQuestions({...a.state.bank,reviewStatus:'Solution Present (Green)'});return {questions:337,matches:rows.length,elapsedMs:performance.now()-t};}finally{a.state.questions=original;}});
 check(benchmark.matches===337,'Color filtering classifies all 337 questions in a full-sized bank');
 // Real UI filter changes, counts, and visible dot states use the same definition.
 await page.locator('.sidebar-nav [data-section="bank"]').click();
 for(const [label,state] of [['Solution Present (Green)','present'],['Review Recommended (Yellow)','review'],['Critical Issue (Red)','critical'],['Missing Solution','missing']]){
  await revealBankFilter(page,'#bank-solution');
  await page.locator('#bank-solution').selectOption(label);
  const dots=await page.locator('.bank-table tbody [data-solution-indicator]').evaluateAll(n=>n.map(x=>x.dataset.solutionIndicator));
  check(dots.length===Object.values(expected).filter(x=>x===state).length,`${label}: exact result count`);
  check(dots.every(x=>x===state),`${label}: every displayed dot matches filter`);
 }
 await revealBankFilter(page,'#bank-solution');await page.locator('#bank-solution').selectOption('All Solution Statuses');await page.keyboard.press('Escape');await page.waitForTimeout(230);
 await page.locator('[data-action="sort-bank-column"][data-sort-key="solution"]').click();
 const sorted=await page.locator('.bank-table tbody [data-solution-indicator]').evaluateAll(n=>n.map(x=>x.dataset.solutionIndicator));
 const rank={critical:0,review:1,missing:2,present:3};
 check(sorted.every((x,i)=>!i||rank[sorted[i-1]]<=rank[x]),'Solution header sorts red, yellow, gray, green');
 await page.locator('[data-action="sort-bank-column"][data-sort-key="solution"]').click();
 const reversed=await page.locator('.bank-table tbody [data-solution-indicator]').evaluateAll(n=>n.map(x=>x.dataset.solutionIndicator));
 check(reversed.every((x,i)=>!i||rank[reversed[i-1]]>=rank[x]),'Solution header reverses status order');
 const priority=await page.evaluate(()=>{const a=window.__solutionQA;a.state.bank.sort='Review Priority';return a.filteredQuestions().map(q=>a.solutionIndicatorState(q).state);});
 check(priority.every((x,i)=>!i||rank[priority[i-1]]<=rank[x]),'Review Priority uses same status ordering');
 // Review through the displayed button; verify persistence, undo and expiration.
 await page.locator('.bank-table tbody tr[data-id="S-STALE"]').click();
 await page.locator('[data-action="review-solution-applicability"]').click();
 await page.locator('[data-action="undo-solution-applicability-review"]').waitFor();
 const reviewed=await page.evaluate(async()=>{const a=window.__solutionQA,q=a.state.questions.find(q=>q.id==='S-STALE'),stored=await a.dbGet('questions',q.id);return {indicator:a.solutionIndicatorState(stored),gate:a.solutionVerificationState(stored).gate,key:stored.answerIndex,solution:stored.solution};});
 check(reviewed.indicator.state==='present'&&reviewed.indicator.reviewed,`Review makes changed-question indicator green and saves to database: ${JSON.stringify(reviewed)}`);
 check(reviewed.gate==='stale'&&reviewed.key===0&&reviewed.solution==='The calculation gives the required value.','Review leaves import gate, answer key and solution unchanged');
 await page.reload();await page.waitForFunction(()=>window.__solutionQA?.state.questions.some(q=>q.id==='S-STALE'));
 const persisted=await page.evaluate(()=>window.__solutionQA.solutionIndicatorState(window.__solutionQA.state.questions.find(q=>q.id==='S-STALE')));
 check(persisted.reviewed===true,'Reviewed state survives app reload');
 await page.locator('.sidebar-nav [data-section="bank"]').click();await page.locator('.bank-table tbody tr[data-id="S-STALE"]').click();
 await page.locator('[data-action="undo-solution-applicability-review"]').click();
 await page.locator('[data-action="review-solution-applicability"]').waitFor();
 check(await page.locator('[data-action="review-solution-applicability"]').isVisible(),'Undo review restores warning and review button');
 const expired=await page.evaluate(async()=>{
  const a=window.__solutionQA,base=a.state.questions.find(q=>q.id==='S-STALE');await a.reviewSolutionApplicability(base.id);
  const variants=[['wording',q=>q.question+=' Another edit'],['choices',q=>q.choices[1]='10.01'],['key',q=>{q.answerIndex=1;q.answerLetter='B';}],['solution',q=>q.solution+=' Additional calculation.'],['equations',q=>q.equations=['x=8.34']],['final answer',q=>q.additionalMetadata.solutionGeneration.finalAnswer='10.00']];
  return variants.map(([name,edit])=>{const q=structuredClone(base);edit(q);const status=a.solutionIndicatorState(q);return {name,reviewed:!!status.reviewed,state:status.state};});
 });
 for(const v of expired)check(!v.reviewed,`Applicability confirmation expires after ${v.name} changes`);
 const administrative=await page.evaluate(()=>{const a=window.__solutionQA,q=structuredClone(a.state.questions.find(q=>q.id==='S-STALE'));q.isFlagged=!q.isFlagged;q.updatedAt='2026-09-29T15:00:00.000Z';return a.solutionIndicatorState(q);});
 check(administrative.reviewed,'Changing a flag or administrative timestamp preserves applicability confirmation');
 const unchangedContent=await page.evaluate(()=>{const a=window.__solutionQA,q=structuredClone(a.state.questions.find(q=>q.id==='S-ROUND'));const pkg=a.aiQuestionPackageFingerprint(q,a.canonicalSavedAIProblemContext(q),'solution');q.additionalMetadata.solutionGeneration={...q.additionalMetadata.solutionGeneration,questionRevision:q.updatedAt,contextStatus:'current',packageFingerprint:pkg,localComparisonFingerprint:a.aiLocalComparisonFingerprint(q,pkg)};q.updatedAt='2026-09-29T15:00:00.000Z';q.isFlagged=!q.isFlagged;return {indicator:a.solutionIndicatorState(q),gate:a.solutionVerificationState(q).gate};});
 check(unchangedContent.indicator.state==='present'&&unchangedContent.gate==='stale','Administrative revision does not trigger a display warning; strict revision gate remains conservative');
 await page.evaluate(async()=>{const a=window.__solutionQA,q=structuredClone(a.state.questions.find(q=>q.id==='S-STALE'));q.id='S-SECOND-WARNING';q.additionalMetadata.solutionGeneration.finalAnswer='8.336 furlongs';q.additionalMetadata.solutionGeneration.contextStatus='stale';delete q.additionalMetadata.solutionApplicabilityReview;await a.dbPut('questions',q);a.state.questions.push(q);a.renderApp();});
 await page.locator('.bank-table tbody tr[data-id="S-SECOND-WARNING"]').click();
 await page.locator('[data-action="review-solution-applicability"]').click();
 await page.locator('[data-action="undo-solution-applicability-review"]').waitFor();
 const otherWarning=await page.evaluate(()=>{const a=window.__solutionQA;return a.solutionIndicatorState(a.state.questions.find(q=>q.id==='S-SECOND-WARNING'));});
 check(otherWarning.state==='review'&&otherWarning.reviewed,'Confirming changed-question applicability preserves another comparison warning');
 check(await page.locator('[data-action="review-solution-applicability"]').count()===0,'Confirmed change warning does not offer repeated confirmation');
 await page.locator('[data-action="undo-solution-applicability-review"]').click();await page.locator('[data-action="review-solution-applicability"]').waitFor();
 check(await page.locator('[data-action="review-solution-applicability"]').isVisible(),'Review can be undone while another warning remains');
 const prompts=await page.evaluate(()=>{const a=window.__solutionQA,q=a.state.questions[0];return [a.questionBankSolutionPrompt(q,undefined,null,'current'),a.questionBankSolutionPrompt(q,undefined,null,'consolidated'),a.manualBatchSolutionSharedContract(),a.consolidatedManualBatchSolutionSharedContract()].map(t=>({rounding:t.includes('8.336 matches 8.34'),independence:/independent|independently/.test(t),ambiguity:t.includes('ambiguous_choice')}));});
 for(const [i,p]of prompts.entries())check(p.rounding&&p.independence&&p.ambiguity,`Solution prompt ${i+1}: explicit rounding with independence and ambiguity preserved`);
 // Sidebar containment and labels under desktop, collapse, drawer and mobile.
 for(const width of [1440,1024,768,375]){
  await page.setViewportSize({width,height:900});
  if(width<=780)await page.locator('.mobile-bar [data-action="toggle-mobile-sidebar"]').click();
  const geometry=await page.locator('.sidebar > .global-ai-shortcuts').evaluate(e=>{const r=e.getBoundingClientRect(),buttons=[...e.querySelectorAll('.ai-bookmark')];return {contained:buttons.every(b=>{const x=b.getBoundingClientRect();return x.left>=r.left&&x.right<=r.right+.5&&b.scrollWidth<=b.clientWidth+1;}),labels:buttons.map(b=>b.getAttribute('aria-label'))};});
  check(geometry.contained,`${width}px: sidebar provider buttons fit their container`);
  check(geometry.labels.every(x=>/Open (Gemini|ChatGPT) in a new tab/.test(x)),`${width}px: provider names remain accessible`);
  await page.screenshot({path:path.join(output,`sidebar-${width}.png`)});
  if(width<=780)await page.locator('.sidebar-mobile-close').click();
 }
 await page.setViewportSize({width:1440,height:900});
 await page.locator('[data-action="toggle-sidebar-collapse"]').click();
 check(await page.locator('.app-shell').evaluate(e=>e.classList.contains('sidebar-collapsed')),'Desktop sidebar still collapses');
 const collapsed=await page.locator('.sidebar > .global-ai-shortcuts .ai-bookmark').evaluateAll(bs=>bs.every(b=>b.getBoundingClientRect().width<=49&&b.scrollWidth<=b.clientWidth+1));
 check(collapsed,'Collapsed rail provider icons fit');
 await page.locator('[data-action="toggle-sidebar-collapse"]').click();
 check(!await page.locator('.app-shell').evaluate(e=>e.classList.contains('sidebar-collapsed')),'Desktop sidebar expands again');
 check(errors.length===0,`No browser runtime errors: ${errors.join('; ')}`);
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:true,assertions,checks,cases,benchmark,errors},null,2));
 console.log(`PASS: ${assertions} solution indicator, rounding, filter, sorting, review and sidebar checks. 337-question filter: ${Math.round(benchmark.elapsedMs)} ms. Evidence: ${output}`);
}catch(error){fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:false,assertions,checks,errors,error:error.stack},null,2));throw error;}
finally{await browser.close();}
