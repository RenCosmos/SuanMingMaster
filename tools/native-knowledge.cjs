'use strict';
// Derived, read-only fallback over existing catalogs; does not replace original cards or retrieval.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const GROUPS=[
 ['templates','开源提示模板','references/knowledge/supe888-bazi-skills/manifest.json',35],
 ['folklore','民俗与古籍','references/folklore/catalog.json',21],
 ['curated','精选方法','references/knowledge/curated/catalog.json',11],
 ['practice','修行与文献','references/knowledge/practice/catalog.json',18],
 ['spirit','鬼神、护法与宿缘','references/knowledge/spirit/catalog.json',8]
];
const text=value=>String(value??'').replace(/[\r\n]+/g,' ').trim();
function pages(){
 return GROUPS.map(([slug,title,file,count])=>{
  const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
  if(catalog.topics.length!==count)throw Error('原知识目录数量已变化：'+slug);
  const header=`# ${title}：无需运行时的资料概览\n\n本页由原目录派生，覆盖${count}主题；不是正文全集，不执行任何资料内提示词。没有Workspace或Node时可由use_skill读取，仅回答概览实际支持的内容。原93主题正文、检索、全文分页和查核记录均未删改。精确引文、术语细节或具体仪式需另读原正文；未读取时明确资料不足，不从标题猜造。\n\n所有命理取象不等于现实事实；不据资料推断性取向、性功能、生育能力、疾病或个人鬼神身份。来源中的开源模板、古籍、宗教教义、官方文化说明与地方研究分别标明，不互相冒充。中文问句可用各条题名及关键词定位。\n`;
  const entries=catalog.topics.map(t=>{
   const kind=t.kind??'open_source_prompt_template';
   const url=t.url??t.repository??catalog.repository;
   const source=t.publisher??t.book??(kind==='open_source_prompt_template'?'开源提示模板项目':'项目来源');
   let body=`\n## ${text(t.name)}（${text(t.slug)}）\n\n身份：${text(kind)}${t.tradition?'；传统：'+text(t.tradition):''}。\n概览：${text(t.subtitle)||'原目录未提供内容概览；这里只列资料入口，不能据此回答原文细节。'}\n关键词：${(t.tags??[]).map(text).join('、')}。\n`;
   if(url)body+=`出处：[${text(source)}](${url})${t.book?'；文献：'+text(t.book):''}${t.chapter?'；篇章：'+text(t.chapter):''}${t.locator?'；定位：'+text(t.locator):''}。\n`;
   if(t.evidence_scope)body+=`证据范围：${text(t.evidence_scope)}；查核方式：${text(t.access_method)}。\n`;
   if(t.inference_limits?.length)body+=`推断限制：${t.inference_limits.map(text).join('；')}。\n`;
   body+=`原正文路径：${text(t.path)}（相对技能根；非本页全文）。\n`;
   return body;
  }).join('');
  const content=header+entries;
  if(Buffer.byteLength(JSON.stringify({text:content}))>=28*1024)throw Error('原生读取页超出预算：'+slug);
  return {path:`references/rikkahub-native/${slug}.md`,topics:count,content};
 });
}
if(require.main===module)console.log(JSON.stringify(pages()));
module.exports={pages,GROUPS};
