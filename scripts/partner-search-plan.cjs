'use strict';
// Derive explicit structural hypotheses and calendar queries, never a real partner identity.
const fs=require('node:fs'),path=require('node:path');
const {Solar}=require('lunar-typescript'),{Temporal}=require('./common.cjs');
const core=require('./runtime-core.cjs'),search=require('./partner-search.cjs'),regular=require('./partner-search-workflow.cjs');
const {relations,tenGod}=require('./bazi-rules.cjs'),IMAGE=require('../references/partner-image-rules.json');
const {actualPath,inside,assertOutputs,acquireTaskLocks}=require('./task-files.cjs');
const {withInputLifecycle,readStdinJson}=require('./input-lifecycle.cjs'),budget=require('./output-budget.cjs');
const {check,hash,sha,readJson,atomicJson,ROOT,VERSION}=core;
const SCHEMA='suanming-partner-search-plan/v1',ENGINE='partner-search-plan/1.0.0',GAN='甲乙丙丁戊己庚辛壬癸',ZHI='子丑寅卯辰巳午未申酉戌亥';
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o?.[k]!==undefined).map(k=>[k,o[k]]));
function normalizeInput(raw){
 check(raw?.mode==='partner_search_plan','mode 须为 partner_search_plan');
 const {candidate_pillars,...input}=raw;
 check(input.search?.type==='years','规划入口使用 search.type=years 和明确年份范围');
 if(candidate_pillars!==undefined)search.manualPillars(candidate_pillars);
 const conditions=input.filters?.conditions??search.RULES.default_conditions;
 check(Array.isArray(conditions)&&conditions.length>0&&new Set(conditions).size===conditions.length&&conditions.every(id=>Object.hasOwn(search.RULES.conditions,id)),'规划 conditions 须为支持且不重复的条件');
 const n=search.normalizeInput(yearSource({...input,mode:'partner_search'}));
 if(conditions.includes('element_supply'))check(n.filters.preferred_elements.length>0,'element_supply 规划须明确 preferred_elements，不自动断喜用');
 n.filters.conditions=[...conditions];
 return {...n,mode:'partner_search_plan',...(candidate_pillars===undefined?{}:{candidate_pillars:[...candidate_pillars]})};
}
function queryInput(input){const {candidate_pillars,...raw}=input;return {...raw,mode:'partner_search'};}
function yearSource(input){
 const conditions=input.filters?.conditions;
 if(!conditions?.includes('element_supply'))return input;
 const rest=conditions.filter(id=>id!=='element_supply');
 return {...input,filters:{...input.filters,conditions:rest.length?rest:['zodiac_affinity']}};
}
function key(input){const n=structuredClone(normalizeInput(input));delete n.label;delete n.question;return hash(n);}
function derive(self,input){
 const own=self.pillars[2],year=self.pillars[0],chosen=input.filters.conditions,role=input.partner_star_model==='wealth'?['正财','偏财']:input.partner_star_model==='authority'?['正官','七杀']:['正财','偏财','正官','七杀'];
 const hypotheses=[];
 if(chosen.includes('zodiac_affinity'))hypotheses.push({condition:'zodiac_affinity',candidate_field:'year_branch',values:[...new Set([...IMAGE.liuhe,...IMAGE.sanhe].filter(g=>g.includes(year.branch)).flatMap(g=>[...g]).filter(b=>b!==year.branch))],source_ids:search.RULES.conditions.zodiac_affinity.sources});
 if(chosen.includes('spouse_branch_liuhe'))hypotheses.push({condition:'spouse_branch_liuhe',candidate_field:'day_branch',values:[...IMAGE.liuhe.find(g=>g.includes(own.branch))].filter(b=>b!==own.branch),source_ids:search.RULES.conditions.spouse_branch_liuhe.sources});
 if(chosen.includes('day_stem_five_combine'))hypotheses.push({condition:'day_stem_five_combine',candidate_field:'day_stem',values:[...GAN].filter(stem=>relations([{...own,id:'SELF-DAY'},{stem,branch:own.branch,id:'CANDIDATE-DAY'}]).some(r=>r.type==='天干五合')),source_ids:search.RULES.conditions.day_stem_five_combine.sources});
 if(chosen.includes('partner_star_projection'))hypotheses.push({condition:'partner_star_projection',candidate_field:'day_stem',values:[...GAN].filter(stem=>role.includes(tenGod(own.stem,stem))),source_ids:search.RULES.conditions.partner_star_projection.sources});
 if(chosen.includes('element_supply'))hypotheses.push({condition:'element_supply',candidate_field:'full_chart_elements',values:input.filters.preferred_elements,source_ids:['PS-PROJECT'],basis:'明确输入的五行；不是程序断定的喜用神'});
 const dayRules=hypotheses.filter(h=>h.candidate_field.startsWith('day_')),values=[];
 if(dayRules.length)for(const stem of GAN)for(const branch of ZHI){
  if(GAN.indexOf(stem)%2!==ZHI.indexOf(branch)%2)continue;
  const matched=dayRules.filter(h=>h.values.includes(h.candidate_field==='day_stem'?stem:branch)).map(h=>h.condition);
  if(input.filters.match==='all'?matched.length===dayRules.length:matched.length>0)values.push({ganzhi:stem+branch,matched_day_conditions:matched});
 }
 return {hypotheses,day_pillar_options:{combination:input.filters.match,selected_day_conditions:dayRules.map(h=>h.condition),values,scope:'仅检验所列日级条件；年支、整盘五行与风险排除尚未由这些日柱证明，ANY不能把各字段都变成硬条件。'},missing_fields:['未指定的候选月柱和时柱由实际历法枚举产生，不从本人盘强填唯一组合。']};
}
function build(raw){
 const input=normalizeInput(raw),original=search.build(yearSource(queryInput(input))),self=original.self,derived=derive(self,input),target=input.candidate_pillars;
 const own=self.pillars;
 const targetEvaluation=target?search.assessment({pillars:own},search.manualPillars(target),queryInput(input),false):null;
 const zodiac=derived.hypotheses.find(h=>h.condition==='zodiac_affinity'),mappings=[];
 for(let year=input.search.year_range[0];year<=input.search.year_range[1];year++){
  const gap=year-self.birth_year;if(gap<input.filters.year_gap[0]||gap>input.filters.year_gap[1])continue;
  const pillar=Solar.fromYmd(year,6,15).getLunar().getYearInGanZhiExact(),affinity=zodiac?.values.includes(pillar[1])??null;
  if(target&&pillar!==target[0])continue;
  if(!target&&input.filters.match==='all'&&zodiac&&!affinity)continue;
  const start=search.lichun(year).withTimeZone(input.search.timezone),end=search.lichun(year+1).withTimeZone(input.search.timezone);
  mappings.push({birth_year_label:year,year_pillar:pillar,animal:IMAGE.animals[pillar[1]],year_label_gap:gap,zodiac_condition_matches:affinity,
   interval:{start:start.toString(),end_exclusive:end.toString()},start_date:start.toPlainDate().toString(),end_date:end.subtract({seconds:1}).toPlainDate().toString()});
 }
 const data={schema_version:SCHEMA,engine_version:ENGINE,partner_search_engine:search.VERSION,input,self,derived,
  proposed_candidate:target?{pillars:target,source:'explicit_hypothesis_not_known_person',calendar_verified:false,evaluation:targetEvaluation}:null,
  year_mappings:mappings,scope:'支持从本人八字提炼候选结构并对应年份；这里只验证年柱对应周期，不证明其余三柱同时存在。完整四柱须再用日期枚举精确核对。候选条件不是唯一现实正缘、概率或医学结论。',
  sources:search.RULES.sources,selected_partner:null,probability:null};
 return {...data,checksum:{algorithm:'sha256-canonical-json',value:hash(data)}};
}
function integrity(data){
 check(data?.schema_version===SCHEMA&&data.engine_version===ENGINE&&data.partner_search_engine===search.VERSION,'不支持的条件规划版本');
 const {checksum,...body}=data;check(checksum?.algorithm==='sha256-canonical-json'&&checksum.value===hash(body),'条件规划校验和不一致');
 check(hash(normalizeInput(data.input))===hash(data.input),'条件规划输入不规范');return data;
}
function validateArtifact(data){integrity(data);check(hash(build(data.input))===hash(data),'条件规划与当前程序重算不一致');}
function receipt(data,bytes,fingerprint){const r={schema_version:'suanming-partner-search-plan-validation/v1',input_key:key(data.input),artifact_sha256:sha(bytes),artifact_checksum:data.checksum.value,fingerprint,validation:{ok:true}};return {...r,checksum:hash(r)};}
function trusted(data,bytes,r,fingerprint){if(!r)return false;const {checksum,...body}=r;return r.schema_version==='suanming-partner-search-plan-validation/v1'&&r.validation?.ok===true&&checksum===hash(body)&&r.fingerprint===fingerprint&&r.input_key===key(data.input)&&r.artifact_sha256===sha(bytes)&&r.artifact_checksum===data.checksum.value;}
function parse(argv){
 const o={},flags={'--stdin':'stdin'},pairs={'--input':'input','--reuse':'reuse','--out':'out','--source-chart':'source_chart','--source-person':'source_person','--offset':'offset','--limit':'limit'};
 for(let i=0;i<argv.length;i++){const arg=argv[i],k=flags[arg]??pairs[arg];check(k&&!(k in o),'规划不支持或重复参数 '+arg);if(flags[arg])o[k]=true;else{check(argv[i+1]!==undefined&&!argv[i+1].startsWith('--'),arg+' 缺少值');o[k]=argv[++i];}}
 check(['stdin','input','reuse'].filter(k=>o[k]).length===1,'规划输入选 --stdin、--temp-input/--input 或 --reuse 之一');
 check(o.reuse||o.out,'新规划需要 --out 独立任务目录');check(!o.reuse||!o.out,'规划 --reuse 不另指定 --out');
 check(!o.source_chart||!o.reuse,'原盘导入只用于新规划');check(!o.source_person||o.source_chart,'--source-person 须随 --source-chart');
 if(o.source_person)check(['a','b'].includes(o.source_person),'--source-person 须为 a/b');
 for(const k of ['offset','limit'])if(k in o){check(/^\d+$/.test(o[k]),k+' 须为整数');o[k]=Number(o[k]);check(Number.isSafeInteger(o[k])&&o[k]>=(k==='limit'?1:0)&&(k!=='limit'||o[k]<=10),k+' 超出范围');}
 for(const k of ['input','reuse','out','source_chart'])if(o[k])o[k]=path.resolve(o[k]);return o;
}
function followup(data,row,file){
 const {candidate_pillars,...raw}=data.input,parts=[],last=Temporal.PlainDate.from(row.end_date);
 for(let start=Temporal.PlainDate.from(row.start_date);Temporal.PlainDate.compare(start,last)<=0;){
  const max=start.add({days:365}),end=Temporal.PlainDate.compare(max,last)<0?max:last;
  const input={...raw,mode:'partner_search_batch',search:{type:'dates',start:start.toString(),end:end.toString(),timezone:data.input.search.timezone,time_uncertainty:{type:'unknown'}},ranking:'all',candidate_year_branch:row.year_pillar[1],...(candidate_pillars?{candidate_pillars}:{})};
  parts.push({action:'new_calculation',entrypoint:'scripts/mobile.sh',argv:['--stdin','--partner-search','--batch','--out',path.join(path.dirname(file),'year-'+row.birth_year_label+'-'+(parts.length+1))],input,
   label:candidate_pillars?'精确核对目标四柱的历法采样点':'按原ANY/ALL条件枚举该年柱周期；年支预选不代表全年综合最优',requires_input:true});
  start=end.add({days:1});
 }return parts;
}
function project(data,o,base){
 const offset=o.offset??0;let limit=o.limit??5;
 while(limit>=1){
  const items=data.year_mappings.slice(offset,offset+limit).map(row=>({...row,next_actions:followup(data,row,base.files.chart)})),next=offset+items.length<data.year_mappings.length?offset+items.length:null,first=offset===0;
  const actions=next===null?[]:[{action:'reuse',entrypoint:'scripts/mobile.sh',argv:['--reuse',base.files.chart,'--partner-search','--plan','--offset',String(next),'--limit',String(limit)],label:'继续年份对应表'}];
  const context={schema_version:'suanming-partner-search-plan-context/v1',source_checksum:data.checksum.value,as_of:data.input.as_of,filters:data.input.filters,partner_star_model:data.input.partner_star_model,
   ...(first?{self:pick(data.self,['source_kind','calendar_verified','birth_year','birth_date','pillars','spouse_star_occurrences','spouse_palace','warnings']),derived:data.derived,
    proposed_candidate:data.proposed_candidate?{...pick(data.proposed_candidate,['pillars','source','calendar_verified']),evaluation:{...pick(data.proposed_candidate.evaluation,['passes_conditions','excluded_by_relations','matched_conditions','unmatched_conditions','matched_condition_count','candidate_anchor','probability','confirmed_partner']),risk_types:[...new Set(data.proposed_candidate.evaluation.risk_relations.map(r=>r.type))]}}:null,sources:data.sources}:{source_ids:data.sources.map(s=>s.id)}),
   year_mapping:{total:data.year_mappings.length,offset,returned:items.length,next_offset:next,items},
   interpretation_scope:data.scope,selected_partner:null,probability:null,
   interpretation_rules:['这是允许执行的假设条件规划与年份筛选，不因无法确定唯一现实生日而拒绝整个查询。','候选日干／日支只表示日柱条件，不能用年干／年支冒充。','从理论四柱对应年份不等于验证完整出生时间；按该年 next_actions 的完整argv及input继续枚举。','不把未命中解释成没有正缘，不擅改ANY/ALL，不删时辰采样来节省输出。']};
  const r={...base,context,next_actions:actions,output:{max_bytes:budget.WORKFLOW_BYTES,bytes:0,effective_limit:limit,budget_adjusted:limit!==(o.limit??5)}};
  budget.stamp(r);if(budget.fits(r,budget.WORKFLOW_BYTES,128))return r;limit--;
 }throw new Error('条件规划最小页超出预算；完整规划保留');
}
function operation(argv){
 if(argv.length===1&&['--help','-h'].includes(argv[0]))return 'V'+VERSION+' partner_search --plan\n新规划：--stdin/--temp-input FILE --out TASK，mode=partner_search_plan，search.type=years。\n复用：--reuse TASK/chart.json --offset N --limit 1..10。可选candidate_pillars为明确理论四柱，按年月日时排列；并非现实正缘认证。\n通过 mobile.sh --agent --partner-search --plan 调用，返回适配假设、年份对应表及带input的完整后续argv。';
 let unlock;try{
  const result=withInputLifecycle(argv,args=>{
   const o=parse(args),out=actualPath(o.reuse?path.dirname(o.reuse):o.out);check(!inside(out,actualPath(ROOT)),'规划不能写入技能包');
   const file=path.join(out,'chart.json'),validation=path.join(out,'validation.json'),context=path.join(out,'context.json');
   if(o.reuse)check(actualPath(o.reuse)===actualPath(file),'规划复用须指定该任务的chart.json');
   assertOutputs(o.input??o.reuse,[context,validation,...(o.reuse?[]:[file])]);if(o.source_chart)assertOutputs(o.source_chart,[file,context,validation]);
   unlock=acquireTaskLocks([out]);let input,data;
   if(!o.reuse){let raw=o.stdin?readStdinJson():readJson(o.input);if(o.source_chart)raw=regular.importSource(raw,o);input=normalizeInput(raw);}
   check(o.reuse||fs.existsSync(file)||!fs.existsSync(context)&&!fs.existsSync(validation),'目录已有其他任务结果，请新建规划目录');
   if(fs.existsSync(file)){data=integrity(readJson(file));if(input)check(key(input)===key(data.input),'目录已有不同规划，请新建目录');}
   else check(!o.reuse,'规划产物不存在');
   const fingerprint=core.fingerprint();let r;try{r=readJson(validation);}catch{}
   const cached=data&&trusted(data,fs.readFileSync(file),r,fingerprint);
   if(!data){data=build(input);atomicJson(file,data);}
   else if(!cached)validateArtifact(data);
   if(!cached)atomicJson(validation,receipt(data,fs.readFileSync(file),fingerprint));
   return project(data,o,{ok:true,workflow_version:VERSION,adapter_id:'partner_search_plan',validation:{ok:true,recalculated:!cached,method:cached?'verified_cache':'recalculated'},cache_hit:Boolean(cached),calculation_performed:!cached,files:{chart:file,context,validation},task_id:'SMP-'+hash(out).slice(0,12)});
  });
  budget.assertFits(budget.stamp(result),budget.WORKFLOW_BYTES);atomicJson(result.files.context,result);return result;
 }finally{unlock?.();}
}
module.exports={normalizeInput,derive,build,integrity,validateArtifact,project,operation,followup,SCHEMA,ENGINE};
