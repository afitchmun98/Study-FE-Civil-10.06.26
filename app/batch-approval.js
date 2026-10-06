  // Bounded approval work reuses the original guarded per-question writers.
  // The journal keeps each decision without copying a multi-thousand run on
  // every question. Existing Question Bank and review schemas stay unchanged.
  const batchApproval={job:null,database:null,tail:Promise.resolve(),ready:false,error:'',stats:{decisions:0,checkpoints:0,renders:0}};
  const batchApprovalKinds={generic:['manualSolutionBatch',MANUAL_SOLUTION_BATCH_STORAGE_KEY],questionText:['manualQuestionTextBatch',MANUAL_QUESTION_TEXT_BATCH_STORAGE_KEY],draftSolutions:['manualDraftSolutionBatch',MANUAL_DRAFT_SOLUTION_BATCH_STORAGE_KEY],draftDiagrams:['manualDiagramBatch',MANUAL_DIAGRAM_BATCH_STORAGE_KEY]};
  const batchApprovalMarker='batch-approval-indexeddb-1';
  function batchApprovalSize(){return [10,25,50,100,200].includes(Number(state.settings.batchApprovalSize))?Number(state.settings.batchApprovalSize):50;}
  function apiMetadataRequestSize(run){const value=Number(run?.config?.localMetadataBatchSize??state.settings.apiMetadataBatchSize??LOCAL_METADATA_BATCH_SIZE);return LOCAL_METADATA_BATCH_SIZE===1?1:Math.max(1,Math.min(20,Number.isInteger(value)?value:10));}
  function batchApprovalOptions(value){return [10,25,50,100,200].map(n=>`<option value="${n}"${n===value?' selected':''}>${n}</option>`).join('');}
  async function batchApprovalDB(){
    if(batchApproval.database)return batchApproval.database;
    return batchApproval.database=await new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME+'-Batch-Approval',1);request.onupgradeneeded=()=>{request.result.createObjectStore('sessions',{keyPath:'id'});const rows=request.result.createObjectStore('decisions',{keyPath:'id'});rows.createIndex('session','session');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  }
  async function batchApprovalStorage(mode,value){
    const db=await batchApprovalDB();return new Promise((resolve,reject)=>{
      const tx=db.transaction(['sessions','decisions'],mode==='get'?'readonly':'readwrite'),sessions=tx.objectStore('sessions'),rows=tx.objectStore('decisions');let result;
      if(mode==='get'){const request=sessions.getAll();request.onsuccess=()=>{result=request.result;const all=rows.getAll();all.onsuccess=()=>result={sessions:result,decisions:all.result};};}
      else if(mode==='decision')rows.put(value);
      else {if(mode==='delete')sessions.delete(value.id);else sessions.put(value);const request=rows.index('session').openCursor(IDBKeyRange.only(value.id));request.onsuccess=()=>{const cursor=request.result;if(cursor){cursor.delete();cursor.continue();}};}
      tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Approval checkpoint was not saved.'));
    });
  }
  function batchApprovalQueue(work){const write=batchApproval.tail.catch(()=>{}).then(work);batchApproval.tail=write;return write;}
  function batchApprovalPointer(kind,memory){const [,key]=batchApprovalKinds[kind];localStorage.setItem(key,JSON.stringify({schemaVersion:batchApprovalMarker,sessionID:memory.sessionID||'',kind}));}
  function batchApprovalUsesJournal(kind){try{return JSON.parse(localStorage.getItem(batchApprovalKinds[kind][1])||'null')?.schemaVersion===batchApprovalMarker;}catch{return false;}}
  async function batchApprovalManualCheckpoint(kind,memory){
    const sessionID=String(memory.sessionID||'');
    await batchApprovalQueue(()=>batchApprovalStorage('snapshot',{id:kind,kind,snapshot:memory}));
    // A late write from an ended task cannot replace a newer task's marker.
    if(String(state[batchApprovalKinds[kind][0]]?.sessionID||'')===sessionID&&String(memory.sessionID||'')===sessionID)batchApprovalPointer(kind,memory);
    batchApproval.stats.checkpoints++;
  }
  const batchApprovalReady=(async()=>{
    try{
      const records=await batchApprovalStorage('get');await apiBatchReviewReady;
      // initialize() loads legacy sessions; hydrate after that load has finished.
      while(!state.db||!state.settings)await new Promise(resolve=>setTimeout(resolve,10));
      for(const saved of records.sessions){
        const deltas=records.decisions.filter(row=>row.session===saved.id);
        if(saved.kind==='api'){
          if(apiBatchReview.run?.runID!==saved.snapshot.runID)continue;
          for(const row of deltas){const index=apiBatchReview.run.items.findIndex(i=>i.questionId===row.item.questionId);if(index>=0)apiBatchReview.run.items[index]=row.item;}
          if(deltas.length)await apiBatchReviewPersist();await batchApprovalStorage('delete',{id:saved.id});
        }else if(batchApprovalKinds[saved.kind]&&batchApprovalUsesJournal(saved.kind)){
          const [,key]=batchApprovalKinds[saved.kind],marker=JSON.parse(localStorage.getItem(key));if(marker.sessionID!==(saved.snapshot.sessionID||''))continue;
          const memory=saved.snapshot;
          for(const row of deltas){const index=memory.reviewItems.findIndex(i=>i.id===row.item.id);if(index>=0)memory.reviewItems[index]=row.item;else memory.reviewItems.push(row.item);Object.assign(memory.outcomes||={},row.outcomes);}
          state[batchApprovalKinds[saved.kind][0]]=memory;if(saved.kind==='questionText')state.manualQuestionTextBatchLoaded=true;
          if(deltas.length)await batchApprovalManualCheckpoint(saved.kind,memory);
        }
      }
    }catch(error){batchApproval.error='Saved approval review could not be restored: '+error.message;}finally{batchApproval.ready=true;}
  })();
  // During a locked bulk decision, the ledger has already been normalized.
  // Returning its live objects avoids repeatedly deep-cloning all proposals.
  for(const [kind,name,base] of [
    ['generic','ensureManualSolutionBatchState',ensureManualSolutionBatchState],['questionText','ensureManualQuestionTextBatchState',ensureManualQuestionTextBatchState],['draftSolutions','ensureManualDraftSolutionBatchState',ensureManualDraftSolutionBatchState],['draftDiagrams','ensureManualDiagramBatchState',ensureManualDiagramBatchState]
  ]){
    const wrapped=function(){return batchApproval.job?.kind===kind?batchApproval.job.memory:base();};
    if(name==='ensureManualSolutionBatchState')ensureManualSolutionBatchState=wrapped;
    else if(name==='ensureManualQuestionTextBatchState')ensureManualQuestionTextBatchState=wrapped;
    else if(name==='ensureManualDraftSolutionBatchState')ensureManualDraftSolutionBatchState=wrapped;
    else ensureManualDiagramBatchState=wrapped;
  }
  const batchApprovalMemoryBase=manualReviewMemory,batchApprovalLedgerBase=manualWholeSelectionEnsureLedger,batchApprovalTextItemsBase=manualQuestionTextWholeReviewItems;
  manualReviewMemory=function(kind='generic'){return batchApproval.job?.kind===kind?batchApproval.job.memory:batchApprovalMemoryBase(kind);};
  manualWholeSelectionEnsureLedger=function(memory){return batchApproval.job?.memory===memory?memory.reviewItems:batchApprovalLedgerBase(memory);};
  manualQuestionTextWholeReviewItems=function(memory){return batchApproval.job?.kind==='questionText'&&batchApproval.job.memory===memory?batchApproval.job.items:batchApprovalTextItemsBase(memory);};
  function batchApprovalPersistManual(kind,base){
    if(batchApproval.job?.kind===kind)return;
    if(!batchApprovalUsesJournal(kind))return base();
    const memory=batchApprovalMemoryBase(kind),[,key]=batchApprovalKinds[kind],marker=JSON.parse(localStorage.getItem(key));
    if(String(memory.sessionID||'')!==String(marker.sessionID||'')){
      // Reset/finish is synchronous in the original tools. Invalidate recovery
      // before their UI closes; queued disk cleanup must not resurrect it.
      localStorage.removeItem(key);base();void batchApprovalQueue(()=>batchApprovalStorage('delete',{id:kind})).catch(()=>{});return;
    }
    // Ordinary one-question decisions continue to save the same session after
    // a large review has moved beyond localStorage's quota.
    void batchApprovalManualCheckpoint(kind,memory).catch(error=>{batchApproval.error='Review recovery could not be saved: '+error.message;toast(batchApproval.error,'error');});
  }
  const batchApprovalPersistGenericBase=persistManualSolutionBatchSession,batchApprovalPersistTextBase=persistManualQuestionTextBatchState,batchApprovalPersistDraftBase=persistManualDraftSolutionBatchSession,batchApprovalPersistDiagramBase=persistManualDiagramBatchSession;
  persistManualSolutionBatchSession=()=>batchApprovalPersistManual('generic',batchApprovalPersistGenericBase);
  persistManualQuestionTextBatchState=()=>batchApprovalPersistManual('questionText',batchApprovalPersistTextBase);
  persistManualDraftSolutionBatchSession=()=>batchApprovalPersistManual('draftSolutions',batchApprovalPersistDraftBase);
  persistManualDiagramBatchSession=()=>batchApprovalPersistManual('draftDiagrams',batchApprovalPersistDiagramBase);
  runManualReviewUIAction=async function(work){
    if(manualReviewActionBusy)return;manualReviewActionBusy=true;manualReviewLockControls(currentAIBatchToolsLayer(),true);
    try{const result=await work();await batchApproval.tail;return result;}finally{manualReviewActionBusy=false;manualReviewLockControls(currentAIBatchToolsLayer(),false);}
  };
  function batchApprovalManualEligible(item,kind,decision,all){
    if(decision==='accept')return ['pending','proposal_pending','unchanged'].includes(item.status)||(all&&item.status==='rejected'&&(kind==='questionText'?item.proposedQuestion:item.proposed));
    return ['pending','proposal_pending','accepted','unchanged','reviewed_unchanged','needs_retry','failed_validation','stale','missing_response','awaiting_batch'].includes(item.status);
  }
  function batchApprovalProgress(){
    const job=batchApproval.job,region=currentAIBatchToolsLayer()?.querySelector('[data-batch-approval-progress]');if(!job||!region)return;
    region.hidden=false;region.querySelector('progress').max=Math.max(1,job.total);region.querySelector('progress').value=job.attempted;
    region.querySelector('[data-batch-approval-status]').textContent=`${job.decision==='accept'?'Approving':'Rejecting'}: ${job.resolved} saved · ${job.attempted} of ${job.total} checked${job.failures.length?` · ${job.failures.length} need attention`:''}${job.stopping?' · stopping after this question':''}`;
    const stop=region.querySelector('button');stop.disabled=job.stopping;
  }
  async function batchApprovalCheckpoint(job){
    if(job.kind==='api'){await apiBatchReviewPersist();await batchApprovalQueue(()=>batchApprovalStorage('snapshot',{id:job.key,kind:'api',snapshot:{runID:apiBatchReview.run.runID}}));batchApproval.stats.checkpoints++;}
    else await batchApprovalManualCheckpoint(job.kind,job.memory);
  }
  async function batchApprovalRun(kind,decision,{all=true}={}){
    await batchApprovalReady;if(batchApproval.error)throw new Error(batchApproval.error);if(batchApproval.job)throw new Error('An approval group is already being saved.');
    if(kind==='api'&&apiBatchReview.running)throw new Error('Stop generation before approving a group.');
    const memory=kind==='api'?apiBatchReview.run:batchApprovalMemoryBase(kind);if(!memory)throw new Error('No review task is open.');
    const items=kind==='api'?memory.items:kind==='questionText'?batchApprovalTextItemsBase(memory):batchApprovalLedgerBase(memory);
    const eligible=items.filter(item=>kind==='api'?decision==='accept'?item.proposed&&(['pending','unchanged'].includes(item.status)||(all&&item.status==='rejected')):item.proposed||item.acceptedPatch:batchApprovalManualEligible(item,kind,decision,all));
    const size=batchApprovalSize(),selected=all?eligible:eligible.slice(0,size),job={kind,memory,items,key:kind==='api'?'api:'+memory.runID:kind,decision,total:selected.length,attempted:0,resolved:0,failures:[],stopping:false,size};batchApproval.job=job;
    try{
      // Persist the starting authority before any Question Bank writes.
      if(kind==='api')await batchApprovalQueue(()=>batchApprovalStorage('snapshot',{id:job.key,kind,snapshot:{runID:memory.runID}}));else await batchApprovalManualCheckpoint(kind,memory);
      const layer=currentAIBatchToolsLayer();layer?.querySelectorAll('button,input,select,textarea').forEach(control=>{control.dataset.approvalDisabled=String(control.disabled);control.disabled=true;});const stop=layer?.querySelector('[data-action="batch-approval-stop"]');if(stop)stop.disabled=false;batchApprovalProgress();
      for(const selectedItem of selected){
        if(job.stopping)break;
        const item=kind==='api'?selectedItem:memory.reviewItems.find(i=>i.id===selectedItem.id)||selectedItem;
        try{
          if(kind==='api')await apiBatchResolve(item,decision,false,{persist:false,refresh:false});
          else{
            const action=decision==='accept'&&item.status==='unchanged'?'mark_reviewed':decision==='reject'&&['needs_retry','failed_validation','stale','missing_response','awaiting_batch'].includes(item.status)?'leave_unchanged':decision;
            await resolveManualWholeReviewAction(kind,item.id,action,{advance:false,refresh:false});
            if(decision==='reject'){const kept=memory.reviewItems.find(i=>i.questionId===item.questionId&&i.status==='accepted');if(kept)await resolveManualWholeReviewAction(kind,kept.id,'reject',{advance:false,refresh:false});}
          }
          job.resolved++;
        }catch(error){job.failures.push(`${item.questionId}: ${error.message}`);if(kind==='api'){item.error=error.message;item.retryAttention=true;}}
        job.attempted++;batchApproval.stats.decisions++;
        // Only the changed decision is cloned here; no full-session redraw or
        // serialization occurs between group checkpoints. Saves retain undo.
        const live=kind==='api'?item:memory.reviewItems.find(i=>i.questionId===item.questionId)||item;
        await batchApprovalQueue(()=>batchApprovalStorage('decision',{id:job.key+':'+live.id+':'+live.questionId,session:job.key,item:live,outcomes:kind==='api'?{}:{[live.draftId||live.questionId]:memory.outcomes?.[live.draftId||live.questionId]}}));
        if(job.attempted%size===0)await batchApprovalCheckpoint(job);
        if(job.attempted%5===0){batchApprovalProgress();await new Promise(resolve=>setTimeout(resolve,0));}
      }
      if(job.attempted%size!==0)await batchApprovalCheckpoint(job);
      if(kind==='api')await batchApprovalQueue(()=>batchApprovalStorage('delete',{id:job.key}));
      return {resolved:job.resolved,errors:job.failures,stopped:job.stopping,attempted:job.attempted};
    }finally{
      batchApproval.job=null;const layer=currentAIBatchToolsLayer();layer?.querySelectorAll('[data-approval-disabled]').forEach(control=>{control.disabled=control.dataset.approvalDisabled==='true';delete control.dataset.approvalDisabled;});
      renderApp();batchApproval.stats.renders++;
      if(kind==='api'){if(apiBatchReview.run&&layer?.querySelector('[data-api-review-run]'))apiBatchShow('review');}
      else if(layer?.querySelector('.manual-whole-review'))showManualWholeSelectionReview(kind);
      toast(`${job.resolved} question${job.resolved===1?'':'s'} ${decision==='accept'?'accepted or marked unchanged':'rejected'}.${job.stopping?' Stopped; remaining proposals are kept.':''}${job.failures.length?` ${job.failures.length} require attention: ${job.failures[0]}`:''}`,job.failures.length?'warning':'success');
    }
  }
  apiBatchBulk=async function(decision,options){return batchApprovalRun('api',decision,options);};
  bulkManualWholeReview=async function(kind,decision,options){return batchApprovalRun(kind,decision,options);};
  function batchApprovalControls(kind,count){return `<section class="batch-approval-controls" aria-label="Save review in groups"><div class="batch-approval-row"><label class="field">Approval group size<select data-batch-approval-size aria-label="Approval group size">${batchApprovalOptions(batchApprovalSize())}</select></label><button class="btn primary" data-action="batch-approval-next" data-review-kind="${escapeAttr(kind)}"${count&&!(kind==='api'&&(apiBatchReview.running||apiBatchReview.busy))?'':' disabled'}>${count?`Approve next ${Math.min(batchApprovalSize(),count)}`:'No pending approvals'}</button><span class="caption">${count} awaiting approval · skips rejected and invalid proposals</span></div><p class="caption">Accept All also saves in groups of ${batchApprovalSize()}, with a checkpoint after each group.</p><div data-batch-approval-progress hidden role="status" aria-live="polite"><span data-batch-approval-status></span><progress value="0" max="1" aria-label="Approval progress"></progress><button class="btn" data-action="batch-approval-stop">Stop saving</button></div></section>`;}
  function batchApprovalMount(kind){
    const layer=currentAIBatchToolsLayer();if(!layer||layer.querySelector('.batch-approval-controls'))return;
    const root=kind==='api'?layer.querySelector('.api-batch-bulk-actions'):layer.querySelector('.manual-whole-review-header');if(!root)return;
    const memory=kind==='api'?apiBatchReview.run:batchApprovalMemoryBase(kind),items=kind==='api'?memory.items:kind==='questionText'?batchApprovalTextItemsBase(memory):batchApprovalLedgerBase(memory),count=items.filter(item=>kind==='api'?item.proposed&&['pending','unchanged'].includes(item.status):batchApprovalManualEligible(item,kind,'accept',false)).length;
    root.after(batchWorkspaceElement(batchApprovalControls(kind,count)));
  }
  const batchApprovalShowManualBase=showManualWholeSelectionReview;
  showManualWholeSelectionReview=function(kind='generic'){const result=batchApprovalShowManualBase(kind);batchApprovalMount(kind);return result;};
  const batchApprovalShowAPIBase=apiBatchShow;
  apiBatchShow=function(stage='review'){const result=batchApprovalShowAPIBase(stage);if(stage==='review'||stage==='results')batchApprovalMount('api');return result;};
  const batchApprovalSetupBase=showBatchSolutions;
  showBatchSolutions=function(options){
    if(!batchApproval.ready){void batchApprovalReady.then(()=>showBatchSolutions(options));return;}
    const result=batchApprovalSetupBase(options),layer=currentAIBatchToolsLayer();
    if(state.aiBatchToolsTab==='api'&&layer&&!layer.querySelector('[data-api-batch-request-size]')){
      const pacing=layer.querySelector('.api-batch-pacing');if(pacing){const run=apiBatchReview.run,value=apiMetadataRequestSize(run);pacing.append(batchWorkspaceElement(`<label class="field">Local metadata batch size<select id="api-batch-request-size" data-api-batch-request-size${run?' disabled':''}>${Array.from({length:20},(_,i)=>i+1).map(n=>`<option value="${n}"${n===value?' selected':''}>${n} question${n===1?'':'s'}</option>`).join('')}</select><span class="caption">Questions per request for Local metadata-only runs. Other operations process one question at a time.</span></label>`));}
    }return result;
  };
  document.addEventListener('change',event=>{
    const control=event.target;if(control.matches('[data-batch-approval-size]')){state.settings.batchApprovalSize=Number(control.value);saveSettings();const root=control.closest('.batch-approval-controls'),kind=root.querySelector('[data-review-kind]').dataset.reviewKind;root.remove();batchApprovalMount(kind);}
    else if(control.matches('[data-api-batch-request-size]')){state.settings.apiMetadataBatchSize=Number(control.value);saveSettings();}
  });
  // Window capture runs before both existing batch action dispatchers.
  window.addEventListener('click',event=>{
    const control=event.target.closest('[data-action]');if(!control||!currentAIBatchToolsLayer()?.contains(control))return;
    if(batchApproval.job){event.preventDefault();event.stopImmediatePropagation();if(control.dataset.action==='batch-approval-stop'){batchApproval.job.stopping=true;batchApprovalProgress();}return;}
    if(control.dataset.action!=='batch-approval-next'){
      if(control.dataset.action.startsWith('api-batch-'))queueMicrotask(()=>{const next=currentAIBatchToolsLayer()?.querySelector('[data-action="batch-approval-next"]');if(next&&(apiBatchReview.busy||apiBatchReview.running))next.disabled=true;});return;
    }
    event.preventDefault();event.stopImmediatePropagation();if(control.disabled)return;
    const kind=control.dataset.reviewKind;if(kind==='api'&&(apiBatchReview.busy||apiBatchReview.running)){toast('Wait for the current API action to finish.','warning');return;}const work=()=>batchApprovalRun(kind,'accept',{all:false});
    void (kind==='api'?work():runManualReviewUIAction(work)).catch(error=>toast('Approval stopped: '+error.message,'error'));
  },true);
  window.addEventListener('keydown',event=>{if(batchApproval.job&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();batchApproval.job.stopping=true;batchApprovalProgress();}},true);
