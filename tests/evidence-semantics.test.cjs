'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const core=require('../scripts/runtime-core.cjs'),{project}=require('../scripts/context.cjs'),romance=require('../scripts/relationship-romance.cjs'),ten=require('../scripts/ten-god-evidence.cjs'),pair=require('../scripts/pair-evidence.cjs'),rules=require('../scripts/bazi-rules.cjs'),groups=require('../scripts/cross-relation-context.cjs'),flow=require('../scripts/workflow.cjs'),budget=require('../scripts/output-budget.cjs');
const fixture=n=>structuredClone(require('../examples/'+n)),raw={...fixture('input.json'),mode:'bazi',target_date:'2026-10-15',options:{annual_count:5}};raw.birth.date='1996-06-02';
const d=core.buildAndValidate(raw).data,rel=core.buildAndValidate(fixture('relationship-pair-input.json')).data;
const tcRaw={...fixture('time-compare-input.json'),chart_mode:'bazi',target_date:raw.target_date,time_uncertainty:{type:'candidates',times:['08:30','10:30']},birth_options:{annual_count:3}};
const tc=core.buildAndValidate(tcRaw).data,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-evidence-audit-'));
test.after(()=>{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));fs.rmSync(tmp,{recursive:true,force:true});});
function tracks(context){return context.reading.emotional_paths??context.reading.people[0].emotional_paths;}
test('all 100 observer/observed ten-god combinations match the fixed calendar dependency table',()=>{
 const reference=require('lunar-typescript').LunarUtil.SHI_SHEN;let count=0;for(const a of '甲乙丙丁戊己庚辛壬癸')for(const b of '甲乙丙丁戊己庚辛壬癸'){assert.equal(typeof reference[a+b],'string');assert.equal(rules.tenGod(a,b),reference[a+b],a+'观察'+b);count++;}assert.equal(count,100);
});
test('first brief annual timing and incremental timing have identical visible/hidden star origins',()=>{
 for(const artifact of [d,rel])for(const person of artifact.people?.map(p=>p.id)??[undefined]){
  const o={focus:'relationship',brief:true,limit:5,...(person?{person}:{})},initial=tracks(project(artifact,o)),page=tracks(project(artifact,{...o,page:'annual',base_checksum:artifact.checksum.value}));
  for(const y of initial.timing.items){const p=page.timing.items.find(x=>x.year===y.year);assert.deepEqual(p.partner_stars_visible,y.partner_stars_visible);assert.deepEqual(p.partner_stars_hidden,y.partner_stars_hidden);assert.deepEqual([...y.partner_stars_visible,...y.partner_stars_hidden].map(x=>x.ten_god),y.partner_stars);}
 }
 const y=tracks(project(d,{focus:'relationship',brief:true,limit:5})).timing.items.find(x=>x.year===2027);assert.deepEqual(y.partner_stars_visible,[]);assert.equal(y.partner_stars_hidden[0].stem,'乙');assert.equal(y.partner_stars_hidden[0].field,'hidden_stems');
});
test('all explicit partner-star models share the same first-page and continuation filtering',()=>{
 for(const model of ['wealth','authority','all']){const e=romance.romance(d,'a',model,{limit:5}),chosen=model==='wealth'?['正财','偏财']:model==='authority'?['正官','七杀']:['正财','偏财','正官','七杀'];for(const y of e.timing.items){assert.ok([...y.partner_stars_visible,...y.partner_stars_hidden].every(x=>chosen.includes(x.ten_god)));assert.deepEqual([...y.partner_stars_visible,...y.partner_stars_hidden].map(x=>x.ten_god),y.partner_stars);}}
});
test('compact expression preserves exact natal stem, pillar and visible/hidden kind, including candidates',()=>{
 const check=(e,chart)=>{for(const x of e.attraction.expression_sources){const original=chart.bazi.calculations.score_ledger.find(r=>r.id===x.source_id);assert.equal(x.ten_god,original.ten_god);assert.equal(x.stem,original.stem);assert.equal(x.kind,original.kind);assert.ok(x.source_id.startsWith(original.source+'-'));}};
 check(tracks(project(d,{focus:'relationship',brief:true})),d);assert.ok(tracks(project(d,{focus:'relationship',overview:true})).attraction.expression_sources.some(x=>x.kind==='hidden_stem'));
 const c=project(tc,{focus:'relationship',candidate:tc.candidates[0].id,brief:true});check(c.reading.reading.people[0].emotional_paths,tc.candidates[0].chart.people[0].chart);
});
test('modern age main-qi cue is explicitly hidden, never a visible-stem assertion',()=>{
 const c={bazi:{chart:{pillars:[{id:'BZ-DAY',hidden_stems:['癸'],hidden_ten_gods:['伤官']}]},calculations:{score_ledger:[]}}},m=romance.modernAge(c,'b').matches[0];assert.equal(m.stem,'癸');assert.equal(m.kind,'hidden_stem');assert.equal(m.field,'hidden_stems');assert.equal(m.index,0);assert.deepEqual(m.source,{person_id:'b',source_id:'BZ-DAY-H1'});
});
test('noncompact emotional DaYun retains aligned hidden stems as well as hidden gods',()=>{
 const e=romance.romance(d,'a','wealth'),r=e.active_dayun[0],p=d.bazi.chart.dayun.find(p=>p.id===r.id);assert.deepEqual(r.hidden_stems,p.hidden_stems);assert.deepEqual(r.hidden_ten_gods,p.hidden_ten_gods);assert.equal(r.hidden_stems.length,r.hidden_ten_gods.length);
});
test('natal day-master self is marked, without deleting it or changing original distributions',()=>{
 const before=core.hash(d);for(const focus of ['wealth','intimacy'])for(const brief of [false,true]){const c=project(d,{focus,brief}),list=c.reading.bazi.ten_god_occurrences;assert.equal(list.filter(r=>r.is_day_master_self).length,1);const self=list.find(r=>r.is_day_master_self);assert.equal(self.id,'BZ-DAY-S');if(focus==='intimacy')assert.equal(c.reading.intimacy.bazi.ten_god_occurrences.find(r=>r.source.source_id===self.id).source.source_id,self.id);}
 assert.equal(ten.describe(d).natal.known_pillars.find(p=>p.id==='BZ-DAY').visible.is_day_master_self,true);assert.equal(core.hash(d),before);
});
test('time-comparison annual variants preserve legacy facts and pair each hidden god with its actual stem',()=>{
 const before=core.hash(tc),c=project(tc,{focus:'annual',limit:5});for(const f of c.reading.fields.items)for(const v of f.variants){const original=tc.comparison.fields.find(x=>x.id===f.id).variants.find(x=>core.hash(x.candidate_ids)===core.hash(v.candidate_ids)),{hidden_stems,...old}=v.value;assert.deepEqual(old,original.value);assert.equal(hidden_stems.length,v.value.hidden_ten_gods.length);const chart=tc.candidates.find(x=>x.id===v.candidate_ids[0]).chart.people[0].chart;for(let i=0;i<hidden_stems.length;i++)assert.equal(rules.tenGod(chart.bazi.chart.day_master,hidden_stems[i]),v.value.hidden_ten_gods[i]);}assert.equal(core.hash(tc),before);
});
test('one sampled candidate, including one remaining computable candidate, is not labeled stable agreement',()=>{
 for(const partial of [false,true]){const a=structuredClone(tc);if(partial){a.candidates[1].status='unavailable';delete a.candidates[1].chart;}else a.candidates=a.candidates.slice(0,1);const info=ten.describe(a);assert.equal(info.day_master.status,'single_candidate');assert.equal(info.current_dayun.status,'single_candidate');assert.equal(info.coverage.comparison_status,'single_candidate');assert.equal(info.coverage.unavailable_count,partial?1:0);}
});
const branches=s=>[...s].map((branch,i)=>({id:['BZ-YEAR','BZ-MONTH','BZ-DAY','BZ-HOUR'][i],stem:i%2?'乙':'甲',branch}));
function cross(a,b){return rules.relations([...a.map(p=>({...p,id:'a:'+p.id})),...b.map(p=>({...p,id:'b:'+p.id}))]).filter(r=>r.pillars.some(x=>x.startsWith('a:'))&&r.pillars.some(x=>x.startsWith('b:')));}
test('cross-chart triads distinguish original complete groups from completion across two people',()=>{
 for(const [aa,bb,owners] of [['寅午戌子','午卯酉辰',['a']],['寅午子卯','戌酉辰丑',[]],['寅午戌子','寅午戌丑',['a','b']]]){const a=branches(aa),b=branches(bb),records=cross(a,b),before=core.hash(records),meta=groups.groupContext(records,{a,b}).find(r=>records.find(x=>x.id===r.relation_id).type==='三合'&&records.find(x=>x.id===r.relation_id).symbols==='寅午戌');assert.ok(meta);assert.deepEqual(meta.natal_complete_people,owners);assert.equal(meta.group_state,owners.length?'natal_already_complete':'completed_across_people');assert.equal(core.hash(records),before);}
});
test('cross-chart self-punishment requires repeated branches within a person before calling it natal',()=>{
 for(const [aa,bb,owners] of [['午午寅戌','午子卯酉',['a']],['午子寅戌','午子卯酉',[]]]){const a=branches(aa),b=branches(bb),records=cross(a,b),r=records.find(r=>r.type==='自刑（采用本规则表）'&&r.symbols==='午午'),m=groups.groupContext(records,{a,b}).find(m=>m.relation_id===r.id);assert.deepEqual(m.natal_complete_people,owners);}
});
test('normal comparison pages retain raw records and sidecars only reference the current page',()=>{
 const before=core.hash(rel),seen=[];for(let offset=0;offset<rel.comparison.bazi.cross_relations.length;offset+=2){const c=project(rel,{focus:'relationship',comparison:true,offset,limit:2}).reading.comparison.bazi;assert.deepEqual(c.cross_relations.items,rel.comparison.bazi.cross_relations.slice(offset,offset+2));for(const m of c.cross_relation_context){assert.ok(c.cross_relations.items.some(r=>r.id===m.relation_id));seen.push(m);}}
 const all=groups.groupContext(rel.comparison.bazi.cross_relations,Object.fromEntries(rel.people.map(p=>[p.id,p.chart.bazi.chart.pillars])));assert.deepEqual(seen,all);assert.equal(core.hash(rel),before);
});
test('stable pair matrix rule IDs are globally unique and known hours are not claimed missing',()=>{
 const people=rel.people.map(p=>ten.describe(p.chart)),m=pair.compare(...people).pillar_matrix,ids=m.flatMap(x=>x.relations.map(r=>r.id));assert.equal(ids.length,new Set(ids).size);
 const sourceFiles=rel.people.map((p,i)=>{const f=path.join(tmp,'source-'+i+'.json');fs.writeFileSync(f,JSON.stringify(p.chart));return f;}),r=flow.operation(['--reuse',sourceFiles[0],'--pair-with',sourceFiles[1],'--out',path.join(tmp,'pair')]);assert.deepEqual(r.context.pair_evidence.not_computed,['ziwei_comparison']);assert.deepEqual(r.context.reading.comparison.day_master_projection.reference_frames,{a_to_b:{observer:'a',observed:'b'},b_to_a:{observer:'b',observed:'a'}});assert.ok(budget.fits(r,20480));
});
test('label changes preserve complete artifacts, natal/transit mutagen sources and bounded long-path views',()=>{
 const before=core.hash(rel),dataBefore=core.hash(d),base={ok:true,files:{chart:'/workspace/'+"quoted-'"+'x'.repeat(256)+'/chart.json'}};for(const focus of ['relationship','intimacy','annual']){const r=flow.boundedResponse(base,rel,{focus,brief:true,limit:3});assert.ok(budget.fits(r,20480));assert.ok(budget.measure(r).shell_bytes<28672);}
 const c=project(rel,{focus:'relationship',person:'a',brief:true}).reading.people[0].chart;assert.deepEqual(c.ziwei.natal_mutagens,rel.people[0].chart.ziwei.calculations.natal_mutagens);for(const x of c.ziwei.transit_mutagens)assert.ok(['decadal','yearly'].includes(x.scope));assert.equal(core.hash(rel),before);assert.equal(core.hash(d),dataBefore);
});
test('candidate annual/flying increment pages retain candidate, parent checksum and complete original arrays',()=>{
 const raw=fixture('time-compare-candidates-input.json');raw.target_date='2026-10-09';raw.birth_options={annual_count:4};raw.time_uncertainty.times=['08:30'];
 const file=path.join(tmp,'candidate-input.json');fs.writeFileSync(file,JSON.stringify(raw));const first=flow.operation(['--input',file,'--out',path.join(tmp,'candidate'),'--candidate','TC-001','--focus','romance','--limit','1']),bytes=fs.readFileSync(first.files.chart),artifact=JSON.parse(bytes),chosen=artifact.candidates[0].chart.people[0].chart;
 for(const purpose of ['annual_page','flying_page']){
  const items=purpose==='annual_page'?[...first.context.reading.reading.people[0].chart.bazi.annual.items]:[...first.context.reading.reading.people[0].chart.ziwei.palace_stem_flying.items];let action=first.next_actions.find(x=>x.purpose===purpose),n=0;
  while(action){const r=flow.operation(action.argv);assert.ok(++n<30);assert.equal(r.context.view,'evidence_page');assert.equal(r.context.source_checksum,artifact.checksum.value);assert.equal(r.context.selection.candidate,'TC-001');assert.equal(r.context.reading.candidate.id,'TC-001');assert.ok(!r.context.reading.reading.people[0].chart.bazi?.pillars);assert.ok(budget.fits(r,20480));assert.ok(r.context.base_context.restore_argv.includes('TC-001'));
   items.push(...(purpose==='annual_page'?r.context.reading.reading.people[0].chart.bazi.annual.items:r.context.reading.reading.people[0].chart.ziwei.palace_stem_flying.items));action=r.next_actions.find(x=>x.purpose===purpose);
  }
  const expected=purpose==='annual_page'?chosen.bazi.chart.annual:project(artifact.candidates[0].chart,{focus:'relationship'}).reading.people[0].chart.ziwei.palace_stem_flying;assert.deepEqual(items.map(x=>x.id),expected.map(x=>x.id));
 }
 assert.deepEqual(fs.readFileSync(first.files.chart),bytes);
});
test('candidate incremental page rejects a mismatched parent checksum and ambiguous time summary',()=>{
 assert.throws(()=>project(tc,{focus:'annual',page:'annual',candidate:tc.candidates[0].id,base_checksum:'0'.repeat(64)}),/校验和/);assert.throws(()=>project(tc,{focus:'annual',page:'annual',base_checksum:tc.checksum.value}),/明确时辰候选/);
});
