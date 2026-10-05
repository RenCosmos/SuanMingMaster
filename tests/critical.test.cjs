'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {cases,dependencies}=require('../scripts/critical-checks.cjs');
const deps=dependencies();
for(const c of cases())test('critical '+c.id,()=>c.run(deps));
for(const [id,module,edit] of [
 ['BZ-FIXED','engine',d=>{d.bazi.chart.pillars[3].ganzhi='甲子';}],
 ['BZ-ZI-BOUNDARY','engine',d=>{d.bazi.chart.pillars[3].ganzhi='戊子';}],
 ['BZ-SOLAR-DST','engine',d=>{d.normalized.utc_offset='+08:00';}],
 ['ZW-FIXED','engine',d=>{d.ziwei.chart.soul_palace_branch='子';}],
 ['LY-MIXED','divination',d=>{d.calculations.moving_lines=[6,3];}],
 ['AN-SPOUSE-CONTEXT','engine',d=>{for(const y of d.bazi.chart.annual)y.day_branch_relations=[];}],
 ['TC-CANDIDATES','timeCompare',d=>{d.candidates[1].chart.people[0].chart.bazi.chart.pillars[3].branch='辰';}],
 ['REL-SINGLE-AGE','relationship',d=>{d.age_relation.predictions[0].input_scope='two_charts';}]
])test('critical detects injected fault '+id,()=>{
 const c=cases().find(c=>c.id===id);c.run(deps);
 const faulty={...deps[module],build:i=>{const d=deps[module].build(i);edit(d);return d;}};
 assert.throws(()=>c.run({...deps,[module]:faulty}),assert.AssertionError);
});
test('annual context loss is rejected even when the full chart remains correct',()=>{
 const c=cases().find(c=>c.id==='AN-SPOUSE-CONTEXT');c.run(deps);
 const context={...deps.context,project:(d,o)=>{const r=deps.context.project(d,o);r.reading.bazi.annual.items[0].day_branch_relations=[];return r;}};
 assert.throws(()=>c.run({...deps,context}),assert.AssertionError);
});
