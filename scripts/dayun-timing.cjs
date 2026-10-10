'use strict';
// Read-only selection: calendar/DaYun artifacts retain their original values.
const {Temporal,check}=require('./common.cjs');
const {Solar}=require('lunar-typescript');
function windows(chart){
 const first=Temporal.ZonedDateTime.from(chart.qiyun.start_datetime_beijing);
 return chart.dayun.map(d=>{const start=first.add({years:10*(d.index-1)}),end=first.add({years:10*d.index});
  return {period:d,start,end};});
}
function active(chart,at){
 const evaluation=at!==undefined?Temporal.Instant.from(at):chart.target?Temporal.PlainDate.from(chart.target.local_date).toZonedDateTime({timeZone:chart.time_basis.timezone,plainTime:chart.target.evaluation_local_time}).toInstant():null;
 const intervals=windows(chart),w=evaluation&&intervals.find(w=>Temporal.Instant.compare(evaluation,w.start.toInstant())>=0&&Temporal.Instant.compare(evaluation,w.end.toInstant())<0);
 return {window:w??null,evaluation,status:!evaluation?'target_not_requested':w?'active':Temporal.Instant.compare(evaluation,intervals[0].start.toInstant())<0?'before_first_dayun':'after_computed_range'};
}
function boundaries(w){return {start_datetime:w.start.toString(),end_datetime_exclusive:w.end.toString()};}
function cycle(year){
 const lichun=y=>{const solar=Solar.fromYmd(y,6,1).getLunar().getJieQiTable()['立春'];check(solar.getYear()===y,'立春周期年份不一致');return Temporal.PlainDateTime.from(solar.toYmdHms().replace(' ','T')).toZonedDateTime('+08:00').toInstant();};
 return {start:lichun(year),end:lichun(year+1)};
}
function annualWindows(chart,years){
 const ranges=years.map(cycle);return windows(chart).filter(w=>ranges.some(r=>Temporal.Instant.compare(w.start.toInstant(),r.end)<0&&Temporal.Instant.compare(w.end.toInstant(),r.start)>0));
}
function summary(a){return {status:a.status,evaluation_instant:a.evaluation?.toString()??null,period_id:a.window?.period.id??null,method:'起运瞬间为锚；北京时间每十公历年交运；起点含、终点不含；年份标签不作交运日'};}
module.exports={windows,active,boundaries,annualWindows,summary};
