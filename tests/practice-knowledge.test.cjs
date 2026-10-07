'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {lookup,verifyKnowledge}=require('../scripts/knowledge.cjs');
const catalog=require('../references/knowledge/practice/catalog.json');
test('旧有67主题和18卡保留，基础85主题与22个修行来源完整',()=>{
 const r=verifyKnowledge();assert.equal(r.topics+r.folklore_topics+r.curated_topics,67);assert.equal(r.practice_topics,18);assert.equal(r.practice_sources,22);assert.equal(r.total_topics-r.spirit_topics-r.bazi_concept_topics-r.liuyao_concept_topics,85);
 for(const t of catalog.topics){const result=lookup({topic:t.slug});assert.equal(result.topic.source_kind,t.kind);assert.equal(result.topic.program_supported,false);assert.ok(result.content.length>300);assert.equal(result.source_url,t.url);}
});
test('实际中文提问直接命中方法，无须把问句拆成空格关键词',()=>{
 for(const [query,slug] of [
  ['请问，如何增加桃花？','practice-romance-yuelao'],['最近一直倒霉怎么办','practice-luck-actions'],['怎么提升异性缘','practice-romance-actions'],
  ['修仙怎么入门','practice-dao-zuowang'],['密宗是什么','practice-esoteric-dainichi'],['四念处是什么意思','practice-buddhist-mindfulness'],
  ['房中术的古籍','practice-fangzhong-bibliography'],['如何安太岁','practice-luck-temple'],['回向怎么写','practice-buddhist-daily-vow'],
  ['怎么改善运气','practice-luck-liaofan']])assert.equal(lookup({query,limit:1}).matches[0].slug,slug,query);
});
test('内容区分书目、学术摘要、古代短引与当代建议，保留年日两种咸池口径',()=>{
 const bibliography=lookup({topic:'practice-fangzhong-bibliography'});assert.equal(bibliography.topic.access_method,'catalog_metadata');
 assert.equal(lookup({topic:'practice-fangzhong-scholarship'}).topic.source_kind,'scholarly_research_summary');
 const chart=lookup({topic:'practice-romance-chart'});assert.equal(chart.topic.access_method,'search_indexed_text');assert.ok(chart.content.includes('profiles[].bazi.traditional_markers'));assert.ok(chart.content.includes(chart.topic.original_excerpt));
 const mindfulness=lookup({topic:'practice-buddhist-mindfulness'});assert.ok(mindfulness.content.includes('mn10:3.2–3.5'));assert.ok(mindfulness.content.includes('本项目中文归纳'));
 const tantra=lookup({topic:'practice-vajrayana-context'});assert.ok(tantra.content.includes('前行训练与灌顶'));assert.ok(tantra.topic.copyright_note.includes('4.0')&&tantra.topic.copyright_note.includes('3.0'));
});
test('来源记录缺失或被改为另一经文时，完整性校验拒绝',()=>{
 const record=catalog.source_verification[0],old=record.locator;
 try{record.locator='未经核对的卷次';assert.throws(()=>verifyKnowledge(),/查核字段不一致/);}finally{record.locator=old;}
 const source=catalog.sources[0],url=source.url;
 try{source.url='https://example.com/wrong';assert.throws(()=>verifyKnowledge(),/主来源不一致/);}finally{source.url=url;}
 const r=verifyKnowledge();assert.equal(r.total_topics-r.spirit_topics-r.bazi_concept_topics-r.liuyao_concept_topics,85);
});
test('真实CLI知识查询不在工作目录写查询、输入、报告或计划文件',()=>{
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'practice-query-'));
 try{for(const query of ['如何增加桃花','密宗是什么','最近一直倒霉怎么办']){
  const r=cp.spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/knowledge.cjs'),'--query',query,'--limit','3'],{cwd,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);assert.ok(JSON.parse(r.stdout).matches.length);assert.deepEqual(fs.readdirSync(cwd),[]);
 }}finally{fs.rmdirSync(cwd);}
});
test('查到的完整卡保留原有古籍与程序知识入口；附加内容不被当成新计算',()=>{
 assert.equal(lookup({topic:'wenwang-liuyao'}).topic.program_supported,true);
 assert.equal(lookup({topic:'folk-xingming-shuangxiu'}).topic.source_kind,'classical_primary_text');
 assert.equal(lookup({topic:'kb-shuwen-writing'}).topic.source_kind,'ritual_document_method_reference');
 for(const t of catalog.topics)assert.equal(lookup({topic:t.slug}).topic.program_supported,false);
});
