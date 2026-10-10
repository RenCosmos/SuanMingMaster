'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(process.env.SUANMING_TEST_SKILL_ROOT||path.join(__dirname,'..')),load=n=>require(path.join(root,'scripts',n+'.cjs'));
const core=load('runtime-core'),{project}=load('context'),timing=load('dayun-timing'),{romance}=load('relationship-romance'),{retrieve}=load('knowledge-context'),search=load('knowledge-search'),budget=load('output-budget');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-hotfix141-')),fixture=n=>JSON.parse(fs.readFileSync(path.join(root,'examples',n),'utf8'));
test.after(()=>{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));fs.rmSync(tmp,{recursive:true,force:true});});
function mobile(argv){const sh=process.env.SUANMING_TEST_SH||'sh',env={...process.env},prior=process.env.PATH||process.env.Path||'';for(const key of Object.keys(env))if(key.toUpperCase()==='PATH')delete env[key];env.PATH=[path.dirname(process.execPath),path.dirname(sh),prior].join(path.delimiter);const p=s=>process.platform==='win32'?s.replaceAll('\\','/'):s;
 const r=cp.spawnSync(sh,[p(path.join(root,'scripts/mobile.sh')),...argv.map(p)],{cwd:tmp,env,encoding:'utf8',timeout:30000,maxBuffer:256*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);const out=JSON.parse(r.stdout);assert.equal(out.ok,true);assert.ok(budget.fits(out,20*1024));return out;}
for(const chart_mode of ['both','bazi','ziwei'])test('brief comparison returned mobile argv completes all evidence: '+chart_mode,()=>{
 const input=fixture('relationship-pair-input.json');input.chart_mode=chart_mode;const file=path.join(tmp,chart_mode+'.json');fs.writeFileSync(file,JSON.stringify(input));
 let r=mobile(['--input',file,'--out',path.join(tmp,chart_mode),'--person','b','--focus','relationship','--brief','--limit','2']);const bytes=fs.readFileSync(r.files.chart),original=JSON.parse(bytes),relations=[],matrix=[];let pages=0;
 let action=r.next_actions.find(x=>x.comparison);assert.ok(action);assert.ok(action.argv.includes('--brief'));
 do{r=mobile(action.argv);assert.ok(++pages<80);assert.equal(r.cache_hit,true);assert.equal(r.calculation_performed,false);assert.equal(r.context.source_checksum,original.checksum.value);const c=r.context.reading.comparison;if(c.bazi){relations.push(...c.bazi.cross_relations.items);matrix.push(...c.bazi.pillar_matrix.items);}assert.deepEqual(c.ziwei,original.comparison.ziwei);action=r.next_actions.find(x=>x.comparison);}while(action);
 assert.deepEqual(relations,original.comparison.bazi?.cross_relations??[]);assert.deepEqual(matrix,original.comparison.bazi?.pillar_matrix??[]);assert.deepEqual(fs.readFileSync(r.files.chart),bytes);
});
test('current dayun uses exact first and later exchange instants with half-open intervals',()=>{
 const d=core.buildAndValidate(fixture('input.json')).data,b=d.bazi.chart,before=core.hash(d),windows=timing.windows(b);assert.equal(b.qiyun.start_datetime_birth_timezone,'2008-03-12T14:00:00+08:00[Asia/Shanghai]');
 assert.equal(timing.active(b,windows[0].start.toInstant().subtract({seconds:1}).toString()).status,'before_first_dayun');
 for(const w of windows){assert.equal(timing.active(b,w.start.toInstant().toString()).window.period.id,w.period.id);assert.equal(timing.active(b,w.end.toInstant().subtract({seconds:1}).toString()).window.period.id,w.period.id);}
 assert.equal(timing.active(b,windows.at(-1).end.toInstant().toString()).status,'after_computed_range');assert.equal(core.hash(d),before);
});
test('noon-date projections and romance agree before and after actual exchange, not January 1',()=>{
 for(const [date,want] of [['2008-01-01',[]],['2008-03-12',[]],['2008-03-13',['BZ-DY-1']],['2018-03-12',['BZ-DY-1']],['2018-03-13',['BZ-DY-2']]]){const raw=fixture('input.json');raw.target_date=date;const d=core.buildAndValidate(raw).data,p=project(d,{focus:'relationship',brief:true}).reading;assert.deepEqual(p.bazi.dayun.map(x=>x.id),want,date);assert.deepEqual(romance(d,'a','wealth').active_dayun.map(x=>x.id),want,date);assert.equal(p.bazi.dayun_at_target.period_id,want[0]??null);}
});
test('annual exchange-year context includes both intersecting dayun and retains every original relation',()=>{
 const raw=fixture('input.json');raw.target_date='2018-01-01';const d=core.buildAndValidate(raw).data,p=project(d,{focus:'annual',years:[2018,2018]}).reading.bazi;assert.deepEqual(p.dayun.map(x=>x.id),['BZ-DY-1','BZ-DY-2']);for(const w of p.dayun){const original=d.bazi.chart.dayun.find(x=>x.id===w.id);assert.deepEqual(w.pillar_relations,original.pillar_relations.map(load('context').relation));assert.ok(w.start_datetime&&w.end_datetime_exclusive);}
});
test('compact pair retains original period facts and precise timing remains reachable per person',()=>{
 const d=core.buildAndValidate(fixture('relationship-pair-input.json')).data,p=project(d,{focus:'relationship'});
 for(const person of p.reading.people){const original=d.people.find(x=>x.id===person.person_id).chart.bazi.chart,full=project(d,{focus:'relationship',person:person.person_id,brief:true}).reading.people[0];
  const current=timing.active(original);assert.deepEqual(person.chart.bazi.dayun,current.window?[load('context').period(current.window.period)]:[]);assert.equal(person.chart.bazi.dayun_at_target.period_id,current.window?.period.id??null);
  assert.ok(full.chart.bazi.dayun_at_target.evaluation_instant);for(const w of full.chart.bazi.dayun)assert.ok(w.start_datetime&&w.end_datetime_exclusive);
  assert.equal(full.emotional_paths.active_dayun_source,'bazi.dayun');assert.equal(full.emotional_paths.dayun_at_target_source,'bazi.dayun_at_target');assert.equal(full.emotional_paths.active_dayun,undefined);
 }
});
test('target noon respects supplied timezone; absent target never selects a dayun',()=>{
 const raw=fixture('input.json');delete raw.target_date;const b=core.buildAndValidate(raw).data.bazi.chart;assert.equal(timing.active(b).status,'target_not_requested');b.target={local_date:'2018-03-12',evaluation_local_time:'12:00'};assert.equal(timing.active(b).window.period.id,'BZ-DY-1');b.time_basis.timezone='UTC';assert.equal(timing.active(b).window.period.id,'BZ-DY-2');
});
for(const value of [false,0,'',null,[],true])test('explicit invalid options are rejected instead of defaulted: '+JSON.stringify(value),()=>{const raw=fixture('input.json');raw.options=value;assert.throws(()=>core.buildAndValidate(raw),/options 必须是对象/);});
test('invalid options also fail in relationship, time uncertainty and candidate-search nesting',()=>{
 const rel=fixture('relationship-single-input.json');rel.options=null;assert.throws(()=>core.buildAndValidate(rel),/options 必须是对象/);rel.options={partner_star_model:null};assert.throws(()=>core.buildAndValidate(rel),/partner_star_model/);delete rel.options;rel.people[0].options=false;assert.throws(()=>core.buildAndValidate(rel),/options 必须是对象/);
 const tc=fixture('time-compare-candidates-input.json');tc.birth_options=0;assert.throws(()=>core.buildAndValidate(tc),/options 必须是对象/);const ps=fixture('partner-search/years.json');ps.self.options=false;assert.throws(()=>load('partner-search').normalizeInput(ps),/options 必须是对象/);
});
test('omitted options and an empty object retain identical defaults and calculation artifacts',()=>{const raw=fixture('input.json');delete raw.options;assert.deepEqual(core.buildAndValidate(raw).data,core.buildAndValidate({...raw,options:{}}).data);});
for(const [simple,traditional] of [['红鸾','紅鸞'],['桃花和红鸾','桃花和紅鸞'],['红鸾与桃花','紅鸞與桃花'],['日坐伤官','日坐傷官'],['八字对象年龄','八字對象年齡'],['六爻动爻变爻','六爻動爻變爻']])test('traditional query shares normalization, ranking and full-text routes: '+traditional,()=>{
 assert.equal(search.normalize(traditional),search.normalize(simple));const a=retrieve({query:simple,limit:3}),b=retrieve({query:traditional,limit:3});assert.ok(a.matches.length);assert.deepEqual(b.matches.map(x=>[x.slug,x.score,x.read]),a.matches.map(x=>[x.slug,x.score,x.read]));assert.ok(budget.fits(b,12*1024));
});
