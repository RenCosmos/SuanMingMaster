'use strict';
const {Solar,LunarUtil} = require('lunar-typescript');
const {asSolar,readJson,ROOT,Temporal} = require('./common.cjs');
const {tenGod,calculate,relations} = require('./bazi-rules.cjs');
const {periodRelations}=require('./bazi-period-relations.cjs');
const {fiveRats,evidence}=require('./bazi-theory.cjs');
const path=require('node:path');
function jieqiReview(ctx){
 const table=asSolar(ctx.beijing).getLunar().getJieQiTable(),names=new Set(['立春','惊蛰','清明','立夏','芒种','小暑','立秋','白露','寒露','立冬','大雪','小寒']);
 const aliases={DA_XUE:'大雪',XIAO_HAN:'小寒',LI_CHUN:'立春'};
 const items=Object.entries(table).filter(([n])=>names.has(aliases[n]||n)).map(([n,s])=>{const dt=Temporal.PlainDateTime.from(s.toYmdHms().replace(' ','T'));return {name:aliases[n]||n,beijing_datetime:dt.toString(),difference_seconds:ctx.zoned.toInstant().since(dt.toZonedDateTime('+08:00').toInstant()).total('seconds')};});
 items.sort((a,b)=>Math.abs(a.difference_seconds)-Math.abs(b.difference_seconds));
 return {id:'BZ-JIE-REVIEW',...items[0],review_band_seconds:60,within_review_band:Math.abs(items[0].difference_seconds)<=60,band_is_sample_based_review_policy:true};
}
function pillar(id,label,gz,day) {
  const stem=gz[0],branch=gz[1],hidden_stems=[...LunarUtil.ZHI_HIDE_GAN[branch]];
  return {id,label,ganzhi:gz,stem,branch,stem_element:LunarUtil.WU_XING_GAN[stem],branch_element:LunarUtil.WU_XING_ZHI[branch],hidden_stems,nayin:LunarUtil.NAYIN[gz],stem_ten_god:id==='BZ-DAY'?'日主':tenGod(day,stem),hidden_ten_gods:hidden_stems.map(g=>tenGod(day,g))};
}
// Shared exact calendar path; search callers need pillars, not Yun/transit reports.
function makePillars(ctx) {
  const ref=asSolar(ctx.beijing).getLunar().getEightChar();
  const dayLocal=ctx.options.time_basis==='true_solar'?ctx.solar.local:ctx.local;
  const local=asSolar(dayLocal).getLunar().getEightChar();
  local.setSect(ctx.options.bazi_day_boundary==='late_zi'?1:2);
  const day=local.getDayGan();
  const hour=ctx.options.bazi_hour_stem_rule==='day_stem'?fiveRats(day,local.getTimeZhi()):local.getTime();
  const hourReference=ctx.options.bazi_hour_stem_rule==='library'&&dayLocal.hour===23?asSolar(dayLocal.add({days:1})).getLunar().getEightChar().getDayGan():day;
  const pillars=[pillar('BZ-YEAR','年柱',ref.getYear(),day),pillar('BZ-MONTH','月柱',ref.getMonth(),day),pillar('BZ-DAY','日柱',local.getDay(),day),pillar('BZ-HOUR','时柱',hour,day)];
  return {ref,dayLocal,day,hourReference,pillars};
}
function makeBazi(ctx) {
  const {ref,dayLocal,day,hourReference,pillars}=makePillars(ctx);
  const natalRelations=relations(pillars);
  const dayHour=dt=>{const e=asSolar(dt).getLunar().getEightChar();e.setSect(ctx.options.bazi_day_boundary==='late_zi'?1:2);return {day:e.getDay(),hour:ctx.options.bazi_hour_stem_rule==='day_stem'?fiveRats(e.getDayGan(),e.getTimeZhi()):e.getTime()};};
  const civil=ctx.solar?dayHour(ctx.local):null,solar=ctx.solar?dayHour(ctx.solar.local):null;
  const timeValidation=ctx.solar?{id:'BZ-TIME-CHECK',selected_basis:ctx.options.time_basis,civil_day_hour:civil,true_solar_day_hour:solar,day_changes:civil.day!==solar.day,hour_changes:civil.hour!==solar.hour,...ctx.solar.record}:null;
  const yun=ref.getYun(ctx.input.birth.gender==='male'?1:0,2);
  const start=yun.getStartSolar();
  const startBJ=Temporal.ZonedDateTime.from({year:start.getYear(),month:start.getMonth(),day:start.getDay(),hour:start.getHour(),minute:start.getMinute(),second:start.getSecond(),timeZone:'+08:00'});
  const dayun=yun.getDaYun(ctx.options.dayun_count+1).filter(d=>d.getIndex()>0).map(d=>{
    const p=pillar(`BZ-DY-${d.getIndex()}`,'大运',d.getGanZhi(),day),rs=periodRelations(pillars,p,{natalRelations});
    return {id:p.id,index:d.getIndex(),ganzhi:p.ganzhi,stem:p.stem,branch:p.branch,
      start_year:d.getStartYear(),end_year:d.getEndYear(),start_nominal_age:d.getStartAge(),end_nominal_age:d.getEndAge(),
      stem_ten_god:p.stem_ten_god,hidden_stems:p.hidden_stems,hidden_ten_gods:p.hidden_ten_gods,nayin:p.nayin,
      pillar_relations:rs,day_branch_relations:rs.filter(r=>r.touches_day_branch)};
  });
  let target=null,annual=[];
  if(ctx.target) {
    // 分析日期按出生地的正午定义，精确瞬间会在输出中保留，避免把当天所有时刻当成同一节气状态。
    const t=ctx.target.toZonedDateTime({timeZone:ctx.input.birth.timezone,plainTime:'12:00'}).withTimeZone('+08:00').toPlainDateTime();
    const ec=asSolar(t).getLunar().getEightChar();
    const yearRelations=periodRelations(pillars,pillar('BZ-TARGET-YEAR','目标流年',ec.getYear(),day),{prefix:'BZ-TARGET-REL',natalRelations});
    target={id:'BZ-TARGET',local_date:ctx.target.toString(),evaluation_local_time:'12:00',beijing_datetime:t.toString(),year_ganzhi:ec.getYear(),month_ganzhi:ec.getMonth(),year_ten_god:tenGod(day,ec.getYearGan()),month_ten_god:tenGod(day,ec.getMonthGan()),year_relations:yearRelations};
    let y=t.year;
    if(Solar.fromYmdHms(y,6,1,12,0,0).getLunar().getEightChar().getYear()!==ec.getYear()) y--;
    annual=Array.from({length:ctx.options.annual_count},(_,i)=>{
      const year=y+i,gz=Solar.fromYmd(year,6,1).getLunar().getEightChar().getYear(),p=pillar(`BZ-ANNUAL-${year}`,'流年',gz,day);
      const rs=periodRelations(pillars,p,{natalRelations});
      return {id:p.id,lichun_cycle_year:year,ganzhi:gz,stem:p.stem,branch:p.branch,stem_ten_god:p.stem_ten_god,
        hidden_stems:p.hidden_stems,hidden_ten_gods:p.hidden_ten_gods,pillar_relations:rs,day_branch_relations:rs.filter(r=>r.touches_day_branch),
        note:'立春周期标签；该公历年立春前仍属于上一周期。'};
    });
  }
  const cfg=readJson(path.join(ROOT,'references','bazi-rules.json'));
  return {chart:{day_master:day,pillars,jieqi_boundary_review:jieqiReview(ctx),time_basis:ctx.normalized,day_hour_calculation_datetime:dayLocal.toString({smallestUnit:'millisecond',roundingMode:'floor'}),...(timeValidation?{time_validation:timeValidation}:{}),conventions:{year_month:'北京时间对应的真实出生瞬间；立春换年、十二节换月',day_hour:ctx.options.time_basis==='true_solar'?'出生地真太阳钟面日期时间':'出生地钟表日期时间',day_boundary:ctx.options.bazi_day_boundary,hour_stem_rule:ctx.options.bazi_hour_stem_rule},qiyun:{method:'lunar-typescript Yun sect=2（分钟差换算起运）',direction:yun.isForward()?'forward':'backward',offset:{years:yun.getStartYear(),months:yun.getStartMonth(),days:yun.getStartDay(),hours:yun.getStartHour()},start_datetime_beijing:startBJ.toString(),start_datetime_birth_timezone:startBJ.withTimeZone(ctx.input.birth.timezone).toString(),note:'起运以实际出生瞬间与北京时间十二节比较；年龄区间采用库的名义年龄，不等于周岁。'},dayun,target,annual},calculations:{...calculate(pillars,day,cfg),theory_evidence:evidence(pillars,hourReference)}};
}
module.exports={makeBazi,makePillars,pillar};
