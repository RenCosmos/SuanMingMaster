'use strict';
const RULES=require('../references/partner-age-rules.json');
const LABELS={older:'传统婚配取象偏年上',peer:'传统婚配取象偏同龄附近',younger:'传统婚配取象偏年下',mixed:'多种年龄取象并存',none:'年龄方向依据不足'};
const POSITION_LABELS={older:'柱位辅助偏年上',peer:'柱位辅助偏同龄附近',younger:'柱位辅助偏年下',mixed:'柱位辅助线索分歧',none:'未见所选配偶星'};
function directionOf(items){const directions=[...new Set(items.map(x=>x.direction))];return directions.length===0?'none':directions.length===1?directions[0]:'mixed';}
function modelForecast(chart,pid,model){
 const chosen=model==='wealth'?['正财','偏财']:['正官','七杀'],totals={older:0,peer:0,younger:0},ledger=[];
 for(const x of chart.bazi.calculations.score_ledger.filter(x=>chosen.includes(x.ten_god))){const direction=RULES.bazi_auxiliary.pillar_direction[x.source];totals[direction]+=x.weight;ledger.push({id:`R-${pid.toUpperCase()}-AGE-${model.toUpperCase()}-${x.id}`,ten_god:x.ten_god,stem:x.stem,pillar_id:x.source,kind:x.kind,direction,weight:x.weight,source:{person_id:pid,source_id:x.id},rule_id:'AGE-BZ-POSITION',evidence_kind:'project_auxiliary_symbolism',use:'auxiliary_only'});}
 for(const k of Object.keys(totals))totals[k]=Math.round(totals[k]*1e6)/1e6;
 const max=Math.max(...Object.values(totals)),leaders=Object.keys(totals).filter(k=>totals[k]===max),position_tendency=max===0?'none':leaders.length===1?leaders[0]:'mixed';
 return {model,use:'auxiliary_only',position_tendency,label:POSITION_LABELS[position_tendency],position_weights:totals,ledger,secondary_directions:Object.keys(totals).filter(k=>totals[k]>0&&!leaders.includes(k))};
}
function matchRules(palace,gender,pid,use){
 const major=new Set(palace.majorStars.map(s=>s.name)),minor=new Set([...(palace.minorStars??[]),...(palace.adjectiveStars??[])].map(s=>s.name));
 const hits=RULES.ziwei.rules.filter(r=>(r.gender==='both'||r.gender===gender)&&r.stars.every(s=>(r.star_scope==='major'?major:minor).has(s))&&!(r.excludes??[]).some(s=>major.has(s)));
 const suppressed=new Set(hits.flatMap(r=>r.overrides??[]));
 return hits.filter(r=>!suppressed.has(r.id)).map(r=>({id:`R-${pid.toUpperCase()}-AGE-${use.toUpperCase()}-${r.id}`,rule_id:r.id,direction:r.direction,stars:r.stars,gender_basis:gender,evidence_kind:r.evidence_kind,use:r.star_scope==='major'?use:'minor_support_only',source:{person_id:pid,source_id:palace.id},reference:{source_id:r.source_id,book:RULES.sources.find(s=>s.id===r.source_id).book,chapter:RULES.sources.find(s=>s.id===r.source_id).chapter,url:RULES.sources.find(s=>s.id===r.source_id).url,locator:r.locator,original_excerpt:r.original_excerpt}}));
}
function ziweiForecast(chart,pid){
 if(!chart.ziwei)return {status:'not_calculated',matches:[],opposite_support:[],tendency:'none'};
 const z=chart.ziwei,spouse=z.chart.palaces.find(p=>p.name.replace(/宫$/,'')==='夫妻'),gender=chart.input.birth.gender;
 const matches=matchRules(spouse,gender,pid,'spouse_main'),main=matches.filter(m=>m.use==='spouse_main');
 const opposite=z.chart.palaces.find(p=>p.index===(spouse.index+6)%12);
 const empty=spouse.majorStars.length===0,opposite_support=empty&&opposite?matchRules(opposite,gender,pid,'opposite_support_only'):[];
 const group=z.calculations.three_sides_four_correct.find(g=>g.palace_id===spouse.id);
 const contextPalaces=group?z.chart.palaces.filter(p=>[group.self,group.opposite,...group.trines].includes(p.id)):[spouse];
 const stars=[...spouse.majorStars,...(spouse.minorStars??[]),...(spouse.adjectiveStars??[])];
 return {status:empty?'empty_spouse_palace':main.length?'explicit_classical_cue':'no_explicit_direction',gender_basis:gender,tendency:directionOf(main),spouse_palace:{id:spouse.id,branch:spouse.earthlyBranch,major_stars:spouse.majorStars},matches,opposite_support,
  context:{spouse_stars:stars,spouse_sha_ji:stars.filter(s=>['擎羊','陀罗','火星','铃星','地空','地劫'].includes(s.name)||s.mutagen==='忌'),three_sides_four_correct:group??null,context_palace_ids:contextPalaces.map(p=>p.id)},context_use:'庙陷、煞忌与三方四正保留作婚恋背景；未编造年龄加减分或反向公式。空宫对宫规则只列旁证。'};
}
function predictAge(chart,pid,model){
 const models=chart.bazi?(model==='all'?['wealth','authority']:[model]).map(m=>modelForecast(chart,pid,m)):[],ziwei=ziweiForecast(chart,pid);
 const tendency=ziwei.tendency,basis=tendency!=='none'?'ziwei_spouse_classical_rules':chart.bazi?'bazi_auxiliary_only':'no_explicit_classical_direction';
 return {id:`R-${pid.toUpperCase()}-AGE`,person_id:pid,input_scope:'single_natal_chart',method:RULES.method,rule_version:RULES.version,interpretation_scope:'traditional_pairing_symbolism',exact_age_gap:null,partner_star_model:model,
  status:tendency==='none'?'insufficient_evidence':'interpreted',basis,tendency,label:LABELS[tendency],models,ziwei,
  auxiliary_model_agreement:models.length===2&&models.every(m=>m.position_tendency!=='none'&&m.position_tendency===models[0].position_tendency),
  cues:[...ziwei.matches,...ziwei.opposite_support,...models.flatMap(m=>m.ledger)],
  method_note: '年龄规则以夫妻宫明确的传统婚配文字取象；“宜配”保留为婚配倾向。八字配偶星柱位为辅助，不独立定年上年下；规则分歧并列，不计票，不换算岁数。'};
}
module.exports={predictAge};
