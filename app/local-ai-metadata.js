  // Local AI diagnostics contain counts and timing, never prompts, keys, answers,
  // or reasoning text. The bounded in-memory log is cleared on page reload.
  const localAITraceState={requestNumber:0,pipelineNumber:0,records:[],pipelines:[],responses:new WeakMap()};
  function localAITraceStart(prompt,options,config) {
    return {pipelineId:++localAITraceState.pipelineNumber,operation:String(options.operation||'Local AI request'),profile:options.localMetadata?'metadata':'general',role:options.localRole||'primary',attempt:Number(options.localRetry)||0,requestNumber:0,json:Boolean(options.json),model:options.model||config.model};
  }
  function localAITracePublish(record) {
    console.debug('[FE Local AI]',JSON.stringify(record));
  }
  const localAITraceFetchBase=fetchLocalAI;
  fetchLocalAI=async function(endpoint,init={}) {
    const {localTrace,...request}=init;
    if(!localTrace)return localAITraceFetchBase(endpoint,request);
    let body={};try{body=JSON.parse(request.body||'{}');}catch{}
    if(localTrace.profile==='metadata') {
      const capability=localMetadataCompatibility.get(endpoint+'|'+body.model)||{};
      if(body.messages&&body.max_tokens!=null){
        delete body.enableThinking;
        if(capability.thinking!==false)body.reasoning_effort='none';
        if(capability.schema===false&&body.response_format?.type==='json_schema')body.response_format={type:'json_object'};
        if(capability.json===false)delete body.response_format;
      }else if(body.input!=null){delete body.enableThinking;if(capability.thinking!==false)body.reasoning={effort:'none'};else delete body.reasoning;}
      request.body=JSON.stringify(body);
    }
    const prompt=body.messages?.map(message=>String(message.content||'')).join('')||body.input||body.prompt||'';
    const record={pipelineId:localTrace.pipelineId,operation:localTrace.operation,model:body.model||localTrace.model,requestNumber:++localAITraceState.requestNumber,pipelineRequest:++localTrace.requestNumber,retryNumber:localTrace.attempt+Math.max(0,localTrace.requestNumber-1),role:localTrace.role,supportRequired:localTrace.role==='support',repairRequired:localTrace.role==='support'||localTrace.role==='repair',endpointProtocol:localTrace.protocol||new URL(endpoint).pathname,promptCharacters:String(prompt).length,promptTokens:null,promptTokensEstimate:Math.ceil(String(prompt).length/4),completionTokens:null,reasoningTokens:null,outputBudget:body.max_tokens??body.max_output_tokens??body.options?.num_predict??null,thinkingControl:body.enableThinking===false||body.think===false?'off requested':body.reasoning?.effort||body.reasoning_effort||'server default',responseFormat:body.response_format?.type||body.format||'text',startedAt:nowISO(),durationMilliseconds:0,jsonValidation:null,validationStage:'not checked',status:'requesting'};
    localAITraceState.records.push(record);if(localAITraceState.records.length>200)localAITraceState.records.shift();
    const started=performance.now();localAITraceStarted.set(record,started);
    try {
      const response=await localAITraceFetchBase(endpoint,request);
      record.httpStatus=response.status;record.status=response.ok?'response received':'HTTP error';
      localAITraceState.responses.set(response,record);return response;
    }catch(error){record.status=isAICancellation(error)?'cancelled':'request failed';record.errorCode=error.code||error.name;throw error;}
    finally{record.durationMilliseconds=Math.round(performance.now()-started);localAITracePublish(record);}
  };
  function localAITracePayload(response,data) {
    const record=localAITraceState.responses.get(response);if(!record)return;
    record.durationMilliseconds=Math.round(performance.now()-localAITraceStarted.get(record));
    const usage=data?.usage||{},stats=data?.stats||{};
    record.promptTokens=usage.prompt_tokens??usage.input_tokens??stats.input_tokens??data?.prompt_eval_count??null;
    record.completionTokens=usage.completion_tokens??usage.output_tokens??stats.total_output_tokens??data?.eval_count??null;
    record.reasoningTokens=usage.completion_tokens_details?.reasoning_tokens??usage.output_tokens_details?.reasoning_tokens??stats.reasoning_output_tokens??null;
    record.thinkingControlHonored=record.thinkingControl==='none'||record.thinkingControl==='off requested'?record.reasoningTokens===null?null:record.reasoningTokens===0:null;
    record.finishReason=data?.choices?.[0]?.finish_reason||data?.status||data?.done_reason||null;
    const decoded=decodeLocalAIResponsePayload(data);
    record.reasoningContentPresent=Boolean(data?.choices?.[0]?.message?.reasoning_content||data?.choices?.[0]?.message?.reasoning||decoded?.usedReasoning);
    if(record.responseFormat!=='text'){
      try{parseLooseJSON(decoded?.text||'');record.jsonValidation=true;record.validationStage='JSON syntax';}
      catch{record.jsonValidation=false;record.validationStage='JSON syntax';}
    }
    localAITracePublish(record);
  }
  const localAITraceCallBase=callLocalAI;
  callLocalAI=async function(prompt,options={},config) {
    const localTrace=options.localTrace||localAITraceStart(prompt,options,config);
    try{return await localAITraceCallBase(prompt,{...options,localTrace},config);}
    catch(error){
      if(!options.localMetadata||isAICancellation(error))throw error;
      if(['LOCAL_AI_REASONING_TRUNCATED','LOCAL_AI_REASONING_ONLY'].includes(error.code)){
        error.localAIResponseDiagnosis={...error.localAIResponseDiagnosis,metadataProfile:true,outputBudget:options.maxTokens,thinkingControl:'none requested'};
        error.message=`The Local metadata request returned reasoning without usable final JSON (finish reason: ${error.localAIResponseDiagnosis.finishReason||'unknown'}; output allowance: ${options.maxTokens}). Check whether this model/server honors reasoning_effort=none. The general Local output budget does not control metadata requests.`;
      }
      const endpoint=localAICandidates(config.endpoint,config.protocol||'auto')[0].endpoint,key=endpoint+'|'+(options.model||config.model),capability=localMetadataCompatibility.get(key)||{};
      // One compatibility retry, only for an explicit HTTP parameter rejection.
      // Cache the rejected feature so it is not probed on every question.
      if(isLocalThinkingControlError(error)&&capability.thinking!==false)capability.thinking=false;
      else if(isLocalResponseFormatError(error)&&capability.schema!==false)capability.schema=false;
      else if(isLocalResponseFormatError(error)&&capability.json!==false)capability.json=false;
      else throw error;
      localMetadataCompatibility.set(key,capability);
      return localAITraceCallBase(prompt,{...options,localTrace,singleAttempt:true},config);
    }
  };
  const localAITraceStarted=new WeakMap(),localMetadataCompatibility=new Map();
  window.FE_LOCAL_AI_DIAGNOSTICS=Object.freeze({
    records:()=>cloneJSON(localAITraceState.records,[]),
    pipelines:()=>cloneJSON(localAITraceState.pipelines,[]),
    clear:()=>{localAITraceState.records.length=0;localAITraceState.pipelines.length=0;},
    table:()=>console.table(localAITraceState.records),
    export:()=>JSON.stringify({calls:localAITraceState.records,pipelines:localAITraceState.pipelines},null,2)
  });

  const LOCAL_METADATA_OUTPUT_TOKENS=512,LOCAL_METADATA_BATCH_SIZE=10;
  function localMetadataCleanJSON(text) {
    if(typeof text!=='string')return text;
    // Existing deterministic repairs handle fences, smart quotes, trailing
    // commas, JSON string escaping, and backslashes without another inference.
    const clean=text.replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
    try{return parseLooseJSON(clean);}catch(error){
      const containers=extractJSONContainers(clean);
      if(containers.length!==1)throw error;
      return parseLooseJSON(containers[0]);
    }
  }
  function localMetadataTraceValidation(trace,valid,detail='metadata schema and identity') {
    const record=[...localAITraceState.records].reverse().find(r=>r.pipelineId===trace.pipelineId);
    if(record){record.jsonValidation=valid;record.validationStage=detail;record.status=valid?'validated':'validation failed';localAITracePublish(record);}
  }
  function localMetadataRecoveryAllowed(error) {
    if(isAICancellation(error)||error.status||['AI_TIMEOUT','AI_NETWORK','LOCAL_AI_BROWSER_BLOCKED','LOCAL_AI_UNREACHABLE','API_BATCH_CHECKPOINT_STORAGE','LOCAL_METADATA_IDENTITY','LOCAL_METADATA_STALE'].includes(error.code))return false;
    return !/\bstale\b|older question|changed after|no longer|does not match|must echo|incompatible with the stored/i.test(error.message||'');
  }
  async function localMetadataInfer(prompt,schema,validate,config,operation,count=1) {
    const started=performance.now(),trace=localAITraceStart(prompt,{operation,localMetadata:true},config);
    const pipeline={pipelineId:trace.pipelineId,operation,questions:count,modelCalls:0,durationMilliseconds:0,supportRequired:false,repairRequired:false,validated:false};
    localAITraceState.pipelines.push(pipeline);if(localAITraceState.pipelines.length>100)localAITraceState.pipelines.shift();
    const options={config,json:true,jsonSchema:schema,temperature:0,maxTokens:LOCAL_METADATA_OUTPUT_TOKENS*count,timeoutSeconds:Number(state.settings.aiRequestTimeoutSeconds)||120,disableThinking:true,reasoningEffort:'none',operation,singleAttempt:true,localMetadata:true,localTrace:trace};
    let failure=null;
    try{for(let attempt=0;attempt<2;attempt++){
      if(attempt){
        if(!localMetadataRecoveryAllowed(failure))throw failure;
        const support=String(state.settings.localAISupportModel||'').trim();
        options.model=support||config.model;trace.role=support&&support!==config.model?'support':'repair';
        // Do not send the previous reasoning or the whole malformed response.
        prompt+='\nThe previous result failed validation. Return the complete requested JSON directly. Validation issue: '+String(failure.message||'invalid JSON').slice(0,240);
      }
      try{
        const raw=await callAI(prompt,options),parsed=localMetadataCleanJSON(raw),value=validate(parsed);
        localMetadataTraceValidation(trace,true);
        const result={value,model:options.model||config.model,trace};
        pipeline.validated=true;
        return result;
      }catch(error){failure=error;localMetadataTraceValidation(trace,false);if(!localMetadataRecoveryAllowed(error)||attempt)throw error;}
    }
    throw failure;
    }finally{pipeline.modelCalls=trace.requestNumber;pipeline.durationMilliseconds=Math.round(performance.now()-started);pipeline.supportRequired=trace.role==='support';pipeline.repairRequired=trace.role!=='primary';if(failure&&!pipeline.validated)pipeline.errorCode=failure.code||'METADATA_VALIDATION';}
  }
  function localMetadataSelectivePrompt(frozenList) {
    const groups=frozenList[0].requestedGroups,taxonomy={};
    frozenList.forEach(f=>Object.assign(taxonomy,f.modelProjection.taxonomy||{}));
    const shape=selectiveMetadataJSONSchema(frozenList[0]);
    // Full taxonomy is kept when Topic is selected: pruning based on current
    // labels would bias reclassification. It is shared once for a batch.
    const requests=frozenList.map(f=>({questionId:f.questionId,requestFingerprint:f.requestFingerprint,preservedContext:f.modelProjection.preservedContext,questionContext:f.modelProjection.questionContext}));
    return `Classify FE Civil metadata directly; no solving, answer verification, thinking, explanation, or content edits. Use only the supplied question context. Return JSON only.\nReturn every selected group and no others: ${JSON.stringify(groups)}. Preserve unselected Topic/Subtopic exactly; Subtopic must belong to the selected or preserved Topic. Question Type: computational or conceptual. Difficulty: numeric 0–100; 0–19 recognition, 20–39 one-step, 40–59 ordinary FE, 60–79 multi-concept, 80–89 demanding, 90–100 exceptional. Give a difficultyReason of at most 25 words. Tags: up to 6 short useful labels.\nResponse fields: schemaVersion="1.0", questionId, requestFingerprint, requestedGroups=${JSON.stringify(groups)}, metadata with exactly the selected keys (${Object.entries(shape.properties.metadata.properties).map(([key,type])=>key+':'+type.type).join(', ')}). Copy each ID and fingerprint exactly. ${frozenList.length>1?'Return {"results":[one response object per request]}.':'Return one response object.'}\nTaxonomy: ${JSON.stringify(taxonomy)}\nRequests: ${JSON.stringify(requests)}`;
  }
  async function localMetadataSelective(question,frozen,config,operation=`Selective metadata reclassification ${question.id}`) {
    return localMetadataInfer(localMetadataSelectivePrompt([frozen]),selectiveMetadataJSONSchema(frozen),value=>selectiveMetadataParseResponse(value,frozen,question),config,operation);
  }
  const localMetadataAnalyzeBase=selectiveMetadataAnalyzeWithAPI;
  selectiveMetadataAnalyzeWithAPI=async function() {
    const config=aiConfig();if(config.provider!=='local')return localMetadataAnalyzeBase();
    const question=selectiveMetadataModalQuestion(),frozen=selectiveMetadataFreezeRequest(question,selectiveMetadataSelectionFromModal());
    selectiveMetadataState.apiRequest=frozen;
    const result=await localMetadataSelective(question,frozen,config),current=state.questions.find(q=>q.id===question.id);
    selectiveMetadataAssertCurrent(current,frozen);
    selectiveMetadataShowPreview(current,frozen,result.value,{source:`${selectiveMetadataSurfaceState.surface} api`,surface:selectiveMetadataSurfaceState.surface,provider:config.provider,model:result.model});
  };
  const localMetadataSingleBatchBase=selectiveMetadataBatchRunQuestion;
  selectiveMetadataBatchRunQuestion=async function(question,requestedGroups,source='API Batch selective metadata',aiConfigOverride=null) {
    const config=aiConfigOverride||aiConfig();if(config.provider!=='local')return localMetadataSingleBatchBase(question,requestedGroups,source,aiConfigOverride);
    const frozen=selectiveMetadataFreezeRequest(question,requestedGroups),result=await localMetadataSelective(question,frozen,config),current=state.questions.find(q=>q.id===question.id)||question;
    return selectiveMetadataApply(current,frozen,result.value,{source,provider:config.provider,model:result.model});
  };
  const localMetadataClassificationBase=classifyQuestionMetadata;
  classifyQuestionMetadata=async function(question,{replace=false}={}) {
    const config=aiConfig();if(config.provider!=='local')return localMetadataClassificationBase(question,{replace});
    const frozen=selectiveMetadataFreezeRequest(question,selectiveMetadataGroupOrder);
    const topic=canonicalTopic(question.topic),taxonomy=Object.fromEntries(TOPIC_NAMES.map(t=>[t,classificationSubtopicOptions(t)]));
    const prompt=`Classify FE Civil metadata directly. No solving, thinking, explanation, or question edits. Return one JSON object with topic, subtopic, questionType (computational/conceptual), difficultyScore (0–100), difficultyReason (at most 25 words), unitSystem (SI/United States customary/Mixed/Unitless / Not applicable), tags (up to 6 short labels), confidence (high/medium/low). Topic and Subtopic must match the taxonomy exactly. Difficulty bands: 0–39 foundation, 40–54 easy FE, 55–69 standard FE, 70–84 challenging FE, 85–100 advanced FE. ${replace?'Reclassify independently.':'Preserve existing canonical Topic/Subtopic; fill missing metadata only.'}\nTaxonomy: ${JSON.stringify(taxonomy)}\nCurrent: ${JSON.stringify({topic:TOPIC_NAMES.includes(topic)?topic:'',subtopic:exactClassificationSubtopic(topic,question.subtopic)||''})}\nQuestion: ${JSON.stringify({id:question.id,question:question.question,choices:question.choices,diagramTextAlternative:question.diagramTextAlternative||''})}`;
    const result=await localMetadataInfer(prompt,QUESTION_CLASSIFICATION_JSON_SCHEMA,parseQuestionClassification,config,`Classify question metadata ${question.id}`);
    const current=state.questions.find(q=>q.id===question.id)||question;
    selectiveMetadataAssertCurrent(current,frozen);
    return applyQuestionClassificationResult(question,result.value,{replace,provenance:{provider:config.provider,model:result.model}});
  };

  async function localMetadataConnectionTest() {
    const config=aiConfig();
    if(config.provider!=='local')return callAI('Reply with exactly: FE Civil Practice Lab connection successful.',{temperature:0,maxTokens:40});
    // This is a connectivity probe, not a general-generation budget test.
    // Give JSON room to finish and explicitly suppress metadata-style thinking.
    const schema={type:'object',additionalProperties:false,required:['connected'],properties:{connected:{type:'boolean',const:true}}};
    const result=await localMetadataInfer('Return only {"connected":true}. No thinking or explanation.',schema,value=>{if(value?.connected!==true)throw new Error('The connection probe did not return connected=true.');return value;},config,'Local AI connection test');
    return 'FE Civil Practice Lab connection successful.';
  }

  function apiBatchLocalMetadataEligible(run,remaining) {
    return apiMetadataRequestSize(run)>1&&remaining.length>1&&apiBatchOperationKeys(run.config).length===1&&run.config.selectiveMetadata&&aiConfig().provider==='local';
  }
  function apiBatchLocalMetadataSlice(remaining) {
    const group=[];let characters=0;
    for(const item of remaining.slice(0,apiMetadataRequestSize(apiBatchReview.run))){
      const q=state.questions.find(q=>q.id===item.questionId),size=JSON.stringify({question:q?.question,choices:q?.choices,diagramTextAlternative:q?.diagramTextAlternative}).length;
      // Reduce grouping for unusually long records; never truncate the stem or
      // silently discard required classification context to meet the limit.
      if(group.length&&characters+size>32000)break;
      group.push(item);characters+=size;
    }
    return group;
  }
  function localMetadataBatchSchema(frozenList) {
    return {type:'object',additionalProperties:false,required:['results'],properties:{results:{type:'array',minItems:frozenList.length,maxItems:frozenList.length,items:selectiveMetadataJSONSchema(frozenList[0])}}};
  }
  function localMetadataBatchDecode(value,entries) {
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||!Array.isArray(value.results))throw new Error('Expected one JSON object containing results.');
    const requested=new Map(entries.map(entry=>[entry.frozen.questionId,entry])),found=new Map();
    for(const row of value.results){
      if(!row||!requested.has(row.questionId)||found.has(row.questionId))throw Object.assign(new Error('Batch contains an unknown or duplicate stable question ID.'),{code:'LOCAL_METADATA_IDENTITY'});
      const entry=requested.get(row.questionId);
      if(row.requestFingerprint!==entry.frozen.requestFingerprint)throw Object.assign(new Error('Batch fingerprint does not match its stable question ID.'),{code:'LOCAL_METADATA_IDENTITY'});
      try{found.set(row.questionId,{value:selectiveMetadataParseResponse(row,entry.frozen,entry.draft)});}
      catch(error){found.set(row.questionId,{error});}
    }
    for(const entry of entries)if(!found.has(entry.frozen.questionId))found.set(entry.frozen.questionId,{error:new Error('The batch omitted this question. Retry is available.')});
    return found;
  }
  async function localMetadataMany(entries,route,onValidated=async()=>{}) {
    const frozenList=entries.map(entry=>entry.frozen),operation=`Local metadata batch (${entries.length} questions)`;
    const primary=await localMetadataInfer(localMetadataSelectivePrompt(frozenList),localMetadataBatchSchema(frozenList),value=>localMetadataBatchDecode(value,entries),route,operation,entries.length);
    await onValidated(primary.value,primary.model);
    const failures=entries.filter(entry=>primary.value.get(entry.frozen.questionId)?.error);
    if(!failures.length)return {results:primary.value,model:primary.model};
    localMetadataTraceValidation(primary.trace,false,'metadata rows: partial validation failure');
    const pipeline=localAITraceState.pipelines.find(p=>p.pipelineId===primary.trace.pipelineId);if(pipeline)pipeline.validated=false;
    const invalid=failures.filter(entry=>localMetadataRecoveryAllowed(primary.value.get(entry.frozen.questionId).error));
    if(!invalid.length)return {results:primary.value,model:primary.model};
    // Valid rows are retained. Only missing/invalid rows receive one fallback,
    // never the questions which already passed the existing metadata validator.
    try{
      const support=String(state.settings.localAISupportModel||'').trim(),trace=localAITraceStart('',{operation:operation+' fallback',localMetadata:true,localRetry:1},route);
      state.batchActivity.currentID=invalid[0].item.questionId;
      state.batchActivity.currentDetail=`Recovering ${invalid.length} invalid metadata row${invalid.length===1?'':'s'}; validated proposals are preserved.`;apiBatchRefresh();
      trace.role=support&&support!==route.model?'support':'repair';
      const list=invalid.map(entry=>entry.frozen),prompt=localMetadataSelectivePrompt(list)+'\nReturn complete corrected metadata for only these failed rows.';
      const raw=await callAI(prompt,{config:route,model:support||route.model,json:true,jsonSchema:invalid.length===1?selectiveMetadataJSONSchema(list[0]):localMetadataBatchSchema(list),temperature:0,maxTokens:LOCAL_METADATA_OUTPUT_TOKENS*invalid.length,timeoutSeconds:Number(state.settings.aiRequestTimeoutSeconds)||120,disableThinking:true,reasoningEffort:'none',singleAttempt:true,localMetadata:true,localTrace:trace,operation:trace.operation});
      const parsed=localMetadataCleanJSON(raw),repaired=localMetadataBatchDecode(invalid.length===1?{results:[parsed]}:parsed,invalid);
      for(const entry of invalid){const result=repaired.get(entry.frozen.questionId);if(!result.error)result.model=support||route.model;primary.value.set(entry.frozen.questionId,result);}
      localMetadataTraceValidation(trace,!invalid.some(entry=>primary.value.get(entry.frozen.questionId)?.error));
    }catch(error){
      for(const entry of invalid)primary.value.set(entry.frozen.questionId,{error});
      if(isAICancellation(error)||error.status)return {results:primary.value,model:primary.model,interruption:error};
    }
    return {results:primary.value,model:primary.model};
  }
  async function apiBatchProcessLocalMetadataGroup(items,run,{resume=false}={}) {
    const entries=[];
    for(const item of items){
      const original=await apiBatchCurrent(item.questionId),checkpoint=resume&&item.checkpoint;
      if(!original){item.status='failed';item.error='Question is no longer available.';continue;}
      if(checkpoint&&apiBatchContentIdentity(original,run.config)!==checkpoint.identity){item.status='stale';item.error='The question changed since its checkpoint. Retry using the current question.';item.retryAttention=true;delete item.checkpoint;continue;}
      if(run.config.scope==='missing'&&!selectiveMetadataQuestionNeedsGroups(original,run.config.selectiveMetadataGroups)){item.status='unchanged';item.before=apiBatchClone(original);item.proposed=apiBatchClone(original);item.patch=[];item.identity=apiBatchContentIdentity(original,run.config);item.operations=['selectiveMetadata'];continue;}
      const before=apiBatchClone(checkpoint?.before||original),draft=apiBatchClone(checkpoint?.draft||before),identity=checkpoint?.identity||apiBatchContentIdentity(original,run.config);
      try{
        const frozen=selectiveMetadataFreezeRequest(draft,run.config.selectiveMetadataGroups);
        entries.push({item,before,draft,identity,frozen,previousStatus:item.status});
        item.checkpoint={before:apiBatchClone(before),draft:apiBatchClone(draft),identity,completed:[],successful:[],warnings:[]};item.status='processing';delete item.interruption;delete item.rateLimitExhausted;
      }catch(error){item.status='failed';item.error=error.message;item.retryAttention=true;}
    }
    if(!entries.length)return items;
    state.batchActivity.currentID=entries[0].item.questionId;
    state.batchActivity.currentDetail=`Classifying ${entries.length} questions in one Local AI request. Review starts after the full selection finishes.`;
    await apiBatchCheckpointPersist();apiBatchRefresh();
    const stageValid=async(results,model)=>{
      for(const entry of entries){
        const {item,before,identity,frozen}=entry,proposal=results.get(item.questionId);if(entry.staged||!proposal||proposal.error)continue;
        const current=await apiBatchCurrent(item.questionId);
        if(!current||apiBatchContentIdentity(current,run.config)!==identity){item.status='stale';item.error='Question content changed during generation. Existing saved content was preserved.';item.retryAttention=true;delete item.checkpoint;continue;}
        const draft=await selectiveMetadataApply(entry.draft,frozen,proposal.value,{source:'API batch proposal',provider:'local',model:proposal.model||model},{persist:false});
        item.before=before;item.proposed=apiBatchClone(draft);item.patch=apiBatchPatch(before,draft);item.identity=identity;item.operations=['selectiveMetadata'];item.status=item.patch.length?'pending':'unchanged';item.retryAttention=false;item.error='';item.warnings=[];item.stagedAt=nowISO();item.completedAt=nowISO();delete item.checkpoint;
        entry.staged=true;
      }
      await apiBatchCheckpointPersist();apiBatchRefresh();
    };
    try{
      await apiBatchWait(run);
      const route=apiBatchRoute('metadata','selectiveMetadata','Classify or reclassify metadata'),result=entries.length===1?await localMetadataSelective(entries[0].draft,entries[0].frozen,route):await localMetadataMany(entries,route,stageValid);
      const results=entries.length===1?new Map([[entries[0].frozen.questionId,{value:result.value}]]):result.results;
      await stageValid(results,result.model);
      for(const entry of entries){
        const {item}=entry,proposal=results.get(item.questionId);
        if(proposal?.error){
          const reason=isAICancellation(proposal.error)?aiCancellationReason(proposal.error):'';
          item.status=reason==='batch-skip-current'&&item.questionId===state.batchActivity.currentID?'skipped':item.proposed?entry.previousStatus:reason?'cancelled':'failed';
          item.error=proposal.error.message;item.retryAttention=true;
          if(reason)item.interruption=reason;if(item.status==='skipped')delete item.checkpoint;
        }
      }
      if(result.interruption){const access=apiBatchAccessIssue(result.interruption);if(access){run.accessBlock={kind:access,message:result.interruption.message,questionId:entries[0].item.questionId,at:nowISO()};run.suspendRequested=true;run.suspendReason=access;}}
      await apiBatchCheckpointPersist();return items;
    }catch(error){
      if(error.code==='API_BATCH_CHECKPOINT_STORAGE')throw error;
      if(isAICancellation(error)&&aiCancellationReason(error)==='batch-skip-current'){
        const first=entries[0].item;first.status='skipped';first.error='Skipped this question. Other questions in the interrupted request will continue.';first.interruption='batch-skip-current';delete first.checkpoint;
        for(const entry of entries.slice(1)){entry.item.status=entry.previousStatus;delete entry.item.interruption;}
        // Only the first displayed item was skipped. Revisit all other rows in
        // the interrupted provider batch through the normal next loop.
        return items.slice(0,items.indexOf(first)+1);
      }
      const access=apiBatchAccessIssue(error);
      if(access){run.accessBlock={kind:access,message:error.message,questionId:entries[0].item.questionId,at:nowISO()};run.suspendRequested=true;run.suspendReason=access;}
      for(const entry of entries){const item=entry.item;item.status=item.proposed?entry.previousStatus:isAICancellation(error)?'cancelled':'failed';item.error=error.message;item.retryAttention=true;if(isAICancellation(error))item.interruption=aiCancellationReason(error);}
      await apiBatchCheckpointPersist();return items;
    }
  }
