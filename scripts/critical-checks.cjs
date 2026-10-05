'use strict';
// File-free installation regressions with fixed expectations independent of build().
// Sources and convention limits: references/critical-testing.md.
const assert=require('node:assert/strict');
const birth=(date,time,extra={})=>({mode:'bazi',birth:{calendar:'solar',date,time,gender:'male',timezone:'Asia/Shanghai'},...extra});
const pillars=d=>d.bazi.chart.pillars.map(p=>p.ganzhi);
function cases(){return [
 {id:'BZ-FIXED',run:({engine})=>{
  assert.deepEqual(pillars(engine.build(birth('2005-12-23','08:37'))),['乙酉','戊子','辛巳','壬辰']);
  assert.deepEqual(pillars(engine.build(birth('2022-08-28','01:50'))),['壬寅','戊申','癸丑','癸丑']);
 }},
 {id:'BZ-ZI-BOUNDARY',run:({engine})=>{
  const i=birth('1988-02-15','23:30');
  assert.deepEqual(pillars(engine.build(i)),['戊辰','甲寅','庚子','丙子']);
  assert.deepEqual(pillars(engine.build({...i,options:{bazi_day_boundary:'late_zi'}})),['戊辰','甲寅','辛丑','戊子']);
 }},
 {id:'BZ-LUNAR-LEAP',run:({engine})=>{
  const i=birth('2023-02-01','12:00');i.birth.calendar='lunar';i.birth.is_leap_month=true;
  assert.equal(engine.build(i).normalized.solar_date,'2023-03-22');
  i.birth.date='2024-02-01';assert.throws(()=>engine.build(i));
 }},
 {id:'BZ-SOLAR-DST',run:({engine})=>{
  for(const [date,time,longitude,utc,solar,offset] of [
   ['1990-07-01','12:00',121.5,'1990-07-01T03:00:00Z','1990-07-01T11:02:18.510','+09:00'],
   ['2000-01-01','00:10',87.617,'1999-12-31T16:10:00Z','1999-12-31T21:57:33.559','+08:00']
  ]){
   const i=birth(date,time,{options:{time_basis:'true_solar'}});i.birth.longitude=longitude;
   const d=engine.build(i);assert.equal(d.normalized.utc_instant,utc);assert.equal(d.normalized.utc_offset,offset);
   assert.equal(d.normalized.solar_time.apparent_solar_datetime,solar);assert.equal(d.bazi.chart.day_hour_calculation_datetime,solar);
  }
 }},
 {id:'BZ-LICHUN',run:({engine})=>{
  assert.deepEqual(pillars(engine.build(birth('2024-02-04','16:27:06'))).slice(0,2),['癸卯','乙丑']);
  assert.deepEqual(pillars(engine.build(birth('2024-02-04','16:27:07'))).slice(0,2),['甲辰','丙寅']);
  const d=engine.build(birth('2000-01-01','12:00',{target_date:'2024-01-10',options:{annual_count:1}}));
  assert.equal(d.bazi.chart.annual[0].lichun_cycle_year,2023);assert.equal(d.bazi.chart.annual[0].ganzhi,'癸卯');
 }},
 {id:'ZW-FIXED',run:({engine})=>{
  const i=birth('2000-08-16','03:30',{mode:'ziwei',target_date:'2023-08-19',options:{ziwei_year_boundary:'lichun'}});i.birth.gender='female';
  const z=engine.build(i).ziwei.chart;
  assert.equal(z.soul_palace_branch,'午');assert.equal(z.body_palace_branch,'戌');assert.equal(z.soul,'破军');assert.equal(z.body,'文昌');
  assert.equal(z.five_elements_class,'木三局');assert.equal(z.target.decadal.index,2);assert.equal(z.target.yearly.index,1);
  assert.equal(z.target.age.nominalAge,24);assert.deepEqual(z.target.yearly.mutagen,['破军','巨门','太阴','贪狼']);
 }},
 {id:'LY-MIXED',run:({divination})=>{
  const d=divination.build({mode:'divination',method:'liuyao',question:'合成六爻检查',casting:{lines:[9,7,7,6,8,8]},time:{date:'2005-12-23',time:'08:37',timezone:'Asia/Shanghai'}});
  assert.equal(d.chart.base.name,'地天泰');assert.equal(d.chart.changed.name,'雷风恒');
  assert.deepEqual(d.calculations.moving_lines,[1,4]);assert.equal(d.chart.base.palace.shi_line,3);assert.equal(d.chart.base.palace.ying_line,6);
  assert.deepEqual(d.chart.lines.map(l=>l.najia),['甲子','甲寅','甲辰','癸丑','癸亥','癸酉']);
  assert.equal(d.chart.lines[0].changed.najia,'辛丑');assert.equal(d.chart.lines[0].changed.relative_to_base_palace,'兄弟');
 }},
 {id:'AN-SPOUSE-CONTEXT',run:({engine,context})=>{
  const i=birth('1994-02-13','09:15',{target_date:'2029-06-01',options:{annual_count:3}});i.birth.gender='female';
  const d=engine.build(i);assert.deepEqual(pillars(d),['甲戌','丙寅','庚午','辛巳']);
  const original=d.bazi.chart.annual.find(y=>y.lichun_cycle_year===2030);
  const view=context.project(d,{focus:'annual',years:[2030,2030],limit:1}).reading.bazi.annual.items[0];
  for(const y of [original,view]){
   assert.equal(y.ganzhi,'庚戌');assert.equal(y.stem_ten_god,'比肩');assert.deepEqual(y.hidden_ten_gods,['偏印','劫财','正官']);
   const r=y.day_branch_relations.find(r=>r.type==='三合'&&r.symbols==='寅午戌');assert.ok(r,'夫妻宫三合缺失');
   assert.deepEqual(r.pillars,['BZ-YEAR','BZ-MONTH','BZ-DAY','BZ-ANNUAL-2030']);
   assert.equal(r.natal_group_present,true);assert.equal(r.group_state,'natal_already_complete');
  }
 }},
 {id:'TC-CANDIDATES',run:({timeCompare})=>{
  const d=timeCompare.build({mode:'time_compare',chart_mode:'bazi',birth:{calendar:'solar',date:'1995-01-15',gender:'female',timezone:'Asia/Shanghai'},time_uncertainty:{type:'candidates',times:['08:30','09:30']}});
  const charts=d.candidates.map(c=>c.chart.people[0].chart.bazi.chart);
  assert.deepEqual(charts.map(c=>c.pillars[3].branch),['辰','巳']);assert.equal(charts[0].pillars[2].ganzhi,charts[1].pillars[2].ganzhi);
  assert.ok(d.comparison.stable_field_ids.includes('TC-BZ-DAY'));assert.ok(d.comparison.variable_field_ids.includes('TC-BZ-HOUR'));
  assert.equal(d.coverage.selected_best_candidate,null);
 }},
 {id:'REL-SINGLE-AGE',run:({relationship})=>{
  const d=relationship.build({mode:'relationship',chart_mode:'ziwei',question:'合成单盘规则检查',people:[{id:'a',birth:{calendar:'solar',date:'1994-02-13',time:'03:15',gender:'male',timezone:'Asia/Shanghai'}}],context:{topics:['age_relation']}});
  assert.equal(d.people.length,1);assert.equal(d.age_relation.predictions[0].input_scope,'single_natal_chart');
  assert.equal(d.age_relation.predictions[0].tendency,'younger');assert.equal(d.age_relation.predictions[0].exact_age_gap,null);
 }},
 {id:'KB-RETRIEVAL',run:({knowledge,knowledgeContext})=>{
  assert.equal(knowledge.verifyKnowledge().total_topics,85);
  const r=knowledgeContext.retrieve({query:'如何增加桃花',limit:1});
  assert.equal(r.matches[0].slug,'practice-romance-yuelao');assert.ok(r.matches[0].source_url);
  assert.equal(r.matches[0].content,undefined);assert.ok(Buffer.byteLength(JSON.stringify(r))<=12*1024);
 }},
 {id:'SW-LUNAR-DATE',run:({shuwen})=>{
  assert.equal(shuwen.documentDate({calendar:'lunar',date:'2023-02-01',is_leap_month:true}).solar_date,'2023-03-22');
  assert.throws(()=>shuwen.documentDate({calendar:'lunar',date:'2024-02-01',is_leap_month:true}));
 }}
];}
function dependencies(overrides={}){
 const modules={engine:'engine',divination:'divination',context:'context',timeCompare:'time-compare',relationship:'relationship',knowledge:'knowledge',knowledgeContext:'knowledge-context',shuwen:'shuwen'};
 return Object.fromEntries(Object.entries(modules).map(([key,name])=>[key,overrides[key]??require('./'+name+'.cjs')]));
}
function runCritical(overrides={}){
 const deps=dependencies(overrides),results=[];
 for(const c of cases()){
  try{c.run(deps);results.push({id:c.id,ok:true});}
  catch(e){results.push({id:c.id,ok:false,error:String(e.message).slice(0,600)});}
 }
 return {ok:results.every(r=>r.ok),passed:results.filter(r=>r.ok).length,total:results.length,cases:results};
}
module.exports={cases,dependencies,runCritical};
