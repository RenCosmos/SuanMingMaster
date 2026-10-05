'use strict';
const {LunarUtil} = require('lunar-typescript');
const {check,digest} = require('./common.cjs');
const GAN = '甲乙丙丁戊己庚辛壬癸';
const ELEMENTS = ['木','火','土','金','水'];
const GODS = ['比肩','劫财','食神','伤官','偏财','正财','七杀','正官','偏印','正印'];
const element = g => LunarUtil.WU_XING_GAN[g];
function tenGod(day, other) {
  const a=ELEMENTS.indexOf(element(day)), b=ELEMENTS.indexOf(element(other));
  check(a>=0 && b>=0,'十神输入必须是有效天干');
  const parity=GAN.indexOf(day)%2===GAN.indexOf(other)%2;
  const delta=(b-a+5)%5;
  return ({0:['比肩','劫财'],1:['食神','伤官'],2:['偏财','正财'],3:['七杀','正官'],4:['偏印','正印']})[delta][parity?0:1];
}
const zero = keys => Object.fromEntries(keys.map(k=>[k,0]));
const round=n=>Math.round(n*1e6)/1e6;
function relations(pillars) {
  const results=[];
  const pairs=[
    ['天干五合','stem',['甲己','乙庚','丙辛','丁壬','戊癸']],
    ['地支六合','branch',['子丑','寅亥','卯戌','辰酉','巳申','午未']],
    ['地支六冲','branch',['子午','丑未','寅申','卯酉','辰戌','巳亥']],
    ['地支六害','branch',['子未','丑午','寅巳','卯辰','申亥','酉戌']],
    ['地支六破','branch',['子酉','卯午','辰丑','未戌','寅亥','巳申']],
    ['相刑（成对规则）','branch',['子卯','寅巳','巳申','寅申','丑戌','戌未','丑未']],
  ];
  for (const [type,field,table] of pairs) for(let i=0;i<pillars.length;i++) for(let j=i+1;j<pillars.length;j++) {
    const a=pillars[i][field],b=pillars[j][field];
    if(a!==b && table.some(s=>s.includes(a)&&s.includes(b))) results.push({type,symbols:a+b,pillars:[pillars[i].id,pillars[j].id],basis:'固定关系表；只识别结构，不自动判合化或吉凶'});
  }
  for(const [type,groups] of [['三合',['申子辰','亥卯未','寅午戌','巳酉丑']],['三会',['寅卯辰','巳午未','申酉戌','亥子丑']],['三刑齐全',['寅巳申','丑戌未']]]) {
    for(const group of groups) if([...group].every(z=>pillars.some(p=>p.branch===z))) results.push({type,symbols:group,pillars:pillars.filter(p=>group.includes(p.branch)).map(p=>p.id),basis:'三字齐全；不是成化或事件成立判据'});
  }
  for(const z of '辰午酉亥') { const ps=pillars.filter(p=>p.branch===z); if(ps.length>=2) results.push({type:'自刑（采用本规则表）',symbols:z+z,pillars:ps.map(p=>p.id),basis:'重复地支；解释存在流派差异'}); }
  return results.map((r,i)=>({id:`BZ-REL-${String(i+1).padStart(3,'0')}`,...r}));
}
function calculate(pillars, dayStem, cfg) {
  check(cfg.version && Number.isFinite(cfg.visible_stem_weight) && cfg.visible_stem_weight>0 && Number.isFinite(cfg.month_branch_multiplier) && cfg.month_branch_multiplier>0, '无效八字权重配置');
  for(const n of [1,2,3]) check(Array.isArray(cfg.hidden_weights[n]) && cfg.hidden_weights[n].length===n && cfg.hidden_weights[n].every(v=>Number.isFinite(v)&&v>0) && Math.abs(cfg.hidden_weights[n].reduce((a,b)=>a+b,0)-1)<1e-9, '藏干权重必须为正数且各组总和为 1');
  const surface=zero(ELEMENTS), hidden=zero(ELEMENTS), score=zero(ELEMENTS), godScore=zero(GODS), ledger=[];
  for(const p of pillars) {
    surface[element(p.stem)]++; surface[LunarUtil.WU_XING_ZHI[p.branch]]++;
    const visible={id:`${p.id}-S`,source:p.id,kind:'visible_stem',stem:p.stem,element:element(p.stem),ten_god:tenGod(dayStem,p.stem),weight:cfg.visible_stem_weight};
    ledger.push(visible);score[visible.element]+=visible.weight;
    // 日主自身计入五行，但不计入“其他天干/藏干十神分布”。
    if(p.id!=='BZ-DAY') godScore[visible.ten_god]+=visible.weight;
    const weights=cfg.hidden_weights[p.hidden_stems.length];
    p.hidden_stems.forEach((g,i)=>{
      hidden[element(g)]++;
      const w=weights[i]*(p.id==='BZ-MONTH'?cfg.month_branch_multiplier:1);
      const item={id:`${p.id}-H${i+1}`,source:p.id,kind:'hidden_stem',stem:g,element:element(g),ten_god:tenGod(dayStem,g),weight:round(w)};
      ledger.push(item);score[item.element]+=w;godScore[item.ten_god]+=w;
    });
  }
  for(const k of ELEMENTS) score[k]=round(score[k]); for(const k of GODS) godScore[k]=round(godScore[k]);
  const idx=ELEMENTS.indexOf(element(dayStem));
  const support=round(score[ELEMENTS[idx]]+score[ELEMENTS[(idx+4)%5]]);
  const total=round(Object.values(score).reduce((a,b)=>a+b,0));
  const month=pillars.find(p=>p.id==='BZ-MONTH');
  return {rule_version:cfg.version,rule_sha256:digest(cfg),surface_element_counts:surface,hidden_stem_element_counts:hidden,weighted_element_scores:score,ten_god_weighted_distribution:godScore,
    score_ledger:ledger,support_proxy:{support,total,ratio:round(support/total),support_elements:[ELEMENTS[idx],ELEMENTS[(idx+4)%5]],note:'结构权重比例，未纳入调候、透藏、合化等综合条件；不直接输出身强身弱或喜用神。'},
    month_main_qi:{source:'BZ-MONTH-H1',stem:month.hidden_stems[0],ten_god:tenGod(dayStem,month.hidden_stems[0]),note:'月支本气十神；不是格局已经成立的结论。'},relations:relations(pillars)};
}
module.exports={tenGod,calculate,relations,ELEMENTS};
