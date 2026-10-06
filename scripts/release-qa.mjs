import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=process.env.RELEASE_QA_OUTPUT||path.join(os.tmpdir(),'fe-release-qa');fs.mkdirSync(output,{recursive:true});
const sourceHash=()=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'index.html'))).digest('hex'),initialSourceSHA256=sourceHash();
const suites=['verify','batch-approval-qa','local-metadata-qa','api-batch-review-qa','batch-inline-qa','batch-workspace-qa','batch-workspace-api-queue-qa','sidebar-tooltips-qa','adaptive-filters-qa','filter-cleanup-qa','review-controls-qa','solution-indicator-qa','bulk-solution-review-qa','batch-tools-ui-qa','manual-metadata-regression','manual-review-qa','toolbar-simplification-qa','bank-table-fit-qa','bank-workspace-qa','study-workflows-qa','ui-regression','popover-reopen-qa','dropdown-diagnostics','responsive-interactions','responsive-audit','visual-regression'];
const results=[];
for(const suite of suites){
 console.log(`Running ${suite}…`);
 const run=spawnSync(process.execPath,[path.join(root,'scripts',`${suite}.mjs`)],{cwd:root,encoding:'utf8',timeout:900000,maxBuffer:20*1024*1024,env:{...process.env,BATCH_LAYOUT_AUDIT:"1",BATCH_APPROVAL_QA_OUTPUT:path.join(output,"approval"),LOCAL_METADATA_QA_OUTPUT:path.join(output,"local-metadata"),API_BATCH_REVIEW_QA_OUTPUT:path.join(output,"api-review"),BATCH_INLINE_QA_OUTPUT:path.join(output,'inline'),BATCH_LAYOUT_OUTPUT:path.join(output,"batch-layout"),BATCH_WORKSPACE_API_QUEUE_QA_OUTPUT:path.join(output,'api-queues'),SIDEBAR_QA_OUTPUT:path.join(output,'sidebar'),ADAPTIVE_QA_OUTPUT:path.join(output,'adaptive'),FILTER_QA_OUTPUT:path.join(output,'filters'),REVIEW_CONTROLS_QA_OUTPUT:path.join(output,'review-controls'),MANUAL_REVIEW_QA_FAST:'',MANUAL_REVIEW_QA_OUTPUT:path.join(output,'manual-review'),SOLUTION_QA_OUTPUT:path.join(output,'solutions'),BULK_SOLUTION_QA_OUTPUT:path.join(output,'bulk-solutions'),AUDIT_SCREENSHOTS:'0',AUDIT_OUTPUT:path.join(output,'geometry'),TOOLBAR_QA_OUTPUT:path.join(output,'toolbar'),TABLE_QA_SOURCE:path.join(root,'index.html'),TABLE_QA_OUTPUT:path.join(output,'table'),BANK_QA_OUTPUT:path.join(output,'bank'),STUDY_QA_OUTPUT:path.join(output,'workflows'),VISUAL_QA_OUTPUT:path.join(output,'visuals'),UPDATE_VISUALS:'0',VISUAL_QA_INJECT_REGRESSION:'0'}});
 const log=[run.stdout,run.stderr,run.error?.message].filter(Boolean).join('\n');fs.writeFileSync(path.join(output,`${suite}.log`),log);
 results.push({suite,passed:run.status===0,exitCode:run.status,signal:run.signal});console.log(`${run.status===0?'PASS':'FAIL'}: ${suite}`);
 if(run.status!==0){console.log(log.slice(-4000));break;}
}
const finalSourceSHA256=sourceHash(),sourceUnchanged=initialSourceSHA256===finalSourceSHA256;
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:sourceUnchanged&&results.length===suites.length&&results.every(r=>r.passed),initialSourceSHA256,finalSourceSHA256,sourceUnchanged,results},null,2));
if(!sourceUnchanged||results.length!==suites.length||results.some(r=>!r.passed))process.exitCode=1;
console.log(`Release evidence: ${output}`);
