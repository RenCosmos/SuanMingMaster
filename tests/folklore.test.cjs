'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {lookup,verifyKnowledge}=require('../scripts/knowledge.cjs');
test('来源卡完整：四张官方非遗与十七张古籍，保留原85基础主题',()=>{const r=verifyKnowledge();assert.equal(r.folklore_topics,21);assert.equal(r.total_topics-r.spirit_topics,85);assert.equal(r.new_classical_verified,14);const cards=require('../references/folklore/catalog.json').topics;assert.equal(cards.filter(t=>t.kind==='official_heritage_registry').length,4);assert.equal(cards.filter(t=>t.kind==='classical_primary_text').length,17);});
test('七夕检索逐条标来源，不将官方网页标成 Apache 提示词',()=>{const r=lookup({query:'七夕',limit:10});assert.ok(r.matches.some(t=>t.slug==='folk-qixi-tianhe'));const t=r.matches.find(t=>t.slug==='folk-qixi-xihe');assert.equal(t.source_kind,'official_heritage_registry');assert.equal(t.project_number,'Ⅹ-4');assert.equal(t.license,undefined);assert.ok(t.url.startsWith('https://www.ihchina.cn/'));});
test('古籍精确取用保留检索方式、书目线索与内容身份',()=>{const r=lookup({topic:'folk-liji-hunyi'});assert.equal(r.topic.access_method,'search_indexed_text');assert.equal(r.topic.source_kind,'classical_primary_text');assert.ok(r.content.includes('未声称完成底本影像校勘'));assert.ok(r.content.includes('纳采')&&r.content.includes('《武英殿十三经注疏》'));assert.equal(r.license,undefined);});
test('双修简繁检索同时找到性命与房中原典，保留各自语境',()=>{
 for(const query of ['双修','雙修']){const r=lookup({query,limit:10});for(const slug of ['folk-xingming-shuangxiu','folk-baopuzi-fangzhong','folk-hanshu-fangzhong']){const t=r.matches.find(t=>t.slug===slug);assert.ok(t,`${query}: ${slug}`);assert.equal(t.source_kind,'classical_primary_text');assert.equal(t.program_supported,false);assert.ok(t.book&&t.chapter&&t.original_excerpt&&t.locator);}}
 const r=lookup({topic:'folk-xingming-shuangxiu'});assert.ok(r.content.includes('性命不可分')&&r.content.includes('不能仅凭“双修”断言'));assert.ok(r.content.includes('不否认其他文献的房中'));assert.equal(r.license,undefined);
});
test('禁忌检索标明原典所核范围，不把九毒日表当成程序结果',()=>{
 const r=lookup({query:'九毒日',limit:1});assert.equal(r.matches[0].slug,'folk-liji-yueling-summer');const card=lookup({topic:r.matches[0].slug});assert.ok(card.content.includes('没有列出')&&card.content.includes('只在实际核到的这段范围'));
 const ritual=lookup({topic:'folk-liji-quli'});assert.ok(ritual.content.includes('大夫士出入君門')&&ritual.content.includes('没有给踏门槛者规定统一灾祸'));
});
test('精确提取房中、修行与婚俗卡时，原文、来源方式及作者立场可回查',()=>{
 const room=lookup({topic:'folk-qianjin-fangzhong'});assert.equal(room.topic.access_method,'page_text');assert.ok(room.topic.original_excerpt.includes('節慾'));assert.ok(room.topic.additional_sources.some(t=>t.source_kind==='scholarly_research'));assert.ok(room.content.includes('未实现这套禁忌历'));
 const xifu=lookup({topic:'folk-baopuzi-xifu'});assert.equal(xifu.topic.access_method,'search_indexed_text');assert.ok(xifu.topic.summary.includes('批评'));const practice=lookup({topic:'folk-baopuzi-weizhi'});assert.ok(practice.topic.original_excerpt.includes('未能審'));
});
