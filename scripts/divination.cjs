'use strict';
const {Temporal,asSolar,digest,check,InputError,packageVersion}=require('./common.cjs');
const TABLE=require('../references/divination-tables.json');
const STEMS='甲乙丙丁戊己庚辛壬癸';const BRANCHES='子丑寅卯辰巳午未申酉戌亥';
const GEN={木:'火',火:'土',土:'金',金:'水',水:'木'};const CTRL={木:'土',火:'金',土:'水',金:'木',水:'火'};
const COMBOS=['子丑','寅亥','卯戌','辰酉','巳申','午未'];
const ADVANCE=['寅卯','巳午','申酉','亥子','丑辰','辰未','未戌','戌丑'];
function fields(obj,allowed,label){check(obj&&typeof obj==='object'&&!Array.isArray(obj),`${label} 必须是对象`);for(const k of Object.keys(obj))check(allowed.includes(k),`${label} 中不支持字段 ${k}`);}
function relation(a,b){if(a===b)return '同五行';if(GEN[a]===b)return '生';if(CTRL[a]===b)return '克';if(GEN[b]===a)return '受生';return '受克';}
function relative(palace,line){if(palace===line)return '兄弟';if(GEN[line]===palace)return '父母';if(GEN[palace]===line)return '子孙';if(CTRL[palace]===line)return '妻财';return '官鬼';}
function hexagram(bits){
 check(typeof bits==='string'&&/^[01]{6}$/.test(bits),'卦象须为自下而上的六位 0/1');
 const lower=TABLE.trigrams.find(t=>t.bits===bits.slice(0,3));const upper=TABLE.trigrams.find(t=>t.bits===bits.slice(3));
 let palace;
 for(const t of TABLE.trigrams){const pure=t.bits+t.bits;for(let i=0;i<8;i++){
   const candidate=[...pure].map((v,j)=>TABLE.palace_change_masks[i]&(1<<j)?String(1-Number(v)):v).join('');
   if(candidate===bits){check(!palace,'八宫映射重复');const shi=TABLE.shi_lines[i];palace={trigram:t.name,element:t.element,stage:TABLE.palace_stages[i],stage_index:i,shi_line:shi,ying_line:(shi+2)%6+1};}
 }}
 check(palace&&TABLE.hexagrams[bits],'六十四卦表不完整');
 return {name:TABLE.hexagrams[bits],bits_bottom_up:bits,lower:{name:lower.name,element:lower.element},upper:{name:upper.name,element:upper.element},palace};
}
function najia(bits){const lower=TABLE.trigrams.find(t=>t.bits===bits.slice(0,3));const upper=TABLE.trigrams.find(t=>t.bits===bits.slice(3));return [...lower.najia_lower.slice(1)].map(b=>lower.najia_lower[0]+b).concat([...upper.najia_upper.slice(1)].map(b=>upper.najia_upper[0]+b));}
function sixSpirits(stem){const start=[0,0,1,1,2,3,4,4,5,5][STEMS.indexOf(stem)];check(start!==undefined,'无效的日干');return Array.from({length:6},(_,i)=>TABLE.six_spirits[(start+i)%6]);}
function voidBranches(ganzhi){const s=STEMS.indexOf(ganzhi[0]),b=BRANCHES.indexOf(ganzhi[1]);check(s>=0&&b>=0&&(s-b)%2===0,'无效日干支');return [BRANCHES[(b-s+22)%12],BRANCHES[(b-s+23)%12]];}
function branchRelation(a,b){const i=BRANCHES.indexOf(a),j=BRANCHES.indexOf(b);return {same_branch:a===b,clash:(i+6)%12===j,combine:COMBOS.some(p=>p.includes(a)&&p.includes(b)&&a!==b),element_relation:relation(TABLE.branch_elements[a],TABLE.branch_elements[b])};}
function normalize(input){
 fields(input,['mode','method','question','label','casting','time','options'],'占卦输入');
 check(input.mode==='divination','占卦 mode 须为 divination');
 check(input.method==='liuyao','当前占卦程序支持 method=liuyao');
 check(typeof input.question==='string'&&input.question.trim().length>0&&input.question.length<=2000,'question 必须是 1–2000 字的具体占问');
 check(!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(input.question),'question 不能含控制字符');
 if(input.label!==undefined)check(typeof input.label==='string'&&input.label.length<=80&&!/[\r\n\x00-\x1f]/.test(input.label),'label 最长 80 字且不能含控制字符');
 fields(input.casting,['lines','coins'],'casting');
 check(('lines' in input.casting)!==('coins' in input.casting),'casting 必须只提供 lines 或 coins 之一');
 let values;let coinRows=null;
 if('lines' in input.casting){values=input.casting.lines;check(Array.isArray(values)&&values.length===6&&values.every(x=>Number.isInteger(x)&&[6,7,8,9].includes(x)),'lines 须为六个 6/7/8/9，按初爻到上爻排列');}
 else{coinRows=input.casting.coins;check(Array.isArray(coinRows)&&coinRows.length===6&&coinRows.every(r=>Array.isArray(r)&&r.length===3&&r.every(x=>x===2||x===3)),'coins 须为六组各三枚的 2/3 数值，自下而上；正面=3，反面=2');values=coinRows.map(r=>r.reduce((a,b)=>a+b,0));}
 fields(input.time,['date','time','timezone'],'time');const tm=input.time;
 check(typeof tm.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(tm.date),'time.date 须为公历 YYYY-MM-DD');
 check(typeof tm.time==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(tm.time),'time.time 须为 HH:mm 或 HH:mm:ss');
 check(typeof tm.timezone==='string'&&tm.timezone.length>0,'time.timezone 必须明确填写');
 const opt=input.options===undefined?{}:input.options;fields(opt,['day_boundary'],'options');const day=opt.day_boundary===undefined?'midnight':opt.day_boundary;check(['midnight','late_zi'].includes(day),'day_boundary 只能为 midnight 或 late_zi');
 let zoned;try{const plain=Temporal.PlainDateTime.from(`${tm.date}T${tm.time}`,{overflow:'reject'});check(plain.year>=1900&&plain.year<=2100,'占时支持 1900–2100 年');zoned=plain.toZonedDateTime(tm.timezone,{disambiguation:'reject'});}catch(e){if(e instanceof InputError)throw e;throw new InputError(`占时日期、时区或夏令时口径错误：${e.message}`);}
 const local=zoned.toPlainDateTime(),beijing=zoned.withTimeZone('+08:00').toPlainDateTime();check(beijing.year>=1900&&beijing.year<=2100,'对应北京时间超出支持范围');
 return {values,coinRows,local,beijing,zoned,input:{mode:'divination',method:'liuyao',question:input.question.trim(),label:input.label||'未命名占问',casting:coinRows?{coins:coinRows}:{lines:values},time:{...tm},options:{day_boundary:day}},normalized:{local_datetime:local.toString(),timezone:tm.timezone,utc_offset:zoned.offset,utc_instant:zoned.toInstant().toString(),beijing_datetime:beijing.toString(),line_order:'bottom_to_top',coin_convention:'正面=3，反面=2；六次按初爻到上爻'},day_boundary:day};
}
function castingHexagrams(values){
 check(Array.isArray(values)&&values.length===6&&values.every(v=>[6,7,8,9].includes(v)),'需要六个有效爻值');
 return {base_bits:values.map(v=>String(v%2)).join(''),changed_bits:values.map(v=>String(v===6?1:v===9?0:v%2)).join('')};
}
function build(input){
 check(packageVersion('lunar-typescript')==='1.8.6'&&packageVersion('@js-temporal/polyfill')==='0.5.1','请恢复便携包的固定历法依赖');
 const c=normalize(input);const {base_bits:bits,changed_bits:changed}=castingHexagrams(c.values);
 const base=hexagram(bits),change=hexagram(changed);base.id='LY-BASE';change.id='LY-CHANGE';
 const e=asSolar(c.beijing).getLunar().getEightChar(),dl=asSolar(c.local).getLunar().getEightChar();e.setSect(c.day_boundary==='midnight'?2:1);dl.setSect(c.day_boundary==='midnight'?2:1);
 const calendar={id:'LY-TIME',year_ganzhi:e.getYear(),month_ganzhi:e.getMonth(),day_ganzhi:dl.getDay(),hour_ganzhi:dl.getTime(),month_branch:e.getMonth()[1],day_branch:dl.getDay()[1],void_branches:voidBranches(dl.getDay()),day_boundary:c.day_boundary,year_month_basis:'实际占时瞬间对应的 UTC+08:00 节气；日时柱用所填地点的钟表时间'};
 const gods=sixSpirits(calendar.day_ganzhi[0]),a=najia(bits),b=najia(changed);
 const lines=c.values.map((value,i)=>{const branch=a[i][1],el=TABLE.branch_elements[branch],cb=b[i][1],ce=TABLE.branch_elements[cb];return {id:`LY-L${i+1}`,position:i+1,value,coins:c.coinRows?c.coinRows[i]:null,yang:value%2===1,moving:value===6||value===9,symbol:value%2?'━━━━':'━━  ━━',najia:a[i],branch,element:el,relative:relative(base.palace.element,el),spirit:gods[i],shi:i+1===base.palace.shi_line,ying:i+1===base.palace.ying_line,changed:{yang:changed[i]==='1',najia:b[i],branch:cb,element:ce,relative_to_base_palace:relative(base.palace.element,ce)}};});
 const present=new Set(lines.map(l=>l.relative));const pure=TABLE.trigrams.find(t=>t.name===base.palace.trigram).bits.repeat(2);
 const hidden=najia(pure).map((gz,i)=>({id:`LY-H${i+1}`,position:i+1,najia:gz,element:TABLE.branch_elements[gz[1]],relative:relative(base.palace.element,TABLE.branch_elements[gz[1]])})).filter(h=>!present.has(h.relative));
 const ledger=lines.map(l=>{const month=branchRelation(calendar.month_branch,l.branch),day=branchRelation(calendar.day_branch,l.branch);return {id:`LY-R${l.position}`,line_id:l.id,void:l.branch!==undefined&&calendar.void_branches.includes(l.branch),month_break:month.clash,day_clash:day.clash,month_to_line:month,day_to_line:day,...(l.moving?{changed_void:calendar.void_branches.includes(l.changed.branch),changed_month_break:branchRelation(calendar.month_branch,l.changed.branch).clash,return_relation:relation(l.changed.element,l.element),advance:ADVANCE.includes(l.branch+l.changed.branch),retreat:ADVANCE.includes(l.changed.branch+l.branch)}:{})};});
 const warnings=['爻值按初爻到上爻输入；报告为了传统阅读可自上而下展示。','变爻六亲统一以本卦宫五行为基准；变卦自身八宫世应另列，不能混用。','月破、旬空、日冲与生克逐项记录在爻位关系账本中。','铜钱输入按用户提供的六次记录计算。'];
 if(c.local.hour===23)warnings.push(`占时在 23 点，日柱口径为 ${c.day_boundary}；请核对是否需要比较另一口径。`);
 const result={schema_version:'bazi-ziwei-divination/v1',engine_version:'liuyao/0.1.0',input:c.input,normalized:c.normalized,chart:{base,changed:change,lines,calendar},calculations:{rule_version:TABLE.rule_version,moving_lines:lines.filter(l=>l.moving).map(l=>l.position),hidden_relatives:hidden,line_ledger:ledger},warnings,provenance:{engines:{'lunar-typescript':'1.8.6','@js-temporal/polyfill':'0.5.1'},rules_source:TABLE.source,table_checksum:digest(TABLE),node:process.versions.node,icu:process.versions.icu,tz_database:process.versions.tz||'not_reported',limitations:[]}};
 result.checksum={algorithm:'sha256-canonical-json',value:digest(result)};return result;
}
function validateArtifact(data){
 check(data&&data.schema_version==='bazi-ziwei-divination/v1'&&data.engine_version==='liuyao/0.1.0','不支持的占卦报告版本');
 const {checksum,...payload}=data;check(checksum&&checksum.algorithm==='sha256-canonical-json'&&checksum.value===digest(payload),'占卦报告校验和不匹配');
 const fresh=build(data.input);for(const k of ['normalized','chart','calculations','warnings'])check(digest(data[k])===digest(fresh[k]),`${k} 与占卦程序重算不一致`);
 for(const k of ['engines','rules_source','table_checksum'])check(digest(data.provenance[k])===digest(fresh.provenance[k]),'占卦规则或依赖变化');return checksum.value;
}
module.exports={build,validateArtifact,normalizeInput:input=>normalize(input).input,hexagram,najia,relative,sixSpirits,voidBranches,branchRelation,castingHexagrams};
