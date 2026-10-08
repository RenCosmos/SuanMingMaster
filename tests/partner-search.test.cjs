'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const search=require('../scripts/partner-search.cjs'),newFlow=require('../scripts/partner-search-workflow.cjs'),flow=require('../scripts/workflow.cjs'),engine=require('../scripts/engine.cjs'),core=require('../scripts/runtime-core.cjs');
const {digest,Temporal}=require('../scripts/common.cjs');
const root=path.resolve(__dirname,'..'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-partner-'));
test.after(()=>{assert.ok(temporary.startsWith(path.resolve(os.tmpdir())+path.sep+'suanming-partner-'));fs.rmSync(temporary,{recursive:true,force:true});});
const birth=(date='1996-06-15',time='12:00',timezone='Asia/Shanghai')=>({calendar:'solar',date,time,gender:'male',timezone});
const input=()=>({mode:'partner_search',self:{birth:birth()},as_of:'2026-10-06',search:{type:'years',year_range:[1984,2010]},filters:{conditions:['zodiac_affinity'],match:'all',year_gap:[-12,12]}});
const years=search.build(input());
const dateInput=()=>({...input(),search:{type:'dates',start:'1997-06-01',end:'1997-06-02',time_uncertainty:{type:'candidates',times:['09:00','23:30']}},filters:{conditions:['partner_star_projection','day_stem_five_combine','spouse_branch_liuhe','zodiac_affinity'],match:'any'}});
const dates=search.build(dateInput());
const point=g=>({ganzhi:g,stem:g[0],branch:g[1],hidden_stems:[]});
const fixture=name=>JSON.parse(fs.readFileSync(path.join(root,'examples',name),'utf8'));
const write=(name,data)=>{const f=path.join(temporary,name);fs.writeFileSync(f,JSON.stringify(data));return f;};
const cli=(args,data)=>cp.spawnSync(process.execPath,[path.join(root,'scripts/workflow.cjs'),...args],{encoding:'utf8',input:data===undefined?undefined:JSON.stringify(data)});
function limited(r){const stdout=JSON.stringify(r)+'\n';assert.ok(Buffer.byteLength(stdout)<=20*1024);assert.ok(Buffer.byteLength(JSON.stringify({stdout}))<28*1024);assert.equal(r.output.bytes,Buffer.byteLength(stdout));}

test('rat example enumerates verified ox/monkey/dragon cycles, not one guessed birthday',()=>{
 assert.deepEqual(years.candidates.map(c=>c.birth_year_label),[1997,1992,2000,1988,2004,1985]);
 assert.deepEqual(years.candidates.map(c=>c.year_pillar),['丁丑','壬申','庚辰','戊辰','甲申','乙丑']);
 for(const c of years.candidates){assert.equal(c.full_bazi,null);assert.equal(c.exact_birth_date,null);assert.equal(c.exact_birth_time,null);assert.equal(c.pillars.length,1);assert.equal(c.evaluation.candidate_anchor,'year_pillar_only');assert.ok(c.evaluation.missing_evidence.length);assert.equal(c.evaluation.probability,null);assert.equal(c.evaluation.confirmed_partner,false);}
 assert.equal(years.selected_partner,null);assert.equal(years.probability,null);assert.equal(search.validateArtifact(years),years.checksum.value);
});
test('all twelve branch lookup pairs match independently enumerated classical tables',()=>{
 const z='子丑寅卯辰巳午未申酉戌亥',pairs=['子丑','寅亥','卯戌','辰酉','巳申','午未'],groups=['申子辰','亥卯未','寅午戌','巳酉丑'];
 const n=search.normalizeInput(input());
 for(const a of z)for(const b of z){const expected=a===b?null:pairs.some(p=>p.includes(a)&&p.includes(b))?'六合':groups.some(g=>g.includes(a)&&g.includes(b))?'同组三合候选':null;
  assert.equal(search.assessment({pillars:[{...point('甲子'),branch:a},point('丙寅'),point('甲子'),point('甲子')]},[{...point('甲子'),branch:b}],n,true).zodiac_relation,expected,a+b);
 }
});
test('default conditions include day-anchor and spouse-star filters beyond zodiac',()=>{
 const i=input();delete i.filters;const d=search.build(i);assert.equal(d.input.filters.conditions.length,4);assert.ok(d.candidates.some(c=>c.evaluation.zodiac_relation===null));
 assert.ok(d.candidates.every(c=>c.evaluation.matched_conditions.length));assert.ok(d.self.spouse_star_occurrences.length);
});
test('ALL and ANY use exactly selected predicates; empty result does not relax them',()=>{
 const i=input();i.filters.conditions=['zodiac_affinity','partner_star_projection'];i.filters.match='all';const all=search.build(i);assert.ok(all.candidates.length>0);assert.ok(all.candidates.every(c=>c.evaluation.matched_condition_count===2));
 i.filters.match='any';const any=search.build(i);assert.ok(any.candidates.length>all.candidates.length);assert.ok(all.candidates.every(c=>any.candidates.some(a=>a.id===c.id)));
 i.filters.conditions=['zodiac_affinity'];i.filters.match='all';i.search.year_range=[1996,1996];const empty=search.build(i);assert.equal(empty.candidates.length,0);assert.equal(empty.coverage.failed_conditions,1);assert.equal(empty.selected_partner,null);
});
test('year labels are precise Lichun instants including seconds, not Jan 1 or lunar New Year',()=>{
 const c=years.candidates[0],start=Temporal.ZonedDateTime.from(c.interval.start);assert.equal(start.epochNanoseconds,search.lichun(1997).epochNanoseconds);
 const before=start.subtract({seconds:1}).toPlainDateTime(),after=start.toPlainDateTime();
 const chart=t=>engine.build({mode:'bazi',birth:birth(t.toPlainDate().toString(),t.toPlainTime().toString())});
 assert.equal(chart(before).bazi.chart.pillars[0].ganzhi,'丙子');assert.equal(chart(after).bazi.chart.pillars[0].ganzhi,'丁丑');
});
test('Lichun cycle boundaries retain the same instant in overseas timezone',()=>{
 const i=input();i.search.timezone='America/New_York';const c=search.build(i).candidates[0];assert.equal(Temporal.ZonedDateTime.from(c.interval.start).epochNanoseconds,search.lichun(1997).epochNanoseconds);assert.ok(c.interval.start.includes('America/New_York'));
});
test('year candidates are not age-excluded or truncated at an adult cutoff',()=>{
 const i=input();i.search.year_range=[2008,2010];i.filters.conditions=['partner_star_projection'];i.filters.match='any';i.filters.year_gap=[-100,100];const d=search.build(i);
 assert.equal(d.coverage.examined,3);assert.equal(d.coverage.underage_excluded,0);assert.ok(d.candidates.length>0);for(const c of d.candidates)assert.deepEqual(c.eligible_birth_interval,{start:c.interval.start,end_exclusive:c.interval.end_exclusive});
 const young=input();young.self.birth=birth('2010-01-01');const result=search.build(young);assert.equal(result.self.birth_date,'2010-01-01');assert.equal(search.validateArtifact(result),result.checksum.value);
});
test('year-stem projection explicitly differs from unknown candidate day master',()=>{
 for(const c of years.candidates){assert.equal(c.evaluation.candidate_anchor,'year_pillar_only');assert.ok(c.evaluation.missing_evidence.join('').includes('不是对方日主'));}
 assert.equal(years.candidates[0].evaluation.self_to_candidate_anchor_ten_god,'偏财');
});
test('simultaneous 六合 and 六破 are preserved rather than cancelled into a score',()=>{
 const n=search.normalizeInput(input()),own={pillars:[point('甲寅'),point('丙寅'),point('甲寅'),point('甲子')]};
 const e=search.assessment(own,[point('乙亥')],n,true);assert.equal(e.zodiac_relation,'六合');assert.ok(e.structural_relations.some(r=>r.type==='地支六合'));assert.ok(e.risk_relations.some(r=>r.type==='地支六破'));assert.equal(e.probability,null);
 n.filters.exclude_relations=['地支六破'];assert.deepEqual(search.assessment(own,[point('乙亥')],n,true).excluded_by_relations,['地支六破']);
});
test('three-branch completion is candidate participation, not a fabricated transit',()=>{
 const n=search.normalizeInput(input()),own={pillars:[point('甲申'),point('丙子'),point('甲寅'),point('甲子')]};
 const e=search.assessment(own,[point('戊辰')],n,true);assert.ok(e.structural_relations.some(r=>r.type==='三合'&&r.group_state==='completed_with_candidate'));
 own.pillars[2]=point('甲辰');const complete=search.assessment(own,[point('戊辰')],n,true);assert.ok(complete.structural_relations.some(r=>r.type==='三合'&&r.group_state==='natal_already_complete'));
});
test('explicit datetime candidates forward-calculate exactly the unchanged engine pillars',()=>{
 assert.equal(dates.coverage.examined,4);assert.equal(dates.candidates.length,4);
 for(const c of dates.candidates){const dt=Temporal.PlainDateTime.from(c.local_datetime),old=engine.build({mode:'bazi',birth:birth(dt.toPlainDate().toString(),dt.toPlainTime().toString())});assert.deepEqual(c.full_bazi,old.bazi.chart.pillars.map(p=>p.ganzhi));assert.equal(c.evaluation.candidate_anchor,'day_pillar');assert.equal(c.identity_status,'generated_condition_candidate');assert.equal(c.gender_is_known,false);assert.equal(c.sampling_role,'provided');}
});
test('late-zi configuration changes computed day anchor without altering original clock time',()=>{
 const i=dateInput();i.search.end=i.search.start;i.search.time_uncertainty.times=['23:30'];const clock=search.build(i);i.search.options={bazi_day_boundary:'late_zi'};const late=search.build(i);
 assert.equal(clock.candidates[0].local_datetime,late.candidates[0].local_datetime);assert.notEqual(clock.candidates[0].full_bazi[2],late.candidates[0].full_bazi[2]);
});
test('unknown hours sample every structural interval, not every minute or a best assumed hour',()=>{
 const i=dateInput();i.search.end=i.search.start;i.search.time_uncertainty={type:'unknown'};const d=search.build(i);
 assert.ok(d.coverage.examined>=39);assert.ok(d.coverage.scope.includes('已计算点'));assert.equal(d.selected_partner,null);assert.equal(d.probability,null);
 const seen=new Set(d.candidates.map(c=>c.local_datetime));assert.equal(seen.size,d.candidates.length);assert.ok(d.candidates.some(c=>c.local_datetime.endsWith('T23:59:59')));
});
test('DST nonexistent/repeated candidate clocks are unavailable, not silently shifted',()=>{
 const i=dateInput();i.search.start=i.search.end='2000-04-02';i.search.timezone='America/New_York';i.search.time_uncertainty.times=['02:30','09:00'];const d=search.build(i);
 assert.equal(d.coverage.unavailable,1);assert.ok(d.unavailable[0].local_datetime.includes('02:30'));assert.equal(d.coverage.examined,1);
});
test('date true-solar requests need explicit longitude and reuse old solar calculations',()=>{
 const i=dateInput();i.search.start=i.search.end='1997-06-01';i.search.time_uncertainty.times=['09:00'];i.search.options={time_basis:'true_solar'};
 assert.throws(()=>search.build(i),/longitude/);i.search.longitude=100;i.search.longitude_source='synthetic test coordinate';const d=search.build(i),c=d.candidates[0];
 const old=engine.build({mode:'bazi',birth:{...birth('1997-06-01','09:00'),longitude:100,longitude_source:i.search.longitude_source},options:i.search.options});assert.deepEqual(c.full_bazi,old.bazi.chart.pillars.map(p=>p.ganzhi));
});
test('preferred elements require explicit selection and never infer 喜用 from raw counts',()=>{
 const i=dateInput();i.filters.conditions=['element_supply'];assert.throws(()=>search.build(i),/preferred_elements/);i.filters.preferred_elements=['水'];const d=search.build(i);assert.ok(d.candidates.length);assert.deepEqual(d.input.filters.preferred_elements,['水']);
 const y=input();y.filters.conditions=['element_supply'];y.filters.preferred_elements=['水'];assert.throws(()=>search.build(y),/有候选四柱/);
});
test('provided people remain supplied facts, not inferred partner identity or sex',()=>{
 const i=input();i.search={type:'people',people:[{id:'candidate-a',birth:birth('1997-06-01','09:00')}]};delete i.filters;const d=search.build(i);assert.equal(d.candidates.length,1);assert.equal(d.candidates[0].person_id,'candidate-a');assert.deepEqual(d.candidates[0].birth.time,'09:00');assert.equal(d.candidates[0].identity_status,'user_provided_not_destiny_confirmed');assert.equal(d.candidates[0].evaluation.confirmed_partner,false);
});
test('all/wealth/authority models are explicit and do not derive sexual orientation',()=>{
 const i=input();i.filters.conditions=['partner_star_projection'];i.partner_star_model='all';const all=search.build(i);i.partner_star_model='wealth';const wealth=search.build(i);i.partner_star_model='authority';const authority=search.build(i);
 assert.equal(all.candidates.length,wealth.candidates.length+authority.candidates.length);assert.ok(wealth.candidates.every(c=>['正财','偏财'].includes(c.evaluation.self_to_candidate_anchor_ten_god)));assert.ok(authority.candidates.every(c=>['正官','七杀'].includes(c.evaluation.self_to_candidate_anchor_ten_god)));
 i.self.birth.gender='female';assert.deepEqual(search.build(i).candidates.map(c=>c.id),authority.candidates.map(c=>c.id));
});
test('manual four-pillar input is validated but never assigned a made-up birthday or Ziwei',()=>{
 const i=input();i.self={pillars:['丙子','甲午','癸未','戊午'],birth_year:1996};const d=search.build(i);assert.equal(d.self.calendar_verified,false);assert.equal(d.self.birth_date,null);assert.equal(d.self.age_cue,null);assert.deepEqual(d.self.pillars.map(p=>p.ganzhi),years.self.pillars.map(p=>p.ganzhi));assert.deepEqual(d.candidates.map(c=>c.id),years.candidates.map(c=>c.id));
 i.self.pillars[1]='丙午';assert.throws(()=>search.build(i),/五虎遁/);i.self.pillars[1]='甲午';i.self.pillars[3]='甲午';assert.throws(()=>search.build(i),/五鼠遁/);
});
test('manual year metadata still rejects impossible cycles but has no adult-year gate',()=>{
 const i=input();i.self={pillars:['丙子','甲午','癸未','戊午'],birth_year:1997};assert.equal(search.normalizeInput(i).self.birth_year,1997);
 i.self.birth_year=2000;assert.throws(()=>search.normalizeInput(i),/年柱不符/);i.self.birth_year=1996;i.as_of='2014-12-31';assert.equal(search.normalizeInput(i).self.birth_year,1996);
});
test('young self birth and equivalent four pillars produce the same candidates',()=>{
 const i=input();i.self.birth=birth('2010-01-01');i.filters.year_gap=[-100,100];const fromBirth=search.build(i);
 i.self={pillars:fromBirth.self.pillars.map(p=>p.ganzhi),birth_year:2010};const fromPillars=search.build(i);
 assert.deepEqual(fromPillars.candidates,fromBirth.candidates);assert.deepEqual(fromPillars.coverage,fromBirth.coverage);assert.equal(search.validateArtifact(fromPillars),fromPillars.checksum.value);
});
test('recent date and person candidates obey conditions without adult exclusions',()=>{
 const i=input();i.filters={conditions:['zodiac_affinity'],match:'all',year_gap:[-100,100]};i.search={type:'dates',start:'2009-06-01',end:'2009-06-02',time_uncertainty:{type:'candidates',times:['09:00']}};
 const dates=search.build(i);assert.equal(dates.coverage.examined,2);assert.equal(dates.coverage.underage_excluded,0);assert.equal(dates.candidates.length,2);assert.equal(search.validateArtifact(dates),dates.checksum.value);
 i.search={type:'people',people:[{id:'young-synthetic',birth:birth('2009-06-01','09:00')}]};const people=search.build(i);assert.equal(people.coverage.examined,1);assert.equal(people.coverage.underage_excluded,0);assert.equal(people.candidates[0].person_id,'young-synthetic');assert.equal(search.validateArtifact(people),people.checksum.value);
 i.filters.year_gap=[-2,2];const excluded=search.build(i);assert.equal(excluded.candidates.length,0);assert.equal(excluded.coverage.outside_year_gap,1);
});
test('direct artifact validation rejects old engine semantics even with a valid checksum',()=>{
 const d=structuredClone(years);assert.equal(d.engine_version,'partner-search/1.0.1');d.engine_version='partner-search/1.0.0';const {checksum,...payload}=d;d.checksum.value=digest(payload);
 assert.throws(()=>search.integrity(d),/不支持的候选筛选版本/);assert.throws(()=>search.validateArtifact(d),/不支持的候选筛选版本/);
});
test('existing Ziwei age cue is auxiliary only and is not converted into an exact age gap',()=>{
 const i=input();i.self.chart_mode='both';const d=search.build(i);assert.ok(d.self.age_cue);assert.deepEqual(d.candidates.map(c=>c.id),years.candidates.map(c=>c.id));for(const c of d.candidates)if(typeof c.age_cue_alignment==='object')assert.equal(c.age_cue_alignment.use,'auxiliary_display_only_not_filter_or_probability');
 const projected=newFlow.project(d);assert.ok(projected.self.age_cue);assert.equal(projected.probability,null);
});
test('invalid or unbounded requests are rejected instead of inventing defaults',()=>{
 for(const change of [i=>delete i.as_of,i=>i.filters.conditions=['made_up'],i=>i.filters.year_gap=[0.5,1],i=>i.search.year_range=[1900,2000],i=>i.self.birth.time=undefined,i=>i.partner_star_model='orientation',i=>i.filters.exclude_relations=['bad']]){const i=input();change(i);assert.throws(()=>search.normalizeInput(i));}
 const i=dateInput();i.search.end='1997-07-02';assert.throws(()=>search.build(i),/最多31天/);i.search.end=i.search.start;i.search.time_uncertainty={type:'range',start:'23:00',end:'01:00',end_day_offset:1};assert.throws(()=>search.build(i),/跨日/);
});
test('checksum and re-signed fabricated candidates are rejected by full reconstruction',()=>{
 const d=structuredClone(years);d.candidates[0].year_pillar='甲子';assert.throws(()=>search.validateArtifact(d),/校验和/);const {checksum,...payload}=d;d.checksum.value=digest(payload);assert.throws(()=>search.validateArtifact(d),/重算不一致/);
});
const source=write('source-input.json',input()),out=path.join(temporary,'search'),first=flow.operation(['--input',source,'--partner-search','--out',out]);
test('new dispatcher writes bounded independent artifacts without touching old adapters',()=>{
 assert.equal(first.adapter_id,'partner_search');assert.equal(first.validation.ok,true);assert.equal(first.calculation_performed,true);limited(first);assert.deepEqual(fs.readdirSync(out).sort(),['chart.json','context.json','validation.json']);assert.equal(core.ADAPTERS?.partner_search,undefined);
});
test('receipt-backed followups never call calculation or full verification again',()=>{
 const b=search.build,v=search.validateArtifact;search.build=()=>{throw Error('unexpected build');};search.validateArtifact=()=>{throw Error('unexpected verify');};
 try{for(const args of [['--input',source,'--out',out],['--reuse',first.files.chart]]){const r=flow.operation([...args,'--partner-search']);assert.equal(r.cache_hit,true);assert.equal(r.calculation_performed,false);assert.equal(r.validation.recalculated,false);assert.equal(r.task_id,first.task_id);limited(r);}}finally{search.build=b;search.validateArtifact=v;}
});
test('pagination visits every result once and next actions preserve partner-search flag',()=>{
 let offset=0,ids=[];do{const r=flow.operation(['--reuse',first.files.chart,'--partner-search','--offset',String(offset),'--limit','2']);limited(r);ids.push(...r.context.candidates.items.map(c=>c.id));offset=r.context.candidates.next_offset;if(offset!==null)assert.deepEqual(r.next_actions[0].command_flags,['--agent','--partner-search']);}while(offset!==null);assert.deepEqual(ids,years.candidates.map(c=>c.id));
 const r=flow.operation(['--reuse',first.files.chart,'--partner-search','--candidate',ids[0]]);assert.ok(r.context.candidates.items[0].evaluation.structural_relations.length);limited(r);
});
test('changing criteria cannot overwrite cached task, even with refresh',()=>{
 const i=input();i.filters.match='any';const f=write('changed-input.json',i);assert.throws(()=>flow.operation(['--input',f,'--partner-search','--out',out,'--refresh']),/不同的计算输入/);
 const r=flow.operation(['--input',source,'--partner-search','--out',out,'--refresh']);assert.equal(r.cache_hit,false);assert.equal(r.calculation_performed,true);
});
test('missing receipt triggers full validation once; re-signed invalid file remains rejected',()=>{
 const task=path.join(temporary,'untrusted');fs.mkdirSync(task);const file=path.join(task,'chart.json');core.atomicJson(file,years);let r=flow.operation(['--reuse',file,'--partner-search']);assert.equal(r.validation.recalculated,true);assert.equal(flow.operation(['--reuse',file,'--partner-search']).cache_hit,true);
 const d=structuredClone(years);d.candidates[0].animal='龙';const {checksum,...payload}=d;d.checksum.value=digest(payload);core.atomicJson(file,d);assert.throws(()=>flow.operation(['--reuse',file,'--partner-search']),/重算不一致/);
});
test('stdin produces no retained raw input, temporary inputs clean up on success and failure',()=>{
 let r=cli(['--stdin','--partner-search','--out',path.join(temporary,'stdin')],input());assert.equal(r.status,0,r.stderr);limited(JSON.parse(r.stdout));
 const f=write('temp-input.json',input());r=cli(['--temp-input',f,'--partner-search','--out',path.join(temporary,'temp')]);assert.equal(r.status,0,r.stderr);assert.equal(fs.existsSync(f),false);assert.equal(JSON.parse(r.stdout).temporary_input_removed,true);
 fs.writeFileSync(f,'invalid');r=cli(['--temp-input',f,'--partner-search','--out',path.join(temporary,'invalid')]);assert.equal(r.status,2);assert.equal(fs.existsSync(f),false);
});
test('mobile --agent entry routes new mode while temporary option stays first',()=>{
 const sh=process.env.SUANMING_TEST_SH??(process.platform==='win32'?undefined:'sh');assert.ok(sh,'Set SUANMING_TEST_SH on Windows');const f=write('shell-temp-input.json',input()),task=path.join(temporary,'shell');
 const r=cp.spawnSync(sh,[path.join(root,'scripts/mobile.sh'),'--agent','--temp-input',f,'--partner-search','--out',task],{encoding:'utf8',env:{...process.env,PATH:[path.dirname(process.execPath),path.dirname(sh),process.env.PATH].join(path.delimiter)}});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).adapter_id,'partner_search');assert.equal(fs.existsSync(f),false);
});
test('mobile entry accepts young self through both birth and four-pillar inputs',()=>{
 const sh=process.env.SUANMING_TEST_SH??(process.platform==='win32'?undefined:'sh');assert.ok(sh,'Set SUANMING_TEST_SH on Windows');
 const i=input();i.self.birth=birth('2008-06-15');i.search={type:'people',people:[{id:'young-synthetic',birth:birth('2009-06-01','09:00')}]};i.filters={conditions:['zodiac_affinity'],match:'all',year_gap:[-100,100]};
 const facts=search.build(i);for(const type of ['birth','pillars']){
  const raw=structuredClone(i);if(type==='pillars')raw.self={pillars:facts.self.pillars.map(p=>p.ganzhi),birth_year:2008};
  const r=cp.spawnSync(sh,[path.join(root,'scripts/mobile.sh'),'--agent','--stdin','--partner-search','--out',path.join(temporary,'young-'+type)],{encoding:'utf8',input:JSON.stringify(raw),env:{...process.env,PATH:[path.dirname(process.execPath),path.dirname(sh),process.env.PATH].join(path.delimiter)}});
  assert.equal(r.status,0,r.stderr);const out=JSON.parse(r.stdout);assert.equal(out.validation.ok,true);assert.equal(out.context.candidates.items[0].person_id,'young-synthetic');limited(out);
 }
});
test('source-chart imports verified existing birth without overwriting chart or old output',()=>{
 const old=core.buildAndValidate(fixture('input.json')).data,file=write('original-chart.json',old),bytes=fs.readFileSync(file),i=input();delete i.self;
 const f=write('import-input.json',i),r=flow.operation(['--input',f,'--partner-search','--source-chart',file,'--out',path.join(temporary,'imported')]);assert.equal(r.ok,true);assert.deepEqual(fs.readFileSync(file),bytes);assert.deepEqual(core.readJson(r.files.chart).input.self.birth,old.input.birth);
});
test('double-person source needs explicit a/b and does not silently select someone',()=>{
 const old=core.buildAndValidate(fixture('relationship-pair-input.json')).data,file=write('original-pair.json',old),i=input();delete i.self;const f=write('pair-import-input.json',i);
 assert.throws(()=>flow.operation(['--input',f,'--partner-search','--source-chart',file,'--out',path.join(temporary,'pair-implicit')]),/明确--source-person/);
 const r=flow.operation(['--input',f,'--partner-search','--source-chart',file,'--source-person','b','--out',path.join(temporary,'pair-explicit')]);assert.deepEqual(core.readJson(r.files.chart).input.self.birth,old.people[1].chart.input.birth);
});
test('writes reject skill paths, input-output collisions and busy tasks using original guards',()=>{
 assert.throws(()=>flow.operation(['--input',source,'--partner-search','--out',path.join(root,'unsafe')]),/技能包/);
 assert.throws(()=>flow.operation(['--input',first.files.chart,'--partner-search','--out',out]),/覆盖/);
 const release=require('../scripts/task-files.cjs').acquireTaskLocks([out]);try{assert.throws(()=>flow.operation(['--reuse',first.files.chart,'--partner-search']),/处理中|正在使用|task_busy/);}finally{release();}
});
test('reports are explicit, preserve conflicts and escape HTML user content',()=>{
 const i=input();i.question='<script>alert(1)</script>';const d=search.build(i),report=require('../scripts/partner-search-report.cjs').makeReport(d);assert.ok(!report.html.includes('<script>'));assert.ok(report.html.includes('&lt;script&gt;'));assert.ok(report.markdown.includes('不是现实对象'));
 const r=flow.operation(['--reuse',first.files.chart,'--partner-search','--report']);assert.equal(r.report_generated,true);assert.ok(fs.existsSync(r.files.report_md));assert.ok(fs.existsSync(r.files.report_html));limited(r);
});
test('CLI rejects ambiguous modes, duplicate flags and unsupported pagination',()=>{
 for(const args of [['--stdin','--partner-search','--partner-search'],['--reuse',first.files.chart,'--partner-search','--limit','11'],['--reuse',first.files.chart,'--partner-search','--focus','core'],['--reuse',first.files.chart,'--partner-search','--candidate','PSY-9999']])assert.throws(()=>flow.operation(args));
});
