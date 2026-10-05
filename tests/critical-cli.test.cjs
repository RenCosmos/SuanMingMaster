'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const core=require('../scripts/runtime-core.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-critical-'));
test.after(()=>{assert.ok(tmp.startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(tmp,{recursive:true,force:true});});
const mobile=path.join(__dirname,'../scripts/mobile.sh');
const input={mode:'bazi',birth:{calendar:'solar',date:'1994-02-13',time:'09:15',gender:'female',timezone:'Asia/Shanghai'},target_date:'2029-06-01',options:{annual_count:20}};
const task=path.join(tmp,'annual'),chart=path.join(task,'chart.json');
function shell(args,inputText,extraEnv={}){
 const sh=process.env.SUANMING_TEST_SH||'sh',env={...process.env};
 const originalPath=process.env.PATH||process.env.Path||'';
 for(const key of Object.keys(env))if(key.toUpperCase()==='PATH')delete env[key];
 env.PATH=[path.dirname(process.execPath),...(path.isAbsolute(sh)?[path.dirname(sh)]:[]),originalPath].join(path.delimiter);
 Object.assign(env,extraEnv);
 const shellPath=s=>process.platform==='win32'&&/^[a-z]:[\\/]/i.test(s)?s.replaceAll('\\','/'):s;
 const r=cp.spawnSync(sh,[shellPath(mobile),...args.map(shellPath)],{cwd:tmp,encoding:'utf8',input:inputText,timeout:30000,maxBuffer:128*1024,env});
 assert.ifError(r.error);return r;
}
function successful(r){assert.equal(r.status,0,r.stderr||r.stdout);const data=JSON.parse(r.stdout);assert.equal(data.ok,true);return data;}
function bounded(r){assert.ok(Buffer.byteLength(r.stdout)<=20*1024);assert.ok(Buffer.byteLength(JSON.stringify({stdout:r.stdout}))<28*1024);}
test('mobile self-test returns individual critical results and leaves no input or result files',()=>{
 const before=fs.readdirSync(tmp),r=successful(shell(['--check','--self-test']));
 assert.equal(r.critical.passed,12);assert.equal(r.critical.total,12);assert.ok(r.critical.cases.every(c=>c.ok));
 assert.deepEqual(fs.readdirSync(tmp),before);
});
test('mobile self-test exits unsuccessfully when an engine fault is injected in a separate process',()=>{
 const preload=path.join(tmp,'fault.cjs'),modulePath=path.join(__dirname,'../scripts/engine.cjs');
 fs.writeFileSync(preload,'const engine=require('+JSON.stringify(modulePath)+');const original=engine.build;engine.build=i=>{const d=original(i);if(d.bazi)d.bazi.chart.pillars[2].ganzhi="甲子";return d;};');
 try{
  const r=shell(['--check','--self-test'],undefined,{NODE_OPTIONS:'--require="'+preload.replaceAll('\\','/')+'"'});
  assert.equal(r.status,2);const d=JSON.parse(r.stdout);assert.equal(d.ok,false);assert.equal(d.critical.cases.find(c=>c.id==='BZ-FIXED').ok,false);
 }finally{fs.unlinkSync(preload);}
});
test('real shell annual pagination keeps every year and fixed spouse evidence under host limits',()=>{
 let child=shell(['--stdin','--out',task,'--focus','annual','--limit','10'],JSON.stringify(input));
 let response=successful(child),years=[];assert.equal(response.validation.recalculated,true);
 do{
  bounded(child);const page=response.context.reading.bazi.annual;
  for(const y of page.items){
   years.push(y.lichun_cycle_year);
   if(y.lichun_cycle_year===2030){
    assert.equal(y.stem_ten_god,'比肩');assert.deepEqual(y.hidden_ten_gods,['偏印','劫财','正官']);
    const group=y.day_branch_relations.find(r=>r.type==='三合'&&r.symbols==='寅午戌');assert.ok(group);assert.ok(group.pillars.includes('BZ-DAY'));assert.equal(group.group_state,'natal_already_complete');
   }
  }
  if(page.next_offset===null)break;
  child=shell(['--reuse',chart,'--focus','annual','--offset',String(page.next_offset),'--limit','10']);response=successful(child);
  assert.equal(response.cache_hit,true);assert.equal(response.validation.recalculated,false);
 }while(true);
 assert.deepEqual(years,Array.from({length:20},(_,i)=>2029+i));
 assert.deepEqual(fs.readdirSync(task).sort(),['chart.json','context.json','validation.json']);
});
test('real shell cached follow-up preserves files and avoids calculation',()=>{
 const before=fs.readFileSync(chart),r=shell(['--reuse',chart,'--focus','relationship']);const d=successful(r);bounded(r);
 assert.equal(d.cache_hit,true);assert.equal(d.calculation_performed,false);assert.equal(d.validation.recalculated,false);
 assert.deepEqual(fs.readFileSync(chart),before);assert.equal(d.report_generated,false);
});
test('changed birth input is rejected without replacing the existing calculation',()=>{
 const before=fs.readFileSync(chart),changed=structuredClone(input);changed.birth.time='19:15';
 const r=shell(['--stdin','--out',task],JSON.stringify(changed));assert.equal(r.status,2);assert.equal(JSON.parse(r.stderr).ok,false);assert.deepEqual(fs.readFileSync(chart),before);
});
test('shell removes owned temporary input after success and malformed JSON failure',()=>{
 const file=path.join(tmp,'input.json'),out=path.join(tmp,'temporary');fs.writeFileSync(file,JSON.stringify(input));
 successful(shell(['--temp-input',file,'--out',out]));assert.equal(fs.existsSync(file),false);
 fs.writeFileSync(file,'invalid JSON');const badOut=path.join(tmp,'invalid');const r=shell(['--temp-input',file,'--out',badOut]);
 assert.equal(r.status,2);assert.equal(fs.existsSync(file),false);assert.equal(fs.existsSync(path.join(badOut,'chart.json')),false);
});
test('re-signed chart with missing spouse relations fails real CLI verification',()=>{
 const out=path.join(tmp,'tampered');fs.mkdirSync(out);
 const d=JSON.parse(fs.readFileSync(chart,'utf8'));d.bazi.chart.annual[1].day_branch_relations=[];
 const {checksum,...payload}=d;d.checksum={...checksum,value:core.hash(payload)};
 const target=path.join(out,'chart.json');fs.writeFileSync(target,JSON.stringify(d));
 fs.copyFileSync(path.join(task,'validation.json'),path.join(out,'validation.json'));
 const r=shell(['--reuse',target,'--focus','annual']);assert.equal(r.status,2);assert.equal(JSON.parse(r.stderr).ok,false);
 assert.equal(fs.existsSync(path.join(out,'context.json')),false);
});
test('direct knowledge CLI retrieves source identity without creating query files',()=>{
 const before=fs.readdirSync(tmp),r=successful(shell(['--knowledge','--query','如何增加桃花','--limit','1']));
 assert.equal(r.matches[0].slug,'practice-romance-yuelao');assert.ok(r.matches[0].source_url);assert.equal(r.matches[0].content,undefined);
 assert.deepEqual(fs.readdirSync(tmp),before);
});
