'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cell=v=>(typeof v==='object'?JSON.stringify(v):String(v??'—')).replace(/\|/g,'\\|').replace(/[\r\n]/g,' ');
const labels={older:'年上',peer:'同龄附近',younger:'年下',mixed:'多种线索',none:'线索不集中',forward:'顺排',backward:'逆排'};
function makeReport(d){
 const lines=['# 出生时辰对照','',`问题：${cell(d.input.question)}`,'',`出生日期：${d.input.birth.date}（${d.input.birth.calendar}）；时区 ${cell(d.input.birth.timezone)}`,'',`成功候选点 ${d.comparison.valid_candidate_count} 个；需核实候选点 ${d.comparison.failed_candidate_count} 个。`,'','## 候选时间','','| 编号 | 钟表日期时间 | 真太阳钟面（若计算） | 所属分段 | 状态 |','|---|---|---|---|---|'];
 for(const c of d.candidates)lines.push(`| ${c.id} | ${c.local_datetime} | ${c.true_solar_datetime??'—'} | ${c.interval_id??'用户指定'} | ${c.status==='calculated'?'已计算':cell(c.error)} |`);
 for(const [status,title] of [['stable','候选点一致的项目'],['varies','随候选时间变化的项目'],['single_candidate','单一候选结果']]){
  const items=d.comparison.fields.filter(f=>f.status===status);if(!items.length)continue;lines.push('',`## ${title}`,'');
  for(const f of items){lines.push(`### ${f.label}`,'');for(const v of f.variants)lines.push(`- ${cell(labels[v.value]??v.value)}：${v.candidate_ids.join('、')}`);lines.push('');}
 }
 if(Object.keys(d.comparison.image_tags).length){lines.push('## 对象画像的共同线索','');for(const [dim,label] of [['appearance','外形'],['temperament','气质'],['style','风格']])lines.push(`${label}：${d.comparison.image_tags[dim].common.map(t=>t.tag).join('、')||'未形成跨候选共同标签'}`,'');lines.push('## 对象画像的分支线索','');for(const [dim,label] of [['appearance','外形'],['temperament','气质'],['style','风格']]){const tags=d.comparison.image_tags[dim].varying;if(tags.length){lines.push(`### ${label}`,'');for(const t of tags)lines.push(`- ${cell(t.tag)}：${t.candidate_ids.join('、')}`);lines.push('');}}}
 if(d.comparison.qiyun_sampled_start_times.length){lines.push('## 候选点的精确起运时刻','','| 候选编号 | 出生地时区起运时刻 |','|---|---|');for(const t of d.comparison.qiyun_sampled_start_times)lines.push(`| ${t.candidate_id} | ${cell(t.value)} |`);lines.push('');}
 lines.push('## 计算校验','',`方法：${d.coverage.method}`,`校验和：${d.checksum.value}`,'');
 const markdown=lines.join('\n'),html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>出生时辰对照</title><style>body{font:16px/1.7 system-ui;color:#242424;background:#f7f5f1;margin:0}main{max-width:1000px;margin:auto;padding:20px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}</style><main><pre>${esc(markdown)}</pre></main></html>`;return {markdown,html};
}
module.exports={makeReport};
