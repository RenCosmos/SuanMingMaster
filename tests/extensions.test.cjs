'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {build,validateArtifact}=require('../scripts/engine.cjs');
const {digest}=require('../scripts/common.cjs');
const {flyingMutagens}=require('../scripts/ziwei-flying.cjs');
const birth={calendar:'solar',date:'1994-02-13',time:'09:15',gender:'female',timezone:'Asia/Shanghai'}; // 人工选择的合成输入。
const input=()=>({mode:'both',birth:{...birth},target_date:'2029-06-01',options:{annual_count:3}});
function resign(d){const {checksum,...payload}=d;d.checksum.value=digest(payload);return d;}

test('合成大运乙丑保留财星、藏干与午丑害，显干不替代日支关系',()=>{
 const d=build(input()),y=d.bazi.chart.dayun[0];assert.equal(y.ganzhi,'乙丑');assert.equal(y.stem_ten_god,'正财');
 assert.deepEqual(y.hidden_stems,['己','癸','辛']);assert.deepEqual(y.hidden_ten_gods,['正印','伤官','劫财']);
 const harm=y.day_branch_relations.find(r=>r.type==='地支六害');assert.ok(harm);assert.equal(harm.symbols,'午丑');assert.deepEqual(harm.pillars,['BZ-DAY','BZ-DY-1']);validateArtifact(d);
});
test('各步大运编号独立，关系含本运来源，日支筛选排除天干五合',()=>{
 const d=build(input()),ids=[];for(const y of d.bazi.chart.dayun){assert.ok(y.stem&&y.branch);assert.equal(y.hidden_stems.length,y.hidden_ten_gods.length);
  assert.deepEqual(y.day_branch_relations,y.pillar_relations.filter(r=>r.relation_field==='branch'&&r.pillars.includes('BZ-DAY')));
  for(const r of y.pillar_relations){ids.push(r.id);assert.ok(r.id.startsWith(y.id+'-REL-'));assert.ok(r.pillars.includes(y.id));assert.ok(r.pillars.every(id=>id===y.id||d.bazi.chart.pillars.some(p=>p.id===id)));}
 }assert.equal(ids.length,new Set(ids).size);
});
test('大运及宫干飞化篡改后重签摘要仍被重算拒绝',()=>{
 for(const edit of [d=>{d.bazi.chart.dayun[0].hidden_ten_gods[0]='比肩';},d=>{d.ziwei.calculations.palace_stem_flying.entries[0].target_palace='不存在';}]){const d=build(input());edit(d);assert.throws(()=>validateArtifact(resign(d)),/重算不一致/);}
 const d=build(input());delete d.bazi.chart.dayun[0].day_branch_relations;assert.throws(()=>validateArtifact(resign(d),{recalculate:false}),/大运关系字段不完整/);
});
test('默认十干四化与独立项目表一致，每条落点回查实际安星且每宫发出四条',()=>{
 const expected=require('../references/verification/ziwei-flying-table.json').table;
 for(const date of ['1994-02-13','1999-07-21']){const d=build({...input(),birth:{...birth,date}}),z=d.ziwei,c=z.calculations.palace_stem_flying;
  assert.deepEqual(c.transformation_table,expected);assert.equal(c.entries.length,48);assert.equal(new Set(c.entries.map(e=>e.id)).size,48);
  for(const p of z.chart.palaces)assert.equal(c.entries.filter(e=>e.origin_palace_id===p.id).length,4);
  for(const e of c.entries){const p=z.chart.palaces.find(p=>p.id===e.target_palace_id);assert.ok([...p.majorStars,...p.minorStars,...p.adjectiveStars].some(s=>s.name===e.star));assert.equal(e.is_self_transform,e.origin_palace_id===e.target_palace_id);}
  assert.deepEqual(c.self_transforms,c.entries.filter(e=>e.is_self_transform));assert.equal(d.provenance.rules.ziwei,'ziwei-structural-v2');
 }
});
function tiny(){return [{id:'ZW-P0',index:0,name:'命',heavenlyStem:'甲',majorStars:[{name:'A'},{name:'B'}],minorStars:[],adjectiveStars:[]},{id:'ZW-P1',index:1,name:'夫妻',heavenlyStem:'甲',majorStars:[{name:'C'}],minorStars:[{name:'D'}],adjectiveStars:[]}];}
test('重复宫干保留双来源，辅星可四化，自化只有一个宫位来源',()=>{
 const c=flyingMutagens(tiny(),()=>['A','B','C','D']);assert.equal(c.entries.length,8);assert.equal(c.self_transforms.length,4);
 for(const s of c.palace_summary){assert.equal(s.incoming_ids.length,4);assert.equal(s.outgoing_ids.length,4);assert.equal(s.self_transform_ids.length,2);}
 assert.equal(c.entries.filter(e=>e.star==='D').length,2);assert.ok(c.self_transforms.every(e=>e.source_ids.length===1));
});
test('四化星缺失、重复安星、四化表少项均拒绝',()=>{
 const missing=tiny();missing[1].minorStars=[];assert.throws(()=>flyingMutagens(missing,()=>['A','B','C','D']),/安星位置不唯一/);
 const duplicate=tiny();duplicate[1].minorStars.push({name:'A'});assert.throws(()=>flyingMutagens(duplicate,()=>['A','B','C','D']),/安星位置不唯一/);
 assert.throws(()=>flyingMutagens(tiny(),()=>['A','B','C']),/四化表不完整/);
});
test('双人画像的大运和盘内飞化来源严格按人回查',()=>{
 const rel=require('../scripts/relationship.cjs'),d=rel.build({mode:'relationship',chart_mode:'both',question:'合成岁运比较',people:[{id:'a',birth},{id:'b',birth:{...birth,date:'1999-07-21'}}],target_date:'2029-06-01'});
 for(const p of d.profiles){const c=d.people.find(x=>x.id===p.person_id).chart;assert.equal(p.bazi.dayun.length,c.bazi.chart.dayun.length);
  for(const y of p.bazi.dayun){assert.equal(y.source.person_id,p.person_id);assert.ok(y.pillar_relations.every(r=>r.sources.every(s=>s.person_id===p.person_id)));}
  assert.ok(p.ziwei.palace_stem_flying.length>0);for(const e of p.ziwei.palace_stem_flying){assert.equal(e.source.person_id,p.person_id);assert.ok(c.ziwei.calculations.palace_stem_flying.entries.some(x=>x.id===e.source.source_id));assert.ok(e.sources.every(s=>s.person_id===p.person_id&&c.ziwei.chart.palaces.some(x=>x.id===s.source_id)));}
 }rel.validateArtifact(d);
});
test('候选摘要逐年比较日支关系和夫妻宫飞化，变化保留候选编号',()=>{
 const tc=require('../scripts/time-compare.cjs'),b={...birth};delete b.time;
 const d=tc.build({mode:'time_compare',chart_mode:'both',birth:b,time_uncertainty:{type:'candidates',times:['09:15','19:15']},target_date:'2029-06-01',birth_options:{annual_count:3}});
 const year=d.comparison.fields.find(f=>f.id==='TC-BZ-ANNUAL-2030'),fly=d.comparison.fields.find(f=>f.id==='TC-ZW-SPOUSE-FLY');assert.equal(year.status,'varies');assert.equal(fly.status,'varies');
 assert.ok(year.evidence.every(e=>e.source_ids.includes('a:BZ-ANNUAL-2030')));assert.ok(fly.evidence.every(e=>e.source_ids.every(s=>s.startsWith('a:ZW-FLY-'))));tc.validateArtifact(d);tc.validateSummary(tc.summary(d),d);
});
test('原85基础主题分开项目方法与已核原典，三项目提交与许可完整',()=>{
 const k=require('../scripts/knowledge.cjs'),r=k.verifyKnowledge();assert.equal(r.total_topics-r.spirit_topics,85);assert.equal(r.curated_topics,11);assert.equal(r.curated_classical_topics,4);
 const method=k.lookup({topic:'kb-ziwei-palace-flying'}),classic=k.lookup({topic:'kb-classic-year-decade'});assert.equal(method.topic.source_kind,'open_source_method_reference');assert.equal(classic.topic.source_kind,'classical_primary_text');assert.ok(classic.content.includes(classic.topic.original_excerpt));
 const cat=require('../references/knowledge/curated/catalog.json');assert.equal(new Set(cat.sources.map(s=>s.repository)).size,3);assert.ok(cat.sources.every(s=>/^[0-9a-f]{40}$/.test(s.commit)&&s.license_path));assert.ok(k.lookup({query:'寒暖',limit:10}).matches.some(t=>t.slug==='kb-classic-cold-warm'));
});
test('按需报告展示大运关系、宫干飞化和自化，保持计算证据编号',()=>{
 const d=build(input()),r=require('../scripts/report.cjs').makeReport(d);for(const text of [r.markdown,r.html])assert.ok(text.includes('BZ-DY-1-REL-')&&text.includes('ZW-FLY-')&&text.includes('自化'));
 const rel=require('../scripts/relationship.cjs'),pair=rel.build({mode:'relationship',chart_mode:'both',question:'合成报告检查',people:[{id:'a',birth}]});const rr=require('../scripts/relationship-report.cjs').makeReport(pair);assert.ok(rr.markdown.includes('a:BZ-DY-1')&&rr.markdown.includes('a:ZW-FLY-'));assert.ok(rr.html.includes('自化'));
});
