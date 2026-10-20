'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),knowledge=require('../scripts/knowledge.cjs'),{retrieve}=require('../scripts/knowledge-context.cjs');
const catalog=require('../references/knowledge/bazi-detail/catalog.json'),rules=require('../references/bazi-detail-rules.json');
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');

test('detail library adds 24 sourced cards to the existing 107 topics',()=>{
 const r=knowledge.verifyKnowledge();
 assert.equal(r.total_topics,131);assert.equal(r.bazi_detail_topics,24);assert.equal(r.total_topics-r.bazi_detail_topics,107);
 assert.deepEqual([r.topics,r.folklore_topics,r.curated_topics,r.practice_topics,r.spirit_topics,r.bazi_concept_topics,r.liuyao_concept_topics,r.romance_topics],[35,21,11,18,8,4,6,4]);
 assert.deepEqual(catalog,require('../tools/build-detail-catalog.cjs').build());
 assert.equal(catalog.automatic_chart_for_knowledge_questions,false);
 assert.equal(new Set(catalog.topics.map(t=>t.slug)).size,24);
});

test('every professional concept resolves to its own substantive card',()=>{
 for(const t of catalog.topics){
  const result=retrieve({query:t.name+'是什么意思',limit:3});
  assert.equal(result.matches[0]?.slug,t.slug,t.name);
  assert.equal(result.matches[0].program_field,t.program_field);
  assert.equal(result.instruction_authority,'none');
  assert.equal(result.matches[0].trust_level,'untrusted_reference_text');
  assert.ok(!('chart' in result)&&!('validation' in result));
  assert.ok(Buffer.byteLength(JSON.stringify(result))<=12*1024);
 }
});

test('traditional aliases and precise long terms retrieve professional cards',()=>{
 const pairs=[['十二長生','bazi-twelve-stages'],['自坐與星運','bazi-self-seat'],['八字空亡','bazi-xun-kong'],['納音五行','bazi-nayin'],['推息法','bazi-taixi'],['八字命宮','bazi-minggong'],['八字身宮','bazi-shengong'],['人元司事','bazi-month-commander'],['小運','bazi-xiaoyun'],['天乙貴人','bazi-tianyi'],['太極貴人','bazi-taiji'],['文昌貴人','bazi-wenchang'],['福星貴人','bazi-fuxing'],['祿神','bazi-lushen'],['月德貴人','bazi-yuede'],['天德貴人','bazi-tiande'],['德秀貴人','bazi-dexiu'],['咸池','bazi-taohua'],['驛馬','bazi-yima'],['華蓋','bazi-huagai'],['將星','bazi-jiangxing'],['劫殺','bazi-jiesha']];
 for(const [query,slug] of pairs)assert.equal(retrieve({query,limit:3}).matches[0]?.slug,slug,query);
});

test('new ambiguous terms do not hijack Liuyao, Ziwei, religion or explicit domains',()=>{
 const cases=[['六爻旬空月破','liuyao-empty-broken'],['六爻用神怎么取','liuyao-use-god'],['紫微命宫','ziwei-doushu'],['《礼记·月令》','folk-liji-yueling-summer'],['如何判断喜用神','bazi-favorable-god'],['前世姻缘','spirit-marriage-future-life']];
 for(const [query,slug] of cases)assert.equal(retrieve({query,limit:3}).matches[0]?.slug,slug,query);
 const hard=retrieve({query:'八字空亡 六爻旬空',limit:10,domain:'liuyao'});
 assert.equal(hard.retrieval.filter_domain,'liuyao');assert.ok(hard.matches.length);
 assert.ok(hard.matches.every(t=>t.domains.includes('liuyao')));
 for(const query of ['紅鸞','红鸾'])assert.ok(retrieve({query,limit:3}).matches.length);
});

test('all 24 full cards roundtrip with exact hashes, source scope and program mappings',()=>{
 for(const t of catalog.topics){
  let offset=0,restored='';
  do{
   const result=retrieve({topic:t.slug,offset,chars:200}),page=result.topic;
   assert.equal(page.program_field,t.program_field);assert.equal(page.rule_id,t.rule_id);
   assert.equal(page.program_support_scope,'deterministic_fields_only_not_automatic_interpretation');
   assert.equal(page.evidence_scope,'classical_concept_summary');assert.equal(page.sha256,t.sha256);
   assert.ok(Buffer.byteLength(JSON.stringify(result))<=12*1024);
   restored+=page.content;offset=page.next_offset;
  }while(offset!==null);
  assert.equal(restored,read(t.path));assert.equal(hash(restored),t.sha256);
  assert.ok(t.source_references.length);
  for(const s of t.source_references)assert.ok(restored.includes(s.url)&&s.locator&&s.checked_claim);
 }
});

test('all 14 shensha rules have matching interpretation entries without changing the rules',()=>{
 const entries=catalog.topics.filter(t=>t.rule_id);
 assert.equal(entries.length,14);
 assert.deepEqual(entries.map(t=>t.rule_id).sort(),rules.shensha.map(t=>t.id).sort());
 assert.equal(rules.version,'bazi-professional/1.0.0');
 assert.match(read('references/knowledge/bazi-detail/cards/bazi-month-commander.md'),/5.*5.*20/);
 assert.match(read('references/knowledge/bazi-detail/cards/bazi-minggong.md'),/中气/);
 assert.match(read('references/knowledge/bazi-detail/cards/bazi-fuxing.md'),/异文|异本/);
 assert.match(read('references/knowledge/bazi-detail/cards/bazi-self-seat.md'),/日主|日干/);
});

test('knowledge CLI needs no birth input and keeps its bounded reference contract',()=>{
 const r=cp.spawnSync(process.execPath,[path.join(root,'scripts/knowledge-context.cjs'),'--query','太极贵人','--limit','3'],{cwd:root,encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');
 const value=JSON.parse(r.stdout);assert.equal(value.matches[0].slug,'bazi-taiji');assert.ok(!value.files);
 assert.ok(Buffer.byteLength(r.stdout)<=12*1024);
 const many=retrieve({query:'八字 贵人 胎元 旬空 小运 司令 纳音',limit:10});
 assert.equal(many.matches.length,10);assert.ok(Buffer.byteLength(JSON.stringify(many))<=12*1024);
});

test('current product labels and counts are consistent while independent versions are retained',()=>{
 const p=require('../package.json'),m=require('../rikkahub-manifest.json');
 assert.match(p.version,/^\d+\.\d+\.\d+$/);assert.equal(catalog.introduced_in,'1.4.6');assert.equal(m.package_version,p.version);assert.equal(m.workflow.version,p.version);
 for(const name of ['SKILL.md','使用说明.md','手机安装说明.md','最新版本说明.md'])assert.ok((read(name).match(/^# .+$/m)?.[0]??'').includes('V'+p.version),name);
 for(const name of ['references/knowledge-index.md','references/romance-index.md','references/spirit-library-index.md','手机安装说明.md'])assert.match(read(name),/131主题/);
 assert.doesNotMatch(read('THIRD-PARTY-NOTICES.md'),/^## [vV]?\d+(?:\.\d+)*\s*/m);
 assert.doesNotMatch(read('references/bazi-theory-audit.md'),/V6(?:\.1)? /);
 assert.doesNotMatch(read('references/knowledge/curated/cards/kb-dayun-natal-relations.md'),/V1\.1\.1 的 dayun/);
 assert.deepEqual(p.dependencies,{iztro:'2.6.1','lunar-typescript':'1.8.6','@js-temporal/polyfill':'0.5.1'});
 assert.equal(m.workflow.professional_bazi.rule_version,rules.version);
 assert.equal(m.bazi_detail_library.topics,24);assert.equal(m.folklore_library.total_searchable_topics,131);
 assert.equal(m.knowledge_revision,'bazi-detail-interpretation/1');
});

test('large development fixtures remain in source and installation guidance has no development-only link',()=>{
 for(const name of ['noaa-solar-fixtures','sxtwl-bazi-fixtures','cross-check-results'])assert.ok(JSON.parse(read('references/verification/'+name+'.json')));
 assert.doesNotMatch(read('使用说明.md'),/\]\(DEVELOPMENT\.md\)|\]\(验证记录\.md\)/);
 assert.match(read('references/true-solar-time.md'),/源码包references\/verification/);
 assert.match(read('references/bazi-detail-index.md'),/原107主题保留/);
 assert.match(read('SKILL.md'),/细盘释义/);
 const old='V1.1.1 的 dayun 提供显干、藏干十神、四柱关系和日支关系。';
 assert.equal(require('../tools/style-review.cjs').rewriteText(old),'本程序的 dayun 提供显干、藏干十神、四柱关系和日支关系。');
});
