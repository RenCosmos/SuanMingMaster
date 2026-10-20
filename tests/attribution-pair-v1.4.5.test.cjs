'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const core=require('../scripts/runtime-core.cjs'),flow=require('../scripts/workflow.cjs'),ten=require('../scripts/ten-god-evidence.cjs'),pair=require('../scripts/pair-evidence.cjs'),budget=require('../scripts/output-budget.cjs'),{project}=require('../scripts/context.cjs'),rules=require('../scripts/bazi-rules.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-attribution145-')),fixture=n=>require('../examples/'+n);
const ordinary={...structuredClone(fixture('input.json')),mode:'bazi',target_date:'2026-10-15',options:{annual_count:5}};ordinary.birth.date='1996-06-02';
const tc={...structuredClone(fixture('time-compare-input.json')),chart_mode:'bazi',target_date:ordinary.target_date,time_uncertainty:{type:'unknown'}};
const data=core.buildAndValidate(ordinary).data,unknown=core.buildAndValidate(tc).data;
function task(name,raw){const file=path.join(tmp,name+'.json');fs.writeFileSync(file,JSON.stringify(raw));return flow.operation(['--input',file,'--out',path.join(tmp,name),'--brief','--focus','relationship']);}
const a=task('a',ordinary),b=task('b',tc),args=(name='pair')=>['--reuse',a.files.chart,'--pair-with',b.files.chart,'--out',path.join(tmp,name)];
function cli(exe,argv){const env={...process.env},prior=env.PATH||env.Path||'';for(const k of Object.keys(env))if(k.toUpperCase()==='PATH')delete env[k];env.PATH=[path.dirname(process.execPath),path.dirname(process.env.SUANMING_TEST_SH||'sh'),prior].join(path.delimiter);env.SUANMING_NODE=process.execPath.replaceAll('\\','/');return require('node:child_process').spawnSync(exe,exe===process.execPath?argv:argv.map(x=>x.replaceAll('\\','/')),{cwd:path.resolve(__dirname,'..'),encoding:'utf8',env,timeout:30000});}
test.after(()=>{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));fs.rmSync(tmp,{recursive:true,force:true});});
test('annual increment distinguishes visible 丁正官 from hidden 乙正财 in 丁未 without changing original timing',()=>{
 const before=core.hash(data),c=project(data,{focus:'relationship',page:'annual',base_checksum:data.checksum.value,limit:5});
 const y=c.reading.emotional_paths.timing.items.find(x=>x.year===2027);assert.ok(y);assert.deepEqual(y.partner_stars,['正财']);assert.deepEqual(y.partner_stars_visible,[]);assert.deepEqual(y.partner_stars_hidden.map(x=>[x.stem,x.ten_god,x.field]),[['乙','正财','hidden_stems']]);
 const p=c.reading.bazi.annual.items.find(x=>x.lichun_cycle_year===2027);assert.equal(p.ganzhi,'丁未');assert.equal(p.stem_ten_god,'正官');assert.equal(core.hash(data),before);
});
test('ten-god page separates natal from exact active DaYun with origin IDs and hidden indices',()=>{
 const info=ten.describe(data),active=require('../scripts/dayun-timing.cjs').active(data.bazi.chart).window.period;
 assert.equal(info.natal.scope,'natal');assert.equal(info.current_dayun.scope,'current_dayun');assert.equal(info.current_dayun.variants[0].ganzhi,active.ganzhi);
 assert.deepEqual(info.current_dayun.variants[0].visible,ten.exposure(active).visible);assert.deepEqual(info.current_dayun.variants[0].hidden,ten.exposure(active).hidden);
 for(const p of info.natal.known_pillars){assert.equal(p.visible.source_id,p.id);for(const h of p.hidden){assert.equal(h.field,'hidden_stems');assert.ok(Number.isInteger(h.index));}}
 assert.ok(info.interpretation_rules.some(x=>x.includes('原局十神')));
});
test('ten-god CLI reuses source and preserves full chart bytes',()=>{
 const before=fs.readFileSync(a.files.chart),r=flow.operation(['--reuse',a.files.chart,'--page','ten-gods','--base-checksum',data.checksum.value]);assert.equal(r.cache_hit,true);assert.equal(r.context.view_schema,'suanming-ten-god-evidence/v1');assert.ok(r.context.reading.ten_god_evidence);assert.ok(budget.fits(r,20480));assert.deepEqual(fs.readFileSync(a.files.chart),before);
});
test('unknown-time ten-god page groups current DaYun but never picks a default hour',()=>{
 const info=ten.describe(unknown);assert.equal(info.coverage.sample_count,unknown.candidates.length);assert.equal(info.natal.known_pillars.length,3);assert.deepEqual(info.natal.uncertain_pillars.map(x=>x.id),['BZ-HOUR']);
 assert.equal(info.current_dayun.variants.reduce((n,v)=>n+v.candidate_ids.length,0),info.coverage.sample_count);
 const r=flow.operation(['--reuse',b.files.chart,'--page','ten-gods','--base-checksum',unknown.checksum.value]);assert.equal(r.context.reading.ten_god_evidence.coverage.kind,'computed_candidates');assert.ok(budget.fits(r,20480));
});
test('ten-god page refuses unrelated filters and a different source checksum',()=>{
 const base=['--reuse',a.files.chart,'--page','ten-gods','--base-checksum',data.checksum.value];for(const more of [['--years','2026:2027'],['--offset','0'],['--flying-offset','0']])assert.throws(()=>flow.parse([...base,...more]),/不使用/);
 assert.throws(()=>project(data,{page:'ten-gods',base_checksum:'0'.repeat(64)}),/校验和不匹配/);
});
test('stable-pillar pair reuses both sources and all normal pagination argv execute within budgets',()=>{
 const saved=[a,b].flatMap(r=>Object.values(r.files).map(f=>[f,fs.readFileSync(f)]));let r=flow.operation([...args(),'--limit','2']),pages=0,matrix=[],cross=[];const key=r.pair_key;
 do{assert.equal(r.validation.ok,true);assert.equal(r.calculation_performed,false);assert.equal(r.context.full_pair,false);assert.equal(r.pair_key,key);assert.ok(budget.fits(r,20480));assert.ok(budget.measure(r).shell_bytes<28672);matrix.push(...r.context.reading.comparison.pillar_matrix.items);cross.push(...r.context.reading.comparison.cross_relations.items);pages++;assert.ok(pages<100);
  const next=r.next_actions[0];if(!next)break;assert.equal(next.required,true);assert.equal(flow.parse(next.argv).pair_key,key);r=flow.operation(next.argv);assert.equal(r.cache_hit,true);
 }while(true);
 const expected=pair.compare(ten.describe(data),ten.describe(unknown));assert.equal(matrix.length,12);assert.deepEqual(matrix,expected.pillar_matrix);assert.deepEqual(cross,expected.cross_relations);assert.ok(cross.length);assert.equal(r.context.pair_evidence.previous_pages_required,true);
 for(const [file,bytes] of saved)assert.deepEqual(fs.readFileSync(file),bytes,file+' must not change');
});
test('pair sources expose independent checksums, coverage and missing hour evidence',()=>{
 const r=flow.operation(args('scope'));assert.equal(r.context.sources[0].source_checksum,data.checksum.value);assert.equal(r.context.sources[1].source_checksum,unknown.checksum.value);assert.equal(r.context.sources[1].coverage.kind,'computed_candidates');assert.deepEqual(r.context.pair_evidence.missing,[{person_id:'b',source_id:'BZ-HOUR',reason:'pillar_varies_with_birth_time'}]);assert.ok(r.context.pair_evidence.not_computed.includes('ziwei_comparison'));
 assert.ok(r.context.reading.comparison.pillar_matrix.items.every(x=>x.sources.every(p=>!(p.person_id==='b'&&p.source_id==='BZ-HOUR'))));
});
test('known-time bridge has exactly the same cross facts as the existing full relationship rules',()=>{
 const raw=structuredClone(fixture('relationship-pair-input.json')),rel=core.buildAndValidate(raw).data;const infos=rel.people.map(p=>ten.describe(p.chart));const got=pair.compare(...infos),want=rel.comparison.bazi;
 assert.equal(got.pillar_matrix.length,16);for(let i=0;i<16;i++){const {id,relations,...g}=got.pillar_matrix[i],{id:old,relations:rs,...w}=want.pillar_matrix[i];assert.deepEqual(g,w);assert.deepEqual(relations.map(({id,...r})=>r),rs.map(({id,...r})=>r));}assert.deepEqual(got.cross_relations.map(({id,...r})=>r),want.cross_relations.map(({id,...r})=>r));
});
test('day-master uncertainty returns null projections instead of choosing a candidate',()=>{
 const info=ten.describe(data),vary=structuredClone(info);vary.day_master={status:'varies',values:['庚','辛']};const r=pair.compare(vary,info);assert.equal(r.day_master_projection.a_to_b,null);assert.ok(r.pillar_matrix.every(x=>x.a_to_b_ten_god===null));assert.ok(r.pillar_matrix.every(x=>x.b_to_a_ten_god===rules.tenGod('庚',x.a_ganzhi[0])));
});
test('pair requires distinct sources, independent output and strict arguments',()=>{
 assert.throws(()=>flow.operation(['--reuse',a.files.chart,'--pair-with',a.files.chart,'--out',path.join(tmp,'same')]),/不同/);assert.throws(()=>flow.operation(['--reuse',a.files.chart,'--pair-with',b.files.chart,'--out',path.dirname(a.files.chart)]),/独立/);
 for(const more of [['--years','2026:2027'],['--report'],['--person','a'],['--offset','-1'],['--limit','11'],['--focus','annual'],['--pair-key','abc'],['--pair-with',b.files.chart]])assert.throws(()=>flow.parse([...args(),...more]));
});
test('pair refuses a different identity or source order without overwriting the existing page',()=>{
 const r=flow.operation(args('binding')),bytes=fs.readFileSync(r.files.context);assert.throws(()=>flow.operation([...args('binding'),'--pair-key','0'.repeat(64)]),/pair_key/);assert.throws(()=>flow.operation(['--reuse',b.files.chart,'--pair-with',a.files.chart,'--out',path.dirname(r.files.context)]),/不同交叉证据/);assert.deepEqual(fs.readFileSync(r.files.context),bytes);
});
test('unreceipted sources are reverified only once and their files remain untouched',()=>{
 const dir=path.join(tmp,'raw');fs.mkdirSync(dir);const x=path.join(dir,'raw-a.json'),y=path.join(dir,'raw-b.json');fs.writeFileSync(x,JSON.stringify(data));fs.writeFileSync(y,JSON.stringify(unknown));const before=fs.readdirSync(dir),argv=['--reuse',x,'--pair-with',y,'--out',path.join(tmp,'raw-pair')];
 const r=flow.operation(argv);assert.deepEqual(r.validation.source_methods,['recalculated','recalculated']);assert.equal(flow.operation(argv).cache_hit,true);assert.deepEqual(fs.readdirSync(dir),before);
});
test('tampered source is rejected before any pair output publication',()=>{
 const p=path.join(tmp,'tampered.json'),broken=structuredClone(data);broken.bazi.chart.day_master='甲';fs.writeFileSync(p,JSON.stringify(broken));const out=path.join(tmp,'tamper-pair');assert.throws(()=>flow.operation(['--reuse',p,'--pair-with',b.files.chart,'--out',out]),/校验和/);assert.equal(fs.existsSync(path.join(out,'pair-context.json')),false);
});
test('pair rejects unsupported or already-two-person sources and mismatched target dates',()=>{
 const both=task('two',fixture('relationship-pair-input.json'));assert.throws(()=>flow.operation(['--reuse',both.files.chart,'--pair-with',b.files.chart,'--out',path.join(tmp,'bad-two')]),/单人/);
 const different=task('different',{...ordinary,target_date:'2027-10-15'});assert.throws(()=>flow.operation(['--reuse',different.files.chart,'--pair-with',b.files.chart,'--out',path.join(tmp,'bad-date')]),/target_date/);
 const z=task('ziwei',{...ordinary,mode:'ziwei'});assert.throws(()=>flow.operation(['--reuse',z.files.chart,'--pair-with',b.files.chart,'--out',path.join(tmp,'bad-z')]),/八字/);
});
test('long paths preserve bounded complete pair pages rather than cutting JSON',()=>{
 const dir=path.join(tmp,...Array(9).fill('long-task-xxxxxxxxxxxxxx')),r=flow.operation(['--reuse',a.files.chart,'--pair-with',b.files.chart,'--out',dir,'--limit','10']);assert.ok(budget.fits(r,20480));assert.ok(r.context.reading.comparison.cross_relations.items.length);for(const x of r.next_actions)assert.doesNotThrow(()=>flow.parse(x.argv));
});
test('two uncertain-time sources use only their common pillars, not a candidate Cartesian product',()=>{
 const other=task('unknown-two',{...tc,birth:{...tc.birth,date:'1994-05-17'}}),r=flow.operation(['--reuse',b.files.chart,'--pair-with',other.files.chart,'--out',path.join(tmp,'two-unknown')]);assert.equal(r.context.reading.comparison.pillar_matrix.total,9);assert.equal(r.context.pair_evidence.missing.length,2);assert.ok(r.context.sources.every(s=>s.coverage.sample_count>10));
});
test('late-Zi day-master variation remains variable in actual sampled ten-god evidence',()=>{
 const edge=core.buildAndValidate({...tc,birth_options:{bazi_day_boundary:'late_zi'}}).data,info=ten.describe(edge);assert.equal(info.day_master.status,'varies');assert.ok(info.natal.uncertain_pillars.some(p=>p.id==='BZ-DAY'));assert.ok(info.natal.known_pillars.every(p=>p.visible.ten_god===null&&p.visible.ten_god_variants.length===2));
});
test('actual Node and mobile CLI entrypoints expose trusted receipts before pair dispatch',()=>{
 const root=path.resolve(__dirname,'..'),argv=args('real-cli');
 const run=(exe,flags)=>{const r=cli(exe,flags);assert.equal(r.status,0,r.stderr);assert.doesNotMatch(r.stderr,/circular dependency/);return JSON.parse(r.stdout);};
 const first=run(process.execPath,[path.join(root,'scripts/workflow.cjs'),...argv]);assert.equal(first.validation.ok,true);
 const second=run(process.env.SUANMING_TEST_SH||'sh',[path.join(root,'scripts/mobile.sh'),...argv]);assert.equal(second.cache_hit,true);assert.equal(first.pair_key,second.pair_key);
});
test('new pair output and receipt cannot be accidentally consumed as temporary input',()=>{
 const root=path.resolve(__dirname,'..'),r=flow.operation(args('protected'));
 for(const file of Object.values(r.files)){const bytes=fs.readFileSync(file);for(const [exe,start] of [[process.execPath,[path.join(root,'scripts/workflow.cjs')]],[process.env.SUANMING_TEST_SH||'sh',[path.join(root,'scripts/mobile.sh')]]]){const p=cli(exe,[...start,'--temp-input',file,'--out',path.join(tmp,'not-input')]);assert.equal(p.status,2,p.stderr);assert.deepEqual(fs.readFileSync(file),bytes);}}
});
