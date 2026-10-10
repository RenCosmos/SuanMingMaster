'use strict';
// Additive navigation only: never calculate, choose a person, change inputs or retry.
const path=require('node:path');
const {sha}=require('./runtime-core.cjs');
function taskId(files){return files?.chart?'SM-'+sha(Buffer.from(path.resolve(files.chart))).slice(0,12):null;}
function nextActions(context,peoplePage){
 const selection=context.selection,reading=context.reading,theme=reading.reading??reading,actions=[];
 const add=value=>{
  value={required:false,...value};
  if(value.action==='reuse'){
   const filters=Object.fromEntries(['person','years','candidate','field'].filter(k=>selection[k]!==null&&selection[k]!==undefined).map(k=>[k,selection[k]]));
   value={focus:context.focus,limit:selection.limit,...filters,...value};
  }
  if(!actions.some(a=>JSON.stringify(a)===JSON.stringify(value)))actions.push(value);
 };
 if(peoplePage?.next_person)add({action:'reuse',person:peoplePage.next_person,focus:context.focus,required:true,required_for:'本次合盘的双方证据'});
 if(reading.comparison_page?.next_offset!==null&&reading.comparison_page?.next_offset!==undefined){
  add({action:'reuse',focus:'relationship',comparison:true,offset:reading.comparison_page.next_offset,person:null,years:null,candidate:null,field:null,required:true,required_for:'本次合盘交叉证据'});
 }
 // Finish the requested people page first; its continuation then exposes the comparison view.
 if(reading.pair_evidence?.missing?.includes('comparison')&&!peoplePage?.next_person){
  add({action:'reuse',focus:'relationship',comparison:true,offset:0,person:null,years:null,candidate:null,field:null,required:true,required_for:'本次合盘交叉证据'});
 }
 const annual=theme.emotional_paths?.timing?[{page:theme.emotional_paths.timing,focus:'romance'}]:theme.bazi?.annual?[{page:theme.bazi.annual}]:
  (theme.people??[]).filter(p=>p.chart.bazi?.annual||p.emotional_paths?.timing).map(p=>({page:p.emotional_paths?.timing??p.chart.bazi.annual,...(context.source_schema!=='bazi-ziwei-time-compare/v1'?{person:p.person_id}:{}),...(p.emotional_paths?.timing?{focus:'romance'}:{})}));
 for(const {page,person,focus} of annual){
  const who=person?{person}:{};
  const required=Boolean(selection.years||context.focus==='annual'||selection.page==='annual');
  if(page.requested_range_computed===false||page.computed_years.total===0){
   add({action:'new_calculation',reason:'annual_range_uncomputed',...who,years:page.requested_years,required,required_for:required?'所问年度未计算':'追问年度时'});
  }else if(page.next_offset!==null){
   const incremental=(context.view==='brief'||context.view==='evidence_page')&&context.source_schema!=='bazi-ziwei-time-compare/v1';
   add({action:'reuse',purpose:'annual_page',focus:focus??'annual',...who,offset:page.next_offset,...(selection.years?{years:selection.years}:{}),...(incremental?{page:'annual',base_checksum:context.source_checksum,brief:true}:{}),required,required_for:required?'所问年度范围':'追问年度时'});
  }
 }
 for(const deferred of context.available.deferred_views??[])if(deferred.page==='annual')add({action:'reuse',purpose:'annual_page',page:'annual',base_checksum:context.source_checksum,brief:true,focus:context.focus,...(deferred.person?{person:deferred.person}:{}),offset:0,limit:5,required:false,required_for:'用户追问年份或时机才展开'});
 if(reading.fields?.next_offset!==null&&reading.fields?.next_offset!==undefined){
  add({action:'reuse',focus:context.focus,offset:reading.fields.next_offset});
 }
 for(const field of reading.fields?.items??[]){
  if(Number.isInteger(field.next_variant_offset))add({action:'reuse',focus:context.focus,field:field.id,variant_offset:field.next_variant_offset});
 }
 const flights=reading.ziwei?.palace_stem_flying?[{page:reading.ziwei.palace_stem_flying}]:
  (reading.people??reading.reading?.people??[]).filter(p=>p.chart.ziwei?.palace_stem_flying).map(p=>({page:p.chart.ziwei.palace_stem_flying,person:p.person_id}));
 for(const {page,person} of flights)if(!Array.isArray(page)&&Number.isInteger(page.next_offset))add({action:'reuse',purpose:'flying_page',brief:true,...(person&&context.source_schema!=='bazi-ziwei-time-compare/v1'?{person}:{}),flying_offset:page.next_offset,offset:selection.offset,...(context.source_schema!=='bazi-ziwei-time-compare/v1'?{page:'flying',base_checksum:context.source_checksum}:{}),required:selection.page==='flying',required_for:'四化判断涉及缺页时'});
 // At most three suggestions. Existing pagination/selection fields remain authoritative and complete.
 return actions.slice(0,3);
}
function failureFor(error){
 const type=error.code??'workflow_error';let action='correct_input',retryLimit=0;
 if(type==='task_busy'){action='wait_or_select_new_task';retryLimit=1;}
 else if(type==='context_budget_exceeded')action='narrow_context_and_reuse';
 else if(type==='cleanup_error')action='inspect_preserved_input';
 else if(type==='ENOENT')action='select_existing_task_or_input';
 else if(/目录已有不同的计算输入/.test(error.message))action='use_new_task_directory';
 else if(/校验和不匹配|重算不一致|版本已变化/.test(error.message))action='restore_or_recalculate_from_original_input';
 return {ok:false,error:error.message,type,recovery:{action,retry_limit:retryLimit}};
}
function executableActions(actions,files){
 return actions.map(a=>{
  if(a.action!=='reuse'||!files?.chart)return a;
  const argv=['--reuse',files.chart];
  if(a.brief)argv.push('--brief');
  if(a.comparison)argv.push('--comparison');
  if(a.command_flags?.includes('--partner-search'))argv.push('--partner-search');
  for(const key of ['focus','person','candidate','field','years','offset','variant_offset','flying_offset','limit','page','base_checksum'])if(a[key]!==undefined&&a[key]!==null){
   argv.push('--'+key.replaceAll('_','-'),key==='years'?a[key].join(':'):String(a[key]));
  }
  return {...a,entrypoint:'scripts/mobile.sh',argv};
 });
}
module.exports={taskId,nextActions,executableActions,failureFor};
