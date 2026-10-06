import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output=process.env.LOCAL_METADATA_QA_OUTPUT||path.join(os.tmpdir(),'fe-local-metadata-qa');fs.mkdirSync(output,{recursive:true});
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace('  async function initialize() {','  window.__localQA={state,dbPut,dbGet,selectiveMetadataOpen,selectiveMetadataFreezeRequest,selectiveMetadataParseResponse,selectiveMetadataPrompt,selectiveMetadataJSONSchema,selectiveMetadataBatchRunQuestion,classificationSubtopicOptions,questionMetadataClassificationPrompt,classifyQuestionMetadata,apiBatchReview,apiBatchExecute,apiBatchReviewReady,apiBatchResolve,apiBatchOperationKeys,apiBatchResumeWork,apiBatchShow,apiBatchRetry,apiBatchReviewPersist,apiBatchCurrent,aiConfig,callAI,localMetadataSelective,localMetadataConnectionTest,localMetadataCompatibility,closeModal,showBatchSolutions,localAITraceState};\n  async function initialize() {');
const checks=[],errors=[],calls=[];let mode='normal',failOnce=true,held=null,release=null;
const check=(value,name)=>{checks.push({name,passed:Boolean(value)});if(!value)throw new Error(name);};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
   const request=route.request(),url=request.url();
   if(url==='http://fe-local-metadata.test/')return route.fulfill({contentType:'text/html',body:html});
   if(request.method()!=='POST')return route.abort();
   const body=request.postDataJSON(),prompt=body.messages?.[0]?.content||body.input||body.contents?.[0]?.parts?.[0]?.text||body.prompt||'';
   const record={url,body,prompt,at:Date.now()};calls.push(record);
   if(held){held();held=null;await new Promise(resolve=>release=resolve);}
   if(mode==='unauthorized')return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{message:'Invalid local credential'}})});
   if(mode==='server-error')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Server temporarily unavailable'}})});
   if(mode==='thinking-unsupported'&&body.reasoning_effort)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:{message:'Unsupported reasoning_effort parameter'}})});
   if(mode==='partial-access'&&body.model==='test-support')return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{message:'Invalid support credential'}})});
   if(mode==='schema-unsupported'&&body.response_format?.type==='json_schema')return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:{message:'Unsupported response_format json_schema'}})});
   const responseFor=row=>({schemaVersion:'1.0',questionId:row.questionId,requestFingerprint:row.requestFingerprint,requestedGroups:body.response_format?.json_schema?.schema?.properties?.requestedGroups?.items?.enum||['topic','subtopic','difficulty','questionType','tags'],metadata:{}});
   let value;
   if(prompt.includes('Requests: ')){
     const list=JSON.parse(prompt.split('Requests: ')[1].split('\n')[0]),groups=JSON.parse(prompt.match(/Return every selected group and no others: (\[[^\n]+?\])\./)[1]);
     const results=list.map(row=>{const value=responseFor(row);value.requestedGroups=groups;for(const group of groups){if(group==='topic')value.metadata.topic='Mathematics and Statistics';if(group==='subtopic')value.metadata.subtopic='Statistics';if(group==='difficulty')value.metadata.difficulty={difficultyScore:52,difficultyReason:'Interpret central tendencies.'};if(group==='questionType')value.metadata.questionType='computational';if(group==='tags')value.metadata.tags=['central tendencies'];}return value;});
     if(mode==='reverse')results.reverse();
     if(mode==='duplicate'&&results.length>1)results[1]=results[0];
     if(mode==='wrong-id')results[0].questionId='UNKNOWN-ID';
     if(mode==='wrong-fingerprint')results[0].requestFingerprint='WRONG';
     if(['semantic-once','partial-access','partial-held'].includes(mode)&&failOnce){results[0].metadata.subtopic='Not an official subtopic';failOnce=false;}
     if(mode==='missing-once'&&failOnce){results.pop();failOnce=false;}
     value=list.length>1?{results}:results[0];
   }else if(prompt.includes('FROZEN SELECTIVE REQUEST:')){
     const frozen=JSON.parse(prompt.split('FROZEN SELECTIVE REQUEST:\n')[1].split('\n\nREQUIRED RESPONSE')[0]);value={schemaVersion:'1.0',questionId:frozen.questionId,requestFingerprint:frozen.requestFingerprint,requestedGroups:frozen.requestedGroups,metadata:{topic:'Mathematics and Statistics',subtopic:'Statistics'}};
   }else if(prompt.includes('connected'))value={connected:true};
   else value={topic:'Mathematics and Statistics',subtopic:'Statistics',questionType:'computational',difficultyScore:52,difficultyReason:'Interpret central tendencies.',unitSystem:'Unitless / Not applicable',tags:['statistics'],confidence:'high'};
   let text=JSON.stringify(value);
   if(mode==='malformed-once'&&failOnce){text='{not JSON';failOnce=false;}
   if(mode==='malformed-always')text='{not JSON';
   if(mode==='fenced')text='```json\n'+text+'\n```';
   if(mode==='trailing-comma')text=text.replace(/}$/,',}');
   if(mode==='prose')text='Here is your result:\n'+text;
   if(mode==='reasoning-only')return route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:'',reasoning_content:'Private scratch notes.'},finish_reason:'length'}],usage:{prompt_tokens:900,completion_tokens:512,completion_tokens_details:{reasoning_tokens:512}}})});
   if(url.includes('generativelanguage'))return route.fulfill({contentType:'application/json',body:JSON.stringify({candidates:[{content:{parts:[{text}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:100}})});
   if(url.includes('api.openai.com'))return route.fulfill({contentType:'application/json',body:JSON.stringify({output:[{content:[{type:'output_text',text}]}],usage:{input_tokens:100,output_tokens:100}})});
   return route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:text,reasoning_content:''},finish_reason:'stop'}],usage:{prompt_tokens:900,completion_tokens:180,completion_tokens_details:{reasoning_tokens:0}}})});
 });
 await page.goto('http://fe-local-metadata.test/');await page.waitForFunction(()=>window.__localQA?.state.questions.length);await page.evaluate(()=>window.__localQA.apiBatchReviewReady);
 await page.evaluate(()=>{
   const qa=window.__localQA;window.__seed=structuredClone(qa.state.questions[0]);
   window.__makeQuestion=(n)=>({...structuredClone(window.__seed),id:'LOCAL-QA-'+n,question:'Which statement about these test scores is true? 85, 87, 95, 90, 85, 88, 90, 90, 91.',choices:['Median equals mode.','Mean equals median.','Mean equals mode.','All are equal.'],answerIndex:0,answerLetter:'A',topic:'Mathematics and Statistics',subtopic:'Statistics',difficultyScore:42,difficultyReason:'Old reason.',solution:'DO NOT SEND THIS SOLUTION',hint:'DO NOT SEND THIS HINT',equations:['DO NOT SEND THIS EQUATION'],tags:[],diagramTextAlternative:'',additionalMetadata:{},generationMetadata:{}});
   window.__setupLocal=async(count=1)=>{
     qa.state.batchCancelled=false;qa.state.individualAICancelled=false;qa.state.batchCancelRequested=false;qa.state.batchSkipCurrent=false;qa.localMetadataCompatibility.clear();window.FE_LOCAL_AI_DIAGNOSTICS.clear();
     qa.state.settings.aiProvider='local';qa.state.settings.localAIProtocol='openai';qa.state.settings.localAIEndpoint='http://localhost:1234';qa.state.settings.localAIModel='google/gemma-4-12b-qat';qa.state.settings.localAISupportModel='test-support';qa.state.settings.localAIMaxOutputTokens=7168;qa.state.settings.localAIDisableThinking=false;
     await new Promise((resolve,reject)=>{const tx=qa.state.db.transaction('questions','readwrite');tx.objectStore('questions').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
     qa.state.questions=Array.from({length:count},(_,n)=>window.__makeQuestion(n+1));for(const q of qa.state.questions)await qa.dbPut('questions',q);
     window.__savedBefore=JSON.stringify(await Promise.all(qa.state.questions.map(q=>qa.dbGet('questions',q.id))));
   };
   window.__singleLocal=()=>{const q=qa.state.questions[0],f=qa.selectiveMetadataFreezeRequest(q,['topic','subtopic','difficulty','questionType','tags']);return qa.localMetadataSelective(q,f,qa.aiConfig());};
   window.__runLocal=async(count=20,long=false,requestSize)=>{
     await window.__setupLocal(count);
     if(long){for(const q of qa.state.questions){q.diagramTextAlternative='Given chart context '.repeat(700);await qa.dbPut('questions',q);}}
     const config={scope:'selected',localMetadataBatchSize:requestSize,selectedQuestionIDs:qa.state.questions.map(q=>q.id),selectiveMetadata:true,selectiveMetadataGroups:['topic','subtopic','difficulty','questionType','tags']};
     const run={schemaVersion:1,runID:'LOCAL-RUN-'+Date.now(),config,delaySeconds:0,reviewIndex:0,status:'active',items:qa.state.questions.map(q=>({questionId:q.id,status:'queued',retrySelected:true}))};qa.apiBatchReview.run=run;return qa.apiBatchExecute(run,run.items);
   };
 });
 const setup=async(count=1)=>{calls.length=0;failOnce=true;mode='normal';await page.evaluate(n=>window.__setupLocal(n),count);};
 const single=()=>page.evaluate(()=>window.__singleLocal());
 await setup();await page.evaluate(()=>window.__localQA.selectiveMetadataOpen('LOCAL-QA-1','bank'));
 for(const control of await page.locator('[data-selective-metadata-group]').all())await control.check();
 await page.locator('[data-action=selective-metadata-api]').click();await page.waitForSelector('[data-action=selective-metadata-apply]');
 check(calls.length===1,'Actual Analyze button makes one primary request and no support request');
 check(calls[0].body.max_tokens===512,'Single metadata output allowance is 512 tokens');
 check(calls[0].body.reasoning_effort==='none'&&!('enableThinking' in calls[0].body),'Metadata uses the verified reasoning_effort=none control');
 check(calls[0].body.response_format.type==='json_schema','Primary request asks the server for structured JSON');
 check(!calls[0].prompt.includes('DO NOT SEND')&&!calls[0].prompt.includes('answerIndex')&&!calls[0].prompt.includes('baselineSnapshot'),'Metadata prompt excludes solution, hint, equations, answer key and baseline audit');
 check(await page.evaluate(async()=>window.__savedBefore===JSON.stringify(await Promise.all(window.__localQA.state.questions.map(q=>window.__localQA.dbGet('questions',q.id))))),'Analyze stages a preview without changing the saved Question Bank');
 await page.locator('[data-action=selective-metadata-apply]').click();await page.waitForFunction(async()=>Boolean((await window.__localQA.dbGet('questions','LOCAL-QA-1')).additionalMetadata.selectiveMetadataReclassification));
 check(await page.evaluate(async()=>{const q=await window.__localQA.dbGet('questions','LOCAL-QA-1');return q.difficultyScore===52&&q.solution==='DO NOT SEND THIS SOLUTION'&&q.answerIndex===0;}),'Apply persists metadata through the existing writer and preserves content/key');
 const diagnostics=await page.evaluate(()=>window.FE_LOCAL_AI_DIAGNOSTICS.records());
 check(diagnostics.length===1&&diagnostics[0].promptTokens===900&&diagnostics[0].completionTokens===180&&diagnostics[0].reasoningTokens===0&&diagnostics[0].jsonValidation===true,'Diagnostics capture measured token usage and semantic validation');
 check(diagnostics[0].requestNumber>0&&diagnostics[0].retryNumber===0&&diagnostics[0].durationMilliseconds>=0&&diagnostics[0].operation.includes('metadata'),'Diagnostics identify operation, model, request number, retry, and duration');
 check(!JSON.stringify(diagnostics).includes('DO NOT SEND')&&!JSON.stringify(diagnostics).includes('Private scratch'),'Diagnostics omit prompt bodies and private reasoning');
 for(const testMode of ['fenced','trailing-comma','prose']){await setup();mode=testMode;await single();check(calls.length===1,`${testMode}: deterministic parsing avoids a second model call`);}
 await setup();mode='malformed-once';const fallback=await single();
 check(calls.length===2&&calls[0].body.model==='google/gemma-4-12b-qat'&&calls[1].body.model==='test-support','Invalid JSON invokes the support model once as a fallback');
 check(fallback.model==='test-support'&&calls[1].body.max_tokens===512&&calls[1].body.reasoning_effort==='none','Fallback is bounded, uses the metadata budget/control, and reports its actual model');
 check((await page.evaluate(()=>window.FE_LOCAL_AI_DIAGNOSTICS.records()))[1].retryNumber===1,'Fallback diagnostics count the second request as retry one');
 await setup();mode='malformed-once';await page.evaluate(()=>window.__localQA.state.settings.localAISupportModel='');await single();check(calls.length===2&&calls.every(c=>c.body.model==='google/gemma-4-12b-qat'),'Without support configuration, at most one primary repair is allowed');
 for(const testMode of ['malformed-always','reasoning-only']){await setup();mode=testMode;let failed=false;try{await single();}catch{failed=true;}check(failed&&calls.length===2,`${testMode}: inference stops after one fallback`);check(calls.every(c=>!c.prompt.includes('Private scratch notes.')),`${testMode}: fallback never forwards reasoning text`);}
 await setup();mode='semantic-once';await single();check(calls.length===2,'A noncanonical subtopic receives one schema-validation fallback');
 for(const testMode of ['wrong-id','wrong-fingerprint','unauthorized','server-error']){await setup();mode=testMode;let failed=false;try{await single();}catch{failed=true;}check(failed&&calls.length===1,`${testMode}: unsafe identity or operational errors do not trigger output repair`);}
 for(const testMode of ['thinking-unsupported','schema-unsupported']){await setup();mode=testMode;await single();check(calls.length===2,`${testMode}: one explicit HTTP compatibility retry is allowed`);await single();check(calls.length===3,`${testMode}: compatibility cache prevents repeated probing`);check(calls.every(c=>c.body.model==='google/gemma-4-12b-qat'),`${testMode}: no support inference is used for parameter negotiation`);}
 await setup();await page.evaluate(()=>window.__localQA.classifyQuestionMetadata(window.__localQA.state.questions[0],{replace:true}));check(calls.length===1&&calls[0].body.max_tokens===512&&calls[0].body.reasoning_effort==='none','Broad legacy classification uses the efficient single-call path');check(!calls[0].prompt.includes('DO NOT SEND')&&!calls[0].prompt.includes('answerIndex'),'Broad classification no longer sends solution/key context');
 await setup();await page.evaluate(()=>window.__localQA.callAI('General solution task',{operation:'solution test'}));check(calls[0].body.max_tokens===7168&&!('reasoning_effort' in calls[0].body),'General Local output budget and server thinking defaults stay unchanged');
 await setup();await page.evaluate(()=>window.__localQA.localMetadataConnectionTest());check(calls.length===1&&calls[0].body.max_tokens===512&&calls[0].body.reasoning_effort==='none','Connection test avoids the old hard-coded 40-token reasoning trap');
 // Provider routing is checked with explicit configs through the real callAI.
 await setup();await page.evaluate(()=>window.__localQA.callAI('provider route test',{config:{provider:'gemini',model:'gemini-fixture',key:'fixture',endpoint:'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'},maxTokens:4096,json:true}));check(calls[0].url.includes('generativelanguage')&&calls[0].body.generationConfig.maxOutputTokens===4096,'Gemini routing and output budgets remain independent');
 await setup();await page.evaluate(()=>window.__localQA.callAI('provider route test',{config:{provider:'openai',model:'openai-fixture',key:'fixture',endpoint:'https://api.openai.com/v1/responses'},maxTokens:4096,json:true}));check(calls[0].url.includes('api.openai.com')&&calls[0].body.max_output_tokens===4096,'OpenAI Responses routing and output budgets remain independent');
 for(const testMode of ['normal','reverse']){
   await setup();mode=testMode;await page.evaluate(()=>window.__runLocal(20));
   const r=await page.evaluate(async()=>({run:window.__localQA.apiBatchReview.run,untouched:window.__savedBefore===JSON.stringify(await Promise.all(window.__localQA.state.questions.map(q=>window.__localQA.dbGet('questions',q.id))))}));
   check(calls.length===2&&calls.every(c=>c.body.max_tokens===5120),`${testMode}: 20 questions use two requests with ten-row output budgets`);
   check(r.run.status==='completed'&&r.run.items.every(i=>i.status==='pending'),`${testMode}: stable-ID matching stages every question and completes before review`);
   check(r.untouched,`${testMode}: batch generation does not save proposals before acceptance`);
   check(calls.every(c=>c.body.reasoning_effort==='none')&&calls.every(c=>(c.prompt.match(/Taxonomy:/g)||[]).length===1),`${testMode}: each batch suppresses thinking and shares one taxonomy`);
 }
 await page.evaluate(()=>window.__localQA.apiBatchResolve(window.__localQA.apiBatchReview.run.items[0],'accept',false));check(await page.evaluate(async()=>{const q=await window.__localQA.dbGet('questions','LOCAL-QA-1');return q.difficultyScore===52;}),'Batched proposal uses the original explicit acceptance writer');
 await page.evaluate(()=>window.__localQA.apiBatchResolve(window.__localQA.apiBatchReview.run.items[0],'reject',false));check(await page.evaluate(async()=>{const q=await window.__localQA.dbGet('questions','LOCAL-QA-1');return q.difficultyScore===42;}),'Batched acceptance can be rejected and restored');
 for(const testMode of ['semantic-once','missing-once']){await setup();mode=testMode;await page.evaluate(()=>window.__runLocal(10));check(calls.length===2&&calls[1].body.model==='test-support'&&calls[1].body.max_tokens===512,`${testMode}: only the one failed row goes to support`);check(await page.evaluate(()=>window.__localQA.apiBatchReview.run.items.every(i=>i.status==='pending')),`${testMode}: good rows are retained and repaired row is staged`);}
 for(const testMode of ['duplicate','wrong-fingerprint']){await setup();mode=testMode;await page.evaluate(()=>window.__runLocal(10));check(calls.length===1,`${testMode}: bulk identity corruption does not trigger guessed matching or extra inference`);check(await page.evaluate(()=>window.__localQA.apiBatchReview.run.items.every(i=>i.status==='failed')),`${testMode}: mismatched batch is rejected without saved changes`);}
 await setup();mode='malformed-always';await page.evaluate(()=>window.__runLocal(11));check(calls.length===4,'Persistent malformed output remains bounded per ten-row batch/single tail');check(await page.evaluate(()=>window.__localQA.apiBatchReview.run.status==='completed'&&window.__localQA.apiBatchReview.run.items.every(i=>i.status==='failed')),'Failed metadata requests do not stop the remaining target list for review');
 await setup();const staleReady=new Promise(resolve=>held=resolve),staleRun=single();await staleReady;await page.evaluate(()=>window.__localQA.state.questions[0].question+=' Changed while generating.');release();let stale=false;try{await staleRun;}catch{stale=true;}check(stale&&calls.length===1,'Stale single-question response is rejected without another inference');
 await setup();const stopReady=new Promise(resolve=>held=resolve),stopRun=page.evaluate(()=>window.__runLocal(20));await stopReady;await page.evaluate(()=>{const q=window.__localQA;q.apiBatchReview.run.cancelRequested=true;q.state.batchCancelRequested=true;q.state.currentAIController?.abort();});release();await stopRun;check(await page.evaluate(()=>window.__localQA.apiBatchReview.run.status==='stopped'&&window.__localQA.apiBatchReview.run.items.slice(0,10).every(i=>i.checkpoint)),'Stop during a ten-row request retains unfinished checkpoints');
 check(calls.length===1,'Stop during the request prevents fallback and additional batches');
 await page.evaluate(()=>window.__localQA.apiBatchResumeWork());check(await page.evaluate(()=>window.__localQA.apiBatchReview.run.items.every(i=>i.status==='pending')),'Resume finishes the stopped batch from preserved checkpoints');
 await setup();const skipReady=new Promise(resolve=>held=resolve),skipRun=page.evaluate(()=>window.__runLocal(20));await skipReady;await page.evaluate(()=>{const q=window.__localQA;q.state.batchSkipCurrent=true;q.state.currentAIController?.abort();});release();await skipRun;check(await page.evaluate(()=>{const items=window.__localQA.apiBatchReview.run.items;return items[0].status==='skipped'&&items.slice(1).every(i=>i.status==='pending');}),'Skip aborts the current provider batch but only skips the displayed question');
 check(calls.length===3,'Other rows from a skipped request continue in two safe requests');
 await setup();mode='partial-access';await page.evaluate(()=>window.__runLocal(10));check(await page.evaluate(()=>{const r=window.__localQA.apiBatchReview.run;return r.status==='suspended'&&r.items.slice(1).every(i=>i.status==='pending'&&!i.checkpoint)&&r.items[0].checkpoint;}),'Support access failure preserves nine validated rows and only the invalid row remains unfinished');
 check(calls.length===2,'Support access failure does not repeat the successful primary batch');
 mode='normal';await page.evaluate(()=>window.__localQA.apiBatchResumeWork());check(calls.length===3&&calls[2].body.max_tokens===512,'Resume after a partial fallback failure only requests the one unfinished row');
 await setup();const pauseReady=new Promise(resolve=>held=resolve),pauseRun=page.evaluate(()=>window.__runLocal(20));await pauseReady;await page.evaluate(()=>window.__localQA.apiBatchReview.run.paused=true);release();await page.waitForTimeout(250);check(calls.length===1,'Manual Pause prevents sending the next ten-question request');await page.evaluate(()=>window.__localQA.apiBatchReview.run.paused=false);await pauseRun;check(calls.length===2&&await page.evaluate(()=>window.__localQA.apiBatchReview.run.status==='completed'),'Resume finishes the remaining metadata batch without a review checkpoint');
 await setup();await page.evaluate(async()=>{const qa=window.__localQA;const q=qa.state.questions[0],f=qa.selectiveMetadataFreezeRequest(q,['difficulty','tags']);await qa.localMetadataSelective(q,f,qa.aiConfig());});check(!calls[0].prompt.includes('Critical Path')&&calls[0].prompt.includes('Taxonomy: {}'),'Unrequested Topic/Subtopic groups do not send the taxonomy');
 await setup();await page.evaluate(()=>{const s=window.__localQA.state.settings;s.localAIEndpoint='http://localhost:11434/api/chat';s.localAIProtocol='ollama-chat';});await single();check(calls.length===1&&calls[0].url.endsWith('/api/chat')&&calls[0].body.think===false&&calls[0].body.options.num_predict===512,'Ollama Local routing retains its native think=false and per-task output budget');
 await setup();await page.evaluate(()=>window.__runLocal(7,true));check(calls.length===4&&calls.slice(0,3).every(c=>c.body.max_tokens===1024)&&calls[3].body.max_tokens===512,'Unusually large records reduce batch grouping to two, without inflating budgets');check(calls.every(c=>c.prompt.includes('Given chart context '.repeat(700))),'Large question context is grouped conservatively rather than truncated');
 for(const requestSize of [1,3,20]){await setup();await page.evaluate(size=>window.__runLocal(23,false,size),requestSize);check(calls.length===Math.ceil(23/requestSize)&&Math.max(...calls.map(c=>c.body.max_tokens))===512*requestSize,`Configured size ${requestSize} sends the expected number of real metadata requests and aggregate allowance`);check(await page.evaluate(()=>window.__localQA.apiBatchReview.run.items.every(i=>i.status==='pending')),`Configured size ${requestSize} retains every stable-ID proposal`);}
 check((await page.evaluate(()=>window.FE_LOCAL_AI_DIAGNOSTICS.pipelines())).every(p=>p.modelCalls>=1&&p.durationMilliseconds>=0),'Pipeline diagnostics retain aggregate timing and call counts');
 check(!errors.length,'No browser runtime errors');
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:checks.every(c=>c.passed),checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,errors,output}));
}catch(error){fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:false,checks,errors,error:error.message,calls:calls.map(c=>({url:c.url,model:c.body.model,budget:c.body.max_tokens}))},null,2));throw error;}
finally{await browser.close();}
