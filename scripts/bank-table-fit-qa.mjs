import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=process.env.TABLE_QA_SOURCE||path.join(root,'index.html');
const original=fs.readFileSync(source,'utf8');
const html=original.replace('  state.activityRecords = function() {','  window.__tableFit={state,renderApp};\n  state.activityRecords = function() {');
if(html===original)throw new Error('Could not install isolated table test fixture');
const output=process.env.TABLE_QA_OUTPUT||path.join(os.tmpdir(),'fe-bank-table-fit-qa');fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const records=[],errors=[];let assertions=0;
const check=(ok,label)=>{assertions++;if(!ok)throw new Error(label);};
try {
 const page=await browser.newPage({viewport:{width:1920,height:1000},reducedMotion:'reduce',colorScheme:'dark'});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://fe-table-fit.local/',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://fe-table-fit.local/');await page.locator('.sidebar-nav [data-section="bank"]').click();await page.waitForTimeout(350);
 await page.evaluate(()=>{
  const api=window.__tableFit,seed=api.state.questions;
  api.state.questions=Array.from({length:45},(_,i)=>({...structuredClone(seed[i%seed.length]),id:`QUESTIONIDENTIFIERWITHOUTSPACES-CIVIL-${String(i).padStart(3,'0')}`,topic:i%2?'Water Resources and Environmental Engineering':seed[i%seed.length].topic}));api.renderApp();
 });
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const capture=async filename=>{await page.waitForFunction(()=>!document.querySelector('#app')?.classList.contains('math-pending'));await page.evaluate(()=>document.fonts.ready);await settle();await page.screenshot({path:path.join(output,filename),animations:'disabled'});};
 const metrics=()=>page.locator('.bank-list').evaluate(n=>{
  const table=n.querySelector('.bank-table'),r=n.getBoundingClientRect(),right=r.left+n.clientWidth;
  const headerIssues=[...table.querySelectorAll('th button')].flatMap(b=>{const cell=b.closest('th').getBoundingClientRect(),box=b.getBoundingClientRect();return box.left<cell.left-1||box.right>cell.right+1?[{label:b.textContent,cellWidth:cell.width,buttonWidth:box.width,overflow:box.right-cell.right}]:[];});
  const c=table.querySelector('tbody input[type="checkbox"]'),cb=c.getBoundingClientRect(),cell=c.closest('td').getBoundingClientRect();
  const last=table.querySelector('th:last-child button').getBoundingClientRect();
  return {width:n.clientWidth,tableWidth:table.getBoundingClientRect().width,scrollWidth:n.scrollWidth,scrollLeft:n.scrollLeft,headerIssues,checkboxFitsCell:cb.left>=cell.left-1&&cb.right<=cell.right+1,checkboxVisible:cb.left>=r.left-1&&cb.right<=right+1,checkboxClickable:document.elementFromPoint(cb.left+cb.width/2,cb.top+cb.height/2)===c,solutionRight:last.right,paneRight:right,documentOverflow:document.querySelector('.content').scrollWidth-document.querySelector('.content').clientWidth,verticalScrollbar:n.scrollHeight>n.clientHeight};
 });
 const validate=async name=>{
  await settle();const m=await metrics();records.push({name,...m});
  check(!m.headerIssues.length,`${name}: header exceeds its column ${JSON.stringify(m.headerIssues)}`);
  check(m.checkboxFitsCell,`${name}: checkbox exceeds selection cell`);
  check(m.checkboxVisible&&m.checkboxClickable,`${name}: checkbox is clipped or cannot be clicked`);
  check(m.documentOverflow<2,`${name}: table escapes the overall content area`);
  check(m.solutionRight<=m.paneRight+1,`${name}: Solution header is clipped at the right edge`);
  if(m.width>=640){check(m.scrollWidth-m.width<=1,`${name}: table unnecessarily overflows an adequately wide pane`);}
  if(m.scrollLeft>=m.scrollWidth-m.width-1)check(m.solutionRight<=m.paneRight+1,`${name}: last column cannot be reached by scrolling`);
  return m;
 };
 // This wide-pane case catches the original undersized Solution header before
 // resize, mobile, or scrollbar checks can mask the defect.
 await validate('default wide pane');
 for(const width of [1024,1280,1440,1920,2560]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(350);
  for(const requested of [280,440,600,640,720,900,1200]){
   const layout=await page.locator('.bank-layout').boundingBox(),divider=await page.locator('.bank-pane-divider').boundingBox();
   await page.mouse.move(divider.x+5,divider.y+80);await page.mouse.down();await page.mouse.move(layout.x+requested+5,divider.y+80,{steps:3});await page.mouse.up();
   await page.locator('.bank-list').evaluate(n=>n.scrollLeft=0);const start=await validate(`${width}px / ${requested}px requested / start`);
   check(start.verticalScrollbar,`${width}px: fixture exercises real vertical scrollbar geometry`);
   await page.locator('.bank-list').evaluate(n=>n.scrollLeft=100000);await validate(`${width}px / ${requested}px requested / end`);
   if(width===1920&&requested===900){await page.locator('.bank-list').evaluate(n=>n.scrollLeft=0);await capture('1920-table-fits.png');}
  }
 }
 // Sorting and selecting must work with the list horizontally scrolled.
 await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(350);await page.locator('.bank-pane-divider').focus();await page.keyboard.press('Home');await settle();
 await page.locator('.bank-list').evaluate(n=>n.scrollLeft=100000);await validate('narrow pane / sorted access');
 await page.locator('.bank-list th:last-child button').click();await settle();await validate('after Solution sort');
 const checkbox=page.locator('.bank-list tbody input[type="checkbox"]').first();await checkbox.check();check(await checkbox.isChecked(),'selection works while horizontally scrolled');
 await capture('narrow-table-scrolled.png');
 for(const width of [320,375,768,980]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(350);
  await page.locator('.bank-list').evaluate(n=>{n.scrollTop=0;n.scrollLeft=0;});await validate(`${width}px stacked / start`);
  await page.locator('.bank-list').evaluate(n=>n.scrollLeft=100000);await validate(`${width}px stacked / end`);
 }
 await page.setViewportSize({width:1920,height:900});await page.waitForTimeout(350);
 await page.locator('.sidebar-nav [data-section="settings"]').click();await page.selectOption('[data-setting="appearance"]','light');await page.locator('.sidebar-nav [data-section="bank"]').click();await page.waitForTimeout(350);
 await page.locator('.bank-pane-divider').focus();await page.keyboard.press('Enter');await page.locator('.bank-list').evaluate(n=>n.scrollLeft=0);await validate('light theme / default split');await capture('1920-table-light.png');
 await page.close();
 // Model desktop browser zoom using its reduced CSS viewport and increased
 // pixel density. This is zoom-equivalent geometry, not a browser UI setting.
 for(const zoom of [1,1.25,1.5,1.75,2]){
  const zoomPage=await browser.newPage({viewport:{width:Math.floor(1920/zoom),height:Math.floor(1080/zoom)},deviceScaleFactor:zoom,reducedMotion:'reduce',colorScheme:'dark'});
  zoomPage.on('pageerror',e=>errors.push(e.message));await zoomPage.route('http://fe-table-zoom.local/',r=>r.fulfill({contentType:'text/html',body:original}));await zoomPage.goto('http://fe-table-zoom.local/');
  if(await zoomPage.locator('.mobile-bar').isVisible())await zoomPage.locator('.mobile-bar [data-action="toggle-mobile-sidebar"]').click();await zoomPage.locator('.sidebar-nav [data-section="bank"]').click();await zoomPage.waitForTimeout(350);
  const result=await zoomPage.locator('.bank-list').evaluate(n=>{
   const r=n.getBoundingClientRect(),table=n.querySelector('.bank-table'),c=table.querySelector('tbody input[type="checkbox"]'),b=c.getBoundingClientRect();
   return {overflow:document.querySelector('.content').scrollWidth-document.querySelector('.content').clientWidth,checkbox:b.left>=r.left&&b.right<=r.left+n.clientWidth,headers:[...table.querySelectorAll('th button')].every(n=>n.getBoundingClientRect().right<=n.closest('th').getBoundingClientRect().right+1)};
  });check(result.overflow<2&&result.checkbox&&result.headers,`${zoom*100}% zoom-equivalent viewport contains controls`);
  await zoomPage.waitForFunction(()=>!document.querySelector('#app')?.classList.contains('math-pending'));await zoomPage.screenshot({path:path.join(output,`zoom-equivalent-${zoom*100}.png`),animations:'disabled'});await zoomPage.close();
 }
 check(errors.length===0,`browser exceptions: ${errors.join('; ')}`);
 console.log(`PASS: ${assertions} table containment/accessibility checks; ${records.length} pane states; five zoom-equivalent viewport/density settings`);
}finally{fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({assertions,records,errors},null,2));await browser.close();}
