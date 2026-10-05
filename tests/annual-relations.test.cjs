'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {build,validateArtifact}=require('../scripts/engine.cjs');
const {digest}=require('../scripts/common.cjs');
const {periodRelations}=require('../scripts/bazi-period-relations.cjs');
const fixture=()=>structuredClone(require('../examples/annual-relations-input.json'));
const synthetic=branches=>[...branches].map((branch,i)=>({id:['BZ-YEAR','BZ-MONTH','BZ-DAY','BZ-HOUR'][i],branch,stem:'甲'}));
const period=branch=>({id:'BZ-ANNUAL-TEST',branch,stem:'己'});
function resign(d){const {checksum,...payload}=d;d.checksum.value=digest(payload);return d;}
function comparable(rs,id){return rs.map(({id:rid,...r})=>({...r,pillars:r.pillars.map(p=>p===id?'PERIOD':p)}));}

test('合成命例：2030 比肩年仍返回夫妻宫三合，明确原局已齐全',()=>{
 const d=build(fixture()),y=d.bazi.chart.annual.find(y=>y.lichun_cycle_year===2030);
 assert.deepEqual(d.bazi.chart.pillars.map(p=>p.ganzhi),['甲戌','丙寅','庚午','辛巳']);
 assert.equal(y.ganzhi,'庚戌');assert.equal(y.stem_ten_god,'比肩');
 const r=y.day_branch_relations.find(r=>r.type==='三合'&&r.symbols==='寅午戌');assert.ok(r);
 assert.deepEqual(r.pillars,['BZ-YEAR','BZ-MONTH','BZ-DAY','BZ-ANNUAL-2030']);
 assert.equal(r.natal_group_present,true);assert.equal(r.group_state,'natal_already_complete');
 assert.deepEqual(r.natal_relation_ids,['BZ-REL-004']);assert.equal(r.touches_day_branch,true);
 assert.equal(y.branch,'戌');assert.deepEqual(y.hidden_stems,['戊','辛','丁']);assert.deepEqual(y.hidden_ten_gods,['偏印','劫财','正官']);
});
test('十二个流年逐一与该年目标日期关系一致，年度编号独立且来源真实',()=>{
 const i=fixture();i.options.annual_count=12;const d=build(i);const ids=[];
 for(const y of d.bazi.chart.annual){const t=build({...i,target_date:`${y.lichun_cycle_year}-06-01`,options:{annual_count:1}}).bazi.chart.target;
  assert.equal(y.ganzhi,t.year_ganzhi);assert.deepEqual(comparable(y.pillar_relations,y.id),comparable(t.year_relations,'BZ-TARGET-YEAR'));
  assert.deepEqual(y.day_branch_relations,y.pillar_relations.filter(r=>r.relation_field==='branch'&&r.pillars.includes('BZ-DAY')));
  for(const r of y.pillar_relations){assert.ok(r.pillars.includes(y.id));assert.ok(r.pillars.every(id=>id===y.id||d.bazi.chart.pillars.some(p=>p.id===id)));ids.push(r.id);}
 }
 assert.equal(new Set(ids).size,ids.length);
});
test('六合、冲、刑、害、破与天干合保留并存，夫妻宫仅标地支关系',()=>{
 for(const [day,annual,types] of [['寅','亥',['地支六合','地支六破']],['寅','申',['地支六冲','相刑（成对规则）']],['寅','巳',['地支六害','相刑（成对规则）']],['子','卯',['相刑（成对规则）']],['午','未',['地支六合']]]){
  const rs=periodRelations(synthetic(`酉酉${day}酉`),period(annual)),dayRs=rs.filter(r=>r.touches_day_branch);
  assert.deepEqual(new Set(dayRs.map(r=>r.type)),new Set(types));assert.ok(dayRs.every(r=>r.relation_field==='branch'));
  const stem=rs.find(r=>r.type==='天干五合'&&r.pillars.includes('BZ-DAY'));assert.ok(stem);assert.equal(stem.touches_day_branch,false);assert.equal(stem.relation_field,'stem');
 }
});
test('流年补齐三合、三会、三刑的状态与原局已有明确区分',()=>{
 for(const [branches,annual,type,symbols] of [['子子寅午','戌','三合','寅午戌'],['子子寅卯','辰','三会','寅卯辰'],['子子寅巳','申','三刑齐全','寅巳申']]){
  const r=periodRelations(synthetic(branches),period(annual)).find(r=>r.type===type&&r.symbols===symbols);
  assert.ok(r);assert.equal(r.natal_group_present,false);assert.equal(r.group_state,'completed_with_period');assert.deepEqual(r.natal_relation_ids,[]);assert.equal(r.touches_day_branch,true);
 }
});
test('重复支不代替缺失支，未参与的原局三合不混入年度关系',()=>{
 assert.equal(periodRelations(synthetic('寅寅午午'),period('寅')).some(r=>r.type==='三合'),false);
 const rs=periodRelations(synthetic('戌申寅午'),period('亥'));assert.equal(rs.some(r=>r.type==='三合'),false);
 assert.ok(rs.some(r=>r.type==='地支六合'&&r.touches_day_branch));
 const self=periodRelations(synthetic('子子午卯'),period('午')).find(r=>r.type==='自刑（采用本规则表）');assert.ok(self);assert.equal(self.natal_group_present,false);assert.equal(self.touches_day_branch,true);
});
test('立春前仍从上一周期开始；最大二十年及无目标日期保持原约定',()=>{
 const i=fixture();i.target_date='2030-01-10';i.options.annual_count=20;const d=build(i);
 assert.equal(d.bazi.chart.annual.length,20);assert.equal(d.bazi.chart.annual[0].lichun_cycle_year,2029);assert.equal(d.bazi.chart.annual[0].ganzhi,'己酉');assert.equal(d.bazi.chart.annual.at(-1).lichun_cycle_year,2048);
 delete i.target_date;assert.deepEqual(build(i).bazi.chart.annual,[]);
});
test('双人关系摘要带每人逐年列表，来源不串到另一人的命盘',()=>{
 const i=fixture();const rel=require('../scripts/relationship.cjs');
 const d=rel.build({mode:'relationship',chart_mode:'bazi',question:'逐年看关系',people:[{id:'a',birth:i.birth,options:i.options},{id:'b',birth:{...i.birth,date:'2000-01-01'},options:i.options}],target_date:i.target_date,context:{topics:['romance']}});
 for(const p of d.profiles){const c=d.people.find(x=>x.id===p.person_id).chart.bazi.chart;
  assert.equal(p.bazi.annual.length,3);for(const y of p.bazi.annual){assert.deepEqual(y.source,{person_id:p.person_id,source_id:y.id});const original=c.annual.find(x=>x.id===y.id);
   assert.deepEqual(y.day_branch_relations.map(r=>r.id),original.day_branch_relations.map(r=>r.id));
   for(const r of y.pillar_relations){assert.deepEqual(r.source,{person_id:p.person_id,source_id:r.id});assert.ok(r.sources.every(s=>s.person_id===p.person_id));assert.ok(r.sources.every(s=>s.source_id===y.id||c.pillars.some(p=>p.id===s.source_id)));}
  }
 }
 rel.validateArtifact(d);
});
test('时辰对照候选保留自己的逐年夫妻宫关系，可独立复算',()=>{
 const tc=require('../scripts/time-compare.cjs'),i=fixture();delete i.birth.time;
 const d=tc.build({mode:'time_compare',chart_mode:'bazi',birth:i.birth,birth_options:i.options,time_uncertainty:{type:'candidates',times:['09:15','19:15']},target_date:i.target_date,context:{topics:['romance']}});
 for(const c of d.candidates){assert.equal(c.status,'calculated');assert.equal(c.chart.profiles[0].bazi.annual.length,3);require('../scripts/relationship.cjs').validateArtifact(c.chart);}
 const groups=d.candidates.map(c=>c.chart.profiles[0].bazi.annual[1].day_branch_relations.find(r=>r.type==='三合'&&r.symbols==='寅午戌'));
 assert.ok(groups.every(g=>g.natal_group_present));assert.equal(groups[0].pillars.includes('BZ-HOUR'),false);assert.equal(groups[1].pillars.includes('BZ-HOUR'),true);tc.validateArtifact(d);
});
test('清空年度夫妻宫关系后即使重签摘要也会被基础和关系复算拒绝',()=>{
 const d=build(fixture());d.bazi.chart.annual[1].day_branch_relations=[];assert.throws(()=>validateArtifact(resign(d)),/重算不一致/);
 const rel=require('../scripts/relationship.cjs'),i=fixture();const r=rel.build({mode:'relationship',chart_mode:'bazi',question:'逐年看关系',people:[{id:'a',birth:i.birth,options:i.options}],target_date:i.target_date});r.profiles[0].bazi.annual[1].day_branch_relations=[];assert.throws(()=>rel.validateArtifact(resign(r)),/重算不一致/);
});
test('普通及关系 Markdown/HTML 报告展示逐年关系与已有组合标记',()=>{
 const d=build(fixture()),report=require('../scripts/report.cjs').makeReport(d);
 for(const output of [report.markdown,report.html]){assert.ok(output.includes('BZ-ANNUAL-2030-REL-001'));assert.ok(output.includes('寅午戌'));assert.ok(output.includes('原局已有，流年再次参与'));}
 const rel=require('../scripts/relationship.cjs'),i=fixture();const r=rel.build({mode:'relationship',chart_mode:'bazi',question:'逐年看关系',people:[{id:'a',birth:i.birth,options:i.options}],target_date:i.target_date});
 const rr=require('../scripts/relationship-report.cjs').makeReport(r);assert.ok(rr.markdown.includes('a:BZ-ANNUAL-2030')&&rr.markdown.includes('寅午戌'));assert.ok(rr.html.includes('原局已有，流年再次参与'));
});
