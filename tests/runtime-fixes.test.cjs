'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const core=require('../scripts/runtime-core.cjs'),flow=require('../scripts/workflow.cjs'),locks=require('../scripts/task-files.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-fixes-'));
test.after(()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});});
const fixture=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'../examples',n),'utf8'));
const input={mode:'bazi',birth:{calendar:'solar',date:'2000-01-01',time:'12:00',gender:'male',timezone:'Asia/Shanghai'}};
const save=(n,d)=>{const p=path.join(root,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(d));return p;};
const cli=path.join(__dirname,'../scripts/workflow.cjs');
const run=args=>{const r=cp.spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:30000});assert.ifError(r.error);return r;};
const source=save('source.json',input),first=flow.operation(['--input',source,'--out',path.join(root,'primary')]),data=core.readJson(first.files.chart);
test('CLI rejects reuse/context collision without changing source bytes; a separate output directory works',()=>{
 const file=save('collision/context.json',data),before=fs.readFileSync(file);
 const failed=run(['--reuse',file]);assert.equal(failed.status,2);assert.match(failed.stderr,/覆盖/);assert.deepEqual(fs.readFileSync(file),before);
 assert.deepEqual(fs.readdirSync(path.dirname(file)),['context.json']);
 const good=run(['--reuse',file,'--out',path.join(root,'collision-output')]);assert.equal(good.status,0,good.stderr);assert.deepEqual(fs.readFileSync(file),before);
});
test('report output cannot replace its input, including a hard-link alias',()=>{
 const report=save('report-input/report.md',input),before=fs.readFileSync(report);
 assert.throws(()=>flow.operation(['--input',report,'--out',path.dirname(report),'--report']),/覆盖/);
 const alias=path.join(root,'report-alias.json');fs.linkSync(report,alias);
 assert.throws(()=>flow.operation(['--input',alias,'--out',path.dirname(report),'--report']),/覆盖/);
 assert.deepEqual(fs.readFileSync(report),before);
});
test('equivalent partial defaults hit verified cache while a real birth-time change remains rejected',()=>{
 const same=structuredClone(input);same.options={bazi_day_boundary:'midnight'};
 const r=flow.operation(['--input',save('default.json',same),'--out',path.dirname(first.files.chart)]);
 assert.equal(r.cache_hit,true);assert.equal(r.calculation_performed,false);
 same.birth.time='14:00';assert.throws(()=>flow.operation(['--input',save('changed.json',same),'--out',path.dirname(first.files.chart),'--refresh']),/不同的计算输入/);
});
test('all adapter keys normalize defaults without performing a chart build',()=>{
 const chart=fixture('input.json'),rel=fixture('relationship-single-input.json'),tc=fixture('time-compare-unknown-input.json'),div=fixture('liuyao-input.json');
 const pairs=[
  [chart,{...chart,options:{...chart.options,bazi_hour_stem_rule:'day_stem'}}],
  [rel,{...rel,options:{...rel.options,partner_star_model:rel.options?.partner_star_model??'auto'}}],
  [tc,{...tc,birth_options:{...tc.birth_options,bazi_day_boundary:'midnight'}}],
  [div,{...div,options:{...div.options,day_boundary:'midnight'}}]
 ];
 const modules=['engine.cjs','relationship.cjs','time-compare.cjs','divination.cjs'].map(n=>require('../scripts/'+n));
 const originals=modules.map(m=>m.build);for(const m of modules)m.build=()=>{throw Error('key calculation built a chart');};
 try{for(const [a,b] of pairs)assert.equal(core.calculationKey(a),core.calculationKey(b));}
 finally{modules.forEach((m,i)=>{m.build=originals[i];});}
 const invalid=structuredClone(input);invalid.options={bazi_day_boundary:'unknown'};assert.throws(()=>core.calculationKey(invalid),/bazi_day_boundary/);
});
test('39-candidate new calculation performs 78 base chart builds and no parameter-probe charts',()=>{
 const engine=require('../scripts/engine.cjs'),original=engine.build;let count=0;
 engine.build=(...args)=>{count++;return original(...args);};
 let built;try{built=core.buildAndValidate(fixture('time-compare-unknown-input.json'));}finally{engine.build=original;}
 assert.equal(built.data.candidates.filter(c=>c.status==='calculated').length,39);assert.equal(count,78);
});
test('single-pass nested validation still rejects re-signed candidate pillars and relationship evidence',()=>{
 const tc=require('../scripts/time-compare.cjs'),common=require('../scripts/common.cjs');
 const f=fixture('time-compare-candidates-input.json');f.chart_mode='bazi';const d=tc.build(f);
 const resign=o=>{delete o.checksum;o.checksum={algorithm:'sha256-canonical-json',value:common.digest(o)};};
 for(const mutation of [c=>{c.people[0].chart.bazi.chart.pillars[2].ganzhi='甲子';resign(c.people[0].chart);},c=>{c.age_relation.predictions[0].tendency='forged';}]){
  const bad=structuredClone(d);mutation(bad.candidates[0].chart);resign(bad.candidates[0].chart);resign(bad);
  assert.throws(()=>tc.validateArtifact(bad),/重算不一致/);
 }
});
test('two real processes cannot publish different people into the same new task',async()=>{
 const task=path.join(root,'parallel'),ready=path.join(root,'ready'),finish=path.join(root,'finish');
 const worker=path.join(root,'worker.cjs');
 fs.writeFileSync(worker,`const fs=require('node:fs');const core=require(${JSON.stringify(require.resolve('../scripts/runtime-core.cjs'))});const flow=require(${JSON.stringify(require.resolve('../scripts/workflow.cjs'))});const original=core.buildAndValidate;core.buildAndValidate=i=>{fs.writeFileSync(process.argv[4],'ready');const a=new Int32Array(new SharedArrayBuffer(4));while(!fs.existsSync(process.argv[5]))Atomics.wait(a,0,0,10);return original(i);};flow.main(['--input',process.argv[2],'--out',process.argv[3]]);`);
 const child=cp.spawn(process.execPath,[worker,source,task,ready,finish]);let stdout='',stderr='';child.stdout.on('data',s=>stdout+=s);child.stderr.on('data',s=>stderr+=s);
 const ended=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code));});
 try{
  const deadline=Date.now()+10000;while(!fs.existsSync(ready)){assert.ok(Date.now()<deadline,'worker did not acquire the lock');await new Promise(r=>setTimeout(r,20));}
  const other=structuredClone(input);other.birth.time='14:00';const temp=save('busy-temp.json',other);
  const b=run(['--temp-input',temp,'--out',task]);assert.equal(b.status,2);assert.equal(JSON.parse(b.stderr).type,'task_busy');assert.equal(fs.existsSync(temp),false);
  fs.writeFileSync(finish,'done');assert.equal(await ended,0,stderr);assert.equal(JSON.parse(stdout).ok,true);
  assert.equal(core.readJson(path.join(task,'chart.json')).input.birth.time,'12:00');assert.equal(fs.existsSync(path.join(task,locks.LOCK)),false);
  assert.throws(()=>flow.operation(['--input',save('parallel-other.json',other),'--out',task]),/不同的计算输入/);
 }finally{if(!fs.existsSync(finish))fs.writeFileSync(finish,'done');await ended;}
});
test('dead-owner locks recover; validation errors and partial lock acquisition release owned locks',()=>{
 const stopped=cp.spawnSync(process.execPath,['-e','process.exit(0)']);assert.ifError(stopped.error);assert.ok(stopped.pid);
 const dir=path.join(root,'stale');fs.mkdirSync(dir);const lock=path.join(dir,locks.LOCK);
 fs.writeFileSync(lock,JSON.stringify({hostname:os.hostname(),pid:stopped.pid,token:'abandoned'}));
 assert.equal(flow.operation(['--input',source,'--out',dir]).ok,true);assert.equal(fs.existsSync(lock),false);
 const invalid=path.join(root,'failure'),bad=save('bad.json',{...input,birth:{...input.birth,date:'2000-02-30'}});
 assert.throws(()=>flow.operation(['--input',bad,'--out',invalid]));assert.equal(fs.existsSync(path.join(invalid,locks.LOCK)),false);
 const a=path.join(root,'lock-a'),b=path.join(root,'lock-b');const unlock=locks.acquireTaskLocks([b]);
 try{assert.throws(()=>locks.acquireTaskLocks([a,b]),e=>e.code==='task_busy');assert.equal(fs.existsSync(path.join(a,locks.LOCK)),false);}
 finally{unlock();}
});
test('CLI publishes one context whose final bytes and temporary-input status equal stdout',()=>{
 const worker=path.join(root,'write-count.cjs'),counter=path.join(root,'writes.json'),temp=save('once-temp.json',input),out=path.join(root,'once');
 fs.writeFileSync(worker,`const fs=require('node:fs');const core=require(${JSON.stringify(require.resolve('../scripts/runtime-core.cjs'))});let count=0;const write=core.atomicJson;core.atomicJson=(f,d)=>{if(f.endsWith('context.json'))count++;return write(f,d);};require(${JSON.stringify(cli)}).main(process.argv.slice(3));fs.writeFileSync(process.argv[2],JSON.stringify({count}));`);
 const r=cp.spawnSync(process.execPath,[worker,counter,'--temp-input',temp,'--out',out],{encoding:'utf8'});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);
 assert.equal(core.readJson(counter).count,1);assert.equal(fs.existsSync(temp),false);
 const response=JSON.parse(r.stdout);assert.equal(response.temporary_input_removed,true);assert.equal(response.output.bytes,Buffer.byteLength(r.stdout));assert.deepEqual(core.readJson(response.files.context),response);
});
