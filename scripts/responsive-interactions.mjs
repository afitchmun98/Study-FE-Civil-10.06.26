import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let checks=0;
const check=(ok,message)=>{checks++;if(!ok)throw new Error(message);};
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://fe-responsive.local/',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'index.html'),'utf8')}));
 await page.goto('http://fe-responsive.local/');
 await page.locator('.sidebar-nav [data-section="bank"]').click();
 const widths=[320,375,600,780,781,820,821,844,980,981,1024,1100,1101,1120,1130,1140,1250,1260,1270,1280,1370,1380,1390,1440,1480,1490,1500,1600,1700,1720,1740,1870,1880,1890,1920,2560];
 for(const width of widths){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(250);
  const size=await page.locator('.bank-command-surface').evaluate(n=>({width:n.clientWidth,overflow:n.scrollWidth-n.clientWidth,mode:getComputedStyle(n).overflowX,contentOverflow:document.querySelector('.content').scrollWidth-document.querySelector('.content').clientWidth}));
  check(size.overflow<3||['auto','scroll'].includes(size.mode),`${width}: clipped toolbar ${JSON.stringify(size)}`);
  check(size.contentOverflow<3,`${width}: content overflow ${JSON.stringify(size)}`);
 }
 await page.locator('.sidebar-collapse-toggle').click();
 await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().width<=66);
 for(const width of [821,1024,1280,1440,1920]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(250);
  const size=await page.locator('.bank-command-surface').evaluate(n=>({overflow:n.scrollWidth-n.clientWidth,mode:getComputedStyle(n).overflowX}));
  check(size.overflow<3||['auto','scroll'].includes(size.mode),`${width}: icon-rail toolbar clips ${JSON.stringify(size)}`);
 }
 await page.locator('.sidebar-collapse-toggle').click();
 await page.locator('.sidebar-nav [data-section="settings"]').click();
 await page.selectOption('[data-setting="appearance"]','light');
 await page.locator('.sidebar-nav [data-section="practice"]').click();
 for(const width of [320,375,768,1440,1920]){
  await page.setViewportSize({width,height:900});
  const slider=page.locator('[data-range="practice-min"]');
  await slider.focus();const before=Number(await slider.inputValue());
  await page.keyboard.press('ArrowRight');
  check(Number(await slider.inputValue())===before+1,`${width}: keyboard changes minimum difficulty`);
  const shown=await slider.evaluate(n=>Number(n.nextElementSibling.textContent));
  check(shown===before+1,`${width}: displayed difficulty follows slider`);
  const geometry=await page.locator('.practice-session-card .range-row').evaluate(n=>{
   const r=n.getBoundingClientRect();return [...n.children].every(c=>{const b=c.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1;});
  });
  check(geometry,`${width}: all difficulty controls remain within their row`);
  if([375,1440].includes(width))await page.locator('.practice-session-card').screenshot({path:`/private/tmp/fe-responsive-session-${width}.png`});
 }
 await page.screenshot({path:'/private/tmp/fe-responsive-light-practice.png'});
 check(errors.length===0,`Browser errors: ${errors.join('; ')}`);
 console.log(`PASS: ${checks} responsive interaction assertions (${widths.length} toolbar widths, icon rail, light theme, keyboard sliders)`);
} finally {await browser.close();}
