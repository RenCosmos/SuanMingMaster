'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {lookup,verifyKnowledge}=require('../scripts/knowledge.cjs'),{retrieve}=require('../scripts/knowledge-context.cjs');
const {REPLACEMENTS,rewriteText,reviewedLegacy}=require('../tools/religion-tone-review.cjs');
const root=path.resolve(__dirname,'..'),catalog=require('../references/knowledge/spirit/catalog.json');
test('宗教措辞替换只改已审定句子，三张卡的其余正文严格还原冻结摘要',()=>{
 const baseline=require('../tools/knowledge-baseline.json');
 for(const slug of ['spirit-human-ghosts','spirit-buddhist-protectors','spirit-zhongyuan-pudu']){
  const topic=catalog.topics.find(t=>t.slug===slug),current=lookup({topic:slug}).content;
  let before=current;
  for(const [oldText,newText] of [...REPLACEMENTS].reverse()){
   if(newText)before=before.replaceAll(newText,oldText);
   else if(current.includes('不宜概括成“所有鬼都害人”。'))before=before.replace('不宜概括成“所有鬼都害人”。','不宜概括成“所有鬼都害人”。'+oldText);
  }
  assert.equal(crypto.createHash('sha256').update(before).digest('hex'),baseline[topic.path],slug);
  assert.equal(rewriteText(before),current);
 }
});
test('有限宗教检索保留教义、短引与来源，全文分页无否定存在插话且满足完整工具预算',()=>{
 const queries=[['人和鬼之间是什么关系','spirit-human-ghosts'],['什么是护法','spirit-buddhist-protectors'],['中元普度','spirit-zhongyuan-pudu'],['人撞鬼会怎么样','spirit-dizang-ghost-kings'],['前世姻缘','spirit-marriage-future-life']];
 for(const [query,slug] of queries){
  assert.equal(retrieve({query,limit:1}).matches[0].slug,slug);
  const full=lookup({topic:slug});let offset=0,body='';
  do{
   const response=retrieve({topic:slug,offset,chars:400});
   assert.equal(response.topic.source_url,full.source_url);
   const stdout=JSON.stringify(response),envelope=JSON.stringify({exitCode:0,stdout,stderr:'',timedOut:false});
   assert.ok(Buffer.byteLength(stdout)<=12*1024);assert.ok(Buffer.byteLength(envelope)<28*1024);
   body+=response.topic.content;offset=response.topic.next_offset;
  }while(offset!==null);
  assert.equal(body,full.content);if(full.topic.original_excerpt)assert.ok(body.includes(full.topic.original_excerpt));
  assert.ok(!body.includes('不是对超自然存在的检测')&&!body.includes('不是对鬼魂存在、数量'));
 }
 const checked=verifyKnowledge();assert.equal(checked.total_topics,103);assert.equal(checked.spirit_topics,8);assert.equal(checked.spirit_sources,7);
 assert.equal(catalog.personal_supernatural_identification_supported,false);assert.equal(catalog.automatic_chart_for_knowledge_questions,false);
});
test('精确文案兼容转换保留其他字段，宗教提问不改变计算或认证能力',()=>{
 const before={ok:true,unchanged:{value:'任意未审定内容',number:42},topic:{source_url:'https://example.com/source',inference_limits:['不把经文愿文变成免灾实证保证']}};
 const after=reviewedLegacy(before);assert.deepEqual(after.unchanged,before.unchanged);assert.equal(after.topic.source_url,before.topic.source_url);
 assert.deepEqual(after.topic.inference_limits,['不把经文愿文变成个人免灾保证']);assert.notStrictEqual(after,before);
 const skill=fs.readFileSync(path.join(root,'SKILL.md'),'utf8'),guide=fs.readFileSync(path.join(root,'references/spirit-library-index.md'),'utf8');
 assert.ok(skill.includes('不主动争论鬼神有无或纠正信仰'));assert.ok(guide.includes('不要凭命盘、梦境、感应或熟悉感替他确认附身'));
});
