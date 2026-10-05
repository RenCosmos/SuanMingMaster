'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {predictAge}=require('../scripts/relationship-age.cjs'),rel=require('../scripts/relationship.cjs'),tc=require('../scripts/time-compare.cjs'),{digest}=require('../scripts/common.cjs');
function mock(stars,gender='male',minor=[],opposite=[]){
 const palaces=Array.from({length:12},(_,index)=>({id:`ZW-P${index}`,index,name:index===0?'夫妻':index===6?'官禄':`测试${index}`,earthlyBranch:'子',majorStars:(index===0?stars:index===6?opposite:[]).map(name=>({name,brightness:'庙',mutagen:''})),minorStars:index===0?minor.map(name=>({name})):[],adjectiveStars:[]}));
 return {input:{birth:{gender}},ziwei:{chart:{palaces},calculations:{three_sides_four_correct:[{palace_id:'ZW-P0',self:'ZW-P0',trines:['ZW-P4','ZW-P8'],opposite:'ZW-P6'}]}}};
}
test('天同的妻少、夫长分别适用，财官模型切换不偷换紫微适用性别',()=>{
 const male=predictAge(mock(['天同']),'a','wealth'),female=predictAge(mock(['天同'],'female'),'a','authority');
 assert.equal(male.tendency,'younger');assert.equal(female.tendency,'older');assert.equal(male.interpretation_scope,'traditional_pairing_symbolism');assert.equal(male.ziwei.matches[0].reference.original_excerpt,'夫宜长妻宜少');
 assert.deepEqual(predictAge(mock(['天同']),'a','authority').ziwei,male.ziwei);assert.equal(male.exact_age_gap,null);
});
test('天机天梁男命组合年长覆盖天机妻少通则，保留两条年长出处',()=>{
 assert.equal(predictAge(mock(['天机']),'a','wealth').tendency,'younger');const a=predictAge(mock(['天机','天梁']),'a','wealth');assert.equal(a.tendency,'older');assert.ok(!a.ziwei.matches.some(x=>x.rule_id==='ZW-JI-WIFE'));assert.deepEqual(a.ziwei.matches.map(x=>x.reference.locator),['天机条·天梁同宫','天梁条']);
});
test('妻宜大不被反推成女命夫长；天相夫长不被反推成男命妻长',()=>{
 assert.equal(predictAge(mock(['天梁']),'a','wealth').tendency,'older');assert.equal(predictAge(mock(['天梁'],'female'),'a','authority').tendency,'none');assert.equal(predictAge(mock(['天相']),'a','wealth').tendency,'none');assert.equal(predictAge(mock(['天相'],'female'),'a','authority').tendency,'older');
});
test('天同天梁的妻少与妻大冲突并列，辅星再多也不投票',()=>{
 const a=predictAge(mock(['天同','天梁'],'male',['文昌','禄存']),'a','wealth');assert.equal(a.tendency,'mixed');assert.ok(a.ziwei.matches.some(x=>x.direction==='older'&&x.use==='spouse_main'));assert.ok(a.ziwei.matches.some(x=>x.direction==='younger'&&x.use==='spouse_main'));assert.equal(a.ziwei.matches.filter(x=>x.use==='minor_support_only').length,2);
});
test('空夫妻宫对宫只列旁证，主方向不把借星当同度',()=>{
 const a=predictAge(mock([],'male',[],['天同']),'a','wealth');assert.equal(a.tendency,'none');assert.equal(a.ziwei.status,'empty_spouse_palace');assert.equal(a.ziwei.matches.length,0);assert.equal(a.ziwei.opposite_support[0].source.source_id,'ZW-P6');assert.equal(a.ziwei.opposite_support[0].use,'opposite_support_only');
});
test('仅文昌禄存及成熟气质星不补造年龄主方向，武曲同龄不是零岁差',()=>{
 for(const stars of [[],['紫微'],['太阴'],['巨门'],['七杀']])assert.equal(predictAge(mock(stars,'male',['文昌','禄存']),'a','wealth').tendency,'none');const a=predictAge(mock(['武曲']),'a','wealth');assert.equal(a.tendency,'peer');assert.equal(a.exact_age_gap,null);
});
test('明确紫相与紫破妻宫组合方向各自依原文，不能把紫微统一判年上',()=>{
 assert.equal(predictAge(mock(['紫微','天相']),'a','wealth').tendency,'younger');assert.equal(predictAge(mock(['紫微','破军']),'a','wealth').tendency,'older');assert.equal(predictAge(mock(['紫微','破军'],'female'),'a','authority').tendency,'none');
});
const input=()=>({mode:'relationship',question:'合成原典年龄核对',people:[{id:'a',birth:{calendar:'solar',date:'1994-02-13',time:'01:15',gender:'male',timezone:'Asia/Shanghai'}}],context:{topics:['age_relation']}});
test('实际程序年龄背景含四宫来源，所有规则回查本人真实宫位与原典',()=>{
 const d=rel.build(input()),a=d.age_relation.predictions[0],z=d.people[0].chart.ziwei;assert.equal(a.ziwei.context.context_palace_ids.length,4);for(const cue of a.ziwei.matches){const p=z.chart.palaces.find(p=>p.id===cue.source.source_id);assert.ok(p);assert.equal(cue.source.person_id,'a');assert.ok(cue.stars.every(s=>[...p.majorStars,...p.minorStars,...p.adjectiveStars].some(x=>x.name===s)));assert.ok(cue.reference.url.includes('wikisource.org'));}assert.equal(d.provenance.age_rule_version,'partner-age-sourced-v2');rel.validateArtifact(d);
});
test('仅紫微候选时辰也比较年龄方向和主规则，均无方向不写为同龄',()=>{
 const {time,...birth}=input().people[0].birth,d=tc.build({mode:'time_compare',chart_mode:'ziwei',birth,time_uncertainty:{type:'candidates',times:['01:15','09:15','17:15']},context:{topics:['age_relation']}});const f=d.comparison.fields.find(x=>x.id==='TC-AGE');assert.ok(f);assert.ok(d.comparison.fields.some(x=>x.id==='TC-AGE-ZW-RULES'));for(const v of f.variants)assert.ok(['older','peer','younger','mixed','none'].includes(v.value.tendency));assert.ok(d.candidates.every(c=>c.chart.age_relation.predictions[0].models.length===0));tc.validateArtifact(d);tc.validateSummary(tc.summary(d),d);
});
test('原典年龄输出与出处篡改后即使重签仍被重算识别，旧派生版本拒绝',()=>{
 for(const edit of [a=>a.exact_age_gap=8,a=>a.ziwei.gender_basis='female']){const d=rel.build(input());edit(d.age_relation.predictions[0]);delete d.checksum;d.checksum={algorithm:'sha256-canonical-json',value:digest(d)};assert.throws(()=>rel.validateArtifact(d),/重算不一致/);}const d=rel.build(input());d.schema_version='bazi-ziwei-relationship/v3';d.engine_version='relationship/0.5.0';assert.throws(()=>rel.validateArtifact(d),/重新计算/);
});
