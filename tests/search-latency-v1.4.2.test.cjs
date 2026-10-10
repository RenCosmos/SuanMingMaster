'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=path.resolve(process.env.SUANMING_TEST_SKILL_ROOT||path.join(__dirname,'..'));
const search=require(path.join(root,'scripts/partner-search.cjs')),batch=require(path.join(root,'scripts/partner-search-batch.cjs')),workflow=require(path.join(root,'scripts/workflow.cjs')),core=require(path.join(root,'scripts/runtime-core.cjs')),budget=require(path.join(root,'scripts/output-budget.cjs'));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-latency-'));
test.after(()=>{assert.equal(path.dirname(temp),path.resolve(os.tmpdir()));fs.rmSync(temp,{recursive:true,force:true});});
const base=()=>({mode:'partner_search_batch',self:{birth:{calendar:'solar',date:'2006-08-29',time:'11:40',gender:'male',timezone:'Asia/Shanghai'}},as_of:'2026-10-09',search:{type:'dates',start:'2010-02-04',end:'2010-02-06',timezone:'Asia/Shanghai',time_uncertainty:{type:'unknown'}},filters:{conditions:['zodiac_affinity','spouse_branch_liuhe','day_stem_five_combine','partner_star_projection'],match:'any',exclude_relations:[],preferred_elements:[],year_gap:[-12,12]},ranking:'global_top',candidate_year_branch:'寅'});
function start(name,input=base(),flags=[]){const file=path.join(temp,name+'-input.json');fs.writeFileSync(file,JSON.stringify(input));return batch.operation(['--input',file,'--out',path.join(temp,name),...flags]);}
const bounded=r=>{budget.assertFits(r,budget.WORKFLOW_BYTES);assert.equal(r.output.bytes,budget.measure(r).stdout_bytes);};
function finish(r){let calls=0;while(!r.ok){assert.equal(r.execution.state,'yielded');const a=r.next_actions.find(a=>a.argv.includes('--resume'));assert.ok(a);r=workflow.operation(a.argv);bounded(r);assert.ok(++calls<30);}return r;}
test('optimized screenshot sample retains exact V1.4.1 artifact checksum and all 81 points',()=>{
 const raw=base();delete raw.ranking;delete raw.candidate_year_branch;raw.mode='partner_search';raw.search.end='2010-02-05';const d=search.build(raw);assert.equal(d.coverage.examined,81);assert.equal(d.checksum.value,'5a30eeef6b0dd24fc2d2312ff7c5c5eb9148e006155a1f6b3337a7f9d5b283ec');search.validateArtifact(d);
});
test('date candidates never invoke complete Yun/report chart generation',()=>{
 const engine=require(path.join(root,'scripts/engine.cjs')),original=engine.build;let calls=0;engine.build=i=>{calls++;assert.equal(i.birth.date,base().self.birth.date);return original(i);};
 try{const raw=base();delete raw.ranking;delete raw.candidate_year_branch;raw.mode='partner_search';const d=search.build(raw);assert.ok(d.coverage.examined>100);assert.equal(calls,1);}finally{engine.build=original;}
});
test('day checkpoint yields before a month completes and returned argv finishes identical month',()=>{
 const first=start('checkpoint',base(),['--max-days','1']);bounded(first);assert.equal(first.ok,false);assert.equal(first.partial,true);assert.equal(first.execution.state,'yielded');assert.equal(first.execution.next_date,'2010-02-05');assert.equal(first.execution.completed_days_this_call,1);assert.equal(first.context.ranking_final,false);
 const checkpoint=core.readJson(path.join(path.dirname(first.files.chart),'months/2010-02/scan-checkpoint.json'));assert.equal(checkpoint.state.nextDate,'2010-02-05');assert.equal(checkpoint.recalculated,true);
 const r=finish(first),m=core.readJson(r.files.chart),d=core.readJson(path.join(path.dirname(r.files.chart),m.jobs[0].chart));assert.deepEqual(d,search.build(d.input));assert.equal(r.context.ranking_final,true);assert.equal(r.execution.completed_days_this_call,2);
});
test('time deadline uses day-level progress rather than waiting for a whole month',()=>{
 const raw=base(),file=path.join(temp,'clock-input.json');fs.writeFileSync(file,JSON.stringify(raw));let calls=0;const r=batch.operation(['--input',file,'--out',path.join(temp,'clock'),'--time-budget','1'],{now:()=>calls++===0?0:1001});assert.equal(r.execution.state,'yielded');assert.equal(r.execution.stop_reason,'time_budget');assert.equal(r.execution.completed_days_this_call,1);bounded(r);assert.equal(finish(r).ok,true);
});
test('resume does not repeat already independently verified day scans',()=>{
 const r=start('no-repeat',base(),['--max-days','1']),old=search.createScan,dates=[];search.createScan=(raw,resume)=>{const scan=old(raw,resume),step=scan.step;scan.step=()=>{const date=scan.snapshot().nextDate,result=step();if(result)dates.push(date);return result;};return scan;};
 try{finish(r);}finally{search.createScan=old;}assert.equal(dates.filter(d=>d==='2010-02-04').length,0);assert.equal(dates.filter(d=>d==='2010-02-05').length,2);assert.equal(dates.filter(d=>d==='2010-02-06').length,2);
});
test('invalid checkpoint checksum is rejected without deleting previous work',()=>{
 const r=start('tamper',base(),['--max-days','1']),f=path.join(path.dirname(r.files.chart),'months/2010-02/scan-checkpoint.json'),saved=core.readJson(f);saved.state.examined++;fs.writeFileSync(f,JSON.stringify(saved));const bytes=fs.readFileSync(f),failed=workflow.operation(r.next_actions[0].argv);assert.equal(failed.execution.state,'failed');assert.match(failed.error.error,/检查点校验/);assert.deepEqual(fs.readFileSync(f),bytes);
});
test('stale fingerprint restarts only partial month and cannot trust edited partial evidence',()=>{
 const r=start('stale',base(),['--max-days','1']),f=path.join(path.dirname(r.files.chart),'months/2010-02/scan-checkpoint.json'),saved=core.readJson(f);saved.fingerprint='stale';saved.state.results=[];const {checksum,...body}=saved;saved.checksum={algorithm:'sha256-canonical-json',value:core.hash(body)};fs.writeFileSync(f,JSON.stringify(saved));const done=finish(r),m=core.readJson(done.files.chart),d=core.readJson(path.join(path.dirname(done.files.chart),m.jobs[0].chart));assert.deepEqual(d,search.build(d.input));assert.equal(done.execution.completed_days_this_call,3);
});
test('independent day mismatch cannot publish a verified monthly artifact',()=>{
 const old=search.createScan;let scans=0;search.createScan=(raw,resume)=>{const s=old(raw,resume);if(++scans%2===0){const step=s.step;s.step=()=>{const ok=step();if(ok)s.snapshot().unavailable.push({local_datetime:'synthetic',error:'injected independent mismatch'});return ok;};}return s;};
 let r;try{r=start('independent');}finally{search.createScan=old;}assert.equal(r.execution.state,'failed');assert.match(r.error.error,/独立重算/);assert.ok(!fs.existsSync(path.join(path.dirname(r.files.chart),'months/2010-02/chart.json')));
});
test('trusted completed batch reuse performs zero candidate scans and preserves charts',()=>{
 const r=start('cached'),m=core.readJson(r.files.chart),f=path.join(path.dirname(r.files.chart),m.jobs[0].chart),bytes=fs.readFileSync(f),old=search.createScan;search.createScan=()=>{throw Error('trusted cache was scanned');};let reused;
 try{reused=workflow.operation(['--reuse',r.files.chart,'--partner-search','--batch','--rank','global_top']);}finally{search.createScan=old;}assert.equal(reused.cache_hit,true);assert.equal(reused.calculation_performed,false);assert.deepEqual(fs.readFileSync(f),bytes);bounded(reused);
});
test('a stale monthly validation receipt is reverified incrementally without rewriting chart',()=>{
 const r=start('old-receipt'),m=core.readJson(r.files.chart),dir=path.join(path.dirname(r.files.chart),'months/2010-02'),f=path.join(dir,'chart.json'),bytes=fs.readFileSync(f);fs.unlinkSync(path.join(dir,'validation.json'));
 const partial=batch.operation(['--reuse',r.files.chart,'--resume','--max-days','1']);assert.equal(partial.ok,false);assert.equal(partial.context.computed_complete,false);assert.equal(partial.execution.state,'yielded');const done=finish(partial);assert.equal(done.ok,true);assert.deepEqual(fs.readFileSync(f),bytes);assert.equal(m.complete,true);
});
test('budget parameters are explicit and reject malformed, excessive or display-only use',()=>{
 for(const value of ['0','61','abc'])assert.throws(()=>start('invalid-'+value,base(),['--time-budget',value]),/整数|超出/);
 const r=start('display');assert.throws(()=>batch.operation(['--reuse',r.files.chart,'--max-days','1']),/执行预算/);
});
test('scan checkpoint cannot be consumed as temporary input and accidentally removed',()=>{
 const r=start('protected-checkpoint',base(),['--max-days','1']),f=path.join(path.dirname(r.files.chart),'months/2010-02/scan-checkpoint.json'),bytes=fs.readFileSync(f);
 assert.throws(()=>workflow.operation(['--temp-input',f,'--partner-search','--batch','--out',path.join(temp,'not-an-input')]),/结果文件/);assert.deepEqual(fs.readFileSync(f),bytes);
});
