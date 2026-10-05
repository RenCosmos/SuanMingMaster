'use strict';
const {check}=require('./common.cjs');
const MUTAGENS=['禄','权','科','忌'];

// 对同一张已安星的命盘计算宫干四化；保留 iztro 当前配置的四化表。
function flyingMutagens(palaces,resolveStars){
 const destinations=new Map();
 for(const p of palaces)for(const s of [...p.majorStars,...p.minorStars,...p.adjectiveStars]){
  const list=destinations.get(s.name)||[];list.push(p);destinations.set(s.name,list);
 }
 const table=Object.fromEntries([...new Set(palaces.map(p=>p.heavenlyStem))].map(stem=>[stem,resolveStars(stem)]));
 for(const [stem,names] of Object.entries(table))check(names.length===4&&new Set(names).size===4,`${stem} 宫干四化表不完整`);
 const entries=palaces.flatMap(origin=>table[origin.heavenlyStem].map((star,i)=>{
  const targets=destinations.get(star)||[];check(targets.length===1,`宫干四化星 ${star} 安星位置不唯一`);
  const target=targets[0];
  return {id:`ZW-FLY-${origin.index}-${MUTAGENS[i]}`,scope:'natal_palace_stem',mutagen:MUTAGENS[i],star,
   origin_palace_id:origin.id,origin_palace:origin.name,origin_heavenly_stem:origin.heavenlyStem,
   target_palace_id:target.id,target_palace:target.name,is_self_transform:origin.id===target.id,
   source_ids:[...new Set([origin.id,target.id])]};
 }));
 return {method:'iztro-palace-stem-flying/v1',transformation_table:table,
  entries,self_transforms:entries.filter(e=>e.is_self_transform),
  palace_summary:palaces.map(p=>({id:`ZW-FLY-SUM-${p.index}`,palace_id:p.id,palace:p.name,
   outgoing_ids:entries.filter(e=>e.origin_palace_id===p.id).map(e=>e.id),
   incoming_ids:entries.filter(e=>e.target_palace_id===p.id).map(e=>e.id),
   self_transform_ids:entries.filter(e=>e.origin_palace_id===p.id&&e.is_self_transform).map(e=>e.id)}))};
}
module.exports={flyingMutagens};
