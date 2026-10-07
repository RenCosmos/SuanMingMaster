'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const core=require('../scripts/runtime-core.cjs'),flow=require('../scripts/workflow.cjs'),{project}=require('../scripts/context.cjs');
const {taskId,nextActions,failureFor}=require('../scripts/workflow-hints.cjs');
const native=require('../tools/native-knowledge.cjs'),compat=require('../tools/verify-compatibility.cjs');
const root=path.resolve(__dirname,'..'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-adaptation-'));
test.after(()=>{assert.ok(temporary.startsWith(path.resolve(os.tmpdir())+path.sep+'suanming-adaptation-'));fs.rmSync(temporary,{recursive:true,force:true});});
const input=name=>JSON.parse(fs.readFileSync(path.join(root,'examples',name),'utf8'));
const pair=core.buildAndValidate(input('relationship-pair-input.json')).data;
test('V1.2.4 engines, legacy CLI, rules, reports, knowledge and dependencies keep reviewed bytes',()=>{
 const r=compat.protectedFiles();assert.equal(r.protected_interfaces,78);assert.equal(r.knowledge_files,113);assert.equal(r.dependency_files,435);
 assert.equal(r.protected_checks,626);
});
test('five native fallback pages preserve all 93 catalog entries and exact source scope under host budget',()=>{
 const pages=native.pages();assert.equal(pages.reduce((n,p)=>n+p.topics,0),93);
 const skill=fs.readFileSync(path.join(root,'SKILL.md'),'utf8');
 for(let i=0;i<pages.length;i++){
  const p=pages[i],body=fs.readFileSync(path.join(root,p.path),'utf8');assert.equal(body,p.content);assert.ok(skill.includes(']('+p.path+')'));
  assert.ok(Buffer.byteLength(JSON.stringify({text:body}))<28*1024);
  const catalog=JSON.parse(fs.readFileSync(path.join(root,native.GROUPS[i][2]),'utf8'));
  for(const t of catalog.topics){
   assert.ok(body.includes(t.slug));assert.ok(body.includes(t.name));assert.ok(body.includes(t.url??t.repository??catalog.repository));
   if(t.tradition)assert.ok(body.includes(t.tradition));for(const limit of t.inference_limits??[])assert.ok(body.includes(limit));
  }
 }
});
test('native fallback can be read without loading any calculation dependencies or invoking shell',()=>{
 const files=native.pages().map(p=>path.join(root,p.path));
 const code='const M=require("node:module"),load=M._load;M._load=function(name,...args){if(!name.startsWith("node:"))throw Error("unexpected dependency: "+name);return load.call(this,name,...args)};const fs=require("node:fs");for(const f of '+JSON.stringify(files)+')if(!fs.readFileSync(f,"utf8").includes("概览"))throw Error("missing page");console.log("ok");';
 const r=cp.spawnSync(process.execPath,['-e',code],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'ok');
});
test('pair warnings are deduplicated with exact person attribution while cross-chart evidence remains',()=>{
 const r=flow.boundedResponse({ok:true,files:{chart:'/workspace/bazi-ziwei-reports/test/chart.json'}},pair,{focus:'relationship'});
 assert.deepEqual(r.context.reading.people.map(p=>p.person_id),['a','b']);assert.ok(r.context.reading.comparison.bazi.cross_relations.length);
 for(const p of pair.people)for(const message of p.chart.warnings){assert.ok(r.context.reading.warnings.some(w=>w.message===message&&w.person_ids.includes(p.id)));}
 const different=structuredClone(pair);different.people[0].chart.warnings.push('仅甲的复核警告');
 assert.deepEqual(project(different,{focus:'relationship'}).reading.warnings.find(w=>w.message==='仅甲的复核警告').person_ids,['a']);
 assert.deepEqual(project(different,{focus:'relationship',person:'a'}).reading.people[0].chart.warnings,different.people[0].chart.warnings);
});
test('intimacy retains real markers and null physiology without turning them into orientation or medical inference',()=>{
 const r=project(pair,{focus:'intimacy',person:'a'});const p=r.reading.people[0];
 assert.ok(r.interpretation_scope.includes('性取向'));assert.equal(p.intimacy.physiological_ability,null);assert.equal(p.intimacy.ability_score,null);
 assert.equal(p.intimacy.assessment_status,'symbolic_discussion_only');assert.ok(p.intimacy.bazi.ten_god_occurrences.length);assert.ok(p.chart.ziwei.primary_palaces.length);
});
test('task identity survives cached topic changes without global files or replacing the source chart',()=>{
 const file=path.join(temporary,'source.json'),dir=path.join(temporary,'task');fs.writeFileSync(file,JSON.stringify(input('input.json')));
 const first=flow.operation(['--input',file,'--out',dir]),before=fs.readFileSync(first.files.chart);
 const follow=flow.operation(['--reuse',first.files.chart,'--focus','wealth']);assert.equal(follow.task_id,first.task_id);
 assert.match(first.task_id,/^SM-[0-9a-f]{12}$/);assert.equal(follow.cache_hit,true);assert.equal(follow.calculation_performed,false);
 assert.notEqual(taskId({chart:path.join(temporary,'another/chart.json')}),first.task_id);
 assert.deepEqual(fs.readFileSync(first.files.chart),before);assert.deepEqual(fs.readdirSync(dir).sort(),['chart.json','context.json','validation.json']);
});
test('annual next-actions are executable selectors and preserve every year in the original 20-year capability',()=>{
 const raw=input('annual-relations-input.json');raw.options.annual_count=20;
 const d=core.buildAndValidate(raw).data,years=[];let offset=0;
 do{
  const r=flow.boundedResponse({ok:true},d,{focus:'annual',limit:2,offset}),page=r.context.reading.bazi.annual;
  years.push(...page.items.map(y=>y.lichun_cycle_year));
  if(page.next_offset===null)break;
  const action=r.next_actions.find(a=>a.action==='reuse'&&a.focus==='annual');assert.equal(action.offset,page.next_offset);offset=action.offset;
 }while(true);
 assert.deepEqual(years,d.bazi.chart.annual.map(y=>y.lichun_cycle_year));assert.equal(years.length,20);
});
test('uncomputed requested years explicitly ask for new calculation without changing or inventing data',()=>{
 const before=core.hash(pair),r=flow.boundedResponse({ok:true},pair,{focus:'annual',years:[2080,2082]});
 assert.ok(r.next_actions.some(a=>a.action==='new_calculation'&&a.reason==='annual_range_uncomputed'));
 for(const p of r.context.reading.people){assert.equal(p.chart.bazi.annual.returned,0);assert.equal(p.chart.bazi.annual.requested_range_computed,false);}
 assert.equal(core.hash(pair),before);
});
test('time-comparison next-actions preserve explicit field and variant paging',()=>{
 const d=core.buildAndValidate(input('time-compare-candidates-input.json')).data;
 const r=project(d,{focus:'time_compare',limit:1}),actions=nextActions(r);
 assert.ok(actions.some(a=>a.action==='reuse'&&a.offset===r.reading.fields.next_offset));
 const field=d.comparison.fields.find(f=>f.variants.length>1);assert.ok(field);
 const selected=project(d,{focus:'time_compare',field:field.id,limit:1});
 const variant=nextActions(selected).find(a=>a.field===field.id);assert.equal(variant.variant_offset,1);
 const expanded=project(d,{focus:variant.focus,field:variant.field,variant_offset:variant.variant_offset,limit:1});
 assert.deepEqual(expanded.reading.fields.items[0].variants[0].value,field.variants[1].value);
});
test('person continuation uses explicitly returned next_person, never auto-selects another person',()=>{
 const context=project(pair,{focus:'relationship',person:'a'}),actions=nextActions(context,{next_person:'b'});
 assert.deepEqual(actions[0],{focus:'relationship',limit:3,action:'reuse',person:'b'});
 assert.equal(nextActions(project(pair,{focus:'relationship'})).some(a=>a.person),false);
});
test('next-actions preserve requested years and effective page size for annual and uncertain-time follow-ups',()=>{
 const uncertainInput=input('time-compare-candidates-input.json');
 uncertainInput.target_date='2026-10-06';uncertainInput.birth_options={annual_count:8};
 const uncertain=core.buildAndValidate(uncertainInput).data;
 const context=project(uncertain,{focus:'annual',years:[2026,2027],limit:1});
 const actions=nextActions(context).filter(a=>a.action==='reuse');assert.ok(actions.length);
 for(const next of actions){
  assert.deepEqual(next.years,[2026,2027]);assert.equal(next.limit,1);
  const {action,...selectors}=next,expanded=project(uncertain,selectors);
  assert.deepEqual(expanded.selection.years,[2026,2027]);assert.equal(expanded.selection.limit,1);
 }
 const raw=input('annual-relations-input.json');raw.target_date='2026-10-06';raw.options.annual_count=8;
 const ordinary=project(core.buildAndValidate(raw).data,{focus:'annual',years:[2027,2029],limit:1});
 const next=nextActions(ordinary).find(a=>a.action==='reuse');assert.ok(next);
 assert.deepEqual(next.years,[2027,2029]);assert.equal(next.limit,1);assert.equal(next.offset,1);
});
test('recovery keeps old error fields and distinguishes busy, bad input, missing file and corruption',()=>{
 const cases=[['task_busy','wait_or_select_new_task',1],['context_budget_exceeded','narrow_context_and_reuse',0],['cleanup_error','inspect_preserved_input',0],['ENOENT','select_existing_task_or_input',0]];
 for(const [code,action,retry] of cases){const e=new Error('test');e.code=code;const r=failureFor(e);assert.equal(r.ok,false);assert.equal(r.type,code);assert.equal(r.error,'test');assert.equal(r.recovery.action,action);assert.equal(r.recovery.retry_limit,retry);}
 assert.equal(failureFor(new Error('目录已有不同的计算输入')).recovery.action,'use_new_task_directory');
 assert.equal(failureFor(new Error('计算结果校验和不匹配')).recovery.action,'restore_or_recalculate_from_original_input');
 assert.equal(failureFor(new Error('输入格式无效')).recovery.retry_limit,0);
});
test('real CLI errors stay on stderr as one JSON object with exit code 2 and bounded recovery hints',()=>{
 const r=cp.spawnSync(process.execPath,[path.join(root,'scripts/workflow.cjs'),'--reuse',path.join(temporary,'missing/chart.json')],{encoding:'utf8'});
 assert.equal(r.status,2);assert.equal(r.stdout,'');const error=JSON.parse(r.stderr);assert.equal(error.type,'ENOENT');assert.equal(error.recovery.retry_limit,0);
 assert.equal(error.recovery.action,'select_existing_task_or_input');assert.ok(Buffer.byteLength(r.stderr)<1024);
});
test('host JSON wrapper stays below original budgets with additive hints and real pair evidence',()=>{
 const base={ok:true,workflow_version:'1.2.5',adapter_id:'relationship',cache_hit:false,calculation_performed:true,validation:{ok:true,method:'recalculated',recalculated:true},files:{chart:'/workspace/bazi-ziwei-reports/test/chart.json',context:'/workspace/bazi-ziwei-reports/test/context.json',validation:'/workspace/bazi-ziwei-reports/test/validation.json'},report_generated:false};
 const r=flow.boundedResponse(base,pair,{focus:'relationship'}),stdout=JSON.stringify(r)+'\n';
 const outer={exitCode:0,stdout,stderr:'',timedOut:false};assert.equal(typeof outer.stdout,'string');assert.equal(JSON.parse(outer.stdout).validation.ok,true);
 assert.ok(Buffer.byteLength(stdout)<=20*1024);assert.ok(Buffer.byteLength(JSON.stringify(outer))<28*1024);
 assert.deepEqual(r.context.reading.people.map(p=>p.person_id),['a','b']);
});
