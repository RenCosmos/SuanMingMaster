'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {preflight}=require('../scripts/preflight.cjs');
test('environment check loads dependencies without calculating a chart',()=>{
 const engine=require('../scripts/engine.cjs'),original=engine.build;
 engine.build=()=>{throw Error('environment check unexpectedly calculated a chart');};
 try{const r=preflight();assert.equal(r.ok,true);assert.equal(r.critical,undefined);assert.equal(r.engines.iztro,'2.6.1');}
 finally{engine.build=original;}
});
test('self-test fails when a fixed expected day pillar is violated',()=>{
 const engine=require('../scripts/engine.cjs'),original=engine.build;
 engine.build=i=>{const d=original(i);if(d.bazi)d.bazi.chart.pillars[2].ganzhi='甲子';return d;};
 try{const r=preflight({selfTest:true});assert.equal(r.ok,false);assert.equal(r.critical.cases.find(c=>c.id==='BZ-FIXED').ok,false);}
 finally{engine.build=original;}
});
