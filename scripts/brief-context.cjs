'use strict';
// Opt-in concise view; saved charts and pagination metadata are never replaced.
const {romance,ageReading}=require('./relationship-romance.cjs');
function compactChart(c,options){
 // Keep all theme evidence: roots, qiyun, dayun, related palaces and flying transformations.
 if(c.ziwei?.palace_stem_flying){const items=c.ziwei.palace_stem_flying,offset=options.flying_offset??0,limit=options.limit??3;c.ziwei.palace_stem_flying={total:items.length,offset,items:items.slice(offset,offset+limit),next_offset:offset+limit<items.length?offset+limit:null};}
 return c;
}
function compactRomance(e,chart,profile){
 if(chart.bazi){
  // Same-page DaYun rows already include the exact current period and boundaries.
  // Refer to them instead of duplicating the new date metadata and old relations.
  if(chart.bazi.dayun){delete e.active_dayun;e.active_dayun_source='bazi.dayun';delete e.dayun_at_target;e.dayun_at_target_source='bazi.dayun_at_target';}
  e.commitment={partner_star_model:e.commitment.partner_star_model,spouse_palace_source:'bazi.pillars[BZ-DAY]',spouse_relation_ids:e.commitment.spouse_relations.map(x=>x.id),month_frame_source:'bazi.theory_evidence'};
  e.attraction.partner_star_ids=e.attraction.partner_stars.map(x=>x.id);delete e.attraction.partner_stars;
  if(chart.bazi.annual){e.timing.items=e.timing.items.map(x=>({year:x.year,source:x.source,attraction_markers:x.attraction_markers,partner_stars:x.partner_stars}));e.timing.detail_source='bazi.annual';}
 }
 if(chart.ziwei)e.commitment.ziwei_spouse_source='ziwei.primary_palaces[夫妻] / natal_mutagens / three_sides_four_correct';
 e.attraction.expression_sources=e.attraction.expression?.map(x=>({source_id:x.id,ten_god:x.ten_god}));delete e.attraction.expression;
 if(profile?.traditional_markers){delete e.attraction.ziwei_markers;e.attraction.ziwei_markers_source='同人物traditional_markers';}
 if(profile?.relationship_bazi?.traditional_markers){delete e.attraction.bazi_markers;e.attraction.bazi_markers_source='同人物relationship_bazi.traditional_markers';}
 delete e.reading_order;
 return e;
}
function projectBrief(context,data,options){
 const c=structuredClone(context),mode=data.input.mode;
 c.view='brief';delete c.available.expansion;
 c.interpretation_rules=['内部方法约束，不逐条复述。先给主判断，再说关键依据；短缘和长缘分别断，反向线索说明主次。','stem_ten_god是显干，hidden_stems／hidden_ten_gods是藏干；藏干出现不等于透出。','紫微空宫只指无主星；结合对宫、三方四正及四化，不单凭空宫断异地缘弱。'];
 // Candidate comparison already carries a large evidence scope; the main SKILL
 // holds the same fact distinctions, without repeating them in every candidate.
 if(mode==='time_compare')c.interpretation_rules=c.interpretation_rules.slice(0,1);
 if(mode==='relationship'&&!options.comparison){
  for(const p of c.reading.people){const person=data.people.find(x=>x.id===p.person_id),model=data.profiles.find(x=>x.person_id===p.person_id).bazi?.partner_star_model??(data.input.options.partner_star_model==='auto'?(person.chart.input.birth.gender==='male'?'wealth':'authority'):data.input.options.partner_star_model);
   if(['relationship','romance'].includes(options.focus))p.emotional_paths=compactRomance(romance(person.chart,p.person_id,model,options),p.chart,p);
   if(options.focus==='age_relation'){p.age_reading=ageReading(person.chart,p.person_id,model,data.age_relation.predictions.find(x=>x.person_id===p.person_id));delete p.age_relation;}
   compactChart(p.chart,options);
  }
 }else if(!['time_compare','divination','relationship'].includes(mode)){
  const model=data.input.birth.gender==='male'?'wealth':'authority';
  if(['relationship','romance'].includes(options.focus))c.reading.emotional_paths=compactRomance(romance(data,'a',model,options),c.reading);
  if(options.focus==='age_relation'){c.reading.age_reading=ageReading(data,'a',model);delete c.reading.age_relation;}
  compactChart(c.reading,options);
 }else if(mode==='time_compare'&&options.candidate){
  const chosen=data.candidates.find(x=>x.id===options.candidate);
  c.reading.reading=projectBrief({...c,reading:c.reading.reading},chosen.chart,options).reading;
 }
 c.available.full_view='同一命盘复用时省略 --brief；romance 改用 relationship 展开原主题；不读取整文件。';
 c.available.omitted_details=[];
 c.available.deduplication='摘要source／ids指向同页证据；飞化按next_offset续页，原数据不删；双人按现有双方／交叉分页。';
 if(options.overview){
  c.view='overview';
  const people=c.reading.people??[{chart:c.reading,emotional_paths:c.reading.emotional_paths}];
  c.available.deferred_views=[];
  for(const p of people){
   const b=p.chart.bazi,e=p.emotional_paths;
   if(b?.annual){const a=b.annual;c.available.deferred_views.push({page:'annual',...(p.person_id?{person:p.person_id}:{}),computed_years:a.computed_years});delete b.annual;}
   if(e){delete e.timing;e.timing_deferred=true;}
  }
  c.available.omitted_details=['逐年窗口按需展开；本命、当前大运、关联宫与飞化证据仍保留'];
  c.available.full_view='同一命盘复用时省略 --overview；原精简／完整主题、年龄与画像入口仍可用。';
 }
 return c;
}
module.exports={projectBrief};
