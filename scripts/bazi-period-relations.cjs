'use strict';
const {relations}=require('./bazi-rules.cjs');
const GROUP_TYPES=new Set(['三合','三会','三刑齐全','自刑（采用本规则表）']);

// 原局与当前大运/流年放在同一关系表计算，只返回含该岁运柱的记录。
// 三字齐全与原局已经齐全分别记录；均不等于已经合化或发生事件。
function periodRelations(pillars,period,{prefix=`${period.id}-REL`,natalRelations=relations(pillars)}={}) {
 return relations([...pillars,period]).filter(r=>r.pillars.includes(period.id)).map((r,i)=>{
  const field=r.type==='天干五合'?'stem':'branch';
  const natal=GROUP_TYPES.has(r.type)?natalRelations.filter(n=>n.type===r.type&&n.symbols===r.symbols):null;
  return {...r,id:`${prefix}-${String(i+1).padStart(3,'0')}`,relation_field:field,
   touches_day_branch:field==='branch'&&r.pillars.includes('BZ-DAY'),
   ...(natal?{natal_group_present:natal.length>0,natal_relation_ids:natal.map(n=>n.id),group_state:natal.length?'natal_already_complete':'completed_with_period'}:{})};
 });
}
function relationText(items,periodLabel='流年') {
 return items.map(r=>`${r.type} ${r.symbols}${r.group_state==='natal_already_complete'?`（原局已有，${periodLabel}再次参与）`:r.group_state==='completed_with_period'?`（${periodLabel}加入后齐全）`:''} [${r.id}]`).join('；')||'无本规则表命中';
}
module.exports={periodRelations,relationText};
