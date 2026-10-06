'use strict';
const fs=require('node:fs');const path=require('node:path');
const {withInputLifecycle}=require('./input-lifecycle.cjs');
function library(){
 const MANIFEST=require('../references/knowledge/supe888-bazi-skills/manifest.json'),FOLK=require('../references/folklore/catalog.json'),CURATED=require('../references/knowledge/curated/catalog.json'),PRACTICE=require('../references/knowledge/practice/catalog.json'),SPIRIT=require('../references/knowledge/spirit/catalog.json');
 const topics=[...MANIFEST.topics.map(t=>({...t,source_kind:'open_source_prompt_template',repository:MANIFEST.repository,commit:MANIFEST.commit,license:MANIFEST.license})),...FOLK.topics.map(t=>({...t,source_kind:t.kind})),...CURATED.topics.map(t=>({...t,source_kind:t.kind})),...PRACTICE.topics.map(t=>({...t,source_kind:t.kind})),...SPIRIT.topics.map(t=>({...t,source_kind:t.kind}))];
 return {MANIFEST,FOLK,CURATED,PRACTICE,SPIRIT,topics};
}
function lookup(input){
 const {ROOT,check}=require('./common.cjs'),{topics}=library();
 check(input&&typeof input==='object'&&!Array.isArray(input),'知识检索输入必须是对象');
 for(const key of Object.keys(input))check(['topic','query','limit'].includes(key),`知识检索不支持字段 ${key}`);
 check(('topic' in input)!==('query' in input),'请只提供 topic 或 query 之一');
 const limit=input.limit===undefined?5:input.limit;check(Number.isInteger(limit)&&limit>=1&&limit<=10,'limit 须为 1–10');
 const base={ok:true,reference_only:true,source_policy:'每个命中单独标明来源；项目方法、开源提示词、官方名录、古籍与宗教教义不互相替代；宗教来源不认证个人鬼神身份'};
 if('topic' in input){const t=topics.find(t=>t.slug===input.topic);check(t,'知识库没有该主题，请查看知识库索引');const file=path.resolve(ROOT,t.path);check(file.startsWith(ROOT+path.sep),'知识文件路径错误');return {...base,...(t.repository?{repository:t.repository,commit:t.commit,license:t.license}:{publisher:t.publisher,source_url:t.url,copyright_note:t.copyright_note}),topic:t,content:fs.readFileSync(file,'utf8')};}
 check(typeof input.query==='string'&&input.query.trim().length>=1&&input.query.length<=200,'query 须为 1–200 字');
 const q=input.query.trim().toLowerCase();const terms=q.split(/\s+/);const compact=q.replace(/[\s\p{P}]/gu,'');
 const matches=topics.map(t=>{const content=fs.readFileSync(path.join(ROOT,t.path),'utf8');const title=`${t.name} ${t.slug} ${t.tags.join(' ')} ${t.subtitle}`.toLowerCase();let score=0;for(const term of terms){if(title.includes(term))score+=10;if(content.toLowerCase().includes(term))score+=1;}
  // 常见中文问句无需先写成空格关键词；别名和标签只用于检索，不作为执行指令。
  const aliasHit=(t.aliases||[]).some(a=>{const value=a.toLowerCase().replace(/[\s\p{P}]/gu,'');return value.length>=2&&compact.includes(value);});
  if(aliasHit)score+=30;
  for(const tag of t.tags){const value=tag.toLowerCase();if(value.length>=2&&compact.includes(value)&&!terms.some(term=>term===value))score+=4;}
  const index=content.toLowerCase().indexOf(terms[0]);return {...t,score,snippet:index>=0?content.slice(Math.max(0,index-40),index+180):t.subtitle};}).filter(t=>t.score>0).sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id))).slice(0,limit);
 return {...base,query:input.query,matches};
}
function verifyKnowledge(){
 const {ROOT,readJson,digest,check}=require('./common.cjs'),{MANIFEST,FOLK,CURATED,PRACTICE,SPIRIT,topics}=library();
 const dir=path.join(ROOT,'references/knowledge/supe888-bazi-skills');check(MANIFEST.topics.length===35,'知识主题数量不完整');
 const crypto=require('node:crypto');const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 for(const [file,expected] of Object.entries(MANIFEST.bundled_file_sha256))check(sha(path.join(dir,file))===expected,`知识库文件摘要不匹配：${file}`);
 check(new Set(topics.map(t=>t.slug)).size===topics.length,'知识主题 slug 重复');
 check(new Set(FOLK.topics.map(t=>t.id)).size===FOLK.topics.length,'来源卡编号重复');
 for(const t of topics){const file=path.resolve(ROOT,t.path);check(file.startsWith(ROOT+path.sep),'知识文件路径错误');check(sha(file)===t.sha256,`知识主题摘要不匹配：${t.slug}`);}
 check(FOLK.version==='folklore-source-cards/v2'&&FOLK.topics.length===21&&FOLK.topics.filter(t=>t.kind==='official_heritage_registry').length===4&&FOLK.topics.filter(t=>t.kind==='classical_primary_text').length===17,'民俗来源目录不完整');
 const evidence=readJson(path.join(ROOT,FOLK.verification_record));check(evidence.version==='classical-source-verification/v1'&&evidence.records.length===14,'古籍查核记录不完整');
 for(const t of FOLK.topics.slice(7)){
  const e=evidence.records.find(e=>e.slug===t.slug);
  check(e&&e.id===t.id&&e.sha256===t.sha256&&e.url===t.url&&e.book===t.book&&e.chapter===t.chapter&&e.original_excerpt===t.original_excerpt&&e.locator===t.locator&&e.access_method===t.access_method&&e.source_verification===t.source_verification&&e.attestation===t.attestation,`古籍来源记录不匹配：${t.slug}`);
  check(typeof t.original_excerpt==='string'&&t.original_excerpt.length>0&&t.locator&&t.book&&t.chapter&&t.program_supported===false,`古籍来源字段不完整：${t.slug}`);
 }
 check(CURATED.version==='curated-knowledge/v1'&&CURATED.topics.length===11&&CURATED.sources.length===3,'精选知识目录不完整');
 for(const s of CURATED.sources){check(/^[0-9a-f]{40}$/.test(s.commit),'项目来源缺少固定提交');const file=path.resolve(ROOT,s.license_path);check(file.startsWith(ROOT+path.sep)&&sha(file)===s.license_sha256,`项目许可摘要不匹配：${s.id}`);}
 check(CURATED.classical_verification.length===4,'精选古籍记录不完整');
 for(const e of CURATED.classical_verification){const t=CURATED.topics.find(t=>t.id===e.id);check(t?.kind==='classical_primary_text'&&t.original_excerpt===e.original_excerpt&&t.book===e.book&&t.chapter===e.chapter&&t.url===e.url&&fs.readFileSync(path.join(ROOT,t.path),'utf8').includes(e.original_excerpt),`精选古籍摘录不一致：${e.id}`);}
 check(PRACTICE.version==='practice-knowledge/v1'&&PRACTICE.topics.length===18&&PRACTICE.expected_topics===18,'修行与行动知识目录不完整');
 check(new Set(topics.map(t=>t.id)).size===topics.length,'知识来源编号重复');
 const sourceIds=new Set(PRACTICE.sources.map(s=>s.id));check(sourceIds.size===PRACTICE.sources.length&&sourceIds.size===22,'修行资料来源编号不完整或重复');
 for(const s of PRACTICE.sources)check(s.title&&s.publisher&&s.locator&&s.access_method&&s.copyright_note&&s.accessed_on&&/^https:\/\//.test(s.url),'修行资料来源字段不完整');
 check(PRACTICE.source_verification.length===PRACTICE.topics.length,'修行资料查核记录不完整');
 for(const t of PRACTICE.topics){
  check(t.program_supported===false&&t.kind&&t.publisher&&t.locator&&t.access_method&&t.source_ids?.length&&t.source_ids.every(id=>sourceIds.has(id)),'修行知识卡来源字段不完整');
  check(Array.isArray(t.aliases)&&t.aliases.every(a=>typeof a==='string'&&a.length>=2),'知识问句别名错误');
  const source=PRACTICE.sources.find(s=>s.id===t.source_ids[0]);check(source.url===t.url&&source.access_method===t.access_method,'知识卡主来源不一致');
  const records=PRACTICE.source_verification.filter(e=>e.id===t.id);check(records.length===1,'知识卡查核编号错误');const e=records[0];
  check(e.slug===t.slug&&JSON.stringify(e.source_ids)===JSON.stringify(t.source_ids)&&e.locator===t.locator&&e.access_method===t.access_method&&e.original_excerpt===t.original_excerpt,'知识卡查核字段不一致');
  if(t.original_excerpt)check(fs.readFileSync(path.join(ROOT,t.path),'utf8').includes(t.original_excerpt),`修行原典短引缺失：${t.slug}`);
 }
 check(SPIRIT.version==='spirit-knowledge/v1'&&SPIRIT.topics.length===8&&SPIRIT.expected_topics===8&&SPIRIT.sources.length===7&&SPIRIT.expected_sources===7,'宗教知识目录不完整');
 check(SPIRIT.automatic_chart_for_knowledge_questions===false&&SPIRIT.personal_supernatural_identification_supported===false,'宗教知识能力边界错误');
 const spiritIds=new Set(SPIRIT.sources.map(s=>s.id));check(spiritIds.size===SPIRIT.sources.length,'宗教来源编号重复');
 for(const s of SPIRIT.sources)check(s.title&&s.publisher&&s.locator&&s.access_method&&s.verification_limit&&s.adoption&&s.copyright_note&&/^\d{4}-\d{2}-\d{2}$/.test(s.accessed_on)&&/^https:\/\//.test(s.url),'宗教来源字段不完整');
 check(SPIRIT.source_verification.length===SPIRIT.topics.length,'宗教资料查核记录不完整');
 const scopeKinds={religious_teaching:'religious_primary_text',regional_custom_research:'scholarly_research_summary',official_custom_description:'official_religious_culture_statement'};
 for(const t of SPIRIT.topics){
  check(t.program_supported===false&&scopeKinds[t.evidence_scope]===t.kind&&t.tradition&&t.publisher&&t.locator&&t.access_method&&t.copyright_note,'宗教知识卡身份或范围错误');
  check(Array.isArray(t.source_ids)&&t.source_ids.length===1&&spiritIds.has(t.source_ids[0]),'宗教知识卡来源编号错误');
  check(Array.isArray(t.aliases)&&t.aliases.length>0&&t.aliases.every(a=>typeof a==='string'&&a.length>=2),'宗教知识问句别名错误');
  check(Array.isArray(t.inference_limits)&&t.inference_limits.length>0&&t.inference_limits.every(s=>typeof s==='string'&&s.length>0),'宗教知识卡缺少推断边界');
  const s=SPIRIT.sources.find(s=>s.id===t.source_ids[0]);check(s.url===t.url&&s.publisher===t.publisher&&s.access_method===t.access_method,'宗教知识卡主来源不一致');
  const records=SPIRIT.source_verification.filter(e=>e.id===t.id);check(records.length===1,'宗教知识卡查核编号错误');const e=records[0];
  check(e.source_id===s.id&&e.locator===t.locator&&e.original_excerpt===t.original_excerpt&&typeof e.checked_claim==='string'&&e.checked_claim.length>0,'宗教知识卡查核字段不一致');
  if(t.original_excerpt)check(fs.readFileSync(path.join(ROOT,t.path),'utf8').includes(t.original_excerpt),`宗教原典短引缺失：${t.slug}`);
 }
 check(SPIRIT.sources.every(s=>SPIRIT.topics.some(t=>t.source_ids.includes(s.id))),'宗教来源缺少对应主题');
 return {ok:true,topics:MANIFEST.topics.length,folklore_topics:FOLK.topics.length,curated_topics:CURATED.topics.length,curated_classical_topics:CURATED.classical_verification.length,practice_topics:PRACTICE.topics.length,practice_sources:PRACTICE.sources.length,spirit_topics:SPIRIT.topics.length,spirit_sources:SPIRIT.sources.length,total_topics:topics.length,new_classical_verified:evidence.records.length,commit:MANIFEST.commit,manifest_checksum:digest(MANIFEST),folklore_catalog_checksum:digest(FOLK),classical_verification_checksum:digest(evidence),curated_catalog_checksum:digest(CURATED),practice_catalog_checksum:digest(PRACTICE),spirit_catalog_checksum:digest(SPIRIT)};
}
function operation(argv){
 if(argv.length===1&&['--help','-h'].includes(argv[0]))return 'knowledge.cjs --query "关键词" [--limit 1–10]\nknowledge.cjs --topic SLUG\nknowledge.cjs --temp-input QUERY.json（结束后清理）\nknowledge.cjs --input QUERY.json（保留输入）；或 --verify';
 if(argv.length===1&&argv[0]==='--verify')return verifyKnowledge();
 const {readJson,check}=require('./common.cjs');
 if(argv.length===2&&argv[0]==='--input')return lookup(readJson(argv[1]));
 const input={};check(argv.length>0&&argv.length%2===0,'用法：--query "关键词" [--limit 3]；或 --topic SLUG；或 --temp-input QUERY.json');
 for(let i=0;i<argv.length;i+=2){
  const key={'--query':'query','--topic':'topic','--limit':'limit'}[argv[i]];
  check(key&&!(key in input),`不支持或重复的检索参数 ${argv[i]}`);
  check(argv[i+1]!==undefined&&!['--query','--topic','--limit','--input','--temp-input','--verify'].includes(argv[i+1]),`${argv[i]} 缺少值`);
  if(key==='limit'){check(/^(?:[1-9]|10)$/.test(argv[i+1]),'limit 须为 1–10 的整数');input.limit=Number(argv[i+1]);}else input[key]=argv[i+1];
 }
 return lookup(input);
}
function main(argv){const result=withInputLifecycle(argv,operation);console.log(typeof result==='string'?result:JSON.stringify(result));return result;}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(JSON.stringify({ok:false,error:e.message,...(e.code==='cleanup_error'?{type:'cleanup_error'}:{})}));process.exitCode=2;}}
module.exports={lookup,verifyKnowledge,main};
