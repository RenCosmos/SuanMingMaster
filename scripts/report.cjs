'use strict';
const {relationText}=require('./bazi-period-relations.cjs');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const md=s=>String(s??'').replace(/\|/g,'\\|').replace(/\r?\n/g,' ');
function makeReport(d) {
  const sections=[];
  function section(title,headers,rows,note='') {sections.push({title,headers,rows,note});}
  section('出生信息与计算口径',['项目','内容'],[
    ['原始输入',`${d.input.birth.calendar==='solar'?'公历':'农历'} ${d.input.birth.date}${d.input.birth.is_leap_month?'（闰月）':''} ${d.input.birth.time}`],
    ['性别（传统排运输入）',d.input.birth.gender==='male'?'男':'女'],['出生地时区',`${d.normalized.timezone}；实际偏移 ${d.normalized.utc_offset}`],
    ['出生地钟表时间',d.normalized.local_datetime],['出生瞬间（UTC）',d.normalized.utc_instant],['对应北京时间',d.normalized.beijing_datetime],
    ['分析日期',d.input.target_date||'未指定，仅输出本命与排运'],['八字日时采用时间',d.input.options.time_basis==='true_solar'?'真太阳时':'出生地钟表时间'],['八字时干口径',d.input.options.bazi_hour_stem_rule],['八字子时口径',d.input.options.bazi_day_boundary],['紫微子时口径',d.input.options.ziwei_day_boundary],
  ]);
  if(d.bazi) {
    const {chart:b,calculations:c}=d.bazi;
    if(b.time_validation){const t=b.time_validation;section('真太阳时验证',['项目','结果'],[['经度（东正西负）',t.longitude_degrees_east],['经度来源',d.input.birth.longitude_source||'用户提供，来源未记载'],['实际 UTC 偏移（分钟）',t.actual_utc_offset_minutes],['经度与时区修正（分钟）',t.longitude_timezone_correction_minutes.toFixed(6)],['均时差（分钟）',t.equation_of_time_minutes.toFixed(6)],['总修正（分钟）',t.total_correction_minutes.toFixed(6)],['真太阳钟面时间',t.apparent_solar_datetime],['钟表日柱 / 时柱',t.civil_day_hour.day+' / '+t.civil_day_hour.hour],['太阳时日柱 / 时柱',t.true_solar_day_hour.day+' / '+t.true_solar_day_hour.hour],['本次采用口径',t.selected_basis],['距日期或时辰边界（秒）',t.distance_to_day_or_shichen_boundary_seconds.toFixed(3)]],'年、月柱与起运仍比较真实出生瞬间和北京时间十二节；紫微使用出生地钟表时间。');}
    const e=c.theory_evidence;section('子平基础证据',['项目','结果','依据'],[['月令本气',e.month_command.branch+' / '+e.month_command.main_qi+' / '+e.month_command.main_qi_ten_god,e.month_command.source_id],['日主通根',e.day_master_roots.map(x=>x.branch+'藏'+x.stem).join('、')||'无同五行藏干根',e.day_master_roots.map(x=>x.source_id).join('、')],['月令藏干透干',e.month_hidden_transparency.map(x=>x.stem+'：'+(x.visible_sources.join('、')||'未透于年/月/时干')).join('；'),'BZ-MONTH-H* → 可见天干'],['五虎遁',e.five_tigers.expected+'；'+(e.five_tigers.matches?'一致':'不一致'),'年干 '+e.five_tigers.year_stem],['五鼠遁',e.five_rats.expected+'；'+(e.five_rats.matches?'一致':'不一致'),'采用日干 '+e.five_rats.reference_day_stem]],'旺衰、格局与喜用的解释综合月令、根气、透干和合冲，不由五行计数或结构权重单独决定。');
    if(b.jieqi_boundary_review.within_review_band)section('节气边界复核',['节','北京时间','出生距边界秒数'],[[b.jieqi_boundary_review.name,b.jieqi_boundary_review.beijing_datetime,b.jieqi_boundary_review.difference_seconds]],'当前历法与独立参考存在秒级差异；此例处于 60 秒复核带，应比较边界两侧候选。');
    section('八字四柱',['柱','干支','显干十神','藏干（对应十神）','纳音','依据'],b.pillars.map(p=>[p.label,p.ganzhi,p.stem_ten_god,p.hidden_stems.map((s,i)=>`${s}(${p.hidden_ten_gods[i]})`).join('、'),p.nayin,p.id]));
    section('五行与十神计算',['五行','本字计数','藏干计数','结构权重'],Object.keys(c.surface_element_counts).map(k=>[k,c.surface_element_counts[k],c.hidden_stem_element_counts[k],c.weighted_element_scores[k]]),'本字计数总和为 8；藏干计数单列，结构权重依据各项透藏账本汇总。');
    section('计算摘要',['指标','结果','说明'],[
      ['日主',b.day_master,'BZ-DAY'],['月支本气十神',`${c.month_main_qi.stem} / ${c.month_main_qi.ten_god}`,c.month_main_qi.note],
      ['同类及生扶结构比例',`${(c.support_proxy.ratio*100).toFixed(2)}%`,c.support_proxy.note],
      ['十神权重分布',Object.entries(c.ten_god_weighted_distribution).map(([k,v])=>`${k} ${v}`).join('；'),'不含日主自身；逐项依据见 JSON score_ledger'],
      ['起运方向',b.qiyun.direction==='forward'?'顺排':'逆排',b.qiyun.method],['起运时刻（出生地时区）',b.qiyun.start_datetime_birth_timezone,b.qiyun.note],
    ]);
    section('原局合冲刑害结构',['关系','组合','柱位依据'],c.relations.map(r=>[r.type,r.symbols,`${r.pillars.join(' + ')}；${r.id}`]),'各项关系保留组合、柱位与规则依据。');
    section('八字大运',['序号','干支','名义年龄','公历年标签','显干 / 藏干十神','日支关系','四柱关系','依据'],b.dayun.map(x=>[x.index,x.ganzhi,`${x.start_nominal_age}–${x.end_nominal_age}`,`${x.start_year}–${x.end_year}`,x.stem_ten_god+' / '+x.hidden_stems.map((s,i)=>`${s}(${x.hidden_ten_gods[i]})`).join('、'),relationText(x.day_branch_relations,'大运'),relationText(x.pillar_relations,'大运'),x.id]));
    if(b.target){
      section('目标日期与流年',['项目','干支','显干十神'],[['目标日期所处流年',b.target.year_ganzhi,b.target.year_ten_god],['目标日期所处流月',b.target.month_ganzhi,b.target.month_ten_god]],`目标日期按出生地正午计算，对应北京时间 ${b.target.beijing_datetime}。`);
      section('逐年流年与四柱关系',['立春周期','干支','显干十神','藏干十神','夫妻宫地支关系','四柱干支关系','依据'],b.annual.map(y=>[y.lichun_cycle_year,y.ganzhi,y.stem_ten_god,y.hidden_stems.map((s,i)=>`${s}(${y.hidden_ten_gods[i]})`).join('、'),relationText(y.day_branch_relations),relationText(y.pillar_relations),y.id]),'只列本规则表命中；原局已有组合与流年加入后齐全分别标记。');
    }
  }
  if(d.ziwei) {
    const {chart:z,calculations:c}=d.ziwei;
    section('紫微命盘摘要',['项目','结果'],[['农历',z.lunar_date],['时辰',z.time],['五行局',z.five_elements_class],['命宫地支',z.soul_palace_branch],['身宫地支',z.body_palace_branch],['命主 / 身主',`${z.soul} / ${z.body}`],['安星算法',z.conventions.algorithm],['换年口径',z.conventions.year_boundary],['闰月调整',String(z.conventions.leap_adjust)]]);
    section('紫微十二宫',['宫位','宫干支','主星（亮度 / 四化）','辅星','大限名义年龄','依据'],z.palaces.map(p=>[`${p.name}${p.isBodyPalace?'（身宫）':''}`,p.heavenlyStem+p.earthlyBranch,p.majorStars.map(s=>`${s.name}${s.brightness?`(${s.brightness})`:''}${s.mutagen?` 化${s.mutagen}`:''}`).join('、')||'空宫',p.minorStars.map(s=>s.name+(s.mutagen?` 化${s.mutagen}`:'')).join('、'),p.decadal.range.join('–'),p.id]));
    section('生年四化',['四化','星曜','本命宫位','依据'],c.natal_mutagens.map(x=>[`化${x.mutagen}`,x.star,x.palace,x.id]));
    section('本命宫干四化',['发出宫','宫干','四化','星曜','落入宫','自化','依据'],c.palace_stem_flying.entries.map(x=>[x.origin_palace,x.origin_heavenly_stem,'化'+x.mutagen,x.star,x.target_palace,x.is_self_transform?'是':'否',x.id]),'宫干四化沿用本次 iztro 配置；与生年、大限、流年四化分别阅读。');
    section('三方四正',['本宫','三合宫','对宫','依据'],c.three_sides_four_correct.map(g=>[g.palace,g.member_palaces.slice(1,3).map(p=>p.palace).join('、'),g.member_palaces[3].palace,g.id]));
    if(z.target) {
      section('目标日期紫微岁运',['层级','宫位基准','干支','说明'],[[z.target.decadal.name,z.palaces[z.target.decadal.index].name,z.target.decadal.heavenlyStem+z.target.decadal.earthlyBranch,'采用引擎给出的运限层级'],['流年',z.palaces[z.target.yearly.index].name,z.target.yearly.heavenlyStem+z.target.yearly.earthlyBranch,'换年按所选紫微配置'],['小限',z.palaces[z.target.age.index].name,z.target.age.heavenlyStem+z.target.age.earthlyBranch,`名义年龄 ${z.target.age.nominalAge}`]]);
      section('大限 / 流年四化落点',['层级','四化','星曜','本命宫位','该层级宫名'],c.transit_mutagens.map(x=>[x.scope==='decadal'?'大限':'流年',`化${x.mutagen}`,x.star,x.natal_palace,x.scope_palace]));
    }
  }
  let markdown=`# ${md(d.input.label)} · 八字与紫微计算报告\n\n本文件由程序生成，展示排盘事实和规则计算。命理解读由 Skill 另行生成。\n\n`;
  for(const s of sections) {markdown+=`## ${s.title}\n\n| ${s.headers.map(md).join(' | ')} |\n| ${s.headers.map(()=>'---').join(' | ')} |\n`;markdown+=(s.rows.length?s.rows:[s.headers.map((_,i)=>i===0?'无':'')]).map(r=>`| ${r.map(md).join(' | ')} |`).join('\n')+'\n\n';if(s.note)markdown+=s.note+'\n\n';}
  markdown+='## 计算校验\n\n'+`计算依赖：${Object.entries(d.provenance.engines).map(([k,v])=>`${k} ${v}`).join('；')}。\n\nSHA-256：${d.checksum.value}\n`;
  const htmlSections=sections.map(s=>`<section><h2>${esc(s.title)}</h2><div class="table-wrap"><table><thead><tr>${s.headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${(s.rows.length?s.rows:[s.headers.map((_,i)=>i===0?'无':'')]).map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${s.note?`<p class="note">${esc(s.note)}</p>`:''}</section>`).join('\n');
  const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.input.label)} · 双盘计算报告</title><style>
  :root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f4f0e7;color:#273438;font:16px/1.65 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1120px;margin:auto;padding:48px 24px}header{border-top:5px solid #963f35;padding-top:24px;margin-bottom:32px}h1{font-size:32px;margin:0 0 12px}h2{font-size:21px;color:#704034;margin:0 0 18px}section{background:#fffdf8;border:1px solid #ded9cd;border-radius:12px;padding:24px;margin:20px 0}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;background:#eee9dd;font-weight:600}th,td{padding:12px;vertical-align:top;border-bottom:1px solid #e5e1d7}td{overflow-wrap:anywhere}.note,header p{color:#596364}.seal{font:12px/1.5 monospace;overflow-wrap:anywhere}@media(max-width:650px){main{padding:24px 12px}section{padding:16px}h1{font-size:26px}th,td{padding:9px;min-width:90px}}@media print{body{background:white}main{padding:0}section{break-inside:avoid;border-radius:0}h2{break-after:avoid}.table-wrap{overflow:visible}table{font-size:11px}}
  </style></head><body><main><header><h1>${esc(d.input.label)} · 双盘计算报告</h1><p>八字与紫微斗数 · 程序排盘与规则计算 · V1.1.6 · 引擎 v${esc(d.skill_version)}</p><p>排盘事实和解释分开保存；本页展示计算结果，命理解读由 Skill 另行生成。</p></header>${htmlSections}<section><h2>计算校验</h2><p>${esc(Object.entries(d.provenance.engines).map(([k,v])=>`${k} ${v}`).join('；'))}</p><p class="seal">SHA-256 ${esc(d.checksum.value)}</p></section></main></body></html>`;
  return {markdown,html};
}
module.exports={makeReport};
