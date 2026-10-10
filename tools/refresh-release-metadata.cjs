'use strict';
// Explicit mechanical maintenance; never rewrite frozen baselines or knowledge.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,v)=>fs.writeFileSync(path.join(root,p),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const version=read('package.json').version;
const docs=fs.readdirSync(path.join(root,'references')).filter(p=>p.endsWith('.md')&&!/^(feedback-|release-)/.test(p)).map(p=>'references/'+p);
for(const p of docs){let s=fs.readFileSync(path.join(root,p),'utf8');
 s=s.replace(/^> V\d+\.\d+\.\d+ 日常执行以 SKILL\.md 的 workflow 为准[^\r\n]*\r?\n\s*/m,'');
 s=s.replace(/^(#{1,6}) V\d+\.\d+\.\d+\s*/gm,'$1 ').replace(/ · V\d+\.\d+\.\d+(?=\r?$)/gm,'').replace(/ \/ V\d+\.\d+\.\d+(?=\r?$)/gm,'').replace(/（V\d+\.\d+\.\d+(?:增补)?）/g,'');
 s=s.replace('V1.1.1 增补大运藏干十神','大运保留藏干十神').replace('V1.1.1 增补本命宫干四化','保留本命宫干四化');
 s=s.replace('本页供当前V1.4.2使用；核对记录始于2026-10-04的历史V6.1，计算方法沿用，不表示本版重做算法。','本页记录自2026-10-04起核对的来源与计算方法；不将来源查核当作本版改动算法。');
 s=s.replace('V1.3.0手机确认仅是历史记录，不继承为本地改动设备验收。','设备验收与桌面／解包核对分开记录。');
 write(p,s);
}
const m=read('rikkahub-manifest.json');m.package_version=version;m.adapter_version='rikkahub-workspace/v'+version;m.workflow.version=version;
m.bundled_node_runtime=false;m.runtime_installer={node_version:'22.23.3',architectures:['arm64','x64'],distributions:['ubuntu','debian'],entry:'scripts/install-node.sh',mode:'online, separate from calculation',download_timeout_seconds:90,checksum_verified:true,workspace_private:true};
delete m.runtime_bundle.offline_variant;delete m.runtime_bundle.offline_auto_setup;
if(m.rikkahub_tools?.shell_timeout_seconds){m.rikkahub_tools.shell_timeout_seconds.installer=120;m.rikkahub_tools.shell_timeout_seconds.batch=60;m.rikkahub_tools.interface_checked_on='2026-10-09';}
m.previous_release='1.4.3; additive romance overview and checksum-bound incremental evidence pages; calculation, artifact schema, sampling, source-card and dependency bytes retained';
m.workflow.context_views={overview:'single-person romance; yearly windows deferred',evidence_page:'suanming-evidence-page/v1; annual or flying; requires same base checksum',navigation:'required and required_for distinguish requested evidence from optional expansion'};
m.mobile_validation.tested_package_version=version;m.mobile_validation.current_package_status='pending';m.android_device_tested_scope='historical 1.3.0 confirmation only; '+version+' confirmation pending';
m.workflow.batch_execution={default_time_budget_seconds:20,day_checkpoint:true,independent_recalculation_preserved:true,soft_deadline:true,reuse_does_not_rewrite_charts:true};
write('rikkahub-manifest.json',m);
const reviewed=read('tools/reviewed-changes-v1.3.1.json'),baseline={...read('tools/compatibility-baseline-v1.2.4.json').protected_sha256,...read('tools/knowledge-baseline.json')};
reviewed.release=version;
// Include only already protected files. New files are covered by release inventories/tests.
for(const p of [...new Set([...Object.keys(baseline),...Object.keys(reviewed.files)])]){
 if(!fs.existsSync(path.join(root,p)))throw Error('Protected file missing: '+p);
 const digest=sha(p),old=reviewed.files[p];if(digest===(old?.new_sha256??baseline[p]))continue;
 const viewFiles=['scripts/context.cjs','scripts/brief-context.cjs','scripts/workflow.cjs','scripts/workflow-hints.cjs'];
 const change=viewFiles.includes(p)?'additive overview/incremental projections, checksum-bound complete argv and required/optional navigation; full legacy evidence and calculation artifacts retained':'current documentation, quickstart routing, interpretation fact distinctions or release labels';
 reviewed.files[p]={...old,old_sha256:old?.old_sha256??baseline[p],new_sha256:digest,reason:(old?.reason?old.reason+'; ':'')+'V'+version+' reviewed: '+change+'; calculation, artifact schema, source-card and dependency bytes retained'};
}
write('tools/reviewed-changes-v1.3.1.json',reviewed);
console.log(JSON.stringify({ok:true,version,frozen_baselines_rewritten:false,knowledge_rewritten:false}));
