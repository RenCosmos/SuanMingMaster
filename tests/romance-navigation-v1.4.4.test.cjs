'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const core=require('../scripts/runtime-core.cjs'),flow=require('../scripts/workflow.cjs'),{project}=require('../scripts/context.cjs'),budget=require('../scripts/output-budget.cjs');
const root=path.resolve(__dirname,'..'),fixture=n=>JSON.parse(fs.readFileSync(path.join(root,'examples',n),'utf8'));
const single=core.buildAndValidate(fixture('relationship-single-input.json')).data,ordinary=core.buildAndValidate(fixture('input.json')).data;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-navigation144-'));
test.after(()=>{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));fs.rmSync(tmp,{recursive:true,force:true});});
function task(name,raw,argv){const input=path.join(tmp,name+'.json');fs.writeFileSync(input,JSON.stringify(raw));return flow.operation(['--input',input,'--out',path.join(tmp,name),...argv]);}
function chart(c){return c.reading.people?.[0].chart??c.reading;}

test('overview retains every non-annual theme fact and both emotional tracks, without mutating the artifact',()=>{
 for(const d of [ordinary,single]){
  const before=core.hash(d),full=project(d,{focus:'relationship',brief:true,limit:10}),c=project(d,{focus:'relationship',overview:true,limit:10});
  assert.equal(c.view,'overview');const expected=structuredClone(full.reading),rows=expected.people??[{chart:expected,emotional_paths:expected.emotional_paths}];
  for(const p of rows){delete p.chart.bazi.annual;delete p.emotional_paths.timing;p.emotional_paths.timing_deferred=true;}
  assert.deepEqual(c.reading,expected);assert.ok(chart(c).bazi.theory_evidence.day_master_roots);assert.ok(chart(c).ziwei.related_palaces.length);assert.ok(!chart(c).bazi.annual);assert.equal(core.hash(d),before);
 }
});
test('overview default capacity includes actual spouse flights and only offers optional annual expansion',()=>{
 const r=flow.boundedResponse({ok:true,files:{chart:path.join(tmp,'overview/chart.json')}},ordinary,{focus:'relationship',overview:true,brief:true});
 const flight=chart(r.context).ziwei.palace_stem_flying;assert.deepEqual(flight.items,project(ordinary,{focus:'relationship'}).reading.ziwei.palace_stem_flying);assert.equal(flight.next_offset,null);
 assert.equal(r.output.effective_limit,10);assert.ok(r.next_actions.length);assert.ok(r.next_actions.every(x=>x.required===false));assert.equal(r.next_actions[0].page,'annual');assert.equal(r.next_actions[0].base_checksum,ordinary.checksum.value);
});
test('incremental annual argv recovers every year and exact intersecting DaYun, without repeating natal facts',()=>{
 const raw=fixture('relationship-single-input.json');raw.people[0].options={annual_count:8};
 let r=task('annual',raw,['--focus','romance','--brief','--limit','2']);const bytes=fs.readFileSync(r.files.chart),d=JSON.parse(bytes),all=project(d,{focus:'annual',person:'a',limit:10}).reading.people[0].chart.bazi.annual.items;
 const years=[...chart(r.context).bazi.annual.items];let pages=0,action=r.next_actions.find(x=>x.page==='annual');
 while(action){r=flow.operation(action.argv);pages++;assert.ok(pages<=10);assert.equal(r.cache_hit,true);assert.equal(r.calculation_performed,false);assert.equal(r.context.view,'evidence_page');assert.equal(r.context.base_context.source_checksum,d.checksum.value);
  const b=chart(r.context).bazi;assert.ok(!b.pillars&&!b.theory_evidence&&!b.natal_relations&&!b.dayun_sequence);const expected=project(d,{focus:'annual',person:'a',offset:r.context.selection.offset,limit:r.context.selection.limit}).reading.people[0].chart.bazi;assert.deepEqual(b.dayun,expected.dayun);
  assert.equal(r.context.reading.people[0].emotional_paths.timing.items.length,b.annual.items.length);years.push(...b.annual.items);assert.ok(budget.fits(r,20*1024));action=r.next_actions.find(x=>x.page==='annual');
 }
 assert.ok(pages>0);assert.deepEqual(years,all);assert.deepEqual(fs.readFileSync(r.files.chart),bytes);
});
test('incremental flying argv recovers all source records and does not return annual or natal fields',()=>{
 let r=task('flying',fixture('input.json'),['--focus','career','--brief','--limit','2']);const bytes=fs.readFileSync(r.files.chart),d=JSON.parse(bytes),want=project(d,{focus:'career'}).reading.ziwei.palace_stem_flying;
 const flights=[...r.context.reading.ziwei.palace_stem_flying.items];let action=r.next_actions.find(x=>x.page==='flying'),pages=0;
 while(action){r=flow.operation(action.argv);assert.ok(++pages<=20);assert.equal(r.context.selection.offset,0);assert.deepEqual(Object.keys(r.context.reading),['ziwei']);assert.deepEqual(Object.keys(r.context.reading.ziwei),['flying_scope','palace_stem_flying']);flights.push(...r.context.reading.ziwei.palace_stem_flying.items);assert.equal(r.cache_hit,true);action=r.next_actions.find(x=>x.page==='flying');}
 assert.deepEqual(flights,want);assert.deepEqual(fs.readFileSync(r.files.chart),bytes);
});
test('page rejects a different base checksum without publishing over the existing context',()=>{
 const r=task('checksum',fixture('input.json'),['--overview']),before=fs.readFileSync(r.files.context),chartBytes=fs.readFileSync(r.files.chart);
 assert.throws(()=>flow.operation(['--reuse',r.files.chart,'--page','annual','--base-checksum','0'.repeat(64)]),/校验和不匹配/);assert.deepEqual(fs.readFileSync(r.files.context),before);assert.deepEqual(fs.readFileSync(r.files.chart),chartBytes);
});
test('base restoration argv returns complete theme evidence rather than another incremental page',()=>{
 const r=task('restore',fixture('input.json'),['--overview']),action=r.next_actions.find(x=>x.page==='annual'),p=flow.operation(action.argv),restored=flow.operation(p.context.base_context.restore_argv);
 assert.equal(restored.context.source_checksum,p.context.source_checksum);assert.ok(chart(restored.context).bazi.pillars);assert.ok(chart(restored.context).ziwei.related_palaces);assert.notEqual(restored.context.view,'evidence_page');assert.equal(restored.cache_hit,true);
});
test('invalid overview and page option combinations fail explicitly',()=>{
 for(const argv of [['--overview','--focus','career'],['--overview','--years','2026:2028'],['--overview','--offset','0'],['--page','unknown','--base-checksum','a'.repeat(64)],['--page','annual'],['--page','annual','--base-checksum','abc'],['--base-checksum','a'.repeat(64)],['--page','annual','--base-checksum','a'.repeat(64),'--comparison']])assert.throws(()=>flow.parse(['--reuse','chart.json',...argv]));
 assert.throws(()=>flow.parse(['--stdin','--out','task','--page','annual','--base-checksum','a'.repeat(64)]),/reuse/);
});
test('overview refuses pair, time compare and divination; pair pages require an explicit person',()=>{
 const pair=core.buildAndValidate(fixture('relationship-pair-input.json')).data;assert.throws(()=>project(pair,{focus:'relationship',overview:true}),/双人/);
 for(const mode of ['time_compare','divination'])assert.throws(()=>project({input:{mode}}, {focus:'relationship',overview:true}),/时辰对照或六爻/);
 assert.throws(()=>project(pair,{focus:'annual',page:'annual',base_checksum:pair.checksum.value}),/person/);
 const c=project(pair,{focus:'annual',page:'annual',person:'b',base_checksum:pair.checksum.value});assert.equal(c.reading.people.length,1);assert.equal(c.reading.people[0].person_id,'b');
});
test('long-path overview fallback retains facts and returns bounded executable continuations',()=>{
 const file=path.join(tmp,...Array(32).fill('quoted-path-"-xxxxxxxx'),'chart.json');
 const r=flow.boundedResponse({ok:true,files:{chart:file}},single,{focus:'relationship',overview:true,brief:true});assert.ok(budget.fits(r,20*1024));assert.ok(budget.measure(r).shell_bytes<28*1024);assert.ok(chart(r.context).bazi.pillars);assert.ok(chart(r.context).ziwei.related_palaces);for(const a of r.next_actions)assert.doesNotThrow(()=>flow.parse(a.argv));
});
test('required navigation distinguishes requested annual range from optional follow-up and pair evidence',()=>{
 const base={ok:true,files:{chart:path.join(tmp,'navigation/chart.json')}};
 const annual=flow.boundedResponse(base,ordinary,{focus:'annual',brief:true,limit:1});assert.equal(annual.next_actions.find(x=>x.page==='annual').required,true);
 const romance=flow.boundedResponse(base,ordinary,{focus:'relationship',brief:true,limit:1});assert.equal(romance.next_actions.find(x=>x.page==='annual').required,false);
 const pair=core.buildAndValidate(fixture('relationship-pair-input.json')).data,r=flow.boundedResponse(base,pair,{focus:'relationship',person:'a',brief:true});assert.equal(r.next_actions.find(x=>x.comparison).required,true);
});
test('legacy full projections remain available and incremental page payload is substantially smaller',()=>{
 const full=project(ordinary,{focus:'relationship'}),page=project(ordinary,{focus:'relationship',page:'flying',flying_offset:3,limit:3,base_checksum:ordinary.checksum.value});assert.ok(Array.isArray(full.reading.ziwei.palace_stem_flying));assert.ok(full.reading.bazi.annual);assert.ok(full.reading.bazi.pillars);assert.ok(JSON.stringify(page).length<JSON.stringify(full).length/2);
});
test('visible and hidden stem facts remain separate and guidance forbids empty-palace shortcut',()=>{
 const c=project(ordinary,{focus:'annual',brief:true});for(const y of c.reading.bazi.annual.items){const original=ordinary.bazi.chart.annual.find(x=>x.id===y.id);assert.equal(y.stem_ten_god,original.stem_ten_god);assert.deepEqual(y.hidden_ten_gods,original.hidden_ten_gods);}
 assert.ok(c.interpretation_rules.some(x=>x.includes('藏干出现不等于透出')));assert.ok(c.interpretation_rules.some(x=>x.includes('不单凭空宫断异地缘弱')));
});
test('quickstart routes basic romance without loading advanced schemas and help advertises both views',()=>{
 const skill=fs.readFileSync(path.join(root,'SKILL.md'),'utf8'),quick=fs.readFileSync(path.join(root,'references/romance-quickstart.md'),'utf8'),help=flow.operation(['--help']);assert.ok(skill.includes('romance-quickstart.md'));assert.ok(quick.includes('--overview'));assert.ok(quick.includes('required_for'));assert.ok(help.includes('--overview')&&help.includes('--base-checksum'));
});
