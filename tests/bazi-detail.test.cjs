'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Solar,LunarUtil}=require('lunar-typescript'),{Temporal,normalize,asSolar}=require('../scripts/common.cjs');
const core=require('../scripts/runtime-core.cjs'),detail=require('../scripts/bazi-detail.cjs'),flow=require('../scripts/workflow.cjs'),budget=require('../scripts/output-budget.cjs'),{project}=require('../scripts/context.cjs');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-detail-'));
const build=require('../scripts/engine.cjs').build;
const base={mode:'bazi',birth:{calendar:'solar',date:'1996-06-02',time:'12:20',gender:'male',timezone:'Asia/Shanghai'},target_date:'2026-10-21',options:{annual_count:3}};
const built=core.buildAndValidate(base).data;
function task(name,input=base){const file=path.join(tmp,name+'.json');fs.writeFileSync(file,JSON.stringify(input));return flow.operation(['--input',file,'--out',path.join(tmp,name),'--brief']);}
const saved=task('known'),argv=['--reuse',saved.files.chart,'--page','bazi-detail','--base-checksum',built.checksum.value];
test.after(()=>{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));fs.rmSync(tmp,{recursive:true,force:true});});

test('all 120 twelve-stage cells agree with a fixed independent reference table',()=>{
 const branches='子丑寅卯辰巳午未申酉戌亥',stems='甲乙丙丁戊己庚辛壬癸';
 const table={
  甲:'沐浴 冠带 临官 帝旺 衰 病 死 墓 绝 胎 养 长生',
  乙:'病 衰 帝旺 临官 冠带 沐浴 长生 养 胎 绝 墓 死',
  丙:'胎 养 长生 沐浴 冠带 临官 帝旺 衰 病 死 墓 绝',
  丁:'绝 墓 死 病 衰 帝旺 临官 冠带 沐浴 长生 养 胎',
  戊:'胎 养 长生 沐浴 冠带 临官 帝旺 衰 病 死 墓 绝',
  己:'绝 墓 死 病 衰 帝旺 临官 冠带 沐浴 长生 养 胎',
  庚:'死 墓 绝 胎 养 长生 沐浴 冠带 临官 帝旺 衰 病',
  辛:'长生 养 胎 绝 墓 死 病 衰 帝旺 临官 冠带 沐浴',
  壬:'帝旺 衰 病 死 墓 绝 胎 养 长生 沐浴 冠带 临官',
  癸:'临官 冠带 沐浴 长生 养 胎 绝 墓 死 病 衰 帝旺'};
 for(const s of stems)assert.deepEqual([...branches].map(b=>detail.stage(s,b)),table[s].split(' '),s);
 for(const bad of [['','子'],['甲乙','子'],['甲','']])assert.throws(()=>detail.stage(...bad));
});
test('synthetic natal fixtures match all pinned-library auxiliary, stage, void and XiaoYun APIs',()=>{
 for(const gender of ['male','female'])for(const month of [1,3,6,9,12])for(const hour of ['00:30','03:30','12:20','21:30']){
  const input={...base,birth:{...base.birth,date:'1996-'+String(month).padStart(2,'0')+'-15',time:hour,gender}},x=build(input),d=detail.describe(x),c=normalize(input),ec=asSolar(c.local).getLunar().getEightChar();ec.setSect(2);
  assert.deepEqual(d.natal.map(p=>p.star_fortune),[ec.getYearDiShi(),ec.getMonthDiShi(),ec.getDayDiShi(),ec.getTimeDiShi()]);
  assert.deepEqual(d.natal.map(p=>p.xun_kong),[ec.getYearXunKong(),ec.getMonthXunKong(),ec.getDayXunKong(),ec.getTimeXunKong()]);
  for(const [key,fn] of [['tai_yuan','getTaiYuan'],['tai_xi','getTaiXi'],['ming_gong','getMingGong'],['shen_gong','getShenGong']])assert.equal(d.auxiliary[key].ganzhi,ec[fn](),key);
  const small=ec.getYun(gender==='male'?1:0,2).getDaYun(6).flatMap(v=>v.getXiaoYun(10)).find(y=>y.getYear()===2026);assert.ok(small);assert.equal(d.at_target.small_yun.ganzhi,small.getGanZhi());
 }
});
test('void-of-this-column is distinct from landing in natal day void, for all sixty pillars',()=>{
 for(const gz of LunarUtil.JIA_ZI){const p=require('../scripts/bazi-chart.cjs').pillar('X','对照',gz,built.bazi.chart.day_master),r=detail.row(p,built.bazi.chart);assert.equal(r.xun_kong,LunarUtil.getXunKong(gz));assert.equal(r.void_by_natal.day,LunarUtil.getXunKong(built.bazi.chart.pillars[2].ganzhi).includes(gz[1]));}
});
test('late-Zi, library hour-stem, true-solar and overseas cases derive from adopted pillars, not Beijing substitutes',()=>{
 for(const [birth,options] of [
  [{...base.birth,time:'23:30'},{bazi_day_boundary:'midnight',bazi_hour_stem_rule:'day_stem'}],
  [{...base.birth,time:'23:30'},{bazi_day_boundary:'late_zi'}],
  [{...base.birth,time:'23:30'},{bazi_hour_stem_rule:'library'}],
  [{...base.birth,time:'00:20',longitude:75,longitude_source:'synthetic fixture'},{time_basis:'true_solar'}],
  [{...base.birth,date:'1996-12-31',time:'23:30',timezone:'America/New_York'},{}]
 ]){
  const x=core.buildAndValidate({...base,birth,options}).data,old=core.hash(x),d=detail.describe(x),b=x.bazi.chart;
  assert.deepEqual(d.natal.map(p=>p.ganzhi),b.pillars.map(p=>p.ganzhi));assert.equal(d.auxiliary.tai_xi.ganzhi,LunarUtil.HE_GAN_5['甲乙丙丁戊己庚辛壬癸'.indexOf(b.pillars[2].stem)]+LunarUtil.HE_ZHI_6['子丑寅卯辰巳午未申酉戌亥'.indexOf(b.pillars[2].branch)]);
  assert.equal(d.at_target.small_yun.ganzhi,LunarUtil.JIA_ZI[(LunarUtil.getJiaZiIndex(b.pillars[3].ganzhi)+(b.qiyun.direction==='forward'?1:-1)*d.at_target.nominal_age+6000)%60]);assert.equal(core.hash(x),old);
 }
});
test('commander phases cover exact Jie instants, all month transitions, and every internal boundary',()=>{
 const table=Solar.fromYmd(1996,6,1).getLunar().getJieQiTable(),names=['小寒','立春','惊蛰','清明','立夏','芒种','小暑','立秋','白露','寒露','立冬','大雪'];
 for(const name of names){
  const s=table[name],start=Temporal.PlainDateTime.from(s.toYmdHms().replace(' ','T')).toZonedDateTime('+08:00');
  const get=z=>{const input={mode:'bazi',birth:{...base.birth,date:z.toPlainDate().toString(),time:z.toPlainTime().toString(),timezone:'+08:00'}};return detail.describe(build(input)).month_commander;};
  const first=get(start),before=get(start.subtract({seconds:1}));assert.notEqual(first.month_branch,before.month_branch,name);assert.equal(first.elapsed_seconds,0,name);assert.equal(first.schedule[0].active,true);
  for(const phase of first.schedule.slice(1)){const edge=Temporal.Instant.from(phase.start_instant).toZonedDateTimeISO('+08:00');assert.equal(get(edge).stem,phase.stem);assert.notEqual(get(edge.subtract({seconds:1})).stem,phase.stem);}
  assert.equal(first.schedule.filter(p=>p.active).length,1);assert.equal(first.schedule.at(-1).end_instant_exclusive,first.next_jie.instant);
 }
});
test('all fourteen star rule tables use explicit original natal references and separate month versus day/annual bases',()=>{
 const d=detail.describe(built),rules=require('../references/bazi-detail-rules.json');assert.equal(d.supported_shensha.length,14);
 for(const r of [...d.natal,d.at_target.year,d.at_target.current_dayun].filter(Boolean))for(const hit of r.shensha){
  const rule=rules.shensha.find(x=>x.id===hit.rule_id);assert.ok(rule&&d.sources[hit.source]);assert.ok(hit.references.length);
  for(const ref of hit.references){const p=built.bazi.chart.pillars.find(p=>p.id===ref.source_id);assert.equal(ref.value,p[ref.field]);assert.ok(['stem','branch'].includes(ref.target_field));if(['SS-DEXIU','SS-YUEDE','SS-TIANDE'].includes(hit.rule_id))assert.equal(ref.source_id,'BZ-MONTH');}
 }
});
test('mixed stem/branch TianDe and DeXiu roles never match the wrong field or silently become a full pattern',()=>{
 const make=(month,day='庚寅')=>['丙戌','甲'+month,day,'壬午'].map((g,i)=>require('../scripts/bazi-chart.cjs').pillar(['BZ-YEAR','BZ-MONTH','BZ-DAY','BZ-HOUR'][i],'测试',g,'庚'));
 const hit=(gz,natal,id)=>detail.stars({stem:gz[0],branch:gz[1]},natal).find(x=>x.rule_id===id);
 assert.ok(hit('甲申',make('卯'),'SS-TIANDE'));assert.equal(hit('癸酉',make('卯'),'SS-TIANDE'),undefined);
 assert.ok(hit('癸酉',make('申'),'SS-TIANDE'));assert.equal(hit('甲申',make('申'),'SS-TIANDE'),undefined);
 for(const [gz,roles] of [['壬午',['德']],['丙戌',['秀']],['己未',['德','秀']]])assert.deepEqual(hit(gz,make('申'),'SS-DEXIU').references[0].roles,roles);
 assert.equal(hit('庚申',make('申'),'SS-DEXIU'),undefined);
});
test('fixed stem-star examples and all four branch groups match independently recorded rule cells',()=>{
 const cfg=require('../references/bazi-detail-rules.json'),stemRules={
  'SS-TIANYI':['丑未','子申','亥酉','亥酉','丑未','子申','丑未','寅午','卯巳','卯巳'],
  'SS-TAIJI':['子午','子午','卯酉','卯酉','辰戌丑未','辰戌丑未','寅亥','寅亥','巳申','巳申'],
  'SS-WENCHANG':['巳','午','申','酉','申','酉','亥','子','寅','卯'],
  'SS-FUXING':['寅子','丑卯','寅子戌','亥酉','申','未','午','巳','辰','丑卯'],
  'SS-LUSHEN':['寅','卯','巳','午','巳','午','申','酉','亥','子']};
 const stems='甲乙丙丁戊己庚辛壬癸';for(const [id,expected] of Object.entries(stemRules)){const r=cfg.shensha.find(x=>x.id===id);assert.deepEqual([...stems].map(s=>r.table[s]),expected);}
 const groups=['寅午戌','申子辰','巳酉丑','亥卯未'],expected={'SS-TAOHUA':'卯酉午子','SS-YIMA':'申寅亥巳','SS-HUAGAI':'戌辰丑未','SS-JIANGXING':'午子酉卯','SS-JIESHA':'亥巳寅申','SS-WANGSHEN':'巳亥申寅'};
 for(const [id,branches] of Object.entries(expected)){const r=cfg.shensha.find(x=>x.id===id);assert.deepEqual(groups.map(k=>r.groups[k]),[...branches]);}
});
test('each period handover annotation uses that precise instant and does not change active-period selection',()=>{
 const p=detail.prepare(built),d=detail.describe(built),rows=detail.periods(p).filter(x=>x.scope==='dayun'),first=built.bazi.chart.qiyun.start_datetime_beijing;
 assert.equal(d.qiyun.start_after_jie.elapsed_seconds,Temporal.ZonedDateTime.from(first).toInstant().since(Temporal.Instant.from(d.qiyun.start_after_jie.jie_instant)).total('seconds'));
 for(const row of rows)assert.equal(row.handover_after_jie.elapsed_seconds,Temporal.ZonedDateTime.from(row.start_datetime).toInstant().since(Temporal.Instant.from(row.handover_after_jie.jie_instant)).total('seconds'));
 assert.equal(d.at_target.current_dayun.id,require('../scripts/dayun-timing.cjs').active(built.bazi.chart).window.period.id);
});
test('long paths and high star density retain complete bounded detail and paginated periods',()=>{
 let max=0;
 for(let i=0;i<72;i++){const input={...base,birth:{...base.birth,date:'1996-'+String(1+i%12).padStart(2,'0')+'-'+String(1+i%28).padStart(2,'0'),time:String(i%24).padStart(2,'0')+':30'}},data=build(input),files={chart:path.join(tmp,'very-long-path-'.repeat(25),'chart.json')};
  for(const page of ['bazi-detail','bazi-periods']){const r=flow.boundedResponse({ok:true,files},data,{focus:'core',page,base_checksum:data.checksum.value,brief:true,limit:10});assert.ok(budget.fits(r,20480));assert.ok(budget.measure(r).shell_bytes<28672);max=Math.max(max,r.output.bytes);}
 }assert.ok(max>10000);
});
test('target-year XiaoYun is a separate Gregorian label before Lichun, and no target means no invented current period',()=>{
 const jan=detail.describe(build({...base,target_date:'2026-01-10'}));assert.equal(jan.at_target.year.ganzhi,'乙巳');assert.equal(jan.at_target.small_yun.calendar_year,2026);
 const {target_date,...input}=base,d=detail.describe(build(input));assert.equal(d.at_target.date,null);assert.equal(d.at_target.current_dayun,null);assert.equal(d.at_target.small_yun,null);
});
test('workflow returns bounded detail, cached source bytes unchanged, report only when requested',()=>{
 const old=fs.readFileSync(saved.files.chart),r=flow.operation(argv);assert.equal(r.cache_hit,true);assert.equal(r.calculation_performed,false);assert.equal(r.context.view_schema,'suanming-bazi-detail-context/v1');assert.ok(budget.fits(r,20480));assert.ok(budget.measure(r).shell_bytes<28672);
 assert.equal(fs.existsSync(path.join(path.dirname(saved.files.chart),'report.md')),false);
 const exportDir=path.join(tmp,'detail-export'),report=flow.operation([...argv,'--report','--out',exportDir]);assert.match(fs.readFileSync(report.files.report_md,'utf8'),/星运（日干）/);assert.match(fs.readFileSync(report.files.report_html,'utf8'),/人元分日司令/);assert.deepEqual(fs.readFileSync(saved.files.chart),old);
});
test('all automatic period argv execute to completion, with no missing or duplicate period IDs and no repeated natal',()=>{
 const first=flow.operation(argv),expected=detail.periods(detail.prepare(built)),rows=[];let action=first.next_actions.find(x=>x.purpose==='bazi_periods_page'),n=0;
 while(action){assert.ok(++n<50);const r=flow.operation(action.argv);assert.equal(r.context.selection.page,'bazi-periods');assert.ok(!r.context.reading.bazi_detail);assert.ok(budget.fits(r,20480));assert.ok(budget.measure(r).shell_bytes<28672);rows.push(...r.context.reading.bazi_periods.items);action=r.next_actions.find(x=>x.purpose==='bazi_periods_page');}
 assert.deepEqual(rows,expected);assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
});
test('year filters expose uncomputed coverage instead of inventing missing annual or XiaoYun rows',()=>{
 const c=project(built,{page:'bazi-periods',years:[2027,2030],base_checksum:built.checksum.value,limit:10}),p=c.reading.bazi_periods;
 assert.equal(p.requested_range_computed,false);assert.deepEqual(p.missing_annual_years,[2029,2030]);assert.deepEqual(p.items.filter(x=>x.scope==='annual').map(x=>x.lichun_cycle_year),[2027,2028]);
 const empty=project(built,{page:'bazi-periods',years:[1200,1201],base_checksum:built.checksum.value}).reading.bazi_periods;assert.equal(empty.total,0);assert.equal(empty.requested_range_computed,false);
});
test('unknown-time candidate and relationship person are mandatory and checksum-bound',()=>{
 const tc=core.buildAndValidate({...require('../examples/time-compare-input.json'),chart_mode:'bazi'}).data;
 assert.throws(()=>project(tc,{page:'bazi-detail',base_checksum:tc.checksum.value}),/明确时辰候选|指定/);
 const candidate=tc.candidates.find(c=>c.status==='calculated').id,c=project(tc,{page:'bazi-detail',candidate,base_checksum:tc.checksum.value});assert.equal(c.source_checksum,tc.checksum.value);assert.equal(c.reading.bazi_detail.coverage.candidate_id,candidate);assert.equal(c.reading.bazi_detail.coverage.kind,'single_time_candidate');
 const rel=core.buildAndValidate(require('../examples/relationship-pair-input.json')).data;assert.throws(()=>project(rel,{page:'bazi-detail',base_checksum:rel.checksum.value}),/person/);
 for(const person of ['a','b']){const v=project(rel,{page:'bazi-detail',person,base_checksum:rel.checksum.value});assert.equal(v.reading.bazi_detail.coverage.person_id,person);}
 assert.throws(()=>project(built,{page:'bazi-detail',base_checksum:'0'.repeat(64)}),/校验和不匹配/);
});
test('CLI rejects unrelated controls, unsupported modes and stale source checksum',()=>{
 for(const extra of [['--offset','0'],['--years','2026:2027'],['--flying-offset','0'],['--field','TC-X'],['--comparison']])assert.throws(()=>flow.parse([...argv,...extra]));
 assert.throws(()=>flow.parse(['--stdin','--out',path.join(tmp,'bad'),'--page','bazi-detail','--base-checksum','0'.repeat(64)]));
 const ziwei=build({...base,mode:'ziwei'});assert.throws(()=>project(ziwei,{page:'bazi-detail',base_checksum:ziwei.checksum.value}),/没有八字/);
});
test('normal views and original reports do not compute or inject optional professional detail',()=>{
 const before=core.hash(built),plain=project(built,{focus:'relationship',brief:true});assert.equal(plain.reading.bazi_detail,undefined);assert.equal(core.hash(built),before);
 const report=require('../scripts/report.cjs').makeReport(built);assert.doesNotMatch(report.markdown,/本命四柱专业细盘/);
});
test('actual mobile CLI accepts detail pages without dependency installation or source rewriting',()=>{
 const cp=require('node:child_process'),sh=process.env.SUANMING_TEST_SH||'sh',env={...process.env,SUANMING_NODE:process.execPath.replaceAll('\\','/')},prior=env.PATH||env.Path||'';for(const k of Object.keys(env))if(k.toUpperCase()==='PATH')delete env[k];env.PATH=[path.dirname(process.execPath),path.dirname(sh),prior].join(path.delimiter);
 const r=cp.spawnSync(sh,[path.join(root,'scripts/mobile.sh'),...argv].map(x=>x.replaceAll('\\','/')),{cwd:tmp,env,encoding:'utf8',timeout:30000});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).context.reading.bazi_detail.rule_version,'bazi-professional/1.0.0');
});
