'use strict';
// Opt-in deterministic extension. Never mutate or re-interpret saved calendar artifacts.
const {LunarUtil}=require('lunar-typescript');
const {normalize,asSolar,Temporal,check}=require('./common.cjs');
const {makePillars,pillar}=require('./bazi-chart.cjs');
const timing=require('./dayun-timing.cjs');
const rules=require('../references/bazi-detail-rules.json');
const STEMS='甲乙丙丁戊己庚辛壬癸',BRANCHES='子丑寅卯辰巳午未申酉戌亥',MONTHS='寅卯辰巳午未申酉戌亥子丑';
const STAGES=['长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'];
const START={甲:'亥',乙:'午',丙:'寅',丁:'酉',戊:'寅',己:'酉',庚:'巳',辛:'子',壬:'申',癸:'卯'};
const mod=(n,m)=>(n%m+m)%m;
function stage(stem,branch){
 check(STEMS.includes(stem)&&stem.length===1&&BRANCHES.includes(branch)&&branch.length===1,'十二长生需要有效单一天干、地支');
 return STAGES[mod((BRANCHES.indexOf(branch)-BRANCHES.indexOf(START[stem]))*(STEMS.indexOf(stem)%2===0?1:-1),12)];
}
function selected(data,options={}){
 if(data.input.mode==='time_compare'){
  check(options.candidate,'未知时辰细盘须指定 --candidate；不默认补时辰');
  const c=data.candidates.find(c=>c.id===options.candidate);check(c?.status==='calculated','时辰候选不存在或不可计算');
  return {chart:c.chart.people[0].chart,coverage:{kind:'single_time_candidate',candidate_id:c.id,scope:data.coverage.scope}};
 }
 const rows=require('./ten-god-evidence.cjs').samples(data,options.person);check(rows.length===1,'细盘需要明确的单人来源');
 return {chart:rows[0].chart,coverage:{kind:'known_birth_time',...(data.input.mode==='relationship'?{person_id:rows[0].id}:{})}};
}
function grouped(table,value){return Object.entries(table).find(([keys])=>keys.includes(value))?.[1]??'';}
function stars(p,natal){
 const hits=[];
 for(const rule of rules.shensha){
  const references=[];
  for(const anchor of rule.anchors){
   const a=natal.find(x=>x.id==='BZ-'+anchor.toUpperCase()),value=a[rule.reference];
   const targets=rule.table?.[value]??grouped(rule.groups??{},value);
   const field=rule.mixed_target?(STEMS.includes(targets)?'stem':'branch'):(rule.target_field??'branch');
   const roles=rule.roles?Object.entries(rule.roles).filter(([,table])=>grouped(table,value).includes(p.stem)).map(([role])=>role):[];
   if(rule.roles?roles.length:targets.includes(p[field]))references.push({source_id:a.id,field:rule.reference,value,target_field:field,...(rule.roles?{roles}:{}),basis:anchor==='year'?'year_supplement':anchor==='day'?'day_primary':'month'});
  }
  if(references.length)hits.push({rule_id:rule.id,name:rule.name,source:rule.source,references});
 }
 return hits;
}
function row(p,b){
 const base=p.stem?{...p}:pillar(p.id,p.label,p.ganzhi,b.day_master);
 const own=LunarUtil.getXunKong(base.ganzhi),dayEmpty=LunarUtil.getXunKong(b.pillars[2].ganzhi),yearEmpty=LunarUtil.getXunKong(b.pillars[0].ganzhi);
 return {id:base.id,label:base.label,ganzhi:base.ganzhi,stem_ten_god:base.stem_ten_god,hidden_stems:base.hidden_stems,hidden_ten_gods:base.hidden_ten_gods,nayin:LunarUtil.NAYIN[base.ganzhi],
  star_fortune:stage(b.day_master,base.branch),self_seat:stage(base.stem,base.branch),xun:LunarUtil.getXun(base.ganzhi),xun_kong:own,
  void_by_natal:{day:dayEmpty.includes(base.branch),year:yearEmpty.includes(base.branch)},shensha:stars(base,b.pillars)};
}
function auxiliary(b){
 const [year,month,day,hour]=b.pillars;
 const stemFor=offset=>STEMS[mod(2*(STEMS.indexOf(year.stem)+1)+offset-1,10)];
 const m=MONTHS.indexOf(month.branch)+1,t=MONTHS.indexOf(hour.branch)+1,sum=m+t,ming=(sum>=14?26:14)-sum;
 const shen=mod(m+BRANCHES.indexOf(hour.branch),12)+1;
 const info=(id,ganzhi,source_ids,method)=>({id,ganzhi,nayin:LunarUtil.NAYIN[ganzhi],source_ids,method});
 return {scope:'bazi_auxiliary_not_ziwei_palaces',
  tai_yuan:info('BZ-TAIYUAN',STEMS[mod(STEMS.indexOf(month.stem)+1,10)]+BRANCHES[mod(BRANCHES.indexOf(month.branch)+3,12)],['BZ-MONTH'],'月干进一、月支进三'),
  tai_xi:info('BZ-TAIXI',LunarUtil.HE_GAN_5[STEMS.indexOf(day.stem)]+LunarUtil.HE_ZHI_6[BRANCHES.indexOf(day.branch)],['BZ-DAY'],'日干五合、日支六合'),
  ming_gong:info('BZ-MINGGONG',stemFor(ming)+MONTHS[ming-1],['BZ-YEAR','BZ-MONTH','BZ-HOUR'],'lunar-typescript命宫算法；使用本盘实际年干、月支、时支'),
  shen_gong:info('BZ-SHENGONG',stemFor(shen)+MONTHS[shen-1],['BZ-YEAR','BZ-MONTH','BZ-HOUR'],'lunar-typescript身宫算法；使用本盘实际年干、月支、时支')};
}
function afterJie(instant){
 const z=Temporal.Instant.from(instant).toZonedDateTimeISO('+08:00'),jie=asSolar(z.toPlainDateTime()).getLunar().getPrevJie(false);
 const start=Temporal.PlainDateTime.from(jie.getSolar().toYmdHms().replace(' ','T')).toZonedDateTime('+08:00').toInstant(),seconds=z.toInstant().since(start).total('seconds');
 return {name:jie.getName(),jie_instant:start.toString(),elapsed_seconds:seconds,elapsed_days:seconds/86400,method:'实际交运瞬间相对上一节；不把节后天数取整当交运时刻'};
}
function commander(ctx,b){
 const lunar=asSolar(ctx.beijing).getLunar(),prev=lunar.getPrevJie(false),next=lunar.getNextJie(false);
 const instant=s=>Temporal.PlainDateTime.from(s.toYmdHms().replace(' ','T')).toZonedDateTime('+08:00').toInstant();
 const start=instant(prev.getSolar()),end=instant(next.getSolar()),born=ctx.zoned.toInstant(),elapsed=born.since(start).total('seconds');
 check(elapsed>=0&&Temporal.Instant.compare(born,end)<0,'入节区间与出生瞬间不一致');
 const phases=rules.month_command.table[b.pillars[1].branch];let cursor=0;
 const schedule=phases.map(([stem,days],i)=>{
  const a=start.add({seconds:cursor*86400});cursor+=days;const z=i===phases.length-1?end:start.add({seconds:cursor*86400});
  return {stem,table_days:days,start_instant:a.toString(),end_instant_exclusive:z.toString(),active:Temporal.Instant.compare(born,a)>=0&&Temporal.Instant.compare(born,z)<0};
 });
 const active=schedule.find(x=>x.active);check(active,'司令分段未覆盖出生瞬间');
 return {rule_id:rules.month_command.rule_id,source:'sanming2',month_branch:b.pillars[1].branch,stem:active.stem,ten_god:require('./bazi-rules.cjs').tenGod(b.day_master,active.stem),
  previous_jie:{name:prev.getName(),instant:start.toString()},next_jie:{name:next.getName(),instant:end.toString()},elapsed_seconds:elapsed,elapsed_days:elapsed/86400,schedule,
  distinct_from_month_main_qi:true,convention:rules.month_command.implementation};
}
function smallYun(year,b,ctx){
 const age=year-ctx.local.year+1;
 if(age<1)return {status:'before_birth_calendar_year',calendar_year:year};
 const forward=b.qiyun.direction==='forward',index=LunarUtil.getJiaZiIndex(b.pillars[3].ganzhi),gz=LunarUtil.JIA_ZI[mod(index+(forward?age:-age),60)];
 return {status:'computed',calendar_year:year,nominal_age:age,direction:b.qiyun.direction,year_boundary:'gregorian_january_1',...row(pillar('BZ-XY-'+year,'小运',gz,b.day_master),b)};
}
function prepare(data,options={}){
 const {chart,coverage}=selected(data,options);check(chart.bazi,'本来源没有八字，不能生成八字细盘');
 const b=chart.bazi.chart,ctx=normalize(chart.input),fresh=makePillars(ctx).pillars;
 check(fresh.every((p,i)=>p.ganzhi===b.pillars[i].ganzhi),'细盘来源与现行四柱不一致，请先重算核验');
 return {chart,b,ctx,coverage};
}
function periods(prepared,options={}){
 const {b,ctx}=prepared,years=options.years;
 const annual=b.annual.filter(y=>!years||y.lichun_cycle_year>=years[0]&&y.lichun_cycle_year<=years[1]);
 const dayun=years?timing.annualWindows(b,annual.map(y=>y.lichun_cycle_year)):timing.windows(b);
 return [...dayun.map(w=>({scope:'dayun',...row({...w.period,label:'大运'},b),index:w.period.index,start_year:w.period.start_year,end_year:w.period.end_year,start_nominal_age:w.period.start_nominal_age,end_nominal_age:w.period.end_nominal_age,...timing.boundaries(w),handover_after_jie:afterJie(w.start.toInstant().toString())})),
  ...annual.map(p=>({scope:'annual',...row({...p,label:'流年'},b),lichun_cycle_year:p.lichun_cycle_year,year_boundary:'lichun_instant'})),
  ...annual.filter(y=>y.lichun_cycle_year>=ctx.local.year).map(y=>({scope:'xiaoyun',...smallYun(y.lichun_cycle_year,b,ctx)}))];
}
function describe(data,options={}){
 const p=prepare(data,options),{chart,b,ctx,coverage}=p,current=timing.active(b),target=b.target;
 return {schema_version:'suanming-bazi-detail/v1',rule_version:rules.version,coverage,day_master:b.day_master,
  conventions:{star_fortune:'本命日干查各列地支；阳顺阴逆、土随火',self_seat:'每一列自己的天干查该列地支；不是本命日干',xun_kong:'各列自身干支所在旬的旬空；void_by_natal另标其支是否落入本命日/年旬空',shensha:rules.shensha_conventions,
   year_month:b.conventions.year_month,day_hour:b.conventions.day_hour,day_boundary:b.conventions.day_boundary,hour_stem_rule:b.conventions.hour_stem_rule,
   xiaoyun:'以本盘采用时柱为起点，按原起运顺逆；出生公历年一岁，岁数每公历年进一，不与立春流年周期或紫微小限混同'},
  natal:b.pillars.map(p=>row(p,b)),auxiliary:auxiliary(b),month_commander:commander(ctx,b),qiyun:{...b.qiyun,start_after_jie:afterJie(Temporal.ZonedDateTime.from(b.qiyun.start_datetime_beijing).toInstant().toString())},
  at_target:{date:target?.local_date??null,dayun_status:current.status,current_dayun:current.window?{...row({...current.window.period,label:'当前大运'},b),...timing.boundaries(current.window),handover_after_jie:afterJie(current.window.start.toInstant().toString())}:null,
   year:target?row(pillar('BZ-TARGET-YEAR','目标流年',target.year_ganzhi,b.day_master),b):null,month:target?row(pillar('BZ-TARGET-MONTH','目标流月',target.month_ganzhi,b.day_master),b):null,
   small_yun:target?smallYun(Temporal.PlainDate.from(target.local_date).year,b,ctx):null,
   nominal_age:target?Temporal.PlainDate.from(target.local_date).year-ctx.local.year+1:null},
  supported_shensha:rules.shensha.map(r=>({id:r.id,name:r.name,source:r.source})),sources:rules.sources};
}
function project(data,options){
 check(!options.years||options.years[1]-options.years[0]<=300,'细盘年份范围过大');
 const detail=options.page==='bazi-detail',prepared=detail?null:prepare(data,options),items=detail?null:periods(prepared,options),offset=options.offset??0,limit=options.limit??3;
 if(!detail)check(offset===0||offset<items.length,'细盘岁运页偏移超出范围');
 const computed=detail?[]:prepared.b.annual.map(x=>x.lichun_cycle_year),missing=options.years?Array.from({length:options.years[1]-options.years[0]+1},(_,i)=>options.years[0]+i).filter(y=>!computed.includes(y)):[];
 const reading=detail?{bazi_detail:describe(data,options)}:{bazi_periods:{rule_version:rules.version,total:items.length,offset,limit,next_offset:offset+limit<items.length?offset+limit:null,items:items.slice(offset,offset+limit),requested_years:options.years??null,computed_annual_years:computed,requested_range_computed:missing.length===0,missing_annual_years:missing,coverage:prepared.coverage}};
 return {schema_version:'suanming-context/v1',view:'evidence_page',view_schema:'suanming-bazi-detail-context/v1',focus:options.focus,source_schema:data.schema_version,source_checksum:data.checksum.value,
  selection:{page:options.page,offset,limit,person:options.person??null,candidate:options.candidate??null,years:options.years??null,base_checksum:options.base_checksum},reading,
  base_context:{required:true,source_checksum:data.checksum.value,focus:options.focus,person:options.person??null,note:'程序细盘补充页；按同来源校验和与基础context合用，未计算神煞不补造。'},available:{continuation_only:true}};
}
function render(data,options){
 const d=describe(data,options),p=periods(prepare(data,options));
 const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const md=v=>String(v??'').replace(/\|/g,'\\|').replace(/\r?\n/g,' '),sections=[];
 const table=(title,headers,rows)=>sections.push({title,headers,rows});
 const headers=['柱位','干支','显干十神','藏干十神','星运（日干）','自坐（本列干）','旬空（本列）','纳音','神煞查表标记'];
 const cells=x=>[x.label,x.ganzhi,x.stem_ten_god,x.hidden_stems.map((s,i)=>s+'('+x.hidden_ten_gods[i]+')').join('、'),x.star_fortune,x.self_seat,x.xun_kong,x.nayin,x.shensha.map(s=>s.name+'['+s.references.map(r=>r.source_id+(r.roles?'：'+r.roles.join('/'):'')).join('、')+']').join('；')||'本规则未命中'];
 table('本命四柱专业细盘',headers,d.natal.map(cells));
 table('目标日期',headers,[d.at_target.year,d.at_target.current_dayun,d.at_target.month,d.at_target.small_yun?.status==='computed'?d.at_target.small_yun:null].filter(Boolean).map(cells));
 table('胎命身（八字）',['项目','干支','纳音','依据'],Object.entries(d.auxiliary).filter(([k])=>k!=='scope').map(([k,v])=>[({tai_yuan:'胎元',tai_xi:'胎息',ming_gong:'命宫',shen_gong:'身宫'})[k],v.ganzhi,v.nayin,v.method]));
 table('人元分日司令',['节月','采用司令','十神','入节','距入节天数','规则'],[[d.month_commander.month_branch,d.month_commander.stem,d.month_commander.ten_god,d.month_commander.previous_jie.instant,d.month_commander.elapsed_days.toFixed(6),d.month_commander.rule_id]]);
 table('起运与交运',['项目','结果'],[['起运方向',d.qiyun.direction==='forward'?'顺排':'逆排'],['起运偏移',Object.entries(d.qiyun.offset).map(([k,v])=>v+({years:'年',months:'月',days:'天',hours:'小时'})[k]).join('')],['起运时间',d.qiyun.start_datetime_birth_timezone],['起运相对节气',d.qiyun.start_after_jie.name+'后'+d.qiyun.start_after_jie.elapsed_days.toFixed(6)+'天'],['目标日期虚岁',d.at_target.nominal_age??'未指定目标日期']]);
 table('大运、流年与小运明细',[...headers,'年份／交运区间'],p.filter(x=>x.status!=='before_birth_calendar_year').map(x=>[...cells(x),x.scope==='dayun'?x.start_datetime+' → '+x.end_datetime_exclusive:x.lichun_cycle_year??x.calendar_year]));
 table('口径',['项目','说明'],Object.entries(d.conventions));
 table('来源',['编号','文献／接口','链接'],Object.entries(d.sources).map(([id,s])=>[id,s.title,s.url]));
 const text=sections.map(s=>'## '+s.title+'\n\n| '+s.headers.map(md).join(' | ')+' |\n| '+s.headers.map(()=>'---').join(' | ')+' |\n'+s.rows.map(r=>'| '+r.map(md).join(' | ')+' |').join('\n')+'\n').join('\n');
 const note='来源校验和：'+data.checksum.value+'；规则：'+rules.version+'。神煞为查表标记，不等于成格；司令按《三命通会》原表，与月令本气、藏干分开。';
 return {markdown:'# 八字专业细盘\n\n'+note+'\n\n'+text,
  html:'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>八字专业细盘</title><style>body{font:16px/1.6 system-ui;margin:24px}section{overflow:auto;margin:24px 0}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px;white-space:nowrap}</style><h1>八字专业细盘</h1><p>'+esc(note)+'</p>'+sections.map(s=>'<section><h2>'+esc(s.title)+'</h2><table><thead><tr>'+s.headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+s.rows.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></section>').join('')+'</html>'};
}
module.exports={stage,stars,row,auxiliary,commander,smallYun,prepare,periods,describe,project,render};
