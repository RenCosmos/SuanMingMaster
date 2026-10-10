'use strict';
// Derived evidence only; calendar, candidate search and saved artifacts are unchanged.
const RULES=require('../references/romance-rules.json');
const TAOHUA=require('../references/relationship-rules.json').taohua_by_branch;
const ref=(person_id,source_id)=>({person_id,source_id});
const take=(o,keys)=>Object.fromEntries(keys.filter(k=>o?.[k]!==undefined).map(k=>[k,o[k]]));
const relation=r=>take(r,['id','type','symbols','pillars','relation_field','touches_day_branch','group_state','natal_group_present']);
const gods=model=>model==='wealth'?['正财','偏财']:model==='authority'?['正官','七杀']:['正财','偏财','正官','七杀'];
function modernAge(chart,pid){
 if(!chart.bazi)return {tendency:'none',matches:[],conditional_patterns:[]};
 const b=chart.bazi,day=b.chart.pillars.find(p=>p.id==='BZ-DAY');
 const matches=RULES.modern_age_day_rules.filter(r=>r.ten_gods.includes(day.hidden_ten_gods[0])).map(r=>({rule_id:r.id,direction:r.direction,ten_god:day.hidden_ten_gods[0],source:ref(pid,'BZ-DAY-H1'),source_id:r.source_id,evidence_kind:'modern_author_interpretation'}));
 const visible=b.calculations.score_ledger.filter(x=>x.kind==='visible_stem');
 const conditional_patterns=RULES.modern_age_patterns.map(r=>({...r,visible_sources:r.groups.map(group=>visible.filter(x=>group.includes(x.ten_god)).map(x=>ref(pid,x.id))),strength_confirmed:false})).filter(r=>r.visible_sources.every(g=>g.length));
 return {tendency:matches[0]?.direction??'none',matches,conditional_patterns,exact_age_gap:null};
}
function ageReading(chart,pid,model,classic){
 classic=classic??require('./relationship-age.cjs').predictAge(chart,pid,model);
 const modern=modernAge(chart,pid),hasClassic=classic.tendency!=='none',tendency=hasClassic?classic.tendency:modern.tendency;
 return {person_id:pid,tendency,basis:hasClassic?'ziwei_classical':modern.tendency!=='none'?'bazi_modern_author':'no_direct_rule',
  label:{older:'对象偏年长',younger:'对象偏年小',peer:'对象偏同龄',mixed:'年龄线索有分歧',none:'目前未见明确的年龄主线'}[tendency],
  classical_tendency:classic.tendency,modern,conflict:hasClassic&&modern.tendency!=='none'&&classic.tendency!==modern.tendency,
  classical_evidence:classic.ziwei.matches,position_auxiliary:classic.models.map(m=>({model:m.model,tendency:m.position_tendency,ledger:m.ledger})),exact_age_gap:null};
}
function romance(chart,pid,model,options={}){
 const out={person_id:pid,method_version:RULES.version,attraction:{},commitment:{},source_ids:['REL-ZP-WIFE','REL-LKM-ROMANCE']};
 if(chart.bazi){
  const b=chart.bazi,pillars=b.chart.pillars,day=pillars.find(p=>p.id==='BZ-DAY'),chosen=gods(model);
  const occurrences=b.calculations.score_ledger.map(x=>({...take(x,['id','stem','ten_god','kind','source']),evidence:ref(pid,x.id)}));
  const markers=['BZ-YEAR','BZ-DAY'].flatMap(base=>{const p=pillars.find(x=>x.id===base),symbol=TAOHUA[p.branch];return pillars.filter(x=>x.branch===symbol).map(x=>({name:'桃花',symbol,basis:ref(pid,base),hit:ref(pid,x.id)}));});
  out.attraction={bazi_markers:markers,expression:occurrences.filter(x=>['食神','伤官'].includes(x.ten_god)),partner_stars:occurrences.filter(x=>chosen.includes(x.ten_god))};
  out.commitment={spouse_palace:{ganzhi:day.ganzhi,branch:day.branch,hidden_ten_gods:day.hidden_ten_gods,source:ref(pid,day.id)},spouse_relations:b.calculations.relations.filter(r=>r.pillars.includes(day.id)).map(relation),month_frame:take(b.calculations.theory_evidence,['month_command','day_master_roots','month_hidden_transparency']),partner_star_model:model};
  const rows=b.chart.annual.filter(y=>!options.years||y.lichun_cycle_year>=options.years[0]&&y.lichun_cycle_year<=options.years[1]),offset=options.offset??0,limit=options.limit??3;
  const annual=rows.slice(offset,offset+limit).map(y=>({year:y.lichun_cycle_year,ganzhi:y.ganzhi,partner_stars:[y.stem_ten_god,...y.hidden_ten_gods].filter(g=>chosen.includes(g)),
   attraction_markers:['BZ-YEAR','BZ-DAY'].filter(base=>TAOHUA[pillars.find(p=>p.id===base).branch]===y.branch).map(base=>({name:'桃花',basis:ref(pid,base),period:ref(pid,y.id)})),
   spouse_palace_relations:y.day_branch_relations.map(relation),source:ref(pid,y.id)}));
  out.timing={total:rows.length,offset,returned:annual.length,next_offset:offset+limit<rows.length?offset+limit:null,items:annual,
   computed_years:{first:b.chart.annual[0]?.lichun_cycle_year??null,last:b.chart.annual.at(-1)?.lichun_cycle_year??null,total:b.chart.annual.length},requested_years:options.years??null,requested_range_computed:options.years?rows.length===options.years[1]-options.years[0]+1:null};
  const timing=require('./dayun-timing.cjs'),current=timing.active(b.chart);
  out.active_dayun=current.window?[{...take(current.window.period,['id','ganzhi','start_year','end_year','stem_ten_god','hidden_ten_gods']),...timing.boundaries(current.window),spouse_palace_relations:current.window.period.day_branch_relations.map(relation)}]:[];
  out.dayun_at_target=timing.summary(current);
 }
 if(chart.ziwei){
  const z=chart.ziwei,spouse=z.chart.palaces.find(p=>p.name.replace(/宫$/,'')==='夫妻');
  out.attraction.ziwei_markers=z.chart.palaces.flatMap(p=>[...p.majorStars,...p.minorStars,...p.adjectiveStars].filter(s=>['红鸾','天喜','天姚','咸池'].includes(s.name)).map(s=>({name:s.name,palace:p.name,source:ref(pid,p.id)})));
  out.commitment.ziwei_spouse={source:ref(pid,spouse.id),major_stars:spouse.majorStars,natal_mutagens:z.calculations.natal_mutagens.filter(x=>x.palace_id===spouse.id),group:z.calculations.three_sides_four_correct.find(g=>g.palace_id===spouse.id)};
 }
 out.reading_order=['先断吸引与交往，再断能否承接成长期关系；两者可同时强，不强行二选一。','桃花、红鸾单列；长期主看配偶星、夫妻宫、月令喜忌和岁运，刑冲也有引动作用，不自动断分手。'];
 return out;
}
module.exports={romance,modernAge,ageReading,RULES};
