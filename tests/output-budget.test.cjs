'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const budget=require('../scripts/output-budget.cjs'),core=require('../scripts/runtime-core.cjs'),flow=require('../scripts/workflow.cjs'),partner=require('../scripts/partner-search-workflow.cjs');
const knowledge=require('../scripts/knowledge.cjs'),kc=require('../scripts/knowledge-context.cjs'),sw=require('../scripts/shuwen.cjs'),sc=require('../scripts/shuwen-context.cjs');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-budget-'));
test.after(()=>{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));fs.rmSync(tmp,{recursive:true,force:true});});
const fixture=name=>JSON.parse(fs.readFileSync(path.join(root,'examples',name),'utf8'));
function bounded(value,max){
 const stdout=JSON.stringify(value)+'\n',outer=JSON.stringify({exitCode:0,stdout,stderr:'',timedOut:false});
 assert.deepEqual(JSON.parse(JSON.parse(outer).stdout),JSON.parse(JSON.stringify(value)));
 assert.ok(Buffer.byteLength(stdout)<=max,'raw stdout exceeds budget');assert.ok(Buffer.byteLength(outer)<28*1024,'full shell envelope exceeds budget');
 if(value.output)assert.equal(value.output.bytes,Buffer.byteLength(stdout));
 return value;
}
function shell(argv,input){
 const sh=process.env.SUANMING_TEST_SH||'sh',env={...process.env},prior=process.env.PATH||process.env.Path||'';
 for(const key of Object.keys(env))if(key.toUpperCase()==='PATH')delete env[key];env.PATH=[path.dirname(process.execPath),...(path.isAbsolute(sh)?[path.dirname(sh)]:[]),prior].join(path.delimiter);
 const p=s=>process.platform==='win32'&&/^[a-z]:[\\/]/i.test(s)?s.replaceAll('\\','/'):s;
 const r=cp.spawnSync(sh,[p(path.join(root,'scripts/mobile.sh')),...argv.map(p)],{encoding:'utf8',input:input===undefined?undefined:JSON.stringify(input),cwd:tmp,env,timeout:30000,maxBuffer:256*1024});
 assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return bounded(JSON.parse(r.stdout),argv.includes('--knowledge')||argv.includes('--shuwen')?12*1024:20*1024);
}
function captured(fn){const log=console.log;console.log=()=>{};try{return fn();}finally{console.log=log;}}
const bigDocument=()=>({mode:'shuwen',purpose:'custom',title:'题'.repeat(80),recipient:'对'.repeat(300),occasion:'事'.repeat(300),offerings:'物'.repeat(300),
 applicants:Array.from({length:20},()=>({name:'名'.repeat(120),role:'称'.repeat(120),birth_text:'时'.repeat(120),residence:'居'.repeat(300)})),
 body_text:'甲"\\\n'.repeat(1000),petition:'愿'.repeat(1500),commitment:'诺'.repeat(1500),date:{calendar:'text',text:'日'.repeat(120)}});

test('shared measurement includes the real full shell envelope and trailing stdout newline',()=>{
 const value={text:'中文 😀 "quoted" \\path\nline\tend'};
 const stdout=JSON.stringify(value)+'\n',expected=JSON.stringify({exitCode:0,stdout,stderr:'',timedOut:false});
 assert.deepEqual(budget.measure(value),{stdout_bytes:Buffer.byteLength(stdout),shell_bytes:Buffer.byteLength(expected)});
 assert.ok(budget.measure(value).shell_bytes>Buffer.byteLength(JSON.stringify({stdout})));
});
test('raw JSON alone can fit while escaped wrapper does not; failure is closed, not a sliced JSON',()=>{
 const value={text:'\\'.repeat(7500)};assert.ok(budget.measure(value).stdout_bytes<20*1024);assert.ok(budget.measure(value).shell_bytes>28*1024);
 assert.equal(budget.fits(value,20*1024),false);assert.throws(()=>budget.assertFits(value,20*1024),e=>e.code==='context_budget_exceeded');assert.equal(value.text.length,7500);
});
test('raw and escaped boundary reserves cover the post-cleanup marker and output byte restamp',()=>{
 for(const symbol of ['中','\\','"','😀']){
  let low=0,high=25000;
  while(low<high){const mid=Math.ceil((low+high)/2),r=budget.stamp({text:symbol.repeat(mid),output:{bytes:0}});if(budget.fits(r,20*1024,128))low=mid;else high=mid-1;}
  const pre=budget.stamp({text:symbol.repeat(low),output:{bytes:0}});assert.ok(budget.fits(pre,20*1024,128));
  const final=budget.stamp({...pre,temporary_input_removed:true});bounded(budget.assertFits(final,20*1024),20*1024);
 }
});
for(const [name,overrides,focuses] of [
 ['input.json',{mode:'both'},['core','career','wealth','annual','relationship','age_relation','partner_image','intimacy']],
 ['input.json',{mode:'bazi'},['core','annual']],['input.json',{mode:'ziwei'},['core','annual']],
 ['relationship-single-input.json',{},['relationship','age_relation','partner_image','intimacy']],
 ['relationship-pair-input.json',{},['core','relationship','intimacy','annual']],
 ['time-compare-candidates-input.json',{},['time_compare','relationship']],['liuyao-input.json',{},['divination']]
])test('all focus outputs stay bounded with escaped long paths: '+name+' '+(overrides.mode||''),()=>{
 const data=core.buildAndValidate({...fixture(name),...overrides}).data,before=core.hash(data);
 const dir='C:\\workspace\\中 文 "quoted" \\'+"'"+'x'.repeat(150),base={ok:true,files:{chart:dir+'\\chart.json',context:dir+'\\context.json',validation:dir+'\\validation.json'}};
 for(const focus of focuses){const r=flow.boundedResponse(base,data,{focus,limit:10});bounded(r,20*1024);assert.ok(r.output.effective_limit>=1&&r.output.effective_limit<=10);assert.ok(r.context.interpretation_rules.length);}
 assert.equal(core.hash(data),before);
});
for(const mode of ['years','dates','people'])test('partner '+mode+' pages preserve every candidate under the full shell budget',()=>{
 const data=require('../scripts/partner-search.cjs').build(fixture('partner-search/'+mode+'.json')),before=core.hash(data),ids=[];
 const dir='C:\\workspace\\候选 "quoted"\\'+'x'.repeat(130),base={ok:true,files:{chart:dir+'\\chart.json',context:dir+'\\context.json',validation:dir+'\\validation.json'}};
 let offset=0,pages=0;
 for(;;){const r=bounded(partner.boundedResponse(base,data,{offset,limit:10}),20*1024);ids.push(...r.context.candidates.items.map(c=>c.id));assert.ok(++pages<=100);
  const next=r.next_actions.find(a=>a.action==='reuse');if(!next)break;assert.ok(next.argv.includes('--partner-search'));assert.equal(next.offset,r.context.candidates.next_offset);offset=next.offset;}
 assert.deepEqual(ids,data.candidates.map(c=>c.id));assert.equal(core.hash(data),before);
});
for(const [label,args,input] of [
 ['ordinary',[],()=>fixture('input.json')],['relationship',['--focus','relationship'],()=>fixture('relationship-pair-input.json')],
 ['partner',['--partner-search'],()=>fixture('partner-search/years.json')]
])test('real mobile '+label+' final cleanup metadata fits and matches the published context byte-for-byte',()=>{
 const p=path.join(tmp,label+'-input.json'),dir=path.join(tmp,label+'-long-path '+"quoted-'"+'x'.repeat(65));fs.writeFileSync(p,JSON.stringify(input()));
 const r=shell(['--agent','--temp-input',p,...args,'--out',dir]);assert.equal(r.temporary_input_removed,true);assert.equal(fs.existsSync(p),false);
 assert.equal(fs.readFileSync(r.files.context,'utf8'),JSON.stringify(r)+'\n');assert.equal(fs.existsSync(path.join(dir,'.suanming-task.lock')),false);
});
test('all 103 knowledge topics retain bounded source-aware first pages',()=>{
 const topics=['knowledge/supe888-bazi-skills/manifest.json','folklore/catalog.json',...['curated','practice','spirit','bazi-concepts','liuyao-concepts'].map(n=>'knowledge/'+n+'/catalog.json')].flatMap(file=>JSON.parse(fs.readFileSync(path.join(root,'references',file),'utf8')).topics);assert.equal(topics.length,103);
 for(const topic of topics){const r=bounded(kc.retrieve({topic:topic.slug,chars:1800}),12*1024);assert.equal(r.topic.instruction_authority,'none');assert.equal(r.topic.sha256,topic.sha256);}
});
test('knowledge CLI checks its final response after temporary query cleanup without leaving files',()=>{
 const p=path.join(tmp,'query-input.json');fs.writeFileSync(p,JSON.stringify({query:'六爻用神怎么取',limit:3}));
 const r=shell(['--knowledge','--temp-input',p]);assert.equal(r.temporary_input_removed,true);assert.equal(fs.existsSync(p),false);assert.equal(r.matches[0].slug,'liuyao-use-god');
});
test('workflow, partner and knowledge each enforce their budget after input cleanup',()=>{
 const original=budget.assertFits,seen=[];
 try{
  budget.assertFits=(r,max,...rest)=>{if(r.temporary_input_removed)seen.push({max,context:!!r.context});return original(r,max,...rest);};
  for(const [label,operation,input,args] of [
   ['final-chart',flow.operation,fixture('input.json'),[]],['final-partner',partner.operation,fixture('partner-search/years.json'),[]],
   ['final-knowledge',a=>captured(()=>kc.main(a)),{query:'喜用神'},null]
  ]){const p=path.join(tmp,label+'-input.json');fs.writeFileSync(p,JSON.stringify(input));operation(['--temp-input',p,...(args?['--out',path.join(tmp,label),...args]:[])]);}
 }finally{budget.assertFits=original;}
 assert.deepEqual(seen,[{max:20*1024,context:true},{max:20*1024,context:true},{max:12*1024,context:false}]);
});
test('maximum legal shuwen no longer needs to emit its duplicated 32KB-plus complete payload',()=>{
 const data=sw.build(bigDocument());assert.ok(budget.measure(data).stdout_bytes>32*1024);assert.ok(budget.measure(data).shell_bytes>32*1024);
 const page=bounded(sc.project(data,{chars:3000}),12*1024);assert.equal(page.schema_version,'suanming-shuwen-context/v1');assert.equal(page.parts,undefined);assert.equal(page.document_schema_version,data.schema_version);
 assert.ok(page.text_page.next_offset);assert.deepEqual(page.calendar,data.calendar);assert.deepEqual(page.provenance,data.provenance);assert.deepEqual(page.missing_fields,data.missing_fields);
});
test('real mobile maximum shuwen pages reassemble the exact complete document using only returned argv',()=>{
 const input=bigDocument(),expected=sw.build(input);let r=shell(['--shuwen','--stdin','--bounded','--chars','3000'],input),text='',pages=0,checksum=r.document_sha256;
 for(;;){assert.equal(r.document_sha256,checksum);assert.equal(r.saved,false);assert.deepEqual(r.files,[]);assert.equal(r.text_page.offset,text.length);text+=r.text;assert.ok(++pages<=30);
  const next=r.next_actions[0];if(!next)break;assert.equal(next.requires_same_input,true);assert.ok(!next.argv.includes('--out'));assert.ok(!next.argv.includes('--input'));r=shell(next.argv,input);}
 assert.equal(text,expected.text);assert.equal(text.length,r.text_page.total_chars);
});
test('shuwen paging respects surrogate pairs, exact offsets and partial-view identity',()=>{
 const data=sw.build({mode:'shuwen',purpose:'custom',body_text:'甲😀'.repeat(1000)});let offset=0,text='',first;
 for(;;){const r=bounded(sc.project(data,{offset,chars:201}),12*1024);first??=r;assert.equal(r.document_sha256,first.document_sha256);assert.ok(!/[\uDC00-\uDFFF]/.test(r.text[0]));assert.ok(!/[\uD800-\uDBFF]/.test(r.text.at(-1)));text+=r.text;
  if(r.text_page.next_offset===null)break;offset=r.text_page.next_offset;}
 assert.equal(text,data.text);const surrogate=[...data.text.matchAll(/😀/g)][0].index;
 assert.throws(()=>sc.project(data,{offset:surrogate+1}),/Unicode/);assert.throws(()=>sc.project(data,{offset:data.text.length+1}),/范围/);
 assert.throws(()=>sc.project(data,{chars:199}),/200/);const end=sc.project(data,{offset:data.text.length});assert.equal(end.text,'');assert.equal(end.text_page.next_offset,null);
 assert.notEqual(sc.project(sw.build({mode:'shuwen',purpose:'custom',body_text:'改稿'})).document_sha256,first.document_sha256);
});
test('shuwen automatically narrows its text window, but never drops essential metadata',()=>{
 const data=sw.build(bigDocument());data.files=['/workspace/'+"\\\"".repeat(500)+'/shuwen.txt'];const r=bounded(sc.project(data,{chars:3000}),12*1024);
 assert.equal(r.output.budget_adjusted,true);assert.ok(r.output.effective_chars<3000);assert.deepEqual(r.files,data.files);assert.deepEqual(r.missing_fields,data.missing_fields);
 const huge={...data,files:['/workspace/'+"\\\"".repeat(10000)]};assert.throws(()=>sc.project(huge),e=>e.code==='context_budget_exceeded');
});
test('bounded exports remain byte-identical complete TXT and vertical HTML, not just the current page',()=>{
 const input=bigDocument(),expected=sw.build(input),dir=path.join(tmp,'complete-document');
 const first=shell(['--shuwen','--stdin','--bounded','--out',dir,'--format','both','--layout','vertical'],input);
 assert.equal(first.saved,true);assert.equal(first.layout,'vertical');assert.ok(first.text.length<expected.text.length);
 assert.equal(fs.readFileSync(path.join(dir,'shuwen.txt'),'utf8'),expected.text);assert.equal(fs.readFileSync(path.join(dir,'shuwen.html'),'utf8'),sw.makeHtml(expected,'vertical'));
 const before=first.files.map(f=>fs.readFileSync(f));const next=shell(first.next_actions[0].argv,input);assert.equal(next.document_sha256,first.document_sha256);assert.deepEqual(first.files.map(f=>fs.readFileSync(f)),before);
 assert.deepEqual(fs.readdirSync(dir).sort(),['shuwen.html','shuwen.txt']);
});
test('legacy full shuwen CLI still returns text and parts exactly as before',()=>{
 const p=path.join(tmp,'legacy-saved-input.json'),input=bigDocument();fs.writeFileSync(p,JSON.stringify(input));
 const result=captured(()=>sw.main(['--input',p]));assert.deepEqual(result,sw.build(input));assert.ok(result.parts.length);assert.ok(fs.existsSync(p));assert.ok(budget.measure(result).stdout_bytes>32*1024);
});
test('bounded shuwen keeps draft fields, lifecycle cleanup and invalid-argument failures',()=>{
 for(const input of [{mode:'shuwen',purpose:'custom'},'{broken',{mode:'shuwen',purpose:'peace',date:{calendar:'solar',date:'2024-02-30'}}]){
  const p=path.join(tmp,'bounded-input.json');fs.writeFileSync(p,typeof input==='string'?input:JSON.stringify(input));
  if(input.purpose==='custom'){const r=bounded(captured(()=>sw.main(['--temp-input',p,'--bounded'])),12*1024);assert.equal(r.status,'draft');assert.ok(r.missing_fields.length);assert.equal(r.temporary_input_removed,true);}
  else assert.throws(()=>captured(()=>sw.main(['--temp-input',p,'--bounded'])));
  assert.equal(fs.existsSync(p),false);
 }
 for(const extra of [['--bounded'],['--chars','200','--chars','300'],['--offset','1.2'],['--chars','3001'],['--unknown','x']]){
  const p=path.join(tmp,'bounded-input.json');fs.writeFileSync(p,JSON.stringify({mode:'shuwen',purpose:'peace'}));assert.throws(()=>captured(()=>sw.main(['--temp-input',p,'--bounded',...extra])));assert.equal(fs.existsSync(p),false);
 }
});
test('a missing bounded-only dependency still cleans the explicitly handed input and emits no success',()=>{
 const dir=path.join(tmp,'isolated'),scripts=path.join(dir,'scripts');fs.mkdirSync(scripts,{recursive:true});
 for(const name of ['shuwen.cjs','input-lifecycle.cjs','shuwen-context.cjs'])fs.copyFileSync(path.join(root,'scripts',name),path.join(scripts,name));
 const p=path.join(tmp,'missing-dependency-input.json');fs.writeFileSync(p,JSON.stringify({mode:'shuwen',purpose:'peace'}));
 const result=cp.spawnSync(process.execPath,[path.join(scripts,'shuwen.cjs'),'--temp-input',p,'--bounded'],{encoding:'utf8',cwd:tmp,timeout:30000});
 assert.ifError(result.error);assert.equal(result.status,2);assert.equal(result.stdout,'');assert.equal(JSON.parse(result.stderr).ok,false);assert.equal(fs.existsSync(p),false);
});
test('prompt owners stay concise while routing, source authority, paging and boundaries remain',()=>{
 const skill=fs.readFileSync(path.join(root,'SKILL.md'),'utf8'),guide=fs.readFileSync(path.join(root,'references/agent-workflow-guide.md'),'utf8'),persona=fs.readFileSync(path.join(root,'RikkaHub可选系统提示词.txt'),'utf8');
 for(const text of [skill,guide,persona])assert.ok(Buffer.byteLength(JSON.stringify({text}))<28*1024);
 assert.ok(Buffer.byteLength(guide)<7500);assert.ok(Buffer.byteLength(persona)<1250);
 for(const pattern of [/partner-search 必须指定 --out/,/--shuwen --stdin --bounded/,/interpretation_rules/,/不eval/,/comparison/,/untrusted_reference_text/,/性取向/,/gender是传统排运参数，亲密互动与房中文献按来源讨论，候选生辰是假设条件枚举，不认证唯一正缘或概率/,/107主题/,/不承诺完全离线/])assert.match(skill,pattern);
 assert.ok(!persona.includes('validation.ok'));assert.ok(!persona.includes('--reuse'));assert.match(persona,/统一遵循技能/);
});
