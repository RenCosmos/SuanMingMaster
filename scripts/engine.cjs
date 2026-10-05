'use strict';
const {normalize,packageVersion,digest,check}=require('./common.cjs');
const {makeBazi}=require('./bazi-chart.cjs');
const {makeZiwei}=require('./ziwei-chart.cjs');
const PINNED={'lunar-typescript':'1.8.6',iztro:'2.6.1','@js-temporal/polyfill':'0.5.1'};
function build(input) {
  const engines=Object.fromEntries(Object.keys(PINNED).map(k=>[k,packageVersion(k)]));
  for(const [k,v] of Object.entries(PINNED)) check(engines[k]===v,`${k} 版本须为 ${v}，实际 ${engines[k]}；请按锁文件恢复依赖`);
  const c=normalize(input);
  const result={schema_version:'bazi-ziwei/v1',skill_version:'0.4.0',input:c.input,normalized:c.normalized,warnings:c.warnings,
    provenance:{engines,rules:{bazi:'bazi-structural-v1',ziwei:'ziwei-structural-v1'},node:process.versions.node,icu:process.versions.icu,tz_database:process.versions.tz || 'not_reported',sources:['https://github.com/6tail/lunar-typescript','https://github.com/SylarLong/iztro'],limitations:[]}};
  // 两个引擎都成功后才向 CLI 返回，避免一半成功一半失败的双盘文件。
  if(c.mode==='both'||c.mode==='bazi') {result.bazi=makeBazi(c);result.provenance.rules.bazi=result.bazi.calculations.rule_version;}
  if(c.mode==='both'||c.mode==='ziwei') {result.ziwei=makeZiwei(c);result.provenance.rules.ziwei=result.ziwei.calculations.rule_version;}
  result.checksum={algorithm:'sha256-canonical-json',value:digest(result)};
  return result;
}
function validateArtifact(data,{recalculate=true}={}) {
  check(data && data.schema_version==='bazi-ziwei/v1' && data.skill_version==='0.4.0','不支持的计算版本；请用旧包校验或以原输入重新计算');
  const {checksum,...payload}=data;
  check(checksum && checksum.algorithm==='sha256-canonical-json' && checksum.value===digest(payload),'报告校验和不匹配；文件可能被修改，请重新计算');
  const mode=data.input?.mode;
  check(['both','bazi','ziwei'].includes(mode),'报告缺少有效 mode');
  check((mode==='both'||mode==='bazi')===Boolean(data.bazi) && (mode==='both'||mode==='ziwei')===Boolean(data.ziwei),'报告模式与命盘内容不一致');
  if(data.bazi){
    check(data.bazi.chart.pillars?.length===4 && data.bazi.calculations?.score_ledger?.length>=8,'八字报告不完整');
    check(Array.isArray(data.bazi.chart.annual)&&data.bazi.chart.annual.every(y=>Array.isArray(y.pillar_relations)&&Array.isArray(y.day_branch_relations)&&Array.isArray(y.hidden_stems)&&Array.isArray(y.hidden_ten_gods)),'逐年流年关系字段不完整；请重新计算');
    check(Array.isArray(data.bazi.chart.dayun)&&data.bazi.chart.dayun.every(y=>Array.isArray(y.pillar_relations)&&Array.isArray(y.day_branch_relations)&&Array.isArray(y.hidden_stems)&&Array.isArray(y.hidden_ten_gods)),'大运关系字段不完整；请重新计算');
  }
  if(data.ziwei) {check(data.ziwei.chart.palaces?.length===12 && data.ziwei.calculations?.natal_mutagens?.length===4,'紫微报告不完整');check(data.ziwei.calculations.palace_stem_flying?.entries?.length===48&&data.ziwei.calculations.palace_stem_flying?.palace_summary?.length===12,'紫微宫干四化字段不完整；请重新计算');}
  if(recalculate) {
    const fresh=build(data.input);
    for(const key of ['normalized','bazi','ziwei','warnings']) check(digest(data[key]??null)===digest(fresh[key]??null),`${key} 与当前程序重算不一致；不可据此解读`);
    for(const key of ['engines','rules']) check(digest(data.provenance[key])===digest(fresh.provenance[key]),'计算依赖或规则版本已变化');
  }
  return checksum.value;
}
module.exports={build,validateArtifact,normalizeInput:input=>normalize(input).input};
