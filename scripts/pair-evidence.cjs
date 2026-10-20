'use strict';
// Join verified, saved single-person evidence; never invent a birth time or build a joint calendar chart.
const fs=require('node:fs'),path=require('node:path');
const core=require('./runtime-core.cjs'),{check,hash,sha,readJson,atomicJson}=core;
const files=require('./task-files.cjs'),budget=require('./output-budget.cjs');
const evidence=require('./ten-god-evidence.cjs'),rules=require('./bazi-rules.cjs');
const SCHEMA='suanming-pair-evidence/v1',PROOF='suanming-pair-validation/v1';
function parse(argv){
 const o={focus:'relationship',offset:0,limit:10},seen=new Set(),pairs={'--reuse':'reuse','--pair-with':'pair_with','--out':'out','--offset':'offset','--limit':'limit','--pair-key':'pair_key','--focus':'focus'};
 for(let i=0;i<argv.length;i++){
  const a=argv[i];check(!seen.has(a),'重复参数 '+a);seen.add(a);
  if(a==='--brief'){o.brief=true;continue;}
  check(pairs[a]&&argv[i+1]!==undefined&&!argv[i+1].startsWith('--'),'交叉证据参数无效或缺值 '+a);o[pairs[a]]=argv[++i];
 }
 check(o.reuse&&o.pair_with&&o.out,'交叉证据须提供 --reuse、--pair-with 和 --out 独立目录');check(o.focus==='relationship','交叉证据只使用 --focus relationship');
 for(const k of ['offset','limit']){check(/^\d+$/.test(String(o[k])),k+' 须为整数');o[k]=Number(o[k]);check(Number.isSafeInteger(o[k])&&o[k]>=(k==='limit'?1:0)&&(k!=='limit'||o[k]<=10),k+' 超出范围');}
 if(o.pair_key)check(/^[a-f0-9]{64}$/.test(o.pair_key),'--pair-key 须为原结果的 pair_key');
 for(const k of ['reuse','pair_with','out'])o[k]=path.resolve(o[k]);return o;
}
function proofTrusted(r,key,fingerprint){if(!r)return false;const {checksum,...p}=r;return r.schema_version===PROOF&&r.pair_key===key&&r.fingerprint===fingerprint&&r.validation?.ok===true&&r.validation?.recalculated===true&&checksum===hash(p);}
function load(file){const bytes=fs.readFileSync(file),data=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));core.integrity(data);if(data.input.mode==='relationship')check(data.people.length===1,'交叉来源必须是单人；已有双人合盘请用 --comparison');const info=evidence.describe(data);return {file,bytes,data,info};}
function compare(a,b){
 const pa=a.natal.known_pillars,pb=b.natal.known_pillars,da=a.day_master.values,db=b.day_master.values;
 const god=(dm,s)=>dm.length===1?rules.tenGod(dm[0],s):null,ref=(person_id,source_id)=>({person_id,source_id});
 return {day_master_projection:{a_to_b:da.length===1&&db.length===1?god(da,db[0]):null,b_to_a:da.length===1&&db.length===1?god(db,da[0]):null,status:da.length===1&&db.length===1?'stable':'unavailable_day_master_varies'},
  pillar_matrix:pa.flatMap(x=>pb.map(y=>({id:`PE-${x.id}-${y.id}`,sources:[ref('a',x.id),ref('b',y.id)],a_ganzhi:x.ganzhi,b_ganzhi:y.ganzhi,a_to_b_ten_god:god(da,y.stem),b_to_a_ten_god:god(db,x.stem),same_branch:x.branch===y.branch,relations:rules.relations([{...x,id:'a:'+x.id},{...y,id:'b:'+y.id}]).map((r,i)=>({...r,id:`PE-${x.id}-${y.id}-RULE-${i+1}`}))}))),
  cross_relations:rules.relations([...pa.map(p=>({...p,id:'a:'+p.id})),...pb.map(p=>({...p,id:'b:'+p.id}))]).filter(r=>r.pillars.some(p=>p.startsWith('a:'))&&r.pillars.some(p=>p.startsWith('b:'))).map((r,i)=>({...r,id:`PE-CROSS-${i+1}`,sources:r.pillars.map(p=>{const i=p.indexOf(':');return ref(p.slice(0,i),p.slice(i+1));})}))};
}
function bounded(rows,o,key,validation){
 const all=compare(rows[0].info,rows[1].info),total=Math.max(all.pillar_matrix.length,all.cross_relations.length),max=budget.WORKFLOW_BYTES;
 check(o.offset===0||o.offset<total,'交叉证据 offset 超出范围');
 const page=(items,limit)=>({items:items.slice(o.offset,o.offset+limit),total:items.length,offset:o.offset,next_offset:o.offset+limit<items.length?o.offset+limit:null});
 const argv=(offset,limit)=>['--reuse',o.reuse,'--pair-with',o.pair_with,'--out',o.out,'--pair-key',key,'--offset',String(offset),'--limit',String(limit)];
 for(let limit=o.limit;limit>=1;limit--){
  const matrix=page(all.pillar_matrix,limit),cross=page(all.cross_relations,limit),next=o.offset+limit<total?o.offset+limit:null;
  const r={ok:true,workflow_version:core.VERSION,adapter_id:'pair_evidence',pair_key:key,task_id:'PE-'+key.slice(0,12),cache_hit:validation.method==='verified_pair_cache',calculation_performed:false,validation,
   files:{context:path.join(o.out,'pair-context.json'),validation:path.join(o.out,'pair-validation.json')},
   context:{schema_version:SCHEMA,focus:'relationship',kind:'stable_pillars_only',full_pair:false,pair_key:key,selection:{offset:o.offset,limit},
    sources:rows.map((s,i)=>({person_id:i?'b':'a',source_schema:s.data.schema_version,source_checksum:s.data.checksum.value,artifact_sha256:sha(s.bytes),task_id:require('./workflow-hints.cjs').taskId({chart:s.file}),coverage:s.info.coverage,conventions:s.info.conventions,target_date:s.info.current_dayun.target_date,
     day_master:s.info.day_master,known_pillars:s.info.natal.known_pillars.map(p=>({id:p.id,ganzhi:p.ganzhi})),uncertain_pillars:s.info.natal.uncertain_pillars.map(p=>({id:p.id,variant_count:p.values.length}))})),
    reading:{comparison:{day_master_projection:{...all.day_master_projection,reference_frames:{a_to_b:{observer:'a',observed:'b'},b_to_a:{observer:'b',observed:'a'}}},pillar_matrix:matrix,cross_relations:cross,cross_relation_context:require('./cross-relation-context.cjs').groupContext(cross.items,{a:rows[0].info.natal.known_pillars,b:rows[1].info.natal.known_pillars})}},
    pair_evidence:{missing:rows.flatMap((s,i)=>s.info.natal.uncertain_pillars.map(p=>({person_id:i?'b':'a',source_id:p.id,reason:'pillar_varies_with_birth_time'}))),not_computed:[...(rows.some(s=>s.info.natal.uncertain_pillars.length)?['time_dependent_cross_relations']:[]),'ziwei_comparison'],next_offset:next,page_is_last:next===null,previous_pages_required:o.offset>0,complete_for_stable_pillars:next===null&&o.offset===0},
    interpretation_rules:['双方来源均已校验；这里只核对已知／候选范围内稳定的柱，不是完整双人合盘。','只在各自coverage内引用稳定项；随候选变化的柱不参与交叉，紫微对照未计算。','天干投射以观察方日主为准；日主变化时返回null，不选择任一候选冒充固定十神。','cross_relation_context区分一方原局已有合局与双方合看才齐全，不把原局已有说成跨盘新成局。','分页须读齐当前问题所需交叉证据；单盘结论不能代替这些证据。']},
   next_actions:next===null?[]:[{action:'reuse',purpose:'stable_pair_page',required:true,required_for:'complete_stable_pair_evidence',argv:argv(next,limit)}],
   output:{max_bytes:max,bytes:0,requested_limit:o.limit,effective_limit:limit,budget_adjusted:limit!==o.limit}};
  budget.stamp(r);if(budget.fits(r,max,128))return r;
 }
 const e=new Error('最小交叉证据页仍超容量；缩短双方任务路径及输出目录后重试，不截断JSON。');e.code='context_budget_exceeded';throw e;
}
function operation(argv){
 const o=parse(argv),sourceFiles=[o.reuse,o.pair_with],targets=['pair-context.json','pair-validation.json'].map(n=>path.join(o.out,n));
 for(const source of sourceFiles){check(fs.statSync(source).isFile(),'来源不是文件');check(files.actualPath(path.dirname(source))!==files.actualPath(o.out),'交叉证据须使用独立任务目录，不写入任一来源目录');files.assertOutputs(source,targets);}
 check(files.actualPath(o.reuse)!==files.actualPath(o.pair_with),'需要两个不同的单人来源');
 check(!fs.existsSync(path.join(o.out,'chart.json')),'输出目录已有命盘，请换独立交叉证据任务目录');
 const dirs=[o.out,...sourceFiles.map(path.dirname).filter(p=>!files.inside(files.actualPath(p),files.actualPath(core.ROOT)))];
 return files.withTaskLocks(dirs,()=>{
  check(!fs.existsSync(path.join(o.out,'chart.json')),'输出目录已有命盘，请换独立交叉证据任务目录');
  const rows=sourceFiles.map(load),fingerprint=core.fingerprint(),key=hash({schema:SCHEMA,fingerprint,sources:rows.map(s=>({file:files.actualPath(s.file),sha256:sha(s.bytes)}))});
  check(!o.pair_key||o.pair_key===key,'pair_key不匹配，来源、顺序或程序已变化；请新建任务');
  const proofFile=targets[1],previous=fs.existsSync(proofFile)?readJson(proofFile):null;
  check(!previous||previous.pair_key===key,'目录已有不同交叉证据，请使用新目录');
  const dates=rows.map(s=>s.info.current_dayun.target_date).filter(Boolean);check(new Set(dates).size<=1,'双方 target_date 不一致，请先按同一目标日期生成来源');
  let validation;
  if(proofTrusted(previous,key,fingerprint))validation={ok:true,method:'verified_pair_cache',recalculated:false};
  else{
   const flow=require('./workflow.cjs'),methods=rows.map(s=>{let receipt;try{receipt=readJson(path.join(path.dirname(s.file),'validation.json'));}catch{}if(flow.trusted(s.data,s.bytes,receipt,fingerprint))return 'verified_cache';core.verify(s.data);return 'recalculated';});
   validation={ok:true,method:'verified_sources',recalculated:methods.includes('recalculated'),source_methods:methods};
  }
  const result=bounded(rows,o,key,validation);
  if(!proofTrusted(previous,key,fingerprint)){const p={schema_version:PROOF,pair_key:key,fingerprint,validation:{ok:true,recalculated:true},source_sha256:rows.map(s=>sha(s.bytes))};atomicJson(proofFile,{...p,checksum:hash(p)});}
  atomicJson(targets[0],result);return result;
 });
}
module.exports={SCHEMA,parse,compare,operation};
