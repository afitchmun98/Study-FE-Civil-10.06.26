import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Exercise the real mounted controls at each size, then restore the ongoing
// functional test. No application fixtures or business rules are changed here.
const enabled=process.env.BATCH_LAYOUT_AUDIT==='1',records=[];
const suite=path.basename(process.argv[1],'.mjs');
const output=process.env.BATCH_LAYOUT_OUTPUT||path.join(os.tmpdir(),'fe-batch-layout-audit');
const sizes=[[1440,1000],[1024,768],[768,1024],[375,812],[320,568],[844,390]];
export async function auditBatchLayout(page,view){
 if(!enabled)return;
 fs.mkdirSync(output,{recursive:true});
 const previous=page.viewportSize(),scroll=await page.locator('.modal-body').evaluate(n=>n.scrollTop);
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const geometry=await page.locator('.modal-layer').evaluate(layer=>{
   const modal=layer.querySelector('.modal'),body=layer.querySelector('.modal-body'),footer=layer.querySelector('.modal-footer');
   const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&Number(getComputedStyle(e).opacity)>0;
   const controls=[...layer.querySelectorAll('button,select,textarea,input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])')].filter(visible);
   const issues=[];
   const questionRows=[...layer.querySelectorAll('.batch-workspace-question-row')].filter(visible).map(row=>({id:row.querySelector('.manual-batch-shared-item-id').getBoundingClientRect().left,number:row.querySelector('.manual-batch-shared-item-index').getBoundingClientRect().left,preview:row.querySelector('.manual-solution-question-title').getBoundingClientRect().left}));
   if(questionRows.some(row=>Math.abs(row.id-row.preview)>1||Math.abs(row.id-questionRows[0].id)>1||Math.abs(row.number-questionRows[0].number)>1))issues.push({type:'question columns misaligned',rows:questionRows.slice(0,3)});
   for(const e of controls){const a=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();if(a.left<p.left-2||a.right>p.right+2)issues.push({type:'control containment',text:e.textContent.trim().slice(0,65)||e.id,parent:e.parentElement.className,overflow:Math.max(p.left-a.left,a.right-p.right)});}
   for(const e of layer.querySelectorAll('.manual-whole-review-retry-checkboxes .pill')){if(!visible(e))continue;const a=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();if(a.width<48&&e.textContent.trim().length>5||a.left<p.left-2||a.right>p.right+2)issues.push({type:'retry status label squeezed or overflowing',text:e.textContent.trim(),width:a.width});}
   // Offscreen controls in a scrolling body still have client rectangles.
   // Compare only their painted portions after ancestor overflow clipping.
   const painted=e=>{const r=e.getBoundingClientRect(),a={left:Math.max(0,r.left),right:Math.min(innerWidth,r.right),top:Math.max(0,r.top),bottom:Math.min(innerHeight,r.bottom)};for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(s.overflowX!=='visible'){a.left=Math.max(a.left,b.left);a.right=Math.min(a.right,b.right);}if(s.overflowY!=='visible'){a.top=Math.max(a.top,b.top);a.bottom=Math.min(a.bottom,b.bottom);}}return a.right>a.left&&a.bottom>a.top?a:null;};
   const buttons=controls.filter(e=>e.tagName==='BUTTON').map(e=>({element:e,rect:painted(e)})).filter(e=>e.rect);
   for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){const a=buttons[i].rect,b=buttons[j].rect;if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)issues.push({type:'buttons overlap',a:buttons[i].element.textContent.trim(),b:buttons[j].element.textContent.trim()});}
   const pairs=[...layer.querySelectorAll('.batch-workspace-navigation-pair')].map(n=>{const [a,b]=[...n.querySelectorAll('button')].map(e=>e.getBoundingClientRect());return {sameLine:Math.abs(a.top-b.top)<2,gap:b.left-a.right};});
   if(pairs.some(p=>!p.sameLine||p.gap<0||p.gap>12))issues.push({type:'separated navigation',pairs});
   const bounds=modal.getBoundingClientRect();if(bounds.left<-1||bounds.right>innerWidth+1||body.scrollWidth-body.clientWidth>2)issues.push({type:'dialog overflow'});
   if(body.clientHeight<100)issues.push({type:'footer crowds content',bodyHeight:body.clientHeight,footerHeight:footer?.clientHeight});
   return {issues,controls:controls.length,bodyHeight:body.clientHeight,footerHeight:footer?.clientHeight,pairs};
  });
  records.push({view,width,height,...geometry});
  if(width===1440||width===375){await page.locator('.modal-body').evaluate(n=>n.scrollTop=0);await page.screenshot({path:path.join(output,`${suite}-${view}-${width}.png`),animations:'disabled'});}
 }
 await page.setViewportSize(previous);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await page.locator('.modal-body').evaluate((n,top)=>n.scrollTop=top,scroll);
 fs.writeFileSync(path.join(output,suite+'.json'),JSON.stringify(records,null,2));
}
export function finishBatchLayoutAudit(){
 if(!enabled)return;
 const failures=records.filter(r=>r.issues.length);
 console.log(`Batch layout: ${records.length} states; ${failures.length} with layout issues. Evidence: ${output}`);
 if(failures.length&&process.env.BATCH_LAYOUT_REPORT_ONLY!=='1')throw new Error('Batch layout defects: '+JSON.stringify(failures.slice(0,3)));
}
