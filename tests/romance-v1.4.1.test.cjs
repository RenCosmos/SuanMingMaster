'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {modernAge,ageReading,romance}=require('../scripts/relationship-romance.cjs');
const core=require('../scripts/runtime-core.cjs'),flow=require('../scripts/workflow.cjs'),{project}=require('../scripts/context.cjs'),budget=require('../scripts/output-budget.cjs');
const root=path.resolve(__dirname,'..'),fixture=n=>JSON.parse(fs.readFileSync(path.join(root,'examples',n),'utf8'));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-romance141-'));
test.after(()=>{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));fs.rmSync(tmp,{recursive:true,force:true});});
function mock(main,other=[]){return {bazi:{chart:{pillars:[{id:'BZ-DAY',hidden_ten_gods:[main,...other]}]},calculations:{score_ledger:[]}}};}
test('modern age rules use day-branch main qi only and never invent an exact age',()=>{
 for(const [god,want] of [['伤官','younger'],['正印','older'],['偏印','older'],['正财','none']]){const a=modernAge(mock(god),'a');assert.equal(a.tendency,want);assert.equal(a.exact_age_gap,null);for(const m of a.matches){assert.equal(m.source.source_id,'BZ-DAY-H1');assert.equal(m.source_id,'REL-ZXL-AGE');assert.equal(m.evidence_kind,'modern_author_interpretation');}}
 assert.equal(modernAge(mock('正财',['伤官','正印']),'a').tendency,'none');
});
test('classical main rule stays primary, modern conflict is retained and position cannot manufacture ages',()=>{
 const classic={tendency:'younger',ziwei:{matches:[{rule_id:'CLASSIC'}]},models:[]};const c=ageReading(mock('正印'),'a','wealth',classic);assert.equal(c.tendency,'younger');assert.equal(c.modern.tendency,'older');assert.equal(c.conflict,true);assert.equal(c.basis,'ziwei_classical');
 const none={...classic,tendency:'none'};assert.equal(ageReading(mock('正印'),'a','wealth',none).tendency,'older');assert.equal(ageReading(mock('正财'),'a','wealth',none).tendency,'none');
});
test('visible conditional patterns do not pretend that counts prove strength',()=>{
 const c=mock('正财');c.bazi.calculations.score_ledger=[{id:'S1',kind:'visible_stem',ten_god:'食神'},{id:'S2',kind:'visible_stem',ten_god:'正财'}];const a=modernAge(c,'a');assert.equal(a.tendency,'none');assert.equal(a.conditional_patterns.length,1);assert.equal(a.conditional_patterns[0].strength_confirmed,false);
});
test('brief core and annual preserve every original theme evidence field, including related stars and flying',()=>{
 const d=core.buildAndValidate(fixture('input.json')).data,before=core.hash(d);
 for(const focus of ['core','career','wealth','annual','partner_image','intimacy']){const full=project(d,{focus}).reading,short=project(d,{focus,brief:true}).reading;
  if(full.ziwei?.palace_stem_flying){let offset=0,all=[];do{const page=project(d,{focus,brief:true,flying_offset:offset}).reading.ziwei.palace_stem_flying;all.push(...page.items);offset=page.next_offset;}while(offset!==null);assert.deepEqual(all,full.ziwei.palace_stem_flying);short.ziwei.palace_stem_flying=all;}assert.deepEqual(short,full,focus);}
 assert.equal(core.hash(d),before);
});
test('romance returns separate tracks, real year/day markers and actual spouse timing without changing chart',()=>{
 const d=core.buildAndValidate(fixture('relationship-single-input.json')).data,p=d.people[0],before=core.hash(d);
 const e=romance(p.chart,'a',d.profiles[0].bazi.partner_star_model);assert.ok(e.attraction.expression);assert.equal(e.commitment.spouse_palace.ganzhi,p.chart.bazi.chart.pillars[2].ganzhi);
 for(const marker of e.attraction.bazi_markers){assert.ok(['BZ-YEAR','BZ-DAY'].includes(marker.basis.source_id));assert.equal(p.chart.bazi.chart.pillars.find(x=>x.id===marker.hit.source_id).branch,marker.symbol);}
 const projected=project(d,{focus:'romance'});assert.ok(projected.reading.people[0].emotional_paths);assert.equal(core.hash(d),before);
});
test('brief relationship preserves both people and comparison or supplies complete paging actions under long paths',()=>{
 const d=core.buildAndValidate(fixture('relationship-pair-input.json')).data;
 for(const depth of [1,28]){const file=path.join(tmp,...Array(depth).fill('long-quoted-path-"'), 'chart.json');let r=flow.boundedResponse({ok:true,files:{chart:file}},d,{focus:'relationship',brief:true});assert.ok(budget.fits(r,20*1024));
  if(r.people_page){assert.equal(r.next_actions[0].person,'b');assert.ok(r.next_actions[0].argv.includes('--brief'));r=flow.boundedResponse({ok:true,files:{chart:file}},d,{focus:'relationship',brief:true,person:'b'});assert.ok(r.next_actions.some(x=>x.comparison));}
  else assert.ok(r.context.reading.comparison);
 }
});
test('romance annual argv covers all computed years and reuses the same unmodified chart',()=>{
 const raw=fixture('relationship-single-input.json');raw.target_date='2026-10-09';for(const p of raw.people)p.options={...(p.options??{}),annual_count:8};const input=path.join(tmp,'annual.json');fs.writeFileSync(input,JSON.stringify(raw));
 let r=flow.operation(['--input',input,'--out',path.join(tmp,'annual'),'--focus','romance','--brief','--limit','2']),years=[],pages=0;const bytes=fs.readFileSync(r.files.chart);
 do{pages++;assert.ok(pages<=10);const p=r.context.reading.people[0];years.push(...p.emotional_paths.timing.items.map(x=>x.year));const a=r.next_actions.find(x=>x.action==='reuse'&&x.focus==='romance'&&x.flying_offset===undefined);if(!a)break;assert.ok(a.argv.includes('--brief'));r=flow.operation(a.argv);assert.equal(r.cache_hit,true);}while(true);
 assert.equal(years.length,8);assert.equal(new Set(years).size,8);assert.deepEqual(fs.readFileSync(r.files.chart),bytes);
});
test('returned flying argv recovers every original record without annual cursor drift or chart writes',()=>{
 const raw=fixture('input.json'),input=path.join(tmp,'flying.json');fs.writeFileSync(input,JSON.stringify(raw));
 let r=flow.operation(['--input',input,'--out',path.join(tmp,'flying'),'--focus','career','--brief','--limit','3']),items=[],pages=0;const bytes=fs.readFileSync(r.files.chart),original=project(JSON.parse(bytes),{focus:'career'}).reading.ziwei.palace_stem_flying;
 do{pages++;assert.ok(pages<=50);assert.ok(budget.fits(r,20*1024));assert.equal(r.context.selection.offset,0);items.push(...r.context.reading.ziwei.palace_stem_flying.items);const action=r.next_actions.find(x=>x.purpose==='flying_page');if(!action)break;r=flow.operation(action.argv);assert.equal(r.cache_hit,true);}while(true);
 assert.deepEqual(items,original);assert.deepEqual(fs.readFileSync(r.files.chart),bytes);
});
test('time candidate romance continuations retain candidate selector and do not pass invalid person flags',()=>{
 const raw=fixture('time-compare-candidates-input.json');raw.target_date='2026-10-09';raw.birth_options={annual_count:4};raw.time_uncertainty.times=['08:30'];const input=path.join(tmp,'time-romance.json');fs.writeFileSync(input,JSON.stringify(raw));
 const r=flow.operation(['--input',input,'--out',path.join(tmp,'time-romance'),'--candidate','TC-001','--focus','romance','--limit','1']);
 for(const purpose of ['annual','flying']){const action=r.next_actions.find(x=>purpose==='flying'?x.purpose==='flying_page':x.focus==='romance'&&x.flying_offset===undefined);assert.ok(action);assert.ok(action.argv.includes('TC-001'));assert.ok(!action.argv.includes('--person'));const next=flow.operation(action.argv);assert.equal(next.ok,true);assert.equal(next.context.reading.candidate.id,'TC-001');}
});
test('current product labels follow package while independent engine and schema identities stay unchanged',()=>{
 const version=require('../package.json').version;assert.match(version,/^\d+\.\d+\.\d+$/);const m=require('../rikkahub-manifest.json');assert.equal(m.package_version,version);assert.equal(m.workflow.version,version);assert.equal(m.adapter_version,'rikkahub-workspace/v'+version);
 const d=core.buildAndValidate(fixture('input.json')).data;assert.equal(d.skill_version,'0.4.0');assert.equal(d.schema_version,'bazi-ziwei/v1');assert.ok(core.adapter(d).render(d).html.includes('V'+version+' · 引擎 v0.4.0'));assert.ok(flow.operation(['--help']).includes('--flying-offset'));
});
test('new four knowledge cards retain source identity, exact bodies and independent counts',()=>{
 const k=require('../scripts/knowledge.cjs'),{retrieve}=require('../scripts/knowledge-context.cjs'),checked=k.verifyKnowledge();assert.equal(checked.total_topics,107);assert.equal(checked.romance_topics,4);assert.equal(checked.total_topics-checked.romance_topics,103);
 for(const [query,slug] of [['露水情缘怎么看','romance-two-tracks'],['桃花和红鸾有什么区别','romance-hongkong-distinction'],['八字对象年上还是年下','romance-modern-age']]){const r=retrieve({query,limit:1});assert.equal(r.matches[0].slug,slug);assert.ok(r.matches[0].source_url);}
 for(const t of require('../references/knowledge/romance/catalog.json').topics){const r=k.lookup({topic:t.slug});assert.equal(core.sha(Buffer.from(r.content)),t.sha256);assert.equal(r.instruction_authority,'none');assert.ok(r.content.includes(t.url)||t.kind==='project_method_reference');}
});
test('ten-hit knowledge budgets preserve ranking, all matches, source records and unchanged full-text routes',()=>{
 const k=require('../scripts/knowledge.cjs'),{retrieve}=require('../scripts/knowledge-context.cjs');
 for(const input of [{query:'八字月令',limit:10},{query:'《礼记·月令》',domain:'bazi',limit:10}]){const full=k.lookup(input),bounded=retrieve(input);assert.ok(budget.fits(bounded,12*1024));assert.deepEqual(bounded.matches.map(x=>x.slug),full.matches.map(x=>x.slug));assert.equal(bounded.snippets_shortened_for_budget,true);for(const t of bounded.matches){const card=k.lookup({topic:t.slug});assert.equal(t.source_url,card.topic.url??card.topic.repository);assert.equal(t.read.topic,t.slug);assert.ok(card.content.length);}}
});
test('template migration removes only the common style block and headings, leaving source evidence restorable',()=>{
 const {BLOCK,rewriteText}=require('../tools/style-review.cjs'),baseline=require('../tools/knowledge-baseline.json');
 for(const t of require('../references/knowledge/supe888-bazi-skills/manifest.json').topics){const s=fs.readFileSync(path.join(root,t.path),'utf8');assert.ok(!s.includes('用「倾向/可能/宜/忌」'));const eol=s.includes('\r\n')?'\r\n':'\n',restored=s.replaceAll('\r\n','\n').replace('以下为术数知识与分析栏目参考；按本次问题取用，不规定回答篇幅或口吻。',BLOCK).replaceAll('\n# 知识范围\n','\n# 角色\n').replaceAll('\n# 分析项目\n','\n# 输出结构\n').replaceAll('\n',eol);assert.equal(core.sha(Buffer.from(restored)),baseline[t.path]);assert.equal(rewriteText(restored),s);}
});
test('standard runtime setup is separate from queries and never overwrites supplied Node',()=>{
 const shell=fs.readFileSync(path.join(root,'scripts/mobile.sh'),'utf8'),installer=fs.readFileSync(path.join(root,'scripts/install-node.sh'),'utf8');assert.ok(!shell.includes('--offline'));assert.ok(installer.indexOf('已有不完整的运行时目录')<installer.indexOf('curl --'));assert.ok(installer.includes('--max-time "$seconds"'));assert.ok(!shell.includes('npm install')&&!shell.includes('curl '));assert.ok(!fs.existsSync(path.join(root,'references/runtime-node.json')));
});
