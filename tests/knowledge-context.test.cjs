'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {retrieve}=require('../scripts/knowledge-context.cjs'),legacy=require('../scripts/knowledge.cjs');
test('bounded query keeps sources and routes without returning full cards',()=>{
 const r=retrieve({query:'如何增加桃花',limit:3});assert.ok(r.matches.length>0);assert.ok(r.matches[0].source_url);assert.ok(r.matches[0].read.topic);
 assert.ok(!r.matches.some(m=>'content' in m));assert.ok(Buffer.byteLength(JSON.stringify(r))<=12*1024);const verified=legacy.verifyKnowledge();assert.equal(verified.total_topics-verified.spirit_topics-verified.bazi_concept_topics-verified.liuyao_concept_topics,85);
});
test('paged topic roundtrip restores the exact full original text and source identity',()=>{
 const match=legacy.lookup({query:'八字',limit:1}).matches[0],full=legacy.lookup({topic:match.slug});
 let offset=0,content='';
 do{const r=retrieve({topic:match.slug,chars:900,offset});assert.ok(Buffer.byteLength(JSON.stringify(r))<=12*1024);assert.equal(r.topic.sha256,match.sha256);assert.equal(r.topic.slug,match.slug);content+=r.topic.content;offset=r.topic.next_offset;}while(offset!==null);
 assert.equal(content,full.content);
});
test('invalid paging and incompatible options fail explicitly',()=>{
 assert.throws(()=>retrieve({query:'桃花',offset:1}),/只用于/);
 const match=legacy.lookup({query:'桃花',limit:1}).matches[0];
 assert.throws(()=>retrieve({topic:match.slug,chars:4000}),/chars/);
 assert.throws(()=>retrieve({topic:match.slug,offset:-1}),/offset/);
});
