'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const core=require('../scripts/runtime-core.cjs'),flow=require('../scripts/workflow.cjs'),{project}=require('../scripts/context.cjs');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-v120-'));
test.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
const fixture=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../examples',name),'utf8'));
const input=fixture('input.json'),task=path.join(temporary,'primary'),inputFile=path.join(temporary,'source.json');
fs.writeFileSync(inputFile,JSON.stringify(input));
const first=flow.operation(['--input',inputFile,'--out',task]);
const data=core.readJson(first.files.chart);
function limited(response){
 const stdout=JSON.stringify(response)+'\n';
 assert.ok(Buffer.byteLength(stdout)<=20*1024);
 assert.ok(Buffer.byteLength(JSON.stringify({stdout}))<28*1024);
 assert.equal(response.output.bytes,Buffer.byteLength(stdout));
 assert.equal(response.context.source_checksum,data.checksum.value);
}
test('one invocation builds, recalculates, validates and returns bounded core; reports absent',()=>{
 assert.equal(first.validation.ok,true);assert.equal(first.validation.recalculated,true);assert.equal(first.cache_hit,false);assert.equal(first.calculation_performed,true);
 assert.deepEqual(fs.readdirSync(task).sort(),['chart.json','context.json','validation.json']);
 assert.ok(Buffer.byteLength(JSON.stringify(data,null,2))>32*1024);limited(first);
 assert.deepEqual(core.readJson(first.files.context),first);
});
test('same input and follow-up never call build, expensive verify or self-test',()=>{
 const build=core.buildAndValidate,verify=core.verify;
 core.buildAndValidate=()=>{throw new Error('cache unexpectedly rebuilt');};core.verify=()=>{throw new Error('cache unexpectedly reverified');};
 try{
  for(const args of [['--input',inputFile,'--out',task],['--reuse',first.files.chart,'--focus','career']]){
   const r=flow.operation(args);assert.equal(r.cache_hit,true);assert.equal(r.validation.recalculated,false);assert.equal(r.calculation_performed,false);limited(r);
  }
 }finally{core.buildAndValidate=build;core.verify=verify;}
});
test('theme projection matches source facts across all ordinary focuses',()=>{
 for(const focus of ['core','career','wealth','relationship','annual','age_relation','partner_image','intimacy']){
  const r=flow.operation(['--reuse',first.files.chart,'--focus',focus]);limited(r);
  assert.deepEqual(r.context.reading.bazi.pillars,data.bazi.chart.pillars);
  assert.equal(r.context.reading.bazi.theory_evidence.month_command.branch,data.bazi.calculations.theory_evidence.month_command.branch);
 }
});
test('annual pages preserve hidden gods, spouse relations and pre-existing group state',()=>{
 const input=fixture('annual-relations-input.json'),a=core.adapter(input).load().build(input);
 let offset=0,years=[];
 do{
  const r=flow.boundedResponse({ok:true},a,{focus:'annual',offset,limit:3}),p=r.context.reading.bazi.annual;
  for(const row of p.items){
   const original=a.bazi.chart.annual.find(y=>y.id===row.id);years.push(row.lichun_cycle_year);
   assert.deepEqual(row.hidden_ten_gods,original.hidden_ten_gods);
   assert.equal(row.pillar_relations.length,original.pillar_relations.length);
   assert.equal(row.day_branch_relations.length,original.day_branch_relations.length);
   for(const relation of row.pillar_relations){const source=original.pillar_relations.find(x=>x.id===relation.id);assert.equal(relation.group_state,source.group_state);assert.equal(relation.touches_day_branch,source.touches_day_branch);assert.deepEqual(relation.pillars,source.pillars);}
  }
  offset=p.next_offset;
 }while(offset!==null);
 assert.deepEqual(years,a.bazi.chart.annual.map(y=>y.lichun_cycle_year));
 const p=project(a,{focus:'annual',years:[2080,2082]}).reading.bazi.annual;
 assert.equal(p.total,0);assert.equal(p.requested_range_computed,false);
});
test('changed calculation input cannot overwrite task; presentation labels may change',()=>{
 const changed=structuredClone(input);changed.birth.time='13:00';const file=path.join(temporary,'changed.json');fs.writeFileSync(file,JSON.stringify(changed));
 assert.throws(()=>flow.operation(['--input',file,'--out',task]),/不同的计算输入/);
 const rel=fixture('relationship-single-input.json'),out=path.join(temporary,'rel-cache');fs.writeFileSync(file,JSON.stringify(rel));
 flow.operation(['--input',file,'--out',out]);rel.question='另一个问题';rel.label='不同标签';rel.context.narrative='新的叙述';fs.writeFileSync(file,JSON.stringify(rel));
 assert.equal(flow.operation(['--input',file,'--out',out]).cache_hit,true);
 rel.context.topics=['marriage'];fs.writeFileSync(file,JSON.stringify(rel));
 assert.throws(()=>flow.operation(['--input',file,'--out',out]),/不同的计算输入/);
});
test('file checksum tampering is rejected, even when the artifact is re-signed',()=>{
 const out=path.join(temporary,'tampered');fs.mkdirSync(out);const altered=structuredClone(data),file=path.join(out,'chart.json');
 altered.bazi.chart.pillars[2].ganzhi='甲子';core.atomicJson(file,altered);
 assert.throws(()=>flow.operation(['--reuse',file]),/校验和不匹配/);
 const {checksum,...payload}=altered;altered.checksum={...checksum,value:core.hash(payload)};core.atomicJson(file,altered);
 assert.throws(()=>flow.operation(['--reuse',file]),/重算不一致/);
});
test('stale fingerprint and absent receipt force one full validation, then reuse',()=>{
 const out=path.join(temporary,'legacy');fs.mkdirSync(out);const file=path.join(out,'chart.json');core.atomicJson(file,data);
 const first=flow.operation(['--reuse',file]);assert.equal(first.cache_hit,false);assert.equal(first.validation.recalculated,true);
 assert.equal(flow.operation(['--reuse',file]).cache_hit,true);
 const receiptFile=path.join(out,'validation.json'),receipt=core.readJson(receiptFile);receipt.fingerprint='old';const {checksum,...payload}=receipt;receipt.checksum=core.hash(payload);core.atomicJson(receiptFile,receipt);
 assert.equal(flow.operation(['--reuse',file]).validation.recalculated,true);
});
test('explicit refresh builds and verifies despite a valid cache',()=>{
 const r=flow.operation(['--input',inputFile,'--out',task,'--refresh']);assert.equal(r.calculation_performed,true);assert.equal(r.cache_hit,false);assert.equal(r.validation.recalculated,true);
});
test('stdin leaves no input file and temporary input is removed on success or failure',()=>{
 const file=path.join(temporary,'temp-input.json'),out=path.join(temporary,'temp-chart');fs.writeFileSync(file,JSON.stringify(input));
 let r=flow.operation; // lifecycle applies at the CLI/main boundary, not pure operation.
 const cli=path.join(__dirname,'../scripts/workflow.cjs');
 let child=cp.spawnSync(process.execPath,[cli,'--temp-input',file,'--out',out],{encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);assert.equal(fs.existsSync(file),false);assert.equal(JSON.parse(child.stdout).temporary_input_removed,true);
 fs.writeFileSync(file,'invalid json');child=cp.spawnSync(process.execPath,[cli,'--temp-input',file,'--out',path.join(temporary,'invalid')],{encoding:'utf8'});
 assert.equal(child.status,2);assert.equal(fs.existsSync(file),false);
 child=cp.spawnSync(process.execPath,[cli,'--stdin','--out',path.join(temporary,'stdin')],{encoding:'utf8',input:JSON.stringify(input)});
 assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout).ok,true);
 assert.deepEqual(fs.readdirSync(path.join(temporary,'stdin')).sort(),['chart.json','context.json','validation.json']);
});
test('new result files and skill directory cannot be treated as temporary input or outputs',()=>{
 const {withInputLifecycle}=require('../scripts/input-lifecycle.cjs');
 for(const name of ['context.json','validation.json','brief.json']){
  const file=path.join(temporary,name);fs.writeFileSync(file,'{}');assert.throws(()=>withInputLifecycle(['--temp-input',file],()=>({ok:true})),/结果文件/);assert.equal(fs.existsSync(file),true);
 }
 assert.throws(()=>flow.operation(['--input',inputFile,'--out',path.join(__dirname,'../unsafe-output')]),/技能包/);
});
test('pair relationship default keeps both people and actual cross-chart relations within budget',()=>{
 const a=core.adapter({mode:'relationship'}).load().build(fixture('relationship-pair-input.json'));
 const base={ok:true,workflow_version:'1.2.0',files:{chart:'/workspace/bazi-ziwei-reports/synthetic/chart.json',context:'/workspace/bazi-ziwei-reports/synthetic/context.json',validation:'/workspace/bazi-ziwei-reports/synthetic/validation.json'}};
 const r=flow.boundedResponse(base,a,{focus:'relationship'});
 assert.deepEqual(r.context.reading.people.map(p=>p.person_id),['a','b']);
 assert.deepEqual(r.context.reading.comparison.bazi.cross_relations.map(r=>r.id),a.comparison.bazi.cross_relations.map(r=>r.id));
 assert.ok(Buffer.byteLength(JSON.stringify(r))<=20*1024);
});
test('relationship calls and projection default to spouse evidence; explicit core and cached follow-ups remain available',()=>{
 const file=path.join(temporary,'default-relationship-input.json'),out=path.join(temporary,'default-relationship');
 fs.writeFileSync(file,JSON.stringify(fixture('relationship-single-input.json')));
 const r=flow.operation(['--input',file,'--out',out]),saved=core.readJson(r.files.chart);
 assert.equal(r.context.focus,'relationship');
 assert.ok(r.context.reading.people[0].chart.ziwei.primary_palaces.some(p=>p.name.replace(/宫$/,'')==='夫妻'));
 assert.deepEqual(r.context.reading.people[0].relationship_bazi.spouse_palace,saved.profiles[0].bazi.spouse_palace);
 assert.equal(project(saved).focus,'relationship');
 const cached=flow.operation(['--reuse',r.files.chart]);assert.equal(cached.cache_hit,true);assert.equal(cached.context.focus,'relationship');assert.equal(cached.validation.recalculated,false);
 const explicit=flow.operation(['--reuse',r.files.chart,'--focus','core']);assert.equal(explicit.context.focus,'core');assert.equal(explicit.cache_hit,true);
});
test('uncertain-time summary preserves all field statuses; candidate expansion matches source',()=>{
 const a=core.adapter({mode:'time_compare'}).load().build(fixture('time-compare-unknown-input.json'));
 const r=flow.boundedResponse({ok:true},a,{focus:'time_compare'});
 assert.ok(Buffer.byteLength(JSON.stringify(a,null,2))>1024*1024);
 assert.ok(Buffer.byteLength(JSON.stringify(r))<20*1024);
 const expected=a.comparison.fields.filter(f=>!f.id.startsWith('TC-BZ-ANNUAL-'));
 assert.equal(r.context.reading.field_index.length,expected.length);
 for(const field of r.context.reading.field_index)assert.equal(field.status,expected.find(f=>f.id===field.id).status);
 const candidate=a.candidates.find(c=>c.status==='calculated');
 const expanded=project(a,{focus:'core',candidate:candidate.id});
 assert.deepEqual(expanded.reading.reading.people[0].chart.bazi.pillars,candidate.chart.people[0].chart.bazi.chart.pillars);
 const f=expected.find(f=>f.variants.length>1);
 if(f){const p=project(a,{focus:'time_compare',field:f.id,variant_offset:1,limit:1}).reading.fields.items[0];assert.deepEqual(p.variants[0].value,f.variants[1].value);}
});
test('divination context preserves six line values, moving lines and calendar ledger',()=>{
 const a=core.adapter({mode:'divination'}).load().build(fixture('liuyao-input.json')),r=project(a,{focus:'divination'});
 assert.deepEqual(r.reading.chart.lines,a.chart.lines);assert.deepEqual(r.reading.calculations.line_ledger,a.calculations.line_ledger);
 assert.throws(()=>project(data,{focus:'divination'}),/不匹配/);
});
test('reports are only rendered explicitly, default follow-up writes no report',()=>{
 assert.equal(fs.existsSync(path.join(task,'report.md')),false);
 const r=flow.operation(['--reuse',first.files.chart,'--report']);assert.equal(r.report_generated,true);assert.ok(fs.readFileSync(r.files.report_md,'utf8').length>0);
});
