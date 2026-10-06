import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('playwright'),{PNG}=require('pngjs');
const pixelmatchModule=require('pixelmatch'),pixelmatch=pixelmatchModule.default||pixelmatchModule;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseline=path.join(root,'tests','visual-baselines','chromium');
const output=process.env.VISUAL_QA_OUTPUT||path.join(os.tmpdir(),'fe-visual-regression');
const update=process.env.UPDATE_VISUALS==='1';fs.mkdirSync(output,{recursive:true});if(update)fs.mkdirSync(baseline,{recursive:true});
const updateNames=new Set((process.env.UPDATE_VISUAL_NAMES||'').split(',').filter(Boolean));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[];
try{
 for(const width of [375,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900},colorScheme:'dark',reducedMotion:'reduce',locale:'en-US',timezoneId:'UTC'});
  await page.route('http://fe-visual.local/',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'index.html'),'utf8')}));
  await page.goto('http://fe-visual.local/');await page.locator('.sidebar-nav').waitFor();
  // Match the baseline's overlay-scrollbar geometry, independent of macOS's
  // "Show scroll bars" preference. Native scrolling is tested by other suites.
  await page.addStyleTag({content:'* { scrollbar-width:none !important; }'});
  const nav=async section=>{if(await page.locator('.mobile-bar').isVisible())await page.locator('.mobile-bar [data-action="toggle-mobile-sidebar"]').click();await page.locator(`.sidebar-nav [data-section="${section}"]`).click();};
  const capture=async name=>{
   await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
   const filename=`${width}-${name}.png`,actual=await page.screenshot({animations:'disabled',caret:'hide',mask:[page.locator('.brand-version')]});
   fs.writeFileSync(path.join(output,filename),actual);
   if(update&&(!updateNames.size||updateNames.has(name))){fs.writeFileSync(path.join(baseline,filename),actual);results.push({filename,updated:true});return;}
   const expectedPath=path.join(baseline,filename);if(!fs.existsSync(expectedPath))throw new Error(`Missing visual baseline: ${filename}. Review screenshots before UPDATE_VISUALS=1.`);
   const a=PNG.sync.read(actual),b=PNG.sync.read(fs.readFileSync(expectedPath));
   if(a.width!==b.width||a.height!==b.height){results.push({filename,failed:true,reason:'Screenshot dimensions changed'});return;}
   const diff=new PNG({width:a.width,height:a.height});
   const changed=pixelmatch(a.data,b.data,diff.data,a.width,a.height,{threshold:0.12}),ratio=changed/(a.width*a.height),failed=ratio>0.003;
   if(failed)fs.writeFileSync(path.join(output,filename.replace('.png','-diff.png')),PNG.sync.write(diff));
   results.push({filename,changedPixels:changed,ratio,failed});
  };
  await nav('practice');
  if(process.env.VISUAL_QA_INJECT_REGRESSION==='1')await page.addStyleTag({content:'.practice-session-card{transform:translateX(80px)!important}'});
  await capture('practice');await page.locator('.practice-session-card').scrollIntoViewIfNeeded();await capture('session-setup');
  await page.locator('[data-practice="incorrectOnly"]').check();await page.locator('#practice-match-summary').scrollIntoViewIfNeeded();await capture('no-matches');
  await nav('bank');await page.locator('#bank-search').fill('Statics');await page.locator('#bank-search').press('Enter');await capture('active-filters');
  await page.close();
 }
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({update,results},null,2));
 const failed=results.filter(r=>r.failed);console.log(`${failed.length?'FAIL':'PASS'}: ${results.length-failed.length}/${results.length} visual snapshots${update?' (baselines recorded for review)':''}`);
 if(failed.length){console.log(JSON.stringify(failed,null,2));process.exitCode=1;}
}finally{await browser.close();}
