'use strict';
// Read-only origins: do not change the calendar, artifact or strength model.
const {check,hash}=require('./runtime-core.cjs');
const timing=require('./dayun-timing.cjs');
function exposure(p){return {visible:{stem:p.stem??p.ganzhi[0],ten_god:p.stem_ten_god,source_id:p.id,field:'stem'},hidden:p.hidden_stems.map((stem,index)=>({stem,ten_god:p.hidden_ten_gods[index],source_id:p.id,field:'hidden_stems',index}))};}
function samples(data,person){
 if(data.input.mode==='time_compare'){
  check(!person,'时辰对照是单人来源，不加 --person');
  return data.candidates.filter(c=>c.status==='calculated').map(c=>({id:c.id,chart:c.chart.people[0].chart}));
 }
 if(data.input.mode==='relationship'){
  check(data.people.length===1||person,'双人来源须明确 --person a / b');
  const p=person?data.people.find(p=>p.id===person):data.people[0];check(p,'未找到来源人物');return [{id:p.id,chart:p.chart}];
 }
 check(!person,'普通命盘不使用 --person');check(['both','bazi','ziwei'].includes(data.input.mode),'来源必须是命盘、关系盘或时辰对照');return [{id:'a',chart:data}];
}
function unique(values){return [...new Set(values)];}
function describe(data,person){
 const rows=samples(data,person);check(rows.length&&rows.every(r=>r.chart.bazi),'十神证据需要可计算的八字来源');
 const bases=rows.map(r=>r.chart.bazi.chart),dayMasters=unique(bases.map(b=>b.day_master)),known=[],uncertain=[];
 for(const first of bases[0].pillars){
  const ps=bases.map(b=>b.pillars.find(p=>p.id===first.id)),values=unique(ps.map(p=>p.ganzhi));
  if(values.length!==1){uncertain.push({id:first.id,label:first.label,values});continue;}
  const e=exposure(first),gods=unique(ps.map(p=>p.stem_ten_god));
  e.visible.ten_god=gods.length===1?gods[0]:null;if(gods.length>1)e.visible.ten_god_variants=gods;
  e.hidden.forEach((h,i)=>{const gs=unique(ps.map(p=>p.hidden_ten_gods[i]));h.ten_god=gs.length===1?gs[0]:null;if(gs.length>1)h.ten_god_variants=gs;});
  if(first.id==='BZ-DAY')e.visible.is_day_master_self=true;
  known.push({id:first.id,label:first.label,ganzhi:first.ganzhi,stem:first.stem,branch:first.branch,...e});
 }
 const groups=new Map();
 rows.forEach(({id,chart})=>{
  const a=timing.active(chart.bazi.chart),p=a.window?.period,e=p?exposure(p):null,key=hash({status:a.status,ganzhi:p?.ganzhi??null,exposure:e});
  if(!groups.has(key))groups.set(key,{status:a.status,...(p?{period_id:p.id,ganzhi:p.ganzhi,...e}:{}),candidate_ids:[],starts:[],ends:[]});
  const g=groups.get(key);g.candidate_ids.push(id);if(a.window){g.starts.push(a.window.start);g.ends.push(a.window.end);}
 });
 const range=values=>{const v=values.map(x=>x.toInstant()).sort((a,b)=>a.epochMilliseconds-b.epochMilliseconds);return {earliest:v[0].toString(),latest:v.at(-1).toString()};};
 const variants=[...groups.values()].map(({starts,ends,...g})=>({...g,...(starts.length?{start_instant_range:range(starts),end_instant_exclusive_range:range(ends)}:{})}));
 const uncertainTime=data.input.mode==='time_compare',single=uncertainTime&&rows.length===1;
 return {coverage:{kind:uncertainTime?'computed_candidates':'known_birth_time',sample_count:rows.length,unavailable_count:uncertainTime?data.candidates.length-rows.length:0,...(uncertainTime?{input_type:data.input.time_uncertainty.type,comparison_status:single?'single_candidate':'multiple_candidates',scope:data.coverage.scope}:{})},
  conventions:{day_boundary:bases[0].conventions.day_boundary,time_basis:rows[0].chart.input.options.time_basis},
  day_master:{status:single?'single_candidate':dayMasters.length===1?'stable':'varies',values:dayMasters},
  natal:{scope:'natal',known_pillars:known,uncertain_pillars:uncertain},
  current_dayun:{scope:'current_dayun',target_date:bases[0].target?.local_date??null,status:single?'single_candidate':variants.length===1?'stable':'varies',variants},
  interpretation_rules:['visible为显干，hidden为藏干；藏干出现不叫透干。','natal与current_dayun分别引用，不把原局十神说成该步大运携带的十神。','未知时辰的稳定项仅在coverage范围成立；当前运干支稳定不代表交运瞬间完全相同。']};
}
function project(data,options){
 const evidence=describe(data,options.person);
 return {schema_version:'suanming-context/v1',view:'evidence_page',view_schema:'suanming-ten-god-evidence/v1',focus:options.focus,source_schema:data.schema_version,source_checksum:data.checksum.value,
  selection:{page:'ten-gods',offset:options.offset??0,limit:options.limit??3,person:options.person??null,base_checksum:options.base_checksum},
  reading:{ten_god_evidence:evidence},base_context:{required:true,source_checksum:data.checksum.value,focus:options.focus,person:options.person??null,note:'分层十神证据页；与同来源基础context合看。'},available:{continuation_only:true}};
}
module.exports={exposure,samples,describe,project};
