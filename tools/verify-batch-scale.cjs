'use strict';
// Synthetic, repeatable scale/size check. No user birth data or network access.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),workflow=require('../scripts/workflow.cjs'),regular=require('../scripts/partner-search-workflow.cjs'),batch=require('../scripts/partner-search-batch.cjs'),search=require('../scripts/partner-search.cjs'),core=require('../scripts/runtime-core.cjs'),budget=require('../scripts/output-budget.cjs');
function verify(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-batch-scale-')),started=Date.now();
 try{
  const input={mode:'partner_search_batch',self:{birth:{calendar:'solar',date:'1996-06-15',time:'12:00',gender:'male',timezone:'Asia/Shanghai'}},as_of:'2026-10-08',search:{type:'dates',start:'1997-01-01',end:'1997-12-31',time_uncertainty:{type:'unknown'}},candidate_year_branch:'丑',ranking:'monthly_top'};
  const file=path.join(temp,'synthetic-input.json'),out=path.join(temp,'task');fs.writeFileSync(file,JSON.stringify(input));
  const first=workflow.operation(['--partner-search','--batch','--input',file,'--out',out]);assert.ok(first.ok&&first.validation.ok&&first.context.computed_complete);
  const manifest=batch.integrity(core.readJson(first.files.chart));assert.equal(manifest.jobs.length,12);
  let points=0,flatBytes=0;const expected=new Map(),snapshots=new Map();
  for(const job of manifest.jobs){
   const f=path.join(out,job.chart),bytes=fs.readFileSync(f),data=JSON.parse(bytes);snapshots.set(f,core.sha(bytes));points+=data.coverage.examined;
   assert.deepEqual(data,search.build(data.input),'batch changed original monthly calculation: '+job.month);
   const gs=batch.groupDates(data,'丑').groups,max=gs[0]?.max_matched??-1;expected.set(job.month,gs.filter(g=>g.max_matched===max).map(g=>g.date));
   const files={chart:f,context:path.join(path.dirname(f),'context.json'),validation:path.join(path.dirname(f),'validation.json')};
   const legacy=regular.boundedResponse({ok:true,workflow_version:'1.3.6',adapter_id:'partner_search',validation:{ok:true,method:'recalculated',recalculated:true},cache_hit:false,calculation_performed:true,files,report_generated:false},data,{});
   flatBytes+=budget.measure(legacy).stdout_bytes;
  }
  const seen=new Map(),queue=[first],queried=new Set();let pages=0,summaryBytes=0,maxStdout=0,maxShell=0;
  while(queue.length){
   const response=queue.shift();assert.ok(response.ok&&response.validation.ok);assert.equal(response.context.source_checksum,first.context.source_checksum);
   budget.assertFits(response,budget.WORKFLOW_BYTES);const size=budget.measure(response);summaryBytes+=size.stdout_bytes;maxStdout=Math.max(maxStdout,size.stdout_bytes);maxShell=Math.max(maxShell,size.shell_bytes);pages++;
   for(const month of response.context.months){assert.equal(month.status,'completed');if(!seen.has(month.month))seen.set(month.month,[]);seen.get(month.month).push(...month.dates.map(d=>d.date));}
   for(const next of response.next_actions){const key=JSON.stringify(next.argv);if(queried.has(key))continue;queried.add(key);const r=workflow.operation(next.argv);assert.ok(r.cache_hit&&!r.calculation_performed);queue.push(r);}
   assert.ok(pages<=100,'pagination failed to make progress');
  }
  assert.equal(seen.size,12);for(const [month,dates] of expected){assert.deepEqual(seen.get(month),dates);assert.equal(new Set(seen.get(month)).size,dates.length);}
  for(const [f,digest] of snapshots)assert.equal(core.sha(fs.readFileSync(f)),digest,'pagination modified monthly chart');
  const engineHash=core.sha(fs.readFileSync(path.join(root,'scripts/partner-search.cjs')));assert.equal(engineHash,'721a7caf22bb5caafd4e321928ccd6269ee2a1fafd22ff96acdf4ad13a774e74');
  return {ok:true,input:'synthetic 1996 birth / 1997 full year; four default conditions ANY; cow year-branch scope',months:12,original_sample_points:points,all_original_month_artifacts_recomputed_equal:true,original_partner_engine_byte_identical_to_v136:true,complete_top_date_summary_recovered:true,summary_tool_responses:pages,
   flat_12_month_first_page_stdout_bytes:flatBytes,complete_batch_summary_stdout_bytes:summaryBytes,max_stdout_bytes:maxStdout,max_shell_envelope_bytes:maxShell,response_byte_reduction_percent:Math.round((1-summaryBytes/flatBytes)*1000)/10,
   byte_comparison_is_not_billed_token_measurement:true,elapsed_seconds:(Date.now()-started)/1000};
 }finally{assert.ok(temp.startsWith(path.resolve(os.tmpdir())+path.sep+'suanming-batch-scale-'));fs.rmSync(temp,{recursive:true,force:true});}
}
if(require.main===module)console.log(JSON.stringify(verify()));
module.exports={verify};
