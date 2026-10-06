'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const {lookup,verifyKnowledge}=require('../scripts/knowledge.cjs'),{retrieve}=require('../scripts/knowledge-context.cjs');
const catalog=require('../references/knowledge/spirit/catalog.json'),root=path.resolve(__dirname,'..');
const questions=[
 ['人撞鬼会怎么样','spirit-dizang-ghost-kings'],['人和鬼之间是什么关系','spirit-human-ghosts'],
 ['什么是护法','spirit-buddhist-protectors'],['我有没有護法','spirit-buddhist-protectors'],
 ['前世姻缘有没有经典依据','spirit-marriage-future-life'],['前世姻緣','spirit-marriage-future-life'],
 ['轮回是什么','spirit-rebirth-kinship'],['冤亲债主是什么意思','spirit-rebirth-kinship'],
 ['给亡者追荐','spirit-dizang-memorial'],['中元普度','spirit-zhongyuan-pudu'],['冥婚是什么意思','spirit-ghost-marriage']
];
test('增补8宗教卡、7来源，与原85主题共同校验为93主题',()=>{
 const r=verifyKnowledge();assert.equal(r.spirit_topics,8);assert.equal(r.spirit_sources,7);assert.equal(r.total_topics,93);
 assert.equal(r.total_topics-r.spirit_topics,85);assert.equal(catalog.automatic_chart_for_knowledge_questions,false);assert.equal(catalog.personal_supernatural_identification_supported,false);
 assert.equal(catalog.topics.filter(t=>t.evidence_scope==='religious_teaching').length,5);
 assert.equal(catalog.topics.filter(t=>t.evidence_scope==='regional_custom_research').length,2);
 for(const t of catalog.topics){const full=lookup({topic:t.slug});assert.equal(full.reference_only,true);assert.equal(full.topic.program_supported,false);assert.equal(full.source_url,t.url);assert.equal(full.topic.source_kind,t.kind);}
});
test('实际中文问句及常见繁体入口命中对应宗教主题',()=>{
 for(const [query,slug] of questions)assert.equal(lookup({query,limit:1}).matches[0]?.slug,slug,query);
});
test('有限检索与正文分页保留来源传统、查核方式和推断范围',()=>{
 for(const [query,slug] of questions){const r=retrieve({query,limit:1}),t=r.matches[0],source=catalog.topics.find(t=>t.slug===slug);
  for(const field of ['publisher','locator','access_method','tradition','evidence_scope','inference_limits','source_ids'])assert.deepEqual(t[field],source[field]);
  assert.equal(r.reference_only,true);assert.ok(!('content' in t));assert.equal(t.source_url,source.url);
  let offset=0,content='';do{const page=retrieve({topic:slug,offset,chars:400});assert.deepEqual(page.topic.inference_limits,source.inference_limits);assert.equal(page.topic.evidence_scope,source.evidence_scope);assert.ok(Buffer.byteLength(JSON.stringify(page))<=12*1024);content+=page.topic.content;offset=page.topic.next_offset;}while(offset!==null);
  assert.equal(content,lookup({topic:slug}).content);
 }
 assert.ok(Buffer.byteLength(JSON.stringify(retrieve({query:'宗教',limit:10})))<=12*1024);
});
test('典籍出处和身份固定，不把摘要标为全文或宗教发愿标为个人认证',()=>{
 const bySlug=Object.fromEntries(catalog.topics.map(t=>[t.slug,t]));
 assert.equal(bySlug['spirit-ghost-marriage'].access_method,'search_indexed_official_abstract');
 assert.equal(bySlug['spirit-marriage-future-life'].chapter,'AN4.55 Equality (1st)');
 assert.equal(bySlug['spirit-rebirth-kinship'].locator,'sn15.14:1.2–1.6');
 assert.equal(bySlug['spirit-buddhist-protectors'].chapter,'卷七陀罗尼品第二十六');
 assert.equal(bySlug['spirit-dizang-ghost-kings'].chapter,'阎罗王众赞叹品第八');
 assert.equal(bySlug['spirit-dizang-memorial'].chapter,'利益存亡品第七');
 for(const s of catalog.sources){assert.equal(s.accessed_on,'2026-10-06');assert.ok(s.verification_limit&&s.copyright_note&&s.adoption);}
 const manifest=require('../rikkahub-manifest.json');assert.equal(manifest.folklore_library.total_searchable_topics,93);assert.equal(manifest.spirit_library.included_in_published_v1_2_3_zip,false);
});
test('来源、教义范围或认证能力被错误改动时，校验明确拒绝',()=>{
 for(const [obj,key,value,pattern] of [
  [catalog,'personal_supernatural_identification_supported',true,/能力边界/],
  [catalog.topics[0],'evidence_scope','religious_teaching',/身份或范围/],
  [catalog.topics[0],'inference_limits',[],/推断边界/],
  [catalog.sources[0],'url','https://example.com/wrong',/主来源不一致/],
  [catalog.source_verification[0],'locator','未核卷次',/查核字段不一致/],
  [catalog.topics[0],'sha256','0'.repeat(64),/摘要不匹配/]
 ]){const old=obj[key];try{obj[key]=value;assert.throws(()=>verifyKnowledge(),pattern);}finally{obj[key]=old;}}
 assert.equal(verifyKnowledge().total_topics,93);
});
test('新卡真实CLI不要求生辰且不写临时查询、排盘或报告',()=>{
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'spirit-query-'));
 try{for(const [query,slug] of questions){const r=cp.spawnSync(process.execPath,[path.join(root,'scripts/knowledge-context.cjs'),'--query',query,'--limit','1'],{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);const out=JSON.parse(r.stdout);assert.equal(out.matches[0].slug,slug);assert.equal(out.reference_only,true);assert.deepEqual(fs.readdirSync(cwd),[]);}}
 finally{fs.rmdirSync(cwd);}
});
test('知识基线包含全部新卡和目录且每个冻结文件的字节摘要一致',()=>{
 const baseline=require('../tools/knowledge-baseline.json');
 for(const t of catalog.topics)assert.equal(baseline[t.path],t.sha256);
 assert.ok(baseline['references/knowledge/spirit/catalog.json']);assert.ok(baseline['references/spirit-library-index.md']);
 for(const [file,sha] of Object.entries(baseline))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),sha,file);
});
