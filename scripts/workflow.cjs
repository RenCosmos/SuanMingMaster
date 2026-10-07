#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {withInputLifecycle,readStdinJson}=require('./input-lifecycle.cjs');
const core=require('./runtime-core.cjs');
const {ROOT,VERSION,check,readJson,hash,sha,atomicJson}=core;
const {actualPath,inside,assertOutputs,acquireTaskLocks}=require('./task-files.cjs');
const {taskId,nextActions,executableActions,failureFor}=require('./workflow-hints.cjs');
const budget=require('./output-budget.cjs');
const MAX_OUTPUT_BYTES=budget.WORKFLOW_BYTES;
const RECEIPT='validation.json';
function parse(argv){
 const o={};const flags={'--stdin':'stdin','--report':'report','--refresh':'refresh','--comparison':'comparison'};
 const pairs={'--input':'input','--reuse':'reuse','--out':'out','--focus':'focus','--limit':'limit','--offset':'offset','--years':'years','--person':'person','--candidate':'candidate','--field':'field','--variant-offset':'variant_offset'};
 for(let i=0;i<argv.length;i++){
  const arg=argv[i],key=flags[arg]??pairs[arg];check(key&&!(key in o),'不支持或重复的参数 '+arg);
  if(flags[arg])o[key]=true;
  else{check(argv[i+1]!==undefined&&!argv[i+1].startsWith('--'),arg+' 缺少值');o[key]=argv[++i];}
 }
 check(['stdin','input','reuse'].filter(k=>o[k]).length===1,'只选择 --stdin、--temp-input/--input 或 --reuse 之一');
 check(o.reuse||o.out,'新计算需要 --out 独立任务目录');
 check(!o.refresh||!o.reuse,'--refresh 必须同时提供原始输入');
 for(const k of ['limit','offset','variant_offset'])if(k in o){check(/^\d+$/.test(o[k]),k+' 须为整数');o[k]=Number(o[k]);check(Number.isSafeInteger(o[k])&&o[k]>=(k==='limit'?1:0)&&(k!=='limit'||o[k]<=10),k+' 超出范围');}
 if(o.years){check(/^\d{4}:\d{4}$/.test(o.years),'--years 格式为 YYYY:YYYY');o.years=o.years.split(':').map(Number);check(o.years[0]<=o.years[1],'年份起止顺序错误');}
 if(o.person)check(['a','b'].includes(o.person),'--person 只能是 a / b');
 check(!o.comparison||!o.person,'--comparison 不与 --person 混用');
 if(o.focus)check(require('./context.cjs').FOCUSES.includes(o.focus),'不支持的 focus');
 if(o.out)o.out=path.resolve(o.out);
 if(o.reuse)o.reuse=path.resolve(o.reuse);
 if(o.input)o.input=path.resolve(o.input);
 return o;
}
function safeTarget(out){
 const resolved=actualPath(out);
 check(!inside(resolved,actualPath(ROOT)),'任务结果须放在工作区，不能写入技能包');
 return resolved;
}
function loadReceipt(file){try{return readJson(file);}catch{return null;}}
function trusted(data,bytes,receipt,fingerprint){
 if(!receipt)return false;
 const {checksum,...payload}=receipt;
 return receipt.schema_version==='suanming-validation/v1'&&receipt.validation?.ok===true&&receipt.validation?.recalculated===true&&
  receipt.fingerprint===fingerprint&&receipt.artifact_sha256===sha(bytes)&&receipt.artifact_checksum===data.checksum?.value&&checksum===hash(payload);
}
function receiptFor(data,bytes,fingerprint,keys){
 const r={schema_version:'suanming-validation/v1',workflow_version:VERSION,adapter_id:core.adapter(data).id,
  fingerprint,artifact_sha256:sha(bytes),artifact_checksum:data.checksum.value,
  input_keys:[...new Set([...keys,core.calculationKey(data.input)])],validation:{ok:true,recalculated:true},verified_at:new Date().toISOString()};
 return {...r,checksum:hash(r)};
}
function boundedResponse(base,data,options){
 const {project}=require('./context.cjs');
 let limit=options.limit??(data.input.mode==='time_compare'?5:3);
 while(limit>=1){
  const context=project(data,{...options,limit});
  const result={...base,context,...(base.files?.chart?{task_id:taskId(base.files)}:{}),next_actions:executableActions(nextActions(context,base.people_page),base.files),output:{max_bytes:MAX_OUTPUT_BYTES,bytes:0,requested_limit:options.limit??null,effective_limit:limit,budget_adjusted:limit!==(options.limit??(data.input.mode==='time_compare'?5:3))}};
  // Reserve room for lifecycle metadata in both the raw JSON and full shell envelope.
  budget.stamp(result);
  if(budget.fits(result,MAX_OUTPUT_BYTES,128))return result;
  limit--;
 }
 if(data.input.mode==='relationship'&&data.people.length===2&&!options.person&&!options.comparison){
  return boundedResponse({...base,people_page:{requested:['a','b'],included:['a'],next_person:'b'}},data,{...options,person:'a'});
 }
 const e=new Error('本主题的最小上下文仍超过预算；用 --person a/b、--field 字段编号或 --candidate 候选编号缩小范围。完整结果可通过 --reuse 继续提取。');e.code='context_budget_exceeded';throw e;
}
function compute(o){
 const fingerprint=core.fingerprint();
 let data,validation,cacheHit=false,calculationPerformed=false,chartFile,receipt;
 if(o.reuse){
  chartFile=o.reuse;
  const bytes=fs.readFileSync(chartFile);data=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));core.integrity(data);
  const receiptFile=path.join(path.dirname(chartFile),RECEIPT);receipt=loadReceipt(receiptFile);
  if(trusted(data,bytes,receipt,fingerprint)){cacheHit=true;validation={ok:true,method:'verified_cache',recalculated:false};}
  else{validation=core.verify(data);receipt=receiptFor(data,bytes,fingerprint,[]);}
  o.out=safeTarget(o.out??path.dirname(chartFile));
  // A legacy/custom-named artifact gets verified each time unless it is the canonical workflow file.
  if(!cacheHit&&path.basename(chartFile)==='chart.json'){
   safeTarget(path.dirname(chartFile));atomicJson(path.join(path.dirname(chartFile),RECEIPT),receipt);
  }
 }else{
  o.out=safeTarget(o.out);chartFile=path.join(o.out,'chart.json');
  check(o.input!==chartFile&&o.input!==path.join(o.out,'context.json')&&o.input!==path.join(o.out,RECEIPT),'输出不能覆盖输入');
  const input=o.stdin?readStdinJson():readJson(o.input),key=core.calculationKey(input),receiptFile=path.join(o.out,RECEIPT);
  if(fs.existsSync(chartFile)){
   const bytes=fs.readFileSync(chartFile),previous=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));receipt=loadReceipt(receiptFile);
   // A new person's data must never overwrite an existing task, even when --refresh is set.
   check((receipt?.input_keys??[]).includes(key)||core.calculationKey(previous.input)===key,'目录已有不同的计算输入；请为新输入使用新任务目录');
   if(!o.refresh&&trusted(previous,bytes,receipt,fingerprint)){
    core.integrity(previous);data=previous;cacheHit=true;validation={ok:true,method:'verified_cache',recalculated:false};
   }
  }
  if(!data){
   const built=core.buildAndValidate(input);data=built.data;validation=built.validation;calculationPerformed=true;
   const bytes=Buffer.from(JSON.stringify(data)+'\n');
   receipt=receiptFor(data,bytes,fingerprint,[key]);
   atomicJson(chartFile,data);atomicJson(receiptFile,receipt);
  }
 }
 o.focus=o.focus??require('./context.cjs').defaultFocus(data);
 const files={chart:chartFile,context:path.join(o.out,'context.json'),validation:path.join(path.dirname(chartFile),RECEIPT)};
 const base={ok:true,workflow_version:VERSION,adapter_id:core.adapter(data).id,cache_hit:cacheHit,calculation_performed:calculationPerformed,
  validation,files,report_generated:Boolean(o.report)};
 // Projection and rendering must complete before publishing a new context or report.
 if(o.report){files.report_md=path.join(o.out,'report.md');files.report_html=path.join(o.out,'report.html');}
 const result=boundedResponse(base,data,o);
 if(o.report){
  const report=core.adapter(data).render(data);fs.mkdirSync(o.out,{recursive:true});
  fs.writeFileSync(files.report_md,report.markdown,{encoding:'utf8',mode:0o600});fs.writeFileSync(files.report_html,report.html,{encoding:'utf8',mode:0o600});
 }
 return result;
}
function operation(argv){
 const searches=argv.filter(a=>a==='--partner-search').length;
 if(searches){check(searches===1,'--partner-search 只能提供一次');return require('./partner-search-workflow.cjs').operation(argv.filter(a=>a!=='--partner-search'));}
 if(argv.length===1&&['--help','-h'].includes(argv[0]))return `V${VERSION} workflow\n--stdin --out TASK_DIR [--focus core|career|relationship|annual|wealth|age_relation|partner_image|intimacy] [--report]\n--temp-input INPUT.json --out TASK_DIR（结束后清理）；--input 保留原输入\n--reuse TASK_DIR/chart.json [--focus THEME] [--years YYYY:YYYY] [--offset N] [--limit 1..10]\n时辰对照：--field TC-... [--variant-offset N] 或 --candidate TC-001；关系盘：--person a|b；独立交叉证据：--comparison [--offset N] [--limit 1..10]（双人关系盘，focus=relationship）\n新盘同次重算校验；可信缓存不重算。stdout 与 context.json 是精简上下文；完整 chart.json 保留。\n--refresh 同时提供原始输入可强制重算；不同资料须使用新任务目录。`;
 let unlock;
 try{
 const r=withInputLifecycle(argv,args=>{
 const o=parse(args);
 o.out=safeTarget(o.out??path.dirname(o.reuse));
 const writes=[path.join(o.out,'context.json'),...(o.report?['report.md','report.html'].map(n=>path.join(o.out,n)):[]),
  ...(!o.reuse?[path.join(o.out,'chart.json'),path.join(o.out,RECEIPT)]:path.basename(o.reuse)==='chart.json'?[path.join(path.dirname(o.reuse),RECEIPT)]:[])];
 assertOutputs(o.input??o.reuse,writes);
 const dirs=[o.out,...(o.reuse&&!inside(actualPath(path.dirname(o.reuse)),actualPath(ROOT))?[path.dirname(o.reuse)]:[])];
 // Keep the locks through input cleanup and the single final context publication.
 unlock=acquireTaskLocks(dirs);
 return compute(o);
 });
  budget.assertFits(budget.stamp(r),MAX_OUTPUT_BYTES);
  atomicJson(r.files.context,r);
 return r;
 }finally{unlock?.();}
}
function main(argv){
 const r=operation(argv);
 console.log(typeof r==='string'?r:JSON.stringify(r));return r;
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(JSON.stringify(failureFor(e)));process.exitCode=2;}}
module.exports={main,operation,parse,trusted,receiptFor,boundedResponse,MAX_OUTPUT_BYTES};
