'use strict';
const {astro}=require('iztro');
const {getMutagensByHeavenlyStem}=require('iztro/lib/utils');
const {flyingMutagens}=require('./ziwei-flying.cjs');
const {check}=require('./common.cjs');
const MUTAGENS=['禄','权','科','忌'];
const MAJORS=['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼','巨门','天相','天梁','七杀','破军'];
function timeIndex(hour) { return hour===23?12:Math.floor((hour+1)/2); }
function stars(p) { return [...p.majorStars,...p.minorStars,...p.adjectiveStars]; }
function cleanStar(s) { return {name:s.name,type:s.type,scope:s.scope,...(s.brightness!==undefined?{brightness:s.brightness}:{}),...(s.mutagen!==undefined?{mutagen:s.mutagen}:{})}; }
function cleanPalace(p) { return {id:`ZW-P${p.index}`,index:p.index,name:p.name,heavenlyStem:p.heavenlyStem,earthlyBranch:p.earthlyBranch,isBodyPalace:p.isBodyPalace,isOriginalPalace:p.isOriginalPalace,majorStars:p.majorStars.map(cleanStar),minorStars:p.minorStars.map(cleanStar),adjectiveStars:p.adjectiveStars.map(cleanStar),changsheng12:p.changsheng12,boshi12:p.boshi12,decadal:p.decadal,ages:p.ages}; }
function makeZiwei(ctx) {
  astro.config({yearDivide:ctx.options.ziwei_year_boundary==='lichun'?'exact':'normal',horoscopeDivide:'normal',ageDivide:'normal',dayDivide:ctx.options.ziwei_day_boundary==='late_zi'?'forward':'current',algorithm:ctx.options.ziwei_algorithm});
  const a=astro.bySolar(ctx.normalized.solar_date,timeIndex(ctx.local.hour),ctx.input.birth.gender==='male'?'男':'女',ctx.options.ziwei_leap_adjust,'zh-CN');
  const palaces=a.palaces.map(cleanPalace);
  check(palaces.length===12 && new Set(palaces.map(p=>p.name)).size===12,'紫微十二宫结果不完整');
  for(const star of MAJORS) check(palaces.reduce((n,p)=>n+p.majorStars.filter(s=>s.name===star).length,0)===1,`主星 ${star} 安星缺失或重复`);
  const natal=[];
  for(const p of palaces) for(const s of stars(p)) if(s.mutagen) natal.push({id:`ZW-NATAL-${s.mutagen}`,mutagen:s.mutagen,star:s.name,palace_id:p.id,palace:p.name});
  check(natal.length===4 && new Set(natal.map(s=>s.mutagen)).size===4,'生年四化不完整');
  const groups=palaces.map(p=>({id:`ZW-GROUP-${p.index}`,palace_id:p.id,palace:p.name,self:p.id,trines:[`ZW-P${(p.index+4)%12}`,`ZW-P${(p.index+8)%12}`],opposite:`ZW-P${(p.index+6)%12}`,member_palaces:[p.index,(p.index+4)%12,(p.index+8)%12,(p.index+6)%12].map(i=>({palace_id:palaces[i].id,palace:palaces[i].name,major_stars:palaces[i].majorStars.map(s=>s.name)}))}));
  const empties=palaces.filter(p=>p.majorStars.length===0).map(p=>({id:`ZW-EMPTY-${p.index}`,palace_id:p.id,opposite_palace_id:palaces[(p.index+6)%12].id,opposite_major_stars:palaces[(p.index+6)%12].majorStars.map(s=>s.name),note:'本宫空主星，对宫主星单独列为辅助阅读。'}));
  let target=null,transit=[];
  if(ctx.target) {
    const h=a.horoscope(ctx.target.toString(),6);
    const cleanScope=(s)=>({index:s.index,name:s.name,heavenlyStem:s.heavenlyStem,earthlyBranch:s.earthlyBranch,palaceNames:[...s.palaceNames],mutagen:[...s.mutagen],...(s.nominalAge!==undefined?{nominalAge:s.nominalAge}:{}),...(s.stars?{stars:s.stars.map(ss=>ss.map(cleanStar))}:{})});
    target={id:'ZW-TARGET',date:ctx.target.toString(),evaluation_local_time:'12:00',solarDate:h.solarDate,lunarDate:h.lunarDate,decadal:cleanScope(h.decadal),yearly:cleanScope(h.yearly),age:cleanScope(h.age)};
    for(const [scope,item] of [['decadal',target.decadal],['yearly',target.yearly]]) {
      item.mutagen.forEach((name,i)=>{
        const matches=palaces.flatMap(p=>stars(p).filter(s=>s.name===name).map(()=>p));
        check(matches.length===1,`${scope} 四化星 ${name} 定位不唯一`);
        const p=matches[0];
        transit.push({id:`ZW-${scope.toUpperCase()}-${MUTAGENS[i]}`,scope,mutagen:MUTAGENS[i],star:name,natal_palace_id:p.id,natal_palace:p.name,scope_palace:item.palaceNames[p.index]});
      });
    }
  }
  return {chart:{solar_date:a.solarDate,lunar_date:a.lunarDate,chinese_date:a.chineseDate,time:a.time,time_index:timeIndex(ctx.local.hour),soul:a.soul,body:a.body,soul_palace_branch:a.earthlyBranchOfSoulPalace,body_palace_branch:a.earthlyBranchOfBodyPalace,five_elements_class:a.fiveElementsClass,conventions:{year_boundary:ctx.options.ziwei_year_boundary,day_boundary:ctx.options.ziwei_day_boundary,leap_adjust:ctx.options.ziwei_leap_adjust,algorithm:ctx.options.ziwei_algorithm,age:'normal：名义年龄按年份；大限、小限不是周岁',clock:'出生地钟表日期和时辰；未做真太阳时校正'},palaces,target},calculations:{rule_version:'ziwei-structural-v2',natal_mutagens:natal,three_sides_four_correct:groups,empty_major_palaces:empties,transit_mutagens:transit,palace_stem_flying:flyingMutagens(palaces,getMutagensByHeavenlyStem)}};
}
module.exports={makeZiwei,timeIndex,MAJORS};
