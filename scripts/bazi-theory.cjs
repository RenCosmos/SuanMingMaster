'use strict';
const {tenGod}=require('./bazi-rules.cjs');
const {LunarUtil}=require('lunar-typescript');
const GAN='甲乙丙丁戊己庚辛壬癸',ZHI='子丑寅卯辰巳午未申酉戌亥';
function fiveRats(dayStem,branch){return GAN[(GAN.indexOf(dayStem)%5*2+ZHI.indexOf(branch))%10]+branch;}
function evidence(pillars,hourReferenceDay){
 const day=pillars[2].stem,element=LunarUtil.WU_XING_GAN[day],month=pillars[1];
 const roots=pillars.flatMap(p=>p.hidden_stems.flatMap((g,i)=>LunarUtil.WU_XING_GAN[g]===element?[{source_id:`${p.id}-H${i+1}`,pillar_id:p.id,branch:p.branch,stem:g,ten_god:tenGod(day,g),hidden_order:i+1}]:[]));
 const visible=pillars.filter(p=>p.id!=='BZ-DAY').map(p=>({source_id:`${p.id}-S`,pillar_id:p.id,stem:p.stem,ten_god:tenGod(day,p.stem)}));
 const transparency=month.hidden_stems.map((g,i)=>({hidden_source_id:`BZ-MONTH-H${i+1}`,stem:g,ten_god:tenGod(day,g),visible_sources:visible.filter(v=>v.stem===g).map(v=>v.source_id)}));
 const monthBranchIndex=(ZHI.indexOf(month.branch)-2+12)%12;
 const expectedMonth=GAN[(GAN.indexOf(pillars[0].stem)%5*2+2+monthBranchIndex)%10]+month.branch;
 const expectedHour=fiveRats(hourReferenceDay,pillars[3].branch);
 return {id:'BZ-THEORY',method:'ziping-evidence/v1',month_command:{source_id:'BZ-MONTH',branch:month.branch,main_qi:month.hidden_stems[0],main_qi_ten_god:tenGod(day,month.hidden_stems[0])},day_master_roots:roots,visible_support:visible.filter(v=>['比肩','劫财','正印','偏印'].includes(v.ten_god)),visible_output_wealth_officer:visible.filter(v=>!['比肩','劫财','正印','偏印'].includes(v.ten_god)),month_hidden_transparency:transparency,five_tigers:{year_stem:pillars[0].stem,expected:expectedMonth,actual:month.ganzhi,matches:expectedMonth===month.ganzhi},five_rats:{reference_day_stem:hourReferenceDay,selected_day_stem:day,expected:expectedHour,actual:pillars[3].ganzhi,matches:expectedHour===pillars[3].ganzhi},automatic_strength:null,automatic_pattern:null,automatic_useful_element:null};
}
module.exports={fiveRats,evidence};
