'use strict';
const {Solar}=require('lunar-typescript');
const {check,Temporal}=require('./common.cjs');
const RULES=require('../references/partner-image-rules.json');
const src=(person_id,source_id)=>({person_id,source_id});
function zodiac(chart,pid){
 const dt=Temporal.PlainDateTime.from(chart.normalized.beijing_datetime),lunar=Solar.fromYmdHms(dt.year,dt.month,dt.day,dt.hour,dt.minute,dt.second).getLunar();
 const lunarBranch=lunar.getYearZhi(),branch=chart.bazi?chart.bazi.chart.pillars.find(p=>p.id==='BZ-YEAR').branch:lunarBranch;
 check(RULES.animals[branch],'生肖地支无效');
 const liuhe=RULES.liuhe.find(pair=>pair.includes(branch)),sanhe=RULES.sanhe.find(group=>group.includes(branch));
 return {id:`R-${pid.toUpperCase()}-ZODIAC`,person_id:pid,year_branch:branch,animal:RULES.animals[branch],basis:chart.bazi?'立春换年；使用本人八字年柱':'中国农历年；使用归一化北京时间',lunar_new_year_animal:RULES.animals[lunarBranch],boundary_difference:branch!==lunarBranch,
  natal_source:chart.bazi?src(pid,'BZ-YEAR'):{person_id:pid,source_field:'normalized.beijing_datetime'},
  affinity_candidates:[{relation:'六合',branch:[...liuhe].find(z=>z!==branch)},...[...sanhe].filter(z=>z!==branch).map(branch=>({relation:'三合',branch}))].map((c,i)=>({...c,id:`R-${pid.toUpperCase()}-ZODIAC-C${i+1}`,animal:RULES.animals[c.branch],rule_id:c.relation==='六合'?'PI-ZODIAC-LIUHE':'PI-ZODIAC-SANHE'})),source_role:'辅助缘分线索，不生成对象唯一属相或面貌'};
}
function partnerImage(chart,pid,model){
 const ledger=[],zodiacData=zodiac(chart,pid);
 function add(rule,key,descriptors,weight,source,detail,sources=[source]){ledger.push({id:`R-${pid.toUpperCase()}-IMAGE-${String(ledger.length+1).padStart(3,'0')}`,rule_id:rule,key,descriptors,weight,source,sources,detail});}
 let bazi=null,ziwei=null;
 if(chart.bazi){
  const day=chart.bazi.chart.pillars.find(p=>p.id==='BZ-DAY'),chosen=model==='wealth'?['正财','偏财']:model==='authority'?['正官','七杀']:['正财','偏财','正官','七杀'];
  const element=day.branch_element,mainGod=day.hidden_ten_gods[0];
  add('PI-DAY-ELEMENT',element,RULES.elements[element],RULES.weights.bazi_day_element,src(pid,'BZ-DAY'),`夫妻宫日支 ${day.branch}，五行 ${element}`);
  add('PI-DAY-TENGOD',mainGod,RULES.ten_gods[mainGod],RULES.weights.bazi_day_ten_god,src(pid,'BZ-DAY-H1'),`日支本气 ${day.hidden_stems[0]}，十神 ${mainGod}`);
  const candidates=chart.bazi.calculations.score_ledger.filter(x=>chosen.includes(x.ten_god));
  const byElement={};for(const x of candidates)byElement[x.element]=(byElement[x.element]??0)+x.weight;
  const max=Math.max(0,...Object.values(byElement)),dominant=Object.keys(byElement).filter(e=>byElement[e]===max);
  for(const e of dominant){const matches=candidates.filter(x=>x.element===e);add('PI-PARTNER-ELEMENT',e,RULES.elements[e],RULES.weights.partner_element,src(pid,matches[0].id),`配偶星候选 ${e}，结构权重 ${byElement[e]}；透藏依据 ${matches.map(x=>x.id).join(', ')}`,matches.map(x=>src(pid,x.id)));}
  bazi={day_branch:day.branch,day_branch_element:element,day_main_ten_god:mainGod,partner_star_model:model,partner_element_weights:byElement,dominant_partner_elements:dominant};
 }
 if(chart.ziwei){
  const palaces=chart.ziwei.chart.palaces,spouse=palaces.find(p=>p.name.replace(/宫$/,'')==='夫妻');check(spouse,'紫微盘缺少夫妻宫');
  const opposite=palaces[(spouse.index+6)%12],borrowing=spouse.majorStars.length===0,origin=borrowing?opposite:spouse;
  for(const star of origin.majorStars){add('PI-ZW-SPOUSE-STAR',star.name,RULES.major_stars[star.name],borrowing?RULES.weights.ziwei_opposite:RULES.weights.ziwei_spouse,src(pid,origin.id),`${borrowing?'对宫辅助':'夫妻宫'} ${star.name}${star.brightness?'（'+star.brightness+'）':''}${star.mutagen??''}`);}
  ziwei={spouse_palace:src(pid,spouse.id),spouse_branch:spouse.earthlyBranch,major_stars:spouse.majorStars,borrowing_opposite:borrowing,opposite_source:borrowing?src(pid,opposite.id):null,reference_stars:origin.majorStars,minor_stars:spouse.minorStars,adjective_stars:spouse.adjectiveStars,spouse_group:chart.ziwei.calculations.three_sides_four_correct.find(g=>g.palace_id===spouse.id)};
 }
 const dimensions={};
 for(const dimension of ['appearance','temperament','style']){
  const map=new Map();for(const item of ledger)for(const tag of item.descriptors[dimension]??[]){const old=map.get(tag)??{tag,structural_weight:0,evidence_ids:[],sources:[]};old.structural_weight+=item.weight;old.evidence_ids.push(item.id);old.sources.push(...item.sources);map.set(tag,old);}
  dimensions[dimension]=[...map.values()].sort((a,b)=>b.structural_weight-a.structural_weight||a.tag.localeCompare(b.tag)).map(x=>({...x,structural_weight:Math.round(x.structural_weight*1000)/1000}));
 }
 return {id:`R-${pid.toUpperCase()}-PARTNER-IMAGE`,person_id:pid,rule_version:RULES.version,bazi,ziwei,zodiac:zodiacData,dimensions,ledger,method:'八字夫妻宫与候选配偶星 + 紫微夫妻宫星曜；生肖合局单列为辅助，不添加到外形标签权重',output_scope:'外形印象、气质、风格和年龄倾向；不用标签权重报准确率、精确身高或对象身份证明'};
}
module.exports={partnerImage,zodiac};
