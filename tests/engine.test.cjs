'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const os=require('node:os');const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-engine-'));test.after(()=>{assert.equal(path.dirname(temporary),path.resolve(os.tmpdir()));fs.rmSync(temporary,{recursive:true,force:true});});
const {build,validateArtifact}=require('../scripts/engine.cjs');
const {normalize,readJson,digest,ROOT}=require('../scripts/common.cjs');
const {tenGod,relations}=require('../scripts/bazi-rules.cjs');
const {makeReport}=require('../scripts/report.cjs');
function input(date='2000-01-01',time='12:00',extra={}) {return {birth:{calendar:'solar',date,time,gender:'male',timezone:'+08:00'},...extra};}
function gz(d){return d.bazi.chart.pillars.map(p=>p.ganzhi);}
// Expected values are selected from the upstream test fixture, not computed by the implementation under test.
// https://github.com/6tail/lunar-python/blob/master/test/EightCharTest.py
for(const [date,time,expected] of [
  ['2005-12-23','08:37',['乙酉','戊子','辛巳','壬辰']],
  ['2022-08-28','01:50',['壬寅','戊申','癸丑','癸丑']],
  ['1988-02-15','23:30',['戊辰','甲寅','庚子','戊子']],
  ['1901-01-01','12:00',['庚子','戊子','己卯','庚午']],
]) test(`八字上游固定样例（library 时干） ${date} ${time}`,()=>assert.deepEqual(gz(build(input(date,time,{mode:'bazi',options:{bazi_hour_stem_rule:'library'}}))),expected));
test('立春瞬间前后年柱和月柱同时切换',()=>{
  const a=build(input('2024-02-04','16:27:06',{mode:'bazi'})),b=build(input('2024-02-04','16:27:07',{mode:'bazi'}));
  assert.deepEqual(gz(a).slice(0,2),['癸卯','乙丑']);assert.deepEqual(gz(b).slice(0,2),['甲辰','丙寅']);
});
test('出生地时区不同，同一出生瞬间的年/月柱保持一致',()=>{
  const a=build(input('2024-02-04','16:27:07',{mode:'bazi'}));
  const i=input('2024-02-04','00:27:07',{mode:'bazi'});i.birth.timezone='-08:00';
  const b=build(i);assert.equal(a.normalized.utc_instant,b.normalized.utc_instant);assert.deepEqual(gz(a).slice(0,2),gz(b).slice(0,2));assert.notEqual(gz(a)[3],gz(b)[3]);
});
test('八字 23 点换日模式与五鼠遁时干联动，旧库口径可显式选择',()=>{
  const a=build(input('1988-02-15','23:30',{mode:'bazi'}));
  const b=build(input('1988-02-15','23:30',{mode:'bazi',options:{bazi_day_boundary:'late_zi'}}));
  assert.equal(gz(a)[2],'庚子');assert.equal(gz(b)[2],'辛丑');assert.equal(gz(a)[3],'丙子');assert.equal(gz(b)[3],'戊子');
  assert.equal(gz(build(input('1988-02-15','23:30',{mode:'bazi',options:{bazi_hour_stem_rule:'library'}})))[3],'戊子');
});
test('农历闰二月转换与对应公历双盘相同',()=>{
  const i=input('2023-02-01','12:00');i.birth.calendar='lunar';i.birth.is_leap_month=true;
  const a=build(i),b=build(input('2023-03-22','12:00'));
  assert.equal(a.normalized.solar_date,'2023-03-22');assert.deepEqual(a.bazi,b.bazi);assert.deepEqual(a.ziwei,b.ziwei);
});
test('历史上海夏令时解析成真实 UTC+9；明确固定偏移得到相同四柱',()=>{
  const a=input('1990-07-01','12:00',{mode:'bazi'});a.birth.timezone='Asia/Shanghai';
  const b=input('1990-07-01','12:00',{mode:'bazi'});b.birth.timezone='+09:00';
  const da=build(a),db=build(b);assert.equal(da.normalized.utc_offset,'+09:00');assert.equal(da.normalized.utc_instant,'1990-07-01T03:00:00Z');assert.deepEqual(gz(da),gz(db));
});
test('夏令时不存在和重复的钟表时间均拒绝',()=>{
  for(const [date,time] of [['2024-03-10','02:30'],['2024-11-03','01:30']]) {const i=input(date,time);i.birth.timezone='America/New_York';assert.throws(()=>normalize(i),/夏令时/);}
});
test('非法日期、未知时辰、伪造闰月、不支持的校正及拼写均拒绝',()=>{
  const cases=[input('2024-02-30'),input('2000-01-01',null),{...input(),typo:true},input('2000-01-01','12:00',{options:{time_basis:'true_solar'}}),input('2000-01-01','12:00',{options:{dayun_count:0}}),input('2000-01-01','12:00',{target_date:'1999-12-31'})];
  const leap=input('2024-02-01');leap.birth.calendar='lunar';leap.birth.is_leap_month=true;cases.push(leap);
  const invalidZone=input();invalidZone.birth.timezone='Fake/City';cases.push(invalidZone);
  const lunarDay=input('2023-02-30');lunarDay.birth.calendar='lunar';lunarDay.birth.is_leap_month=true;cases.push(lunarDay);
  for(const c of cases) assert.throws(()=>build(c));
});
test('甲日对十天干的十神完整对应',()=>assert.deepEqual([...'甲乙丙丁戊己庚辛壬癸'].map(g=>tenGod('甲',g)),['比肩','劫财','食神','伤官','偏财','正财','七杀','正官','偏印','正印']));
test('五行表面总数为八，权重为九，账本与输出守恒',()=>{
  const c=build(input()).bazi.calculations;
  assert.equal(Object.values(c.surface_element_counts).reduce((a,b)=>a+b,0),8);
  assert.equal(Object.values(c.weighted_element_scores).reduce((a,b)=>a+b,0),9);
  assert.equal(Math.round(c.score_ledger.reduce((a,b)=>a+b.weight,0)*1e6)/1e6,9);
  assert.equal(Math.round(Object.values(c.ten_god_weighted_distribution).reduce((a,b)=>a+b,0)*1e6)/1e6,8);
  assert.equal(c.support_proxy.support,6);assert.ok(c.support_proxy.ratio>0&&c.support_proxy.ratio<1);
});
test('重复地支不能凑成三合，齐全三字才识别',()=>{
  const p=zs=>[...zs].map((z,i)=>({id:`P${i}`,stem:'甲',branch:z}));
  assert.equal(relations(p('申申子子')).some(r=>r.type==='三合'),false);
  assert.equal(relations(p('申子辰辰')).filter(r=>r.type==='三合').length,1);
});
test('大运以月柱的下一/上一柱开始，性别影响顺逆',()=>{
  const i=input('1990-05-15','12:00',{mode:'bazi'}),a=build(i);i.birth.gender='female';const b=build(i);
  assert.equal(a.bazi.chart.qiyun.direction,'forward');assert.equal(a.bazi.chart.dayun[0].ganzhi,'壬午');
  assert.equal(b.bazi.chart.qiyun.direction,'backward');assert.equal(b.bazi.chart.dayun[0].ganzhi,'庚辰');
  assert.equal(a.bazi.chart.qiyun.start_datetime_beijing,'1997-08-19T08:00:00+08:00[+08:00]');
});
test('立春前目标日期使用上一流年周期，不误用公历年',()=>{
  const d=build(input('2000-01-01','12:00',{mode:'bazi',target_date:'2024-01-10'}));
  assert.equal(d.bazi.chart.target.year_ganzhi,'癸卯');assert.equal(d.bazi.chart.annual[0].lichun_cycle_year,2023);
});
// https://github.com/SylarLong/iztro/blob/main/src/__tests__/astro/astro.test.ts
test('紫微上游固定样例：命身宫、五行局和流年大限',()=>{
  const i=input('2000-08-16','03:30',{mode:'ziwei',target_date:'2023-08-19',options:{ziwei_year_boundary:'lichun'}});i.birth.gender='female';const {chart:z}=build(i).ziwei;
  assert.equal(z.lunar_date,'二〇〇〇年七月十七');assert.equal(z.time,'寅时');assert.equal(z.soul_palace_branch,'午');assert.equal(z.body_palace_branch,'戌');assert.equal(z.soul,'破军');assert.equal(z.body,'文昌');assert.equal(z.five_elements_class,'木三局');
  assert.equal(z.target.decadal.index,2);assert.equal(z.target.yearly.index,1);assert.equal(z.target.age.nominalAge,24);
  assert.deepEqual(z.target.yearly.mutagen,['破军','巨门','太阴','贪狼']);
});
test('紫微十二宫、十四主星与四化全部唯一且落点可追溯',()=>{
  const {chart:z,calculations:c}=build(input('2000-01-01','12:00',{target_date:'2026-10-02'})).ziwei;
  assert.equal(new Set(z.palaces.map(p=>p.earthlyBranch)).size,12);assert.equal(z.palaces.flatMap(p=>p.majorStars).length,14);
  assert.equal(c.natal_mutagens.length,4);assert.equal(c.transit_mutagens.length,8);
  for(const m of c.natal_mutagens) {const p=z.palaces.find(p=>p.id===m.palace_id);assert.ok([...p.majorStars,...p.minorStars].some(s=>s.name===m.star&&s.mutagen===m.mutagen));}
  const life=c.three_sides_four_correct.find(g=>g.palace==='命宫');assert.deepEqual(new Set(life.member_palaces.map(p=>p.palace)),new Set(['命宫','官禄','财帛','迁移']));
});
test('紫微的正月初一和立春换年配置分别生效且无全局配置残留',()=>{
  const i=input('2024-02-05','12:00',{mode:'ziwei'});
  const a=build(i);const b=build({...i,options:{ziwei_year_boundary:'lichun'}});const c=build(i);
  assert.notDeepEqual(a.ziwei.calculations.natal_mutagens,b.ziwei.calculations.natal_mutagens);assert.deepEqual(a.ziwei,c.ziwei);
});
test('紫微晚子换日与次日早子产生一致的盘面结构',()=>{
  const a=build(input('2000-08-16','23:30',{mode:'ziwei'}));const b=build(input('2000-08-17','00:30',{mode:'ziwei'}));
  assert.deepEqual(a.ziwei.chart.palaces,b.ziwei.chart.palaces);
  const c=build(input('2000-08-16','23:30',{mode:'ziwei',options:{ziwei_day_boundary:'midnight'}}));assert.notDeepEqual(a.ziwei.chart.palaces,c.ziwei.chart.palaces);
});
test('双盘、单盘模式保留约定的计算范围',()=>{assert.ok(build(input()).bazi&&build(input()).ziwei);assert.equal(build(input('2000-01-01','12:00',{mode:'bazi'})).ziwei,undefined);assert.equal(build(input('2000-01-01','12:00',{mode:'ziwei'})).bazi,undefined);});
test('完整报告可复算；改动结果与重新伪造校验和仍会被重算发现',()=>{
  const d=build(input());assert.equal(validateArtifact(d),d.checksum.value);d.bazi.chart.pillars[0].ganzhi='甲子';assert.throws(()=>validateArtifact(d),/校验和/);const {checksum,...payload}=d;d.checksum.value=digest(payload);assert.throws(()=>validateArtifact(d),/重算不一致/);
});
test('同样输入运行两次得到相同结果',()=>assert.deepEqual(build(input()),build(input())));
test('HTML 对用户标签转义，Markdown/HTML 可展示完整两套计算',()=>{
  const d=build(input('2000-01-01','12:00',{label:'<script>alert(1)</script>'}));const r=makeReport(d);assert.equal(r.html.includes('<script>alert(1)</script>'),false);assert.ok(r.html.includes('&lt;script&gt;'));assert.ok(r.markdown.includes('八字四柱'));assert.ok(r.markdown.includes('紫微十二宫'));
});
test('宿主 TZ 改变不影响排盘结果',()=>{
  const old=process.env.TZ;
  try {process.env.TZ='UTC';const a=build(input('2000-08-16','03:30',{target_date:'2026-10-02'}));process.env.TZ='America/Los_Angeles';const b=build(input('2000-08-16','03:30',{target_date:'2026-10-02'}));assert.deepEqual(a,b);}
  finally {if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
test('CLI 主函数遇输入错误停止，且不生成可误用的命盘',()=>{
  // Test scratch always goes outside the deliverable into the caller workspace.
  const scratch=temporary;
  const bad=path.join(scratch,'bad.json');fs.writeFileSync(bad,JSON.stringify(input('2024-02-30')));
  const out=path.join(scratch,'invalid-output');const {main}=require('../scripts/run.cjs');
  assert.throws(()=>main(['--input',bad,'--out',out]));assert.equal(fs.existsSync(path.join(out,'chart.json')),false);
});
test('年份范围两端和不同季节可完成双盘计算',()=>{
  for(const date of ['1900-01-31','1900-12-31','1950-06-15','2000-02-29','2050-09-15','2100-12-31']) {const d=build(input(date,'12:00'));assert.equal(d.bazi.chart.pillars.length,4);assert.equal(d.ziwei.chart.palaces.length,12);}
});
