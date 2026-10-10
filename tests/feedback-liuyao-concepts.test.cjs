'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const {retrieve}=require('../scripts/knowledge-context.cjs'),knowledge=require('../scripts/knowledge.cjs'),search=require('../scripts/knowledge-search.cjs');
const catalog=require('../references/knowledge/liuyao-concepts/catalog.json'),root=path.resolve(__dirname,'..');
const queries=[
 ['六爻用神怎么取','liuyao-use-god'],['六爻用神如何取','liuyao-use-god'],['六爻取用神怎么取','liuyao-use-god'],['六爻 用神 怎么取','liuyao-use-god'],['六爻取用神如何判断','liuyao-use-god'],
 ['世爻和应爻有什么区别','liuyao-shi-ying'],['六爻世應怎麼看','liuyao-shi-ying'],['世应关系是什么意思','liuyao-shi-ying'],
 ['六爻元神是什么意思','liuyao-yuan-ji-chou'],['六爻忌神怎么判断','liuyao-yuan-ji-chou'],['原神忌神仇神有什么区别','liuyao-yuan-ji-chou'],
 ['动爻和变爻的区别','liuyao-moving-changing'],['六爻回头生是什么意思','liuyao-moving-changing'],['六爻回頭剋是什麼意思','liuyao-moving-changing'],
 ['六爻月建日辰怎么看','liuyao-month-day'],['六爻旺衰怎么看','liuyao-month-day'],
 ['六爻旬空月破的区别','liuyao-empty-broken'],['六爻空亡是什么意思','liuyao-empty-broken'],['六爻月破怎么判断','liuyao-empty-broken'],['六爻填實是什麼意思','liuyao-empty-broken']
];
for(const [query,slug] of queries)test('Liuyao substantive query: '+query,()=>{
 const r=retrieve({query,limit:3});assert.equal(r.matches[0].slug,slug);assert.equal(r.retrieval.domain,'liuyao');assert.equal(r.retrieval.filter_domain,null);assert.ok(r.retrieval.terms.length>0);assert.ok(!r.matches.some(t=>['folk-zhouyi-xian','folk-zhouyi-heng'].includes(t.slug)));assert.ok(Buffer.byteLength(JSON.stringify(r)+'\n')<=12*1024);
 assert.equal(r.matches[0].source_kind,'project_concept_reference');assert.equal(r.matches[0].instruction_authority,'none');assert.ok(r.matches[0].inference_limits.length>0);
});
test('reported query recognizes 六爻用神 rather than only a generic domain tag',()=>{
 const r=retrieve({query:'六爻用神怎么取',limit:3});assert.deepEqual(r.retrieval.terms,['六爻用神']);
 const topics=[{id:'x',slug:'generic',name:'《周易·咸》',domain:'liuyao',tags:['六爻'],path:'x',subtitle:'感应意象'}];
 assert.deepEqual(search.search(topics,'六爻用神怎么取',3,()=> '六爻一般概览').matches,[]);assert.equal(search.search(topics,'六爻',3,()=> '六爻一般概览').matches[0].id,'x');
});
test('negative contrast mentions are not definitions, without filtering positive cross-domain evidence',()=>{
 const topics=[{id:'no',slug:'no',name:'六爻取用',tags:[],path:'no',domain:'liuyao',subtitle:'不是八字喜用神'},{id:'yes',slug:'yes',name:'民俗词义辨析',tags:[],path:'yes',domain:'folklore',subtitle:'与八字解释相关'}];
 const r=search.search(topics,'如何判断喜用神',3,t=>t.id==='no'?'六爻用神不是八字的喜用神。':'这里讨论喜用神的概念。');assert.deepEqual(r.matches.map(t=>t.id),['yes']);assert.equal(r.retrieval.filter_domain,null);
 const b=retrieve({query:'如何判断喜用神',limit:3});assert.equal(b.matches[0].slug,'bazi-favorable-god');assert.ok(b.matches.every(t=>t.domains.includes('bazi')));
});
test('ambiguous shared words acquire a canonical meaning only from explicit context',()=>{
 for(const query of ['用神','取用神','元神','忌神','旬空'])assert.equal(retrieve({query,limit:3}).retrieval.domain,null,query);
 for(const query of ['用神','取用神']){
  const l=retrieve({query,domain:'liuyao',limit:3});assert.equal(l.matches[0].slug,'liuyao-use-god');assert.deepEqual(l.retrieval.terms,['六爻用神']);assert.ok(l.matches.every(t=>t.domains.includes('liuyao')));
  const b=retrieve({query,domain:'bazi',limit:3});assert.equal(b.matches[0].slug,'bazi-favorable-god');assert.deepEqual(b.retrieval.terms,['喜用神']);assert.ok(b.matches.every(t=>t.domains.includes('bazi')));
 }
 assert.deepEqual(search.plan('如何判断喜用神').terms,['喜用神']);assert.equal(search.plan('元神', 'spirit').terms.length,0);
});
test('mixed domains and explicit classical identities remain discoverable',()=>{
 const both=retrieve({query:'八字用神与六爻用神有什么区别',limit:3});assert.equal(both.retrieval.domain,null);assert.equal(both.retrieval.filter_domain,null);assert.ok(both.matches.some(t=>t.slug==='bazi-favorable-god'));assert.ok(both.matches.some(t=>t.slug==='liuyao-use-god'));
 assert.equal(retrieve({query:'《礼记·月令》',limit:3}).matches[0].slug,'folk-liji-yueling-summer');
 const classic=retrieve({query:'《周易·咸》和六爻用神有什么区别',limit:3});assert.ok(classic.matches.some(t=>t.slug==='folk-zhouyi-xian'));assert.ok(classic.matches.some(t=>t.slug==='liuyao-use-god'));assert.equal(classic.retrieval.filter_domain,null);
});
test('six additional concepts preserve every original source count and manifest enumeration',()=>{
 const r=knowledge.verifyKnowledge();assert.equal(r.liuyao_concept_topics,6);assert.equal(r.total_topics-r.romance_topics,103);assert.equal(r.total_topics-r.romance_topics-r.liuyao_concept_topics,97);assert.equal(r.total_topics-r.romance_topics-r.liuyao_concept_topics-r.bazi_concept_topics,93);assert.equal(r.total_topics-r.romance_topics-r.liuyao_concept_topics-r.bazi_concept_topics-r.spirit_topics,85);
 const manifest=require('../rikkahub-manifest.json');assert.equal(manifest.folklore_library.total_searchable_topics,r.total_topics);assert.equal(manifest.liuyao_concept_library.topics,6);assert.equal(manifest.liuyao_concept_library.automatic_use_god_selection_supported,false);assert.equal(knowledge.lookup({topic:'wenwang-liuyao'}).topic.program_supported,true);
});
test('new cards have substantive text, checked chapter records and exact paged roundtrips',()=>{
 for(const t of catalog.topics){
  const full=knowledge.lookup({topic:t.slug});assert.ok(full.content.length>300);assert.equal(t.program_supported,false);assert.equal(t.domain,'liuyao');assert.equal(t.evidence_scope,'classical_concept_summary');assert.ok(t.verification_limit);assert.ok(t.inference_limits.length>0);assert.ok(t.source_references.every(s=>s.chapter&&s.locator&&s.checked_claim&&full.content.includes(s.url)));
  assert.equal(crypto.createHash('sha256').update(Buffer.from(full.content)).digest('hex'),t.sha256);
  let content='',offset=0,pages=0;do{const r=retrieve({topic:t.slug,offset,chars:200});assert.equal(r.topic.instruction_authority,'none');assert.ok(Buffer.byteLength(JSON.stringify(r)+'\n')<=12*1024);content+=r.topic.content;offset=r.topic.next_offset;assert.ok(++pages<25);}while(offset!==null);assert.equal(content,full.content);
 }
});
test('tampered concept evidence and capability claims fail verification explicitly',()=>{
 const t=catalog.topics[0];for(const [object,key,value,pattern] of [[catalog,'automatic_use_god_selection_supported',true,/能力边界/],[catalog,'expected_topics',5,/目录/],[t,'program_supported',true,/来源字段/],[t,'inference_limits',[],/推断边界/],[t.source_references[0],'url','https://example.com/wrong',/查核记录/],[t,'sha256','0'.repeat(64),/摘要不匹配/]]){
  const before=object[key];try{object[key]=value;assert.throws(()=>knowledge.verifyKnowledge(),pattern);}finally{object[key]=before;}
 }
 assert.equal(knowledge.verifyKnowledge().ok,true);
});
test('RikkaHub direct-read index reaches every complete card without a runtime',()=>{
 const index='references/liuyao-concepts-index.md',skill=fs.readFileSync(path.join(root,'SKILL.md'),'utf8'),text=fs.readFileSync(path.join(root,index),'utf8');assert.ok(skill.includes(index));
 for(const t of catalog.topics){assert.ok(text.includes(path.posix.relative('references',t.path)));assert.ok(fs.existsSync(path.join(root,t.path)));}
 assert.ok(Buffer.byteLength(JSON.stringify({text}))<28*1024);
});
test('real mobile knowledge queries and body pagination need no birth or chart writes',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'liuyao-knowledge-')),sh=process.env.SUANMING_TEST_SH||'sh',env={...process.env},prior=process.env.PATH||process.env.Path||'';
 for(const key of Object.keys(env))if(key.toUpperCase()==='PATH')delete env[key];env.PATH=[path.dirname(process.execPath),...(path.isAbsolute(sh)?[path.dirname(sh)]:[]),prior].join(path.delimiter);
 const shellPath=process.platform==='win32'?path.join(root,'scripts/mobile.sh').replaceAll('\\','/'):path.join(root,'scripts/mobile.sh');
 const run=argv=>{const p=cp.spawnSync(sh,[shellPath,...argv],{cwd:tmp,env,encoding:'utf8',timeout:30000,maxBuffer:128*1024});assert.ifError(p.error);assert.equal(p.status,0,p.stderr);assert.ok(Buffer.byteLength(p.stdout)<=12*1024);assert.ok(Buffer.byteLength(JSON.stringify({stdout:p.stdout}))<28*1024);return JSON.parse(p.stdout);};
 try{
  for(const [query,slug] of [queries[0],queries[5],queries[8],queries[11],queries[14],queries[16]])assert.equal(run(['--knowledge','--query',query,'--domain','liuyao','--limit','3']).matches[0].slug,slug);
  let text='',offset=0,pages=0;do{const r=run(['--knowledge','--topic','liuyao-use-god','--offset',String(offset),'--chars','200']);text+=r.topic.content;offset=r.topic.next_offset;assert.ok(++pages<25);}while(offset!==null);assert.equal(text,knowledge.lookup({topic:'liuyao-use-god'}).content);assert.deepEqual(fs.readdirSync(tmp),[]);
 }finally{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));fs.rmSync(tmp,{recursive:true,force:true});}
});
