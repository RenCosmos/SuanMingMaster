'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const core=require('../scripts/runtime-core.cjs'),flow=require('../scripts/workflow.cjs'),engine=require('../scripts/engine.cjs');
const {retrieve}=require('../scripts/knowledge-context.cjs'),knowledge=require('../scripts/knowledge.cjs');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-feedback131-'));
test.after(()=>{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));fs.rmSync(tmp,{recursive:true,force:true});});
const fixture=n=>JSON.parse(fs.readFileSync(path.join(root,'examples',n),'utf8'));
function input(name,data){const p=path.join(tmp,name+'.json');fs.writeFileSync(p,JSON.stringify(data));return p;}
function shell(argv){
 const sh=process.env.SUANMING_TEST_SH||'sh',env={...process.env},prior=process.env.PATH||process.env.Path||'';
 for(const key of Object.keys(env))if(key.toUpperCase()==='PATH')delete env[key];env.PATH=[path.dirname(process.execPath),...(path.isAbsolute(sh)?[path.dirname(sh)]:[]),prior].join(path.delimiter);
 const p=s=>process.platform==='win32'&&/^[a-z]:[\\/]/i.test(s)?s.replaceAll('\\','/'):s;
 const r=cp.spawnSync(sh,[p(path.join(root,'scripts/mobile.sh')),...argv.map(p)],{encoding:'utf8',cwd:tmp,env,timeout:30000,maxBuffer:128*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
}
test('new partner task without out fails before reading stdin; complete command works',()=>{
 const partner=require('../scripts/partner-search-workflow.cjs');assert.throws(()=>partner.parse(['--stdin']),/新搜索需要 --out/);
 const f=input('partner',fixture('partner-search/years.json')),r=flow.operation(['--input',f,'--partner-search','--out',path.join(tmp,'partner')]);assert.equal(r.ok,true);assert.ok(r.files.chart);
});
test('annual returned argv runs through mobile without reconstructing selectors',()=>{
 const raw=fixture('input.json');raw.target_date='2026-10-08';raw.options={annual_count:8};
 const first=flow.operation(['--input',input('annual',raw),'--out',path.join(tmp,"annual ' spaced"),'--focus','annual','--years','2027:2030','--limit','1']);
 const a=first.next_actions.find(a=>a.action==='reuse');assert.ok(a.argv);assert.equal(a.entrypoint,'scripts/mobile.sh');
 const follow=shell(a.argv);assert.equal(follow.task_id,first.task_id);assert.equal(follow.cache_hit,true);assert.deepEqual(follow.context.selection.years,[2027,2030]);assert.equal(follow.context.selection.offset,1);assert.equal(follow.context.selection.limit,1);assert.equal(follow.context.reading.bazi.annual.items[0].lichun_cycle_year,2028);
});
test('partner returned argv keeps mode and collects every candidate without omissions',()=>{
 const first=flow.operation(['--input',input('search-nav',fixture('partner-search/years.json')),'--partner-search','--out',path.join(tmp,'search-nav'),'--limit','1']);
 let r=first,ids=[];do{ids.push(...r.context.candidates.items.map(c=>c.id));if(r.context.candidates.next_offset===null)break;
  const a=r.next_actions[0];assert.ok(a.argv.includes('--partner-search'));assert.deepEqual(r.context.next_actions,r.next_actions);r=shell(a.argv);assert.equal(r.cache_hit,true);assert.equal(r.task_id,first.task_id);
 }while(true);assert.deepEqual(ids,core.readJson(first.files.chart).candidates.map(c=>c.id));assert.equal(new Set(ids).size,ids.length);
});
test('time-comparison field and variant argv expands exactly the requested variant',()=>{
 const first=flow.operation(['--input',input('time',fixture('time-compare-candidates-input.json')),'--out',path.join(tmp,'time'),'--limit','1']);
 const saved=core.readJson(first.files.chart),field=saved.comparison.fields.find(f=>f.variants.length>1);
 const selected=flow.operation(['--reuse',first.files.chart,'--focus','time_compare','--field',field.id,'--limit','1']);
 const a=selected.next_actions.find(a=>a.variant_offset===1),r=shell(a.argv);assert.equal(r.context.selection.field,field.id);assert.equal(r.context.selection.variant_offset,1);assert.deepEqual(r.context.reading.fields.items[0].variants[0].value,field.variants[1].value);
});
test('person continuation argv preserves person and focus; new calculation is not executable',()=>{
 const data=core.buildAndValidate(fixture('relationship-pair-input.json')).data;
 const r=flow.boundedResponse({ok:true,files:{chart:'/workspace/explicit/chart.json'},people_page:{next_person:'b'}},data,{focus:'annual',person:'a',years:[2080,2082],limit:1});
 const a=r.next_actions.find(a=>a.action==='reuse');assert.ok(a.argv.includes('b'));assert.ok(a.argv.includes('annual'));assert.ok(a.argv.includes('2080:2082'));
 const next=r.next_actions.find(a=>a.action==='new_calculation');assert.ok(next);assert.equal(next.argv,undefined);
});
test('shared pair boundary metadata keeps both people inside unchanged output budget',()=>{
 const data=core.buildAndValidate(fixture('relationship-pair-input.json')).data;
 const r=flow.boundedResponse({ok:true,files:{chart:'/workspace/bazi-ziwei-reports/pair/chart.json'}},data,{focus:'relationship'});
 assert.deepEqual(r.context.reading.people.map(p=>p.person_id),['a','b']);assert.deepEqual(r.context.reading.ziwei_boundaries,{natal:'year_boundary',transit_year:'lunar_new_year',transit_month:'lunar_month'});
 for(const p of r.context.reading.people)assert.equal(p.chart.ziwei.conventions.year_boundary,data.people.find(x=>x.id===p.person_id).chart.ziwei.chart.conventions.natal_year_boundary);
 assert.ok(Buffer.byteLength(JSON.stringify(r))<=20*1024);
});
test('development test runner refuses zero tests instead of success',()=>{
 const dir=path.join(tmp,'no-tests');fs.mkdirSync(dir);fs.mkdirSync(path.join(dir,'scripts'));fs.copyFileSync(path.join(root,'scripts/test-runner.cjs'),path.join(dir,'scripts/test-runner.cjs'));
 for(const argv of [[],['--critical']]){const r=cp.spawnSync(process.execPath,[path.join(dir,'scripts/test-runner.cjs'),...argv],{encoding:'utf8'});assert.equal(r.status,2);assert.match(r.stderr,/不包含开发测试/);assert.match(r.stderr,/npm run check/);assert.equal(r.stdout,'');}
});
test('missing critical test file refuses partial development success',()=>{
 const dir=path.join(tmp,'partial-tests');fs.mkdirSync(dir);fs.mkdirSync(path.join(dir,'tests'));fs.mkdirSync(path.join(dir,'scripts'));fs.copyFileSync(path.join(root,'scripts/test-runner.cjs'),path.join(dir,'scripts/test-runner.cjs'));fs.writeFileSync(path.join(dir,'tests/critical.test.cjs'),'throw Error("must not execute partial suite")');
 const r=cp.spawnSync(process.execPath,[path.join(dir,'scripts/test-runner.cjs'),'--critical'],{encoding:'utf8'});assert.equal(r.status,2);assert.match(r.stderr,/不包含开发测试/);assert.ok(!r.stderr.includes('must not execute'));
});
test('check remains the original twelve critical groups, not the full development suite',()=>{
 const r=cp.spawnSync(process.execPath,[path.join(root,'scripts/preflight.cjs'),'--self-test'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout);assert.equal(result.critical.total,12);assert.equal(result.critical.passed,12);
 const pkg=require('../package.json');assert.equal(pkg.scripts.test,'node scripts/test-runner.cjs');assert.equal(pkg.scripts['test:critical'],'node scripts/test-runner.cjs --critical');
});
const birth={calendar:'solar',date:'2000-08-16',time:'03:30',gender:'female',timezone:'Asia/Shanghai'};
for(const [date,bazi,ziwei] of [['2024-02-03','癸卯','癸卯'],['2024-02-05','甲辰','癸卯'],['2024-02-10','甲辰','甲辰']])test('natal versus horoscope labels at '+date,()=>{
 const r=engine.build({mode:'both',birth,target_date:date,options:{ziwei_year_boundary:'lichun'}}),z=r.ziwei.chart;
 assert.equal(z.conventions.year_boundary,'lichun');assert.equal(z.conventions.natal_year_boundary,'lichun');assert.equal(z.conventions.year_boundary_scope,'natal_only');assert.equal(z.conventions.horoscope_year_boundary,'lunar_new_year');assert.equal(z.conventions.horoscope_month_boundary,'lunar_month');assert.equal(r.bazi.chart.target.year_ganzhi,bazi);assert.equal(z.target.yearly.heavenlyStem+z.target.yearly.earthlyBranch,ziwei);engine.validateArtifact(r);
 const context=require('../scripts/context.cjs').project(r,{focus:'annual'});assert.equal(context.reading.ziwei.conventions.horoscope_year_boundary,'lunar_new_year');
 const report=require('../scripts/report.cjs').makeReport(r);assert.ok(report.markdown.includes('| 本命年界 | lichun |'));assert.ok(report.markdown.includes('| 运限年界 | lunar_new_year |'));
});
test('natal options do not leak into horoscope configuration or later calls',()=>{
 const a=engine.build({mode:'both',birth,target_date:'2024-02-05',options:{ziwei_year_boundary:'lichun'}}),b=engine.build({mode:'both',birth,target_date:'2024-02-05'});
 assert.equal(b.ziwei.chart.conventions.natal_year_boundary,'lunar_new_year');assert.deepEqual(a.ziwei.chart.target,b.ziwei.chart.target);
});
function legacy(data){
 const out=structuredClone(data);
 function visit(v){if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v))if(k!=='checksum')visit(x);
  if(v.schema_version==='bazi-ziwei/v1'&&v.ziwei)for(const key of ['natal_year_boundary','horoscope_year_boundary','horoscope_month_boundary','year_boundary_scope'])delete v.ziwei.chart.conventions[key];
  if(v.checksum?.algorithm==='sha256-canonical-json'){const {checksum,...payload}=v;v.checksum={...checksum,value:core.hash(payload)};}
 }visit(out);return out;
}
for(const name of ['input.json','relationship-pair-input.json','time-compare-candidates-input.json'])test('legacy unlabelled '+name+' still validates and is not rewritten',()=>{
 const data=legacy(core.buildAndValidate(fixture(name)).data),dir=path.join(tmp,'legacy-'+name);fs.mkdirSync(dir);const chart=path.join(dir,'chart.json');core.atomicJson(chart,data);const before=fs.readFileSync(chart);
 const r=flow.operation(['--reuse',chart]);assert.equal(r.validation.recalculated,true);assert.deepEqual(fs.readFileSync(chart),before);assert.equal(flow.operation(['--reuse',chart]).cache_hit,true);
});
test('metadata compatibility never accepts relabelled or recalculated chart tampering',()=>{
 const d=engine.build({mode:'both',birth,target_date:'2024-02-05'});d.ziwei.chart.conventions.horoscope_year_boundary='lichun';const {checksum,...payload}=d;d.checksum={...checksum,value:core.hash(payload)};assert.throws(()=>engine.validateArtifact(d),/重算不一致/);
 const old=legacy(engine.build({mode:'both',birth}));old.bazi.chart.pillars[2].ganzhi='甲子';const {checksum:c,...p}=old;old.checksum={...c,value:core.hash(p)};assert.throws(()=>engine.validateArtifact(old),/重算不一致/);
});
for(const [query,slug] of [['官杀混杂是什么意思','bazi-authority-mixed'],['官煞混雜是什麼意思','bazi-authority-mixed'],['什么叫财多身弱','bazi-wealth-weak-self'],['財旺身弱的含義','bazi-wealth-weak-self'],['伤官见官是什么意思','bazi-hurting-officer'],['如何判断喜用神','bazi-favorable-god']])test('Chinese concept query: '+query,()=>{
 const r=retrieve({query,limit:3});assert.equal(r.matches[0].slug,slug);assert.equal(r.retrieval.domain,'bazi');assert.ok(r.matches.every(t=>t.domains.includes('bazi')));assert.ok(!r.matches.some(t=>t.slug==='wenwang-liuyao'));
 const full=knowledge.lookup({topic:slug});assert.ok(full.content.length>300);assert.equal(full.topic.program_supported,false);assert.ok(full.content.includes('出处：'));assert.ok(full.topic.inference_limits.length);
});
test('explicit domain and ambiguous 用神 do not silently impose Bazi on Liuyao',()=>{
 assert.equal(retrieve({query:'六爻用神怎么取',limit:1}).matches[0].slug,'liuyao-use-god');
 assert.equal(retrieve({query:'用神',domain:'liuyao',limit:1}).matches[0].slug,'liuyao-use-god');
 assert.equal(retrieve({query:'用神',limit:3}).retrieval.domain,null);
 assert.throws(()=>retrieve({query:'用神',domain:'all'}),/domain/);assert.throws(()=>retrieve({topic:'ziping-bazi',domain:'bazi'}),/domain/);
});
test('longest term excludes the ambiguous 用神 substring and performs at most one fallback',()=>{
 const search=require('../scripts/knowledge-search.cjs');assert.deepEqual(search.plan('如何判断喜用神').terms,['喜用神']);
 const topics=[{id:'x',slug:'x',name:'特殊格局',tags:[],subtitle:'说明',path:'x',domain:'bazi'}];
 const r=search.search(topics,'请问特殊格局是什么意思',3,()=> '有实质定义');assert.equal(r.matches[0].id,'x');assert.equal(r.retrieval.fallback_used,true);assert.equal(r.retrieval.attempts,2);
 const empty=search.search(topics,'请问未收录术语是什么意思',3,()=> '有实质定义');assert.deepEqual(empty.matches,[]);assert.equal(empty.retrieval.attempts,2);
});
test('every snippet and body is explicitly untrusted while original prompt text is preserved',()=>{
 const r=retrieve({query:'八字',limit:10});assert.equal(r.instruction_authority,'none');for(const t of r.matches){assert.equal(t.content_type,'reference_material');assert.equal(t.trust_level,'untrusted_reference_text');assert.equal(t.instruction_authority,'none');}
 const full=knowledge.lookup({topic:'ziping-bazi'});let content='',offset=0;do{const p=retrieve({topic:'ziping-bazi',offset,chars:900});assert.equal(p.topic.instruction_authority,'none');content+=p.topic.content;offset=p.topic.next_offset;}while(offset!==null);assert.equal(content,full.content);assert.ok(content.includes('角色'));assert.equal(full.instruction_authority,'none');
});
test('knowledge domain CLI and total preserve all old topics plus four concepts under output budget',()=>{
 const r=cp.spawnSync(process.execPath,[path.join(root,'scripts/knowledge-context.cjs'),'--query','如何判断喜用神','--domain','bazi','--limit','3'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).matches[0].slug,'bazi-favorable-god');assert.ok(Buffer.byteLength(r.stdout)<12*1024);
 const k=knowledge.verifyKnowledge();assert.equal(k.total_topics,103);assert.equal(k.total_topics-k.bazi_concept_topics-k.liuyao_concept_topics,93);assert.equal(k.bazi_concept_topics,4);
});
