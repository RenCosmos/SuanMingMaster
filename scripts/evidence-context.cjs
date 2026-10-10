'use strict';
// Incremental view only: source artifacts and calculation rules are unchanged.
const {check}=require('./runtime-core.cjs');
function projectPage(data,options){
 check(['annual','flying'].includes(options.page),'不支持的证据续页');
 check(options.base_checksum===data.checksum.value,'证据续页校验和不匹配；请恢复同一命盘的基础context');
 check(!['time_compare','divination'].includes(data.input.mode),'证据续页不用于时辰对照或六爻');
 check(!options.overview&&!options.comparison&&!options.candidate&&!options.field&&!options.variant_offset,'证据续页不与其他视图混用');
 check(data.input.mode!=='relationship'||data.people.length===1||options.person,'双人证据续页须指定 --person a / b');
 const {project}=require('./context.cjs'),{page,base_checksum,...rest}=options;
 const c=project(data,{...rest,brief:true,focus:page==='annual'?'annual':options.focus});
 const sourcePeople=c.reading.people??[{chart:c.reading}],people=[];
 for(const p of sourcePeople){
  const chart={};
  if(page==='annual'){
   check(p.chart.bazi,'年度证据续页需要八字流年');
   chart.bazi={annual:p.chart.bazi.annual,dayun:p.chart.bazi.dayun,dayun_at_target:p.chart.bazi.dayun_at_target};
  }else{
   check(p.chart.ziwei?.palace_stem_flying,'本主题没有宫干飞化页');
   chart.ziwei={flying_scope:p.chart.ziwei.flying_scope,palace_stem_flying:p.chart.ziwei.palace_stem_flying};
  }
  const item={...(p.person_id?{person_id:p.person_id}:{}),chart};
  if(page==='annual'&&['relationship','romance'].includes(options.focus)){
   const person=p.person_id?data.people.find(x=>x.id===p.person_id):null;
   const origin=person?.chart??data,id=p.person_id??'a';
   const model=person?data.profiles.find(x=>x.person_id===id).bazi.partner_star_model:origin.input.birth.gender==='male'?'wealth':'authority';
   const timing=require('./relationship-romance.cjs').romance(origin,id,model,options).timing;
   timing.items=timing.items.map(x=>({year:x.year,source:x.source,attraction_markers:x.attraction_markers,partner_stars:x.partner_stars}));timing.detail_source='bazi.annual';
   item.emotional_paths={timing};
  }
  people.push(item);
 }
 c.reading=data.input.mode==='relationship'?{people,person_ids:data.people.map(p=>p.id)}:{...people[0].chart,...(people[0].emotional_paths?{emotional_paths:people[0].emotional_paths}:{})};
 c.focus=options.focus;c.view='evidence_page';c.view_schema='suanming-evidence-page/v1';
 c.selection={...c.selection,page,base_checksum};
 c.base_context={required:true,source_checksum:base_checksum,focus:options.focus,person:options.person??null,note:'只含新增证据，不能当完整命盘；与同task_id/source_checksum的已读基础context合用，基础资料遗失时执行restore_argv。'};
 c.available={continuation_only:true};
 return c;
}
module.exports={projectPage};
