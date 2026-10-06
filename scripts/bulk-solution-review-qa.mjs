import {openBankMore,revealBankFilter} from './qa-bank-filter-helpers.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=process.env.BULK_SOLUTION_QA_OUTPUT||path.join(os.tmpdir(),'fe-bulk-solution-review-qa');
fs.mkdirSync(output,{recursive:true});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const anchor='  state.activityRecords = function() {';
if(!html.includes(anchor))throw new Error('Missing isolated QA hook anchor');
const hooked=html.replace(anchor,`  setTimeout(()=>window.__bulkSolutionQA={state,dbPut,dbGet,renderApp,solutionIndicatorState,solutionVerificationState,aiQuestionPackageFingerprint,aiLocalComparisonFingerprint,canonicalSavedAIProblemContext,markSolutionStaleForCanonicalContextChange,canonicalContextFingerprint,reviewSolutionApplicability,filteredQuestions,questionBankSolutionPrompt,manualBatchSolutionSharedContract,consolidatedManualBatchSolutionSharedContract,reviewSelectedSolutionsAsGood,selectedSolutionApprovalState,solutionQualityReviewIdentity,solutionQualityReviewIsActive},0);\n${anchor}`);
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let assertions=0;const checks=[];
const check=(ok,message)=>{assertions++;checks.push({message,passed:!!ok});if(!ok)throw new Error(`Assertion ${assertions}: ${message}`);};
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},colorScheme:'dark',reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://fe-bulk-solution-qa.local/',r=>r.fulfill({contentType:'text/html',body:hooked}));
 await page.goto('http://fe-bulk-solution-qa.local/');
 await page.waitForFunction(()=>window.__bulkSolutionQA?.state.questions.length>0);
 const cases=await page.evaluate(async()=>{
  const a=window.__bulkSolutionQA,seed=structuredClone(a.state.questions[0]);
  const make=(id,finalAnswer='',extra={})=>({...structuredClone(seed),id,topic:'Mathematics and Statistics',subtopic:'Statistics',question:'Find the computed value.',choices:['8.34','10.00','12.00','14.00'],answerIndex:0,answerLetter:'A',solution:'The calculation gives the required value.',equations:[],hint:'',updatedAt:'2026-09-29T12:00:00.000Z',additionalMetadata:finalAnswer?{solutionGeneration:{finalAnswer}}:{},...extra});
  const current=q=>{const g=q.additionalMetadata.solutionGeneration||{};q.additionalMetadata.solutionGeneration={...g,questionRevision:q.updatedAt,packageFingerprint:a.aiQuestionPackageFingerprint(q,a.canonicalSavedAIProblemContext(q),'solution')};q.additionalMetadata.solutionGeneration.localComparisonFingerprint=a.aiLocalComparisonFingerprint(q,q.additionalMetadata.solutionGeneration.packageFingerprint);return q;};
  const fixtures=[
   make('S-IMPORTED'),make('S-ROUND','8.336'),make('S-EXACT','8.34'),make('S-FALSE-RED','8.336',{question:'Calculate the value (no approximation keyword).'}),
   make('S-OUTSIDE','8.346'),make('S-MISMATCH','12.00'),make('S-SIGN','-8.336',{choices:['8.34','-8.34','12.00','14.00']}),
   make('S-UNITS','8.336 ft',{choices:['8.34 ft','10.00 ft','12.00 ft','14.00 ft']}),make('S-UNKNOWN-UNITS','8.336 furlongs'),
   make('S-AMBIGUOUS','8.336',{choices:['8.34','8.34','12.00','14.00']}),make('S-INTEGER','8.3',{choices:['8','10','12','14']}),
   make('S-INTEGER-APPROX','8.3',{question:'What is most nearly the value?',choices:['8','10','12','14']}),
   make('S-NO-KEY','8.336',{answerIndex:null,answerLetter:null,answerKeyStatus:'not_found'}),make('S-MISSING','',{solution:''}),
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

 const menu=page.locator('.bank-selection-menu'),approve=page.locator('[data-action="approve-selected-solutions"]'),undo=page.locator('[data-action="undo-selected-solution-approvals"]');
 const openSelection=async()=>{if(!await menu.evaluate(e=>e.open))await menu.locator('summary').click();};
 const approveSelection=async()=>{await openSelection();await approve.click();await page.waitForFunction(()=>!document.querySelector('[data-action="approve-selected-solutions"]').disabled);};
 await openSelection();
 check(await approve.isDisabled()&&await undo.isDisabled(),'Zero selected disables approve and undo');
 await page.locator('[data-action="select-every-bank-question"]').click();
 check((await menu.locator('summary').innerText()).includes('22 selected'),'Select all shows actual selected count');
 await page.screenshot({path:path.join(output,'bulk-selection-menu.png')});
 const before=await page.evaluate(()=>{const a=window.__bulkSolutionQA;return a.state.questions.map(q=>({id:q.id,gate:a.solutionVerificationState(q).gate,content:JSON.stringify({question:q.question,choices:q.choices,key:q.answerIndex,letter:q.answerLetter,solution:q.solution,hint:q.hint,equations:q.equations,generation:q.additionalMetadata.solutionGeneration})}));});
 await approveSelection();
 const after=await page.evaluate(async()=>{const a=window.__bulkSolutionQA;return Promise.all(a.state.questions.map(async q=>{const saved=await a.dbGet('questions',q.id);return {id:q.id,status:a.solutionIndicatorState(saved),active:a.solutionQualityReviewIsActive(saved),gate:a.solutionVerificationState(saved).gate,content:JSON.stringify({question:saved.question,choices:saved.choices,key:saved.answerIndex,letter:saved.answerLetter,solution:saved.solution,hint:saved.hint,equations:saved.equations,generation:saved.additionalMetadata.solutionGeneration})};}));});
 for(const q of after){
  const original=before.find(x=>x.id===q.id),originalColor=expected[q.id];
  check(q.status.state===(originalColor==='critical'||originalColor==='missing'?originalColor:'present'),`${q.id}: correct bulk approval color`);
  check(q.active===(originalColor!=='critical'&&originalColor!=='missing'),`${q.id}: approval only on eligible saved solutions`);
  check(original.gate===q.gate&&original.content===q.content,`${q.id}: content and strict generation gate unchanged`);
 }
 check((await menu.locator('summary').innerText()).includes('22 selected'),'Approval retains selection');
 check((await page.locator('.toast-stack').innerText()).includes('kept red'),'Completion message explains skipped red disagreements');
 await page.reload();await page.waitForFunction(()=>window.__bulkSolutionQA?.state.questions.some(q=>q.id==='S-STALE'));
 await page.locator('.sidebar-nav [data-section="bank"]').click();
 const persisted=await page.evaluate(()=>{const a=window.__bulkSolutionQA;return a.state.questions.filter(q=>q.id.startsWith('S-')).map(q=>({id:q.id,active:a.solutionQualityReviewIsActive(q),stored:q.additionalMetadata?.solutionQualityReview,current:a.solutionQualityReviewIdentity(q),solution:q.solution}));});
 for(const q of persisted)check(q.active===(expected[q.id]!=='critical'&&expected[q.id]!=='missing'),`${q.id}: approval survives reload`);
 await page.locator('.bank-table tbody tr[data-id="S-STALE"]').click();
 check(await page.locator('[data-action="undo-solution-quality-review"]').isVisible(),'Individual question offers Undo review for bulk approval');
 await page.locator('[data-action="undo-solution-quality-review"]').click();
 await page.waitForFunction(()=>!window.__bulkSolutionQA.solutionQualityReviewIsActive(window.__bulkSolutionQA.state.questions.find(q=>q.id==='S-STALE')));
 check(await page.locator('[data-action="review-solution-applicability"]').isVisible(),'Individual undo restores changed-question warning');
 const expiration=await page.evaluate(()=>{
  const a=window.__bulkSolutionQA,base=a.state.questions.find(q=>q.id==='S-ROUND');
  const variants=[['wording',q=>q.question+=' Clearer wording'],['choices',q=>q.choices[1]='10.01'],['key',q=>{q.answerIndex=1;q.answerLetter='B';}],['solution',q=>q.solution+=' An extra step.'],['hint',q=>q.hint='New hint'],['equations',q=>q.equations=['x=8.34']],['final answer',q=>q.additionalMetadata.solutionGeneration.finalAnswer='8.335'],['structured mapping',q=>q.additionalMetadata.solutionGeneration.structuredChoiceMapping={choiceStatus:'ambiguous_choice'}],['saved package',q=>q.additionalMetadata.solutionGeneration.packageFingerprint='new-package'],['context status',q=>q.additionalMetadata.solutionGeneration.contextStatus='stale'],['problem context',q=>q.diagramTextAlternative='New geometry and dimensions']];
  return variants.map(([name,edit])=>{const q=structuredClone(base);edit(q);return {name,active:a.solutionQualityReviewIsActive(q)};});
 });
 for(const v of expiration)check(!v.active,`Approval expires after ${v.name} change`);
 const admin=await page.evaluate(()=>{const a=window.__bulkSolutionQA,q=structuredClone(a.state.questions.find(q=>q.id==='S-ROUND'));q.isFlagged=!q.isFlagged;q.updatedAt='2026-09-30T12:00:00.000Z';q.topic='Statics';return a.solutionQualityReviewIsActive(q);});
 check(admin,'Flag, timestamp and classification edits retain approval');
 const redAfterApproval=await page.evaluate(()=>{const a=window.__bulkSolutionQA,q=structuredClone(a.state.questions.find(q=>q.id==='S-ROUND'));q.additionalMetadata.solutionGeneration.finalAnswer='12.00';return a.solutionIndicatorState(q).state;});
 check(redAfterApproval==='critical','A new confirmed disagreement stays red even with an old approval marker');
 await openSelection();await page.locator('[data-action="select-every-bank-question"]').click();await undo.click();
 await page.waitForFunction(()=>!window.__bulkSolutionQA.state.questions.some(q=>q.additionalMetadata?.solutionQualityReview));
 const reverted=await page.evaluate(()=>{const a=window.__bulkSolutionQA;return a.state.questions.filter(q=>q.id.startsWith('S-')).map(q=>({id:q.id,status:a.solutionIndicatorState(q).state}));});
 for(const q of reverted)check(q.status===expected[q.id],`${q.id}: bulk undo restores original classification`);
 await page.locator('[data-action="clear-bank-selected"]').click();
 await revealBankFilter(page,'#bank-solution');await page.locator('#bank-solution').selectOption('Review Recommended (Yellow)');
 await openSelection();await page.locator('[data-action="select-all-bank"]').click();
 const yellowCount=Object.values(expected).filter(x=>x==='review').length;
 check((await menu.locator('summary').innerText()).includes(`${yellowCount} selected`),'Select matching selects just yellow results');
 await approveSelection();
 check(await page.locator('.bank-table tbody [data-solution-indicator]').count()===0,'Approved rows leave yellow filter immediately');
 check((await menu.locator('summary').innerText()).includes(`${yellowCount} selected`),'Selection remains after approved rows leave filter');
 await openSelection();check(await undo.isEnabled(),'Undo remains available when rows are filtered out');await undo.click();
 await page.waitForFunction(()=>document.querySelectorAll('.bank-table tbody [data-solution-indicator]').length>0);
 check(await page.locator('.bank-table tbody [data-solution-indicator]').count()===yellowCount,'Undo restores exact yellow filtered results');
 await page.locator('.bank-toolbar-clear-btn').click();await openSelection();
 check((await menu.locator('summary').innerText()).includes(`${yellowCount} selected`),'Clear filters retains the selected yellow questions');
 await page.locator('[data-action="clear-bank-selected"]').click();await openSelection();
 check((await menu.locator('summary').innerText()).includes('0 selected')&&await approve.isDisabled(),'Clear selected removes selection and disables approval');
 const ineligible=await page.evaluate(async()=>{const a=window.__bulkSolutionQA;let empty='';try{await a.reviewSelectedSolutionsAsGood({ids:[]});}catch(e){empty=e.message;}const results=await a.reviewSelectedSolutionsAsGood({ids:['S-MISMATCH','S-MISSING','NOT-FOUND']});return {empty,results};});
 check(ineligible.empty.includes('Select at least one'),'Empty selection is rejected');
 check(ineligible.results.approved===0&&ineligible.results.critical===1&&ineligible.results.missing===1&&ineligible.results.unavailable===1,'Unavailable/red/gray items counted without creating approvals');
 const benchmark=await page.evaluate(async()=>{const a=window.__bulkSolutionQA,seed=structuredClone(a.state.questions.find(q=>q.id==='S-FORMAT'));const qs=Array.from({length:337},(_,i)=>({...structuredClone(seed),id:`BULK-${i}`,additionalMetadata:{}}));for(const q of qs)await a.dbPut('questions',q);a.state.questions=qs;a.state.bank.selection=new Set();a.state.focusedQuestionID=qs[0].id;a.renderApp();return {questions:qs.length};});
 await openSelection();await page.locator('[data-action="select-every-bank-question"]').click();
 const started=Date.now();await approveSelection();benchmark.elapsedMs=Date.now()-started;
 const large=await page.evaluate(async()=>{const a=window.__bulkSolutionQA;return {selected:a.state.bank.selection.size,active:a.state.questions.filter(q=>a.solutionQualityReviewIsActive(q)).length,lastSaved:a.solutionQualityReviewIsActive(await a.dbGet('questions','BULK-336'))};});
 check(large.selected===337&&large.active===337&&large.lastSaved,'All 337 selected solutions approve and persist');
 await openSelection();await undo.click();await page.waitForFunction(()=>!window.__bulkSolutionQA.state.questions.some(q=>q.additionalMetadata?.solutionQualityReview));
 check(await page.evaluate(()=>window.__bulkSolutionQA.state.questions.every(q=>window.__bulkSolutionQA.solutionIndicatorState(q).state==='review')),'Undo restores all 337 warnings');
 const partialFailure=await page.evaluate(async()=>{
  const a=window.__bulkSolutionQA,put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(value,...args){if(this.name==='questions'&&value.id==='BULK-0')throw new Error('Simulated QA storage failure');return put.call(this,value,...args);};
  try{const results=await a.reviewSelectedSolutionsAsGood({ids:['BULK-0','BULK-1']});return {results,first:a.solutionQualityReviewIsActive(a.state.questions[0]),second:a.solutionQualityReviewIsActive(await a.dbGet('questions','BULK-1')),unselected:a.solutionQualityReviewIsActive(await a.dbGet('questions','BULK-2'))};}finally{IDBObjectStore.prototype.put=put;}
 });
 check(await page.locator('[data-solution-approval-notice]').count()===1,'Repeated approve/undo actions replace their previous notice');
 check(partialFailure.results.errors.length===1&&partialFailure.results.approved===1,'One storage failure preserves success for a valid sibling');
 check(!partialFailure.first&&partialFailure.second&&!partialFailure.unselected,'Failed save and unselected item remain unapproved');
 await page.locator('[data-action="clear-bank-selected"]').click();
 for(const width of [1440,1024,781,768,375,320]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(300);
  if(width<=780){await page.locator('.mobile-bar [data-action="toggle-mobile-sidebar"]').click();await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().left>=0);}
  const control=page.locator(width<=780?'.sidebar-mobile-close':'.sidebar-collapse-toggle');
  const geometry=await control.evaluate(e=>{const b=e.getBoundingClientRect(),img=e.querySelector('img'),svg=e.querySelector('svg'),r=img.getBoundingClientRect(),s=e.closest('.sidebar').getBoundingClientRect(),brand=e.closest('.brand');return {combined:!!img&&!!svg,contained:r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom&&b.left>=s.left&&b.right<=s.right,brandFits:brand.scrollWidth<=brand.clientWidth+1};});
  check(geometry.combined&&geometry.contained&&geometry.brandFits,`${width}px: combined logo/menu control and header fit`);
  check(await control.getAttribute('aria-label')!==null,`${width}px: control keeps accessible action label`);
  check(await page.locator('.sidebar > .global-ai-shortcuts .ai-bookmark').evaluateAll(bs=>bs.every(e=>e.scrollWidth<=e.clientWidth+1)),`${width}px: provider links fit`);
  await page.screenshot({clip:await page.locator('.sidebar').boundingBox(),path:path.join(output,`header-${width}-dark.png`)});
  if(width<=780){await control.click();await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=0);check(!await page.locator('.sidebar').evaluate(e=>e.getBoundingClientRect().right>0),`${width}px: mobile logo/close button closes drawer`);}
 }

 for(const width of [320,375,768,1440]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(300);await openSelection();
  await page.waitForFunction(()=>{const p=document.querySelector('.bank-selection-menu .bank-toolbar-menu-panel'),r=p.getBoundingClientRect();return r.width>0&&getComputedStyle(p).opacity==='1'&&Math.abs(r.left-parseFloat(p.style.left))<1&&Math.abs(r.top-parseFloat(p.style.top))<1;});
  const fit=await page.locator('.bank-selection-menu .bank-toolbar-menu-panel').evaluate(e=>{const r=e.getBoundingClientRect();return {style:e.getAttribute('style'),position:getComputedStyle(e).position,detailsOpen:e.closest('details').open,trigger:e.closest('details').querySelector('summary').getBoundingClientRect().toJSON(),x:r.x,y:r.y,width:r.width,height:r.height,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,contained:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,content:e.scrollWidth<=e.clientWidth+1,buttons:[...e.querySelectorAll('button')].every(b=>b.scrollWidth<=b.clientWidth+1),help:e.querySelector('.bank-solution-approval-help').scrollWidth<=e.querySelector('.bank-solution-approval-help').clientWidth+1};});
  check(fit.contained&&fit.content&&fit.buttons&&fit.help,`${width}px: selection menu, buttons and approval explanation fit without clipping ${JSON.stringify(fit)}`);
  if(width===375)await page.screenshot({path:path.join(output,'bulk-menu-375.png')});
  await page.keyboard.press('Escape');
 }
 await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(300);
 await page.locator('.sidebar-collapse-toggle').focus();await page.keyboard.press('Enter');
 check(await page.locator('.app-shell').evaluate(e=>e.classList.contains('sidebar-collapsed')),'Combined control collapses via keyboard');
 check(await page.locator('.sidebar-collapse-toggle').evaluate(e=>{const r=e.getBoundingClientRect(),s=e.closest('.sidebar').getBoundingClientRect();return r.left>=s.left&&r.right<=s.right;}),'Combined control fits collapsed rail');
 await page.screenshot({clip:{x:0,y:0,width:64,height:900},path:path.join(output,'header-collapsed.png')});
 await page.locator('.sidebar-nav [data-section="practice"]').click();check(await page.locator('.practice-session-card').isVisible(),'Collapsed navigation remains usable');
 await page.reload();await page.waitForFunction(()=>window.__bulkSolutionQA?.state.questions.length>0);
 check(await page.locator('.app-shell').evaluate(e=>e.classList.contains('sidebar-collapsed')),'Collapsed preference survives reload');
 await page.locator('.sidebar-collapse-toggle').click();check(!await page.locator('.app-shell').evaluate(e=>e.classList.contains('sidebar-collapsed')),'Combined control expands rail');
 await page.locator('.sidebar-nav [data-section="settings"]').click();await page.selectOption('[data-setting="appearance"]','light');
 await page.screenshot({clip:await page.locator('.sidebar').boundingBox(),path:path.join(output,'header-1440-light.png')});
 check(errors.length===0,`No browser runtime errors: ${errors.join('; ')}`);
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:true,assertions,checks,cases,benchmark,errors},null,2));
 console.log(`PASS: ${assertions} bulk approval, undo, content guard and combined header checks. 337-question approval: ${benchmark.elapsedMs} ms. Evidence: ${output}`);
}catch(error){fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:false,assertions,checks,errors,error:error.stack},null,2));throw error;}
finally{await browser.close();}
