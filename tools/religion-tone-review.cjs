'use strict';
// Exact reviewed wording migrations only; no ignored fields or weakened source checks.
const reviewed=require('./reviewed-changes-v1.3.1.json');
const REPLACEMENTS=[
 ['这些是对特定文化的分析，不是对超自然存在的检测。',''],
 ['“我有没有护法”“某神是不是我的护法”属于个人信仰解释，现有排盘及本卡不能认证。愿文不构成免灾、治病或确保事件结果的实证保证。','“我有没有护法”“某神是不是我的护法”属于个人信仰解释，可以结合相应传统讨论护持观念，但现有排盘及本卡不能确认特定个人护法。经文发愿按其宗教含义理解，不作为对个人免灾、治病或事件结果的保证。'],
 ['用于解释为什么民间会普度、什么是无祀亡魂、地方仪式怎样表达济幽与祈安。政府对文化的介绍不是对鬼魂存在、数量或某人被鬼纠缠的认证。','用于解释为什么民间会普度、什么是无祀亡魂、地方仪式怎样表达济幽与祈安，保留台湾地方祭祀语境。'],
 ['不把经文愿文变成免灾实证保证','不把经文愿文变成个人免灾保证'],
 ['佛道观念与台湾地方祭祀，官方文化说明不等于鬼魂认证','佛道观念与台湾地方祭祀，保留中元普度的地方文化语境'],
 ['政府文化说明不认证鬼魂存在或个人遭遇','不据文化说明判定个人遭遇'],
 ['原93主题正文、检索、全文分页和查核记录均未删改。','原93主题、检索、全文分页和查核记录均保留。']
];
function rewriteText(value){return REPLACEMENTS.reduce((text,[before,after])=>text.replaceAll(before,after),value);}
function reviewedLegacy(value){
 if(typeof value==='string'){
  const digest=Object.entries(reviewed.files).find(([file,e])=>file.startsWith('references/knowledge/spirit/cards/')&&value===e.old_sha256)?.[1];
  return digest?digest.new_sha256:rewriteText(value);
 }
 if(Array.isArray(value))return value.map(reviewedLegacy);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,reviewedLegacy(v)]));
 return value;
}
module.exports={REPLACEMENTS,rewriteText,reviewedLegacy};
