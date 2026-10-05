'use strict';
function intimacyFeatures(chart,pid){
 const data={id:`R-${pid.toUpperCase()}-INTIMACY`,person_id:pid,assessment_status:'symbolic_discussion_only',physiological_ability:null,ability_score:null,
  note:'十神、五行与夫妻/福德/命宫结构，结合本次问题和已有经历解释亲密互动、表达与节奏。'};
 if(chart.bazi){data.bazi={ten_god_occurrences:chart.bazi.calculations.score_ledger.filter(x=>['食神','伤官','比肩','劫财','正财','偏财','正官','七杀'].includes(x.ten_god)).map(x=>({ten_god:x.ten_god,stem:x.stem,kind:x.kind,pillar_id:x.source,weight:x.weight,source:{person_id:pid,source_id:x.id}})),surface_element_counts:chart.bazi.calculations.surface_element_counts,element_basis:'本人四柱五行本字计数'};}
 if(chart.ziwei){data.ziwei={palaces:chart.ziwei.chart.palaces.filter(p=>['夫妻','福德','命'].includes(p.name.replace(/宫$/,''))).map(p=>({name:p.name,major_stars:p.majorStars,source:{person_id:pid,source_id:p.id}})),marker_positions:chart.ziwei.chart.palaces.flatMap(p=>[...p.majorStars,...p.minorStars,...p.adjectiveStars].filter(s=>['红鸾','天喜','天姚','咸池'].includes(s.name)).map(s=>({star:s.name,palace:p.name,source:{person_id:pid,source_id:p.id}})))};}
 return data;
}
module.exports={intimacyFeatures};
