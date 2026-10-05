'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {build,validateArtifact}=require('../scripts/engine.cjs');
const {Temporal,digest}=require('../scripts/common.cjs');
const {equationOfTime}=require('../scripts/solar-time.cjs');
const {tenGod}=require('../scripts/bazi-rules.cjs');
const {LunarUtil,Solar}=require('lunar-typescript');
const noaa=require('../references/verification/noaa-solar-fixtures.json');
const sxtwl=require('../references/verification/sxtwl-bazi-fixtures.json');
const comparison=require('../references/verification/cross-check-results.json');
const tc=require('../scripts/time-compare.cjs');
const gz=d=>d.bazi.chart.pillars.map(p=>p.ganzhi);
const base=(time='09:10')=>({mode:'both',birth:{calendar:'solar',date:'2000-01-15',time,gender:'male',timezone:'Asia/Shanghai',longitude:116.4,longitude_source:'合成测试坐标'},options:{time_basis:'true_solar'}});
test('1900–2100 共 2412 个均时差向量与 NOAA 原始数学函数一致',()=>{
 assert.equal(noaa.monthly_samples.length,2412);
 for(const c of noaa.monthly_samples)assert.ok(Math.abs(equationOfTime(c.instant)-c.equation_of_time_minutes)<1e-9,c.instant);
});
test('18 个真太阳时案例包含海外、夏令时、跨日和小数时区',()=>{
 assert.equal(noaa.solar_cases.length,18);
 for(const c of noaa.solar_cases){const d=build(c.input),t=d.normalized.solar_time;assert.equal(d.normalized.utc_instant,c.reference_utc);assert.equal(t.apparent_solar_datetime,c.expected_solar_datetime,c.name);assert.ok(Math.abs(t.total_correction_minutes-c.total_correction_minutes)<1e-9,c.name);assert.equal(t.method,'noaa-meeus-equation-of-time/v1');}
});
test('430 组独立寿星历四柱、顺逆及五虎遁五鼠遁均一致',()=>{
 assert.equal(sxtwl.cases.length,430);
 for(const c of sxtwl.cases){const d=build(c.input);assert.deepEqual(gz(d),c.expected_pillars,JSON.stringify(c.input));assert.equal(d.bazi.chart.qiyun.direction,c.expected_qiyun_direction);assert.ok(d.bazi.calculations.theory_evidence.five_tigers.matches);assert.ok(d.bazi.calculations.theory_evidence.five_rats.matches);}
});
test('独立起运分钟差容许已记录的历法取整差，最大为 1 分钟',()=>{
 for(const c of sxtwl.cases){const o=build(c.input).bazi.chart.qiyun.offset,m=o.years*4320+o.months*360+o.days*12+o.hours/2;assert.ok(Math.abs(m-c.sxtwl_qiyun_minutes)<=1,c.input.birth.date);}
 assert.equal(comparison.max_qiyun_difference_minutes,1);
});
test('91 个十二节时刻与独立寿星历差异落在样本 60 秒复核带',()=>{
 assert.equal(comparison.solar_terms.length,91);
 for(const c of comparison.solar_terms){const year=Number(c.datetime_beijing.slice(0,4)),s=Solar.fromYmd(year,6,1).getLunar().getJieQiTable()[c.name],dt=s.toYmdHms().replace(' ','T');assert.equal(dt,c.lunar_typescript_datetime_beijing);assert.equal((Date.parse(dt+'+08:00')-Date.parse(c.datetime_beijing+'+08:00'))/1000,c.difference_seconds);assert.ok(Math.abs(c.difference_seconds)<60);}
 assert.equal(comparison.max_solar_term_difference_seconds,54.407);
});
test('十日干对十天干的 100 项十神与参考项目一致，藏干比较集合',()=>{
 assert.equal(sxtwl.ten_gods.length,100);for(const c of sxtwl.ten_gods)assert.equal(tenGod(c.day,c.other),c.expected);
 for(const [branch,stems] of Object.entries(sxtwl.hidden_stem_sets))assert.deepEqual([...LunarUtil.ZHI_HIDE_GAN[branch]].sort(),[...stems].sort());
});
test('校正只改变八字日时，双盘紫微与年/月柱、起运保留原瞬间',()=>{
 const a=build(base()),i=base();i.options.time_basis='clock';const b=build(i);
 assert.notEqual(gz(a)[3],gz(b)[3]);assert.deepEqual(gz(a).slice(0,2),gz(b).slice(0,2));assert.deepEqual(a.bazi.chart.qiyun,b.bazi.chart.qiyun);assert.deepEqual(a.ziwei,b.ziwei);assert.equal(a.normalized.utc_instant,b.normalized.utc_instant);assert.ok(a.bazi.chart.time_validation.hour_changes);
});
test('立春后的太阳钟面可落在立春钟点前，年/月柱仍采用真实瞬间',()=>{
 const c=noaa.solar_cases.find(c=>c.name==='lic-hun-beyond-minute-band'),d=build(c.input);assert.deepEqual(gz(d).slice(0,2),['甲辰','丙寅']);assert.ok(d.normalized.solar_time.apparent_solar_datetime<'2024-02-04T16:27:07');
});
test('上海历史夏令时与同一瞬间固定 +08 显示产生同一真太阳时',()=>{
 const i=base('14:30');i.birth.date='1990-05-20';const a=build(i);i.birth.timezone='+08:00';i.birth.time='13:30';const b=build(i);assert.equal(a.normalized.utc_offset,'+09:00');assert.equal(a.normalized.utc_instant,b.normalized.utc_instant);assert.equal(a.normalized.solar_time.apparent_solar_datetime,b.normalized.solar_time.apparent_solar_datetime);assert.deepEqual(gz(a),gz(b));
});
test('真太阳时跨午夜使用校正日期，农历转换后结果一致',()=>{
 const c=noaa.solar_cases.find(c=>c.name==='west-midnight'),a=build(c.input);assert.ok(a.normalized.solar_time.crosses_civil_date);assert.ok(a.bazi.chart.time_validation.day_changes);
 const l=Solar.fromYmd(2000,1,15).getLunar(),i=base();i.birth.calendar='lunar';i.birth.date=`${l.getYear()}-${String(Math.abs(l.getMonth())).padStart(2,'0')}-${String(l.getDay()).padStart(2,'0')}`;i.birth.is_leap_month=l.getMonth()<0;const b=build(i),solar=build(base());assert.deepEqual(gz(b),gz(solar));assert.equal(b.normalized.solar_time.apparent_solar_datetime,solar.normalized.solar_time.apparent_solar_datetime);
});
test('缺失经度、非法经度、无来源字段条件及紫微单盘太阳时均拒绝',()=>{
 for(const longitude of [undefined,NaN,181,'116.4']){const i=base();delete i.birth.longitude_source;if(longitude===undefined)delete i.birth.longitude;else i.birth.longitude=longitude;assert.throws(()=>build(i));}
 const i=base();i.mode='ziwei';assert.throws(()=>build(i),/仅紫微/);const j=base();delete j.birth.longitude;j.options.time_basis='clock';assert.throws(()=>build(j),/longitude_source/);
});
test('默认五鼠遁使用已选日干；兼容库口径记录其另用日干',()=>{
 const i=base('23:30');i.birth.date='1988-02-15';i.options.time_basis='clock';const a=build(i);assert.deepEqual(gz(a).slice(2),['庚子','丙子']);i.options.bazi_hour_stem_rule='library';const b=build(i);assert.deepEqual(gz(b).slice(2),['庚子','戊子']);assert.equal(b.bazi.calculations.theory_evidence.five_rats.reference_day_stem,'辛');i.options.bazi_day_boundary='late_zi';const c=build(i);assert.deepEqual(gz(c).slice(2),['辛丑','戊子']);
});
test('月令、同五行通根和透干均回查本盘，未自动宣布旺衰喜用',()=>{
 const d=build(base()),e=d.bazi.calculations.theory_evidence,p=d.bazi.chart.pillars;assert.equal(e.month_command.branch,p[1].branch);for(const r of e.day_master_roots){const source=p.find(x=>x.id===r.pillar_id);assert.equal(source.hidden_stems[r.hidden_order-1],r.stem);assert.equal(LunarUtil.WU_XING_GAN[r.stem],LunarUtil.WU_XING_GAN[p[2].stem]);}for(const t of e.month_hidden_transparency)for(const id of t.visible_sources)assert.equal(p.find(x=>x.id+'-S'===id).stem,t.stem);assert.equal(e.automatic_strength,null);assert.equal(e.automatic_pattern,null);assert.equal(e.automatic_useful_element,null);
});
test('节气边界复核按真实瞬间触发，远离边界则关闭',()=>{
 const i=base('16:27:00');i.birth.date='2024-02-04';const a=build(i);assert.equal(a.bazi.chart.jieqi_boundary_review.name,'立春');assert.ok(a.bazi.chart.jieqi_boundary_review.within_review_band);i.birth.time='16:30';assert.equal(build(i).bazi.chart.jieqi_boundary_review.within_review_band,false);
});
test('时辰范围反算太阳时边界，边界前后真实时柱发生改变',()=>{
 const d=tc.build({mode:'time_compare',chart_mode:'bazi',birth:{calendar:'solar',date:'2000-01-15',gender:'male',timezone:'+08:00',longitude:87.617},birth_options:{time_basis:'true_solar'},time_uncertainty:{type:'range',start:'07:00',end:'10:00'}});const cuts=d.boundaries.filter(b=>b.reasons.some(r=>r.startsWith('true_solar:')));assert.ok(cuts.length>0);for(const b of cuts){const before=Temporal.PlainDateTime.from(b.datetime).subtract({seconds:1}),after=Temporal.PlainDateTime.from(b.datetime),raw=t=>({mode:'bazi',birth:{...d.input.birth,time:t.toPlainTime().toString()},options:d.input.birth_options});assert.notEqual(gz(build(raw(before)))[3],gz(build(raw(after)))[3]);}assert.ok(d.candidates.every(c=>c.true_solar_datetime));tc.validateArtifact(d);
});
test('全天太阳时对照保留钟表及太阳边界，并覆盖跨日',()=>{
 const d=tc.build({mode:'time_compare',chart_mode:'bazi',birth:{calendar:'solar',date:'2000-01-15',gender:'male',timezone:'+08:00',longitude:87.617},birth_options:{time_basis:'true_solar'},time_uncertainty:{type:'unknown'}});assert.ok(d.coverage.sample_count>39&&d.coverage.sample_count<=256);assert.ok(d.comparison.variable_field_ids.includes('TC-BZ-DAY'));assert.equal(d.coverage.selected_best_candidate,null);tc.validateSummary(tc.summary(d),d);
});
test('太阳时证据和理论证据篡改后即使重签散列仍被重算拒绝',()=>{
 const original=build(base());for(const edit of [d=>d.bazi.chart.time_validation.total_correction_minutes++,d=>d.bazi.calculations.theory_evidence.month_command.main_qi='甲']){const d=structuredClone(original);edit(d);delete d.checksum;d.checksum={algorithm:'sha256-canonical-json',value:digest(d)};assert.throws(()=>validateArtifact(d),/重算不一致/);}
});
test('按需报告展示真实太阳时口径及五鼠遁，用户字段安全转义',()=>{
 const i=base();i.birth.longitude_source='<script>测试</script>';const d=build(i),r=require('../scripts/report.cjs').makeReport(d);assert.ok(r.markdown.includes('真太阳时验证')&&r.markdown.includes('五鼠遁'));assert.ok(!r.markdown.includes('未校正'));assert.ok(r.html.includes('&lt;script&gt;测试&lt;/script&gt;'));assert.ok(!r.html.includes('<script>测试</script>'));
});
