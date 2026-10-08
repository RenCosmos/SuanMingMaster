'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const BASELINE=read(path.join(__dirname,'compatibility-baseline-v1.2.4.json'));
const REVIEWED=read(path.join(__dirname,'reviewed-changes-v1.3.1.json'));
function protectedFiles(root=ROOT){
 const packageContract=read(path.join(root,'package.json'));delete packageContract.version;
 const expectedPackage=structuredClone(BASELINE.package_contract);Object.assign(expectedPackage.scripts,REVIEWED.package_scripts);
 assert.deepEqual(packageContract,expectedPackage,'package contract/dependencies changed');
 let count=0,reviewed=0,reviewedInterfaces=0;
 for(const ledger of [BASELINE.protected_sha256,read(path.join(__dirname,'knowledge-baseline.json')),read(path.join(__dirname,'runtime-dependency-baseline.json'))]){
  for(const [file,digest] of Object.entries(ledger)){
   const amendment=REVIEWED.files[file];if(amendment){assert.equal(amendment.old_sha256,digest,'frozen baseline must not be rewritten: '+file);reviewed++;if(ledger===BASELINE.protected_sha256)reviewedInterfaces++;}
   assert.equal(sha(fs.readFileSync(path.join(root,file))),amendment?.new_sha256??digest,'protected bytes changed: '+file);count++;
  }
 }
 for(const [file,e] of Object.entries(REVIEWED.files))assert.equal(sha(fs.readFileSync(path.join(root,file))),e.new_sha256,'reviewed change drift: '+file);
 return {protected_checks:count,protected_interfaces:Object.keys(BASELINE.protected_sha256).length,reviewed_changed_protected_files:reviewed,protected_files_byte_identical:Object.keys(BASELINE.protected_sha256).length-reviewedInterfaces,knowledge_files:113,dependency_files:435};
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
 if(['1.2.5','1.3.0'].includes(baseline)){
  for(const name of fs.readdirSync(path.join(oldRoot,'scripts'))){if(name==='workflow.cjs'&&baseline==='1.2.5')continue;const file=path.join(oldRoot,'scripts',name);if(!fs.statSync(file).isFile())continue;const e=REVIEWED.files['scripts/'+name];
   if(e){assert.equal(sha(fs.readFileSync(file)),e.old_sha256,'reviewed old script mismatch: '+name);assert.equal(sha(fs.readFileSync(path.join(currentRoot,'scripts',name))),e.new_sha256,'reviewed new script mismatch: '+name);}
   else{assert.deepEqual(fs.readFileSync(path.join(currentRoot,'scripts',name)),fs.readFileSync(file),'prior script changed: '+name);priorScripts++;}}
  for(const name of ['templates','folklore','curated','practice','spirit']){const rel='references/rikkahub-native/'+name+'.md';assert.equal(fs.readFileSync(path.join(currentRoot,rel),'utf8'),require('./religion-tone-review.cjs').rewriteText(fs.readFileSync(path.join(oldRoot,rel),'utf8')),'native overview outside reviewed wording changed: '+name);nativePages++;}
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
  const before=oldCore.buildAndValidate(input).data,actual=core.buildAndValidate(input).data;
  core.verify(before); // Real legacy artifacts remain readable, not just simulated labels.
  const after=require('../scripts/ziwei-conventions.cjs').alignLegacyMetadata(actual,before);
  assert.deepEqual(after,before,'calculation changed: '+name);
  assert.deepEqual(core.adapter(after).render(after),labelledReport(oldCore.adapter(before).render(before)),'report outside reviewed labels changed: '+name);reports++;
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
  const old=oldCore.buildAndValidate(input).data;assert.deepEqual(require('../scripts/ziwei-conventions.cjs').alignLegacyMetadata(core.buildAndValidate(input).data,old),old,'single engine: '+mode);
 }
 const knowledge=require(path.join(currentRoot,'scripts/knowledge.cjs')),legacy=require(path.join(oldRoot,'scripts/knowledge.cjs'));
 let topics=0;
 for(const catalog of require('./native-knowledge.cjs').GROUPS){
  for(const topic of read(path.join(currentRoot,catalog[2])).topics){preserves(require('./religion-tone-review.cjs').reviewedLegacy(legacy.lookup({topic:topic.slug})),knowledge.lookup({topic:topic.slug}));topics++;}
 }
 return {ok:true,baseline,...protection,prior_scripts_byte_identical:priorScripts,native_pages_byte_identical:0,native_pages_reviewed_wording:nativePages,calculation_cases:cases.length+2,context_projections:projections,report_variants:reports,full_knowledge_topics:topics,knowledge_comparison:"strict equality except exact reviewed religion wording and corresponding card SHA values",calculation_comparison:'strict equality after removing only absent new year-boundary labels and recomputing nested checksums',report_comparison:'strict equality except exact reviewed year-boundary labels',legacy_artifacts_reverified:true};
}
function labelledReport(r){
 function update(s){
  for(const year of ['lichun','lunar_new_year']){
   s=s.replaceAll('| 换年口径 | '+year+' |','| 本命年界 | '+year+' |\n| 运限年界 | lunar_new_year |\n| 运限月界 | lunar_month |');
   s=s.replaceAll('<tr><td>换年口径</td><td>'+year+'</td></tr>','<tr><td>本命年界</td><td>'+year+'</td></tr><tr><td>运限年界</td><td>lunar_new_year</td></tr><tr><td>运限月界</td><td>lunar_month</td></tr>');
  }
  return s.replaceAll('换年按所选紫微配置','运限年界：lunar_new_year；非本命年界参数');
 }
 return {markdown:update(r.markdown),html:update(r.html)};
}
if(require.main===module){
 try{const root=process.argv[2];console.log(JSON.stringify(root?compare(path.resolve(root)): {ok:true,...protectedFiles()}));}
 catch(e){console.error(e.stack);process.exitCode=2;}
}
module.exports={protectedFiles,preserves,compare,BASELINE};
