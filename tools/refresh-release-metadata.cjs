'use strict';
// Explicit mechanical maintenance; never rewrite frozen baselines or substantive knowledge.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,v)=>fs.writeFileSync(path.join(root,p),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const version=read('package.json').version;
const docs=fs.readdirSync(path.join(root,'references')).filter(p=>p.endsWith('.md')&&!/^(feedback-|release-)/.test(p)).map(p=>'references/'+p);
for(const p of docs){let s=fs.readFileSync(path.join(root,p),'utf8');
 s=s.replace(/^> V\d+\.\d+\.\d+ 日常执行以 SKILL\.md 的 workflow 为准[^\r\n]*\r?\n\s*/m,'');
 s=s.replace(/^(#{1,6}) V\d+\.\d+\.\d+\s*/gm,'$1 ').replace(/ · V\d+\.\d+\.\d+(?=\r?$)/gm,'').replace(/ \/ V\d+\.\d+\.\d+(?=\r?$)/gm,'').replace(/（V\d+\.\d+\.\d+(?:增补)?）/g,'');
 s=s.replace('V1.1.1 增补大运藏干十神','大运保留藏干十神').replace('V1.1.1 增补本命宫干四化','保留本命宫干四化').replaceAll('V6.1 实现与核对','现行实现与核对').replaceAll('V6 默认 midnight 日界','默认 midnight 日界');
 s=s.replace('本页供当前V1.4.2使用；核对记录始于2026-10-04的历史V6.1，计算方法沿用，不表示本版重做算法。','本页记录自2026-10-04起核对的来源与计算方法；不将来源查核当作本版改动算法。');
 s=s.replace('V1.3.0手机确认仅是历史记录，不继承为本地改动设备验收。','设备验收与桌面／解包核对分开记录。');
 s=s.replace(/(?<!原)107主题/g,'131主题');
 write(p,s);
}
const m=read('rikkahub-manifest.json');m.package_version=version;m.adapter_version='rikkahub-workspace/v'+version;m.workflow.version=version;
const knowledge=read('references/knowledge/bazi-detail/catalog.json');m.knowledge_revision='bazi-detail-interpretation/1';m.folklore_library.total_searchable_topics=107+knowledge.topics.length;
m.bazi_detail_library={version:knowledge.version,topics:knowledge.topics.length,index:'references/bazi-detail-index.md',catalog:'references/knowledge/bazi-detail/catalog.json',automatic_chart_for_knowledge_questions:false,calculation_rules_unchanged:true};
m.bundled_node_runtime=false;m.runtime_installer={node_version:'22.23.3',architectures:['arm64','x64'],distributions:['ubuntu','debian'],entry:'scripts/install-node.sh',mode:'online, separate from calculation',download_timeout_seconds:90,checksum_verified:true,workspace_private:true};
delete m.runtime_bundle.offline_variant;delete m.runtime_bundle.offline_auto_setup;
if(m.rikkahub_tools?.shell_timeout_seconds){m.rikkahub_tools.shell_timeout_seconds.installer=120;m.rikkahub_tools.shell_timeout_seconds.batch=60;m.rikkahub_tools.interface_checked_on='2026-10-09';}
m.previous_release='1.4.5; adds 24 sourced professional-detail interpretation cards and term aliases; consistent product labels and runtime/source packaging split; all existing calculations and source material retained';
m.workflow.context_views={overview:'single-person romance; yearly windows deferred',evidence_page:'suanming-evidence-page/v1 annual/flying or suanming-ten-god-evidence/v1; requires same base checksum',pair_evidence:'suanming-pair-evidence/v1; two verified saved single-person sources, stable pillars only, pair_key-bound pages; no invented hour or source rewrite',navigation:'required and required_for distinguish requested evidence from optional expansion'};
m.workflow.evidence_audit={revision:'origin-labels/1',annual_and_initial_stem_visibility:true,expression_stem_visibility:true,day_master_self_marked:true,cross_group_natal_owners:true,single_candidate_not_stable:true,candidate_incremental_pages:'parent checksum and candidate bound; no repeated natal evidence'};
m.workflow.professional_bazi={rule_version:'bazi-professional/1.0.0',pages:['bazi-detail','bazi-periods'],method:'references/bazi-detail-method.md',schema:'references/bazi-detail-context.schema.json',opt_in_only:true,report:'bazi-detail --report',source_artifacts_unchanged:true,shensha_rules:14,month_commander:'SM-SILING-30; explicit original table and exact Jie intervals'};
m.mobile_validation.tested_package_version=version;m.mobile_validation.current_package_status='pending';m.android_device_tested_scope='historical 1.3.0 confirmation only; '+version+' confirmation pending';
m.workflow.batch_execution={default_time_budget_seconds:20,day_checkpoint:true,independent_recalculation_preserved:true,soft_deadline:true,reuse_does_not_rewrite_charts:true};
write('rikkahub-manifest.json',m);
// Only product headings and current guide counts change; historical introduction
// metadata, citations, engine/dependency versions and old release files stay intact.
for(const p of ['SKILL.md','使用说明.md','手机安装说明.md','DEVELOPMENT.md','最新版本说明.md','references/knowledge-index.md','references/bazi-concepts-index.md']){
 if(!fs.existsSync(path.join(root,p)))continue;let s=fs.readFileSync(path.join(root,p),'utf8');
 s=s.replace(/(?<=^# [^\r\n]*)V\d+\.\d+\.\d+/m,'V'+version).replaceAll('bazi-ziwei-rikkahub-v1.4.5.zip','bazi-ziwei-rikkahub-v'+version+'.zip').replaceAll('releases/v1.4.5','releases/v'+version).replaceAll('references/release-v1.4.5.md','references/release-v'+version+'.md').replaceAll('107主题知识库','131主题知识库').replaceAll('当前107主题','当前131主题');
 write(p,s);
}
let notices=fs.readFileSync(path.join(root,'THIRD-PARTY-NOTICES.md'),'utf8');
notices=notices.replace(/^## (?:[vV]?\d+(?:\.\d+){0,2})\s*(.+)$/gm,'## $1').replace(/^(## [^\r\n]+)（v\d+）$/gm,'$1').replace('本文件 0.5.1 说明','本文件“知识文本改编”说明');
write('THIRD-PARTY-NOTICES.md',notices);
const curated=read('references/knowledge/curated/catalog.json'),card='references/knowledge/curated/cards/kb-dayun-natal-relations.md';
curated.topics.find(t=>t.slug==='kb-dayun-natal-relations').sha256=sha(card);write('references/knowledge/curated/catalog.json',curated);
const reviewed=read('tools/reviewed-changes-v1.3.1.json'),baseline={...read('tools/compatibility-baseline-v1.2.4.json').protected_sha256,...read('tools/knowledge-baseline.json')};
reviewed.release=version;
// Include only already protected files. New files are covered by release inventories/tests.
for(const p of [...new Set([...Object.keys(baseline),...Object.keys(reviewed.files)])]){
 if(!fs.existsSync(path.join(root,p)))throw Error('Protected file missing: '+p);
 const digest=sha(p),old=reviewed.files[p];if(digest===(old?.new_sha256??baseline[p]))continue;
 const viewFiles=['scripts/context.cjs','scripts/brief-context.cjs','scripts/workflow.cjs','scripts/workflow-hints.cjs','scripts/evidence-context.cjs','scripts/input-lifecycle.cjs','scripts/mobile.sh','scripts/relationship-romance.cjs'];
 const change=p===card?'exact historical-label correction V1.1.1 的 dayun -> 本程序的 dayun only; all interpretation text retained':p==='references/knowledge/curated/catalog.json'?'SHA update for the single reviewed historical-label correction; all topic metadata and other card bytes retained':viewFiles.includes(p)?'additive professional detail navigation; calculation artifacts retained':['scripts/knowledge.cjs','scripts/knowledge-context.cjs','scripts/knowledge-search.cjs','scripts/critical-checks.cjs'].includes(p)?'additive 24-card sourced interpretation library, aliases, program-field provenance and structural count checks; all old topics and domain filtering preserved':'current product labels, non-operational historical heading cleanup, sourced card routing and runtime/source packaging documentation';
 reviewed.files[p]={...old,old_sha256:old?.old_sha256??baseline[p],new_sha256:digest,reason:(old?.reason?old.reason+'; ':'')+'V'+version+' reviewed: '+change+'; calculation, artifact schema, all other source-card and dependency bytes retained'};
}
write('tools/reviewed-changes-v1.3.1.json',reviewed);
console.log(JSON.stringify({ok:true,version,frozen_baselines_rewritten:false,substantive_knowledge_rewritten:false,reviewed_knowledge_label_update:true}));
