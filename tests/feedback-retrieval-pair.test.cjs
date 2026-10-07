'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const core=require('../scripts/runtime-core.cjs'),flow=require('../scripts/workflow.cjs'),{project}=require('../scripts/context.cjs');
const {retrieve}=require('../scripts/knowledge-context.cjs'),knowledge=require('../scripts/knowledge.cjs'),search=require('../scripts/knowledge-search.cjs');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-review-'));
test.after(()=>{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));fs.rmSync(tmp,{recursive:true,force:true});});
const fixture=n=>JSON.parse(fs.readFileSync(path.join(root,'examples',n),'utf8'));
const pair=core.buildAndValidate(fixture('relationship-pair-input.json')).data;
function limited(r){const stdout=JSON.stringify(r)+'\n';assert.ok(Buffer.byteLength(stdout)<=20*1024);assert.ok(Buffer.byteLength(JSON.stringify({stdout}))<28*1024);assert.equal(r.output.bytes,Buffer.byteLength(stdout));}
function shell(argv,input){
 const sh=process.env.SUANMING_TEST_SH||'sh',env={...process.env},prior=process.env.PATH||process.env.Path||'';
 for(const key of Object.keys(env))if(key.toUpperCase()==='PATH')delete env[key];env.PATH=[path.dirname(process.execPath),...(path.isAbsolute(sh)?[path.dirname(sh)]:[]),prior].join(path.delimiter);
 const p=s=>process.platform==='win32'&&/^[a-z]:[\\/]/i.test(s)?s.replaceAll('\\','/'):s;
 const r=cp.spawnSync(sh,[p(path.join(root,'scripts/mobile.sh')),...argv.map(p)],{encoding:'utf8',input:input?JSON.stringify(input):undefined,cwd:tmp,env,timeout:30000,maxBuffer:128*1024});
 assert.ifError(r.error);assert.equal(r.status,0,r.stderr);const value=JSON.parse(r.stdout);if(value.output?.max_bytes===20*1024)limited(value);else assert.ok(Buffer.byteLength(r.stdout)<=12*1024);return value;
}
for(const query of ['《礼记·月令》','《禮記·月令》','礼记 月令','请解释《礼记·月令》的仲夏禁忌'])test('explicit classical identity precedes Bazi term inference: '+query,()=>{
 const r=retrieve({query,limit:3});assert.equal(r.matches[0].slug,'folk-liji-yueling-summer');assert.equal(r.retrieval.filter_domain,null);
 assert.equal(r.retrieval.domain_source,'reference');assert.ok(r.retrieval.reference_titles.includes('礼记月令'));assert.equal(r.matches[0].instruction_authority,'none');assert.ok(r.matches[0].source_url.includes('月令'));
});
test('mixed classical and Bazi questions retrieve both references without a domain override',()=>{
 for(const query of ['《礼记·月令》与八字月令有什么区别','《礼记·月令》和《滴天髓》的月令有什么区别']){
  const r=retrieve({query,limit:3});assert.ok(r.matches.some(x=>x.slug==='folk-liji-yueling-summer'));assert.ok(r.matches.some(x=>x.slug==='kb-classic-month-command'));assert.equal(r.retrieval.filter_domain,null);
 }
});
test('automatic Bazi ranking no longer excludes a relevant folklore card',()=>{
 const r=retrieve({query:'八字月令',limit:10});assert.equal(r.matches[0].slug,'kb-classic-month-command');assert.equal(r.retrieval.domain,'bazi');assert.equal(r.retrieval.filter_domain,null);assert.ok(r.matches.some(x=>x.slug==='folk-liji-yueling-summer'));
});
test('only caller-selected domains strictly filter matches, including conflicting titles',()=>{
 const a=retrieve({query:'《礼记·月令》',domain:'folklore',limit:3});assert.equal(a.matches[0].slug,'folk-liji-yueling-summer');assert.equal(a.retrieval.domain_source,'explicit');assert.equal(a.retrieval.filter_domain,'folklore');assert.ok(a.matches.every(t=>t.domains.includes('folklore')));
 const b=retrieve({query:'《礼记·月令》',domain:'bazi',limit:10});assert.equal(b.retrieval.filter_domain,'bazi');assert.ok(b.matches.every(t=>t.domains.includes('bazi')));assert.ok(!b.matches.some(t=>t.slug==='folk-liji-yueling-summer'));
});
test('inferred domains do not erase matching out-of-domain material or fabricate zero-score hits',()=>{
 const topics=[{id:'a',slug:'a',name:'八字月令',tags:[],path:'a',domain:'bazi'},{id:'b',slug:'b',name:'月令祭祀',tags:[],path:'b',domain:'folklore'},{id:'c',slug:'c',name:'无关资料',tags:[],path:'c',domain:'bazi'}];
 const a=search.search(topics,'八字月令',10,()=> '正文');assert.deepEqual(new Set(a.matches.map(t=>t.id)),new Set(['a','b']));
 const b=search.search(topics,'八字月令',10,()=> '正文','bazi');assert.deepEqual(b.matches.map(t=>t.id),['a']);
 assert.deepEqual(search.search(topics,'《》',10,()=> '正文').matches,[]);
});
test('real mobile knowledge command finds the classical source with no manual domain hint',()=>{
 const r=shell(['--knowledge','--query','《礼记·月令》','--limit','3']);assert.equal(r.matches[0].slug,'folk-liji-yueling-summer');assert.equal(r.retrieval.filter_domain,null);assert.equal(knowledge.verifyKnowledge().total_topics,103);
});
for(const script of ['knowledge-context.cjs','knowledge.cjs']){
 const run=argv=>cp.spawnSync(process.execPath,[path.join(root,'scripts',script),...argv],{encoding:'utf8',cwd:tmp,timeout:30000,maxBuffer:128*1024});
 test(script+' help advertises exactly the supported domains and executable query options',()=>{
  const help=run(['--help']),short=run(['-h']);assert.ifError(help.error);assert.ifError(short.error);assert.equal(help.status,0,help.stderr);assert.equal(short.status,0,short.stderr);assert.equal(short.stdout,help.stdout);
  const advertised=help.stdout.match(/\[--domain ([a-z|]+)\]/);assert.ok(advertised,'help must advertise the query domain option');const domains=advertised[1].split('|');assert.deepEqual(domains,search.DOMAINS);
  for(const domain of domains){
   const result=run(['--query','《礼记·月令》','--domain',domain,'--limit','1']);assert.ifError(result.error);assert.equal(result.status,0,result.stderr);const value=JSON.parse(result.stdout);
   assert.equal(value.retrieval.filter_domain,domain);assert.equal(value.retrieval.domain_source,'explicit');assert.ok(value.matches.every(t=>t.domains.includes(domain)));
   if(domain==='folklore')assert.equal(value.matches[0].slug,'folk-liji-yueling-summer');
  }
 });
 test(script+' keeps domain selection query-only',()=>{
  const result=run(['--topic','folk-liji-yueling-summer','--domain','folklore']);assert.ifError(result.error);assert.equal(result.status,2);assert.equal(JSON.parse(result.stderr).ok,false);assert.match(JSON.parse(result.stderr).error,/domain 只用于 query/);
 });
}
test('long real task completes a -> b -> comparison pages using only returned argv',()=>{
 const dir=path.join(tmp,'long-task-space '+'x'.repeat(80)),first=shell(['--stdin','--out',dir,'--focus','relationship'],fixture('relationship-pair-input.json'));
 assert.deepEqual(first.context.reading.people.map(p=>p.person_id),['a']);assert.equal(first.people_page.next_person,'b');assert.ok(first.context.reading.pair_evidence.missing.includes('comparison'));
 const before=fs.readFileSync(first.files.chart),saved=JSON.parse(before),a=first.context.reading.people[0];assert.equal(a.person_id,'a');
 const personAction=first.next_actions.find(x=>x.person==='b');assert.ok(personAction?.argv);const b=shell(personAction.argv);assert.equal(b.cache_hit,true);assert.equal(b.validation.recalculated,false);assert.equal(b.task_id,first.task_id);assert.equal(b.context.reading.people[0].person_id,'b');assert.ok(b.context.reading.pair_evidence.missing.includes('comparison'));
 let next=b.next_actions.find(x=>x.comparison);assert.ok(next?.argv.includes('--comparison'));assert.ok(!next.argv.includes('--person'));assert.equal(next.focus,'relationship');
 const relations=[],matrix=[];let pages=0;
 while(next){
  const r=shell(next.argv);assert.equal(r.cache_hit,true);assert.equal(r.task_id,first.task_id);assert.equal(r.context.source_checksum,saved.checksum.value);assert.equal(r.context.selection.comparison,true);assert.equal(r.context.selection.person,null);
  const c=r.context.reading.comparison;assert.equal(c.id,saved.comparison.id);assert.equal(c.kind,saved.comparison.kind);assert.deepEqual(c.bazi.day_master_projection,saved.comparison.bazi.day_master_projection);assert.deepEqual(c.ziwei,saved.comparison.ziwei);
  relations.push(...c.bazi.cross_relations.items);matrix.push(...c.bazi.pillar_matrix.items);pages++;assert.ok(pages<=20);
  next=r.next_actions.find(x=>x.comparison);assert.equal(!!next,r.context.reading.comparison_page.next_offset!==null);
  if(next)assert.equal(next.offset,r.context.reading.comparison_page.next_offset);else assert.equal(r.context.reading.pair_evidence.page_is_last,true);
  assert.equal(r.context.reading.pair_evidence.comparison_complete_in_this_response,r.context.reading.comparison_page.offset===0&&r.context.reading.pair_evidence.page_is_last);
 }
 assert.deepEqual(relations,saved.comparison.bazi.cross_relations);assert.deepEqual(matrix,saved.comparison.bazi.pillar_matrix);for(const rel of relations){assert.ok(rel.sources.some(s=>s.person_id==='a'));assert.ok(rel.sources.some(s=>s.person_id==='b'));}
 assert.deepEqual(fs.readFileSync(first.files.chart),before);assert.deepEqual(fs.readdirSync(path.dirname(first.files.chart)).sort(),['chart.json','context.json','validation.json']);
});
test('short default pair keeps both people and the original comparison projection unchanged',()=>{
 const r=flow.boundedResponse({ok:true,files:{chart:'/workspace/pair/chart.json'}},pair,{focus:'relationship'});limited(r);assert.deepEqual(r.context.reading.people.map(p=>p.person_id),['a','b']);assert.deepEqual(r.context.reading.comparison,project(pair,{focus:'relationship'}).reading.comparison);assert.equal(r.context.selection.comparison,undefined);
});
test('near-budget fallback keeps a reachable comparison view for every original pair focus',()=>{
 for(const focus of ['core','relationship','intimacy'])for(const length of [64,160,256]){
  const dir='/workspace/'+"quoted-'"+'x'.repeat(length),base={ok:true,files:{chart:dir+'/chart.json',context:dir+'/context.json',validation:dir+'/validation.json'}};
  const r=flow.boundedResponse(base,pair,{focus});limited(r);
  if(r.people_page){assert.ok(r.context.reading.pair_evidence.missing.includes('comparison'));const next=r.next_actions.find(a=>a.person==='b');assert.ok(next?.argv);
   const b=flow.boundedResponse(base,pair,{focus,person:'b'});limited(b);const c=b.next_actions.find(a=>a.comparison);assert.ok(c?.argv);assert.equal(c.person,null);assert.equal(c.years,null);assert.equal(c.focus,'relationship');
  }else assert.ok(r.context.reading.comparison);
  const c=flow.boundedResponse(base,pair,{focus:'relationship',comparison:true,limit:10});limited(c);assert.ok(c.context.reading.comparison);assert.ok(!c.context.reading.people);
 }
});
test('comparison validation rejects unsupported modes and conflicting selectors',()=>{
 const single=core.buildAndValidate(fixture('relationship-single-input.json')).data;
 assert.throws(()=>project(single,{comparison:true}),/双人关系盘/);assert.throws(()=>project(core.buildAndValidate(fixture('input.json')).data,{comparison:true}),/双人关系盘/);
 assert.throws(()=>flow.parse(['--reuse','/tmp/chart.json','--comparison','--person','a']),/不与 --person/);
 assert.throws(()=>project(pair,{comparison:true,person:'a'}),/不与人物/);assert.throws(()=>project(pair,{comparison:true,years:[2026,2027]}),/年度/);assert.throws(()=>project(pair,{comparison:true,focus:'annual'}),/focus relationship/);
});
test('comparison view handles Ziwei-only independent charts without inventing Bazi links',()=>{
 const input=fixture('relationship-pair-input.json');input.chart_mode='ziwei';const data=core.buildAndValidate(input).data;
 const r=flow.boundedResponse({ok:true},data,{focus:'relationship',comparison:true});limited(r);assert.equal(r.context.reading.comparison.bazi,null);assert.deepEqual(r.context.reading.comparison.ziwei,data.comparison.ziwei);assert.equal(r.context.reading.comparison_page.next_offset,null);assert.deepEqual(r.next_actions,[]);
});
test('a final or out-of-range comparison page is not mislabeled as a complete standalone view',()=>{
 for(const offset of [15,100]){
  const r=flow.boundedResponse({ok:true},pair,{focus:'relationship',comparison:true,limit:1,offset});limited(r);
  assert.equal(r.context.reading.pair_evidence.page_is_last,true);assert.equal(r.context.reading.pair_evidence.comparison_complete_in_this_response,false);assert.ok(r.context.reading.pair_evidence.missing.includes('comparison_previous_pages'));
 }
});
