'use strict';
const {Temporal}=require('@js-temporal/polyfill');
const METHOD='noaa-meeus-equation-of-time/v1';
const rad=d=>d*Math.PI/180,mod=(a,b)=>(a%b+b)%b;
// NOAA 的 Meeus 太阳位置算法：均时差取出生 UTC 瞬间，不取当地日序。
function equationOfTime(instant){
 const i=Temporal.Instant.from(instant),jd=i.epochMilliseconds/86400000+2440587.5,t=(jd-2451545)/36525;
 const l=rad(mod(280.46646+t*(36000.76983+t*0.0003032),360));
 const m=rad(357.52911+t*(35999.05029-0.0001537*t));
 const e=0.016708634-t*(0.000042037+0.0000001267*t);
 const ob=rad(23+(26+(21.448-t*(46.815+t*(0.00059-t*0.001813)))/60)/60+0.00256*Math.cos(rad(125.04-1934.136*t)));
 const y=Math.tan(ob/2)**2;
 return 4*180/Math.PI*(y*Math.sin(2*l)-2*e*Math.sin(m)+4*e*y*Math.sin(m)*Math.cos(2*l)-0.5*y*y*Math.sin(4*l)-1.25*e*e*Math.sin(2*m));
}
function solarTime(zoned,longitude){
 const z=Temporal.ZonedDateTime.from(zoned),offsetMinutes=z.offsetNanoseconds/60000000000;
 const equation=equationOfTime(z.toInstant()),longitudeCorrection=4*longitude-offsetMinutes,total=longitudeCorrection+equation;
 const local=z.toPlainDateTime().add({nanoseconds:Math.round(total*60000000000)});
 const seconds=local.hour*3600+local.minute*60+local.second+local.millisecond/1000+local.microsecond/1e6+local.nanosecond/1e9;
 const distance=Math.min(...[0,1,3,5,7,9,11,13,15,17,19,21,23,24].map(h=>Math.abs(seconds-h*3600)));
 return {local,record:{method:METHOD,longitude_degrees_east:longitude,utc_instant:z.toInstant().toString(),actual_utc_offset:z.offset,actual_utc_offset_minutes:offsetMinutes,equation_of_time_minutes:equation,longitude_timezone_correction_minutes:longitudeCorrection,total_correction_minutes:total,civil_datetime:z.toPlainDateTime().toString({smallestUnit:'second'}),mean_solar_datetime:z.toPlainDateTime().add({nanoseconds:Math.round(longitudeCorrection*60000000000)}).toString({smallestUnit:'millisecond',roundingMode:'floor'}),apparent_solar_datetime:local.toString({smallestUnit:'millisecond',roundingMode:'floor'}),crosses_civil_date:Temporal.PlainDate.compare(local.toPlainDate(),z.toPlainDate())!==0,distance_to_day_or_shichen_boundary_seconds:distance,within_60_second_review_band:distance<=60,solar_datetime_is_clock_reading:true}};
}
module.exports={equationOfTime,solarTime,METHOD};
