'use strict';
// Deterministic, evidence-preserving projections; no predictive rules live here.
const {check}=require('./runtime-core.cjs');
const FOCUSES=['core','career','relationship','annual','wealth','age_relation','partner_image','intimacy','time_compare','divination'];
const defaultFocus=data=>['relationship','time_compare','divination'].includes(data.input.mode)?data.input.mode:'core';
const pick=(o,keys)=>o?Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]])):null;
const relation=r=>pick(r,['id','type','symbols','pillars','relation_field','touches_day_branch','natal_group_present','natal_relation_ids','group_state']);
function period(p){return {...pick(p,['id','index','ganzhi','start_year','end_year','start_nominal_age','end_nominal_age','lichun_cycle_year','stem_ten_god','hidden_stems','hidden_ten_gods']),pillar_relations:p.pillar_relations.map(relation),day_branch_relations:p.day_branch_relations.map(relation)};}
function page(items,options){
 const total=items.length,offset=options.offset??0,limit=options.limit??3;
 return {total,offset,returned:items.slice(offset,offset+limit).length,next_offset:offset+limit<total?offset+limit:null,items:items.slice(offset,offset+limit)};
}
function annualItems(chart,options){return chart.annual.filter(y=>!options.years||(y.lichun_cycle_year>=options.years[0]&&y.lichun_cycle_year<=options.years[1]));}
function annual(chart,options){
 const rows=annualItems(chart,options),all=chart.annual.map(y=>y.lichun_cycle_year);
 return {...page(rows.map(period),options),cycle:'立春周期；立春前属上年',requested_years:options.years??null,
  computed_years:{first:all[0]??null,last:all.at(-1)??null,total:all.length},
  requested_range_computed:options.years?rows.length===options.years[1]-options.years[0]+1:null,
  ...(all.length?{}:{unavailable_reason:'原输入未计算逐年流年；需要 target_date 与 annual_count 后用新任务目录计算'})};
}
const PALACES={core:['命','福德'],career:['命','官禄','财帛','迁移'],wealth:['命','财帛','田宅','官禄'],relationship:['命','夫妻','福德'],annual:['命'],age_relation:['夫妻','命'],partner_image:['夫妻'],intimacy:['命','夫妻','福德']};
const star=s=>pick(s,['name','brightness','mutagen']);
function palace(p,detailed){return {...pick(p,['id','index','name','heavenlyStem','earthlyBranch','isBodyPalace']),major_stars:p.majorStars.map(star),...(detailed?{minor_stars:p.minorStars.map(star),adjective_stars:p.adjectiveStars.map(star),decadal:p.decadal}:{})};}
function ziwei(z,focus,compactPair=false){
 const names=PALACES[focus]??PALACES.core;
 const primary=z.chart.palaces.filter(p=>names.includes(p.name.replace(/宫$/,'')));
 const groups=z.calculations.three_sides_four_correct.filter(g=>primary.some(p=>p.id===g.palace_id));
 const relevant=new Set(groups.flatMap(g=>[g.self,...g.trines,g.opposite]));
 const ids=new Set(primary.map(p=>p.id));
 const anchorName={career:'官禄',wealth:'财帛',relationship:'夫妻',age_relation:'夫妻',partner_image:'夫妻',intimacy:'福德'}[focus];
 const anchor=primary.find(p=>p.name.replace(/宫$/,'')===anchorName);
 const t=z.chart.target;
 const transit=t?['decadal','yearly','age'].map(scope=>({scope,...pick(t[scope],['index','name','heavenlyStem','earthlyBranch','nominalAge']),
  mappings:primary.map(p=>({natal_palace_id:p.id,transit_palace:t[scope]?.palaceNames?.[p.index],stars:(t[scope]?.stars?.[p.index]??[]).map(star)}))})):[];
 return {...pick(z.chart,['soul','body','soul_palace_branch','body_palace_branch','five_elements_class','conventions']),
  primary_palaces:primary.map(p=>{const v=palace(p,true);if(compactPair)delete v.decadal;return v;}),related_palaces:z.chart.palaces.filter(p=>relevant.has(p.id)&&!ids.has(p.id)).map(p=>palace(p,false)),
  three_sides_four_correct:groups.map(g=>pick(g,['id','palace_id','self','trines','opposite'])),
  natal_mutagens:z.calculations.natal_mutagens,
  empty_major_palaces:z.calculations.empty_major_palaces.filter(p=>ids.has(p.palace_id)),
  ...(t?{target:{...pick(t,['id','date','evaluation_local_time']),...(compactPair?{}:{transit})},transit_mutagens:z.calculations.transit_mutagens.filter(m=>!compactPair||relevant.has(m.natal_palace_id))}:{}),
  ...(anchor&&!compactPair?{flying_scope:{anchor_palace_id:anchor.id,coverage:'发出或落入本主题主宫'},palace_stem_flying:z.calculations.palace_stem_flying.entries.filter(m=>anchor.id===m.origin_palace_id||anchor.id===m.target_palace_id).map(m=>pick(m,['id','mutagen','star','origin_palace_id','origin_palace','target_palace_id','target_palace','is_self_transform','source_ids']))}:{} )};
}
function bazi(b,options){
 const focus=options.focus,year=Number((b.chart.target?.local_date??'').slice(0,4));
 const active=b.chart.dayun.find(d=>d.start_year<=year&&year<=d.end_year);
 const selected=focus==='annual'?b.chart.dayun.filter(d=>annualItems(b.chart,options).some(y=>d.start_year<=y.lichun_cycle_year&&y.lichun_cycle_year<=d.end_year)):active?[active]:[];
 const out={day_master:b.chart.day_master,pillars:b.chart.pillars,theory_evidence:b.calculations.theory_evidence,
  natal_relations:b.calculations.relations.map(relation),conventions:b.chart.conventions,
  qiyun:pick(b.chart.qiyun,['method','direction','offset','start_datetime_birth_timezone']),
  dayun:selected.map(period),dayun_sequence:b.chart.dayun.map(d=>pick(d,['id','ganzhi','start_year','end_year'])),
  boundary_review:b.chart.jieqi_boundary_review,day_hour_calculation_datetime:b.chart.day_hour_calculation_datetime};
 if(b.chart.target)out.target={...pick(b.chart.target,['id','local_date','evaluation_local_time','year_ganzhi','month_ganzhi','year_ten_god','month_ten_god']),year_relations:b.chart.target.year_relations.map(relation)};
 if(focus==='annual'||!options.compact_pair&&['career','wealth','relationship'].includes(focus))out.annual=annual(b.chart,options);
 if(options.compact_pair){
  delete out.dayun_sequence;delete out.qiyun;
  out.theory_evidence=pick(b.calculations.theory_evidence,['id','method','month_command','day_master_roots','visible_support','visible_output_wealth_officer','month_hidden_transparency']);
  if(!out.boundary_review.within_review_band)out.boundary_review={within_review_band:false};
 }
 if(['career','wealth','relationship','intimacy'].includes(focus)){
  const allowed={career:['正官','七杀','正印','偏印','食神','伤官'],wealth:['正财','偏财','食神','伤官','比肩','劫财'],relationship:['正财','偏财','正官','七杀'],intimacy:['食神','伤官','比肩','劫财','正财','偏财','正官','七杀']}[focus];
  out.ten_god_occurrences=b.calculations.score_ledger.filter(r=>allowed.includes(r.ten_god));
 }
 return out;
}
function chartContext(data,options){
 const result={mode:data.input.mode,normalized:pick(data.normalized,['solar_date','local_datetime','timezone','utc_offset','time_basis','bazi_hour_stem_rule','solar_time']),options:data.input.options,
  warnings:data.warnings};
 if(data.bazi)result.bazi=bazi(data.bazi,options);
 if(data.ziwei)result.ziwei=ziwei(data.ziwei,options.focus,options.compact_pair);
 if(options.compact_pair){delete result.options;delete result.warnings;}
 if(['relationship','age_relation','partner_image','intimacy'].includes(options.focus)){
  const model=data.input.birth.gender==='male'?'wealth':'authority';
  if(data.bazi)result.partner_star_model=model;
  if(!options.skip_derived&&options.focus==='age_relation')result.age_relation=age(require('./relationship-age.cjs').predictAge(data,'a',model));
  if(!options.skip_derived&&options.focus==='partner_image')result.partner_image=image(require('./partner-image.cjs').partnerImage(data,'a',model));
  if(!options.skip_derived&&options.focus==='intimacy')result.intimacy=intimacy(require('./relationship-intimacy.cjs').intimacyFeatures(data,'a'));
 }
 return result;
}
function age(a){return {...pick(a,['id','person_id','input_scope','method','interpretation_scope','exact_age_gap','partner_star_model','status','basis','tendency','label']),
 models:a.models.map(m=>({...pick(m,['model','use','position_tendency','label','secondary_directions']),ledger:m.ledger})),
 ziwei:a.ziwei};}
function image(i){return {...pick(i,['id','person_id','rule_version','bazi','dimensions','zodiac']),ziwei:pick(i.ziwei,['spouse_palace','spouse_branch','major_stars','borrowing_opposite','opposite_source','reference_stars'])};}
function intimacy(i){return {...pick(i,['id','person_id','assessment_status','physiological_ability','ability_score','note']),bazi:i.bazi,ziwei:i.ziwei?{marker_positions:i.ziwei.marker_positions}:null};}
function relationship(data,options){
 const people=data.people.filter(p=>!options.person||p.id===options.person);
 check(people.length,'未找到指定人物');
 const result={people:people.map(p=>{
  const profile=data.profiles.find(r=>r.person_id===p.id),out={person_id:p.id,chart:chartContext(p.chart,{...options,skip_derived:true,compact_pair:people.length===2})};
  if(['relationship','age_relation','annual'].includes(options.focus)){
   if(profile.bazi)out.relationship_bazi=people.length===2?pick(profile.bazi,['partner_star_model','traditional_markers']):{...pick(profile.bazi,['spouse_palace','partner_star_model','partner_star_candidates','traditional_markers']),spouse_palace_relations:profile.bazi.spouse_palace_relations.map(relation)};
   if(profile.ziwei)out.traditional_markers=profile.ziwei.traditional_markers;
  }
  // The relationship input can explicitly select all / wealth / authority; override the base-chart auto model.
  delete out.chart.age_relation;delete out.chart.partner_image;delete out.chart.intimacy;
  if(options.focus==='age_relation')out.age_relation=age(data.age_relation.predictions.find(a=>a.person_id===p.id));
  if(options.focus==='partner_image'){
   const i=data.partner_images.find(a=>a.person_id===p.id);
   out.partner_image=i?image(i):image(require('./partner-image.cjs').partnerImage(p.chart,p.id,profile.bazi?.partner_star_model??data.input.options.partner_star_model));
  }
  if(options.focus==='intimacy')out.intimacy=intimacy(data.intimacy_features.find(a=>a.person_id===p.id)??require('./relationship-intimacy.cjs').intimacyFeatures(p.chart,p.id));
  if(out.chart.partner_star_model)out.chart.partner_star_model=profile.bazi?.partner_star_model??data.input.options.partner_star_model;
  return out;
 }),person_ids:data.people.map(p=>p.id),stage:data.context.stage,...(people.length===2?{detail_scope:'双人共同摘要；各人完整主题细节用 --person a / b；逐年主题另用 --focus annual。'}:{})};
 if(data.comparison&&!options.person&&['core','relationship','intimacy'].includes(options.focus))result.comparison={id:data.comparison.id,
  bazi:data.comparison.bazi?{day_master_projection:data.comparison.bazi.day_master_projection,cross_relations:data.comparison.bazi.cross_relations.map(relation)}:null,
  ziwei:data.comparison.ziwei};
 return result;
}
function timeCompare(data,options){
 if(options.candidate){
  const c=data.candidates.find(c=>c.id===options.candidate);check(c,'候选编号不存在');
  check(c.status==='calculated',c.error??'候选尚不可计算');
  return {candidate:pick(c,['id','interval_id','local_datetime','sampling_role','true_solar_datetime','status','time_boundary_review']),reading:relationship(c.chart,{...options,candidate:undefined})};
 }
 let fields=data.comparison.fields;
 const focus=options.focus;
 if(focus==='annual')fields=fields.filter(f=>f.id.startsWith('TC-BZ-ANNUAL-')&&(!options.years||(+f.id.slice(-4)>=options.years[0]&&+f.id.slice(-4)<=options.years[1])));
 else if(focus==='age_relation')fields=fields.filter(f=>f.id.startsWith('TC-AGE')||f.id==='TC-ZW-夫妻');
 else if(focus==='partner_image')fields=fields.filter(f=>f.id==='TC-ZODIAC'||f.id==='TC-ZW-夫妻');
 else if(focus==='career')fields=fields.filter(f=>f.id.startsWith('TC-BZ-')&&!f.id.startsWith('TC-BZ-ANNUAL-')||['TC-DAY-MASTER','TC-QIYUN-DIRECTION','TC-DAYUN-SEQUENCE','TC-ZW-命','TC-ZW-官禄','TC-ZW-迁移'].includes(f.id));
 else if(focus==='relationship'||focus==='intimacy')fields=fields.filter(f=>['TC-BZ-DAY','TC-BZ-HOUR','TC-AGE','TC-ZW-夫妻','TC-ZW-福德','TC-ZW-SPOUSE-FLY'].includes(f.id));
 else fields=fields.filter(f=>!f.id.startsWith('TC-BZ-ANNUAL-'));
 if(options.field){fields=fields.filter(f=>f.id===options.field);check(fields.length,'指定字段不在本主题，改用 --focus time_compare');}
 else fields=[...fields.filter(f=>f.status==='varies'),...fields.filter(f=>f.status!=='varies')];
 const selected=page(fields,options);
 return {coverage:data.coverage,normalized:data.normalized,
  counts:{stable:fields.filter(f=>f.status==='stable').length,variable:fields.filter(f=>f.status==='varies').length,single_candidate:fields.filter(f=>f.status==='single_candidate').length},
  field_index:fields.map(f=>({id:f.id,label:f.label,status:f.status,variant_count:f.variants.length})),
  fields:{...selected,items:selected.items.map(f=>({...pick(f,['id','label','status']),variants:page(f.variants, {...options,offset:options.variant_offset??0}).items.map(v=>({value:v.value,candidate_ids:v.candidate_ids,count:v.count})),variant_count:f.variants.length,
   next_variant_offset:(options.variant_offset??0)+(options.limit??3)<f.variants.length?(options.variant_offset??0)+(options.limit??3):null,
   evidence_sample:f.evidence.slice(0,2)}))},
  candidates:{...page(data.candidates,options),items:page(data.candidates,options).items.map(c=>pick(c,['id','interval_id','local_datetime','true_solar_datetime','status','error']))},
  ...(focus==='partner_image'?{image_tags:data.comparison.image_tags}:{}),
  ...(data.coverage.has_unavailable_candidates?{unavailable:data.candidates.filter(c=>c.status!=='calculated').map(c=>pick(c,['id','local_datetime','error']))}:{})};
}
function divination(data){return {normalized:data.normalized,chart:data.chart,calculations:data.calculations,warnings:data.warnings};}
function project(data,options={}){
 options={focus:defaultFocus(data),limit:3,offset:0,...options};check(FOCUSES.includes(options.focus),'不支持的 focus');
 check(!options.candidate||data.input.mode==='time_compare','--candidate 只用于时辰对照');
 check(!options.field||data.input.mode==='time_compare','--field 只用于时辰对照');
 check(!options.person||data.input.mode==='relationship','--person 只用于关系盘');
 const mode=data.input.mode;
 check(!['time_compare','divination'].includes(options.focus)||mode===options.focus,'focus 与计算模式不匹配');
 const reading=mode==='time_compare'?timeCompare(data,options):mode==='relationship'?relationship(data,options):mode==='divination'?divination(data):chartContext(data,options);
 return {schema_version:'suanming-context/v1',focus:options.focus,source_schema:data.schema_version,source_checksum:data.checksum.value,
  selection:{offset:options.offset,limit:options.limit,years:options.years??null,person:options.person??null,candidate:options.candidate??null,field:options.field??null,variant_offset:options.variant_offset??0},
  reading,interpretation_rules:['先给当前问题的命理判断和盘面依据；问时机就分析岁运或卦象，沟通建议仅按需补充，不用心理安慰替代断事。','月令、通根与透干合看；五行数量不直接定旺衰、格局或喜用。','合冲与合局表示结构引动，须结合原局和大运；不直接判成化或事件。','逐年显干、藏干十神与日支关系同时看；三合原局已有与岁运补齐分开。','紫微本命、宫干与岁运四化分开；宫位编号以本次盘为准。','时辰对照的候选点数不是概率；分页中的一致项只在 coverage 范围内成立。'],
  available:{focuses:mode==='divination'?['divination']:FOCUSES.filter(f=>!['divination','time_compare'].includes(f)||mode===f),person_ids:data.people?.map(p=>p.id)??null,
   expansion:'使用 --reuse 原chart.json --focus 主题；列表按 next_offset 翻页，时辰字段按 --field / --variant-offset 或 --candidate 展开。完整结果保留在磁盘，无需 cat。'}};
}
module.exports={FOCUSES,defaultFocus,project,period,relation,page};
