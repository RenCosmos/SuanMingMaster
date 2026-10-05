'use strict';
const {check,digest,normalize:normalizeChart}=require('./common.cjs');
const engine=require('./engine.cjs');
const {tenGod,relations}=require('./bazi-rules.cjs');
const RULES=require('../references/relationship-rules.json');
const {predictAge}=require('./relationship-age.cjs');
const {partnerImage}=require('./partner-image.cjs');
const IMAGE_RULES=require('../references/partner-image-rules.json');
const AGE_RULES=require('../references/partner-age-rules.json');
const {intimacyFeatures}=require('./relationship-intimacy.cjs');
const SCHEMA='bazi-ziwei-relationship/v4';
function fields(o,allowed,label){check(o&&typeof o==='object'&&!Array.isArray(o),`${label} 必须是对象`);for(const k of Object.keys(o))check(allowed.includes(k),`${label} 不支持字段 ${k}`);}
function text(v,label,max){check(typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v),`${label} 须为 1–${max} 字`);}
function normalizeInput(input){
 fields(input,['mode','label','question','chart_mode','people','target_date','context','options'],'关系输入');
 check(input.mode==='relationship','mode 须为 relationship');text(input.question,'question',1000);
 const chartMode=input.chart_mode??'both';check(['both','bazi','ziwei'].includes(chartMode),'chart_mode 须为 both / bazi / ziwei');
 check(Array.isArray(input.people)&&input.people.length>=1&&input.people.length<=2,'people 须包含一人或两人');
 if(input.label!==undefined){text(input.label,'label',80);check(!/[\r\n]/.test(input.label),'label 不能换行');}
 const context=input.context??{};fields(context,['stage','topics','narrative'],'context');
 const stage=context.stage??'unspecified';check(['single','dating','married','separated','unspecified'].includes(stage),'不支持的关系阶段');
 const topics=context.topics??['romance','marriage','communication','intimacy'];
 check(Array.isArray(topics)&&topics.length>0&&new Set(topics).size===topics.length&&topics.every(t=>['romance','marriage','communication','intimacy','age_relation','sexual_ability','partner_image','zodiac'].includes(t)),'context.topics 须为不重复的支持主题');
 if(context.narrative!==undefined)text(context.narrative,'context.narrative',4000);
 const options=input.options??{};fields(options,['partner_star_model'],'关系 options');
 const model=options.partner_star_model??'auto';check(['auto','all','wealth','authority'].includes(model),'partner_star_model 须为 auto / all / wealth / authority');
 const charts=input.people.map((p,i)=>{
  fields(p,['id','label','birth','options'],`people[${i}]`);check(p.id===(i===0?'a':'b'),'人物 id 按顺序为 a、b');
  return normalizeChart({mode:chartMode,...(p.label!==undefined?{label:p.label}:{}),birth:p.birth,...(p.options!==undefined?{options:p.options}:{}),...(input.target_date!==undefined?{target_date:input.target_date}:{})});
 });
 const clean={mode:'relationship',question:input.question,chart_mode:chartMode,people:charts.map((c,i)=>({id:i===0?'a':'b',...(c.input.label!==undefined?{label:c.input.label}:{}),birth:c.input.birth,options:c.input.options})),context:{stage,topics,...(context.narrative!==undefined?{narrative:context.narrative}:{})},options:{partner_star_model:model},...(input.label!==undefined?{label:input.label}:{}),...(input.target_date!==undefined?{target_date:input.target_date}:{})};
 return clean;
}
const ref=(person_id,source_id)=>({person_id,source_id});
function annualProfile(y,pid){
 const rs=y.pillar_relations.map(r=>({...r,source:ref(pid,r.id),sources:r.pillars.map(id=>ref(pid,id))}));
 return {...y,source:ref(pid,y.id),pillar_relations:rs,day_branch_relations:rs.filter(r=>r.touches_day_branch)};
}
function profile(chart,pid,model){
 const out={id:`R-${pid.toUpperCase()}-PROFILE`,person_id:pid};
 if(chart.bazi){
  const pillars=chart.bazi.chart.pillars,day=pillars.find(p=>p.id==='BZ-DAY');
  const chosen=model==='wealth'?['正财','偏财']:model==='authority'?['正官','七杀']:['正财','偏财','正官','七杀'];
  const markers=['BZ-YEAR','BZ-DAY'].flatMap(base=>{
   const p=pillars.find(p=>p.id===base),symbol=RULES.taohua_by_branch[p.branch];
   return pillars.filter(x=>x.branch===symbol).map(x=>({id:`R-${pid.toUpperCase()}-TH-${base.slice(3)}-${x.id.slice(3)}`,name:'桃花',basis_branch:p.branch,symbol,basis:ref(pid,base),hit:ref(pid,x.id)}));
  });
  out.bazi={spouse_palace:{id:`R-${pid.toUpperCase()}-SPOUSE`,source:ref(pid,day.id),ganzhi:day.ganzhi,branch:day.branch,hidden_stems:day.hidden_stems,hidden_ten_gods:day.hidden_ten_gods},partner_star_model:model,
   partner_star_candidates:chart.bazi.calculations.score_ledger.filter(x=>chosen.includes(x.ten_god)).map(x=>({...x,id:`R-${pid.toUpperCase()}-STAR-${x.id}`,pillar_id:x.source,source:ref(pid,x.id)})),
   spouse_palace_relations:chart.bazi.calculations.relations.filter(r=>r.pillars.includes(day.id)).map(r=>({...r,source:ref(pid,r.id)})),traditional_markers:markers,
   target:chart.bazi.chart.target?{...chart.bazi.chart.target,source:ref(pid,'BZ-TARGET'),spouse_palace_year_relations:chart.bazi.chart.target.year_relations.filter(r=>r.touches_day_branch)}:null,
   annual:chart.bazi.chart.annual.map(y=>annualProfile(y,pid)),
   dayun:chart.bazi.chart.dayun.map(y=>annualProfile(y,pid))};
 }
 if(chart.ziwei){
  const z=chart.ziwei,focus=z.chart.palaces.filter(p=>['命','夫妻','福德','迁移','官禄'].includes(p.name.replace(/宫$/,''))),spouse=focus.find(p=>p.name.replace(/宫$/,'')==='夫妻');
  check(spouse,'紫微盘缺少夫妻宫');
  out.ziwei={focus_palaces:focus.map(p=>({...p,source:ref(pid,p.id)})),spouse_group:z.calculations.three_sides_four_correct.find(g=>g.palace_id===spouse.id),
   natal_mutagens:z.calculations.natal_mutagens.filter(m=>focus.some(p=>p.id===m.palace_id)).map(m=>({...m,source:ref(pid,m.id)})),
   transit_mutagens:z.calculations.transit_mutagens.filter(m=>focus.some(p=>p.id===m.natal_palace_id)).map(m=>({...m,source:ref(pid,m.id)})),
   palace_stem_flying:z.calculations.palace_stem_flying.entries.filter(m=>focus.some(p=>p.id===m.origin_palace_id||p.id===m.target_palace_id)).map(m=>({...m,source:ref(pid,m.id),sources:m.source_ids.map(id=>ref(pid,id))})),
   traditional_markers:z.chart.palaces.flatMap(p=>[...p.majorStars,...p.minorStars,...p.adjectiveStars].filter(s=>['红鸾','天喜','天姚','咸池'].includes(s.name)).map(s=>({star:s,palace:p.name,source:ref(pid,p.id)}))),target:z.chart.target};
 }
 return out;
}
function compare(charts){
 if(charts.length!==2)return null;
 const [a,b]=charts,out={id:'R-PAIR',kind:'two_independent_charts'};
 if(a.bazi&&b.bazi){
  const pa=a.bazi.chart.pillars,pb=b.bazi.chart.pillars,da=pa.find(p=>p.id==='BZ-DAY'),db=pb.find(p=>p.id==='BZ-DAY');
  out.bazi={day_master_projection:{id:'R-DAY-MASTERS',a_to_b:{observer:'a',observed:'b',ten_god:tenGod(da.stem,db.stem)},b_to_a:{observer:'b',observed:'a',ten_god:tenGod(db.stem,da.stem)},sources:[ref('a',da.id),ref('b',db.id)]},
   pillar_matrix:pa.flatMap(x=>pb.map(y=>({id:`R-PAIR-${x.id.slice(3)}-${y.id.slice(3)}`,sources:[ref('a',x.id),ref('b',y.id)],a_ganzhi:x.ganzhi,b_ganzhi:y.ganzhi,a_to_b_ten_god:tenGod(da.stem,y.stem),b_to_a_ten_god:tenGod(db.stem,x.stem),same_branch:x.branch===y.branch,relations:relations([{...x,id:`a:${x.id}`},{...y,id:`b:${y.id}`}]).map((r,i)=>({...r,id:`R-PAIR-${x.id.slice(3)}-${y.id.slice(3)}-RULE-${i+1}`}))}))),
   cross_relations:relations([...pa.map(p=>({...p,id:`a:${p.id}`})),...pb.map(p=>({...p,id:`b:${p.id}`}))]).filter(r=>r.pillars.some(p=>p.startsWith('a:'))&&r.pillars.some(p=>p.startsWith('b:'))).map((r,i)=>({...r,id:`R-CROSS-${String(i+1).padStart(3,'0')}`,sources:r.pillars.map(p=>{const split=p.indexOf(':');return ref(p.slice(0,split),p.slice(split+1));})}))};
 }
 if(a.ziwei&&b.ziwei)out.ziwei={method:'并列核对各自夫妻宫、命宫、福德宫及其计算账本；未生成联合命盘或跨盘飞化',palaces:['夫妻','命','福德'].map(name=>({name,a:a.ziwei.chart.palaces.find(p=>p.name.replace(/宫$/,'')===name)?.id,b:b.ziwei.chart.palaces.find(p=>p.name.replace(/宫$/,'')===name)?.id}))};
 return out;
}
function build(raw){
 const input=normalizeInput(raw),charts=input.people.map(p=>engine.build({mode:input.chart_mode,label:p.label,birth:p.birth,options:p.options,...(input.target_date!==undefined?{target_date:input.target_date}:{})}));
 const resolved=c=>input.options.partner_star_model==='auto'?(c.input.birth.gender==='male'?'wealth':'authority'):input.options.partner_star_model;
 const data={schema_version:SCHEMA,engine_version:'relationship/0.6.0',input,
  people:charts.map((chart,i)=>({id:input.people[i].id,label:input.people[i].label??input.people[i].id.toUpperCase(),chart})),
  profiles:charts.map((c,i)=>profile(c,input.people[i].id,resolved(c))),comparison:compare(charts),
  age_relation:{id:'R-AGE',task:'single_person_partner_age_tendency',predictions:charts.map((c,i)=>predictAge(c,input.people[i].id,resolved(c)))},
  partner_images:input.context.topics.some(t=>['partner_image','zodiac'].includes(t))?charts.map((c,i)=>partnerImage(c,input.people[i].id,resolved(c))):[],
  intimacy_features:input.context.topics.some(t=>['intimacy','sexual_ability'].includes(t))?charts.map((c,i)=>intimacyFeatures(c,input.people[i].id)):[],
  context:{source:'user_report_unverified',...input.context},
  provenance:{rule_version:RULES.version,rule_sha256:digest(RULES),image_rule_version:IMAGE_RULES.version,image_rule_sha256:digest(IMAGE_RULES),age_rule_version:AGE_RULES.version,age_rule_sha256:digest(AGE_RULES),sources:[...RULES.sources,...IMAGE_RULES.sources,...AGE_RULES.sources],limitations:[]},
  warnings:charts.flatMap((c,i)=>c.warnings.map(w=>`${input.people[i].id}: ${w}`))};
 data.checksum={algorithm:'sha256-canonical-json',value:digest(data)};return data;
}
function validateArtifact(data,{recalculate=true}={}){
 check(data?.schema_version===SCHEMA&&data.engine_version==='relationship/0.6.0','不支持的关系报告格式；请用当前输入重新计算');
 const {checksum,...payload}=data;check(checksum?.algorithm==='sha256-canonical-json'&&checksum.value===digest(payload),'关系报告校验和不匹配');
 check(Array.isArray(data.people),'关系报告缺少人物盘');for(const person of data.people)engine.validateArtifact(person.chart,{recalculate:false});
 if(recalculate){const fresh=build(data.input);for(const key of ['people','profiles','comparison','age_relation','partner_images','intimacy_features','context','provenance','warnings'])check(digest(data[key])===digest(fresh[key]),`${key} 与当前程序重算不一致`);}
 return checksum.value;
}
module.exports={build,validateArtifact,normalizeInput};
