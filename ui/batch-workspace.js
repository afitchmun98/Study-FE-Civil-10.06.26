  // Presentation only: the frozen batch, import, review, undo, and provider
  // authorities above remain responsible for every data change.
  const batchWorkspaceUI = { stage:"", sessionID:"", apiStage:"setup", apiOpen:false, completedRunID:"", reviewing:false, mountedView:"", drafts:new Map(), pasteErrors:new Map(), selections:new Map() };
  function batchWorkspaceTask() {
    const text=ensureManualQuestionTextBatchState(),generic=ensureManualSolutionBatchState();
    if(text.sessionID)return {kind:"questionText",memory:text,vm:manualBatchSharedQuestionTextViewModel(text)};
    if(generic.sessionID)return {kind:"generic",memory:generic,vm:manualBatchSharedGenericViewModel(generic)};
    const operation=manualBatchOperationFromState(),type=operation==="solutionDiagrams"?"solution":"question";
    const queue=["questionDiagrams","solutionDiagrams"].includes(operation)?ensureManualBankDiagramQueues().sessions[type]:null;
    return queue?{kind:"diagramQueue",memory:queue,type}:null;
  }
  function batchWorkspaceStagesHTML(mode="manual") {
    const task=batchWorkspaceTask(),api=mode==="api",stage=api?batchWorkspaceUI.apiStage:batchWorkspaceUI.stage|| (task?"batches":"setup");
    const stages=api?[["setup","Setup"],["activity","Activity"],["results","Results"]]:[["setup","Setup"],["batches","Batches"],["review","Review"],["finish","Finish"]];
    return `<nav class="batch-workspace-stages" aria-label="${api?"API":"Manual"} batch steps">${stages.map(([key,label])=>{const disabled=api?key!=="setup"&&!batchWorkspaceAPIActivity():!task&&key!=="setup"||task?.kind==="diagramQueue"&&key==="review";return `<button type="button" data-action="batch-workspace-stage" data-stage="${key}" data-workspace-mode="${mode}"${stage===key?' aria-current="step"':""}${disabled?" disabled":""}${task?.kind==="diagramQueue"&&key==="review"?' title="Diagram results use the guided queue validation and import controls."':""}>${label}</button>`;}).join("")}</nav>`;
  }
  function batchWorkspaceElement(html) { const template=document.createElement("template");template.innerHTML=html.trim();return template.content.firstElementChild; }
  function batchWorkspaceReviewFooter(layer,actions) {
    const footer=layer.querySelector('.modal-footer');if(!footer)return;
    footer.classList.add('batch-workspace-review-footer');
    const back=batchWorkspaceElement('<div class="batch-workspace-footer-back"><button class="btn" data-action="return-manual-batch-workspace">Return to Batches</button></div>');
    const decisions=batchWorkspaceElement('<div class="batch-workspace-footer-decisions" role="group" aria-label="Current question review actions"></div>');
    const finish=batchWorkspaceElement('<div class="batch-workspace-footer-finish"><button class="btn" data-action="batch-workspace-stage" data-stage="finish">Finish &amp; Retry</button></div>');
    const note=batchWorkspaceElement('<div class="batch-workspace-footer-note"></div>');
    while(actions.firstChild){const node=actions.firstChild;(node.nodeType===1&&node.matches('.caption')?note:decisions).append(node);}
    footer.replaceChildren(back,decisions,finish);if(note.hasChildNodes())footer.prepend(note);actions.remove();
  }
  function batchWorkspaceDisplayCounts(items){const c=manualWholeReviewCounts(items);return {"Accepted":c.accepted,"Unchanged":c.unchanged,"Rejected":c.rejected,"Needs attention":items.filter(item=>item.retryAttention||item.retryRequired||["failed_validation","needs_retry","missing_response","stale"].includes(item.status)).length,"Awaiting review":items.filter(item=>["pending","proposal_pending","unchanged"].includes(item.status)).length,"Awaiting response":items.filter(item=>item.status==="awaiting_batch").length};}
  function batchWorkspaceOverviewHTML(task=batchWorkspaceTask()) {
    if(!task)return `<section class="batch-workspace-overview"><h3>Task overview</h3><p class="caption">${(state.batchConfigSelection||[]).length} selected questions</p><ol class="batch-workspace-guide"><li>Choose a task and batch size.</li><li>Copy a prompt and paste the AI result.</li><li>Review proposals, then finish or retry.</li></ol><p class="caption">Closing this dialog keeps an active task available to resume.</p></section>`;
    if(task.kind==="diagramQueue") {const counts=manualBankDiagramQueueCounts(task.memory);return `<section class="batch-workspace-overview"><h3>Task overview</h3><strong>${counts.completed} of ${task.memory.items.length} completed</strong><progress value="${counts.completed}" max="${Math.max(1,task.memory.items.length)}" aria-label="Diagram queue progress"></progress><p class="caption">${counts.awaiting} awaiting · ${counts.attention} need attention · ${counts.skipped} skipped</p><p class="caption">Diagram results are validated and saved by the existing guided queue.</p></section>`;}
    const all=task.kind==="questionText"?manualQuestionTextWholeReviewItems(task.memory):manualWholeSelectionEnsureLedger(task.memory),c=manualWholeReviewCounts(all);
    // Awaiting an initial response is normal transport progress, not an error.
    const display=batchWorkspaceDisplayCounts(all),waiting=display["Awaiting response"],attention=display["Needs attention"],pending=display["Awaiting review"];
    return `<section class="batch-workspace-overview"><h3>Task overview</h3><div class="batch-workspace-overview-total"><strong>${c.reviewed} <span>of ${c.total}</span></strong><span class="caption">reviewed</span></div><progress value="${c.reviewed}" max="${Math.max(1,c.total)}" aria-label="Whole task review progress"></progress><dl class="batch-workspace-counts"><div><dt><i class="batch-workspace-dot green"></i>Accepted</dt><dd>${c.accepted}</dd></div><div><dt><i class="batch-workspace-dot"></i>Unchanged</dt><dd>${c.unchanged}</dd></div><div><dt><i class="batch-workspace-dot yellow"></i>Rejected</dt><dd>${c.rejected}</dd></div><div><dt><i class="batch-workspace-dot yellow"></i>Needs attention</dt><dd>${attention}</dd></div><div><dt><i class="batch-workspace-dot blue"></i>Awaiting review</dt><dd>${pending}</dd></div>${waiting?`<div><dt><i class="batch-workspace-dot"></i>Awaiting response</dt><dd>${waiting}</dd></div>`:""}</dl><p class="caption">Accept saves. You can revisit and reverse an acceptance while this task is open.</p></section>`;
  }
  function batchWorkspaceBatchJumpHTML(task) {
    if(!task?.vm)return "";
    const m=task.memory,selected=task.vm.currentBatch?.batchFingerprint||"",action=task.kind==="questionText"?"select-manual-question-text-batch":"select-manual-solution-batch";
    return `<section class="batch-workspace-batches"><h3>Copied batches (${m.batches.length})</h3><label class="field">Go to batch<select data-batch-workspace-jump data-batch-jump-kind="${task.kind}" aria-label="Go to copied batch">${m.batches.map((b,i)=>`<option value="${escapeAttr(b.batchFingerprint)}"${b.batchFingerprint===selected?" selected":""}>Batch ${i+1} · ${b.packages.length} question${b.packages.length===1?"":"s"}${b.retryBatch?" · Retry":""}</option>`).join("")}</select></label></section>`;
  }
  function batchWorkspaceGrid(main,aside) {return `<div class="batch-workspace-grid"><main class="batch-workspace-main">${main}</main><aside class="batch-workspace-aside" aria-label="Task overview and navigation">${aside}</aside></div>`;}
  function batchWorkspaceNavigationHTML(navigation={}) {
    const nav=batchWorkspaceElement(manualBatchSharedNavigationHTML(navigation)),previous=nav.firstElementChild,center=nav.querySelector('.manual-batch-shared-navigation-center'),next=nav.lastElementChild;
    const pair=batchWorkspaceElement('<div class="batch-workspace-navigation-pair" role="group" aria-label="Previous and next copied batches"></div>');
    pair.append(previous);
    if(navigation.canNextExisting)pair.append(next);
    else pair.append(batchWorkspaceElement('<button class="btn" disabled title="There is no later copied batch yet.">Next</button>'));
    nav.replaceChildren(pair,center);
    if(navigation.canCopyNext){next.classList.remove('primary');next.classList.add('batch-workspace-copy-next');next.title='Create and copy the prompt for the next group of questions.';nav.append(next);}
    return nav.outerHTML;
  }
  function batchWorkspaceNextStepHTML(task,vm) {
    if(!task?.vm?.currentBatch)return '';
    // Earlier review decisions remain available, but a fresh copied batch still
    // needs its own response before its proposals can be reviewed.
    const all=task.kind==='questionText'?manualQuestionTextWholeReviewItems(task.memory):manualWholeSelectionEnsureLedger(task.memory),batch=task.memory.batches.find(b=>b.batchFingerprint===vm.currentBatch.batchFingerprint),ids=new Set((batch?.packages||[]).map(p=>String(p.questionId))),items=all.filter(i=>ids.has(String(i.questionId))),counts=batch&&!batchWorkspaceBatchHasResponse(task,batch,items)?{'Awaiting response':ids.size}:batchWorkspaceDisplayCounts(items),target=task.memory.manualPromptTarget==='chatgpt'?'ChatGPT':'Gemini';
    let key='paste',title='Next: paste the AI response',body=`The prompt is copied. Send it to ${target}, then use Paste Batch Results below to bring its response back here.`,action='';
    if(counts['Awaiting review']){key='review';title='Next: review the proposals';body='The response is staged. Compare the original and proposed content before accepting or rejecting it. Accept saves; you can revisit decisions while the task is open.';action=`<button class="btn primary" data-action="${task.kind==='questionText'?'review-all-manual-question-text-batch':'review-all-manual-whole-selection'}" data-review-mode="all">Review Questions</button>`;}
    else if(counts['Awaiting response']){body=`Send the copied prompt to ${target}, then paste its complete response below. Review is required before saving.`;}
    else if(counts['Needs attention']||counts.Rejected){key='retry';title='Next: choose questions to retry';body='Open Finish & Retry to select the questions you want to try again. Accepted changes remain saved.';action='<button class="btn primary" data-action="batch-workspace-stage" data-stage="finish">Choose Retries</button>';}
    else if(vm.navigation?.canNextExisting||vm.navigation?.canCopyNext){key='continue';title='This batch is reviewed';body=vm.navigation.canNextExisting?'Use Next above to continue to the next copied batch. Previous lets you return to earlier work.':'Use Copy Next Batch above to create the prompt for the next questions. Previous and Next move between prompts you have already copied.';}
    else{key='finish';title='Next: finish this task';body='All questions in this batch have been reviewed. Check the whole-task summary, choose any retries, then finish to keep your accepted changes.';action='<button class="btn primary" data-action="batch-workspace-stage" data-stage="finish">Finish &amp; Retry</button>';}
    return `<section class="batch-workspace-next-step" data-next-step="${key}" aria-label="What to do next"><div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(body)}</p></div>${action}</section>`;
  }
  function batchWorkspaceBatchKey(task,batch) {return `${task.kind}:${task.memory.sessionID}:${batch.batchFingerprint}`;}
  function batchWorkspaceBatchHasResponse(task,batch,items) {
    if(batch.lastImportedAt)return true;
    if(items.some(item=>item.status!=='awaiting_batch'&&[item.batchFingerprint,item.sourceBatchFingerprint].includes(batch.batchFingerprint)))return true;
    return batch.questionIds.some(id=>{const outcome=task.memory.outcomes?.[id];return outcome?.lastBatchFingerprint===batch.batchFingerprint&&Boolean(outcome.status)&&!['current_batch_copied','not_attempted','awaiting_batch'].includes(outcome.status);});
  }
  function batchWorkspaceSelectedQuestions(task,batch) {
    const key=batchWorkspaceBatchKey(task,batch);
    if(!batchWorkspaceUI.selections.has(key))batchWorkspaceUI.selections.set(key,new Set());
    return batchWorkspaceUI.selections.get(key);
  }
  function batchWorkspaceInlinePasteHTML(task,batch) {
    const text=task.kind==='questionText',key=batchWorkspaceBatchKey(task,batch),fingerprint=batch.batchFingerprint;
    const draft=text?manualQuestionTextBatchInlinePasteState().drafts.get(fingerprint):batchWorkspaceUI.drafts.get(key),error=text?manualQuestionTextBatchInlinePasteState().errors.get(fingerprint):batchWorkspaceUI.pasteErrors.get(key);
    const input=text?'manual-question-text-batch-fingerprint':'manual-solution-import-batch-fingerprint',editor=text?'manual-question-text-batch-result':'manual-solution-batch-results',status=text?'manual-question-text-batch-import-status':'manual-solution-batch-status',action=text?'import-manual-question-text-batch-results':'import-manual-solution-batch-results';
    return `<section class="manual-batch-workspace-inline-paste batch-workspace-paste" data-workspace-paste-fingerprint="${escapeAttr(fingerprint)}" data-workspace-paste-key="${escapeAttr(key)}" aria-label="Paste batch response"><header><h4>2. Paste the AI response</h4><p class="caption">For Batch ${batch.batchNumber}. Validation stages proposals for review before saving.</p></header><input id="${input}" type="hidden" value="${escapeAttr(fingerprint)}"><textarea id="${editor}" class="prompt-box"${text?` data-inline-batch-fingerprint="${escapeAttr(fingerprint)}"`:''} data-workspace-paste-draft="${escapeAttr(key)}" aria-label="${text?'Question Text batch result':'Batch AI response'}" placeholder="Paste the complete JSON response here…">${escapeHTML(draft||'')}</textarea><div id="${status}" class="notice error" role="status"${error?'':' hidden'}>${escapeHTML(error||'')}</div><div class="button-row"><button class="btn primary" data-action="${action}">Validate &amp; Stage for Review</button><button class="btn" data-action="batch-workspace-clear-paste">Clear pasted text</button></div></section>`;
  }
  function batchWorkspaceCurrentHTML(vm,nextKey) {
    const task=batchWorkspaceTask(),batch=task?.memory.batches.find(b=>b.batchFingerprint===vm.currentBatch?.batchFingerprint);
    const current=batchWorkspaceElement(manualBatchSharedCurrentBatchHTML(vm)),actions=current.querySelector('.manual-batch-shared-primary-actions');
    if(!batch)return current.outerHTML;
    actions?.querySelectorAll('[data-action="review-all-manual-whole-selection"],[data-action="review-all-manual-question-text-batch"]').forEach(button=>button.remove());
    if(actions){actions.setAttribute('aria-label','Copy prompt and paste response');actions.prepend(batchWorkspaceElement('<strong class="batch-workspace-copy-label">1. Copy the prompt</strong>'));actions.querySelectorAll('.btn').forEach(button=>{button.classList.remove('primary');if(button.dataset.action?.startsWith('paste-'))button.textContent='Go to paste';else if(button.dataset.action?.includes('batch-card'))button.textContent='Copy Batch Prompt';});}
    const items=current.querySelector('.manual-batch-shared-items-region'),list=items.querySelector('.manual-batch-shared-item-list'),selected=batchWorkspaceSelectedQuestions(task,batch),disclosure=`${vm.taskKey}:items:${batch.batchFingerprint}`;
    items.dataset.manualBatchDisclosure=disclosure;items.open=Boolean(manualBatchCompactUIState().disclosureStates.get(disclosure));
    items.querySelector('summary').innerHTML=`<strong>Questions in this batch (${batch.packages.length})</strong><span class="caption">View and select</span>`;
    // Give every row the same explicit cells; source whitespace cannot create
    // anonymous grid items or change the alignment between neighboring rows.
    list.querySelectorAll('.manual-batch-shared-item-row').forEach((row,index)=>{
      const pkg=batch.packages[index],id=String(pkg.questionId),number=row.querySelector('.manual-batch-shared-item-index'),code=row.querySelector('code'),status=row.querySelector('.manual-batch-shared-item-status'),retry=row.querySelector('.manual-batch-shared-item-retry');
      let checkbox=row.querySelector('input[type="checkbox"]');if(!checkbox){checkbox=document.createElement('input');checkbox.type='checkbox';}
      checkbox.dataset.workspaceQuestion=id;checkbox.checked=selected.has(id);checkbox.toggleAttribute('checked',selected.has(id));checkbox.setAttribute('aria-label',`Select ${id} for another AI pass`);
      const checkCell=batchWorkspaceElement('<label class="manual-batch-shared-item-select"></label>');checkCell.append(checkbox);
      const identity=batchWorkspaceElement('<div class="batch-workspace-question-identity"></div>');code.classList.add('manual-batch-shared-item-id');identity.append(code);
      let preview=row.querySelector('.manual-solution-question-title');if(!preview)preview=batchWorkspaceElement(`<span class="manual-solution-question-title">${escapeHTML(String(pkg.originalQuestion||pkg.sourceProjection?.currentQuestionText||manualSolutionPlainTitle(id,pkg)))}</span>`);
      identity.append(preview);const extra=batchWorkspaceElement('<div class="batch-workspace-question-actions"></div>');if(retry)extra.append(retry);
      row.classList.add('batch-workspace-question-row');row.replaceChildren(checkCell,number,identity,status,extra);
    });
    const toolbar=batchWorkspaceElement(`<div class="batch-workspace-question-selection" role="group" aria-label="Select batch questions"><button class="btn small" data-action="batch-workspace-select-questions" data-selection="all">Select all</button><button class="btn small" data-action="batch-workspace-select-questions" data-selection="none">Clear selection</button><span class="caption" data-workspace-selected-count>${selected.size} selected</span><button class="btn small primary" data-action="batch-workspace-copy-selected"${selected.size?'':' disabled'}>Copy selected prompt</button></div>`);list.before(toolbar);
    const legacy=items.querySelector('.manual-batch-shared-bulk-retry');if(legacy){const details=batchWorkspaceElement('<details class="batch-workspace-failed-retries"><summary>Retry failed responses</summary></details>');details.append(legacy);items.append(details);}
    // Keep the original input IDs and import actions, with one consistently
    // formatted editor below the list for the selected batch.
    const retryPanels=[...current.querySelectorAll('.manual-batch-shared-retry-panel')],slot=current.querySelector('.manual-batch-shared-task-slot'),paste=batchWorkspaceElement(batchWorkspaceInlinePasteHTML(task,batch));
    if(retryPanels.length)paste.classList.add('manual-batch-shared-retry-panel');
    retryPanels.forEach(n=>n.remove());items.after(paste);
    slot?.remove();return current.outerHTML;
  }
  const batchWorkspaceSharedBase=manualBatchSharedWorkspaceHTML;
  manualBatchSharedWorkspaceHTML=function(vm={}) {
    const taskKey=String(vm.taskKey||"manual"),task=batchWorkspaceTask();
    if(batchWorkspaceUI.sessionID!==task?.memory.sessionID){batchWorkspaceUI.sessionID=task?.memory.sessionID||"";batchWorkspaceUI.stage="batches";}
    const stage=batchWorkspaceUI.stage==="setup"?"setup":"batches";
    batchWorkspaceUI.stage=stage;
    const intro=`<header class="batch-workspace-heading"><h3>${stage==="setup"?"Task settings":"Batch workspace"}</h3>${stage==="setup"?"<p class=\"caption\">Settings were frozen when the first prompt was copied.</p>":""}</header>`;
    const nextStep=batchWorkspaceNextStepHTML(task,vm),current=batchWorkspaceCurrentHTML(vm,batchWorkspaceElement(nextStep)?.dataset.nextStep);
    const history=vm.historyHTML?`<details class="manual-batch-shared-history-region" data-manual-batch-region="history" data-manual-batch-disclosure="${escapeAttr(taskKey+":history")}"${manualBatchSharedDisclosureOpenAttribute(taskKey+":history")}><summary>Batch history (${vm.historyCount})</summary><div class="manual-batch-shared-history-body">${vm.historyHTML}</div></details>`:"";
    const settings=`<section class="batch-workspace-frozen"><h3>Task settings</h3><dl class="batch-workspace-counts"><div><dt>Questions</dt><dd>${vm.totalCount}</dd></div><div><dt>Batch size</dt><dd>${task?.memory.batchSize||0}</dd></div><div><dt>Prompt target</dt><dd>${escapeHTML(task?.memory.manualPromptTarget||"")}</dd></div></dl>${vm.taskOptionsHTML||""}<p class="caption">These settings stay bound to the active task. Finish or abandon it before starting a different task.</p><button class="btn primary" data-action="batch-workspace-stage" data-stage="batches">Continue to Batches</button></section>`;
    const main=(stage==="setup"?intro:"")+(stage==="setup"?settings:batchWorkspaceNavigationHTML(vm.navigation)+nextStep+current+`<details class="batch-workspace-more-details"><summary>History and task details</summary>${history}<div class="manual-batch-shared-details-region">${vm.detailsHTML||""}</div></details>`);
    return `<div id="manual-solution-batch-controls" class="manual-task-active manual-batch-shared-workspace" data-manual-batch-shared-workspace="true" data-manual-batch-task="${escapeAttr(taskKey)}">${batchWorkspaceGrid(main,batchWorkspaceOverviewHTML(task)+batchWorkspaceBatchJumpHTML(task)+`<section class="batch-workspace-task-actions"><h3>Task controls</h3><div class="manual-batch-shared-action-row">${vm.footerActionsHTML||""}</div><details><summary>Transport progress</summary>${manualBatchSharedProgressHTML(vm)}</details></section>`)}</div>`;
  };
  function batchWorkspaceReviewMount(layer,kind) {
    const review=layer.querySelector(".manual-whole-review");if(!review||review.querySelector(".batch-workspace-grid"))return;
    if(!["generic","questionText"].includes(kind))return;
    const task={kind,memory:manualReviewMemory(kind)};
    const finish=batchWorkspaceUI.stage==="finish",main=document.createElement("main"),aside=document.createElement("aside"),grid=document.createElement("div");
    main.className="batch-workspace-main";aside.className="batch-workspace-aside";aside.setAttribute("aria-label","Task overview and question navigation");grid.className="batch-workspace-grid";grid.append(main,aside);
    aside.innerHTML=batchWorkspaceOverviewHTML(task);
    const header=review.querySelector(".manual-whole-review-header"),jump=review.querySelector("[data-manual-review-jump]")?.closest("label"),nav=header?.querySelector(".manual-whole-review-nav"),counts=review.querySelector(".manual-whole-review-counts"),card=review.querySelector(".manual-whole-review-card"),retry=review.querySelector(".manual-whole-review-retry"),retryList=review.querySelector(".manual-whole-review-retry-list"),summary=review.querySelector(".manual-whole-review-summary");
    const all=kind==="questionText"?manualQuestionTextWholeReviewItems(task.memory):manualWholeSelectionEnsureLedger(task.memory);
    if(counts)counts.innerHTML=Object.entries(batchWorkspaceDisplayCounts(all)).map(([label,value])=>`<span class="pill">${label} ${value}</span>`).join("");
    const retryCaption=retryList?.querySelector("summary .caption");if(retryCaption)retryCaption.textContent="Unresolved or rejected questions";
    if(finish){
      main.innerHTML='<header class="batch-workspace-heading"><h3>Finish and retry</h3><p class="caption">Review the task summary, choose any questions to retry, or finish and keep your saved changes.</p></header>';
      if(counts)main.append(counts);if(retry)main.append(retry);if(retryList){retryList.open=true;main.append(retryList);}if(summary)main.append(summary);
      const returnButton=batchWorkspaceElement(`<button class="btn" data-action="batch-workspace-stage" data-stage="review">Return to question review</button>`);main.append(returnButton);
    }else{
      const title=header?.querySelector('.manual-whole-review-title');
      if(title){const heading=batchWorkspaceElement('<div class="batch-workspace-review-heading"></div>'),options=batchWorkspaceElement('<div class="batch-workspace-review-options"></div>'),h3=title.querySelector('h3'),badge=title.querySelector(':scope > .pill'),filters=title.querySelector('.manual-whole-review-filters'),bulk=title.querySelector('.button-row'),caption=title.querySelector(':scope > .caption');if(h3){h3.title=h3.textContent;h3.textContent='Review questions';heading.append(h3);}if(badge)heading.append(badge);if(filters)options.append(filters);if(bulk)options.append(bulk);title.replaceChildren(heading,options);if(caption){caption.textContent='Compare the proposal below. Accept saves; you can return to undo a decision while this task is open.';title.append(caption);}}
      if(header)main.append(header);
      if(nav){const section=batchWorkspaceElement('<section class="batch-workspace-question-navigation" aria-label="Question navigator"></section>'),pair=batchWorkspaceElement('<div class="batch-workspace-navigation-pair" role="group" aria-label="Previous and next review questions"></div>');nav.querySelectorAll('button').forEach(button=>pair.append(button));nav.prepend(pair);section.append(nav);if(jump)section.append(jump);main.append(section);}
      if(card){main.append(card);const actions=card.querySelector(".manual-whole-review-actions");if(actions)batchWorkspaceReviewFooter(layer,actions);}
      if(retry)main.append(retry);
      // The retry checklist remains available during review and opens on the last question.
      if(retryList)main.append(retryList);
      if(summary){const details=batchWorkspaceElement('<details class="batch-workspace-review-summary"><summary>Review summary</summary></details>');details.append(summary);main.append(details);}
    }
    const footer=layer.querySelector(".modal-footer");if(finish&&footer){footer.innerHTML=manualWholeReviewFooterHTML(kind);const back=footer.querySelector('[data-action="return-manual-batch-workspace"]');if(back)back.textContent="Return to Batches";footer.querySelector('.btn.danger')?.remove();}
    const controls=batchWorkspaceElement(`<section class="batch-workspace-task-actions"><h3>Task controls</h3><button class="btn" data-action="batch-workspace-stage" data-stage="${finish?"review":"finish"}">${finish?"Review questions":"Finish & Retry"}</button><button class="btn danger" data-action="${kind==="questionText"?"show-abandon-manual-question-text-batch":"show-abandon-manual-batch-task"}">Abandon Task</button></section>`);aside.append(controls);
    review.replaceChildren(grid);
  }
  function batchWorkspaceMount(layer=currentAIBatchToolsLayer()) {
    if(!layer)return;
    const shell=layer.querySelector(".ai-batch-tools-shell"),modal=layer.querySelector(".modal");if(!shell)return;
    shell.classList.add("batch-workspace-shell");modal?.classList.add("batch-workspace-modal");shell.querySelector(".ai-batch-tools-intro")?.remove();
    const mode=state.aiBatchToolsTab==="api"&&!shell.querySelector(".ai-batch-tools-content-manual")?"api":"manual",task=batchWorkspaceTask(),content=shell.querySelector(".ai-batch-tools-content");
    if(mode==="manual"&&task?.kind==="diagramQueue"&&batchWorkspaceUI.sessionID!==task.memory.sessionID){batchWorkspaceUI.sessionID=task.memory.sessionID;batchWorkspaceUI.stage="batches";}
    // A setup refresh replaces only the engine's root. Remove its old outer
    // presentation grid when that root now provides the active workspace grid.
    const root=content?.querySelector("#manual-solution-batch-controls"),outer=content?.querySelector(":scope > .batch-workspace-grid");
    if(outer&&root?.querySelector(".batch-workspace-grid"))content.replaceChildren(root);
    if(mode==="api"&&content?.querySelector("#batch-workspace-api-live"))layer.dataset.batchWorkspaceRunId=String(batchWorkspaceAPIActivity()?.id||"");
    layer.querySelector('.modal-footer')?.classList.toggle('batch-workspace-review-footer',Boolean(['generic','questionText'].includes(shell.querySelector('.manual-whole-review')?.dataset.reviewKind)&&batchWorkspaceUI.stage!=='finish'));
    if(mode==="manual"&&!batchWorkspaceUI.reviewing&&!shell.querySelector(".manual-whole-review"))batchWorkspaceUI.stage=task?(batchWorkspaceUI.stage==="setup"?"setup":task.kind==="diagramQueue"&&batchWorkspaceUI.stage==="finish"?"finish":"batches"):"setup";
    shell.querySelector(".batch-workspace-stages")?.remove();shell.querySelector(".ai-batch-tools-tabs")?.after(batchWorkspaceElement(batchWorkspaceStagesHTML(mode)));
    // Keep exactly one copy of each original control, moving mounted nodes so
    // their listeners, IDs, focus, and import drafts remain attached.
    if(content&&!content.querySelector(".batch-workspace-grid")&&!content.querySelector(".manual-whole-review")){
      const main=document.createElement("main"),aside=document.createElement("aside"),grid=document.createElement("div");main.className="batch-workspace-main";aside.className="batch-workspace-aside";grid.className="batch-workspace-grid";
      while(content.firstChild)main.append(content.firstChild);grid.append(main,aside);content.append(grid);
      aside.innerHTML=mode==="manual"?batchWorkspaceOverviewHTML(task):'<section class="batch-workspace-overview"><h3>API batch</h3><p class="caption">Choose a scope and operations, then check the effective provider routes before starting.</p><p class="caption">API operations use their existing validation and saving rules. Activity and results are available in this dialog.</p></section>';
    }
    if(task?.kind==="diagramQueue"&&content?.querySelector(".manual-bank-diagram-queue")){const aside=content.querySelector(".batch-workspace-aside");if(aside)aside.innerHTML=batchWorkspaceOverviewHTML(task);if(batchWorkspaceUI.stage==="setup"&&root){root.innerHTML=`<section class="batch-workspace-frozen"><h3>Diagram queue settings</h3><dl class="batch-workspace-counts"><div><dt>Diagram type</dt><dd>${escapeHTML(task.type)}</dd></div><div><dt>Questions</dt><dd>${task.memory.items.length}</dd></div><div><dt>Prompt target</dt><dd>${escapeHTML(task.memory.manualPromptTarget||task.memory.items[0]?.manualPromptTarget||"")}</dd></div></dl><p class="caption">Settings and source attachments are frozen in each queue item. Return to Batches to copy, import, export, skip, or reset an item.</p><button class="btn primary" data-action="batch-workspace-stage" data-stage="batches">Continue to Batches</button></section>`;}}
    const queueNav=shell.querySelector('.manual-bank-diagram-queue-nav');
    if(queueNav&&!queueNav.querySelector('.batch-workspace-navigation-pair')){const pair=batchWorkspaceElement('<div class="batch-workspace-navigation-pair" role="group" aria-label="Previous and next diagram questions"></div>');queueNav.querySelectorAll(':scope > button').forEach(button=>pair.append(button));queueNav.prepend(pair);}
    const operations=shell.querySelector('.batch-operation-groups');
    if(operations&&!operations.querySelector('.batch-workspace-operation-column')){const groups=[...operations.children],left=batchWorkspaceElement('<div class="batch-workspace-operation-column"></div>'),right=batchWorkspaceElement('<div class="batch-workspace-operation-column"></div>');groups.forEach((group,index)=>(index%2?right:left).append(group));operations.replaceChildren(left,right);}
    const review=content?.querySelector(".manual-whole-review");if(review)batchWorkspaceReviewMount(layer,review.dataset.reviewKind);
    shell.querySelectorAll(".manual-batch-shared-items-region").forEach(panel=>{const key=manualBatchSharedDisclosureKey(panel);if(!manualBatchCompactUIState().disclosureStates.has(key))panel.open=false;const list=panel.querySelector(".manual-batch-shared-item-list");if(list&&!panel.querySelector(".batch-workspace-scroll-hint"))list.after(batchWorkspaceElement('<div class="batch-workspace-scroll-hint">All questions in this batch are listed here.</div>'));const hint=panel.querySelector('.batch-workspace-scroll-hint');if(hint)requestAnimationFrame(()=>{if(hint.isConnected)hint.textContent=list.scrollHeight>list.clientHeight+2?'All questions are listed here. Scroll this list to see the rest.':'All questions in this batch are visible above.';});});
    shell.querySelectorAll('.manual-batch-shared-action-row [data-action="review-all-manual-whole-selection"],.manual-batch-shared-action-row [data-action="review-all-manual-question-text-batch"]').forEach(button=>button.remove());
    const tabs=shell.querySelector(".ai-batch-tools-tabs");if(tabs&&tabs.firstElementChild?.dataset.tab==="api")tabs.prepend(tabs.lastElementChild);
    if(mode==="api"&&isQuestionBankBatchActive()){const start=layer.querySelector('[data-action="start-batch-solutions"]');if(start){start.disabled=true;start.title="Wait for the active batch to finish or cancel it.";}}
    // Start a newly opened stage, batch, or review question at its heading.
    // Updates within the same view retain scroll and input drafts.
    const reviewKind=shell.querySelector('.manual-whole-review')?.dataset.reviewKind,memory=reviewKind?manualReviewMemory(reviewKind):task?.memory;
    const viewKey=mode==='api'?`api:${batchWorkspaceUI.apiStage}:${layer.dataset.batchWorkspaceRunId||''}`:`manual:${batchWorkspaceUI.stage}:${state.aiBatchToolsView}:${memory?.sessionID||''}:${memory?.selectedBatchFingerprint||''}:${reviewKind?memory.reviewIndex:''}:${state.aiBatchToolsManualOperation||''}`;
    if(batchWorkspaceUI.mountedView!==viewKey){layer.querySelector('.modal-body').scrollTop=0;batchWorkspaceUI.mountedView=viewKey;}
  }
  function batchWorkspaceFocusPaste() {
    const panel=currentAIBatchToolsLayer()?.querySelector('.batch-workspace-paste');
    panel?.scrollIntoView({block:'nearest'});panel?.querySelector('textarea:not([readonly])')?.focus({preventScroll:true});
  }
  showManualSolutionBatchPaste=function(fingerprint='') {
    const memory=ensureManualSolutionBatchState(),batch=memory.batches.find(b=>b.batchFingerprint===String(fingerprint||memory.selectedBatchFingerprint));
    if(!batch)throw new Error('This frozen batch is unavailable.');
    memory.currentPackages=cloneJSON(batch.packages,[]);memory.currentBatchIDs=[...batch.questionIds];memory.batchFingerprint=batch.batchFingerprint;
    batchWorkspaceUI.stage='batches';state.aiBatchToolsTab='manual';state.aiBatchToolsView='workspace';
    selectManualSolutionBatch(batch.batchFingerprint);
    if(!currentAIBatchToolsLayer()?.querySelector('#manual-solution-batch-controls'))showBatchSolutions({tab:'manual'});
    requestAnimationFrame(batchWorkspaceFocusPaste);return batch;
  };
  const batchWorkspaceTextPasteBase=showManualQuestionTextBatchPaste;
  showManualQuestionTextBatchPaste=function(fingerprint=''){const result=batchWorkspaceTextPasteBase(fingerprint);requestAnimationFrame(batchWorkspaceFocusPaste);return result;};
  const batchWorkspaceImportBase=importManualSolutionBatchResults;
  importManualSolutionBatchResults=async function(){
    const panel=currentAIBatchToolsLayer()?.querySelector('[data-workspace-paste-key]'),key=panel?.dataset.workspacePasteKey;
    const result=await batchWorkspaceImportBase();
    if(key){if(result!==undefined){batchWorkspaceUI.drafts.delete(key);batchWorkspaceUI.pasteErrors.delete(key);refreshManualSolutionBatchControlsPresentation();}else{const message=document.querySelector('#manual-solution-batch-status')?.textContent;if(message)batchWorkspaceUI.pasteErrors.set(key,message);}}
    return result;
  };
  async function batchWorkspaceCopySelected(control) {
    const task=batchWorkspaceTask(),batch=task?.memory.batches.find(b=>b.batchFingerprint===task.memory.selectedBatchFingerprint);
    if(!batch)return;const ids=batch.packages.map(p=>String(p.questionId)).filter(id=>batchWorkspaceSelectedQuestions(task,batch).has(id));
    if(!ids.length)return;
    control.disabled=true;
    try{
      // Reuse the existing current-snapshot retry authority and unchanged prompt
      // templates. Selected questions are re-staged before any acceptance.
      await createManualReviewRetryBatch(task.kind,ids);
      const memory=manualReviewMemory(task.kind);memory.reviewRetry=null;manualReviewPersist(task.kind);
      batchWorkspaceUI.stage='batches';state.aiBatchToolsView='workspace';showBatchSolutions({tab:'manual'});
      toast(`Copied ${ids.length} selected question${ids.length===1?'':'s'} in a new batch. Paste its response below, then review.`, 'success');
    }catch(error){control.disabled=false;toast(error.message||'Could not copy the selected questions.','error');}
  }
  function batchWorkspaceUpdateSelection() {
    const task=batchWorkspaceTask(),batch=task?.memory.batches.find(b=>b.batchFingerprint===task.memory.selectedBatchFingerprint);if(!batch)return;
    const root=currentAIBatchToolsLayer(),selected=batchWorkspaceSelectedQuestions(task,batch);
    root?.querySelectorAll('[data-workspace-question]').forEach(input=>input.checked=selected.has(input.dataset.workspaceQuestion));
    const count=root?.querySelector('[data-workspace-selected-count]'),copy=root?.querySelector('[data-action="batch-workspace-copy-selected"]');if(count)count.textContent=`${selected.size} selected`;if(copy)copy.disabled=!selected.size;
    if(task.kind==='questionText'){const compact=manualBatchCompactUIState();compact.selectedQuestionIDs=new Set(selected);updateManualQuestionTextBatchSelectionPresentation(root?.querySelector('#manual-solution-batch-controls'));}
  }
  document.addEventListener('input',event=>{const editor=event.target.closest?.('[data-workspace-paste-draft]');if(!editor)return;batchWorkspaceUI.drafts.set(editor.dataset.workspacePasteDraft,editor.value);batchWorkspaceUI.pasteErrors.delete(editor.dataset.workspacePasteDraft);editor.closest('.batch-workspace-paste')?.querySelector('.notice')?.setAttribute('hidden','');});
  document.addEventListener('change',event=>{const input=event.target.closest?.('[data-workspace-question]');if(!input)return;const task=batchWorkspaceTask(),batch=task?.memory.batches.find(b=>b.batchFingerprint===task.memory.selectedBatchFingerprint);if(!batch)return;const selected=batchWorkspaceSelectedQuestions(task,batch);if(input.checked)selected.add(input.dataset.workspaceQuestion);else selected.delete(input.dataset.workspaceQuestion);batchWorkspaceUpdateSelection();});
  const batchWorkspaceShowBase=showBatchSolutions;
  showBatchSolutions=function(options={}) {
    batchWorkspaceUI.apiOpen=false;batchWorkspaceUI.completedRunID="";
    if(options.fresh){batchWorkspaceUI.stage="";batchWorkspaceUI.apiStage="setup";}
    if(options.tab==="api")batchWorkspaceUI.apiStage="setup";
    const result=batchWorkspaceShowBase(options);batchWorkspaceMount(result||currentAIBatchToolsLayer());return result;
  };
  const batchWorkspaceSubviewBase=showAIBatchToolsSubview;
  showAIBatchToolsSubview=function(options={}) {
    const mount=options.onMount;
    return batchWorkspaceSubviewBase({...options,onMount:layer=>{mount?.(layer);batchWorkspaceMount(layer);}});
  };
  const batchWorkspaceRefreshBase=refreshManualSolutionBatchControlsPresentation;
  refreshManualSolutionBatchControlsPresentation=function(){const result=batchWorkspaceRefreshBase();batchWorkspaceMount();return result;};
  const batchWorkspaceReviewBase=showManualWholeSelectionReview;
  showManualWholeSelectionReview=function(kind="generic") {
    if(!["generic","questionText"].includes(kind))return batchWorkspaceReviewBase(kind);
    state.aiBatchToolsTab="manual";
    const sessionID=manualReviewMemory(kind).sessionID;
    if(batchWorkspaceUI.sessionID!==sessionID){batchWorkspaceUI.sessionID=sessionID;batchWorkspaceUI.stage="review";}
    if(batchWorkspaceUI.stage!=="finish")batchWorkspaceUI.stage="review";
    batchWorkspaceUI.reviewing=true;try{return batchWorkspaceReviewBase(kind);}finally{batchWorkspaceUI.reviewing=false;}
  };
  function batchWorkspaceAPIActivity(){return state.batchActivity?.mode==="batch"?state.batchActivity:state.activityRecords().find(record=>record.mode==="batch")||null;}
  function batchWorkspaceAPIHTML(stage) {
    const a=batchWorkspaceAPIActivity();if(!a)return '<p class="caption">No API batch activity is available yet.</p>';
    const c={complete:0,warning:0,failed:0,skipped:0,cancelled:0,...a.counts};
    return batchWorkspaceGrid(`<header class="batch-workspace-heading"><h3>${stage==="results"?"Batch results":"Batch activity"}</h3><p class="caption">${escapeHTML(a.operations?.join(" · ")||"Question Bank operations")}</p></header><div id="batch-workspace-api-live"><strong>${escapeHTML(batchStatusLabel(a.status))}</strong><progress value="${a.processed||0}" max="${Math.max(1,a.targetTotal||0)}" aria-label="API batch progress"></progress><p>${a.processed||0} of ${a.targetTotal||0} processed</p><p class="caption">${escapeHTML(a.currentID||a.summary||"No current question")}</p><p class="caption">${escapeHTML(a.currentStage||"")} ${escapeHTML(a.currentDetail||"")}</p><div class="manual-whole-review-counts">${Object.entries(c).map(([key,value])=>`<span class="pill">${escapeHTML(key)} ${value}</span>`).join("")}</div><details data-workspace-api-disclosure="log"${stage==="results"?" open":""}><summary>Question activity log</summary><ol class="batch-workspace-api-log">${(a.log||[]).map(item=>`<li><code>${escapeHTML(item.id||"")}</code> ${escapeHTML(item.message)}</li>`).join("")||"<li>No activity recorded yet.</li>"}</ol></details><details data-workspace-api-disclosure="routes"><summary>Provider route history</summary><ol>${(a.routeHistory||[]).map(route=>`<li>${escapeHTML([route.questionID,route.label||route.route,route.provider,route.model,route.status].filter(Boolean).join(" · "))}</li>`).join("")||"<li>No routes recorded yet.</li>"}</ol></details></div>`,`<section class="batch-workspace-overview"><h3>Task overview</h3><p>${escapeHTML(a.scopeLabel||"")}</p><p class="caption">${a.targetTotal||0} questions · ${Number(a.providerCallCount)||0} provider calls</p><p class="caption">Saved results remain in the Question Bank. Closing this dialog keeps an active batch running.</p>${a.status==="active"?`<button class="btn danger" data-action="cancel-batch"${state.batchCancelRequested?" disabled":""}>${state.batchCancelRequested?"Cancelling…":"Cancel Batch"}</button>`:""}</section>`);
  }
  function batchWorkspaceShowAPIStage(stage) {
    batchWorkspaceUI.apiStage=stage;state.aiBatchToolsTab="api";batchWorkspaceUI.apiOpen=true;
    const body=`<div class="ai-batch-tools-shell batch-workspace-shell">${aiBatchToolsTabsHTML("api")}${batchWorkspaceStagesHTML("api")}${aiBatchToolsContextStripHTML("api")}<div class="ai-batch-tools-content ai-batch-tools-content-api">${batchWorkspaceAPIHTML(stage)}</div></div>`;
    const footer='<button class="btn" data-action="close-modal">Close</button><span class="right"></span><span class="caption">Results are saved through the existing API batch workflow.</span>',layer=currentAIBatchToolsLayer();
    if(layer)return replaceAIBatchToolsModalContent(layer,body,footer,batchWorkspaceMount);
    return showModal({title:"AI Batch Tools",body,footer,wide:true,onMount:batchWorkspaceMount});
  }
  const batchWorkspaceActivityRefreshBase=refreshBatchActivityPresentation;
  refreshBatchActivityPresentation=function(){const result=batchWorkspaceActivityRefreshBase(),layer=currentAIBatchToolsLayer(),current=layer?.querySelector("#batch-workspace-api-live");if(current){const template=batchWorkspaceElement(`<div>${batchWorkspaceAPIHTML(batchWorkspaceUI.apiStage)}</div>`),live=template.querySelector("#batch-workspace-api-live");if(live){const offsets=new Map();current.querySelectorAll("[data-workspace-api-disclosure]").forEach(panel=>{const key=panel.dataset.workspaceApiDisclosure,next=live.querySelector(`[data-workspace-api-disclosure="${key}"]`);if(next){next.open=panel.open;offsets.set(key,panel.querySelector("ol").scrollTop);}});const focused=document.activeElement?.closest("[data-workspace-api-disclosure]")?.dataset.workspaceApiDisclosure;current.replaceWith(live);offsets.forEach((top,key)=>{live.querySelector(`[data-workspace-api-disclosure="${key}"] ol`).scrollTop=top;});if(focused)live.querySelector(`[data-workspace-api-disclosure="${focused}"] summary`)?.focus({preventScroll:true});const aside=layer.querySelector(".batch-workspace-aside"),nextAside=template.querySelector(".batch-workspace-aside");if(aside&&nextAside)aside.replaceWith(nextAside);}}return result;};
  const batchWorkspaceModalBase=showModal;
  showModal=function(options) {
    if(options.title!=="Batch Question Content")return batchWorkspaceModalBase(options);
    batchWorkspaceUI.apiStage="activity";batchWorkspaceUI.apiOpen=true;state.aiBatchToolsTab="api";
    return batchWorkspaceModalBase({...options,title:"AI Batch Tools",wide:true,body:`<div class="ai-batch-tools-shell batch-workspace-shell">${aiBatchToolsTabsHTML("api")}${batchWorkspaceStagesHTML("api")}${aiBatchToolsContextStripHTML("api")}<div class="ai-batch-tools-content ai-batch-tools-content-api">${batchWorkspaceAPIHTML("activity")}<div hidden>${options.body}</div></div></div>`,onMount:layer=>{options.onMount?.(layer);batchWorkspaceMount(layer);}});
  };
  const batchWorkspaceRunBase=runBatchSolutions;
  const batchWorkspaceCloseBase=closeModal;
  closeModal=function(...args){
    const layer=currentAIBatchToolsLayer(),runID=String(state.batchActivity?.id||"");
    batchWorkspaceUI.completedRunID=layer?.querySelector("#batch-workspace-api-live")&&layer.dataset.batchWorkspaceRunId===runID&&state.batchActivity?.status!=="active"?runID:"";
    batchWorkspaceUI.apiOpen=false;return batchWorkspaceCloseBase(...args);
  };
  runBatchSolutions=async function(){const previousID=state.batchActivity?.id;await batchWorkspaceRunBase();if(batchWorkspaceUI.completedRunID===state.batchActivity?.id&&state.batchActivity?.id!==previousID&&state.batchActivity?.status!=="active")batchWorkspaceShowAPIStage("results");};
  document.addEventListener("change",event=>{
    const jump=event.target.closest?.("[data-batch-workspace-jump]");if(!jump)return;
    batchWorkspaceUI.stage="batches";
    if(jump.dataset.batchJumpKind==="questionText")selectManualQuestionTextBatch(jump.value);else selectManualSolutionBatch(jump.value);
  });
  document.addEventListener("click",event=>{
    const control=event.target.closest?.("[data-action]");if(!control)return;
    const action=control.dataset.action;
    if(action==="select-manual-solution-batch"||action==="select-manual-question-text-batch")batchWorkspaceUI.stage="batches";
    if(action==="switch-ai-batch-tools-tab"){batchWorkspaceUI.apiOpen=false;batchWorkspaceUI.completedRunID="";}
    if(action==="close-modal"&&control.closest(".batch-workspace-modal"))batchWorkspaceUI.apiOpen=false;
    if(action==="return-manual-batch-workspace")batchWorkspaceUI.stage="batches";
    if(action==="navigate-manual-whole-review"||action==="continue-manual-whole-review"||action==="review-all-manual-whole-selection"||action==="review-all-manual-question-text-batch")batchWorkspaceUI.stage="review";
    if(['batch-workspace-select-questions','batch-workspace-copy-selected','batch-workspace-clear-paste'].includes(action)){
      event.preventDefault();event.stopImmediatePropagation();if(control.disabled)return;
      const task=batchWorkspaceTask(),batch=task?.memory.batches.find(b=>b.batchFingerprint===task.memory.selectedBatchFingerprint);if(!batch)return;
      if(action==='batch-workspace-copy-selected'){void batchWorkspaceCopySelected(control);return;}
      if(action==='batch-workspace-select-questions'){const selected=batchWorkspaceSelectedQuestions(task,batch);selected.clear();if(control.dataset.selection==='all')batch.packages.forEach(p=>selected.add(String(p.questionId)));batchWorkspaceUpdateSelection();return;}
      const panel=control.closest('.batch-workspace-paste'),editor=panel?.querySelector('textarea:not([readonly])');if(editor){editor.value='';editor.dispatchEvent(new Event('input',{bubbles:true}));panel.querySelector('.notice')?.setAttribute('hidden','');editor.focus({preventScroll:true});}return;
    }
    if(action!=="batch-workspace-stage")return;
    event.preventDefault();event.stopImmediatePropagation();if(control.disabled)return;
    const stage=control.dataset.stage,mode=control.dataset.workspaceMode||state.aiBatchToolsTab;
    if(mode==="api"){if(stage==="setup")showBatchSolutions({tab:"api"});else batchWorkspaceShowAPIStage(stage);return;}
    const task=batchWorkspaceTask(),currentKind=currentAIBatchToolsLayer()?.querySelector(".manual-whole-review")?.dataset.reviewKind;batchWorkspaceUI.stage=stage;
    if(["review","finish"].includes(stage)&&["generic","questionText"].includes(currentKind||task?.kind)){showManualWholeSelectionReview(currentKind||task.kind);return;}
    showBatchSolutions({tab:"manual"});
    if(stage==="finish"&&task?.kind==="diagramQueue"){const layer=currentAIBatchToolsLayer(),main=layer?.querySelector(".batch-workspace-main");if(main)main.prepend(batchWorkspaceElement('<header class="batch-workspace-heading"><h3>Finish diagram queue</h3><p class="caption">Saved diagrams remain in the Question Bank. Use Abandon Queue below to end queue tracking.</p></header>'));batchWorkspaceUI.stage="finish";batchWorkspaceMount(layer);}
  },true);
