import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceSHA256=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'index.html'))).digest('hex');
const phase=process.env.LOCAL_METADATA_PHASE||'baseline',output=path.join(root,'docs/LOCAL_METADATA_QA',phase);fs.mkdirSync(output,{recursive:true});
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace('  async function initialize() {','  window.__localQA={state,dbPut,dbGet,selectiveMetadataOpen,selectiveMetadataFreezeRequest,selectiveMetadataPrompt,selectiveMetadataJSONSchema,selectiveMetadataParseResponse,classificationSubtopicOptions,questionMetadataClassificationPrompt,QUESTION_CLASSIFICATION_JSON_SCHEMA,classifyQuestionMetadata,apiBatchReview,apiBatchExecute,apiBatchReviewReady,apiBatchResolve,apiBatchOperationKeys,apiBatchContentIdentity,aiConfig,callAI};\n  async function initialize() {');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const calls=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
   const req=route.request(),url=req.url();
   if(url==='http://fe-local-metadata.test/')return route.fulfill({contentType:'text/html',body:html});
   if(url.startsWith('http://192.168.1.72:1234/')&&req.method()==='POST'){
     const body=req.postDataJSON(),started=performance.now();
     const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(240000)}),text=await response.text();
     const record={durationMilliseconds:Math.round(performance.now()-started),status:response.status,request:body,response:JSON.parse(text)};calls.push(record);fs.writeFileSync(path.join(output,'calls.json'),JSON.stringify(calls,null,2));
     return route.fulfill({status:response.status,contentType:'application/json',body:text});
   }
   return route.abort();
 });
 await page.goto('http://fe-local-metadata.test/');await page.waitForFunction(()=>window.__localQA?.state.questions.length);
 await page.evaluate(async()=>{
   const qa=window.__localQA;await qa.apiBatchReviewReady;
   qa.state.settings.aiProvider='local';qa.state.settings.localAIProtocol='openai';qa.state.settings.localAIEndpoint='http://192.168.1.72:1234';qa.state.settings.localAIModel='google/gemma-4-12b-qat';qa.state.settings.localAISupportModel='google/gemma-4-e2b';qa.state.settings.localAIMaxOutputTokens=7168;qa.state.settings.localAIDisableThinking=false;
   const q={...structuredClone(qa.state.questions[0]),id:'LOCAL-PERF-1',question:'The following test scores have been collected: 85, 87, 95, 90, 85, 88, 90, 90, and 91. Which of the following statements is true?',choices:['The median and the mode are equal.','The mean and the median are equal.','The mean and the mode are equal.','The mean, median, and mode are equal.'],answerIndex:0,answerLetter:'A',topic:'Mathematics and Statistics',subtopic:'Statistics',difficultyScore:42,difficultyReason:'Compute central tendencies.',tags:[],solution:'',hint:'',equations:[],diagramTextAlternative:'',additionalMetadata:{},generationMetadata:{}};
   await qa.dbPut('questions',q);qa.state.questions=[q];qa.selectiveMetadataOpen(q.id,'bank');window.__before=JSON.stringify(await qa.dbGet('questions',q.id));
 });
 for(const control of await page.locator('[data-selective-metadata-group]').all())await control.check();
 if(phase==='optimized-batch'){
   await page.evaluate(()=>{const qa=window.__localQA;window.__bulk=Array.from({length:10},(_,n)=>({...structuredClone(qa.state.questions[0]),id:'LOCAL-PERF-'+(n+1),question:'For sample '+(n+1)+', scores are '+(75+n)+', '+(79+n)+', '+(85+n)+', '+(79+n)+', '+(80+n)+'. Which statistic represents the most frequent score?',choices:['Mean','Median','Mode','Range']}));});
   await page.evaluate(async()=>{const qa=window.__localQA;qa.state.questions=window.__bulk;for(const q of window.__bulk)await qa.dbPut('questions',q);const config={scope:'selected',selectedQuestionIDs:window.__bulk.map(q=>q.id),selectiveMetadata:true,selectiveMetadataGroups:['topic','subtopic','difficulty','questionType','tags']};const run={schemaVersion:1,runID:'LOCAL-LIVE-BULK',config,delaySeconds:0,reviewIndex:0,status:'active',items:window.__bulk.map(q=>({questionId:q.id,status:'queued',retrySelected:true}))};qa.apiBatchReview.run=run;await qa.apiBatchExecute(run,run.items);});
   const result=await page.evaluate(()=>({diagnostics:window.FE_LOCAL_AI_DIAGNOSTICS.records(),status:window.__localQA.apiBatchReview.run.status,items:window.__localQA.apiBatchReview.run.items.map(i=>({id:i.questionId,status:i.status,error:i.error,proposed:i.proposed?.additionalMetadata?.questionClassification}))}));
   result.sourceSHA256=sourceSHA256;result.requests=calls.length;result.errors=errors;fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({phase,requests:calls.length,status:result.status,statuses:result.items.map(i=>i.status),usage:calls.map(c=>c.response.usage),durations:calls.map(c=>c.durationMilliseconds),errors}));if(result.status!=='completed'||!result.items.every(i=>['pending','unchanged'].includes(i.status))||errors.length)process.exitCode=1;await browser.close();process.exit(process.exitCode||0);
 }
 const started=performance.now();await page.locator('[data-action=selective-metadata-api]').click();
 await page.waitForFunction(()=>document.querySelector('[data-action=selective-metadata-apply]')||document.querySelector('.toast.error'),null,{timeout:260000});
 const staged=await page.locator('[data-action=selective-metadata-apply]').count();
 if(staged){await page.locator('[data-action=selective-metadata-apply]').click();await page.waitForTimeout(250);}
 const result=await page.evaluate(async()=>({diagnostics:window.FE_LOCAL_AI_DIAGNOSTICS.records(),saved:await window.__localQA.dbGet('questions','LOCAL-PERF-1')}));
 result.sourceSHA256=sourceSHA256;result.phase=phase;result.durationMilliseconds=Math.round(performance.now()-started);result.requests=calls.length;result.staged=Boolean(staged);result.errors=errors;
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({phase,requests:calls.length,durationMilliseconds:result.durationMilliseconds,staged:result.staged,usage:calls.map(c=>c.response.usage),errors}));
 if(!result.staged||errors.length)process.exitCode=1;
}finally{await browser.close();}
