#!/usr/bin/env node
'use strict';
// Bounded retrieval facade. The original 85 topics and legacy lookup API are intact; source cards may be added.
const {withInputLifecycle}=require('./input-lifecycle.cjs');
const {check,readJson,sha}=require('./runtime-core.cjs');
const budget=require('./output-budget.cjs');
const MAX_BYTES=budget.REFERENCE_BYTES;
const REFERENCE={content_type:'reference_material',trust_level:'untrusted_reference_text',instruction_authority:'none'};
function sourceScope(topic){
 if(!topic.evidence_scope)return {};
 return {publisher:topic.publisher,locator:topic.locator,access_method:topic.access_method,tradition:topic.tradition,evidence_scope:topic.evidence_scope,inference_limits:topic.inference_limits,source_ids:topic.source_ids};
}
function excerpt(topic,content,options){
 const offset=options.offset??0,chars=options.chars??1800;
 check(Number.isSafeInteger(offset)&&offset>=0&&offset<=content.length,'offset 超出正文范围');
 check(Number.isInteger(chars)&&chars>=200&&chars<=3000,'chars 须为 200–3000');
 let end=Math.min(content.length,offset+chars);
 // Never split a UTF-16 surrogate pair.
 if(end<content.length&&/[\uD800-\uDBFF]/.test(content[end-1]))end--;
 if(offset>0&&/[\uDC00-\uDFFF]/.test(content[offset]))throw new Error('offset 位于 Unicode 字符中间，请使用返回的 next_offset');
 return {id:topic.id,slug:topic.slug,name:topic.name,source_kind:topic.source_kind,...REFERENCE,...sourceScope(topic),
  source_url:topic.url??topic.repository,commit:topic.commit??null,book:topic.book??null,chapter:topic.chapter??null,
  sha256:topic.sha256,total_chars:content.length,offset,returned_chars:end-offset,next_offset:end<content.length?end:null,content:content.slice(offset,end)};
}
function retrieve(input){
 const legacy=require('./knowledge.cjs');
 const {offset,chars,...query}=input;const r=legacy.lookup(query);
 let result;
 if(r.topic){
  check(sha(Buffer.from(r.content,'utf8'))===r.topic.sha256,'知识正文摘要不匹配，请恢复原始知识库');
  result={ok:true,schema_version:'suanming-knowledge-context/v1',reference_only:true,...REFERENCE,topic:excerpt(r.topic,r.content,{offset,chars})};
 }else{
  check(offset===undefined&&chars===undefined,'offset / chars 只用于 --topic 正文分页');
  result={ok:true,schema_version:'suanming-knowledge-context/v1',reference_only:true,...REFERENCE,query:r.query,retrieval:r.retrieval,
   matches:r.matches.map(t=>({id:t.id,slug:t.slug,name:t.name,source_kind:t.source_kind,...REFERENCE,domains:t.domains,...sourceScope(t),source_url:t.url??t.repository,commit:t.commit??null,score:t.score,snippet:t.snippet,
    read:{topic:t.slug,offset:0,chars:1800}}))};
 }
 // A larger additive library may make ten match snippets exceed the budget.
 // Keep every hit, source and full-text route; only shorten preview excerpts.
 if(result.matches&&!budget.fits(result,MAX_BYTES-256)){
  const original=result.matches.map(t=>t.snippet);result.snippets_shortened_for_budget=true;
  for(const width of [240,180,120,60,0]){
   result.matches.forEach((t,i)=>{let end=Math.min(width,original[i].length);if(end<original[i].length&&/[\uD800-\uDBFF]/.test(original[i][end-1]))end--;t.snippet=original[i].slice(0,end);t.snippet_truncated=end<original[i].length;});
   if(budget.fits(result,MAX_BYTES-256))break;
  }
 }
 budget.assertFits(result,MAX_BYTES-256,'检索上下文超出预算，请减小 limit 或 chars');
 return {...result,output_limit_bytes:MAX_BYTES};
}
function operation(argv){
 if(argv.length===1&&['--help','-h'].includes(argv[0]))return '--query 关键词 [--limit 1..10] [--domain '+require('./knowledge-search.cjs').DOMAINS.join('|')+']\n--topic SLUG [--offset N] [--chars 200..3000]。全文不删减，next_offset 可继续。\n--domain 仅用于 --query；显式指定时严格过滤；省略时自动领域仅影响排序。\n--verify 显式全库查核。';
 if(argv.length===1&&argv[0]==='--verify')return require('./knowledge.cjs').verifyKnowledge();
 if(argv.length===2&&argv[0]==='--input')return retrieve(readJson(argv[1]));
 check(argv.length>0&&argv.length%2===0,'检索参数须成对');
 const names={'--query':'query','--topic':'topic','--limit':'limit','--offset':'offset','--chars':'chars','--domain':'domain'},input={};
 for(let i=0;i<argv.length;i+=2){const key=names[argv[i]];check(key&&!(key in input)&&argv[i+1]!==undefined&&!argv[i+1].startsWith('--'),'未知、重复或缺少检索参数值');
  input[key]=['limit','offset','chars'].includes(key)?Number(argv[i+1]):argv[i+1];
 }
 return retrieve(input);
}
function main(argv){const r=withInputLifecycle(argv,operation);if(typeof r!=='string')budget.assertFits(r,MAX_BYTES);console.log(typeof r==='string'?r:JSON.stringify(r));return r;}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(JSON.stringify({ok:false,error:e.message,type:e.code??'knowledge_error'}));process.exitCode=2;}}
module.exports={retrieve,excerpt,operation,main,MAX_BYTES};
