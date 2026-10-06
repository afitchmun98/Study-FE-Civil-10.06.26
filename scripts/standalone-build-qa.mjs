import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// The GitHub handoff is self-contained: index.html is its standalone artifact.
const standalone=path.join(root,'index.html');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
if(hash(standalone)!==hash(path.join(root,'index.html'))||hash(standalone)!==hash(path.join(root,'dist/index.html')))throw new Error('Build artifacts differ');
const require=createRequire(import.meta.url),{chromium}=require('playwright'),browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const output=process.env.STANDALONE_QA_OUTPUT||path.join(root,'docs/API_BATCH_REVIEW_QA/standalone');fs.mkdirSync(output,{recursive:true});
const checks=[],errors=[],requests=[];const check=(ok,message)=>{checks.push({message,passed:!!ok});if(!ok)throw new Error(message);};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/api\.openai\.com|generativelanguage\.googleapis\.com/.test(r.url()))requests.push(r.url());});
 await page.goto(pathToFileURL(standalone).href,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Question Bank',exact:true}).click();
 check(await page.locator('.bank-table tbody tr').count()>0,'Downloaded standalone boots with bundled questions');
 await page.locator('.bank-selection-menu > summary').click();await page.locator('[data-action="select-every-bank-question"]').click();
 await page.locator('.bank-tools-menu > summary').click();await page.getByRole('button',{name:'AI Batch Tools…',exact:true}).click();
 await page.getByRole('tab',{name:'Manual Copy/Paste',exact:true}).click();await page.locator('#manual-batch-operation').selectOption('metadata');
 check(await page.locator('.batch-workspace-shell').isVisible(),'Standalone shows the new real batch workspace');
 check(await page.locator('#manual-batch-operation option').count()===9,'Standalone retains all nine task families');
 await page.locator('#manual-solution-batch-size').fill('20');await page.locator('#manual-solution-batch-size').press('Tab');await page.locator('[data-action="copy-manual-solution-batch-prompt"]').click();
 await page.locator('.manual-batch-shared-items-region').waitFor();
 check(!await page.locator('.manual-batch-shared-items-region').evaluate(n=>n.open),'Standalone question list starts collapsed with the paste editor below');
 check(await page.locator('#manual-solution-batch-results').isVisible()&&await page.locator('#manual-solution-batch-results').count()===1,'Standalone has one inline response editor');
 for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.screenshot({path:path.join(output,theme+'-inline-paste.png')});}
 await page.getByRole('button',{name:'Go to paste',exact:true}).click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(output,'dark-inline-workflow.png')});
 await page.locator('.modal-body').evaluate(n=>n.scrollTop=0);
 await page.locator('.manual-batch-shared-items-region > summary').click();
 check(await page.locator('.manual-batch-shared-item-entry').count()===5,'Standalone freezes and displays the five available questions within a 20-question limit');
 await page.screenshot({path:path.join(output,'standalone-batches.png')});
 for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.screenshot({path:path.join(output,theme+'-batches.png')});}
 await page.locator('.modal-header [data-action="close-modal"]').click();await page.locator('.modal-layer').waitFor({state:'detached'});
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Question Bank',exact:true}).click();await page.locator('.bank-tools-menu > summary').click();await page.getByRole('button',{name:'AI Batch Tools…',exact:true}).click();await page.getByRole('tab',{name:'Manual Copy/Paste',exact:true}).click();
 check(await page.locator('.manual-batch-shared-item-entry').count()===5,'The actual file build resumes the same batch after reload');
 await page.getByRole('tab',{name:'API Batch',exact:true}).click();
 check(await page.locator('#api-batch-delay').isVisible()&&await page.locator('[data-batch-operation]').count()===12,'Standalone exposes request pacing and all 12 API operations');
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const header=await page.locator('.modal-header').evaluate(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,scroll:n.parentElement.scrollTop};});
 check(header.top>=0&&header.bottom<=1000,`API header remains onscreen after switching from manual (${JSON.stringify(header)})`);
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 await page.screenshot({path:path.join(output,'dark-api-setup.png')});
 check(errors.length===0,'Standalone has no uncaught browser errors');check(requests.length===0,'Standalone smoke test made no provider requests');
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:true,checks,errors,requests,sha256:hash(standalone)},null,2));console.log(`PASS: ${checks.length} standalone checks; source/dist/standalone match.`);
}finally{await browser.close();}
