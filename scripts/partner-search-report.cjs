'use strict';
const RULES=require('../references/partner-search-rules.json');
const cell=s=>String(s??'—').replace(/\|/g,'\\|').replace(/[\r\n]/g,' ');
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function makeReport(data){
 const lines=['# 正缘候选条件筛选','',cell(data.input.question??'候选年份与八字条件'),'',`本人四柱：${data.self.pillars.map(p=>p.ganzhi).join(' / ')}`,`参考日期：${data.input.as_of}；搜索类型：${data.input.search.type}`,`所选模型：${data.input.partner_star_model}；条件组合：${data.input.filters.match}`,'',data.ordering,'',
  '| 候选 | 年份／时间 | 候选年柱／四柱 | 命中条件 | 同时存在的冲刑害破等 |','|---|---|---|---|---|'];
 for(const c of data.candidates)lines.push(`| ${cell(c.id)} | ${cell(c.local_datetime??c.birth?.date??c.birth_year_label)} | ${cell(c.full_bazi?.join(' / ')??c.year_pillar)} | ${cell(c.evaluation.matched_conditions.map(id=>RULES.conditions[id].label).join('；'))} | ${cell([...new Set(c.evaluation.risk_relations.map(r=>r.type))].join('、'))} |`);
 if(!data.candidates.length)lines.push('','在本次范围及明确条件下没有候选；不意味着没有正缘，也不自动放宽条件。');
 lines.push('','## 方法说明','',data.interpretation_scope,'',data.coverage.scope,'年份项只提供年柱，未知月、日、时柱不补造；日期项是条件枚举，不是现实对象的已知生日。','',`无法计算采样点：${data.coverage.unavailable}。`,'','## 来源');
 for(const s of data.sources)lines.push(`- ${cell(s.book??s.title)}${s.chapter?' · '+cell(s.chapter):''}：${cell(s.scope)}${s.url?' '+s.url:''}`);
 lines.push('',`规则：${data.rule_version}；校验和：${data.checksum.value}`,'');const markdown=lines.join('\n');return {markdown,html:`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>正缘候选条件筛选</title><main><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(markdown)}</pre></main></html>`};
}
module.exports={makeReport};
