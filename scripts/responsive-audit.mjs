import {openBankMore,revealBankFilter} from './qa-bank-filter-helpers.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url), {chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const originalHtml=fs.readFileSync(path.join(root,'index.html'),'utf8');
// The state hook exists only in this isolated test page; shipped HTML is unchanged.
const html=originalHtml.replace('  state.activityRecords = function() {','  window.__layoutAudit={state,renderApp,ensurePracticeConfig,ensureExamConfig,startSession,clearSessionRecovery};\n  state.activityRecords = function() {');
if(html===originalHtml)throw new Error('Test fixture hook was not installed');
const output=process.env.AUDIT_OUTPUT || '/private/tmp/fe-responsive-audit';
fs.mkdirSync(output,{recursive:true});
const sizes=(process.env.AUDIT_WIDTHS || '320x568,375x812,600x900,768x1024,844x390,1024x768,1280x800,1440x900,1920x1080,2560x1440').split(',').map(value=>value.split('x').map(Number));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[];
try {
 for(const [width,height] of sizes){
  const page=await browser.newPage({viewport:{width,height},colorScheme:'dark'});
  page.setDefaultTimeout(7000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.dismiss());
  await page.route('http://fe-civil.local/',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
  await page.goto('http://fe-civil.local/',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.brand-version');
  const nav=async section=>{
   if(await page.locator('.mobile-bar').isVisible()) await page.locator('.mobile-bar [data-action="toggle-mobile-sidebar"]').click();
   await page.locator(`.sidebar-nav [data-section="${section}"]`).click();
   await page.waitForTimeout(250);
  };
  const snapshot=async name=>{
   await page.waitForTimeout(230);
   const metrics=await page.evaluate(()=>{
    const visible=node=>node.getClientRects().length && getComputedStyle(node).visibility!=='hidden' && !node.closest('[hidden]');
    const containers=[...document.querySelectorAll('.content,.page,.groupbox,.card,.form-grid,.field,.range-row,.setup-layout,.generate-layout,.modal,.modal-body,.modal-header,.modal-footer,.page-title-row,.topic-option,.topic-scope-card,.routing-control-grid,.pagination,.session-toolbar,.session-footer,.session-workspace,.question-scroll,.question-pane,.tools-pane,.library-detail,.library-sidebar,.bank-command-surface,.mobile-bar,.result-layout,.bank-advanced-filter-body,.bank-toolbar-menu-panel,.shared-filter-popover')].filter(visible);
    const issues=containers.flatMap(node=>{
     const css=getComputedStyle(node),overflow=node.scrollWidth-node.clientWidth;
     if(overflow<=3 || (node.matches('.bank-command-surface') && ['auto','scroll'].includes(css.overflowX))) return [];
     return [{kind:'overflow',element:node.className,label:node.textContent.trim().replace(/\s+/g,' ').slice(0,90),width:node.clientWidth,overflow}];
    });
    for(const row of document.querySelectorAll('.range-row')){
     if(!visible(row))continue;
     const rect=row.getBoundingClientRect();
     for(const child of row.children){ const box=child.getBoundingClientRect();if(box.right>rect.right+2||box.left<rect.left-2) issues.push({kind:'slider-outside-row',element:child.tagName,label:child.textContent,width:rect.width,overflow:box.right-rect.right}); }
    }
    const modal=document.querySelector('.modal');
    if(modal){const rect=modal.getBoundingClientRect();if(rect.left<0||rect.right>innerWidth+1||rect.top<0||rect.bottom>innerHeight+1)issues.push({kind:'modal-outside-viewport',rect:rect.toJSON()});}
    for(const panel of document.querySelectorAll('.bank-advanced-filters[open] > .bank-advanced-filter-body,.bank-toolbar-menu[open] > .bank-toolbar-menu-panel,.shared-filter-dropdown.open > .shared-filter-popover')){
     // A modal obscures the underlying page; only foreground overlays are in scope.
     if(modal&&!panel.closest('.modal'))continue;
     if(!visible(panel))continue;
     const rect=panel.getBoundingClientRect();
     if(rect.left<0||rect.right>innerWidth+1||rect.top<0||rect.bottom>innerHeight+1)issues.push({kind:'popup-outside-viewport',element:panel.className,rect:rect.toJSON()});
    }
    return {issues,documentOverflow:document.documentElement.scrollWidth-innerWidth,rangeRows:[...document.querySelectorAll('.range-row')].filter(visible).map(n=>({width:n.clientWidth,scrollWidth:n.scrollWidth}))};
   });
   if(process.env.AUDIT_SCREENSHOTS!=='0')await page.screenshot({path:path.join(output,`${width}-${name}.png`)});
   results.push({width,height,view:name,...metrics});
  };
  for(const section of ['home','practice','exam','bank','worksheets','references','generate','results','settings']){
   await nav(section); await snapshot(section);
   if(section==='practice'){
    await page.locator('.practice-session-card').scrollIntoViewIfNeeded();await snapshot('practice-session-card');
    await page.locator('details[data-subtopic-panel] > summary').first().click();await snapshot('practice-subtopics');
   }
  }
  const closeModal=async()=>{await page.locator('.modal-header [data-action="close-modal"]').click();await page.waitForSelector('.modal-layer',{state:'detached'});};
  await nav('bank');
  await openBankMore(page);await snapshot('more-filters');
  if(await page.locator('.bank-advanced-filters').evaluate(n=>n.open)){await page.locator('.bank-advanced-filters > summary').click();await page.waitForTimeout(200);}
  await revealBankFilter(page,'.bank-sources-field .shared-filter-trigger');await page.locator('.bank-sources-field .shared-filter-trigger').click();await page.locator('.bank-sources-membership > summary').click();await snapshot('bank-membership');
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  await revealBankFilter(page,'.bank-sources-field .shared-filter-trigger');await page.locator('.bank-sources-field .shared-filter-trigger').click();await snapshot('sources');
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  await page.locator('.bank-tools-menu > summary').click();await snapshot('tools-menu');
  await page.locator('.bank-tools-menu > summary').click();await page.waitForTimeout(200);
  for(const [name,opener] of [
   ['question-editor',async()=>page.locator('[data-action="new-question"]').click()],
   ['bank-maintenance',async()=>{await page.locator('.bank-tools-menu > summary').click();await page.locator('[data-action="open-bank-maintenance"]').click();}],
   ['ai-routing',async()=>{await page.locator('.bank-tools-menu > summary').click();await page.locator('[data-action="open-bank-ai-routing"]').click();}],
   ['ai-batch-tools',async()=>{await page.locator('.bank-tools-menu > summary').click();await page.locator('[data-action="batch-solutions"]').click();}]
  ]){await opener();await snapshot(name);await closeModal();}
  await nav('generate');
  await page.locator('[data-action="open-worksheet-builder"]').first().click();await snapshot('worksheet-builder');await closeModal();
  if(await page.locator('.mobile-bar').isVisible())await page.locator('.mobile-bar [data-action="toggle-mobile-sidebar"]').click();
  await page.locator('.sidebar-profile-btn').click();await snapshot('profile');await closeModal();
  if(await page.locator('#app.sidebar-open').count())await page.locator('.sidebar-mobile-close').click();
  await page.evaluate(()=>{
   const {state}=window.__layoutAudit, date=new Date().toISOString();
   state.worksheets=[{id:'audit-worksheet',title:'FE Civil Practice — Water Resources and Environmental Engineering Review',category:'Practice',source:'Local layout QA fixture',createdAt:date,updatedAt:date,topics:['Water Resources and Environmental Engineering','Geotechnical Engineering'],difficultyRange:'60–85',latexSource:'\\documentclass{article}\n\\begin{document}\nLayout audit worksheet.\n\\end{document}'}];
   state.sessions=[{id:'audit-session',mode:'practice',endedAt:date,totalQuestions:3,answeredCount:2,correctCount:1,flaggedCount:1,durationSeconds:300}];
   state.attempts=state.questions.slice(0,3).map((q,i)=>({id:'audit-attempt-'+i,sessionID:'audit-session',questionID:q.id,ordinal:i,selectedIndex:i===2?null:0,correctIndex:q.answerIndex,isCorrect:i===0,topic:q.topic,flagged:i===1}));
   state.drafts=[{id:'audit-draft',rawJSON:JSON.stringify({...state.questions[0],id:'AUDIT-DRAFT-001'}),createdAt:date,updatedAt:date,status:'pending',warnings:[]}];
  });
  await nav('worksheets');await snapshot('worksheet-populated');
  await page.locator('.worksheet-metadata-tools > summary').click();await snapshot('worksheet-metadata');
  await nav('results');await snapshot('results-populated');
  await nav('generate');await snapshot('generate-populated');
  for(const mode of ['practice','exam']){
   await page.evaluate(mode=>{const api=window.__layoutAudit;api.startSession(mode,api.state.questions.slice(0,3),mode==='practice'?api.ensurePracticeConfig():api.ensureExamConfig());},mode);
   await snapshot(`${mode}-live`);
   await page.locator('[data-action="select-session-answer"]').first().click();await snapshot(`${mode}-answered`);
   await page.locator('.question-scroll').evaluate(n=>n.scrollTop=n.scrollHeight);
   await page.locator('.session-footer').scrollIntoViewIfNeeded();await snapshot(`${mode}-footer`);
   await page.locator('[data-action="toggle-session-tools"]').click();await snapshot(`${mode}-no-tools`);
   await page.evaluate(async()=>{const {state,renderApp,clearSessionRecovery}=window.__layoutAudit;clearInterval(state.sessionTimer);state.sessionTimer=null;const id=state.activeSession.id;state.activeSession=null;await clearSessionRecovery(id);state.section='home';renderApp();});
  }
  results.push({width,view:'page-errors',errors});
  await page.close();
  console.log(`${width}x${height}: ${results.filter(r=>r.width===width&&r.issues?.length).map(r=>`${r.view}(${r.issues.length})`).join(', ') || 'no geometry issues'}`);
 }
} finally {fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(results,null,2));await browser.close();}
console.log(`Saved ${results.length} audit records to ${output}`);
if(results.some(r=>r.issues?.length||r.errors?.length||r.documentOverflow>3))process.exitCode=1;
