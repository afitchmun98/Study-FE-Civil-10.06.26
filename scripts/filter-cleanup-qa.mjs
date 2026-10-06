import {openBankMore,revealBankFilter} from './qa-bank-filter-helpers.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output=process.env.FILTER_QA_OUTPUT||path.join(os.tmpdir(),'fe-filter-cleanup-qa');fs.mkdirSync(output,{recursive:true});
const source=fs.readFileSync(path.join(root,'index.html'),'utf8'),anchor='  state.activityRecords = function() {';
const html=source.replace(anchor,`  setTimeout(()=>window.__filterQA={state,renderApp,filteredQuestions,solutionIndicatorState,ensureBankSourceTypeFilters,questionLineageFilterValues,bankSolutionMainValue,questionUploadSource,clearAllBankFilters},0);\n${anchor}`);
if(html===source)throw new Error('Missing isolated filter fixture hook');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const checks=[],errors=[],providerRequests=[];const check=(value,message)=>{checks.push({message,passed:!!value});if(!value)throw new Error(message);};
let page;
try {
 page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'dark',reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/api\.openai\.com|generativelanguage\.googleapis\.com/.test(r.url()))providerRequests.push(r.url());});
 await page.route('http://fe-filter-cleanup.local/',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('http://fe-filter-cleanup.local/');await page.waitForFunction(()=>window.__filterQA?.state.questions.length);
 const fixtures=await page.evaluate(()=>{
  const a=window.__filterQA,seed=structuredClone(a.state.questions[0]);
  // Lineage normalization records the assigned current bank as a membership too.
  const definitions=[['I-GREEN','present',false,false,'Pub A','Bank A',['Bank A','Archive']],['AI-GREEN','present',true,false,'Pub A','Bank B',['Bank A','Bank B']],['AI-YELLOW','review',true,false,'Pub B','Bank B',['Archive','Bank B']],['AI-RED','critical',true,false,'Pub B','Bank A',['Bank A']],['I-REPAIR','review',false,true,'Pub B','Bank A',['Archive']],['AI-REPAIR','review',true,true,'Pub C','Bank B',['Archive','Bank B']],['MISSING','missing',false,false,'Pub C','Bank A',['Bank A']],['AI-MISSING','missing',true,false,'Pub C','Bank B',['Archive','Bank B']]];
  const qs=definitions.map(([id,status,ai,repair,original,current,memberships],i)=>{
   const q={...structuredClone(seed),id,question:`Filter fixture ${id}`,topic:'Mathematics and Statistics',subtopic:'Statistics',difficulty:'FE-Level',difficultyScore:70,choices:['8.34','10.00','12.00','14.00'],answerIndex:0,answerLetter:'A',equations:[],source:'Import',sourceFile:`Upload ${i%2}.json`,questionType:i%2?'conceptual':'computational',solution:status==='missing'?'':repair?'Use \\(x = 8.34 to compute the answer.':'The computed value is 8.34.',updatedAt:'2026-09-29T12:00:00.000Z',additionalMetadata:{questionClassification:{questionType:i%2?'conceptual':'computational'},questionLineage:{...structuredClone(seed.additionalMetadata.questionLineage),origin:{bankName:original,sourceFile:`Upload ${i%2}.json`},currentBank:{bankName:current},bankMemberships:memberships.map(bankName=>({bankName,relationship:'included'}))}}};
   if(ai)q.additionalMetadata.solutionGeneration={finalAnswer:status==='critical'?'12.00':status==='review'&&!repair?'9.00':status==='missing'?'':'8.336'};
   return q;
  });
  a.state.questions=qs;a.state.section='bank';a.clearAllBankFilters();
  window.__filterDefinitions=definitions;
  return definitions.map(([id,status,ai,repair,original,current,memberships])=>({id,status,ai,repair,original,current,memberships:a.questionLineageFilterValues(qs.find(q=>q.id===id)).includedIn,actual:a.solutionIndicatorState(qs.find(q=>q.id===id)).state,upload:a.questionUploadSource(qs.find(q=>q.id===id))}));
 });
 for(const f of fixtures)check(f.actual===f.status,`${f.id}: known solution indicator fixture is ${f.status}`);
 const openMore=()=>openBankMore(page);
 const choose=async(selector,value)=>{await revealBankFilter(page,selector);await page.selectOption(selector,value);};
 const repairCheck=async(value)=>{await revealBankFilter(page,'#bank-solution-math-repair');await page.locator('#bank-solution-math-repair').setChecked(value);};
 const ids=()=>page.evaluate(()=>window.__filterQA.filteredQuestions().map(q=>q.id).sort());
 const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
 await openMore();
 check(await page.locator('#bank-solution').count()===1&&await page.locator('#bank-review-status').count()===0,'One Solutions control replaces duplicate presence and color dropdowns');
 check(await page.locator('#bank-solution option').count()===6,'Solutions has six clear presence/color choices');
 const modes=[['All Solution Statuses',null],['Has Any Solution','saved'],['Solution Present (Green)','present'],['Review Recommended (Yellow)','review'],['Critical Issue (Red)','critical'],['Missing Solution','missing']];
 for(const [mode,status] of modes){
  await choose('#bank-solution',mode);await openMore();
  for(const origin of ['All solution origins','Imported / Existing Solution','AI Generated']){
   await choose('#bank-solution-origin',origin);await openMore();
   for(const repair of [false,true]){
    await repairCheck(repair);await openMore();
    const expected=fixtures.filter(f=>(!status||(status==='saved'?f.status!=='missing':f.status===status))&&(origin==='All solution origins'||(origin==='AI Generated'?f.ai:!f.ai&&f.status!=='missing'))&&(!repair||f.repair)).map(f=>f.id);
    check(same(await ids(),expected),`${mode} + ${origin} + math repair ${repair}: correct intersection`);
   }
  }
 }
 await page.evaluate(()=>{const a=window.__filterQA;a.clearAllBankFilters();a.state.bank.solution='Imported / Existing Solution';a.state.bank.reviewStatus='Review Recommended (Yellow)';a.renderApp();});await openMore();
 check(same(await ids(),['I-REPAIR'])&&await page.locator('#bank-solution-origin').inputValue()==='Imported / Existing Solution','Legacy origin + color restrictions stay visible and preserve their results');
 await choose('#bank-solution','Has Any Solution');
 check(same(await ids(),['I-GREEN','I-REPAIR']),'Changing the main solution mode preserves an existing origin restriction');
 await page.evaluate(()=>{const a=window.__filterQA;a.clearAllBankFilters();a.state.bank.solution='Missing Solution';a.state.bank.reviewStatus='Critical Issue (Red)';a.renderApp();});await openMore();
 check((await ids()).length===0&&await page.locator('#bank-solution').inputValue()==='__combined__','A conflicting legacy combination remains visible until explicitly replaced');
 await choose('#bank-solution','Missing Solution');check(same(await ids(),['MISSING','AI-MISSING']),'Selecting Missing replaces the legacy combination with one gray/presence criterion');
 await page.evaluate(()=>window.__filterQA.clearAllBankFilters());
 if(process.env.FILTER_QA_STAGE!=='solutions'){
  const sourceRoot=page.locator('[data-shared-filter-dropdown="bank:originalSources"]'),sourcePanel=sourceRoot.locator('.shared-filter-popover'),sourceTrigger=sourceRoot.locator('> .shared-filter-trigger');
  const openSources=async()=>{if(!await sourcePanel.isVisible()){await revealBankFilter(page,'[data-shared-filter-dropdown="bank:originalSources"] > .shared-filter-trigger');await sourceTrigger.click();}};
  const groupCheck=(group,value)=>sourcePanel.locator(`input[data-shared-filter-group="${group}"][value="${value}"]`);
  const membership=sourcePanel.locator('.bank-sources-membership');
  await openSources();check(!await membership.evaluate(n=>n.open),'Bank membership is collapsed by default');
  await membership.locator('> summary').click();
  check(await sourcePanel.locator('.shared-filter-dropdown').count()===0,'All source and bank lists are inline with no nested popup');
  const handle=await sourcePanel.elementHandle();
  for(const original of ['Pub A','Pub B','Pub C'])for(const current of ['Bank A','Bank B'])for(const member of ['Bank A','Bank B','Archive'])for(const upload of [...new Set(fixtures.map(f=>f.upload))]){
   await sourcePanel.locator('[data-bank-clear-sources]').click({force:true});
   await groupCheck('originalSources',original).check();await groupCheck('currentBanks',current).check();await groupCheck('includedIn',member).check();await sourcePanel.locator('#bank-source').selectOption(upload);
   const expected=fixtures.filter(f=>f.original===original&&f.current===current&&f.memberships.includes(member)&&f.upload===upload).map(f=>f.id);
   check(same(await ids(),expected),`Actual ${JSON.stringify(await ids())}, expected ${JSON.stringify(expected)}. Source ${original} + current ${current} + membership ${member} + upload ${upload}: AND intersection`);
   check(await handle.evaluate(n=>n.isConnected),'Source panel stays mounted while four criteria change');
  }
  await sourcePanel.locator('[data-bank-clear-sources]').click();await groupCheck('originalSources','Pub A').check();await groupCheck('originalSources','Pub B').check();
  check(same(await ids(),fixtures.filter(f=>['Pub A','Pub B'].includes(f.original)).map(f=>f.id)),'Two original sources match either source');
  await groupCheck('currentBanks','Bank A').check();await groupCheck('includedIn','Archive').check();await groupCheck('includedIn','Bank A').check();
  check(same(await ids(),fixtures.filter(f=>['Pub A','Pub B'].includes(f.original)&&f.current==='Bank A'&&f.memberships.some(v=>['Archive','Bank A'].includes(v))).map(f=>f.id)),'Multi-choice union within each list combines with other lists by intersection');
  check((await sourceTrigger.innerText()).includes('5')&&(await sourcePanel.locator('[data-source-membership-count]').innerText()).includes('3'),'Sources and membership active counts include all selected choices');
  await sourcePanel.locator('[data-action="clear-shared-filter-group"][data-filter-group="currentBanks"]').click();
  check(await groupCheck('includedIn','Archive').isChecked()&&await groupCheck('originalSources','Pub A').isChecked(),'Clear current bank preserves original and membership restrictions');
  await page.keyboard.press('Escape');await page.waitForTimeout(230);
  await page.locator('.bank-active-filters [data-filter-key="includedIn"][data-filter-value="Archive"]').click();
  check((await page.locator('.bank-active-filters').innerText()).includes('Bank membership: Bank A')&&!(await page.locator('.bank-active-filters').innerText()).includes('Archive'),'Membership chip has a clear label and removes only its own restriction');
  await openSources();check(await membership.evaluate(n=>n.open),'Membership expansion survives a full results rerender');await sourcePanel.locator('[data-bank-clear-sources]').click();
  check(same(await ids(),fixtures.map(f=>f.id))&&await sourcePanel.locator('input:checked').count()===0,'Clear sources and banks restores all questions and resets every source criterion');
  await page.keyboard.press('Escape');await page.waitForTimeout(230);await openMore();
  check(await page.locator('#bank-difficulty').count()===1&&await page.locator('[data-shared-filter-type-target="bank"]').count()===1,'Difficulty and question type each have one adaptive control');
  check(await page.locator('.pagination #bank-sort').isVisible(),'Sort is beside the question list with pagination');
  await choose('[data-shared-filter-type-target="bank"]','conceptual');
  check(same(await ids(),fixtures.filter((f,i)=>i%2).map(f=>f.id)),'Moved Question type still filters conceptual questions');
  await page.locator('.bank-toolbar-clear-btn').click();
  const ranks={critical:0,review:1,missing:2,present:3};
  for(const [sort,metric,descending] of [['Topic and ID',f=>f.id,false],['Review Priority',f=>ranks[f.status],false],['Upload Source',f=>f.upload,false],['Any Solution First',f=>Number(f.status!=='missing'),true],['AI Generated First',f=>Number(f.ai),true],['Imported Solution First',f=>Number(!f.ai&&f.status!=='missing'),true],['Math Repair First',f=>Number(f.repair),true],['Missing First',f=>Number(f.status==='missing'),true]]){
   await choose('#bank-sort',sort);const order=await page.evaluate(()=>window.__filterQA.filteredQuestions().map(q=>q.id)),values=order.map(id=>metric(fixtures.find(f=>f.id===id)));
   check(same(order,fixtures.map(f=>f.id)),`${sort}: sorting keeps the same question set`);
   check(values.every((v,i)=>!i||(descending?values[i-1]>=v:values[i-1]<=v)),`${sort}: correct order after moving the control`);
  }
  for(const key of ['id','question','topic','source','difficulty','solution'])for(let direction=0;direction<2;direction++){
   await page.locator(`[data-action="sort-bank-column"][data-sort-key="${key}"]`).click();
   check(await page.locator('#bank-sort').inputValue()==='Column'&&(await page.locator('#bank-sort option:checked').innerText()).includes(direction?'descending':'ascending'),`${key} header: footer reflects ${direction?'descending':'ascending'} column order`);
   check(same(await ids(),fixtures.map(f=>f.id)),`${key} header: keeps every matching question`);
  }
  await page.evaluate(()=>{const a=window.__filterQA;a.clearAllBankFilters();a.state.bank.selection=new Set(['AI-GREEN']);a.state.bank.solutionOrigin='AI Generated';a.state.bank.solutionMathRepair=true;a.renderApp();});
  check(await page.locator('.bank-active-filters [data-filter-key="solutionOrigin"]').isVisible()&&await page.locator('.bank-active-filters [data-filter-key="solutionMathRepair"]').isVisible(),'Advanced solution restrictions each have a removable active chip');
  await page.locator('.bank-active-filters [data-filter-key="solutionMathRepair"]').click();check(same(await ids(),fixtures.filter(f=>f.ai).map(f=>f.id)),'Removing math repair chip keeps solution origin');
  await page.locator('.bank-toolbar-clear-btn').click();check(same(await ids(),fixtures.map(f=>f.id))&&await page.evaluate(()=>window.__filterQA.state.bank.selection.has('AI-GREEN')),'Clear filters resets advanced criteria and retains selection');
  await openMore();await choose('#bank-difficulty','Hard');
  check((await ids()).length===0&&await page.locator('.no-match-help [data-filter-key="difficulty"]').isVisible(),'Moved Difficulty preserves no-match guidance');
  await page.keyboard.press('Escape');await page.locator('.no-match-help [data-filter-key="difficulty"]').click();check((await ids()).length===8,'Targeted difficulty relaxation restores matching questions');
  await openMore();await choose('#bank-solution','Missing Solution');await choose('#bank-solution-origin','AI Generated');await repairCheck(true);
  await page.keyboard.press('Escape');
  check((await ids()).length===0&&await page.locator('.no-match-help [data-filter-key="solutionMathRepair"]').isVisible(),'New advanced solution criteria participate in no-match suggestions');
  await page.locator('.no-match-help [data-filter-key="solutionMathRepair"]').click();check(same(await ids(),['AI-MISSING']),'Targeted math-repair relaxation preserves Missing and AI origin');
  await page.locator('.bank-toolbar-clear-btn').click();
  const fit=async(locator,label)=>{await page.waitForTimeout(240);const m=await locator.evaluate(n=>{const r=n.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight};});check(m.left>=-1&&m.top>=-1&&m.right<=m.w+1&&m.bottom<=m.h+1,`${label}: popup fits viewport ${JSON.stringify(m)}`);};
  for(const [width,height] of [[320,568],[375,812],[768,1024],[844,390],[1440,1000]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(400);
   const partition=await page.evaluate(()=>({direct:document.querySelectorAll('.bank-command-surface > [data-bank-filter-key]').length,overflow:document.querySelectorAll('.bank-more-filters-grid > [data-bank-filter-key]').length}));
   check(partition.direct+partition.overflow===7,`${width}px: every filter remains reachable in the toolbar or More`);
   await openMore();await fit(page.locator('.bank-advanced-filter-body'),`${width}px More filters`);
   if(width===1440)await page.screenshot({path:path.join(output,'desktop-more-filters.png'),animations:'disabled'});
   await page.keyboard.press('Escape');await page.waitForTimeout(230);await openSources();if(!await membership.evaluate(n=>n.open))await membership.locator('> summary').click();await fit(sourcePanel,`${width}px expanded Sources and banks`);
   check(await page.locator('.content').evaluate(n=>n.scrollWidth<=n.clientWidth+1),`${width}px: no content overflow`);
   if([375,1440].includes(width))await page.screenshot({path:path.join(output,`${width}-sources-and-banks.png`),animations:'disabled'});
   await page.keyboard.press('Escape');await page.waitForTimeout(230);
  }
 }
 check(!providerRequests.length,'Filter controls made zero AI provider requests');check(!errors.length,`No browser errors (${errors.join('; ')})`);
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({assertions:checks.length,checks,errors,providerRequests},null,2));console.log(`PASS: ${checks.length} filter cleanup checks. Evidence: ${output}`);
} catch(error) {await page?.screenshot({path:path.join(output,'failure.png')});fs.writeFileSync(path.join(output,'failure-dom.json'),JSON.stringify(await page?.evaluate(()=>({viewport:{w:innerWidth,h:innerHeight},details:[...document.querySelectorAll('.bank-command-surface details')].map(n=>({class:n.className,open:n.open})),popover:document.querySelector('#solution-indicator-help-popover')?.outerHTML,info:document.querySelector('[data-solution-indicator-help]')?.outerHTML})),null,2));fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({message:error.message,checks,errors},null,2));throw error;}
finally {await browser.close();}
