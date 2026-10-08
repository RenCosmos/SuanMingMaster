'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const batch=require('../scripts/partner-search-batch.cjs'),regular=require('../scripts/partner-search-workflow.cjs'),search=require('../scripts/partner-search.cjs'),workflow=require('../scripts/workflow.cjs'),core=require('../scripts/runtime-core.cjs'),budget=require('../scripts/output-budget.cjs');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-batch-test-'));
test.after(()=>{assert.ok(temp.startsWith(path.resolve(os.tmpdir())+path.sep+'suanming-batch-test-'));fs.rmSync(temp,{recursive:true,force:true});});
const base=()=>({mode:'partner_search_batch',self:{birth:{calendar:'solar',date:'1996-06-15',time:'12:00',gender:'male',timezone:'Asia/Shanghai'}},as_of:'2026-10-08',search:{type:'dates',start:'1997-06-01',end:'1997-06-30',time_uncertainty:{type:'unknown'}},ranking:'monthly_top',candidate_year_branch:'丑'});
const write=(name,data)=>{const file=path.join(temp,name);fs.writeFileSync(file,JSON.stringify(data));return file;};
function run(name,input=base()){return workflow.operation(['--partner-search','--batch','--input',write(name+'-input.json',input),'--out',path.join(temp,name)]);}
function reuse(result,extra=[]){return workflow.operation(['--partner-search','--batch','--reuse',result.files.chart,...extra]);}
function bounded(result){budget.assertFits(result,budget.WORKFLOW_BYTES);assert.equal(result.output.bytes,budget.measure(result).stdout_bytes);}
const first=run('basic'),manifest=core.readJson(first.files.chart),childFile=path.join(path.dirname(first.files.chart),manifest.jobs[0].chart),child=core.readJson(childFile);

test('batch plan handles leap February, clipped months and a 366-day ceiling',()=>{
 assert.deepEqual(batch.plan('2024-02-28','2024-03-02'),[{month:'2024-02',start:'2024-02-28',end:'2024-02-29'},{month:'2024-03',start:'2024-03-01',end:'2024-03-02'}]);
 assert.equal(batch.plan('2024-01-01','2024-12-31').length,12);assert.throws(()=>batch.plan('2024-01-01','2025-01-01'),/366/);
 assert.throws(()=>batch.plan('2011-02-30','2011-03-01'));assert.throws(()=>batch.plan('2011-03-01','2011-02-01'));
});
test('batch normalization keeps ANY, engine time sampling and explicit branch scope',()=>{
 const n=batch.normalizeInput(base());assert.equal(n.filters.match,'any');assert.equal(n.ranking,'monthly_top');assert.equal(n.search.time_uncertainty.type,'unknown');assert.equal(n.candidate_year_branch,'丑');
 const i=base();i.candidate_year_branch='兔';assert.throws(()=>batch.normalizeInput(i),/地支/);i.candidate_year_branch='丑';i.search.fake=1;assert.throws(()=>batch.normalizeInput(i),/字段/);
});
test('real batch stores byte-equivalent original-engine monthly artifacts',()=>{
 assert.equal(first.ok,true);assert.equal(first.validation.ok,true);assert.equal(first.context.computed_complete,true);assert.equal(manifest.partner_search_engine,'partner-search/1.0.1');
 assert.deepEqual(child,search.build(child.input));assert.equal(first.context.months[0].coverage.examined,child.coverage.examined);assert.equal(child.coverage.underage_excluded,0);bounded(first);
});
test('ranking monthly_top/global_top/all never changes the saved filters or input',()=>{
 const before=fs.readFileSync(childFile);const all=reuse(first,['--rank','all']);assert.equal(all.context.filters.match,'any');assert.ok(all.context.months[0].date_page.total>first.context.months[0].date_page.total);
 const global=reuse(first,['--rank','global_top']);assert.equal(global.context.ranking,'global_top');assert.deepEqual(fs.readFileSync(childFile),before);
});
test('monthly best is not the same query as requiring every condition',()=>{
 const all=base();all.search.start='1997-06-01';all.search.end='1997-06-03';all.filters={match:'all'};const strict=run('strict',all);
 const any={...all,filters:{match:'any'}};const top=run('short-top',any);assert.equal(strict.context.months[0].date_page.total,0);assert.ok(top.context.months[0].date_page.total>0);assert.equal(top.context.months[0].monthly_maximum,2);
});
test('date groups compare full relation signatures, not only risk category labels',()=>{
 const mk=(id,pillars,risk)=>({id,local_datetime:'2011-03-21T'+(id==='A'?'00:00:00':'12:00:00'),pillars:[{branch:'卯'}],full_bazi:['辛卯','辛卯','乙亥',pillars],evaluation:{matched_condition_count:4,matched_conditions:['A','B'],risk_relations:risk}});
 const stable={type:'地支六害',symbols:'申亥',pillars:['SELF-MONTH','CANDIDATE-DAY']};
 const data={candidates:[mk('A','丙子',[stable,{type:'地支六冲',symbols:'午子',pillars:['SELF-HOUR','CANDIDATE-HOUR']}]),mk('B','壬午',[stable,{type:'地支六冲',symbols:'子午',pillars:['SELF-YEAR','CANDIDATE-HOUR']}])]};
 const g=batch.groupDates(data,'卯').groups[0],row=batch.dateRow(g,'/workspace/test/batch.json','monthly_top');
 assert.equal(g.matching_samples,2);assert.deepEqual(row.sample_shared_risk_types,['地支六害']);assert.deepEqual(row.sample_conditional_risk_types,['地支六冲']);assert.equal(row.hour_variant_count,2);
});
test('a single date returns one group, not repeated first-hour points',()=>{
 const group=first.context.months[0].dates[0];assert.ok(group.matching_samples>1);assert.ok(group.hour_variant_count>1);assert.equal(first.context.candidate_birth_time_is_hypothetical,true);
 assert.ok(group.details.argv.includes('--batch'));assert.ok(group.details.argv.includes('--date'));assert.ok(group.sample_conditional_risk_types.length);
});
test('detail argv and all continuation argv enumerate exactly the date samples',()=>{
 const date=first.context.months[0].dates[0].date,expected=child.candidates.filter(c=>c.local_datetime.startsWith(date));
 let result=workflow.operation(first.context.months[0].dates[0].details.argv),ids=[];
 while(true){bounded(result);assert.equal(result.context.date_detail.selection.date,date);assert.equal(result.context.date_detail.birth_time_is_hypothetical,true);
  ids.push(...result.context.date_detail.candidates.items.map(c=>c.id));const next=result.next_actions.find(a=>a.argv.includes('--date'));if(!next)break;result=workflow.operation(next.argv);}
 assert.deepEqual(ids,expected.map(c=>c.id));assert.equal(new Set(ids).size,expected.length);
});
test('monthly date pagination is complete and preserves ranking selectors',()=>{
 let r=reuse(first,['--rank','all','--month','1997-06','--offset','0','--limit','3']),dates=[];
 while(true){bounded(r);dates.push(...r.context.months[0].dates.map(d=>d.date));const next=r.next_actions.find(a=>a.argv.includes('--month'));if(!next)break;assert.ok(next.argv.includes('all'));r=workflow.operation(next.argv);}
 const expected=batch.groupDates(child,'丑').groups.map(g=>g.date);assert.deepEqual(dates,expected);assert.equal(new Set(dates).size,expected.length);
});
test('trusted reuse does not recalculate, modify source bytes or repeat source text on continuation',()=>{
 const bytes=fs.readFileSync(childFile),result=reuse(first,['--rank','all','--month','1997-06','--offset','5','--limit','3']);
 assert.equal(result.cache_hit,true);assert.equal(result.calculation_performed,false);assert.equal(result.validation.recalculated,false);assert.equal(result.context.sources,undefined);assert.ok(result.context.source_ids.length);assert.deepEqual(fs.readFileSync(childFile),bytes);
});
test('partial tasks expose unfinished months and resume reuses completed months',()=>{
 const input=base();input.search.start='1997-06-30';input.search.end='1997-07-02';const old=regular.operation;
 let calls=0;regular.operation=(argv,options)=>{if(options?.rawInput&&++calls===2)throw new Error('synthetic transient failure');return old(argv,options);};
 let partial;try{partial=run('partial',input);}finally{regular.operation=old;}
 assert.equal(partial.ok,false);assert.equal(partial.partial,true);assert.equal(partial.validation.ok,false);assert.deepEqual(partial.context.progress.pending_months,['1997-07']);
 const saved=core.readJson(partial.files.chart),month=path.join(path.dirname(partial.files.chart),saved.jobs[0].chart),bytes=fs.readFileSync(month);
 const resumed=workflow.operation(partial.next_actions[0].argv);assert.equal(resumed.ok,true);assert.equal(resumed.context.progress.completed_months,2);assert.deepEqual(fs.readFileSync(month),bytes);
});
test('recovery manifest exists before the first month starts and a zero-job task resumes',()=>{
 const input=base();input.search.end='1997-06-02';
 const old=regular.operation,out=path.join(temp,'first-interruption'),file=path.join(out,'batch.json');
 let inspected=false;regular.operation=(argv,options)=>{
  if(options?.rawInput){const saved=batch.integrity(core.readJson(file));assert.equal(saved.complete,false);assert.equal(saved.jobs.length,0);inspected=true;throw new Error('synthetic first-month interruption');}
  return old(argv,options);
 };
 let partial;try{partial=run('first-interruption',input);}finally{regular.operation=old;}
 assert.equal(inspected,true);assert.equal(partial.ok,false);assert.equal(partial.context.progress.completed_months,0);
 assert.deepEqual(partial.context.progress.pending_months,['1997-06']);
 const resumed=workflow.operation(partial.next_actions[0].argv);assert.equal(resumed.ok,true);assert.equal(resumed.context.progress.completed_months,1);bounded(resumed);
});

test('same directory refuses different input and does not overwrite its manifest',()=>{
 const before=fs.readFileSync(first.files.chart),changed=base();changed.search.end='1997-06-29';
 assert.throws(()=>workflow.operation(['--partner-search','--batch','--input',write('changed.json',changed),'--out',path.dirname(first.files.chart)]),/不同批量输入/);
 assert.deepEqual(fs.readFileSync(first.files.chart),before);
});
test('batch output cannot overwrite an ordinary single-task context or input',()=>{
 const out=path.join(temp,'occupied');fs.mkdirSync(out);fs.writeFileSync(path.join(out,'context.json'),'preserve');
 assert.throws(()=>workflow.operation(['--partner-search','--batch','--input',write('occupied-input.json',base()),'--out',out]),/其他任务/);assert.equal(fs.readFileSync(path.join(out,'context.json'),'utf8'),'preserve');
 assert.throws(()=>workflow.operation(['--partner-search','--batch','--input',write('package-protection.json',base()),'--out',root]),/技能包/);
});
test('manifest integrity rejects signed path escapes and forged completion',()=>{
 const sign=data=>{const {checksum,...body}=data;return {...body,checksum:{algorithm:'sha256-canonical-json',value:core.hash(body)}};};
 const escaped=structuredClone(manifest);escaped.jobs[0].chart='../elsewhere/chart.json';assert.throws(()=>batch.integrity(sign(escaped)),/路径/);
 const incomplete=structuredClone(manifest);incomplete.complete=false;assert.throws(()=>batch.integrity(sign(incomplete)),/完整状态/);
 const bad=structuredClone(manifest);bad.input.search.end='1997-06-29';assert.throws(()=>batch.integrity(sign(bad)),/键不一致/);
});
test('changed month artifacts cannot reuse an old batch index',()=>{
 const r=run('tamper',{...base(),search:{...base().search,start:'1997-06-01',end:'1997-06-01'}}),m=core.readJson(r.files.chart),f=path.join(path.dirname(r.files.chart),m.jobs[0].chart);
 const original=fs.readFileSync(f),d=core.readJson(f);d.coverage.accepted++;const {checksum,...body}=d;d.checksum={algorithm:'sha256-canonical-json',value:core.hash(body)};fs.writeFileSync(f,JSON.stringify(d));
 assert.throws(()=>reuse(r),/不一致|改变|不可信/);fs.writeFileSync(f,original);
});
test('explicit year-branch scope excludes other branches without altering engine evidence',()=>{
 const input=base();input.search.start='2011-01-29';input.search.end='2011-02-08';input.candidate_year_branch='卯';input.filters={conditions:['partner_star_projection','day_stem_five_combine','spouse_branch_liuhe'],match:'any',year_gap:[-100,100]};
 const r=run('year-boundary',input),m=core.readJson(r.files.chart),d={candidates:m.jobs.flatMap(j=>core.readJson(path.join(path.dirname(r.files.chart),j.chart)).candidates)};
 const gs=batch.groupDates(d,'卯');assert.ok(gs.outside_scope_samples>0);assert.ok(d.candidates.some(c=>c.animal==='虎'));assert.ok(gs.groups.length>0);assert.ok(gs.groups.every(g=>[...g.year_pillars].every(p=>p.endsWith('卯'))));bounded(r);
});
test('temporary input is removed through the real mobile entry, including failure',()=>{
 const sh=process.env.SUANMING_TEST_SH;if(!sh)throw new Error('Set SUANMING_TEST_SH for mobile regression');
 for(const valid of [true,false]){const raw=base();raw.search.end=valid?'1997-06-02':'1998-06-02';const file=write('mobile-'+valid+'.json',raw);
  const r=cp.spawnSync(sh,[path.join(root,'scripts/mobile.sh'),'--agent','--temp-input',file,'--partner-search','--batch','--out',path.join(temp,'mobile-'+valid)],{encoding:'utf8',env:{...process.env,PATH:[path.dirname(process.execPath),path.dirname(sh),process.env.PATH].join(path.delimiter)}});
  assert.equal(fs.existsSync(file),false);assert.equal(r.status,valid?0:2,r.stderr);if(valid){const result=JSON.parse(r.stdout);assert.equal(result.temporary_input_removed,true);bounded(result);}}
});
test('manual self and young candidates remain accepted in batch mode',()=>{
 const i=base();i.self.birth.date='2010-01-01';i.search.start='2011-06-01';i.search.end='2011-06-02';i.candidate_year_branch='卯';delete i.filters;
 const one=run('young-birth',i),m=core.readJson(one.files.chart),d=core.readJson(path.join(path.dirname(one.files.chart),m.jobs[0].chart));
 i.self={pillars:d.self.pillars.map(p=>p.ganzhi),birth_year:2010};const two=run('young-manual',i);
 assert.equal(one.ok,true);assert.equal(two.ok,true);assert.deepEqual(one.context.months,two.context.months.map(x=>({...x,dates:x.dates.map((g,k)=>({...g,details:one.context.months[0].dates[k].details}))})));
});
test('explicit ordinary source-chart is verified once and never changed',()=>{
 const engine=require('../scripts/engine.cjs'),raw=base(),chart=engine.build({mode:'bazi',birth:raw.self.birth}),source=write('source-chart.json',chart),bytes=fs.readFileSync(source);
 delete raw.self;raw.search.end='1997-06-02';const r=workflow.operation(['--partner-search','--batch','--input',write('import-batch.json',raw),'--source-chart',source,'--out',path.join(temp,'imported')]);
 assert.equal(r.ok,true);assert.deepEqual(fs.readFileSync(source),bytes);assert.deepEqual(core.readJson(r.files.chart).input.self.birth,chart.input.birth);
});
test('locks and invalid selection do not permit silently incomplete success',()=>{
 const busyDir=path.join(temp,'busy');const unlock=require('../scripts/task-files.cjs').acquireTaskLocks([busyDir]);
 try{assert.throws(()=>workflow.operation(['--partner-search','--batch','--input',write('busy-input.json',base()),'--out',busyDir]),/正在使用/);}finally{unlock();}
 assert.throws(()=>reuse(first,['--month','1997-08']),/不在本任务/);assert.throws(()=>reuse(first,['--date','1997-08-01']),/尚未完成或不在范围/);
});
test('batch.json is protected from temporary-input cleanup in Node and mobile shell',()=>{
 const bytes=fs.readFileSync(first.files.chart);
 assert.throws(()=>workflow.operation(['--partner-search','--batch','--temp-input',first.files.chart,'--out',path.join(temp,'forbidden-temp')]),/结果文件/);
 assert.deepEqual(fs.readFileSync(first.files.chart),bytes);
 const sh=process.env.SUANMING_TEST_SH,r=cp.spawnSync(sh,[path.join(root,'scripts/mobile.sh'),'--agent','--temp-input',first.files.chart,'--partner-search','--batch','--out',path.join(temp,'forbidden-mobile')],{encoding:'utf8'});
 assert.equal(r.status,2);assert.match(r.stderr,/结果文件/);assert.deepEqual(fs.readFileSync(first.files.chart),bytes);
});
