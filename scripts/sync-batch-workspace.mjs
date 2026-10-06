import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const filename=path.join(root,'index.html');
let html=fs.readFileSync(filename,'utf8');
const replace=(start,end,body,anchor)=>{
  const block=`${start}\n${body}\n${end}\n`;
  if(html.includes(start)){const first=html.indexOf(start),last=html.indexOf(end,first);if(last<0)throw new Error('Unclosed presentation block');html=html.slice(0,first)+block+html.slice(last+end.length).replace(/^\n/,'');}
  else {if(!html.includes(anchor))throw new Error('Missing presentation insertion anchor');html=html.replace(anchor,block+anchor);}
};
replace('/* BATCH_WORKSPACE_CSS_START */','/* BATCH_WORKSPACE_CSS_END */',fs.readFileSync(path.join(root,'ui/batch-workspace.css'),'utf8'),'</style>');
replace('// BATCH_WORKSPACE_JS_START','// BATCH_WORKSPACE_JS_END',fs.readFileSync(path.join(root,'ui/batch-workspace.js'),'utf8'),'  async function initialize() {');
replace('/* API_BATCH_REVIEW_CSS_START */','/* API_BATCH_REVIEW_CSS_END */',fs.readFileSync(path.join(root,'ui/api-batch-review.css'),'utf8'),'</style>');
replace('// API_BATCH_REVIEW_JS_START','// API_BATCH_REVIEW_JS_END',fs.readFileSync(path.join(root,'app/api-batch-review.js'),'utf8'),'  async function initialize() {');
replace('// LOCAL_AI_METADATA_JS_START','// LOCAL_AI_METADATA_JS_END',fs.readFileSync(path.join(root,'app/local-ai-metadata.js'),'utf8'),'  async function initialize() {');
replace('// BATCH_APPROVAL_JS_START','// BATCH_APPROVAL_JS_END',fs.readFileSync(path.join(root,'app/batch-approval.js'),'utf8'),'  async function initialize() {');
fs.writeFileSync(filename,html);
console.log('Synchronized standalone batch workspace presentation.');
