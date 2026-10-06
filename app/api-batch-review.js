  // API batches use the production generators on detached records. Only an
  // explicit review decision writes to the Question Bank. Manual sessions and
  // individual API actions keep their existing authorities.
  const apiBatchReview = { run:null, running:false, busy:false, restarting:false, completion:null, stage:'setup', database:null, writeTail:Promise.resolve(), routes:new WeakMap(), timer:null, error:'' };
  const apiBatchKey = 'current-run';
  const apiBatchRateRetries = 3;
  async function apiBatchReviewDB() {
    if(apiBatchReview.database)return apiBatchReview.database;
    apiBatchReview.database=await new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME+'-API-Review',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('runs',{keyPath:'id'});
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });return apiBatchReview.database;
  }
  async function apiBatchReviewStorage(mode,value) {
    const database=await apiBatchReviewDB();
    return new Promise((resolve,reject)=>{const transaction=database.transaction('runs',mode==='get'?'readonly':'readwrite'),store=transaction.objectStore('runs');
      const request=mode==='get'?store.get(apiBatchKey):mode==='delete'?store.delete(apiBatchKey):store.put({...value,id:apiBatchKey});
      transaction.oncomplete=()=>resolve(request.result);transaction.onerror=()=>reject(transaction.error||request.error);transaction.onabort=()=>reject(transaction.error||new Error('API review storage was interrupted.'));
    });
  }
  function apiBatchReviewPersist() {
    const value=cloneJSON(apiBatchReview.run,null);
    const write=apiBatchReview.writeTail.catch(()=>{}).then(()=>apiBatchReviewStorage(value?'put':'delete',value));
    apiBatchReview.writeTail=write;return write;
  }
  async function apiBatchCheckpointPersist() {
    try{await apiBatchReviewPersist();}catch(error){const failure=new Error('Could not save the API checkpoint: '+error.message);failure.code='API_BATCH_CHECKPOINT_STORAGE';throw failure;}
  }
  const apiBatchReviewReady=(async()=>{
    try{const saved=await apiBatchReviewStorage('get');
      if(saved?.schemaVersion===1&&Array.isArray(saved.items)){
        delete saved.id;apiBatchReview.run=saved;
        if(saved.status==='active'){saved.status='interrupted';saved.paused=true;saved.items.forEach(item=>{if(item.status==='processing')item.status=item.proposed?'pending':'interrupted';});await apiBatchReviewPersist();}
      }
    }catch(error){apiBatchReview.error='Could not restore API review drafts: '+error.message;}
  })();
  const apiBatchClone=value=>cloneJSON(value,{});
  function apiBatchDraftSnapshot(question,operation='API batch proposal') {
    ensureQuestionAIData(question);markCanonicalContextReadBack(question);
    return {question,...immutableAIQuestionPackage(question,canonicalSavedAIProblemContext(question),operation)};
  }
  function apiBatchContentIdentity(question,config) {
    return manualWholeSelectionSnapshotFingerprint({
      content:manualWholeSelectionCurrentnessSnapshot(question,apiBatchOperationKeys(config),config.selectiveMetadataGroups),
      question:question?.question,choices:question?.choices,answerIndex:question?.answerIndex,answerLetter:question?.answerLetter,
      canonicalContext:canonicalContextFingerprint(question)
    });
  }
  function apiBatchOperationKeys(config) {return BATCH_OPERATION_DEFINITIONS.filter(([key])=>config[key]).map(([key])=>key);}
  function apiBatchPatch(before,after) {return manualReviewFieldPatch(before,after).filter(field=>field.path[0]!=='updatedAt');}
  function apiBatchCounts(run=apiBatchReview.run) {
    const items=run?.items||[];return {total:items.length,accepted:items.filter(i=>i.status==='accepted').length,rejected:items.filter(i=>i.status==='rejected').length,
      reviewed:items.filter(i=>['accepted','rejected','reviewed_unchanged'].includes(i.status)).length,
      pending:items.filter(i=>['pending','unchanged'].includes(i.status)).length,
      attention:items.filter(apiBatchNeedsRetry).length,waiting:items.filter(i=>['queued','processing'].includes(i.status)).length};
  }
  function apiBatchNeedsRetry(item) {return Boolean(item.retryAttention||['failed','stale','skipped','cancelled','interrupted','rejected'].includes(item.status));}
  function apiBatchUnfinished(item) {
    if(['rejected','skipped','stale'].includes(item.status))return false;
    const incomplete=item.checkpoint&&apiBatchOperationKeys(apiBatchReview.run?.config||{}).some(key=>!(item.checkpoint.completed||[]).includes(key));
    return ['queued','processing','failed','cancelled','interrupted'].includes(item.status)||Boolean(incomplete||item.retryAttention);
  }
  function apiBatchAccessIssue(error) {
    const code=String(error?.providerCode||error?.openAIDiagnostic?.code||error?.code||'').toLowerCase(),message=String(error?.message||'');
    if(error?.openAIDiagnostic?.classification==='credit_spend_or_usage_limit'||error?.providerErrorType==='insufficient_quota'||['insufficient_quota','credit_balance_exhausted','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded'].includes(code)||/\b(?:credit balance|spend limit|usage limit|daily quota|per[- ]day quota)\b|requestsperday|tokensperday/i.test(message))return 'usage';
    if([401,403].includes(error?.status)||['authentication','permission'].includes(error?.openAIDiagnostic?.classification)||/\b(?:add|choose|select|configure).*API key|no API key|invalid API key|API credential|choose .*model in Settings/i.test(message))return 'access';
    return '';
  }
  function apiBatchRecoveryHTML(run) {
    const unfinished=run.items.filter(apiBatchUnfinished).length;
    if(apiBatchReview.running||!unfinished)return '';
    const storageFailed=/could not (?:be )?save|could not be saved/i.test(apiBatchReview.error);
    return `<section class="api-batch-panel api-batch-recovery" data-api-recovery><div><h4>${storageFailed?'Task available in this window':run.accessBlock?.kind==='usage'?'API usage exhausted — progress saved':run.accessBlock?'API access needs attention — progress saved':'Saved task ready to continue'}</h4><p class="caption">${unfinished} unfinished question${unfinished===1?'':'s'} · proposals and decisions kept${storageFailed?' in this window':''}.${run.accessBlock?' Update API access in Settings before resuming.':''}</p></div><button class="btn primary" data-action="api-batch-resume-work"${apiBatchReview.busy?' disabled':''}>Resume Unfinished Work (${unfinished})</button><details><summary>About resuming</summary><p class="caption">Resume continues saved operations using your current provider routes. Explicit Retry regenerates selected questions. Nothing resumes automatically.${run.accessBlock?' Switching keys may not resolve a shared account limit.':''}</p></details></section>`;
  }
  function apiBatchCloseSavedWindow() {const layer=currentAIBatchToolsLayer();if(layer&&layer===[...document.querySelectorAll('.modal-layer')].at(-1))closeModal();}
  function apiBatchStatus(status) {return ({queued:'Awaiting request',processing:'Generating',pending:'Review required',unchanged:'No visible change',reviewed_unchanged:'Reviewed unchanged',accepted:'Accepted',rejected:'Rejected',failed:'Needs retry',stale:'Changed — retry required',skipped:'Skipped',cancelled:'Stopped',interrupted:'Interrupted'})[status]||status;}
  function apiBatchRoute(task,key,label) {
    const route={...(task==='metadata'?aiConfig():bankAITaskConfig(task))};
    apiBatchReview.routes.set(route,apiBatchReview.run);
    aiActivityCheckpointFromConfig(route,{operationKey:key,operationLabel:label,operationKind:aiOperationTaskKey(key)||key,questionID:state.batchActivity?.currentID||''});
    return route;
  }
  function apiBatchRefresh() {
    const run=apiBatchReview.run;if(!run)return;
    const activity=state.batchActivity;
    if(activity?.apiReviewRunID===run.runID){activity.currentStage=run.paused?'Paused':run.waitUntil>Date.now()?'Waiting between requests':activity.currentStage;
      activity.currentDetail=run.paused?(run.rateUntil>Date.now()?`Rate-limit cooldown: ${Math.ceil((run.rateUntil-Date.now())/1000)} seconds`:'Resume when you are ready.'):run.waitUntil>Date.now()?`${Math.ceil((run.waitUntil-Date.now())/1000)} seconds until the next request`:activity.currentDetail;
    }
    const layer=currentAIBatchToolsLayer(),live=layer?.querySelector('[data-api-review-live]');
    if(layer?.querySelector('[data-api-review-run]')&&apiBatchReview.stage==='review'&&!apiBatchReview.busy){
      const item=run.items[run.reviewIndex||0],signature=item?[item.questionId,item.status,item.stagedAt||''].join(':'):'';
      if(signature!==layer.dataset.apiReviewItem&&document.activeElement!==layer.querySelector('[data-api-batch-jump]')){
        const scroll=layer.querySelector('.modal-body').scrollTop;apiBatchShow('review');layer.querySelector('.modal-body').scrollTop=scroll;return;
      }
    }
    if(live){live.querySelector('[data-api-running-status]').textContent=apiBatchReview.restarting?'Stopping before starting over…':run.paused?'Paused':run.rateUntil>Date.now()&&apiBatchReview.running?'Waiting for API cooldown':run.waitUntil>Date.now()?'Waiting between requests':run.status==='active'?'Generating proposals':run.status==='completed'?'Batch finished — ready for review':run.status==='suspended'?'Progress saved — API access needs attention':run.status==='stopped'?'Batch stopped — progress saved':'Generation interrupted — progress saved';
      live.querySelector('[data-api-current]').textContent=activity?.currentID||run.summary||'';
      live.querySelector('[data-api-detail]').textContent=run.rateUntil>Date.now()&&apiBatchReview.running?`API cooldown: ${Math.ceil((run.rateUntil-Date.now())/1000)} seconds remaining. ${run.paused?'Resume when ready; the cooldown still applies.':run.rateRetry?`The request will retry automatically (${run.rateRetry.attempt} of ${apiBatchRateRetries}).`:'The batch will continue automatically.'}`:activity?.apiReviewRunID===run.runID?activity.currentDetail||'':'';
      live.querySelector('progress').value=run.items.filter(i=>!['queued','processing'].includes(i.status)).length;
      live.querySelector('[data-api-processed]').textContent=`${run.items.filter(i=>!['queued','processing'].includes(i.status)).length} of ${run.items.length} processed · ${apiBatchCounts().pending} ready for review`;
      const pause=live.querySelector('[data-action="api-batch-pause"]');pause.textContent=run.paused?'Resume':'Pause';pause.disabled=!apiBatchReview.running||run.cancelRequested;
      live.querySelector('[data-action="api-batch-stop"]').disabled=!apiBatchReview.running||run.cancelRequested;
      const skip=live.querySelector('[data-action="skip-current-question"]');skip.disabled=!apiBatchReview.running||run.cancelRequested||state.batchSkipCurrent||!activity?.currentID;skip.textContent=state.batchSkipCurrent?'Skipping…':'Skip Current Question';
    }
    const overview=layer?.querySelector('[data-api-overview]');if(overview){const counts=apiBatchCounts(run);overview.querySelector('[data-api-reviewed]').textContent=counts.reviewed;overview.querySelector('progress').value=counts.reviewed;overview.querySelectorAll('[data-api-count]').forEach(node=>node.textContent=counts[node.dataset.apiCount]);}
    const questionLog=layer?.querySelector('[data-api-question-log]');if(questionLog){const value=run.items.map(i=>`<li><code>${escapeHTML(i.questionId)}</code> — ${escapeHTML(apiBatchStatus(i.status))}${i.error?`<p>${escapeHTML(i.error)}</p>`:''}</li>`).join('');if(questionLog.innerHTML!==value)questionLog.innerHTML=value;}
    const routeLog=layer?.querySelector('[data-api-route-log]');if(routeLog){const value=(activity?.apiReviewRunID===run.runID?activity.routeHistory||[]:[]).slice(-80).map(r=>`<li>${escapeHTML([r.questionID,r.label,r.provider,r.model].filter(Boolean).join(' · '))}</li>`).join('');if(routeLog.innerHTML!==value)routeLog.innerHTML=value;}
  }
  async function apiBatchWait(run,until=0) {
    run.waitUntil=until;
    const remainingUntil=()=>until&&run.lastRequestEndedAt?run.lastRequestEndedAt+run.delaySeconds*1000:until;
    while(run.paused||Date.now()<Math.max(remainingUntil(),run.rateUntil||0)){
      if(run.cancelRequested||state.batchCancelRequested)throw aiCancellationError('batch-cancel');
      if(state.batchSkipCurrent)throw aiCancellationError('batch-skip-current');
      run.waitUntil=remainingUntil();
      apiBatchRefresh();await new Promise(resolve=>setTimeout(resolve,100));
    }
    run.waitUntil=0;if(run.cancelRequested||state.batchCancelRequested)throw aiCancellationError('batch-cancel');assertAIActive();
  }
  const apiBatchCallBase=callAI;
  callAI=async function(prompt,options={}) {
    const run=options.config&&apiBatchReview.routes.get(options.config);
    if(!run||run!==apiBatchReview.run||!apiBatchReview.running)return apiBatchCallBase(prompt,options);
    // Hosted transports must return their first rate-limit response to this
    // runner. Local protocol detection keeps its existing fallback behavior.
    let retries=0;
    for(;;){
      await apiBatchWait(run,run.lastRequestEndedAt?run.lastRequestEndedAt+run.delaySeconds*1000:0);
      const scopedOptions={...options,requestSpacingSeconds:run.delaySeconds,...(options.config.provider!=='local'?{singleAttempt:true}:{})};
      try{
        const response=await apiBatchCallBase(prompt,scopedOptions);run.rateRetry=null;return response;
      }catch(error){
        if(isAICancellation(error)||apiBatchAccessIssue(error)||classifyAIOperationalError(error).category!=='rate_limit')throw error;
        run.rateUntil=Date.now()+Math.max(1000,(Number(error.retryAfter)||30)*1000);
        if(retries>=apiBatchRateRetries){run.rateRetry=null;throw error;}
        run.rateRetry={questionId:state.batchActivity?.currentID||'',operation:options.operation||'',attempt:++retries};
        // Retry only this provider request. Already completed operations and
        // verifier/generation calls retain their checkpoints and private draft.
        await apiBatchCheckpointPersist();apiBatchRefresh();
      }finally{run.lastRequestEndedAt=Date.now();}
    }
  };
  async function apiBatchGenerateOperation(question,key,config) {
    let q=question;const source='API batch proposal';
    if(key==='formatQuestionPresentation'){
      const route=apiBatchRoute('question',key,'Question Text Presentation'),raw=await callAI(individualPresentationAPIQuestionPrompt(q),{config:route,json:true,jsonSchema:QUESTION_TEXT_REPAIR_JSON_SCHEMA,temperature:0,singleAttempt:true,operation:`Batch Question Text Presentation ${q.id}`});
      q=manualBatchQuestionPresentationApply(q,raw,source,null,q).question;
    }else if(key==='formatAnswerChoicesPresentation'){
      const route=apiBatchRoute('choices',key,'Answer Choices Presentation'),raw=await callAI(individualPresentationAPIAnswerPrompt(q),{config:route,json:true,jsonSchema:ANSWER_FORMATTING_REPAIR_JSON_SCHEMA,temperature:0,singleAttempt:true,operation:`Batch Answer Choices Presentation ${q.id}`});
      q=manualBatchAnswerChoicesPresentationApply(q,raw,source,null,q).question;
    }else if(key==='repairQuestionText'){
      if(!questionTextNeedsRepair(q))return {question:q,skipped:true};
      await repairQuestionTextRecord(q,{persist:false,aiConfigOverride:apiBatchRoute('question',key,'Repair question text and MathPrint')});
    }else if(key==='selectiveMetadata'){
      if(config.scope==='missing'&&!selectiveMetadataQuestionNeedsGroups(q,config.selectiveMetadataGroups))return {question:q,skipped:true};
      const frozen=selectiveMetadataFreezeRequest(q,config.selectiveMetadataGroups),route=apiBatchRoute('metadata',key,'Classify or reclassify metadata');
      if(route.provider==='local'){
        const result=await localMetadataSelective(q,frozen,route);
        q=await selectiveMetadataApply(q,frozen,result.value,{source,provider:route.provider,model:result.model},{persist:false});
      }else{
        const raw=await callAI(selectiveMetadataPrompt(frozen),{config:route,json:true,jsonSchema:selectiveMetadataJSONSchema(frozen),temperature:0,maxTokens:4096,singleAttempt:true,operation:`Selective metadata reclassification ${q.id}`});
        q=await selectiveMetadataApply(q,frozen,selectiveMetadataParseResponse(raw,frozen,q),{source,provider:route.provider,model:route.model},{persist:false});
      }
    }else if(key==='aiData'){
      if(!config.replaceExisting&&aiDataComplete(q))return {question:q,skipped:true};
      const route=apiBatchRoute('enrichment',key,'AI Solution and Diagram Data'),crop=sourceCropMimeAndData(q),fallback=hasAIDataFallbackContext(q);
      if(route.provider==='local'&&crop)throw new Error('This Local AI route does not support image input.');
      if(questionDiagramDependent(q)&&!crop&&!fallback)throw new Error('Add a source crop or stored hidden context before enriching this diagram-dependent question.');
      const raw=await callAI(questionAIDataEnrichmentPrompt(q,{replace:config.replaceExisting,noCropFallback:!crop}),{config:route,json:true,jsonSchema:AI_DATA_ENRICHMENT_JSON_SCHEMA,temperature:0,maxTokens:32768,operation:`Generate missing AI data ${q.id}`,...(crop?{inlineDataParts:[crop]}:{})});
      applyAIDataPatch(q,parseAIDataPatch(raw,q),{replace:config.replaceExisting});
    }else if(['generateSolutions','polishPresentation','repairMath'].includes(key)){
      const generating=key==='generateSolutions';
      if(generating&&hasSolution(q)&&!config.replaceExisting)return {question:q,skipped:true};
      if(!generating&&(!hasSolution(q)||(key==='repairMath'?mathIssues(q.solution).length===0:solutionSafetyIssues(q).length===0)))return {question:q,skipped:true};
      const route=apiBatchRoute('solution',key,generating?'Generate worked solution':'Repair solution presentation'),snapshot=apiBatchDraftSnapshot(q);
      const options={persist:false,staged:true,preparedSnapshot:snapshot,aiConfigOverride:route,source,promptProfile:'question-bank',operationController:(stage,detail)=>{setBatchCurrentOperationCheckpoint({operationKey:key,operationLabel:generating?'Generate worked solution':'Repair solution presentation',operationKind:'solution',stage,detail,status:'active'});apiBatchRefresh();}};
      if(generating&&config.solutionMode==='fast')await fastBulkSolutionForQuestion(q,options);
      else await solutionForQuestion(q,{...options,repairOnly:key==='repairMath'||(!generating&&mathIssues(q.solution).length>0),presentationOnly:key==='polishPresentation'});
      if(generating&&config.solutionMode==='full'&&config.polishNewSolutions){
        const generated=apiBatchClone(q);
        try{await solutionForQuestion(q,{...options,preparedSnapshot:apiBatchDraftSnapshot(q),presentationOnly:true});}
        catch(error){q=generated;if(isAICancellation(error)||classifyAIOperationalError(error).category==='rate_limit')throw Object.assign(error,{partialQuestion:q});return {question:q,warning:'The generated solution is staged; optional polish failed: '+error.message};}
      }
    }else if(key==='repairChoices'){
      if(!answerChoicesNeedRepair(q))return {question:q,skipped:true};
      await repairAnswerChoices(q,{persist:false,silent:true,aiConfigOverride:apiBatchRoute('choices',key,'Repair answer choices and keys')});
    }else if(key==='questionDiagrams'){
      if(hasQuestionDiagram(q)&&!config.replaceExisting)return {question:q,skipped:true};
      await questionDiagramForRecord(q,{persist:false,source,aiConfigOverride:apiBatchRoute('questionDiagram',key,'Generate question diagrams')});
    }else if(key==='solutionDiagrams'){
      if(!hasSolution(q)||hasSolutionDiagram(q)&&!config.replaceExisting)return {question:q,skipped:true};
      await supportDiagramForQuestion(q,{persist:false,source,contextMode:config.solutionDiagramContextMode,aiConfigOverride:apiBatchRoute('solutionDiagram',key,'Generate solution diagrams')});
    }else if(key==='validateQuestions'){
      const route=apiBatchRoute('validation',key,'Validate questions'),snapshot=apiBatchDraftSnapshot(q,'validate answer blind'),artifacts=answerCheckPromptArtifacts(q,snapshot.savedAIContext,snapshot),crop=sourceCropMimeAndData(q);
      const raw=await callAI(artifacts.prompt,{config:route,json:true,jsonSchema:ANSWER_CHECK_JSON_SCHEMA,temperature:0,maxTokens:4096,timeoutSeconds:180,singleAttempt:true,operation:`Validate ${q.id}`,...(route.provider==='gemini'&&crop?{inlineDataParts:[crop]}:{})});
      await processAnswerCheckResponse(q,raw,{method:'api',provider:route.provider,model:route.model,providerAttempts:1},artifacts,parseAnswerCheckResponse(raw,q,artifacts),{persist:false,staged:true});
    }else throw new Error('Unsupported API batch operation: '+key);
    assertAIActive();return {question:q};
  }
  async function apiBatchCurrent(questionID) {
    await awaitPendingQuestionPersistence(questionID);
    return await dbGet('questions',questionID)||null;
  }
  // Compare and merge inside the same Question Bank transaction. An editor or
  // sync write that commits between the preview and click cannot be lost.
  async function apiBatchCommit(item,decision) {
    await awaitPendingQuestionPersistence(item.questionId);
    let baseline,saved,failure;
    await new Promise((resolve,reject)=>{
      const transaction=state.db.transaction('questions','readwrite'),store=transaction.objectStore('questions'),request=store.get(item.questionId);
      request.onsuccess=()=>{
        try{
          const current=request.result;if(!current)throw new Error('Question is no longer available.');baseline=apiBatchClone(current);
          if(decision==='reject'){
            if(!manualReviewPatchMatches(current,item.acceptedPatch,'after'))throw new Error('Accepted fields were edited later. Those edits were preserved.');
          }else if(apiBatchContentIdentity(current,apiBatchReview.run.config)!==item.identity||!manualReviewPatchMatches(current,item.patch,'before')){
            item.status='stale';item.retrySelected=true;throw new Error('The question changed after staging. Retry using its current content.');
          }
          const changed=manualReviewApplyPatch(current,decision==='reject'?item.acceptedPatch:item.patch,decision==='reject'?'before':'after');
          saved=guardedQuestionForPersistence(changed,current,{explicitContextWrite:true});store.put(saved);
        }catch(error){failure=error;transaction.abort();}
      };
      transaction.oncomplete=resolve;transaction.onerror=()=>reject(failure||transaction.error||request.error);transaction.onabort=()=>reject(failure||transaction.error||new Error('The review save was interrupted.'));
    });
    markCanonicalContextReadBack(saved);const index=state.questions.findIndex(q=>q.id===item.questionId);if(index>=0)state.questions[index]=saved;refreshActiveSessionQuestionRecord(saved,{clearResponse:false});
    return {baseline,saved};
  }
  async function apiBatchProcessItem(item,run,{resume=false}={}) {
    const original=await apiBatchCurrent(item.questionId);if(!original){item.status='failed';item.error='Question is no longer available.';return;}
    const saved=resume&&item.checkpoint;
    if(saved&&apiBatchContentIdentity(original,run.config)!==saved.identity){item.status='stale';item.error='The question changed since its checkpoint. Retry this question using its current saved content.';item.retryAttention=true;item.retrySelected=true;delete item.checkpoint;return;}
    const previousStatus=item.status,before=apiBatchClone(saved?.before||original);let draft=apiBatchClone(saved?.draft||before),successful=[...(saved?.successful||[])],warnings=[...(saved?.warnings||[])],errors=[],contiguous=true;
    const completed=new Set(saved?.completed||[]),identity=saved?.identity||apiBatchContentIdentity(before,run.config);
    delete item.rateLimitExhausted;
    item.checkpoint={before:apiBatchClone(before),draft:apiBatchClone(draft),identity,completed:[...completed],successful:[...successful],warnings:[...warnings]};
    delete item.interruption;
    item.status='processing';state.batchActivity.currentID=item.questionId;apiBatchRefresh();await apiBatchReviewPersist();
    // Dependency order matches the production API runner. One operation works
    // on a private candidate; a failure cannot leak its half-applied fields.
    const order=['formatQuestionPresentation','formatAnswerChoicesPresentation','repairQuestionText','selectiveMetadata','aiData','generateSolutions','polishPresentation','repairMath','repairChoices','questionDiagrams','solutionDiagrams','validateQuestions'];
    for(const key of order.filter(key=>run.config[key])){
      if(completed.has(key))continue;
      if(key==='polishPresentation'&&successful.includes('generateSolutions')||key==='repairMath'&&successful.some(k=>['generateSolutions','polishPresentation'].includes(k))){completed.add(key);if(contiguous)item.checkpoint.completed=[...completed];await apiBatchCheckpointPersist();continue;}
      try{
        await apiBatchWait(run);
        if(state.batchSkipCurrent)throw aiCancellationError('batch-skip-current');
        const current=await apiBatchCurrent(item.questionId);if(!current||apiBatchContentIdentity(current,run.config)!==identity)throw Object.assign(new Error('Question content changed during generation. Retry with the current question.'),{code:'API_BATCH_STALE'});
        const result=await apiBatchGenerateOperation(apiBatchClone(draft),key,run.config);
        if(!result.skipped){draft=result.question;successful.push(key);if(result.warning)warnings.push(result.warning);}
        if(contiguous){completed.add(key);item.checkpoint={before:apiBatchClone(before),draft:apiBatchClone(draft),identity,completed:[...completed],successful:[...successful],warnings:[...warnings]};}
        if(successful.length){item.before=before;item.proposed=apiBatchClone(draft);item.patch=apiBatchPatch(before,draft);item.identity=identity;item.operations=[...successful];item.stagedAt=nowISO();}
        await apiBatchCheckpointPersist();
      }catch(error){
        if(error.code==='API_BATCH_CHECKPOINT_STORAGE')throw error;
        if(error.partialQuestion){draft=error.partialQuestion;successful.push(key);}
        errors.push(error.message||String(error));
        const access=apiBatchAccessIssue(error);
        if(access){run.accessBlock={kind:access,message:error.message,questionId:item.questionId,at:nowISO()};run.suspendRequested=true;run.suspendReason=access;warnings.push('Progress saved. Update API access before resuming unfinished work.');break;}
        if(error.code==='API_BATCH_STALE'){successful=[];break;}
        if(isAICancellation(error)){item.interruption=aiCancellationReason(error);break;}
        if(classifyAIOperationalError(error).category==='rate_limit'){
          run.rateUntil=Date.now()+Math.max(1000,(Number(error.retryAfter)||30)*1000);item.rateLimitExhausted=true;warnings.push('Temporary rate-limit retries were exhausted for this operation. The remaining batch will continue after the cooldown.');contiguous=false;continue;
        }
        contiguous=false;
      }
    }
    const latest=await apiBatchCurrent(item.questionId),stale=!latest||apiBatchContentIdentity(latest,run.config)!==identity;
    if(stale){item.status='stale';item.error='Question content changed during generation. Existing saved content was preserved.';item.retryAttention=true;delete item.checkpoint;return;}
    if(successful.length){
      item.before=before;item.proposed=apiBatchClone(draft);item.patch=apiBatchPatch(before,draft);item.identity=identity;item.operations=successful;
      item.status=item.patch.length?'pending':'unchanged';item.warnings=warnings;item.error=errors.join(' ');item.retryAttention=errors.length>0;item.stagedAt=nowISO();
    }else if(item.proposed){item.status=['accepted','rejected','pending','unchanged','reviewed_unchanged','stale'].includes(previousStatus)?previousStatus:item.acceptedPatch?'accepted':'pending';item.retryAttention=true;item.error=errors.join(' ')||'Retry produced no replacement. The earlier valid proposal and decision remain available.';}
    else{item.status=item.interruption==='batch-skip-current'?'skipped':item.interruption?'cancelled':errors.length?'failed':'unchanged';item.before=before;item.proposed=errors.length?null:before;item.patch=[];item.identity=identity;item.operations=apiBatchOperationKeys(run.config);item.error=errors.join(' ');item.warnings=warnings;}
    if(!['processing','queued'].includes(item.status))item.completedAt=nowISO();
    if(apiBatchOperationKeys(run.config).every(key=>completed.has(key))||!item.interruption&&!run.suspendRequested&&!run.paused&&!item.rateLimitExhausted)delete item.checkpoint;
  }
  async function apiBatchExecute(run,items,{resume=false}={}) {
    if(apiBatchReview.running||apiBatchReview.restarting)throw new Error('Wait for the current API task to stop before starting another.');
    const completion={};completion.promise=new Promise(resolve=>completion.resolve=resolve);apiBatchReview.completion=completion;
    apiBatchReview.running=true;run.status='active';run.cancelRequested=false;run.suspendRequested=false;run.paused=false;run.waitUntil=0;run.rateRetry=null;run.summary='';
    state.batchCancelled=false;state.individualAICancelled=false;state.batchSkipCurrent=false;state.batchCancelRequested=false;
    state.batchActivity={id:uid('BATCH'),apiReviewRunID:run.runID,mode:'batch',status:'active',startedAt:nowISO(),operations:batchOperationLabels(run.config),scopeLabel:batchScopeLabel(run.config),targetTotal:items.length,processed:0,counts:{complete:0,warning:0,skipped:0,failed:0,cancelled:0},log:[],routeHistory:[],providerCallCount:0};
    run.activityID=state.batchActivity.id;persistBatchActivity();apiBatchReview.stage='activity';apiBatchShow('activity');
    apiBatchReview.timer=setInterval(apiBatchRefresh,300);
    try{
      await apiBatchReviewPersist();
      for(let itemIndex=0;itemIndex<items.length;){
        if(run.cancelRequested||state.batchCancelRequested||run.suspendRequested)break;state.batchSkipCurrent=false;
        const remaining=items.slice(itemIndex),group=apiBatchLocalMetadataEligible(run,remaining)?apiBatchLocalMetadataSlice(remaining):null;
        const processed=group?await apiBatchProcessLocalMetadataGroup(group,run,{resume}):[items[itemIndex]];
        if(!group)await apiBatchProcessItem(processed[0],run,{resume});
        for(const item of processed){
          state.batchActivity.processed++;
          const outcome=item.status==='failed'||item.status==='stale'?'failed':item.status==='cancelled'?'cancelled':item.retryAttention?'warning':item.status==='skipped'?'skipped':'complete';
          state.batchActivity.counts[outcome]++;addBatchActivityLog(item.questionId,item.proposed?'Proposal staged for review':item.error||apiBatchStatus(item.status),outcome);
        }
        itemIndex+=processed.length;
        await apiBatchReviewPersist();apiBatchRefresh();
      }
      run.status=run.suspendRequested?'suspended':run.cancelRequested||state.batchCancelRequested?'stopped':'completed';
      if(run.status==='completed')run.accessBlock=null;
    }catch(error){run.status='interrupted';apiBatchReview.error=error.message;run.summary='Processing stopped: '+error.message;}
    finally{
      try{
      items.filter(i=>['queued','processing'].includes(i.status)).forEach(i=>{i.status='interrupted';i.error='This question was not processed. Select it in Finish & Retry to continue.';});
      apiBatchReview.running=false;clearInterval(apiBatchReview.timer);apiBatchReview.timer=null;run.paused=false;run.waitUntil=0;run.rateRetry=null;
      state.currentAIController=null;state.batchCancelled=false;state.individualAICancelled=false;state.batchSkipCurrent=false;state.batchCancelRequested=false;
      state.batchActivity.status=run.status==='completed'?'completed':'cancelled';state.batchActivity.currentID='';state.batchActivity.completedAt=nowISO();
      run.summary=run.summary||(run.status==='suspended'?'Progress saved. Resume Unfinished Work when you are ready.':`${state.batchActivity.processed} of ${items.length} questions processed. ${apiBatchCounts(run).pending} proposals ready for review. No proposal is saved until accepted.`);state.batchActivity.summary=run.summary;persistBatchActivity();
      const exitAfterSave=run.exitAfterSave;run.exitAfterSave=false;
      try{await apiBatchReviewPersist();}catch(error){apiBatchReview.error='Drafts could not be saved for recovery: '+error.message;}
      if(apiBatchReview.restarting)return;
      if(exitAfterSave&&!apiBatchReview.error){apiBatchCloseSavedWindow();renderApp();toast('API progress saved. Reopen AI Batch Tools → API Batch to resume.','success');return;}
      const layer=currentAIBatchToolsLayer();if(layer?.querySelector('[data-api-review-run]'))apiBatchShow(run.status==='completed'?'review':apiBatchReview.stage);renderApp();
      }finally{completion.resolve();if(apiBatchReview.completion===completion)apiBatchReview.completion=null;}
    }
  }
  runBatchSolutions=async function(){
    await apiBatchReviewReady;
    if(apiBatchReview.running||apiBatchReview.restarting||isQuestionBankBatchActive()){toast('Wait for the current API task to stop.','warning');return;}
    if(apiBatchReview.run){apiBatchShow('review');return;}
    const config=batchConfigurationFromModal();config.localMetadataBatchSize=Number($('#api-batch-request-size')?.value||state.settings.apiMetadataBatchSize||10);const delayInput=$('#api-batch-delay'),delay=Number(delayInput?.value);
    if(delayInput&&!delayInput.reportValidity())return;
    if(!batchHasOperations(config)||config.selectiveMetadata&&!config.selectiveMetadataGroups.length){toast('Choose an operation and at least one group for metadata.','warning');return;}
    const targets=batchTargetsForConfig(config);if(!targets.length){toast('No questions match this scope.');return;}
    apiBatchReview.error='';apiBatchReview.run={schemaVersion:1,runID:uid('API-REVIEW'),config:apiBatchClone(config),delaySeconds:Number.isFinite(delay)?Math.max(0,Math.min(3600,delay)):1,reviewIndex:0,status:'active',startedAt:nowISO(),items:targets.map(q=>({questionId:q.id,status:'queued',retrySelected:true}))};
    state.settings.apiBatchRequestDelaySeconds=apiBatchReview.run.delaySeconds;state.settings.batchSolutionMode=config.solutionMode;state.settings.batchPolishNewSolutions=Boolean(config.polishNewSolutionsPreference);saveSettings();
    await apiBatchExecute(apiBatchReview.run,apiBatchReview.run.items);
  };
  async function apiBatchResolve(item,decision,advance=true,{persist=true,refresh=true}={}) {
    const run=apiBatchReview.run,current=await apiBatchCurrent(item.questionId);if(!current)throw new Error('Question is no longer available.');
    if(decision==='reject'){
      if(item.acceptedPatch){
        if(!manualReviewPatchMatches(current,item.acceptedPatch,'after'))throw new Error('Accepted fields were edited later. Those edits were preserved.');
        const {saved:restored}=await apiBatchCommit(item,'reject');
        item.acceptedPatch=null;item.before=apiBatchClone(restored);item.identity=apiBatchContentIdentity(restored,run.config);item.patch=item.proposed?apiBatchPatch(restored,item.proposed):[];
      }item.status='rejected';item.retrySelected=true;
    }else{
      if(item.status==='accepted')return;
      if(!item.proposed||!['pending','unchanged','rejected'].includes(item.status))throw new Error('No current valid proposal is available. Retry this question.');
      if(apiBatchContentIdentity(current,run.config)!==item.identity||!manualReviewPatchMatches(current,item.patch,'before')){item.status='stale';item.retrySelected=true;if(persist)await apiBatchReviewPersist();throw new Error('The question changed after staging. Retry using its current content.');}
      if(!item.patch.length)item.status='reviewed_unchanged';
      else{
        const {baseline,saved:changed}=await apiBatchCommit(item,'accept'),undoBase=item.acceptedPatch&&manualReviewPatchMatches(baseline,item.acceptedPatch,'after')?manualReviewApplyPatch(baseline,item.acceptedPatch,'before'):baseline;
        item.acceptedPatch=apiBatchPatch(undoBase,changed);item.status='accepted';
      }
    }
    if(decision==='accept'&&item.checkpoint){item.checkpoint.before=apiBatchClone(await apiBatchCurrent(item.questionId));item.checkpoint.draft=apiBatchClone(item.checkpoint.before);item.checkpoint.identity=apiBatchContentIdentity(item.checkpoint.before,run.config);}
    item.reviewedAt=nowISO();if(advance)run.reviewIndex=Math.min(run.items.length-1,run.items.indexOf(item)+1);if(persist)await apiBatchReviewPersist();if(refresh)renderApp();
  }
  async function apiBatchBulk(decision) {
    const failures=[];
    for(const item of apiBatchReview.run.items){
      if(decision==='accept'&&!['pending','unchanged','rejected'].includes(item.status))continue;
      if(decision==='reject'&&!item.proposed&&!item.acceptedPatch)continue;
      try{await apiBatchResolve(item,decision,false);}catch(error){failures.push(`${item.questionId}: ${error.message}`);item.error=error.message;item.retryAttention=true;}
    }
    await apiBatchReviewPersist();if(failures.length)apiBatchReview.error=failures.join(' ');
  }
  async function apiBatchRetry(ids) {
    if(apiBatchReview.running)throw new Error('Stop the current run before starting retries.');
    const run=apiBatchReview.run,items=run.items.filter(i=>ids.includes(i.questionId));if(!items.length)return;
    items.forEach(i=>{delete i.interruption;delete i.checkpoint;i.retryAttention=false;});await apiBatchExecute(run,items);
  }
  async function apiBatchResumeWork() {
    if(apiBatchReview.running)throw new Error('This API batch is already running.');
    const run=apiBatchReview.run,items=run.items.filter(apiBatchUnfinished);if(!items.length)return;
    items.forEach(i=>{delete i.interruption;i.retryAttention=false;});await apiBatchExecute(run,items,{resume:true});
  }
  async function apiBatchSaveExit() {
    const run=apiBatchReview.run;if(!run)return;
    if(apiBatchReview.running){run.exitAfterSave=true;run.suspendRequested=true;run.suspendReason='user';run.cancelRequested=true;requestQuestionBankBatchCancellation();apiBatchRefresh();return;}
    await apiBatchReviewPersist();apiBatchCloseSavedWindow();toast('API progress saved. Reopen AI Batch Tools → API Batch to resume.','success');
  }
  async function apiBatchEnd() {
    if(apiBatchReview.running)throw new Error('Stop the batch before ending its review.');
    const run=apiBatchReview.run,counts=apiBatchCounts(run);
    if(run.items.some(i=>!['accepted','rejected','reviewed_unchanged'].includes(i.status))&&!confirm('End this task? Accepted changes stay saved. Unaccepted proposals and unfinished questions will be discarded.'))return;
    apiBatchReview.run=null;apiBatchReview.error='';await apiBatchReviewPersist();apiBatchReview.stage='setup';batchWorkspaceUI.apiStage='setup';showBatchSolutions({tab:'api'});
    toast(`API task finished. ${counts.accepted} accepted change${counts.accepted===1?'':'s'} kept.`,'success');
  }
  async function apiBatchRestart() {
    await apiBatchReviewReady;
    const run=apiBatchReview.run;if(!run||apiBatchReview.restarting||apiBatchReview.busy&&!apiBatchReview.running)return;
    const accepted=apiBatchCounts(run).accepted;
    if(!confirm(`Start over with a new API task?\n\nThe current run will stop. Unaccepted proposals, unfinished work, and this task’s review history will be discarded.\n\n${accepted} accepted question${accepted===1?'':'s'} will stay saved. You will no longer be able to undo those acceptances through this task.`))return;
    apiBatchReview.restarting=true;
    try{
      run.exitAfterSave=false;
      if(apiBatchReview.running){run.cancelRequested=true;requestQuestionBankBatchCancellation();apiBatchRefresh();}
      apiBatchMountTaskControls(currentAIBatchToolsLayer());
      // Let the worker finish its final checkpoint write before deleting the
      // ledger. A late provider response must never recreate the old task.
      await apiBatchReview.completion?.promise;
      await apiBatchReview.writeTail.catch(()=>{});
      await apiBatchReviewStorage('delete');
      apiBatchReview.run=null;apiBatchReview.error='';apiBatchReview.stage='setup';batchWorkspaceUI.apiStage='setup';
      apiBatchReview.restarting=false;
      if(currentAIBatchToolsLayer()?.classList.contains('api-batch-modal'))showBatchSolutions({tab:'api'});else renderApp();
      toast(`Ready for a new API task. ${accepted} accepted question${accepted===1?'':'s'} kept.`,'success');
    }catch(error){apiBatchReview.error='Could not clear the saved task: '+error.message;}
    finally{apiBatchReview.restarting=false;if(apiBatchReview.run&&currentAIBatchToolsLayer()?.classList.contains('api-batch-modal'))apiBatchShow(apiBatchReview.stage);}
  }
  function apiBatchMountTaskControls(layer) {
    if(!layer)return;
    const header=layer.querySelector('.modal-header');if(!header)return;
    let actions=header.querySelector('.api-batch-header-actions');
    if(!actions){actions=batchWorkspaceElement('<div class="api-batch-header-actions"></div>');const close=header.querySelector('[data-action="close-modal"]');if(close)actions.append(close);header.append(actions);}
    actions.querySelector('[data-action="api-batch-restart"]')?.remove();
    if(apiBatchReview.run)actions.prepend(batchWorkspaceElement(`<button class="btn" data-action="api-batch-restart"${apiBatchReview.restarting||apiBatchReview.busy&&!apiBatchReview.running?' disabled':''}>${apiBatchReview.restarting?'Stopping…':'Start Over'}</button>`));
    if(apiBatchReview.restarting)layer.querySelectorAll('[data-action^="api-batch-"],[data-action="skip-current-question"],[data-api-batch-jump],[data-api-batch-live-delay],[data-api-retry]').forEach(control=>control.disabled=true);
  }
  function apiBatchStagesHTML(stage) {
    return `<nav class="batch-workspace-stages" aria-label="API batch steps">${[['setup','Setup'],['activity','Activity'],['review','Review'],['finish','Finish & Retry']].map(([key,label])=>`<button type="button" data-action="api-batch-stage" data-stage="${key}"${key===stage?' aria-current="step"':''}${key!=='setup'&&!apiBatchReview.run?' disabled':''}>${label}</button>`).join('')}</nav>`;
  }
  function apiBatchOverviewHTML(run) {
    const c=apiBatchCounts(run);return `<section class="batch-workspace-overview" data-api-overview><h3>Task overview</h3><div class="batch-workspace-overview-total"><strong><b data-api-reviewed>${c.reviewed}</b> <span>of ${c.total}</span></strong><span class="caption">reviewed</span></div><progress value="${c.reviewed}" max="${Math.max(1,c.total)}" aria-label="API review progress"></progress><dl class="batch-workspace-counts">${[['Accepted','accepted','green'],['Rejected','rejected','yellow'],['Awaiting review','pending','blue'],['Needs retry','attention','yellow'],['Awaiting request','waiting','']].map(([label,key,color])=>`<div><dt><i class="batch-workspace-dot ${color}"></i>${label}</dt><dd data-api-count="${key}">${c[key]}</dd></div>`).join('')}</dl><details class="api-batch-help"><summary>Saving &amp; closing</summary><p class="caption">Accept saves. Revisit accepted questions to restore original fields while the task is open. Close keeps the task running; Save &amp; Exit stops and saves progress.</p></details></section>`;
  }
  function apiBatchReviewComparison(item,run) {
    if(!item.before)return `<div class="notice">${escapeHTML(item.error||'No response yet. This question remains available to retry.')}</div>`;
    const keys=item.operations||apiBatchOperationKeys(run.config),view={authorizedOperations:keys,authorizedFamilies:manualWholeSelectionReviewFamilies(keys),selectiveMetadataGroups:run.config.selectiveMetadataGroups,original:manualWholeSelectionSnapshot(item.before,keys,run.config.selectiveMetadataGroups),proposed:item.proposed?manualWholeSelectionSnapshot(item.proposed,keys,run.config.selectiveMetadataGroups):null,choiceContext:item.before.choices,questionTextContext:item.before.question};
    // Correctness repairs may clear a saved solution or support diagram. Show
    // these dependent changes even when only answer repair was requested.
    if(item.proposed&&['solution','solutionDiagram'].some(f=>canonicalStableStringify(manualWholeSelectionSnapshot(item.before,['generateSolutions','solutionDiagrams'])[f])!==canonicalStableStringify(manualWholeSelectionSnapshot(item.proposed,['generateSolutions','solutionDiagrams'])[f]))){
      for(const key of ['generateSolutions','solutionDiagrams'])if(!view.authorizedOperations.includes(key))view.authorizedOperations.push(key);
      view.authorizedFamilies=manualWholeSelectionReviewFamilies(view.authorizedOperations);view.original=manualWholeSelectionSnapshot(item.before,view.authorizedOperations,run.config.selectiveMetadataGroups);view.proposed=manualWholeSelectionSnapshot(item.proposed,view.authorizedOperations,run.config.selectiveMetadataGroups);
    }
    const validation=view.authorizedFamilies.includes('validation');
    if(validation)view.authorizedFamilies=view.authorizedFamilies.filter(f=>f!=='validation');
    const content=view.authorizedFamilies.length?manualWholeReviewComparisonHTML(view,'generic'):`<div class="manual-whole-review-context"><strong>Question — read-only context</strong><div class="math-content">${richText(item.before.question)}</div>${manualWholeReviewChoicesHTML(item.before.choices||[])}</div>`;
    if(!validation)return content;
    const render=value=>{
      if(!value)return '<p class="caption">No validation saved.</p>';
      const result=value.parsedResult||value.result||{},comparison=value.localComparison||value.comparison||{},agrees=comparison.agrees;
      return `<p><span class="pill ${agrees===true?'green':agrees===false?'red':'yellow'}">${agrees===true?'Agrees with stored key':agrees===false?'Review answer-key conflict':escapeHTML(result.status||'Review required')}</span></p><dl class="api-batch-validation"><div><dt>Independent answer</dt><dd class="math-content">${richText(String(result.independentAnswer||'No answer returned'))}</dd></div><div><dt>Selected choice</dt><dd class="math-content">${richText([result.selectedChoiceLetter,result.selectedChoiceText].filter(Boolean).join(' · ')||'No choice matched')}</dd></div><div><dt>Confidence</dt><dd>${escapeHTML(result.confidence||'Not reported')}</dd></div></dl>${result.briefVerification?`<div class="math-content">${richText(result.briefVerification)}</div>`:''}${result.issue?`<p>${escapeHTML(result.issue)}</p>`:''}`;
    };
    const before=view.original.validation,after=view.proposed?.validation;
    return content+`<div class="manual-whole-review-comparison"><section class="manual-whole-review-pane"><strong>Original Validation</strong>${render(before)}</section><section class="manual-whole-review-pane"><strong>Proposed Validation</strong>${item.proposed?render(after):'<p class="caption">No valid proposal is available.</p>'}</section></div><details><summary>Full validation records</summary><pre class="api-batch-audit">${escapeHTML(JSON.stringify({original:before,proposed:after},null,2))}</pre></details>`;
  }
  function apiBatchBodyHTML(stage) {
    const run=apiBatchReview.run;if(!run)return '<p>No API task is open.</p>';
    const c=apiBatchCounts(run);let main='';
    if(stage==='activity')main=`<header class="batch-workspace-heading"><h3>Generate proposals</h3><p class="caption">All questions run before review. You can open available proposals while generation continues. Pause takes effect before the next request.</p></header><section class="api-batch-panel" data-api-review-live><div class="api-batch-activity-layout"><div class="api-batch-live-status"><strong data-api-running-status>${run.paused?'Paused':apiBatchReview.running?'Generating proposals':'Ready for review'}</strong><progress value="${run.items.filter(i=>!['queued','processing'].includes(i.status)).length}" max="${Math.max(1,c.total)}" aria-label="API generation progress"></progress><p data-api-processed></p><p data-api-current></p><p class="caption" data-api-detail></p></div><div class="api-batch-pacing"><label class="field">Seconds between requests<input data-api-batch-live-delay type="number" min="0" max="3600" step="0.1" value="${run.delaySeconds}"></label><p class="caption">Applies within questions, too. Temporary rate limits wait and retry automatically.</p></div></div><div class="api-batch-actions"><button class="btn" data-action="api-batch-pause"${apiBatchReview.running?'':' disabled'}>${run.paused?'Resume':'Pause'}</button><button class="btn" data-action="skip-current-question"${apiBatchReview.running?'':' disabled'}>Skip Current Question</button><button class="btn danger" data-action="api-batch-stop"${apiBatchReview.running?'':' disabled'}>Stop Batch</button><button class="btn" data-action="api-batch-save-exit">Save & Exit</button></div></section><details class="api-batch-panel"><summary>Question activity & provider routes</summary><ol class="batch-workspace-api-log" data-api-question-log>${run.items.map(i=>`<li><code>${escapeHTML(i.questionId)}</code> — ${escapeHTML(apiBatchStatus(i.status))}${i.error?`<p>${escapeHTML(i.error)}</p>`:''}</li>`).join('')}</ol><ol class="batch-workspace-api-log" data-api-route-log>${(state.batchActivity?.routeHistory||[]).map(r=>`<li>${escapeHTML([r.questionID,r.label,r.provider,r.model].filter(Boolean).join(' · '))}</li>`).join('')}</ol></details>`;
    else if(stage==='finish'){
      const retry=run.items.filter(apiBatchNeedsRetry);
      main=`<header class="batch-workspace-heading"><h3>Finish & Retry</h3><p class="caption">Choose retries or end the task. Accepted changes stay saved.</p></header><details open class="api-batch-panel"><summary>Questions to retry (${retry.length})</summary><div class="api-batch-actions"><button class="btn small" data-action="api-batch-select-retries" data-selection="all">Select all</button><button class="btn small" data-action="api-batch-select-retries" data-selection="none">Clear all</button><span data-api-retry-count>${retry.filter(i=>i.retrySelected!==false).length} selected</span></div><div class="api-batch-retries">${retry.map(i=>`<label><input type="checkbox" data-api-retry="${escapeAttr(i.questionId)}"${i.retrySelected!==false?' checked':''}><span><code>${escapeHTML(i.questionId)}</code><small>${escapeHTML(i.error||apiBatchStatus(i.status))}</small></span><span class="pill">${escapeHTML(apiBatchStatus(i.status))}</span></label>`).join('')||'<p class="caption">No questions need retry.</p>'}</div><button class="btn primary" data-action="api-batch-retry-selected"${retry.some(i=>i.retrySelected!==false)&&!apiBatchReview.running?'':' disabled'}>Retry Selected Questions</button></details><section class="api-batch-panel"><h4>End this task</h4><p>${c.pending} awaiting review · ${c.waiting} awaiting request</p><p class="caption">Finish clears this task’s tracking. Accepted changes remain in the Question Bank.</p><button class="btn primary" data-action="api-batch-end"${apiBatchReview.running?' disabled':''}>Finish Review & End Task</button>${apiBatchReview.running?'<p class="caption">Stop the batch on Activity before ending the task.</p>':''}</section>`;
    }else{
      const index=Math.max(0,Math.min(run.items.length-1,Number(run.reviewIndex)||0)),item=run.items[index];run.reviewIndex=index;
      const acceptable=Boolean(item.proposed&&['pending','unchanged','rejected'].includes(item.status)),accepted=item.status==='accepted';
      main=`<header class="batch-workspace-heading"><h3>Review proposals</h3><p class="caption">Compare the original and proposed content. Accept saves; Reject restores accepted fields when they have not been edited later.</p></header><div class="api-batch-review-navigation"><div class="batch-workspace-navigation-pair"><button class="btn" data-action="api-batch-nav" data-direction="-1"${index?'':' disabled'}>Previous</button><button class="btn" data-action="api-batch-nav" data-direction="1"${index<run.items.length-1?'':' disabled'}>Next</button></div><label class="field api-batch-question-jump">Go to question (${index+1} of ${run.items.length})<select data-api-batch-jump>${run.items.map((i,n)=>`<option value="${n}"${index===n?' selected':''}>${n+1}. ${escapeHTML(i.questionId)} — ${escapeHTML(apiBatchStatus(i.status))}</option>`).join('')}</select></label><div class="api-batch-actions api-batch-bulk-actions"><button class="btn" data-action="api-batch-bulk" data-decision="accept"${run.items.some(i=>i.proposed&&['pending','unchanged','rejected'].includes(i.status))&&!apiBatchReview.running?'':' disabled'}>Accept All</button><button class="btn" data-action="api-batch-bulk" data-decision="reject"${apiBatchReview.running?' disabled':''}>Reject All</button></div></div><section class="api-batch-panel manual-whole-review"><header class="api-batch-item-header"><h4>${escapeHTML(item.questionId)}</h4><span class="pill ${accepted?'green':acceptable?'blue':'yellow'}">${escapeHTML(apiBatchStatus(item.status))}</span></header>${item.error?`<div class="notice warning">${escapeHTML(item.error)}</div>`:''}${(item.warnings||[]).map(w=>`<div class="notice warning">${escapeHTML(w)}</div>`).join('')}${apiBatchReviewComparison(item,run)}<details><summary>Changed fields & audit details</summary><p class="caption">${escapeHTML((item.patch||[]).map(f=>f.path.join(' → ')).join(', ')||'No fields changed.')}</p><pre class="api-batch-audit">${escapeHTML(JSON.stringify((item.patch||[]).filter(f=>['additionalMetadata','generationMetadata'].includes(f.path[0])),null,2))}</pre></details></section>`;
    }
    return batchWorkspaceGrid(apiBatchRecoveryHTML(run)+main,apiBatchOverviewHTML(run));
  }
  function apiBatchShow(stage='review') {
    if(!apiBatchReview.run){showBatchSolutions({tab:'api'});return;}
    if(stage==='results')stage='review';if(stage==='setup'){showBatchSolutions({tab:'api'});return;}
    apiBatchReview.stage=stage;batchWorkspaceUI.apiStage=stage;state.aiBatchToolsTab='api';batchWorkspaceUI.apiOpen=true;
    const run=apiBatchReview.run,item=run.items[run.reviewIndex||0],acceptable=item?.proposed&&['pending','unchanged','rejected'].includes(item.status),review=stage==='review';
    const body=`<div class="ai-batch-tools-shell batch-workspace-shell api-batch-review-shell" data-api-review-run="${escapeAttr(run.runID)}">${aiBatchToolsTabsHTML('api')}${apiBatchStagesHTML(stage)}<div class="ai-batch-tools-context"><strong>API Batch</strong><span>${run.items.length} questions</span><span>${escapeHTML(batchOperationLabels(run.config).join(' · '))}</span></div>${apiBatchReview.error?`<div class="notice error" role="alert">${escapeHTML(apiBatchReview.error)}</div>`:''}<div class="ai-batch-tools-content ai-batch-tools-content-api">${apiBatchBodyHTML(stage)}</div></div>`;
    const footer=review?`<div class="api-batch-actions"><button class="btn primary" data-action="api-batch-decide" data-decision="accept"${acceptable&&!apiBatchReview.busy?'':' disabled'}>Accept & Next</button><button class="btn" data-action="api-batch-decide" data-decision="reject"${item?.proposed&&!apiBatchReview.busy?'':' disabled'}>${item?.acceptedPatch?'Reject & Restore Original':'Reject & Next'}</button><button class="btn" data-action="api-batch-retry-one"${apiBatchReview.running||apiBatchReview.busy?' disabled':''}>Retry This Question</button></div><div class="api-batch-actions"><button class="btn" data-action="api-batch-save-exit">Save & Exit</button><button class="btn" data-action="api-batch-stage" data-stage="finish">Finish & Retry</button></div>`:`<span class="caption">Proposals are saved only after you accept them.</span><div class="api-batch-actions">${stage==='activity'?'':'<button class="btn" data-action="api-batch-save-exit">Save & Exit</button>'}<button class="btn" data-action="api-batch-stage" data-stage="review">Review Available Results</button></div>`;
    const mount=layer=>{normalizeAIBatchToolsHeader(layer);layer.classList.add('api-batch-modal');layer.querySelector('.modal').classList.add('wide','batch-workspace-modal');apiBatchMountTaskControls(layer);layer.dataset.apiReviewItem=review&&item?[item.questionId,item.status,item.stagedAt||''].join(':'):'';layer.querySelector('.modal-body').scrollTop=0;apiBatchRefresh();typeset(layer);};
    const layer=currentAIBatchToolsLayer();if(layer)replaceAIBatchToolsModalContent(layer,body,footer,mount);else showModal({title:'AI Batch Tools',body,footer,wide:true,onMount:mount});
  }
  function apiBatchMountSetupOperations(layer) {
    const content=layer.querySelector('.compact-batch-api'),grid=content?.closest('.batch-workspace-grid'),operations=content?.querySelector('.batch-operation-groups');
    if(!grid||!operations||operations.hasAttribute('data-api-setup-operations'))return;
    grid.classList.add('api-batch-setup-grid');operations.setAttribute('data-api-setup-operations','');
    const rows=batchWorkspaceElement('<div class="batch-workspace-operation-column api-batch-operation-rows"></div>');
    for(const group of operations.querySelectorAll('.batch-operation-group')){
      const title=group.querySelector('h3'),heading=batchWorkspaceElement('<header class="api-batch-operation-heading"></header>'),choices=batchWorkspaceElement('<div class="api-batch-operation-choices"></div>');
      if(title)heading.append(title);
      const children=[...group.children],primary=children.filter(node=>node.matches('label')&&node.querySelector('[data-batch-operation]'));
      const notes=children.filter(node=>node.matches('p'));
      const settings=children.filter(node=>!primary.includes(node)&&!notes.includes(node));
      notes.forEach(node=>{node.classList.add('api-batch-operation-note');choices.append(node);});
      primary.forEach(node=>{node.classList.add('api-batch-operation-choice');choices.append(node);});
      settings.forEach(node=>{node.classList.add('api-batch-operation-settings');choices.append(node);});
      if(primary.length===1)group.classList.add('api-batch-single-operation');
      if(group.querySelector('#batch-generate-solutions')||choices.querySelector('#batch-generate-solutions'))group.dataset.apiOperationCategory='solutions';
      group.replaceChildren(heading,choices);rows.append(group);
    }
    // Move the existing controls, preserving their listeners, selections, and
    // original IDs. One column wrapper prevents the shared mount from restacking.
    operations.replaceChildren(rows);
    const guide=grid.querySelector('.batch-workspace-guide'),intro=content.querySelector('.api-batch-intro');
    if(guide&&intro){const help=batchWorkspaceElement('<details class="api-batch-setup-guide"><summary>How this batch works</summary></details>');help.append(guide);intro.firstElementChild.append(help);}
  }
  const apiBatchSetupBase=showBatchSolutions;
  showBatchSolutions=function(options){
    const result=apiBatchSetupBase(options),layer=currentAIBatchToolsLayer();
    if(state.aiBatchToolsTab==='api'&&layer&&!layer.querySelector('[data-api-review-run]')){
      layer.classList.add('api-batch-modal');const content=layer.querySelector('.compact-batch-api');
      layer.querySelector('.batch-workspace-stages')?.replaceWith(batchWorkspaceElement(apiBatchStagesHTML('setup')));
      const footer=layer.querySelector('.modal-footer');footer?.querySelector('[data-action="close-modal"]')?.remove();
      const generate=footer?.querySelector('[data-action="start-batch-solutions"]');if(generate)generate.textContent='Generate Proposals';
      if(content&&!content.querySelector('#api-batch-delay'))content.prepend(batchWorkspaceElement(`<section class="api-batch-panel api-batch-intro"><div><h3>Generate, review, then save</h3><p class="caption">Choose the scope and operations. Review the proposals before accepting changes.</p></div><div class="api-batch-pacing"><label class="field">Seconds between API requests<input id="api-batch-delay" type="number" min="0" max="3600" step="0.1" value="${Math.max(0,Number(state.settings.apiBatchRequestDelaySeconds??state.settings.requestDelaySeconds??1))}"></label><p class="caption">Runs the full batch before review. Temporary rate limits wait and retry automatically.</p></div></section>`));
      const aside=layer.querySelector('.batch-workspace-aside');if(aside)aside.innerHTML='<section class="batch-workspace-overview"><h3>How it works</h3><ol class="batch-workspace-guide"><li>Choose operations and pacing.</li><li>Generate proposals automatically.</li><li>Review each question or accept/reject all.</li><li>Retry selected questions or finish.</li></ol></section>';
      apiBatchMountSetupOperations(layer);
      const resume=()=>{if(!layer.isConnected||state.aiBatchToolsTab!=='api')return;apiBatchMountTaskControls(layer);const start=layer.querySelector('[data-action="start-batch-solutions"]');if(apiBatchReview.run){if(start){start.disabled=true;start.textContent='Task already open';}if(content&&!content.querySelector('[data-api-resume]'))content.prepend(batchWorkspaceElement(`<section class="api-batch-panel" data-api-resume><h4>An API task is available.</h4><p>Saved proposals and review decisions are kept. Continue its unfinished work or return to review.</p><div class="api-batch-actions">${!apiBatchReview.running&&apiBatchReview.run.items.some(apiBatchUnfinished)?'<button class="btn primary" data-action="api-batch-resume-work">Resume Unfinished Work</button>':''}<button class="btn" data-action="api-batch-stage" data-stage="review">Resume API Review</button><button class="btn" data-action="api-batch-stage" data-stage="activity">View Activity</button></div>${apiBatchReview.run.accessBlock?'<p class="caption">API access needs attention. Save & Exit to update Settings, then return here to resume.</p>':''}</section>`));}if(apiBatchReview.error&&!content?.querySelector('[data-api-storage-error]'))content?.prepend(batchWorkspaceElement(`<div class="notice error" data-api-storage-error>${escapeHTML(apiBatchReview.error)}</div>`));};
      void apiBatchReviewReady.then(resume);resume();
    }else if(layer&&state.aiBatchToolsTab==='manual'){layer.classList.remove('api-batch-modal');const actions=layer.querySelector('.api-batch-header-actions');if(actions){const close=actions.querySelector('[data-action="close-modal"]');if(close)actions.before(close);actions.remove();}}return result;
  };
  const apiBatchShowStageBase=batchWorkspaceShowAPIStage;
  batchWorkspaceShowAPIStage=function(stage){return apiBatchReview.run?apiBatchShow(stage):apiBatchShowStageBase(stage);};
  document.addEventListener('change',event=>{
    const target=event.target;
    if(apiBatchReview.restarting&&target.matches('[data-api-batch-jump],[data-api-batch-live-delay],[data-api-retry]'))return;
    if(target.matches('[data-api-batch-jump]')){apiBatchReview.run.reviewIndex=Number(target.value)||0;void apiBatchReviewPersist();apiBatchShow('review');}
    else if(target.matches('[data-api-batch-live-delay]')){if(!target.reportValidity())return;apiBatchReview.run.delaySeconds=Number(target.value);state.settings.apiBatchRequestDelaySeconds=apiBatchReview.run.delaySeconds;saveSettings();void apiBatchReviewPersist();}
    else if(target.matches('[data-api-retry]')){const run=apiBatchReview.run;run.items.find(i=>i.questionId===target.dataset.apiRetry).retrySelected=target.checked;void apiBatchReviewPersist();const panel=target.closest('details');panel.querySelector('[data-api-retry-count]').textContent=`${panel.querySelectorAll('[data-api-retry]:checked').length} selected`;panel.querySelector('[data-action="api-batch-retry-selected"]').disabled=!panel.querySelector('[data-api-retry]:checked')||apiBatchReview.running;}
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');if(!button||!button.dataset.action.startsWith('api-batch-'))return;
    event.preventDefault();event.stopImmediatePropagation();if(button.disabled||apiBatchReview.busy&&!['api-batch-pause','api-batch-stop','api-batch-stage','api-batch-save-exit','api-batch-restart'].includes(button.dataset.action))return;
    const action=button.dataset.action,run=apiBatchReview.run;
    if(apiBatchReview.restarting)return;
    if(action==='api-batch-restart'){void apiBatchRestart();return;}
    if(action==='api-batch-stage'){apiBatchShow(button.dataset.stage);return;}
    if(action==='api-batch-nav'){run.reviewIndex=Math.max(0,Math.min(run.items.length-1,run.reviewIndex+Number(button.dataset.direction)));void apiBatchReviewPersist();apiBatchShow('review');return;}
    if(action==='api-batch-pause'){run.paused=!run.paused;void apiBatchReviewPersist();apiBatchRefresh();return;}
    if(action==='api-batch-stop'){run.cancelRequested=true;requestQuestionBankBatchCancellation();apiBatchRefresh();return;}
    if(action==='api-batch-save-exit'){void apiBatchSaveExit().catch(error=>{apiBatchReview.error='Progress could not be saved: '+error.message;apiBatchShow(apiBatchReview.stage);});return;}
    if(action==='api-batch-select-retries'){run.items.filter(apiBatchNeedsRetry).forEach(i=>i.retrySelected=button.dataset.selection==='all');void apiBatchReviewPersist();apiBatchShow('finish');return;}
    apiBatchReview.busy=true;apiBatchReview.error='';currentAIBatchToolsLayer()?.querySelectorAll('[data-action^="api-batch-"]').forEach(b=>{if(b.dataset.action==='api-batch-restart')b.disabled=!apiBatchReview.running;else if(!['api-batch-pause','api-batch-stop','api-batch-save-exit'].includes(b.dataset.action))b.disabled=true;});
    const work=async()=>{
      if(action==='api-batch-decide')await apiBatchResolve(run.items[run.reviewIndex],button.dataset.decision);
      if(action==='api-batch-bulk')await apiBatchBulk(button.dataset.decision);
      if(action==='api-batch-resume-work')await apiBatchResumeWork();
      if(action==='api-batch-retry-one')await apiBatchRetry([run.items[run.reviewIndex].questionId]);
      if(action==='api-batch-retry-selected')await apiBatchRetry(run.items.filter(i=>apiBatchNeedsRetry(i)&&i.retrySelected!==false).map(i=>i.questionId));
      if(action==='api-batch-end')await apiBatchEnd();
    };
    void work().catch(error=>{apiBatchReview.error=error.message;}).finally(()=>{apiBatchReview.busy=false;if(apiBatchReview.run&&currentAIBatchToolsLayer()?.querySelector('[data-api-review-run]'))apiBatchShow(apiBatchReview.stage);});
  },true);
