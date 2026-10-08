'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),plan=require('../scripts/partner-search-plan.cjs'),batch=require('../scripts/partner-search-batch.cjs'),search=require('../scripts/partner-search.cjs'),workflow=require('../scripts/workflow.cjs'),engine=require('../scripts/engine.cjs'),core=require('../scripts/runtime-core.cjs'),budget=require('../scripts/output-budget.cjs'),report=require('../scripts/partner-search-report.cjs');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-plan-test-'));
test.after(()=>{assert.ok(temp.startsWith(path.resolve(os.tmpdir())+path.sep+'suanming-plan-test-'));fs.rmSync(temp,{recursive:true,force:true});});
const base=()=>JSON.parse(fs.readFileSync(path.join(root,'examples/partner-search/plan.json'),'utf8'));
const write=(name,data)=>{const file=path.join(temp,name+'.json');fs.writeFileSync(file,JSON.stringify(data));return file;};
const run=(name,input)=>workflow.operation(['--input',write(name,input),'--partner-search','--plan','--out',path.join(temp,name)]);
const reuse=(result,extra=[])=>workflow.operation(['--reuse',result.files.chart,'--partner-search','--plan',...extra]);
function bounded(r){budget.assertFits(r,budget.WORKFLOW_BYTES);assert.equal(r.output.bytes,budget.measure(r).stdout_bytes);}
const candidate=engine.build({mode:'bazi',birth:{calendar:'solar',date:'1997-06-15',time:'12:00',gender:'male',timezone:'Asia/Shanghai'}}).bazi.chart.pillars.map(p=>p.ganzhi);

test('all candidate report modes omit age exclusion text while retaining other content',()=>{
 for(const type of ['years','dates','people']){
  const raw=base();raw.mode='partner_search';raw.self.birth.date='2010-06-15';raw.filters.year_gap=[-100,100];
  raw.search=type==='years'?{type,year_range:[2011,2011]}:type==='dates'?{type,start:'2011-06-15',end:'2011-06-15',time_uncertainty:{type:'candidates',times:['12:00']}}:{type,people:[{id:'synthetic',birth:{...raw.self.birth,date:'2011-06-15'}}]};
  const data=search.build(raw),r=report.makeReport(data);assert.equal(data.coverage.underage_excluded,0);
  for(const text of [r.markdown,r.html]){assert.doesNotMatch(text,/未成年|成年日期|成年周期/);assert.match(text,/无法计算采样点/);assert.match(text,/候选/);assert.match(text,/来源/);assert.ok(text.includes(data.checksum.value));}
 }
});
test('planning derives day hypotheses without treating a year stem as the candidate day master',()=>{
 const r=run('basic',base()),d=core.readJson(r.files.chart);assert.equal(r.adapter_id,'partner_search_plan');assert.equal(r.context.probability,null);bounded(r);
 const fields=new Map(d.derived.hypotheses.map(h=>[h.condition,h.candidate_field]));
 assert.deepEqual(d.derived.hypotheses.find(h=>h.condition==='zodiac_affinity').values,['丑','申','辰']);
 assert.equal(fields.get('zodiac_affinity'),'year_branch');assert.equal(fields.get('partner_star_projection'),'day_stem');assert.equal(fields.get('day_stem_five_combine'),'day_stem');assert.equal(fields.get('spouse_branch_liuhe'),'day_branch');
 assert.ok(d.derived.day_pillar_options.values.length);for(const item of d.derived.day_pillar_options.values){assert.equal('甲乙丙丁戊己庚辛壬癸'.indexOf(item.ganzhi[0])%2,'子丑寅卯辰巳午未申酉戌亥'.indexOf(item.ganzhi[1])%2);}
});
test('explicit theoretical pillars map the actual year pillar across sixty-year cycles',()=>{
 const input=base();input.candidate_pillars=candidate;input.search.year_range=[1997,2057];input.filters.year_gap=[-100,100];
 const r=run('cycles',input),d=core.readJson(r.files.chart);assert.deepEqual(d.year_mappings.map(x=>x.birth_year_label),[1997,2057]);
 assert.ok(d.year_mappings.every(x=>x.year_pillar===candidate[0]));assert.equal(d.proposed_candidate.calendar_verified,false);assert.equal(d.proposed_candidate.evaluation.confirmed_partner,false);bounded(r);
});
test('ANY keeps non-affinity years that may match other conditions, ALL only hard-filters specified year rules',()=>{
 const input=base();input.search.year_range=[1997,2001];input.filters.conditions=['zodiac_affinity','day_stem_five_combine'];
 const any=plan.build(input);assert.equal(any.year_mappings.length,5);assert.ok(any.year_mappings.some(y=>y.zodiac_condition_matches===false));
 input.filters.match='all';const all=plan.build(input);assert.ok(all.year_mappings.length>0&&all.year_mappings.length<any.year_mappings.length);assert.ok(all.year_mappings.every(y=>y.zodiac_condition_matches));assert.equal(all.input.filters.match,'all');
});
test('explicit element hypotheses are preserved without claiming year-only element verification',()=>{
 const input=base();input.filters.conditions=['element_supply'];input.filters.preferred_elements=['木','水'];
 const d=plan.build(input);assert.deepEqual(d.input.filters.conditions,['element_supply']);assert.deepEqual(d.derived.hypotheses[0].values,['木','水']);
 assert.equal(d.year_mappings.length,1);assert.deepEqual(d.year_mappings[0]&&plan.followup(d,d.year_mappings[0],path.join(temp,'element','chart.json'))[0].input.filters.conditions,['element_supply']);
 delete input.filters.preferred_elements;assert.throws(()=>plan.build(input),/preferred_elements/);
});
test('year-plan pagination argv recovers each year once and does not change source bytes',()=>{
 const input=base();input.search.year_range=[1997,2001];const first=run('pages',input),bytes=fs.readFileSync(first.files.chart);let r=reuse(first,['--limit','2']),years=[];
 while(true){bounded(r);years.push(...r.context.year_mapping.items.map(y=>y.birth_year_label));const next=r.next_actions[0];if(!next)break;r=workflow.operation(next.argv);assert.equal(r.cache_hit,true);assert.equal(r.context.sources,undefined);}
 assert.deepEqual(years,[1997,1998,1999,2000,2001]);assert.deepEqual(fs.readFileSync(first.files.chart),bytes);
});
test('generated query preserves full pillars and filters; batch returns only exact calculated matches',()=>{
 const input=base();input.candidate_pillars=candidate;const r=run('target',input),a=r.context.year_mapping.items[0].next_actions[0];
 assert.ok(a.argv.includes('--batch'));assert.ok(a.argv.includes('--stdin'));assert.deepEqual(a.input.candidate_pillars,candidate);assert.equal(a.input.filters.match,'any');assert.equal(a.input.search.time_uncertainty.type,'unknown');
 const raw={...a.input,search:{...a.input.search,start:'1997-06-15',end:'1997-06-16'}},out=path.join(temp,'exact-dates');
 const result=workflow.operation(['--input',write('exact-dates-input',raw),'--partner-search','--batch','--out',out]);bounded(result);
 assert.deepEqual(result.context.scope.candidate_pillars,candidate);const manifest=batch.integrity(core.readJson(result.files.chart));assert.equal(manifest.engine_version,'partner-search-batch/1.0.1');
 const child=core.readJson(path.join(out,manifest.jobs[0].chart));assert.deepEqual(child,search.build(child.input));assert.ok(child.candidates.some(c=>c.full_bazi.some((g,i)=>g!==candidate[i])));
 const groups=batch.groupDates(child,raw.candidate_year_branch,candidate).groups;assert.ok(groups.length);assert.ok(groups.every(g=>g.points.every(p=>JSON.stringify(p.full_bazi)===JSON.stringify(candidate))));
 const row=result.context.months[0].dates[0];const detail=workflow.operation(row.details.argv);assert.ok(detail.context.date_detail.candidates.items.every(c=>JSON.stringify(c.full_bazi)===JSON.stringify(candidate)));
});
test('legacy batch manifests remain readable only without new exact-pillar constraints',()=>{
 const raw={...base(),mode:'partner_search_batch',search:{type:'dates',start:'1997-06-15',end:'1997-06-15'},ranking:'all'};
 const result=workflow.operation(['--input',write('legacy-input',raw),'--partner-search','--batch','--out',path.join(temp,'legacy')]),m=core.readJson(result.files.chart);
 const sign=m=>{const {checksum,...body}=m;return {...body,checksum:{algorithm:'sha256-canonical-json',value:core.hash(body)}};};
 m.engine_version='partner-search-batch/1.0.0';const legacy=sign(m);fs.writeFileSync(result.files.chart,JSON.stringify(legacy)+'\n');assert.equal(workflow.operation(['--reuse',result.files.chart,'--partner-search','--batch']).ok,true);
 legacy.input.candidate_pillars=candidate;assert.throws(()=>batch.integrity(sign(legacy)),/旧批量版本/);
});
test('unsupported or contradictory theory is rejected without silently modifying conditions',()=>{
 const raw=base();raw.candidate_pillars=[candidate[0],'甲子',candidate[2],candidate[3]];assert.throws(()=>plan.build(raw),/五虎遁/);
 assert.throws(()=>workflow.operation(['--partner-search','--plan','--batch','--input','unused','--out','unused']),/不同任务/);
 const input={mode:'partner_search_batch',self:base().self,as_of:base().as_of,search:{type:'dates',start:'1997-06-15',end:'1997-06-15'},candidate_year_branch:'子',candidate_pillars:candidate};assert.throws(()=>batch.normalizeInput(input),/不一致/);
});
test('planning refuses a changed input and preserves existing task artifacts',()=>{
 const raw=base(),first=run('protected',raw),bytes=fs.readFileSync(first.files.chart);raw.search.year_range=[1998,1998];assert.throws(()=>run('protected',raw),/不同规划/);assert.deepEqual(fs.readFileSync(first.files.chart),bytes);
 const out=path.join(temp,'occupied');fs.mkdirSync(out);fs.writeFileSync(path.join(out,'context.json'),'preserve');assert.throws(()=>workflow.operation(['--input',write('occupied-input',base()),'--partner-search','--plan','--out',out]),/其他任务/);
});
test('re-signed planning evidence does not pass stale receipt verification',()=>{
 const r=run('tampered',base()),d=core.readJson(r.files.chart);d.year_mappings[0].year_pillar='甲子';const {checksum,...body}=d;d.checksum={algorithm:'sha256-canonical-json',value:core.hash(body)};fs.writeFileSync(r.files.chart,JSON.stringify(d)+'\n');assert.throws(()=>reuse(r),/重算不一致/);
});
test('young birth and manual self work without age gates in planning and reports',()=>{
 const raw=base();raw.self.birth.date='2010-06-15';raw.search.year_range=[2011,2011];const born=plan.build(raw);
 raw.self={pillars:born.self.pillars.map(p=>p.ganzhi),birth_year:2010};const manual=plan.build(raw);assert.deepEqual(manual.derived,born.derived);assert.deepEqual(manual.year_mappings,born.year_mappings);
});
test('explicit source import is read-only and trusted plan reuse avoids recalculation',()=>{
 const chart=engine.build({mode:'bazi',birth:base().self.birth}),source=write('original-chart',chart),bytes=fs.readFileSync(source),raw=base();delete raw.self;
 const r=workflow.operation(['--input',write('import-input',raw),'--partner-search','--plan','--source-chart',source,'--out',path.join(temp,'import')]),next=reuse(r);assert.equal(next.cache_hit,true);assert.equal(next.calculation_performed,false);assert.deepEqual(fs.readFileSync(source),bytes);
});
test('actual mobile planning cleans temp input and actual report files omit exclusion text',()=>{
 const sh=process.env.SUANMING_TEST_SH;assert.ok(sh,'Set SUANMING_TEST_SH');const env={...process.env,PATH:[path.dirname(process.execPath),path.dirname(sh),process.env.PATH].join(path.delimiter)},file=write('mobile-plan-input',base());
 const r=cp.spawnSync(sh,[path.join(root,'scripts/mobile.sh'),'--agent','--temp-input',file,'--partner-search','--plan','--out',path.join(temp,'mobile-plan')],{env,encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(fs.existsSync(file),false);const d=JSON.parse(r.stdout);assert.equal(d.temporary_input_removed,true);bounded(d);
 const input=base();input.mode='partner_search';const output=cp.spawnSync(sh,[path.join(root,'scripts/mobile.sh'),'--agent','--stdin','--partner-search','--out',path.join(temp,'mobile-report'),'--report'],{env,input:JSON.stringify(input),encoding:'utf8'});assert.equal(output.status,0,output.stderr);
 for(const file of [JSON.parse(output.stdout).files.report_md,JSON.parse(output.stdout).files.report_html])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/未成年日期／周期排除/);
});

test('file protection distinguishes large Windows identifiers without weakening hard-link rejection',()=>{
 const guard=require('../scripts/task-files.cjs'),a=write('identity-a',{}),b=write('identity-b',{}),original=fs.statSync;
 const ids=new Map([[a,9007199254740992n],[b,9007199254740993n]]);
 fs.statSync=(file,options)=>{const id=ids.get(file);return id===undefined?original(file,options):{dev:options?.bigint?1n:1,ino:options?.bigint?id:Number(id)};};
 try{assert.doesNotThrow(()=>guard.assertOutputs(a,[b]));ids.set(b,ids.get(a));assert.throws(()=>guard.assertOutputs(a,[b]),/覆盖输入/);}finally{fs.statSync=original;}
});

test('long-path and quoted-input planning pages fit both budgets and preserve all year rows',()=>{
 const input=base();input.search.year_range=[1997,2006];input.question='理论条件 "quoted" \\ safe '.repeat(25);
 const data=plan.build(input),file=path.join(temp,('长路径-'+ 'segment'.repeat(12)+path.sep).repeat(6),'chart.json'),baseResponse={ok:true,files:{chart:file,context:path.join(path.dirname(file),'context.json'),validation:path.join(path.dirname(file),'validation.json')}};
 let offset=0,years=[],adjusted=false;
 while(true){const r=plan.project(data,{offset,limit:10},baseResponse);bounded(r);years.push(...r.context.year_mapping.items.map(y=>y.birth_year_label));adjusted ||= r.output.budget_adjusted;const next=r.context.year_mapping.next_offset;if(next===null)break;assert.ok(next>offset);offset=next;}
 assert.equal(adjusted,true);assert.deepEqual(years,data.year_mappings.map(y=>y.birth_year_label));assert.equal(new Set(years).size,years.length);
});
