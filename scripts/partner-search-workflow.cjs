'use strict';
const fs=require('node:fs'),path=require('node:path');
const core=require('./runtime-core.cjs');
const {ROOT,VERSION,check,hash,sha,readJson,atomicJson}=core;
const {actualPath,inside,assertOutputs,acquireTaskLocks}=require('./task-files.cjs');
const {withInputLifecycle,readStdinJson}=require('./input-lifecycle.cjs');
const {taskId}=require('./workflow-hints.cjs');
const search=require('./partner-search.cjs');
const MAX_OUTPUT_BYTES=20*1024,RECEIPT='suanming-partner-search-validation/v1';
function parse(argv){
 const o={},flags={'--stdin':'stdin','--refresh':'refresh','--report':'report'},pairs={'--input':'input','--reuse':'reuse','--out':'out','--offset':'offset','--limit':'limit','--candidate':'candidate','--source-chart':'source_chart','--source-person':'source_person'};
 for(let i=0;i<argv.length;i++){const arg=argv[i],key=flags[arg]??pairs[arg];check(key&&!(key in o),'候选筛选不支持或重复参数 '+arg);if(flags[arg])o[key]=true;else{check(argv[i+1]!==undefined&&!argv[i+1].startsWith('--'),arg+' 缺少值');o[key]=argv[++i];}}
 check(['stdin','input','reuse'].filter(k=>o[k]).length===1,'只选择 --stdin、--temp-input/--input 或 --reuse 之一');check(o.reuse||o.out,'新搜索需要 --out 独立任务目录');
 check(!o.refresh||!o.reuse,'--refresh 须带原始搜索输入');check(!o.source_chart||!o.reuse,'--source-chart 用于新搜索，不能与--reuse混用');check(!o.source_person||o.source_chart,'--source-person 须随--source-chart');
 if(o.source_person)check(['a','b'].includes(o.source_person),'--source-person 须为 a / b');
 for(const k of ['offset','limit'])if(k in o){check(/^\d+$/.test(o[k]),k+' 须为整数');o[k]=Number(o[k]);check(Number.isSafeInteger(o[k])&&o[k]>=(k==='limit'?1:0)&&(k!=='limit'||o[k]<=10),k+' 超出范围');}
 for(const k of ['input','reuse','out','source_chart'])if(o[k])o[k]=path.resolve(o[k]);
 return o;
}
function safeTarget(out){const actual=actualPath(out);check(!inside(actual,actualPath(ROOT)),'任务结果不能写入技能包');return actual;}
function calculationKey(raw){const v=search.normalizeInput(raw);delete v.label;delete v.question;return hash(v);}
function receiptFor(data,bytes,fingerprint,key){const r={schema_version:RECEIPT,workflow_version:VERSION,input_key:key,artifact_sha256:sha(bytes),artifact_checksum:data.checksum.value,fingerprint,validation:{ok:true,recalculated:true},verified_at:new Date().toISOString()};return {...r,checksum:hash(r)};}
function trusted(data,bytes,receipt,fingerprint){if(!receipt)return false;const {checksum,...r}=receipt;return r.schema_version===RECEIPT&&r.validation?.ok===true&&r.validation.recalculated===true&&checksum===hash(r)&&r.fingerprint===fingerprint&&r.artifact_sha256===sha(bytes)&&r.artifact_checksum===data.checksum.value&&r.input_key===calculationKey(data.input);}
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o?.[k]!==undefined).map(k=>[k,o[k]]));
function project(data,{offset=0,limit=3,candidate}={}){
 let list=data.candidates;if(candidate){list=list.filter(c=>c.id===candidate);check(list.length===1,'候选编号不存在；先检查本任务返回的候选索引');}
 const items=list.slice(offset,offset+limit).map(c=>candidate?c:{...pick(c,['id','kind','person_id','birth_year_label','year_pillar','year_label_gap','animal','full_bazi','local_datetime','timezone','interval','eligible_birth_interval','identity_status','age_cue_alignment','warnings']),evaluation:pick(c.evaluation,['candidate_anchor','zodiac_relation','self_to_candidate_anchor_ten_god','candidate_anchor_to_self_ten_god','matched_conditions','unmatched_conditions','matched_condition_count','anchor_relations','missing_evidence','probability','confirmed_partner']),risk_types:[...new Set(c.evaluation.risk_relations.map(r=>r.type))]});
 const next=offset+items.length<list.length?offset+items.length:null;
 const age=data.self.age_cue;return {schema_version:'suanming-partner-search-context/v1',source_checksum:data.checksum.value,selection:{offset,limit,candidate:candidate??null},
  self:{...pick(data.self,['source_kind','calendar_verified','birth_year','birth_date','pillars','spouse_star_occurrences','spouse_palace','warnings']),age_cue:age?{...pick(age,['label','tendency','basis','status','exact_age_gap']),matches:age.ziwei.matches}:null},
  coverage:data.coverage,filters:data.input.filters,partner_star_model:data.input.partner_star_model,as_of:data.input.as_of,candidates:{total:list.length,offset,returned:items.length,next_offset:next,items},
  unavailable:{total:data.unavailable.length,items:data.unavailable.slice(0,3)},sources:data.sources,ordering:data.ordering,interpretation_scope:data.interpretation_scope,selected_partner:null,probability:null,
  next_actions:next===null?[]:[{action:'reuse',command_flags:['--agent','--partner-search'],offset:next,limit,...(candidate?{candidate}:{})}]};
}
function boundedResponse(base,data,o){
 let limit=o.limit??3;while(limit>=1){const context=project(data,{...o,limit}),r={...base,context,task_id:taskId(base.files),next_actions:context.next_actions,output:{max_bytes:MAX_OUTPUT_BYTES,bytes:0,requested_limit:o.limit??null,effective_limit:limit,budget_adjusted:limit!==(o.limit??3)}};
  for(let i=0;i<3;i++)r.output.bytes=Buffer.byteLength(JSON.stringify(r)+'\n');const text=JSON.stringify(r)+'\n';
  if(Buffer.byteLength(text)<MAX_OUTPUT_BYTES-128&&Buffer.byteLength(JSON.stringify({stdout:text}))<28*1024)return r;limit--;
 }
 const e=new Error('候选最小上下文超出预算；请缩小条件或年份／日期范围，完整结果保留。');e.code='context_budget_exceeded';throw e;
}
function importSource(raw,o){
 check(raw.self===undefined,'--source-chart 时输入不再提供self；避免混淆人物');const artifact=readJson(o.source_chart);core.verify(artifact);
 let chart;if(artifact.bazi)chart=artifact;else if(artifact.schema_version==='bazi-ziwei-relationship/v4'){
  check(artifact.people.length===1||o.source_person,'双人原盘须明确--source-person a/b，不自动选人');chart=artifact.people.find(p=>p.id===(o.source_person??'a'))?.chart;
 }
 check(chart?.bazi,'原盘须有明确的单人八字；未知时辰请先核对候选，不擅选最优时辰');
 return {...raw,self:{birth:chart.input.birth,options:chart.input.options,chart_mode:chart.ziwei?'both':'bazi'}};
}
function compute(o){
 const fingerprint=core.fingerprint();let data,validation,receipt,cacheHit=false,calculated=false,chartFile=o.reuse??path.join(o.out,'chart.json');
 const validationFile=path.join(path.dirname(chartFile),'validation.json');
 if(o.reuse){const bytes=fs.readFileSync(chartFile);data=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));search.integrity(data);try{receipt=readJson(validationFile);}catch{};
  if(trusted(data,bytes,receipt,fingerprint)){cacheHit=true;validation={ok:true,method:'verified_cache',recalculated:false};}
  else{search.validateArtifact(data);validation={ok:true,method:'recalculated',recalculated:true};if(path.basename(chartFile)==='chart.json')atomicJson(validationFile,receiptFor(data,bytes,fingerprint,calculationKey(data.input)));}
 }else{
  let raw=o.stdin?readStdinJson():readJson(o.input);if(o.source_chart)raw=importSource(raw,o);const key=calculationKey(raw);
  if(fs.existsSync(chartFile)){const bytes=fs.readFileSync(chartFile),previous=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));search.integrity(previous);check(calculationKey(previous.input)===key,'目录已有不同的计算输入；请使用新任务目录');
   try{receipt=readJson(validationFile);}catch{};if(!o.refresh&&trusted(previous,bytes,receipt,fingerprint)){data=previous;cacheHit=true;validation={ok:true,method:'verified_cache',recalculated:false};}
  }
  if(!data){data=search.build(raw);search.validateArtifact(data);calculated=true;validation={ok:true,method:'recalculated',recalculated:true};const bytes=Buffer.from(JSON.stringify(data)+'\n');atomicJson(chartFile,data);atomicJson(validationFile,receiptFor(data,bytes,fingerprint,key));}
 }
 const files={chart:chartFile,context:path.join(o.out,'context.json'),validation:validationFile};if(o.report){files.report_md=path.join(o.out,'report.md');files.report_html=path.join(o.out,'report.html');}
 const r=boundedResponse({ok:true,workflow_version:VERSION,adapter_id:'partner_search',validation,cache_hit:cacheHit,calculation_performed:calculated,files,report_generated:Boolean(o.report),...(o.source_chart?{source_chart:o.source_chart}: {})},data,o);
 if(o.report){const report=require('./partner-search-report.cjs').makeReport(data);fs.writeFileSync(files.report_md,report.markdown,{encoding:'utf8',mode:0o600});fs.writeFileSync(files.report_html,report.html,{encoding:'utf8',mode:0o600});}return r;
}
function operation(argv){
 if(argv.length===1&&['--help','-h'].includes(argv[0]))return `V${VERSION} partner_search\n--stdin/--temp-input FILE/--input FILE --out TASK_DIR [--source-chart 原chart.json --source-person a|b]\n--reuse TASK_DIR/chart.json [--offset N --limit 1..10 --candidate PSD-... --report]\n通过 mobile.sh 调用：--agent 输入选项 --partner-search。日期枚举最多31天；年柱最多61周期；命中数量不是概率。`;
 let unlock;try{
  const r=withInputLifecycle(argv,args=>{const o=parse(args);o.out=safeTarget(o.out??path.dirname(o.reuse));if(o.reuse)safeTarget(path.dirname(o.reuse));
   const writes=[path.join(o.out,'context.json'),...(o.report?['report.md','report.html'].map(n=>path.join(o.out,n)):[]),...(!o.reuse?[path.join(o.out,'chart.json'),path.join(o.out,'validation.json')]:path.basename(o.reuse)==='chart.json'?[path.join(path.dirname(o.reuse),'validation.json')]:[])];
   assertOutputs(o.input??o.reuse,writes);if(o.source_chart)assertOutputs(o.source_chart,writes);unlock=acquireTaskLocks([o.out,...(o.reuse?[path.dirname(o.reuse)]:[])]);return compute(o);
  });for(let i=0;i<3;i++)r.output.bytes=Buffer.byteLength(JSON.stringify(r)+'\n');check(r.output.bytes<=MAX_OUTPUT_BYTES,'最终响应超出预算');atomicJson(r.files.context,r);return r;
 }finally{unlock?.();}
}
module.exports={operation,parse,project,boundedResponse,calculationKey,MAX_OUTPUT_BYTES};
