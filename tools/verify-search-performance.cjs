'use strict';
// Independent old/new comparison, not a phone speed promise.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),previous=path.resolve(process.argv[2]||'');
assert.equal(require(path.join(previous,'package.json')).version,'1.4.1','Use the verified V1.4.1 standard installation');
const oldSearch=require(path.join(previous,'scripts/partner-search.cjs')),search=require('../scripts/partner-search.cjs'),batch=require('../scripts/partner-search-batch.cjs'),core=require('../scripts/runtime-core.cjs'),workflow=require('../scripts/workflow.cjs');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-performance-'));
try{
 const input={mode:'partner_search_batch',self:{birth:{calendar:'solar',date:'2006-08-29',time:'11:40',gender:'male',timezone:'Asia/Shanghai'}},as_of:'2026-10-09',search:{type:'dates',start:'2010-02-04',end:'2011-02-04',timezone:'Asia/Shanghai',time_uncertainty:{type:'unknown'}},filters:{conditions:['zodiac_affinity','spouse_branch_liuhe','day_stem_five_combine','partner_star_projection'],match:'any',exclude_relations:[],preferred_elements:[],year_gap:[-12,12]},ranking:'global_top',candidate_year_branch:'寅'};
 const normalized=batch.normalizeInput(input),rows=batch.plan(input.search.start,input.search.end),expected=new Map();let oldMs=0,newMs=0,examined=0;
 for(const row of rows){const raw=batch.monthInput(normalized,row);let t=performance.now(),a=oldSearch.build(raw);oldMs+=performance.now()-t;t=performance.now();const b=search.build(raw);newMs+=performance.now()-t;assert.deepEqual(b,a,'Full old/new candidate artifact: '+row.month);expected.set(row.month,core.hash(a));examined+=a.coverage.examined;}
 // Boundary/convention cases must agree, not only ordinary Shanghai midday.
 const edges=[{date:'2011-02-04',options:{bazi_day_boundary:'late_zi',bazi_hour_stem_rule:'library'}},{date:'1988-04-17',timezone:'Asia/Shanghai'},{date:'2024-11-03',timezone:'America/New_York'},{date:'1997-06-15',longitude:121.5,longitude_source:'synthetic fixture',options:{time_basis:'true_solar'}}];
 for(const e of edges){const {date,options,...location}=e,raw=batch.monthInput(normalized,{start:date,end:date});raw.filters.year_gap=[-100,100];raw.search={...raw.search,...location,start:date,end:date,...(options?{options}:{})};assert.deepEqual(search.build(raw),oldSearch.build(raw),'Boundary/convention '+date);}
 const oldEngine=require(path.join(previous,'scripts/engine.cjs')),engine=require('../scripts/engine.cjs');
 for(const f of ['input.json','bazi-input.json','ziwei-input.json']){const file=path.join(root,'examples',f);if(fs.existsSync(file)){const raw=core.readJson(file);assert.deepEqual(engine.build(raw),oldEngine.build(raw),'Ordinary complete chart '+f);}}
 const file=path.join(temp,'input.json'),out=path.join(temp,'task');fs.writeFileSync(file,JSON.stringify(input));let t=performance.now(),r=workflow.operation(['--partner-search','--batch','--input',file,'--out',out]),calls=1;
 while(r.execution.state==='yielded'){r=workflow.operation(r.next_actions.find(a=>a.argv.includes('--resume')).argv);assert.ok(++calls<100);}assert.ok(r.ok&&r.validation.ok);const batchMs=performance.now()-t;
 const manifest=core.readJson(r.files.chart);for(const job of manifest.jobs)assert.equal(core.hash(core.readJson(path.join(out,job.chart))),expected.get(job.month));
 t=performance.now();const reused=workflow.operation(['--partner-search','--batch','--reuse',r.files.chart,'--rank','global_top']);const reuseMs=performance.now()-t;assert.ok(reused.cache_hit&&!reused.validation.recalculated);
 console.log(JSON.stringify({ok:true,baseline:'1.4.1 standard package',scope:'screenshot-style full 2010 Lichun date interval with unknown time, plus timezone/solar/convention boundaries',months:rows.length,original_sample_points:examined,complete_candidate_artifacts_equal:true,ordinary_complete_charts_equal:true,edge_cases_equal:edges.length,desktop_ms:{old_candidate_build:Math.round(oldMs),new_candidate_build:Math.round(newMs),new_batch_with_independent_verification:Math.round(batchMs),trusted_full_year_reuse:Math.round(reuseMs)},candidate_build_speedup:Math.round(oldMs/newMs*100)/100,batch_calls:calls,phone_measured:false}));
}finally{assert.equal(path.dirname(temp),path.resolve(os.tmpdir()));fs.rmSync(temp,{recursive:true,force:true});}
