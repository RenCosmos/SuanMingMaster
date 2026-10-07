'use strict';
// Additive navigation only: never calculate, choose a person, change inputs or retry.
const path=require('node:path');
const {sha}=require('./runtime-core.cjs');
function taskId(files){return files?.chart?'SM-'+sha(Buffer.from(path.resolve(files.chart))).slice(0,12):null;}
function nextActions(context,peoplePage){
 const selection=context.selection,reading=context.reading,actions=[];
 const add=value=>{
  if(value.action==='reuse'){
   const filters=Object.fromEntries(['person','years','candidate','field'].filter(k=>selection[k]!==null&&selection[k]!==undefined).map(k=>[k,selection[k]]));
   value={focus:context.focus,limit:selection.limit,...filters,...value};
  }
  if(!actions.some(a=>JSON.stringify(a)===JSON.stringify(value)))actions.push(value);
 };
 if(peoplePage?.next_person)add({action:'reuse',person:peoplePage.next_person,focus:context.focus});
 const annual=reading.bazi?.annual?[{page:reading.bazi.annual}]:
  (reading.people??[]).filter(p=>p.chart.bazi?.annual).map(p=>({page:p.chart.bazi.annual,person:p.person_id}));
 for(const {page,person} of annual){
  const who=person?{person}:{};
  if(page.requested_range_computed===false||page.computed_years.total===0){
   add({action:'new_calculation',reason:'annual_range_uncomputed',...who,years:page.requested_years});
  }else if(page.next_offset!==null){
   add({action:'reuse',focus:'annual',...who,offset:page.next_offset,...(selection.years?{years:selection.years}:{})});
  }
 }
 if(reading.fields?.next_offset!==null&&reading.fields?.next_offset!==undefined){
  add({action:'reuse',focus:context.focus,offset:reading.fields.next_offset});
 }
 for(const field of reading.fields?.items??[]){
  if(Number.isInteger(field.next_variant_offset))add({action:'reuse',focus:context.focus,field:field.id,variant_offset:field.next_variant_offset});
 }
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
  if(a.command_flags?.includes('--partner-search'))argv.push('--partner-search');
  for(const key of ['focus','person','candidate','field','years','offset','variant_offset','limit'])if(a[key]!==undefined&&a[key]!==null){
   argv.push('--'+key.replaceAll('_','-'),key==='years'?a[key].join(':'):String(a[key]));
  }
  return {...a,entrypoint:'scripts/mobile.sh',argv};
 });
}
module.exports={taskId,nextActions,executableActions,failureFor};
