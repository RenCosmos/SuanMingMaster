'use strict';
// Sidecar labels only: retain the exact saved cross-relation records and IDs.
const {relations}=require('./bazi-rules.cjs');
const GROUPS=new Set(['三合','三会','三刑齐全','自刑（采用本规则表）']);
function groupContext(items,people){
 const natal=Object.entries(people).map(([person_id,pillars])=>({person_id,groups:relations(pillars).filter(r=>GROUPS.has(r.type))}));
 return items.filter(r=>GROUPS.has(r.type)).map(r=>{
  const owners=natal.filter(p=>p.groups.some(n=>n.type===r.type&&n.symbols===r.symbols)).map(p=>p.person_id);
  return {relation_id:r.id,natal_complete_people:owners,group_state:owners.length?'natal_already_complete':'completed_across_people'};
 });
}
module.exports={groupContext};
