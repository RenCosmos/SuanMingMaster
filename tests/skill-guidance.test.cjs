'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const flow=require('../scripts/workflow.cjs'),{FOCUSES}=require('../scripts/context.cjs');
const currentDocs=['SKILL.md',...fs.readdirSync(path.join(root,'references')).filter(p=>p.endsWith('.md')&&!/^(feedback-|release-)/.test(p)).map(p=>'references/'+p)];

test('current instruction links resolve and do not route into historical feedback or releases',()=>{
 for(const file of currentDocs){
  for(const m of read(file).matchAll(/\]\(([^)]+)\)/g)){
   let target=m[1].trim().replace(/^<|>$/g,'');
   if(/^[a-z][a-z0-9+.-]*:/i.test(target)||target.startsWith('#'))continue;
   target=target.split('#')[0];if(!target)continue;
   const resolved=path.resolve(root,path.dirname(file),decodeURIComponent(target));
   assert.ok(fs.existsSync(resolved),file+' links to missing '+target);
   if(resolved.endsWith('.md'))assert.doesNotMatch(path.basename(resolved),/^(feedback-|release-v)/,file+' routes to historical instructions');
  }
 }
});

test('advertised ordinary, time comparison and cross-evidence commands parse with the real workflow',()=>{
 for(const file of ['SKILL.md','references/time-compare-method.md','references/pagination-guide.md']){
  const matches=[...read(file).matchAll(/^sh \/skills\/bazi-ziwei\/scripts\/mobile\.sh (.+)$/gm)];
  assert.ok(matches.length,file+' must advertise an executable entry');
  for(const m of matches){
   const argv=m[1].split(/\s+<</)[0].trim().split(/\s+/);const parsed=flow.parse(argv);
   assert.ok(parsed.reuse||parsed.stdin&&parsed.out,file+' has no input route');
   if(parsed.comparison){assert.equal(parsed.focus,'relationship');assert.equal(parsed.brief,true);}
  }
 }
});

test('main routing uses supported focus names and contains no obsolete increment instructions',()=>{
 const skill=read('SKILL.md');
 for(const m of skill.matchAll(/--focus ([a-z_]+(?:\/[a-z_]+)*)/g))for(const focus of m[1].split('/'))assert.ok(FOCUSES.includes(focus),'Unknown focus '+focus);
 for(const file of currentDocs)assert.doesNotMatch(read(file),/^> V\d+\.\d+\.\d+ 日常执行以 SKILL\.md/gm,file);
 assert.ok(skill.includes('gender是传统排运参数，亲密互动与房中文献按来源讨论，候选生辰是假设条件枚举，不认证唯一正缘或概率'));
});

test('release templates use the current release dynamically while fixture deletion is explicit',()=>{
 const version=JSON.parse(read('package.json')).version;
 assert.ok(read('SKILL.md').includes('V'+version));
 for(const file of ['tools/README.template.md','tools/verification-record.template.md']){
  assert.ok(read(file).includes('references/release-v{version}.md'));
  assert.doesNotMatch(read(file),/references\/release-v\d+\.\d+\.\d+\.md/);
 }
 assert.equal(fs.existsSync(path.join(root,'tools/baselines/bazi-ziwei-rikkahub-v1.2.5.zip')),false);
 for(const retained of ['1.2.4','1.3.0'])assert.ok(fs.existsSync(path.join(root,'tools/baselines/bazi-ziwei-rikkahub-v'+retained+'.zip')));
});
