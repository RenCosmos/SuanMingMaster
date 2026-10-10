'use strict';
// Opt-in orchestration/projection only. Every sample uses the unchanged search engine.
const fs=require('node:fs'),path=require('node:path');
const core=require('./runtime-core.cjs'),search=require('./partner-search.cjs'),regular=require('./partner-search-workflow.cjs');
const {Temporal}=require('./common.cjs');
const {actualPath,inside,assertOutputs,acquireTaskLocks}=require('./task-files.cjs');
const {withInputLifecycle,readStdinJson}=require('./input-lifecycle.cjs');
const budget=require('./output-budget.cjs');
const {check,hash,sha,readJson,atomicJson,ROOT,VERSION}=core;
const SCHEMA='suanming-partner-search-batch/v1',ENGINE='partner-search-batch/1.0.1',LEGACY='partner-search-batch/1.0.0';
const RANKS=['monthly_top','global_top','all'],BRANCHES=[...'子丑寅卯辰巳午未申酉戌亥'];
const CHECKPOINT='suanming-partner-scan-checkpoint/v1';
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o?.[k]!==undefined).map(k=>[k,o[k]]));
function fields(o,keys,label){check(o&&typeof o==='object'&&!Array.isArray(o),label+' 须为对象');for(const k of Object.keys(o))check(keys.includes(k),label+' 不支持字段 '+k);}
function date(s){check(typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s),'日期须为 YYYY-MM-DD');return Temporal.PlainDate.from(s,{overflow:'reject'});}
function plan(start,end){
 let current=date(start);const last=date(end),rows=[];
 check(current.year>=1900&&last.year<=2100&&Temporal.PlainDate.compare(current,last)<=0,'批量日期范围须在1900–2100内且起止有序');
 check(current.until(last).days<=365,'批量搜索一次最多366个日期；更大范围另建任务');
 while(Temporal.PlainDate.compare(current,last)<=0){
  const edge=current.with({day:current.daysInMonth}),stop=Temporal.PlainDate.compare(edge,last)<0?edge:last;
  rows.push({month:current.toString().slice(0,7),start:current.toString(),end:stop.toString()});current=stop.add({days:1});
 }return rows;
}
function monthInput(input,row){const {ranking,candidate_year_branch,candidate_pillars,...rest}=input;return {...rest,mode:'partner_search',search:{...input.search,start:row.start,end:row.end}};}
function normalizeInput(raw){
 fields(raw,['mode','label','question','self','as_of','search','filters','partner_star_model','ranking','candidate_year_branch','candidate_pillars'],'批量输入');
 check(raw.mode==='partner_search_batch','批量 mode 须为 partner_search_batch');
 fields(raw.search,['type','start','end','timezone','longitude','longitude_source','time_uncertainty','options'],'search');
 check(raw.search.type==='dates','批量仅支持 dates；years/people 沿用原入口');
 const rows=plan(raw.search.start,raw.search.end),ranking=raw.ranking??'monthly_top';
 check(RANKS.includes(ranking),'ranking 须为 monthly_top / global_top / all');
 if(raw.candidate_year_branch!==undefined)check(BRANCHES.includes(raw.candidate_year_branch),'candidate_year_branch 须为一个地支');
 if(raw.candidate_pillars!==undefined){search.manualPillars(raw.candidate_pillars);check(raw.candidate_year_branch===undefined||raw.candidate_year_branch===raw.candidate_pillars[0][1],'候选年支与目标四柱年支不一致');}
 const normalized=search.normalizeInput(monthInput(raw,rows[0]));
 return {...normalized,mode:'partner_search_batch',search:{...normalized.search,start:raw.search.start,end:raw.search.end},ranking,
  ...(raw.candidate_year_branch===undefined?{}:{candidate_year_branch:raw.candidate_year_branch}),
  ...(raw.candidate_pillars===undefined?{}:{candidate_pillars:[...raw.candidate_pillars]})};
}
function inputKey(input){const copy=structuredClone(input);delete copy.label;delete copy.question;return hash(copy);}
function signed(data){const {checksum,...body}=data;return {...body,checksum:{algorithm:'sha256-canonical-json',value:hash(body)}};}
function integrity(data){
 check(data?.schema_version===SCHEMA&&[ENGINE,LEGACY].includes(data.engine_version)&&data.partner_search_engine===search.VERSION,'不支持的批量任务版本');
 check(data.engine_version!==LEGACY||data.input?.candidate_pillars===undefined,'旧批量版本不能含目标四柱约束');
 const {checksum,...body}=data;check(checksum?.algorithm==='sha256-canonical-json'&&checksum.value===hash(body),'批量任务校验和不匹配');
 const input=normalizeInput(data.input),rows=plan(input.search.start,input.search.end);
 check(hash(input)===hash(data.input)&&data.input_key===inputKey(input),'批量输入或键不一致');
 check(Array.isArray(data.jobs)&&data.jobs.length<=rows.length,'批量月份索引无效');
 const seen=new Set();
 for(const job of data.jobs){
  const row=rows.find(r=>r.month===job.month);check(row&&!seen.has(job.month),'月份重复或超出任务范围');seen.add(job.month);
  check(job.start===row.start&&job.end===row.end&&job.chart==='months/'+row.month+'/chart.json','月份路径或范围与原输入不一致');
  check(/^[a-f0-9]{64}$/.test(job.artifact_sha256)&&/^[a-f0-9]{64}$/.test(job.artifact_checksum),'月份产物签名无效');
 }
 check(data.complete===(data.jobs.length===rows.length),'批量完整状态与月份数不符');
 return data;
}
function parse(argv){
 const o={},flags={'--stdin':'stdin','--resume':'resume'},pairs={'--input':'input','--reuse':'reuse','--out':'out','--source-chart':'source_chart','--source-person':'source_person','--rank':'rank','--month':'month','--date':'date','--offset':'offset','--limit':'limit','--time-budget':'time_budget','--max-days':'max_days'};
 for(let i=0;i<argv.length;i++){const arg=argv[i],key=flags[arg]??pairs[arg];check(key&&!(key in o),'批量不支持或重复参数 '+arg);if(flags[arg])o[key]=true;else{check(argv[i+1]!==undefined&&!argv[i+1].startsWith('--'),arg+' 缺少值');o[key]=argv[++i];}}
 check(['stdin','input','reuse'].filter(k=>o[k]).length===1,'只选 --stdin、--temp-input/--input 或 --reuse');
 check(o.reuse||o.out,'新批量搜索需要 --out 独立目录');
 check(!o.reuse||!o.out,'批量 --reuse 使用原任务目录，不另指定 --out');
 check(!o.resume||o.reuse,'--resume 须随 --reuse 批量任务');
 check(!(o.month&&o.date),'--month 与 --date 不同时使用');
 check(!(o.month||o.date||o.rank)||o.reuse,'--month/--date/--rank 用于批量 --reuse；新任务在JSON中指定ranking');
 check(!o.source_chart||!o.reuse,'原盘导入仅用于新任务');check(!o.source_person||o.source_chart,'--source-person 须随--source-chart');
 if(o.source_person)check(['a','b'].includes(o.source_person),'--source-person 须为 a/b');
 if(o.rank)check(RANKS.includes(o.rank),'--rank 须为 monthly_top/global_top/all');
 if(o.month)check(/^\d{4}-\d{2}$/.test(o.month),'--month 须为 YYYY-MM');
 if(o.date)date(o.date);
 for(const k of ['offset','limit'])if(k in o){check(/^\d+$/.test(o[k]),k+' 须为整数');o[k]=Number(o[k]);check(Number.isSafeInteger(o[k])&&o[k]>=(k==='limit'?1:0)&&(k!=='limit'||o[k]<=13),k+' 超出范围');}
 for(const [k,max] of [['time_budget',60],['max_days',366]])if(k in o){check(/^\d+$/.test(o[k]),k+' 须为整数');o[k]=Number(o[k]);check(o[k]>=1&&o[k]<=max,k+' 超出范围');}
 check(!(o.time_budget||o.max_days)||!o.reuse||o.resume,'执行预算仅用于新任务或 --resume，不用于结果读取');
 for(const k of ['input','reuse','out','source_chart'])if(o[k])o[k]=path.resolve(o[k]);return o;
}
function action(file,flags,label){return {action:'reuse',label,entrypoint:'scripts/mobile.sh',argv:['--reuse',file,'--partner-search','--batch',...flags]};}
function relationKey(r){return hash(pick(r,['type','symbols','pillars','group_state']));}
function groupDates(data,branch,pillars){
 const all=data.candidates,scoped=all.filter(c=>(!branch||c.pillars[0].branch===branch)&&(!pillars||c.full_bazi?.every((p,i)=>p===pillars[i]))),groups=new Map(),signatures=new Map();
 for(const c of scoped){
  const d=c.local_datetime.slice(0,10),score=c.evaluation.matched_condition_count;
  if(!groups.has(d))groups.set(d,{date:d,year_pillars:new Set(),day_pillars:new Set(),hours:new Set(),matching_samples:0,best_samples:0,max_matched:-1,condition_sets:new Map(),common:null,union:new Map(),points:[]});
  const g=groups.get(d);g.points.push(c);g.matching_samples++;g.year_pillars.add(c.full_bazi[0]);g.day_pillars.add(c.full_bazi[2]);g.hours.add(c.full_bazi[3]);
  if(score>g.max_matched){g.max_matched=score;g.best_samples=0;g.condition_sets.clear();}
  if(score===g.max_matched){g.best_samples++;g.condition_sets.set(hash(c.evaluation.matched_conditions),c.evaluation.matched_conditions);}
  const signature=c.full_bazi?JSON.stringify(c.full_bazi):null;
  let keys=signature?signatures.get(signature):null;if(!keys){keys=new Set(c.evaluation.risk_relations.map(relationKey));if(signature)signatures.set(signature,keys);}
  g.common=g.common===null?keys:new Set([...g.common].filter(k=>keys.has(k)));
  for(const r of c.evaluation.risk_relations)g.union.set(relationKey(r),r);
 }
 return {groups:[...groups.values()].sort((a,b)=>b.max_matched-a.max_matched||a.date.localeCompare(b.date)),outside_scope_samples:all.length-scoped.length};
}
function dateRow(g,file,rank){
 const types=keys=>[...new Set([...keys].map(k=>g.union.get(k).type))];
 return {date:g.date,year_pillars:[...g.year_pillars],day_pillars:[...g.day_pillars],max_matched:g.max_matched,
  conditions_at_best:[...g.condition_sets.values()],matching_samples:g.matching_samples,best_samples:g.best_samples,hour_variant_count:g.hours.size,
  sample_shared_risk_types:types(g.common),sample_conditional_risk_types:types([...g.union.keys()].filter(k=>!g.common.has(k))),
  details:action(file,['--date',g.date,'--rank',rank,'--offset','0','--limit','3'],'展开该日期的采样时辰；不是已知出生时辰')};
}
function loadChild(out,row,input,create,expected,fingerprint,verifiedData){
 const dir=path.join(out,'months',row.month),file=path.join(dir,'chart.json');
 check(inside(actualPath(dir),out),'月份目录不能通过链接跳出批量任务');
 if(!create&&!verifiedData){
  const bytes=fs.readFileSync(file),data=JSON.parse(bytes.toString('utf8'));search.integrity(data);
  check(regular.calculationKey(data.input)===regular.calculationKey(monthInput(input,row)),'月份产物与本次任务不一致');
  check(regular.trusted(data,bytes,readJson(path.join(dir,'validation.json')),fingerprint),'月份验证回执不可信');
  if(expected)check(expected.artifact_sha256===sha(bytes)&&expected.artifact_checksum===data.checksum.value,'月份文件已改变；不使用旧索引解释新产物');
  return {data,response:{validation:{recalculated:false}},job:expected};
 }
 const response=create?regular.operation(['--stdin','--out',dir,'--limit','1'],{rawInput:monthInput(input,row),fingerprint,verifiedData}):regular.operation(['--reuse',file,'--limit','1'],{fingerprint,verifiedData});
 const bytes=fs.readFileSync(file),data=JSON.parse(bytes.toString('utf8'));search.integrity(data);
 check(data.checksum.value===response.context.source_checksum&&regular.calculationKey(data.input)===regular.calculationKey(monthInput(input,row)),'月份产物与本次任务不一致');
 check(regular.trusted(data,bytes,readJson(response.files.validation),fingerprint),'月份验证回执不可信');
 if(expected)check(expected.artifact_sha256===sha(bytes)&&expected.artifact_checksum===data.checksum.value,'月份文件已改变；不使用旧索引解释新产物');
 return {data,response,job:{...row,chart:'months/'+row.month+'/chart.json',artifact_sha256:sha(bytes),artifact_checksum:data.checksum.value}};
}
function scanMonth(out,row,input,fingerprint,execution,now){
 const raw=monthInput(input,row),key=regular.calculationKey(raw),file=path.join(out,'months',row.month,'scan-checkpoint.json');
 check(inside(actualPath(file),out),'扫描检查点不能通过链接跳出任务');
 let resume=null;
 if(fs.existsSync(file)){
  const saved=readJson(file),{checksum,...body}=saved;
  check(saved.schema_version===CHECKPOINT&&checksum?.value===hash(body),'扫描检查点校验失败；保留原文件');
  if(saved.fingerprint===fingerprint&&saved.input_key===key&&saved.recalculated===true)resume=saved.state;
  // A changed runtime/rule never silently trusts an old partial scan.
 }
 const a=search.createScan(raw,resume?structuredClone(resume):undefined),b=search.createScan(raw,resume?structuredClone(resume):undefined);
 check(hash(a.snapshot().self)===hash(b.snapshot().self),'本人结构独立计算不一致');
 while(true){
  const before=a.snapshot(),oldResults=before.results.length,oldUnavailable=before.unavailable.length;
  if(!a.step())break;
  check(b.step(),'独立扫描游标不一致');
  const left=a.snapshot(),right=b.snapshot();
  const delta=s=>({...pick(s,['nextDate','examined','outsideGap','failedConditions','excludedRelations']),results:s.results.slice(oldResults),unavailable:s.unavailable.slice(oldUnavailable)});
  check(hash(delta(left))===hash(delta(right)),'当天采样与独立重算不一致');
  execution.completed_days_this_call++;
  execution.active_month=row.month;execution.next_date=left.nextDate;
  if(date(left.nextDate).since(date(row.end)).days<=0&&(now()>=execution.deadline||execution.completed_days_this_call>=execution.max_days)){
   atomicJson(file,signed({schema_version:CHECKPOINT,fingerprint,input_key:key,recalculated:true,state:left}));
   return null;
  }
 }
 const data=a.finish(),verified=b.finish();check(hash(data)===hash(verified),'月份完整结果与独立重算不一致');
 return data;
}
function projected(manifest,loaded,o,base){
 const rows=plan(manifest.input.search.start,manifest.input.search.end),rank=o.rank??manifest.input.ranking,file=base.files.chart,offset=o.offset??0;
 const groups=new Map();for(const [month,child] of loaded)groups.set(month,groupDates(child.data,manifest.input.candidate_year_branch,manifest.input.candidate_pillars));
 const highest=Math.max(-1,...[...groups.values()].flatMap(x=>x.groups.map(g=>g.max_matched)));
 const visible=row=>{const gs=groups.get(row.month)?.groups??[];if(rank==='all')return gs;const max=rank==='global_top'?highest:(gs[0]?.max_matched??-1);return gs.filter(g=>g.max_matched===max);};
 const complete=manifest.complete&&loaded.size===rows.length;
 const common={schema_version:'suanming-partner-search-batch-context/v1',source_checksum:manifest.checksum.value,computed_complete:complete,
  scope:{start:manifest.input.search.start,end:manifest.input.search.end,timezone:manifest.input.search.timezone,candidate_year_branch:manifest.input.candidate_year_branch??null,...(manifest.input.candidate_pillars?{candidate_pillars:manifest.input.candidate_pillars}:{})},
  ranking:rank,filters:manifest.input.filters,condition_count:manifest.input.filters.conditions.length,partner_star_model:manifest.input.partner_star_model,
  evidence_scope:'假设采样点；日期命中数不是合婚分数或概率。共同/条件风险只对已命中采样点比较，不证明整天或未知真实时辰。',
  unknown_birth_time:manifest.input.search.time_uncertainty.type!=='candidates'||manifest.input.search.time_uncertainty.times.length!==1,
  candidate_birth_time_is_hypothetical:true,selected_partner:null,probability:null};
 const pending=rows.filter(r=>!loaded.has(r.month));common.progress={completed_months:loaded.size,total_months:rows.length,pending_months:pending.map(r=>r.month)};
 const resume=pending.length?[action(file,['--resume','--rank',rank,'--time-budget',String(base.execution.time_budget_seconds)],'继续已保存扫描；不要重建输入或提高到600秒')]:[];
 common.ranking_final=complete;
 common.progress.active_month=base.execution.active_month;
 common.progress.next_date=base.execution.next_date;
 if(o.date){
  const row=rows.find(r=>r.month===o.date.slice(0,7));check(row&&loaded.has(row.month),'所选日期的月份尚未完成或不在范围');
  const group=groups.get(row.month).groups.find(g=>g.date===o.date);check(group,'该日期没有本次范围／条件命中的采样点');
  let limit=Math.min(o.limit??3,10);
  while(limit>=1){
   const child=loaded.get(row.month),context=regular.project({...child.data,candidates:group.points},{offset,limit});
   context.schema_version='suanming-partner-search-batch-date-context/v1';context.selection.date=o.date;context.birth_time_is_hypothetical=true;delete context.next_actions;
   const next=context.candidates.next_offset,actions=[...resume,...(next===null?[]:[action(file,['--date',o.date,'--rank',rank,'--offset',String(next),'--limit',String(limit)],'继续该日期，不跳到其他日期')])];
   const r={...base,context:{...common,date_detail:context},next_actions:actions,output:{max_bytes:budget.WORKFLOW_BYTES,bytes:0,effective_limit:limit}};
   budget.stamp(r);if(budget.fits(r,budget.WORKFLOW_BYTES,128))return r;limit--;
  }throw new Error('日期详情最小页超出预算；完整月份文件保留');
 }
 if(o.month)check(rows.some(r=>r.month===o.month),'月份不在本任务范围');
 const selected=o.month?rows.filter(r=>r.month===o.month):rows;
 let limit=o.limit??(o.month?5:13);
 while(limit>=1){
  const page=o.month?selected:selected.slice(offset,offset+limit),actions=[...resume];
  const months=page.map(row=>{
   if(!loaded.has(row.month))return {month:row.month,status:'not_completed',date_page:{total:0,returned:0,next_offset:null},dates:[]};
   const gs=visible(row),dateOffset=o.month?offset:0,dateLimit=o.month?limit:5,portion=gs.slice(dateOffset,dateOffset+dateLimit),next=dateOffset+portion.length<gs.length?dateOffset+portion.length:null;
   if(next!==null)actions.push(action(file,['--month',row.month,'--rank',rank,'--offset',String(next),'--limit',String(dateLimit)],'继续该月剩余日期'));
   const child=loaded.get(row.month);return {month:row.month,status:'completed',coverage:pick(child.data.coverage,['examined','accepted','unavailable']),outside_scope_samples:groups.get(row.month).outside_scope_samples,
    monthly_maximum:groups.get(row.month).groups[0]?.max_matched??null,date_page:{total:gs.length,offset:dateOffset,returned:portion.length,next_offset:next},dates:portion.map(g=>dateRow(g,file,rank))};
  });
  const nextMonth=!o.month&&offset+page.length<selected.length?offset+page.length:null;
  if(nextMonth!==null)actions.push(action(file,['--rank',rank,'--offset',String(nextMonth),'--limit',String(limit)],'继续月份摘要'));
  const first=offset===0&&!o.month,context={...common,months_page:{total:selected.length,offset:o.month?0:offset,returned:page.length,next_offset:nextMonth},months,
   ...(first?{self:pick(loaded.values().next().value?.data.self,['pillars','birth_year']),sources:search.RULES.sources}:{source_ids:search.RULES.sources.map(s=>s.id)})};
  context.summary_page_complete=complete&&nextMonth===null&&months.every(m=>m.date_page.next_offset===null);
  const r={...base,context,next_actions:actions,output:{max_bytes:budget.WORKFLOW_BYTES,bytes:0,effective_limit:limit,budget_adjusted:limit!==(o.limit??(o.month?5:13))}};
  budget.stamp(r);if(budget.fits(r,budget.WORKFLOW_BYTES,128))return r;limit--;
 }throw new Error('批量最小摘要超出预算；完整月份文件保留');
}
function operation(argv,{now=()=>performance.now()}={}){
 if(argv.length===1&&['--help','-h'].includes(argv[0]))return 'V'+VERSION+' partner_search --batch\n新任务：--stdin/--temp-input FILE --out TASK；JSON mode=partner_search_batch，search.type=dates，一次最多366日期。\n默认20秒计算预算，日级独立重算后保存进度；--time-budget 1..60（秒），--max-days 1..366可限制本次天数。\n复用：--reuse TASK/batch.json [--rank monthly_top|global_top|all] [--offset N --limit 1..13]\n按月日期页：--month YYYY-MM；时辰详情：--date YYYY-MM-DD；未完成任务用返回的--resume argv。execution.state=yielded是正常待续跑，不是报错；未完成不能断全年最高。始终附带 --partner-search --batch，经 mobile.sh 调用。';
 const started=now();
 let unlock;try{
  const result=withInputLifecycle(argv,args=>{
   const o=parse(args),out=actualPath(o.reuse?path.dirname(o.reuse):o.out),file=path.join(out,'batch.json');
   check(!inside(out,actualPath(ROOT)),'批量任务不能写入技能包');if(o.reuse)check(actualPath(o.reuse)===actualPath(file),'批量复用须选择该目录的 batch.json');
   let input;if(!o.reuse){let raw=o.stdin?readStdinJson():readJson(o.input);if(o.source_chart)raw=regular.importSource(raw,o);input=normalizeInput(raw);}
   const source=o.input??o.reuse,targets=[file,path.join(out,'context.json')];
   const existing=o.reuse||fs.existsSync(file)?integrity(readJson(file)):null;
   if(existing){if(input)check(inputKey(input)===existing.input_key,'目录已有不同批量输入；请新建目录');input=existing.input;}
   else check(!fs.existsSync(path.join(out,'chart.json'))&&!fs.existsSync(path.join(out,'context.json')),'目录已有其他任务结果；请使用新的独立批量目录');
   const rows=plan(input.search.start,input.search.end);
   for(const row of rows)for(const name of ['chart.json','context.json','validation.json','scan-checkpoint.json'])targets.push(path.join(out,'months',row.month,name));
   assertOutputs(o.reuse?null:source,targets);if(o.source_chart)assertOutputs(o.source_chart,targets);
   unlock=acquireTaskLocks([out]);
   // Re-read under the lock; never replace a concurrently changed manifest.
   let manifest=fs.existsSync(file)?integrity(readJson(file)):signed({schema_version:SCHEMA,engine_version:ENGINE,partner_search_engine:search.VERSION,input,input_key:inputKey(input),jobs:[],complete:false});
   check(manifest.input_key===inputKey(input),'批量输入在锁定前改变');
   // Persist the recovery plan before the first potentially slow calculation.
   if(!fs.existsSync(file))atomicJson(file,manifest);
   const loaded=new Map(),create=!o.reuse||o.resume;let recalculated=false,lastError=null,yielded=false;
   const fingerprint=core.fingerprint(),execution={time_budget_seconds:o.time_budget??20,completed_days_this_call:0,max_days:o.max_days??366,active_month:null,next_date:null};
   execution.deadline=started+execution.time_budget_seconds*1000;
   for(const row of rows){
    const prior=manifest.jobs.find(j=>j.month===row.month);if(!prior&&!create)continue;
    try{
     let verifiedData;
     let needsScan=!prior&&create;
     if(prior){
      const f=path.join(out,prior.chart);check(inside(actualPath(f),out),'月份路径不能跳出任务');
      const bytes=fs.readFileSync(f),data=JSON.parse(bytes.toString('utf8'));search.integrity(data);
      check(sha(bytes)===prior.artifact_sha256&&data.checksum.value===prior.artifact_checksum,'月份文件已改变；不使用旧索引解释新产物');
      let receipt;try{receipt=readJson(path.join(path.dirname(f),'validation.json'));}catch{}
      needsScan=!regular.trusted(data,bytes,receipt,fingerprint);
     }
     if(needsScan){
      if(execution.completed_days_this_call>0&&(now()>=execution.deadline||execution.completed_days_this_call>=execution.max_days)){yielded=true;break;}
      verifiedData=scanMonth(out,row,input,fingerprint,execution,now);
      if(!verifiedData){yielded=true;recalculated=true;break;}
     }
     const child=loadChild(out,row,input,!prior&&create,prior,fingerprint,verifiedData);
     loaded.set(row.month,child);recalculated ||= child.response.validation.recalculated;
     if(!prior){manifest.jobs.push(child.job);manifest=signed({...manifest,complete:manifest.jobs.length===rows.length});atomicJson(file,manifest);}
    }catch(e){
     if(prior)throw e;lastError={month:row.month,error:String(e.message).slice(0,240)};break;
    }
   }
   manifest=signed({...manifest,complete:manifest.jobs.length===rows.length,last_error:lastError});atomicJson(file,manifest);
   const complete=manifest.complete&&loaded.size===rows.length;
   const publicExecution={...pick(execution,['time_budget_seconds','completed_days_this_call','active_month','next_date']),elapsed_ms:Math.round(now()-started),state:complete?'complete':lastError?'failed':yielded?'yielded':'incomplete',stop_reason:yielded?(execution.completed_days_this_call>=execution.max_days?'day_limit':'time_budget'):null};
   const base={ok:complete,partial:!complete,workflow_version:VERSION,adapter_id:'partner_search_batch',execution:publicExecution,
    validation:{ok:complete,completed_jobs_validated:true,recalculated},cache_hit:loaded.size>0&&!recalculated,calculation_performed:recalculated,
    files:{chart:file,context:path.join(out,'context.json')},task_id:'SMB-'+hash(out).slice(0,12),...(lastError?{error:lastError}:{})};
   return projected(manifest,loaded,o,base);
  });
  budget.assertFits(budget.stamp(result),budget.WORKFLOW_BYTES);atomicJson(result.files.context,result);return result;
 }finally{unlock?.();}
}
module.exports={operation,normalizeInput,plan,monthInput,inputKey,integrity,groupDates,dateRow,SCHEMA,ENGINE};
