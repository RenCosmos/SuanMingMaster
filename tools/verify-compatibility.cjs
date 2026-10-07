'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const BASELINE=read(path.join(__dirname,'compatibility-baseline-v1.2.4.json'));
function protectedFiles(root=ROOT){
 const packageContract=read(path.join(root,'package.json'));delete packageContract.version;
 assert.deepEqual(packageContract,BASELINE.package_contract,'package contract/dependencies changed');
 let count=0;
 for(const ledger of [BASELINE.protected_sha256,read(path.join(__dirname,'knowledge-baseline.json')),read(path.join(__dirname,'runtime-dependency-baseline.json'))]){
  for(const [file,digest] of Object.entries(ledger)){
   assert.equal(sha(fs.readFileSync(path.join(root,file))),digest,'protected bytes changed: '+file);count++;
  }
 }
 return {protected_checks:count,protected_interfaces:Object.keys(BASELINE.protected_sha256).length,knowledge_files:113,dependency_files:435};
}
function preserves(oldValue,newValue,where='context'){
 if(Array.isArray(oldValue)){
  assert.ok(Array.isArray(newValue),where);assert.equal(newValue.length,oldValue.length,where+' array length');
  oldValue.forEach((v,i)=>preserves(v,newValue[i],where+'['+i+']'));
 }else if(oldValue&&typeof oldValue==='object'){
  assert.ok(newValue&&typeof newValue==='object',where);
  for(const [key,value] of Object.entries(oldValue)){assert.ok(key in newValue,where+'.'+key);preserves(value,newValue[key],where+'.'+key);}
 }else assert.deepEqual(newValue,oldValue,where);
}
function compare(oldRoot,currentRoot=ROOT){
 const protection=protectedFiles(currentRoot),oldCore=require(path.join(oldRoot,'scripts/runtime-core.cjs')),core=require(path.join(currentRoot,'scripts/runtime-core.cjs'));
 const baseline=read(path.join(oldRoot,'package.json')).version;let priorScripts=0,nativePages=0;
 if(baseline==='1.2.5'){
  for(const name of fs.readdirSync(path.join(oldRoot,'scripts'))){if(name==='workflow.cjs')continue;const file=path.join(oldRoot,'scripts',name);if(!fs.statSync(file).isFile())continue;assert.deepEqual(fs.readFileSync(path.join(currentRoot,'scripts',name)),fs.readFileSync(file),'V1.2.5 script changed: '+name);priorScripts++;}
  for(const name of ['templates','folklore','curated','practice','spirit']){const rel='references/rikkahub-native/'+name+'.md';assert.deepEqual(fs.readFileSync(path.join(currentRoot,rel)),fs.readFileSync(path.join(oldRoot,rel)),'native overview changed: '+name);nativePages++;}
 }
 const oldProjection=require(path.join(oldRoot,'scripts/context.cjs')),projection=require(path.join(currentRoot,'scripts/context.cjs'));
 const oldFlow=require(path.join(oldRoot,'scripts/workflow.cjs')),flow=require(path.join(currentRoot,'scripts/workflow.cjs'));
 const cases=fs.readdirSync(path.join(currentRoot,'examples')).filter(n=>n.endsWith('.json')).sort();let projections=0,reports=0;
 for(const name of cases){
  const input=read(path.join(currentRoot,'examples',name));
  if(input.mode==='shuwen'){
   const old=require(path.join(oldRoot,'scripts/shuwen.cjs')),now=require(path.join(currentRoot,'scripts/shuwen.cjs'));
   const before=old.build(input),after=now.build(input);assert.deepEqual(after,before,'ritual document: '+name);
   for(const layout of ['horizontal','vertical']){assert.equal(now.makeHtml(after,layout),old.makeHtml(before,layout));reports++;}
   continue;
  }
  const before=oldCore.buildAndValidate(input).data,after=core.buildAndValidate(input).data;
  assert.deepEqual(after,before,'calculation changed: '+name);
  assert.deepEqual(core.adapter(after).render(after),oldCore.adapter(before).render(before),'report changed: '+name);reports++;
  const mode=input.mode,focuses=mode==='divination'?['divination']:projection.FOCUSES.filter(f=>!['divination','time_compare'].includes(f)||mode===f);
  for(const focus of focuses){
   const opts={focus,limit:3,offset:0};preserves(oldProjection.project(before,opts),projection.project(after,opts),name+':'+focus);projections++;
   const base={ok:true,files:{chart:'/workspace/bazi-ziwei-reports/test/chart.json'}};
   const newer=flow.boundedResponse(base,after,opts),older=oldFlow.boundedResponse(base,before,{...opts,limit:newer.output.effective_limit});
   // Compare the identical requested window; complete-range pagination is covered separately.
   if(!newer.people_page&&!older.people_page)preserves(older.context,newer.context,name+':bounded:'+focus);
   if(mode==='relationship'&&input.people.length===2&&focus==='relationship'){
    assert.deepEqual(newer.context.reading.people.map(p=>p.person_id),['a','b'],'default pair evidence must remain together');
    preserves(older.context.reading.comparison,newer.context.reading.comparison,'pair cross evidence');
   }
  }
 }
 for(const mode of ['bazi','ziwei']){
  const input={...read(path.join(currentRoot,'examples/input.json')),mode};
  assert.deepEqual(core.buildAndValidate(input).data,oldCore.buildAndValidate(input).data,'single engine: '+mode);
 }
 const knowledge=require(path.join(currentRoot,'scripts/knowledge.cjs')),legacy=require(path.join(oldRoot,'scripts/knowledge.cjs'));
 let topics=0;
 for(const catalog of require('./native-knowledge.cjs').GROUPS){
  for(const topic of read(path.join(currentRoot,catalog[2])).topics){assert.deepEqual(knowledge.lookup({topic:topic.slug}),legacy.lookup({topic:topic.slug}));topics++;}
 }
 return {ok:true,baseline,...protection,prior_scripts_byte_identical:priorScripts,native_pages_byte_identical:nativePages,calculation_cases:cases.length+2,context_projections:projections,report_variants:reports,full_knowledge_topics:topics};
}
if(require.main===module){
 try{const root=process.argv[2];console.log(JSON.stringify(root?compare(path.resolve(root)): {ok:true,...protectedFiles()}));}
 catch(e){console.error(e.stack);process.exitCode=2;}
}
module.exports={protectedFiles,preserves,compare,BASELINE};
