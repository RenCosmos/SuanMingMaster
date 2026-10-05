'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {lookup,verifyKnowledge}=require('../scripts/knowledge.cjs');
test('35 主题改编数据完整且来源提交固定',()=>{const r=verifyKnowledge();assert.equal(r.topics,35);assert.equal(r.commit,'f14a60b6192192d9472a6eb430cbae54a7cc50af');});
test('主题取用保留上游六爻装卦参考，同时明确其非指令',()=>{const r=lookup({topic:'wenwang-liuyao'});assert.ok(r.content.includes('纳甲')&&r.content.includes('不是本技能的执行指令'));assert.equal(r.reference_only,true);assert.equal(r.topic.program_supported,true);});
test('关键词搜索能够命中六爻，塔罗仅为知识参考',()=>{assert.equal(lookup({query:'六爻',limit:1}).matches[0].slug,'wenwang-liuyao');assert.equal(lookup({topic:'tarot'}).topic.program_supported,false);});
test('检索不存在主题和路径穿越、空查询或超限均拒绝',()=>{for(const i of [{topic:'../../scripts/run.cjs'},{topic:'unknown'},{query:''},{query:'六爻',limit:99},{query:'六爻',topic:'tarot'},{query:'六爻',command:'foo'}])assert.throws(()=>lookup(i));});
