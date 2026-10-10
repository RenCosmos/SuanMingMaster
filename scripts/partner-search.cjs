'use strict';
// An additive search layer. All calendar calculations use the unchanged shipped engine.
const {Solar,LunarUtil}=require('lunar-typescript');
const {Temporal,check,digest,InputError,normalize}=require('./common.cjs');
const engine=require('./engine.cjs'),relationship=require('./relationship.cjs');
const {relations,tenGod,calculate}=require('./bazi-rules.cjs');
const {periodRelations}=require('./bazi-period-relations.cjs');
const gridEngine=require('./time-compare.cjs');
const {makePillars}=require('./bazi-chart.cjs');
const RULES=require('../references/partner-search-rules.json');
const IMAGE=require('../references/partner-image-rules.json');
const WEIGHTS=require('../references/bazi-rules.json');
const SCHEMA='suanming-partner-search/v1',VERSION='partner-search/1.0.1';
const GAN='甲乙丙丁戊己庚辛壬癸',ZHI='子丑寅卯辰巳午未申酉戌亥',IDS=['BZ-YEAR','BZ-MONTH','BZ-DAY','BZ-HOUR'];
const compareDate=Temporal.PlainDate.compare;
function fields(o,allowed,label){check(o&&typeof o==='object'&&!Array.isArray(o),label+' 必须是对象');for(const k of Object.keys(o))check(allowed.includes(k),label+' 不支持字段 '+k);}
function date(v,label){check(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v),label+' 须为 YYYY-MM-DD');try{return Temporal.PlainDate.from(v,{overflow:'reject'});}catch{throw new InputError(label+' 日期不存在');}}
function integerPair(v,min,max,label){check(Array.isArray(v)&&v.length===2&&v.every(n=>Number.isInteger(n)&&n>=min&&n<=max)&&v[0]<=v[1],label+' 范围无效');return [...v];}
function strings(v,allowed,label){check(Array.isArray(v)&&v.length>0&&new Set(v).size===v.length&&v.every(s=>allowed.includes(s)),label+' 须为不重复的支持值');return [...v];}
function manualPillars(values){
 check(Array.isArray(values)&&values.length===4,'self.pillars 须按年月日时提供四个干支');
 for(const value of values)check(typeof value==='string'&&value.length===2&&GAN.includes(value[0])&&ZHI.includes(value[1])&&GAN.indexOf(value[0])%2===ZHI.indexOf(value[1])%2,'四柱含无效干支');
 const month=(ZHI.indexOf(values[1][1])-2+12)%12;
 check(GAN[(GAN.indexOf(values[0][0])%5*2+2+month)%10]===values[1][0],'四柱月干不符合五虎遁；请核对原盘');
 check(GAN[(GAN.indexOf(values[2][0])%5*2+ZHI.indexOf(values[3][1]))%10]===values[3][0],'四柱时干不符合日干五鼠遁；库口径或边界不明时请提供原始生辰');
 return values.map((ganzhi,i)=>({id:IDS[i],ganzhi,stem:ganzhi[0],branch:ganzhi[1],branch_element:LunarUtil.WU_XING_ZHI[ganzhi[1]],hidden_stems:[...LunarUtil.ZHI_HIDE_GAN[ganzhi[1]]]}));
}
function normalizeInput(raw){
 fields(raw,['mode','label','question','self','as_of','search','filters','partner_star_model'],'候选筛选输入');check(raw.mode==='partner_search','mode 须为 partner_search');
 if(raw.label!==undefined)check(typeof raw.label==='string'&&raw.label.length<=80&&!/[\x00-\x1f]/.test(raw.label),'label 最长80字且不能含控制字符');
 if(raw.question!==undefined)check(typeof raw.question==='string'&&raw.question.length<=1000&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(raw.question),'question 格式无效');
 const asOf=date(raw.as_of,'as_of');check(asOf.year>=1900&&asOf.year<=2200,'as_of 须在1900–2200年');
 fields(raw.self,['birth','options','chart_mode','pillars','birth_year'],'self');check(Boolean(raw.self.birth)!==Boolean(raw.self.pillars),'self 只提供 birth 或 pillars 之一');
 let self,birthYear;
 if(raw.self.birth){
  check(raw.self.birth_year===undefined,'birth 输入不另填 birth_year');const chartMode=raw.self.chart_mode??'bazi';check(['bazi','both'].includes(chartMode),'self.chart_mode 须为 bazi / both');
  const n=normalize({mode:chartMode,birth:raw.self.birth,options:raw.self.options});birthYear=n.local.year;
  self={birth:n.input.birth,options:n.input.options,chart_mode:chartMode};
 }else{
  check(raw.self.options===undefined&&raw.self.chart_mode===undefined,'四柱输入不接受生辰算法选项；不支持由四柱伪造紫微盘');
  manualPillars(raw.self.pillars);birthYear=raw.self.birth_year;check(Number.isInteger(birthYear)&&birthYear>=1900&&birthYear<=2100,'四柱输入须提供1900–2100的公历出生年以定位周期');
  const expected=y=>Solar.fromYmd(y,6,15).getLunar().getYearInGanZhiExact();
  check([expected(birthYear),expected(birthYear-1)].includes(raw.self.pillars[0]),'birth_year 与年柱不符；年初可属于前一立春周期');
  self={pillars:[...raw.self.pillars],birth_year:birthYear};
 }
 const model=raw.partner_star_model??'all';check(['all','wealth','authority'].includes(model),'partner_star_model 须为 all / wealth / authority，不从性别推断现实伴侣');
 fields(raw.search,['type','year_range','start','end','timezone','longitude','longitude_source','time_uncertainty','options','people'],'search');const type=raw.search.type;check(['years','dates','people'].includes(type),'search.type 须为 years / dates / people');
 let search;
 if(type==='years'){
  fields(raw.search,['type','year_range','timezone'],'search years');const range=integerPair(raw.search.year_range??[Math.max(1900,birthYear-12),Math.min(2100,birthYear+12)],1900,2100,'year_range');check(range[1]-range[0]<=60,'一次年份搜索最多61个年柱周期');
  const timezone=raw.search.timezone??self.birth?.timezone??'Asia/Shanghai';asOf.toZonedDateTime(timezone);search={type,year_range:range,timezone};
 }else if(type==='dates'){
  fields(raw.search,['type','start','end','timezone','longitude','longitude_source','time_uncertainty','options'],'search dates');const start=date(raw.search.start,'search.start'),end=date(raw.search.end,'search.end');
  check(start.year>=1900&&end.year<=2100&&compareDate(start,end)<=0&&start.until(end).days<=30,'日期搜索须在1900–2100内且一次最多31天；较大范围拆分新任务');
  const timezone=raw.search.timezone??self.birth?.timezone??'Asia/Shanghai';const location=Object.fromEntries(['longitude','longitude_source'].filter(k=>raw.search[k]!==undefined).map(k=>[k,raw.search[k]]));
  const prepared=gridEngine.prepare({mode:'time_compare',chart_mode:'bazi',birth:{calendar:'solar',date:start.toString(),gender:'male',timezone,...location},birth_options:raw.search.options,time_uncertainty:raw.search.time_uncertainty??{type:'unknown'}});
  check(prepared.input.time_uncertainty.type!=='range'||prepared.input.time_uncertainty.end_day_offset===0,'候选日期范围逐日计算，不接受跨日时间范围');
  search={type,start:start.toString(),end:end.toString(),timezone,...location,time_uncertainty:prepared.input.time_uncertainty,options:prepared.input.birth_options};
 }else{
  fields(raw.search,['type','people'],'search people');check(Array.isArray(raw.search.people)&&raw.search.people.length>=1&&raw.search.people.length<=20,'候选people须为1–20人');
  const people=raw.search.people.map(p=>{fields(p,['id','birth','options'],'候选人物');check(typeof p.id==='string'&&/^[A-Za-z0-9-]{1,32}$/.test(p.id),'候选人物id须为1–32位匿名字母数字连字符');const n=normalize({mode:'bazi',birth:p.birth,options:p.options});return {id:p.id,birth:n.input.birth,options:n.input.options};});
  check(new Set(people.map(p=>p.id)).size===people.length,'候选人物id不能重复');search={type,people};
 }
 const f=raw.filters??{};fields(f,['conditions','match','exclude_relations','preferred_elements','year_gap'],'filters');
 const conditions=strings(f.conditions??RULES.default_conditions,Object.keys(RULES.conditions),'conditions');
 const match=f.match??'any';check(['all','any'].includes(match),'filters.match 须为 all / any');
 const exclude=f.exclude_relations??[];check(Array.isArray(exclude)&&new Set(exclude).size===exclude.length&&exclude.every(t=>RULES.risk_types.includes(t)),'exclude_relations 含无效关系');
 const preferred=f.preferred_elements??[];check(Array.isArray(preferred)&&new Set(preferred).size===preferred.length&&preferred.every(e=>['木','火','土','金','水'].includes(e)),'preferred_elements 须为不重复五行');
 check(!conditions.includes('element_supply')||preferred.length>0&&type!=='years','element_supply 需明确preferred_elements且有候选四柱，不凭年份假定完整五行');
 return {mode:'partner_search',...(raw.label!==undefined?{label:raw.label}:{}),...(raw.question!==undefined?{question:raw.question}:{}),self,as_of:asOf.toString(),search,partner_star_model:model,
  filters:{conditions,match,exclude_relations:[...exclude],preferred_elements:[...preferred],year_gap:integerPair(f.year_gap??[-12,12],-100,100,'year_gap')}};
}
function selfFacts(input){
 if(input.self.pillars){const pillars=manualPillars(input.self.pillars);return {source_kind:'user_supplied_pillars',calendar_verified:false,birth_year:input.self.birth_year,birth_date:null,pillars,calculations:calculate(pillars,pillars[2].stem,WEIGHTS),age_cue:null,warnings:['用户所报四柱已做干支、五虎遁和五鼠遁结构检查，未反查为真实出生日期；出生年为用户提供。']};}
 const d=relationship.build({mode:'relationship',chart_mode:input.self.chart_mode,question:'候选筛选本人结构',people:[{id:'a',birth:input.self.birth,options:input.self.options}],context:{topics:['age_relation']},options:{partner_star_model:input.partner_star_model}}),c=d.people[0].chart;
 return {source_kind:'computed_birth',calendar_verified:true,birth_year:Number(c.normalized.solar_date.slice(0,4)),birth_date:c.normalized.solar_date,pillars:c.bazi.chart.pillars,calculations:c.bazi.calculations,age_cue:d.age_relation.predictions[0],warnings:c.warnings};
}
function compactPillar(p){return {id:p.id,ganzhi:p.ganzhi,stem:p.stem,branch:p.branch};}
function branchAffinity(a,b){if(a===b)return null;const group=IMAGE.sanhe.find(g=>g.includes(a)&&g.includes(b));return IMAGE.liuhe.some(g=>g.includes(a)&&g.includes(b))?'六合':group?'同组三合候选':null;}
function assessment(self,pillars,input,partial){
 const ownDay=self.pillars[2],ownYear=self.pillars[0],anchor=partial?pillars[0]:pillars[2],candidateYear=pillars[0];
 const anchorRelations=relations([{...ownDay,id:'SELF-DAY'},{...anchor,id:'CANDIDATE-ANCHOR'}]);
 const projection=tenGod(ownDay.stem,anchor.stem),inverse=tenGod(anchor.stem,ownDay.stem);
 const role=input.partner_star_model==='wealth'?['正财','偏财']:input.partner_star_model==='authority'?['正官','七杀']:['正财','偏财','正官','七杀'];
 const values={zodiac_affinity:branchAffinity(ownYear.branch,candidateYear.branch)!==null,spouse_branch_liuhe:anchorRelations.some(r=>r.type==='地支六合'),day_stem_five_combine:anchorRelations.some(r=>r.type==='天干五合'),partner_star_projection:role.includes(projection),element_supply:false};
 const all=partial?periodRelations(self.pillars,{...anchor,id:'CANDIDATE-YEAR'}).map(r=>({...r,...(r.group_state==='completed_with_period'?{group_state:'completed_with_candidate'}:{})})):relations([...self.pillars.map(p=>({...p,id:'SELF-'+p.id})),...pillars.map(p=>({...p,id:'CANDIDATE-'+p.id}))]).filter(r=>r.pillars.some(id=>id.startsWith('SELF-'))&&r.pillars.some(id=>id.startsWith('CANDIDATE-')));
 if(!partial){const elements=new Set(pillars.flatMap(p=>[LunarUtil.WU_XING_GAN[p.stem],LunarUtil.WU_XING_ZHI[p.branch],...(p.hidden_stems??[]).map(s=>LunarUtil.WU_XING_GAN[s])]));values.element_supply=input.filters.preferred_elements.every(e=>elements.has(e));}
 const matched=input.filters.conditions.filter(c=>values[c]),unmatched=input.filters.conditions.filter(c=>!values[c]);
 const excluded=input.filters.exclude_relations.filter(type=>all.some(r=>r.type===type));
 return {passes_conditions:input.filters.match==='all'?unmatched.length===0:matched.length>0,excluded_by_relations:excluded,matched_conditions:matched,unmatched_conditions:unmatched,matched_condition_count:matched.length,
  candidate_anchor:partial?'year_pillar_only':'day_pillar',zodiac_relation:branchAffinity(ownYear.branch,candidateYear.branch),self_to_candidate_anchor_ten_god:projection,candidate_anchor_to_self_ten_god:inverse,
  anchor_relations:anchorRelations,structural_relations:all,risk_relations:all.filter(r=>RULES.risk_types.includes(r.type)),
  condition_references:input.filters.conditions.map(id=>({id,label:RULES.conditions[id].label,matched:values[id],source_ids:RULES.conditions[id].sources,evidence_kind:'project_condition_on_calculated_structure'})),
  missing_evidence:partial?['候选月柱、日柱、时柱未知；年干投影不是对方日主投影，年支不是对方夫妻宫。']:[],probability:null,confirmed_partner:false};
}
function lichun(year){const s=Solar.fromYmd(year,6,15).getLunar().getJieQiTable()['立春'];check(s.getYear()===year,'立春周期年份不符');return Temporal.ZonedDateTime.from({year:s.getYear(),month:s.getMonth(),day:s.getDay(),hour:s.getHour(),minute:s.getMinute(),second:s.getSecond(),timeZone:'+08:00'});}
function ageAlignment(self,start,end){
 const cue=self.age_cue?.tendency;if(!cue||['none','mixed'].includes(cue)||!self.birth_date)return 'unavailable_or_mixed';
 const birth=date(self.birth_date,'self.birth_date'),a=date(start.slice(0,10),'interval.start'),b=date(end.slice(0,10),'interval.end');
 const direction=compareDate(b,birth)<0?'older':compareDate(a,birth)>0?'younger':'overlapping_birth_date';
 return {cue,direction,alignment:direction==='overlapping_birth_date'?'uncertain':cue==='peer'?'not_quantified':direction===cue?'aligns':'differs',use:'auxiliary_display_only_not_filter_or_probability'};
}
function createScan(raw,resume){
 engine.dependencyVersions();
 const input=normalizeInput(raw),self=resume?.self??selfFacts(input),results=resume?.results??[],unavailable=resume?.unavailable??[];
 if(resume)check(digest(resume.input)===digest(input),'扫描检查点输入不一致');
 let examined=resume?.examined??0,underage=0,outsideGap=resume?.outsideGap??0,failedConditions=resume?.failedConditions??0,excludedRelations=resume?.excludedRelations??0;
 let nextDate=resume?.nextDate??input.search.start;
 const evaluations=new Map();
 function consider(item,pillars,partial,start,end=start){
  examined++;const gap=item.birth_year_label-self.birth_year;if(gap<input.filters.year_gap[0]||gap>input.filters.year_gap[1]){outsideGap++;return;}
  const key=pillars.map(p=>p.ganzhi).join('|')+(partial?'|year':'|full');
  let evaluation=evaluations.get(key);if(!evaluation){evaluation=assessment(self,pillars,input,partial);evaluations.set(key,evaluation);}
  if(!evaluation.passes_conditions){failedConditions++;return;}if(evaluation.excluded_by_relations.length){excludedRelations++;return;}
  results.push({...item,year_label_gap:gap,pillars:pillars.map(compactPillar),full_bazi:partial?null:pillars.map(p=>p.ganzhi),animal:IMAGE.animals[pillars[0].branch],age_cue_alignment:ageAlignment(self,start,end),evaluation});
 }
 if(input.search.type==='years'){
  for(let y=input.search.year_range[0];y<=input.search.year_range[1];y++){
   const start=lichun(y).withTimeZone(input.search.timezone),end=lichun(y+1).withTimeZone(input.search.timezone),eligibleEnd=end;
   const ganzhi=Solar.fromYmd(y,6,15).getLunar().getYearInGanZhiExact(),p={id:'CANDIDATE-YEAR',ganzhi,stem:ganzhi[0],branch:ganzhi[1]};
   const inclusiveEnd=eligibleEnd.subtract({seconds:1});
   consider({id:'PSY-'+y,kind:'year_cycle',birth_year_label:y,year_pillar:ganzhi,year_boundary:'lichun_instant',interval:{start:start.toString(),end_exclusive:end.toString()},eligible_birth_interval:{start:start.toString(),end_exclusive:eligibleEnd.toString()},exact_birth_date:null,exact_birth_time:null,identity_status:'hypothetical_year_condition'},[p],true,start.toPlainDate().toString(),inclusiveEnd.toPlainDate().toString());
  }
 }else if(input.search.type==='people'){
  for(const person of input.search.people){const c=engine.build({mode:'bazi',birth:person.birth,options:person.options});
   consider({id:'PSP-'+person.id,kind:'provided_person',person_id:person.id,birth_year_label:Number(c.normalized.solar_date.slice(0,4)),birth:person.birth,normalized:c.normalized,warnings:c.warnings,identity_status:'user_provided_not_destiny_confirmed'},c.bazi.chart.pillars,false,c.normalized.solar_date);
  }
 }
 function step(){
  check(input.search.type==='dates','分段扫描仅用于日期');
  if(compareDate(date(nextDate,'cursor'),date(input.search.end,'end'))>0)return false;
  const d=date(nextDate,'cursor');
   const location=Object.fromEntries(['longitude','longitude_source'].filter(k=>input.search[k]!==undefined).map(k=>[k,input.search[k]]));
   const prepared=gridEngine.prepare({mode:'time_compare',chart_mode:'bazi',birth:{calendar:'solar',date:d.toString(),gender:'male',timezone:input.search.timezone,...location},birth_options:input.search.options,time_uncertainty:input.search.time_uncertainty}),grid=gridEngine.generate(prepared);
   for(const point of grid.points){try{
    const dt=Temporal.PlainDateTime.from(point.local_datetime),birth={calendar:'solar',date:dt.toPlainDate().toString(),time:dt.toPlainTime().toString({smallestUnit:'second'}),gender:'male',timezone:input.search.timezone,...location};
    const c=normalize({mode:'bazi',birth,options:input.search.options}),pillars=makePillars(c).pillars,interval=grid.intervals.find(i=>i.id===point.interval_id);
    consider({id:'PSD-'+d.toString()+'-'+point.id,kind:'hypothetical_datetime',birth_year_label:d.year,local_datetime:point.local_datetime,timezone:input.search.timezone,sampling_role:point.sampling_role,interval:interval?{start:interval.start,end:interval.end}:null,warnings:c.warnings,identity_status:'generated_condition_candidate',gender_is_known:false},pillars,false,d.toString());
   }catch(e){if(!(e instanceof InputError))throw e;unavailable.push({local_datetime:point.local_datetime,error:e.message});}}
  nextDate=d.add({days:1}).toString();return true;
 }
 function snapshot(){return {input,self,results,unavailable,nextDate,examined,outsideGap,failedConditions,excludedRelations};}
 function finish(){
 if(input.search.type==='dates')check(compareDate(date(nextDate,'cursor'),date(input.search.end,'end'))>0,'扫描尚未完成');
 results.sort((a,b)=>b.evaluation.matched_condition_count-a.evaluation.matched_condition_count||Math.abs(a.year_label_gap)-Math.abs(b.year_label_gap)||a.id.localeCompare(b.id,'en'));
 const result={schema_version:SCHEMA,engine_version:VERSION,rule_version:RULES.version,input,self:{...self,pillars:self.pillars.map(compactPillar),calculations:undefined,spouse_star_occurrences:self.calculations.score_ledger.filter(x=>['正财','偏财','正官','七杀'].includes(x.ten_god)),spouse_palace:{...compactPillar(self.pillars[2]),hidden_stems:self.pillars[2].hidden_stems}},
  coverage:{type:input.search.type,examined,accepted:results.length,underage_excluded:underage,outside_year_gap:outsideGap,failed_conditions:failedConditions,excluded_relations:excludedRelations,unavailable:unavailable.length,scope:input.search.type==='dates'?'明确时间或结构边界首中末采样；结果只代表已计算点，不是连续分钟概率。':'所列年柱周期或用户提供人物；未知月日时不补造。',full_bazi_gender_placeholder:input.search.type==='dates'?'内部male参数仅满足旧引擎契约；四柱不依赖它，未输出候选者性别、紫微、排运或生理结论。':null},
  candidates:results,unavailable,ordering:RULES.ordering,interpretation_scope:RULES.interpretation_scope,sources:RULES.sources,selected_partner:null,probability:null};
 delete result.self.calculations;result.checksum={algorithm:'sha256-canonical-json',value:digest(result)};return result;
 }
 return {step,snapshot,finish};
}
function build(raw){const scan=createScan(raw);if(raw.search.type==='dates')while(scan.step()){}return scan.finish();}
function integrity(data){check(data?.schema_version===SCHEMA&&data.engine_version===VERSION&&data.rule_version===RULES.version,'不支持的候选筛选版本');const {checksum,...payload}=data;check(checksum?.algorithm==='sha256-canonical-json'&&checksum.value===digest(payload),'候选结果校验和不匹配');return checksum.value;}
function validateArtifact(data){integrity(data);const fresh=build(data.input);check(digest(fresh)===digest(data),'候选筛选与当前程序重算不一致');return data.checksum.value;}
module.exports={build,createScan,normalizeInput,integrity,validateArtifact,assessment,manualPillars,lichun,SCHEMA,VERSION,RULES};
