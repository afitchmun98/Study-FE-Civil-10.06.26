import {openBankMore,revealBankFilter} from './qa-bank-filter-helpers.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output=process.env.REVIEW_CONTROLS_QA_OUTPUT||path.join(os.tmpdir(),'fe-review-controls-qa');fs.mkdirSync(output,{recursive:true});
const source=fs.readFileSync(path.join(root,'index.html'),'utf8'),anchor='  state.activityRecords = function() {';
if(!source.includes(anchor))throw new Error('Missing isolated fixture anchor');
const html=source.replace(anchor,`  setTimeout(()=>window.__reviewControlsQA={state,dbGet,renderApp,filteredQuestions,ensureBankSourceTypeFilters,ensureManualSolutionBatchState,ensureManualQuestionTextBatchState,ensureManualDraftSolutionBatchState,ensureManualDiagramBatchState,manualWholeSelectionEnsureLedger,showManualWholeSelectionReview,persistManualSolutionBatchSession},0);\n${anchor}`);
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const checks=[],errors=[],providerRequests=[];const check=(value,message)=>{checks.push({message,passed:!!value});if(!value)throw new Error(`Assertion ${checks.length}: ${message}`);};
let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'dark',reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/api\.openai\.com|generativelanguage\.googleapis\.com/.test(r.url()))providerRequests.push(r.url());});
 await page.route('http://fe-review-controls.local/',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('http://fe-review-controls.local/');await page.waitForFunction(()=>window.__reviewControlsQA?.state.questions.length);
 await page.locator('.sidebar-nav [data-section="bank"]').click();

 const clearSelected=page.locator('[data-action="clear-bank-selected"]'),selectionGroup=page.locator('.bank-selection-controls');
 const captureSelectionGroup=async name=>{await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const clip=await selectionGroup.boundingBox();if(!clip)throw new Error('Selection group is unavailable for capture');await page.screenshot({path:path.join(output,name),clip,animations:'disabled'});};
 check(await clearSelected.isHidden()&&await page.locator('.bank-selection-menu > summary').isVisible(),'Zero selection hides clearing while keeping the selection menu available');
 await page.locator('.bank-list [data-select-question]').first().check();
 await clearSelected.waitFor({state:'visible'});
 check(await selectionGroup.getAttribute('data-has-selection')==='true'&&await selectionGroup.locator('.bank-selection-menu').count()===1&&await selectionGroup.locator('[data-action="clear-bank-selected"]').count()===1,'Selection count and clearing share a single group');
 check(await clearSelected.evaluate(n=>getComputedStyle(n).borderLeftStyle==='dashed'),'A dashed divider visually connects the count and clear icon');
 check(await clearSelected.getAttribute('aria-label')==='Clear selected questions'&&await clearSelected.getAttribute('title')==='Clear selected questions'&&(await clearSelected.innerText()).trim()===''&&await clearSelected.locator('svg[aria-hidden="true"]').count()===1,'Icon-only clearing retains an explicit accessible name and hover tooltip');
 const joined=await selectionGroup.evaluate(n=>{const c=n.querySelector('[data-action="clear-bank-selected"]').getBoundingClientRect(),m=n.querySelector('.bank-selection-menu > summary').getBoundingClientRect(),r=n.getBoundingClientRect();return {aligned:m.right<=c.left+1&&c.left-m.right<=1&&m.left>=r.left&&c.right<=r.right&&Math.abs(c.top-m.top)<1&&c.height===34&&m.height===34,clearWidth:c.width,width:r.width};});
 check(joined.aligned,'Count and clear icon form one aligned, adjacent 34px control');
 check(joined.clearWidth===34&&joined.width<=135,`The selected control is compact and retains a 34px clear target (${JSON.stringify(joined)})`);
 await page.locator('.bank-selection-menu > summary').focus();await page.keyboard.press('Tab');
 check(await clearSelected.evaluate(n=>n===document.activeElement),'Keyboard navigation moves from the selection menu to its clear icon');
 await captureSelectionGroup('group-selected-desktop.png');
 await clearSelected.click();await clearSelected.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.matches('.bank-selection-menu > summary'));
 check(await selectionGroup.getAttribute('data-has-selection')==='false'&&(await page.locator('.bank-selection-menu > summary').innerText()).includes('0 selected'),'Clear hides itself and returns keyboard focus to the truthful zero-selection menu');
 await page.locator('.bank-list [data-select-question]').first().check();await clearSelected.waitFor({state:'visible'});await page.locator('.bank-list [data-select-question]').first().uncheck();await clearSelected.waitFor({state:'hidden'});
 check(true,'Deselecting the final checkbox hides the clear action immediately');
 await page.locator('.bank-list [data-select-question]').first().check();await clearSelected.waitFor({state:'visible'});await clearSelected.focus();await page.keyboard.press('Enter');await clearSelected.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.matches('.bank-selection-menu > summary'));
 check((await page.locator('.bank-selection-menu > summary').innerText()).includes('0 selected'),'Enter activates the clear icon and returns focus to the remaining menu');
 await page.locator('.bank-selection-menu > summary').click();await page.locator('[data-action="select-all-bank"]').click();await clearSelected.waitFor({state:'visible'});
 await page.locator('[data-action="clear-bank-selection"]').click();await clearSelected.waitFor({state:'hidden'});
 check((await page.locator('.bank-selection-menu > summary').innerText()).includes('0 selected'),'Menu-based clearing also updates the shared selection group');
 await page.keyboard.press('Escape');
 const clearFilters=page.locator('.bank-toolbar-clear-btn'),filterGroup=page.locator('.bank-filter-controls'),moreSummary=page.locator('.bank-advanced-filters > summary');
 const captureFilterGroup=async name=>{await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const clip=await filterGroup.boundingBox();if(!clip)throw new Error('Filter controls unavailable for capture');await page.screenshot({path:path.join(output,name),clip,animations:'disabled'});};
 check(await clearFilters.isHidden()&&await filterGroup.getAttribute('data-has-filters')==='false'&&await moreSummary.isVisible(),'No active criteria hides the filter-clear icon while keeping More filters available');
 check(await clearFilters.getAttribute('aria-label')==='Clear Question Bank filters, search, and sort order'&&await clearFilters.getAttribute('title')==='Clear filters, search, and sort order'&&(await clearFilters.innerText()).trim()===''&&await clearFilters.locator('svg[aria-hidden="true"]').count()===1,'Filter-clear icon describes its full scope in its accessible name and tooltip');
 const originalRows=await page.locator('.bank-list tbody tr[data-id]').count();
 await page.locator('#bank-search').fill('unsubmitted');
 check(await clearFilters.isVisible()&&await filterGroup.getAttribute('data-has-filters')==='true'&&await page.locator('.bank-list tbody tr[data-id]').count()===originalRows,'Typing shows the clear icon without submitting a search');
 const filterJoined=await filterGroup.evaluate(n=>{const c=n.querySelector('.bank-toolbar-clear-btn').getBoundingClientRect(),m=n.querySelector('.bank-advanced-filters > summary').getBoundingClientRect(),r=n.getBoundingClientRect();return {aligned:Math.abs(c.top-m.top)<1&&Math.abs(c.left-m.right)<1&&c.height===34&&m.height===34,width:r.width,clearWidth:c.width,divider:getComputedStyle(n.querySelector('.bank-toolbar-clear-btn')).borderLeftStyle};});
 check(filterJoined.aligned&&filterJoined.clearWidth===34&&filterJoined.width<=160&&filterJoined.divider==='dashed',`More filters and clearing share a compact aligned group (${JSON.stringify(filterJoined)})`);
 await captureFilterGroup('filter-clear-desktop.png');
 await moreSummary.focus();await page.keyboard.press('Tab');check(await clearFilters.evaluate(n=>n===document.activeElement),'Keyboard Tab moves from More filters to the clear icon');
 await page.keyboard.press('Enter');await clearFilters.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.matches('.bank-advanced-filters > summary'));
 check(await page.locator('#bank-search').inputValue()===''&&await filterGroup.getAttribute('data-has-filters')==='false','Keyboard clearing removes the draft, hides the icon, and restores focus to More filters');
 await page.locator('#bank-search').fill('draft');await page.locator('#bank-search').fill('');check(await clearFilters.isHidden(),'Deleting an unsubmitted draft hides the icon immediately');
 await page.locator('#bank-search').fill('   ');check(await clearFilters.isHidden(),'Whitespace alone does not show a clear-filter icon');await page.locator('#bank-search').fill('');
 for(const width of [320,375,768,1440,1920]){
  await page.setViewportSize({width,height:width<400?568:900});await page.waitForTimeout(220);await page.locator('#bank-search').fill('pending');await filterGroup.scrollIntoViewIfNeeded();
  const g=await filterGroup.evaluate(n=>{const r=n.getBoundingClientRect(),c=n.querySelector('.bank-toolbar-clear-btn').getBoundingClientRect(),m=n.querySelector('.bank-advanced-filters > summary').getBoundingClientRect();const hasMore=!n.querySelector('.bank-advanced-filters').hidden;return {left:r.left,right:r.right,width:innerWidth,aligned:!hasMore||Math.abs(c.top-m.top)<1,hit:n.contains(document.elementFromPoint(c.left+c.width/2,c.top+c.height/2))&&(!hasMore||n.contains(document.elementFromPoint(m.left+m.width/2,m.top+m.height/2)))};});
  check(g.left>=0&&g.right<=g.width&&g.aligned&&g.hit,`${width}px: More filters and its clear icon fit and remain clickable (${JSON.stringify(g)})`);
  if(width===375)await captureFilterGroup('filter-clear-phone.png');
  await clearFilters.click();await clearFilters.waitFor({state:'hidden'});check(await moreSummary.isVisible()===await page.locator('.bank-more-filters-grid').evaluate(n=>n.children.length>0),`${width}px: More appears only when filters overflow`);
 }
 await page.setViewportSize({width:1100,height:1000});await page.waitForTimeout(220);
 const info=page.locator('[data-solution-indicator-help]'),legend=page.locator('#solution-indicator-help-popover');
 const openFilters=async()=>{await revealBankFilter(page,'[data-solution-indicator-help]');await info.waitFor({state:'visible'});};
 const fit=async(label)=>{await page.waitForFunction(()=>{const p=document.querySelector('#solution-indicator-help-popover');return !!p&&parseFloat(p.style.top)>=0;});const m=await legend.evaluate(n=>{const b=n.getBoundingClientRect(),s=getComputedStyle(n);return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:innerWidth,height:innerHeight,opacity:s.opacity,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth,hit:n.contains(document.elementFromPoint(b.left+15,b.top+15)),anchorClear:(()=>{const a=document.querySelector('[data-solution-indicator-help]'),r=a.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return hit===a||a.contains(hit);})()};});check(m.left>=0&&m.right<=m.width&&m.top>=0&&m.bottom<=m.height&&m.hit&&m.anchorClear&&m.scrollWidth<=m.clientWidth+1,`${label}: legend fits viewport and is readable (${JSON.stringify(m)})`);};
 await openFilters();check(await info.getAttribute('aria-label')==='Explain solution indicator colors','Circled info control has an accessible name');check(await info.locator('svg circle').count()===2,'Info icon uses a circle and an i mark');
 await info.hover();await legend.waitFor({state:'visible'});await fit('Hover');check(await legend.locator('.solution-indicator-help-dot').count()===4,'Legend shows all four visual color samples');
 const colors=await legend.locator('.solution-indicator-help-dot').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));check(new Set(colors).size===4,'Color samples have distinct visible colors');
 check((await legend.innerText()).includes('does not certify correctness')&&(await legend.innerText()).includes('different answer than the stored key'),'Legend explains green and critical red accurately');
 await legend.hover();await page.waitForTimeout(180);check(await legend.isVisible(),'Hover can move from info icon into legend without closing it');
 await page.mouse.move(600,900);await legend.waitFor({state:'detached'});check(await info.getAttribute('aria-expanded')==='false','Unpinned legend closes after pointer leaves');
 await info.click();await page.mouse.move(600,900);await page.waitForTimeout(180);check(await legend.isVisible()&&await info.getAttribute('aria-expanded')==='true','Click pins legend after pointer leaves');
 await legend.click({position:{x:20,y:20}});check(await legend.isVisible()&&await page.locator('.bank-advanced-filters').evaluate(e=>e.open),'Clicking the legend keeps it and More filters open');
 await page.locator('.bank-advanced-filter-title').click();await legend.waitFor({state:'detached'});check(await page.locator('.bank-advanced-filters').evaluate(e=>e.open),'Clicking away unpins legend while preserving its filter panel');
 await info.focus();await legend.waitFor({state:'visible'});await page.keyboard.press('Enter');await page.mouse.move(600,900);check(await legend.isVisible(),'Keyboard Enter pins the focused info legend');
 await page.keyboard.press('Escape');await legend.waitFor({state:'detached'});check(await page.locator('.bank-advanced-filters').evaluate(e=>e.open),'Escape closes the legend before its containing filters');
 await info.click();await info.click();await legend.waitFor({state:'detached'});check(true,'Clicking a pinned info icon toggles it closed');
 for(const width of [320,375,768,1024,1440,1920]){
  await page.setViewportSize({width,height:width<400?568:900});await page.waitForTimeout(260);await openFilters();await info.scrollIntoViewIfNeeded();await info.click();await fit(`${width}px`);
  await page.screenshot({path:path.join(output,`${width}-legend.png`)});await page.keyboard.press('Escape');
 }
 await page.setViewportSize({width:1440,height:1000});
 // Populate every filter family, including a hidden selection and an unsubmitted search draft.
 const before=await page.evaluate(()=>{const a=window.__reviewControlsQA,ui=a.state.bank,f=a.ensureBankSourceTypeFilters(ui);ui.selection=new Set(a.state.questions.map(q=>q.id));ui.search='no matching question';ui.searchDraft='unsubmitted draft';ui.topic='Statics';ui.difficulty='Hard';ui.source='Import QA';ui.solution='Missing Solution';ui.reviewStatus='Critical Issue (Red)';ui.solutionOrigin='AI Generated';ui.solutionMathRepair=true;ui.flagged='Flagged Only';ui.aiDataFilter='missing';ui.sort='Review Priority';f.originalSources.add('QA');f.questionTypes.add('conceptual');f.currentBanks.add('QA');f.includedIn.add('QA');a.renderApp();return {selected:[...ui.selection],questions:JSON.stringify(a.state.questions)};});
 check(await page.locator('.bank-table tbody tr[data-id]').count()===0,'Selected questions may be hidden by filters');
 await page.locator('.bank-toolbar-clear-btn').click();
 const afterFilters=await page.evaluate(()=>{const a=window.__reviewControlsQA,ui=a.state.bank,f=a.ensureBankSourceTypeFilters(ui);return {selected:[...ui.selection],questions:JSON.stringify(a.state.questions),search:ui.search,draft:ui.searchDraft,sort:ui.sort,filters:[ui.topic,ui.difficulty,ui.source,ui.solution,ui.reviewStatus,ui.solutionOrigin,ui.solutionMathRepair,ui.flagged,ui.aiDataFilter],sets:[...f.originalSources,...f.questionTypes,...f.currentBanks,...f.includedIn],matches:a.filteredQuestions().length};});
 check(JSON.stringify(afterFilters.selected)===JSON.stringify(before.selected),'Clear filters preserves all selected IDs across hidden pages');check(!afterFilters.search&&!afterFilters.draft&&afterFilters.sort==='Topic and ID'&&!afterFilters.sets.length,'Clear filters resets submitted search, draft search, sorting, and source/type families');
 check(JSON.stringify(afterFilters.filters)===JSON.stringify(['All Topics','All Difficulties','All Upload Sources','All Solution Statuses','All Review Statuses','All solution origins',false,'All Flag Statuses','all']),'Clear filters resets every visible and advanced filter');
 check(afterFilters.matches===before.selected.length&&afterFilters.questions===before.questions,'Clear filters restores matching rows without changing question data');
 check(await page.locator('.bank-toolbar-clear-btn').isHidden()&&await page.locator('[data-action="clear-bank-selected"]').isEnabled(),'Filter clearing hides after reset while the selection clear remains available');
 await page.locator('#bank-search').fill('Statics');await page.locator('#bank-search').press('Enter');const selectedFilter=await page.evaluate(()=>{const a=window.__reviewControlsQA;return {query:a.state.bank.search,ids:a.filteredQuestions().map(q=>q.id)};});
 await page.locator('[data-action="clear-bank-selected"]').click();const afterSelection=await page.evaluate(()=>{const a=window.__reviewControlsQA;return {query:a.state.bank.search,ids:a.filteredQuestions().map(q=>q.id),selected:a.state.bank.selection.size};});
 check(!afterSelection.selected&&afterSelection.query===selectedFilter.query&&JSON.stringify(afterSelection.ids)===JSON.stringify(selectedFilter.ids),'Clear selected leaves search and filtered rows intact');
 check((await page.locator('.bank-selection-menu > summary').innerText()).includes('0 selected')&&await page.locator('[data-action="clear-bank-selected"]').isDisabled(),'Clear selected updates the count and disables itself at zero');
 await page.locator('.bank-toolbar-clear-btn').click();await page.locator('#bank-search').fill('unsent');check(await page.locator('.bank-toolbar-clear-btn').isEnabled(),'Draft search alone enables Clear filters');await page.locator('.bank-toolbar-clear-btn').click();check(await page.locator('#bank-search').inputValue()==='','Clear filters discards an unsent query');

 for(const width of [320,375,768,1440,1920]){
  await page.setViewportSize({width,height:width<400?568:900});await page.waitForTimeout(220);
  await page.locator('.bank-selection-menu > summary').click();await page.locator('[data-action="select-every-bank-question"]').click();await clearSelected.waitFor({state:'visible'});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await selectionGroup.scrollIntoViewIfNeeded();
  const geometry=await selectionGroup.evaluate(n=>{const r=n.getBoundingClientRect(),c=n.querySelector('[data-action="clear-bank-selected"]').getBoundingClientRect(),m=n.querySelector('.bank-selection-menu > summary').getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,top:c.top,otherTop:m.top,both:n.contains(document.elementFromPoint(c.left+c.width/2,c.top+c.height/2))&&n.contains(document.elementFromPoint(m.left+m.width/2,m.top+m.height/2))};});
  check(geometry.left>=0&&geometry.right<=geometry.width&&Math.abs(geometry.top-geometry.otherTop)<1&&geometry.both,`${width}px: grouped selection actions are reachable and fit together (${JSON.stringify(geometry)})`);
  if(width===375)await captureSelectionGroup('group-selected-phone.png');
  await clearSelected.click();await clearSelected.waitFor({state:'hidden'});check(await page.locator('.bank-selection-menu > summary').isVisible(),`${width}px: selection menu remains available after clearing`);
 }
 // Ending an incomplete task never mutates stored questions or unrelated batch sessions.
 const sessionBefore=await page.evaluate(async()=>{const a=window.__reviewControlsQA,ids=a.state.questions.slice(0,2).map(q=>q.id);a.state.bank.selection=new Set(ids);a.state.manualQuestionTextBatch={sessionID:'OTHER-TEXT',targetQuestionIDs:[]};a.state.manualDraftSolutionBatch={sessionID:'OTHER-DRAFT',targetDraftIDs:[]};a.state.manualDiagramBatch={sessionID:'OTHER-DIAGRAM',targetDraftIDs:[]};a.state.manualSolutionBatch={sessionID:'FINISH-QA',batchSize:20,targetIDs:ids,requestedOperations:['classifyMetadata'],outcomes:{},batches:[],reviewItems:[],reviewBaselines:{}};a.manualWholeSelectionEnsureLedger(a.ensureManualSolutionBatchState());a.persistManualSolutionBatchSession();a.showManualWholeSelectionReview('generic');return {ids,records:await Promise.all(ids.map(id=>a.dbGet('questions',id)))};});
 for(const width of [320,375,768,1440]){
  await page.setViewportSize({width,height:width<400?568:900});await page.waitForTimeout(200);
  const footer=await page.locator('.ai-batch-tools-shell > .modal-footer,.ai-batch-tools-shell .ai-batch-tools-footer,.modal-footer').last().evaluate(n=>{const r=n.getBoundingClientRect(),buttons=[...n.querySelectorAll('button')].map(b=>b.getBoundingClientRect());return {width:innerWidth,height:innerHeight,scroll:n.scrollWidth-n.clientWidth,buttons:buttons.map(b=>({left:b.left,right:b.right,top:b.top,bottom:b.bottom})),top:r.top,bottom:r.bottom};});
  check(footer.scroll<=1&&footer.buttons.length>=3&&footer.buttons.every(b=>b.left>=0&&b.right<=footer.width&&b.top>=0&&b.bottom<=footer.height),`${width}px: review footer actions remain visible and fit (${JSON.stringify(footer)})`);
 }
 await page.locator('.batch-workspace-stages [data-stage="finish"]').click();await page.locator('[data-action="finish-manual-whole-review"]').click();check(await page.locator('[data-action="confirm-finish-manual-whole-review"]').isVisible(),'Incomplete reviews require explicit discard confirmation');
 await page.locator('[data-action="continue-manual-whole-review"]').click();check(await page.locator('.manual-whole-review').isVisible(),'Continue Reviewing returns to the unfinished task');
 await page.locator('.batch-workspace-stages [data-stage="finish"]').click();await page.locator('[data-action="finish-manual-whole-review"]').click();await page.locator('[data-action="confirm-finish-manual-whole-review"]').click();await page.locator('.modal-layer').waitFor({state:'detached'});
 const ended=await page.evaluate(async ids=>{const a=window.__reviewControlsQA;return {generic:a.ensureManualSolutionBatchState().sessionID,text:a.ensureManualQuestionTextBatchState().sessionID,draft:a.ensureManualDraftSolutionBatchState().sessionID,diagram:a.ensureManualDiagramBatchState().sessionID,selected:[...a.state.bank.selection],records:await Promise.all(ids.map(id=>a.dbGet('questions',id)))};},sessionBefore.ids);
 check(!ended.generic&&ended.text==='OTHER-TEXT'&&ended.draft==='OTHER-DRAFT'&&ended.diagram==='OTHER-DIAGRAM','Finish resets only the active reviewed task');check(JSON.stringify(ended.records)===JSON.stringify(sessionBefore.records)&&JSON.stringify(ended.selected)===JSON.stringify(sessionBefore.ids),'Finish keeps question data and Question Bank selection intact');
 await page.reload();await page.waitForFunction(()=>window.__reviewControlsQA?.state.questions.length);check(await page.evaluate(()=>!window.__reviewControlsQA.ensureManualSolutionBatchState().sessionID),'A finished task stays ended after reload');
 const touch=await browser.newPage({viewport:{width:375,height:700},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
 touch.on('pageerror',e=>errors.push(e.message));await touch.route('http://fe-review-controls.local/',r=>r.fulfill({contentType:'text/html',body:html}));await touch.goto('http://fe-review-controls.local/');await touch.waitForFunction(()=>window.__reviewControlsQA?.state.questions.length);
 await touch.evaluate(()=>{const a=window.__reviewControlsQA;a.state.section='bank';a.renderApp();});await touch.locator('.bank-advanced-filters > summary').tap();await touch.locator('[data-solution-indicator-help]').scrollIntoViewIfNeeded();await touch.locator('[data-solution-indicator-help]').tap();
 check(await touch.locator('#solution-indicator-help-popover').isVisible(),'Touch tapping the circled info icon opens the legend');
 await touch.locator('#solution-indicator-help-popover').tap({position:{x:20,y:20}});check(await touch.locator('#solution-indicator-help-popover').isVisible(),'Touch tapping inside keeps the pinned legend open');
 await touch.touchscreen.tap(5,5);await touch.locator('#solution-indicator-help-popover').waitFor({state:'detached'});check(true,'Touch tapping away closes the legend');await touch.close();
 check(!providerRequests.length,'Manual UI controls made zero AI provider requests');check(!errors.length,`No browser errors (${errors.join('; ')})`);
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({assertions:checks.length,checks,errors,providerRequests},null,2));console.log(`PASS: ${checks.length} review controls assertions. Evidence: ${output}`);
}catch(e){await page?.screenshot({path:path.join(output,'failure.png')});fs.writeFileSync(path.join(output,'failure-dom.json'),JSON.stringify(await page?.evaluate(()=>({viewport:{w:innerWidth,h:innerHeight},details:[...document.querySelectorAll('.bank-command-surface details')].map(n=>({class:n.className,open:n.open})),popover:document.querySelector('#solution-indicator-help-popover')?.outerHTML,info:document.querySelector('[data-solution-indicator-help]')?.outerHTML})),null,2));fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({message:e.message,checks,errors},null,2));throw e;}finally{await browser.close();}
