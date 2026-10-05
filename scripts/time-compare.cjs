'use strict';
const {Temporal,check,digest,InputError,asSolar,normalize:normalizeChart}=require('./common.cjs');
const relationship=require('./relationship.cjs');
const SCHEMA='bazi-ziwei-time-compare/v1',VERSION='time-compare/0.5.0';
const cmp=Temporal.PlainDateTime.compare;
function fields(o,allowed,name){check(o&&typeof o==='object'&&!Array.isArray(o),`${name} 必须是对象`);for(const k of Object.keys(o))check(allowed.includes(k),`${name} 不支持字段 ${k}`);}
function time(s){check(typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(s),'候选时间须为 HH:mm 或 HH:mm:ss');return Temporal.PlainTime.from(s).toString({smallestUnit:'second'});}
function at(date,t){return date.toPlainDateTime(t);}
function plainString(dt){return dt.toString({smallestUnit:'second'});}
function midpoint(a,b){const seconds=a.until(b,{largestUnit:'second'}).seconds;return a.add({seconds:Math.floor(seconds/2)});}
function prepare(raw){
 fields(raw,['mode','label','question','chart_mode','birth','birth_options','time_uncertainty','target_date','context','options'],'时辰对照输入');check(raw.mode==='time_compare','mode 须为 time_compare');
 fields(raw.birth,['calendar','date','gender','timezone','is_leap_month','longitude','longitude_source'],'birth');
 const chartMode=raw.chart_mode??'both',question=raw.question??'比较出生时辰候选盘的一致项与变化项';
 // 只借用旧契约验证日期和参数；此探测盘不参与候选或对照。
 // 部分历史时区在中午跳时，不能让探测时间阻止其他有效候选。
 let probe,probeError;
 for(const hour of [12,...Array.from({length:24},(_,i)=>i).filter(h=>h!==12)]){
  try{probe=relationship.normalizeInput({mode:'relationship',chart_mode:chartMode,question,people:[{id:'a',...(raw.label!==undefined?{label:raw.label}:{}),birth:{...raw.birth,time:`${String(hour).padStart(2,'0')}:00`},...(raw.birth_options!==undefined?{options:raw.birth_options}:{})}],...(raw.target_date!==undefined?{target_date:raw.target_date}:{}),context:raw.context??{stage:'unspecified',topics:['romance','marriage','partner_image','age_relation','zodiac']},...(raw.options!==undefined?{options:raw.options}:{})});break;}
  catch(e){if(!(e instanceof InputError)||!/出生日期、时区无效|转换后的北京时间超出|校正后的太阳日期超出/.test(e.message))throw e;probeError??=e;}
 }
 if(!probe)throw probeError;
 const p=probe.people[0],normalized=normalizeChart({mode:chartMode,birth:p.birth,options:p.options,...(raw.target_date!==undefined?{target_date:raw.target_date}:{})}),date=Temporal.PlainDate.from(normalized.normalized.solar_date),u=raw.time_uncertainty;
 check(u&&typeof u==='object','必须提供 time_uncertainty');check(['unknown','range','candidates'].includes(u.type),'time_uncertainty.type 须为 unknown / range / candidates');
 let uncertainty;
 if(u.type==='unknown'){fields(u,['type'],'time_uncertainty');uncertainty={type:'unknown'};}
 else if(u.type==='range'){fields(u,['type','start','end','end_day_offset'],'time_uncertainty');const start=time(u.start),end=time(u.end),offset=u.end_day_offset??0;check([0,1].includes(offset),'end_day_offset 须为 0 或 1');check(cmp(at(date,start),at(date.add({days:offset}),end))<=0,'时间范围先后无效；明确跨日时设置 end_day_offset:1');uncertainty={type:'range',start,end,end_day_offset:offset};}
 else{fields(u,['type','times'],'time_uncertainty');check(Array.isArray(u.times)&&u.times.length>=1&&u.times.length<=48,'候选 times 须为 1–48 个明确时间');const times=u.times.map(time);check(new Set(times).size===times.length,'候选时间不能重复');uncertainty={type:'candidates',times:[...times].sort()};}
 const input={mode:'time_compare',question,chart_mode:chartMode,...(raw.label!==undefined?{label:raw.label}:{}),birth:{...p.birth},birth_options:p.options,time_uncertainty:uncertainty,context:probe.context,options:probe.options,...(raw.target_date!==undefined?{target_date:raw.target_date}:{})};delete input.birth.time;
 return {input,date,timezone:input.birth.timezone};
}
function generate(p){
 const {input,date,timezone}=p,u=input.time_uncertainty;
 if(u.type==='candidates')return {boundaries:[],intervals:[],points:u.times.map((t,i)=>({interval_id:null,local_datetime:plainString(at(date,t)),sampling_role:'provided',id:`TC-${String(i+1).padStart(3,'0')}`}))};
 const start=at(date,u.type==='unknown'?'00:00:00':u.start),last=at(date.add({days:u.type==='range'?u.end_day_offset:0}),u.type==='unknown'?'23:59:59':u.end),stop=last.add({seconds:1});
 const cuts=new Map();function cut(dt,reason){if(cmp(dt,start)<0||cmp(dt,stop)>0)return;const key=plainString(dt),v=cuts.get(key)??{datetime:key,reasons:[]};if(!v.reasons.includes(reason))v.reasons.push(reason);cuts.set(key,v);}
 cut(start,'range_start');cut(stop,'range_end_exclusive');
 for(let d=start.toPlainDate();Temporal.PlainDate.compare(d,stop.toPlainDate())<=0;d=d.add({days:1})){
  for(const h of [0,1,3,5,7,9,11,13,15,17,19,21,23])cut(at(d,`${String(h).padStart(2,'0')}:00:00`),h===0?'calendar_day':h===23?'late_zi':'shichen');
  // JieQi 表采用北京时间；转成出生地钟表时间后再分段。
  for(const [name,s] of Object.entries(asSolar(at(d,'12:00')).getLunar().getJieQiTable())){
   const z=Temporal.ZonedDateTime.from({year:s.getYear(),month:s.getMonth(),day:s.getDay(),hour:s.getHour(),minute:s.getMinute(),second:s.getSecond(),timeZone:'+08:00'});
   cut(z.withTimeZone(timezone).toPlainDateTime(),`solar_term:${name}`);
  }
 }
 // 用明确的 UTC 过渡点识别钟表跳时/重复区间；实际排盘仍拒绝这些歧义时间。
 let cursor=start.toZonedDateTime(timezone,{disambiguation:'earlier'}),end=stop.toZonedDateTime(timezone,{disambiguation:'later'});
 for(let n=0;n<8;n++){
  const tr=cursor.getTimeZoneTransition('next');if(!tr||Temporal.ZonedDateTime.compare(tr,end)>0)break;
  cut(tr.subtract({seconds:1}).toPlainDateTime().add({seconds:1}),'timezone_transition_before');cut(tr.toPlainDateTime(),'timezone_transition_after');cursor=tr.add({nanoseconds:1});
 }
 if(input.birth_options.time_basis==='true_solar'){
  const {solarTime}=require('./solar-time.cjs'),initial=[...cuts.values()].sort((a,b)=>cmp(Temporal.PlainDateTime.from(a.datetime),Temporal.PlainDateTime.from(b.datetime)));
  const corrected=dt=>solarTime(dt.toZonedDateTime(timezone,{disambiguation:'reject'}),input.birth.longitude).local;
  for(let i=0;i<initial.length-1;i++){
   const a=Temporal.PlainDateTime.from(initial[i].datetime),b=Temporal.PlainDateTime.from(initial[i+1].datetime).subtract({seconds:1});let sa,sb;
   try{sa=corrected(a);sb=corrected(b);}catch(e){if(e instanceof RangeError)continue;throw e;}
   for(let d=sa.toPlainDate();Temporal.PlainDate.compare(d,sb.toPlainDate())<=0;d=d.add({days:1}))for(const h of [0,1,3,5,7,9,11,13,15,17,19,21,23]){
    const target=at(d,`${String(h).padStart(2,'0')}:00:00`);if(cmp(target,sa)<=0||cmp(target,sb)>0)continue;
    let lo=0,hi=a.until(b,{largestUnit:'second'}).seconds;
    while(lo<hi){const mid=Math.floor((lo+hi)/2);if(cmp(corrected(a.add({seconds:mid})),target)>=0)hi=mid;else lo=mid+1;}
    cut(a.add({seconds:lo}),`true_solar:${h===0?'calendar_day':h===23?'late_zi':'shichen'}`);
   }
  }
 }
 const boundaries=[...cuts.values()].sort((a,b)=>cmp(Temporal.PlainDateTime.from(a.datetime),Temporal.PlainDateTime.from(b.datetime))),intervals=[],points=[];
 for(let i=0;i<boundaries.length-1;i++){
  const a=Temporal.PlainDateTime.from(boundaries[i].datetime),b=Temporal.PlainDateTime.from(boundaries[i+1].datetime).subtract({seconds:1}),id=`TI-${String(i+1).padStart(2,'0')}`;
  if(cmp(a,b)>0)continue;
  const samples=new Map();for(const [role,dt] of [['first',a],['middle',midpoint(a,b)],['last',b]]){const key=plainString(dt);const roles=samples.get(key)??[];roles.push(role);samples.set(key,roles);}
  const candidateIds=[];for(const [local_datetime,roles] of samples){const cid=`TC-${String(points.length+1).padStart(3,'0')}`;points.push({id:cid,interval_id:id,local_datetime,sampling_role:roles.join('+')});candidateIds.push(cid);}
  intervals.push({id,start:plainString(a),end:plainString(b),candidate_ids:candidateIds,boundary_reasons:boundaries[i].reasons});
 }
 check(points.length<=256,'候选点过多，请缩小范围');return {boundaries,intervals,points};
}
function relationInput(input,dt,date){const offset=Temporal.PlainDate.compare(dt.toPlainDate(),date),birth=offset===0?{...input.birth,time:dt.toPlainTime().toString({smallestUnit:'second'})}:{...input.birth,calendar:'solar',date:dt.toPlainDate().toString(),is_leap_month:false,time:dt.toPlainTime().toString({smallestUnit:'second'})};return {mode:'relationship',chart_mode:input.chart_mode,question:input.question,people:[{id:'a',...(input.label!==undefined?{label:input.label}:{}),birth,options:input.birth_options}],context:input.context,options:input.options,...(input.target_date!==undefined?{target_date:input.target_date}:{})};}
function facts(r){
 const c=r.people[0].chart,items=[];const add=(id,label,value,source_ids)=>items.push({id,label,value,source_ids});
 if(c.bazi){
  for(const p of c.bazi.chart.pillars)add(`TC-${p.id}`,`八字${p.label}`,p.ganzhi,[`a:${p.id}`]);
  add('TC-DAY-MASTER','日主',c.bazi.chart.day_master,['a:BZ-DAY']);add('TC-ELEMENT-COUNTS','五行本字计数',c.bazi.calculations.surface_element_counts,c.bazi.chart.pillars.map(p=>`a:${p.id}`));
  add('TC-QIYUN-DIRECTION','大运顺逆',c.bazi.chart.qiyun.direction,['bazi.chart.qiyun.direction']);add('TC-DAYUN-SEQUENCE','大运干支顺序',c.bazi.chart.dayun.map(d=>d.ganzhi),c.bazi.chart.dayun.map(d=>`a:${d.id}`));
  for(const y of c.bazi.chart.annual)add(`TC-${y.id}`,'逐年日支关系 '+y.lichun_cycle_year,{ganzhi:y.ganzhi,stem_ten_god:y.stem_ten_god,hidden_ten_gods:y.hidden_ten_gods,day_branch_relations:y.day_branch_relations.map(({id,natal_relation_ids,...r})=>r)},[`a:${y.id}`,...y.day_branch_relations.map(r=>`a:${r.id}`)]);
 }
 const age=r.age_relation.predictions[0];
 add('TC-AGE','对象年龄取象主结论',{tendency:age.tendency,basis:age.basis,status:age.status},['R-A-AGE']);
 add('TC-AGE-MODELS','八字柱位辅助年龄线索',age.models.map(m=>({model:m.model,position_tendency:m.position_tendency})),['R-A-AGE']);
 add('TC-AGE-ZW-RULES','紫微夫妻宫年龄规则',age.ziwei.matches.map(m=>({rule_id:m.rule_id,direction:m.direction,use:m.use})),['R-A-AGE']);
 if(c.ziwei){
  add('TC-ZW-SOUL','紫微命宫地支',c.ziwei.chart.soul_palace_branch,['ziwei.chart.soul_palace_branch']);add('TC-ZW-BODY','紫微身宫地支',c.ziwei.chart.body_palace_branch,['ziwei.chart.body_palace_branch']);add('TC-ZW-CLASS','紫微五行局',c.ziwei.chart.five_elements_class,['ziwei.chart.five_elements_class']);
  for(const name of ['命','夫妻','福德','迁移','官禄']){const p=c.ziwei.chart.palaces.find(p=>p.name.replace(/宫$/,'')===name);add(`TC-ZW-${name}`,`紫微${name}宫主星`,{branch:p.earthlyBranch,stars:p.majorStars.map(s=>({name:s.name,...(s.brightness!==undefined?{brightness:s.brightness}:{}),...(s.mutagen!==undefined?{mutagen:s.mutagen}:{})}))},[`a:${p.id}`]);}
  const spouse=c.ziwei.chart.palaces.find(p=>p.name.replace(/宫$/,'')==='夫妻'),fly=c.ziwei.calculations.palace_stem_flying.entries.filter(e=>e.origin_palace_id===spouse.id||e.target_palace_id===spouse.id);
  add('TC-ZW-SPOUSE-FLY','紫微夫妻宫宫干四化',fly.map(e=>({mutagen:e.mutagen,star:e.star,origin:e.origin_palace,target:e.target_palace,is_self_transform:e.is_self_transform})),fly.map(e=>`a:${e.id}`));
 }
 if(r.partner_images.length){const image=r.partner_images[0];add('TC-ZODIAC','本人生肖及属相缘分',image.zodiac,['R-A-ZODIAC']);}
 return items;
}
function compare(candidates){
 const valid=candidates.filter(c=>c.status==='calculated'),map=new Map();
 for(const c of valid)for(const f of facts(c.chart)){let entry=map.get(f.id);if(!entry){entry={id:f.id,label:f.label,groups:new Map(),evidence:[]};map.set(f.id,entry);}const key=digest(f.value),v=entry.groups.get(key)??{value:f.value,count:0,candidate_ids:[]};v.count++;v.candidate_ids.push(c.id);entry.groups.set(key,v);entry.evidence.push({candidate_id:c.id,source_ids:f.source_ids});}
 const fields=[...map.values()].map(f=>({id:f.id,label:f.label,status:valid.length===1?'single_candidate':f.groups.size===1?'stable':'varies',variants:[...f.groups.values()],evidence:f.evidence}));
 const imageTags={};
 if(valid.every(c=>c.chart.partner_images.length))for(const dimension of ['appearance','temperament','style']){
  const tags=new Map();for(const c of valid)for(const t of c.chart.partner_images[0].dimensions[dimension]){const item=tags.get(t.tag)??{tag:t.tag,candidate_ids:[]};item.candidate_ids.push(c.id);tags.set(t.tag,item);}
  imageTags[dimension]={common:valid.length>1?[...tags.values()].filter(t=>t.candidate_ids.length===valid.length):[],varying:[...tags.values()].filter(t=>valid.length===1||t.candidate_ids.length!==valid.length)};
 }
 const starts=valid.filter(c=>c.chart.people[0].chart.bazi).map(c=>({candidate_id:c.id,value:c.chart.people[0].chart.bazi.chart.qiyun.start_datetime_birth_timezone}));
 return {id:'TC-COMPARISON',valid_candidate_count:valid.length,failed_candidate_count:candidates.length-valid.length,agreement_scope:'computed_candidates',fields,stable_field_ids:fields.filter(f=>f.status==='stable').map(f=>f.id),variable_field_ids:fields.filter(f=>f.status==='varies').map(f=>f.id),image_tags:imageTags,qiyun_sampled_start_times:starts};
}
function build(raw){
 const p=prepare(raw),grid=generate(p);
 const candidates=grid.points.map(point=>{try{const chart=relationship.build(relationInput(p.input,Temporal.PlainDateTime.from(point.local_datetime),p.date));return {...point,status:'calculated',...(chart.people[0].chart.normalized.solar_time?{true_solar_datetime:chart.people[0].chart.normalized.solar_time.apparent_solar_datetime,bazi_day_hour_datetime:chart.people[0].chart.bazi?.chart.day_hour_calculation_datetime}:{}),...(chart.people[0].chart.bazi?{time_boundary_review:{solar:chart.people[0].chart.normalized.solar_time?{within_review_band:chart.people[0].chart.normalized.solar_time.within_60_second_review_band,distance_seconds:chart.people[0].chart.normalized.solar_time.distance_to_day_or_shichen_boundary_seconds}:null,jieqi:chart.people[0].chart.bazi.chart.jieqi_boundary_review}}:{}),chart};}catch(e){if(!(e instanceof InputError))throw e;return {...point,status:'unavailable',error:e.message};}});
 check(candidates.some(c=>c.status==='calculated'),'没有可计算的候选时间；请核对日期、时区、UTC 偏移及目标日期');
 const comparison=compare(candidates),result={schema_version:SCHEMA,engine_version:VERSION,input:p.input,normalized:{solar_date:p.date.toString(),timezone:p.timezone},coverage:{type:p.input.time_uncertainty.type,method:'structural-boundaries-first-middle-last/v1',interval_count:grid.intervals.length,sample_count:candidates.length,has_unavailable_candidates:comparison.failed_candidate_count>0,selected_best_candidate:null,scope:'候选点逐一计算；一致项指已成功计算的候选点。精确起运时刻逐点保存，未对连续分钟取值作恒定判断。'},boundaries:grid.boundaries,intervals:grid.intervals,candidates,comparison,provenance:{relationship_engine:'relationship/0.6.0',boundaries:['local calendar day','shichen including separate early/late zi','lunar-typescript JieQi seconds converted from Beijing to input timezone','Temporal timezone transitions',...(p.input.birth_options.time_basis==='true_solar'?['inverse-mapped apparent-solar day and shichen boundaries to civil seconds']:[])],...(p.input.birth_options.time_basis==='true_solar'?{solar_time_method:require('./solar-time.cjs').METHOD}:{}),candidate_weights:null}};
 result.checksum={algorithm:'sha256-canonical-json',value:digest(result)};return result;
}
function validateArtifact(data){
 check(data?.schema_version===SCHEMA&&data.engine_version===VERSION,'不支持的时辰对照格式');const {checksum,...payload}=data;
 check(checksum?.algorithm==='sha256-canonical-json'&&checksum.value===digest(payload),'时辰对照校验和不匹配');
 check(Array.isArray(data.candidates),'缺少候选盘');for(const c of data.candidates)if(c.status==='calculated')relationship.validateArtifact(c.chart,{recalculate:false});
 const {checksum:unused,...fresh}=build(data.input);check(digest(payload)===digest(fresh),'时辰对照与当前程序重算不一致');return checksum.value;
}
function summary(data){const {qiyun_sampled_start_times,...comparison}=data.comparison;const out=structuredClone({schema_version:'bazi-ziwei-time-summary/v1',parent_checksum:data.checksum.value,input:data.input,normalized:data.normalized,coverage:data.coverage,intervals:data.intervals,candidates:data.candidates.map(({chart,...c})=>c),comparison:{...comparison,fields:comparison.fields.map(({evidence,...f})=>f)},qiyun_sampled_start_times});out.checksum={algorithm:'sha256-canonical-json',value:digest(out)};return out;}
function validateSummary(data,parent){check(data?.schema_version==='bazi-ziwei-time-summary/v1','不支持的时辰摘要格式');const {checksum,...payload}=data;check(checksum?.value===digest(payload)&&checksum.algorithm==='sha256-canonical-json','时辰摘要校验和不匹配');check(digest(data)===digest(summary(parent)),'时辰摘要与完整对照数据不一致');return checksum.value;}
module.exports={build,validateArtifact,summary,validateSummary,generate,prepare,facts};
