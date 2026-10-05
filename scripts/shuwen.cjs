#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {withInputLifecycle,readStdinJson}=require('./input-lifecycle.cjs');
function check(condition,message){if(!condition)throw new Error(message);}
const VERSION='shuwen/0.1.0';
const PURPOSES={peace:'祈福平安',ancestor:'祭祖追思',memorial:'祭亡告慰',thanks:'还愿答谢',repentance:'忏悔省过',wealth:'求财祈愿',custom:'通用呈告'};
const FORMS={shuwen:'疏文',biaowen:'表文',jiwen:'祭文'};
const SOURCES=[{id:'SW-LINGBAO',title:'灵宝文检·重刊道藏辑要本序',url:'https://github.com/kanripo/KR5i0092/blob/master/KR5i0092_002.txt',locator:'CK-EX_KR5i0092_02p002a',use:'只参考表奏分门别类的文书背景；未复制整篇模板或仪轨'},
 {id:'SW-NCKU',title:'王三庆：敦煌文献斋愿文体的源流与结构',url:'https://chinese.ncku.edu.tw/var/file/142/1142/img/2248/5402.pdf',locator:'成大中文学报54（2016），27–58页；摘要及31–35页',use:'参考用途、具文人、事由、祈愿及首尾的组织；模板由本项目原创'},
 {id:'SW-TEMPLE',title:'六埕顺扬宫：疏文线上制作',url:'https://shunyanggong.tw/shuwen/',use:'只参考先选用途、填字段、预览、按需导出的流程；未复制网站代码或模板'}];
function fields(obj,allowed,label){check(obj&&typeof obj==='object'&&!Array.isArray(obj),`${label} 必须为对象`);for(const key of Object.keys(obj))check(allowed.includes(key),`${label} 不支持字段 ${key}`);}
function isoDate(value,label){const {Temporal}=require('./common.cjs');try{return Temporal.PlainDate.from(value,{overflow:'reject'});}catch{throw new Error(`${label} 日期不存在`);}}
function text(value,label,max=300,multiline=false){
 check(typeof value==='string'&&value.trim().length>0&&value.length<=max,`${label} 须为 1–${max} 字`);
 check(!(multiline?/[\x00-\x08\x0b\x0c\x0e-\x1f]/:/[\x00-\x1f]/).test(value),`${label} 不能含控制字符`);
 return value.trim().replace(/\r\n?/g,'\n');
}
function documentDate(raw){
 if(raw===undefined)return null;
 fields(raw,['calendar','date','text','is_leap_month','display'],'date');
 check(['solar','lunar','text'].includes(raw.calendar),'date.calendar 须为 solar / lunar / text');
 if(raw.calendar==='text'){
  check(raw.date===undefined&&raw.is_leap_month===undefined&&raw.display===undefined,'自填日期只使用 calendar 与 text');
  return {source:'user_text',text:text(raw.text,'date.text',120)};
 }
 const {Solar,Lunar}=require('lunar-typescript');
 check(raw.text===undefined,'公历或农历日期不能同时填 text');
 check(typeof raw.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(raw.date),'date.date 须为 YYYY-MM-DD');
 const [year,month,day]=raw.date.split('-').map(Number),date=raw.calendar==='solar'?isoDate(raw.date,'date.date'):{year,month,day};check(date.year>=1900&&date.year<=2100,'日期换算支持 1900–2100');
 check(raw.is_leap_month===undefined||typeof raw.is_leap_month==='boolean','is_leap_month 须为布尔值');
 check(raw.calendar==='lunar'||!raw.is_leap_month,'公历不能标记为闰月');
 const display=raw.display??'both';check(['solar','lunar','both'].includes(display),'date.display 须为 solar / lunar / both');
 let solar;
 if(raw.calendar==='solar')solar=Solar.fromYmd(date.year,date.month,date.day);
 else{
  check(date.month>=1&&date.month<=12&&date.day>=1&&date.day<=30,'农历月、日超出范围');
  const signedMonth=raw.is_leap_month?-date.month:date.month;
  try{const lunar=Lunar.fromYmd(date.year,signedMonth,date.day);solar=lunar.getSolar();const rt=solar.getLunar();check(rt.getYear()===date.year&&rt.getMonth()===signedMonth&&rt.getDay()===date.day,'农历日期或闰月不存在');}
  catch(e){throw new Error(`农历日期无效：${e.message}`);}
 }
 const lunar=solar.getLunar(),solarText=`公历${solar.getYear()}年${solar.getMonth()}月${solar.getDay()}日`,lunarText=`农历${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
 return {source:'program_calendar',input:raw,solar_date:solar.toYmd(),lunar:{year:lunar.getYear(),month:Math.abs(lunar.getMonth()),day:lunar.getDay(),is_leap_month:lunar.getMonth()<0},solar_text:solarText,lunar_text:lunarText,text:display==='solar'?solarText:display==='lunar'?lunarText:`${solarText}（${lunarText}）`,year_basis:'农历年；非八字立春年'};
}
function normalize(raw){
 fields(raw,['mode','purpose','form','style','title','recipient','applicants','subject','occasion','offerings','petition','commitment','body_text','date'],'疏文输入');
 check(raw.mode==='shuwen','mode 须为 shuwen');check(Object.hasOwn(PURPOSES,raw.purpose),'不支持的疏文用途');
 const form=raw.form??'shuwen',style=raw.style??'classical';check(Object.hasOwn(FORMS,form),'form 须为 shuwen / biaowen / jiwen');check(['classical','plain'].includes(style),'style 须为 classical / plain');
 const clean={mode:'shuwen',purpose:raw.purpose,form,style,applicants:[]};
 for(const k of ['title','recipient','occasion','offerings','petition','commitment','body_text'])if(raw[k]!==undefined)clean[k]=text(raw[k],k,k==='body_text'?4000:k==='petition'||k==='commitment'?1500:k==='title'?80:300,['body_text','petition','commitment'].includes(k));
 const people=raw.applicants??[{}];check(Array.isArray(people)&&people.length>=1&&people.length<=20,'applicants 须为 1–20 人');
 for(const [i,p] of people.entries()){fields(p,['name','role','birth_text','residence'],`applicants[${i}]`);const person={};for(const key of ['name','role','birth_text','residence'])if(p[key]!==undefined)person[key]=text(p[key],`applicants[${i}].${key}`,key==='residence'?300:120);clean.applicants.push(person);}
 if(raw.subject!==undefined){fields(raw.subject,['name','relationship','death_text'],'subject');clean.subject={};for(const key of ['name','relationship','death_text'])if(raw.subject[key]!==undefined)clean.subject[key]=text(raw.subject[key],`subject.${key}`,120);}
 if(raw.date!==undefined)clean.date=documentDate(raw.date);
 return clean;
}
const CLASSICAL={
 peace:'愿身心安适，家宅和顺，出入平安，所行之事稳妥顺遂。',
 ancestor:'追念先人恩泽，感怀养育与家风。愿祖德长存，后人和睦，勤勉持家，敬亲睦族。',
 memorial:'追思音容，感念往日情分，谨以此文寄托哀思。愿逝者安宁，生者珍重，亲情常存于心。',
 thanks:'今怀感恩之心，谨陈答谢。既有所愿，亦当践行所诺，珍惜所得，常存善念。',
 repentance:'今静心省察往日言行，愿知过能改，谨慎言语，善待他人，以切实行动修正失当之处。',
 wealth:'愿正当生计顺遂，事业稳进，收支有序，善用所得，家计安稳。',
 custom:'[呈告事由与祈愿待填]'
};
const PLAIN={
 peace:'愿家人身体安适，相处和睦，出入平安，日常生活顺顺当当。',
 ancestor:'谨记先人的养育与关爱，把思念和感恩写在这里。愿家人彼此照顾，也把好的家风传下去。',
 memorial:'想把思念、感激和未尽的话写给您。愿您安宁，也愿留下的亲人好好照顾自己，把这份情意记在心里。',
 thanks:'带着感恩写下这份答谢，也会认真完成自己许下的承诺，珍惜得到的帮助。',
 repentance:'愿正视自己的过失，愿意改正失当的言行，以实际行动弥补，也更认真地善待身边的人。',
 wealth:'愿工作与正当收入稳步向好，合理安排收支，把家中的生活照顾妥当。',
 custom:'[想表达的内容待填]'
};
function build(raw){
 const input=normalize(raw),missing=[];const placeholder=(key,label)=>{missing.push({field:key,label});return `[${label}待填]`;};
 const names=input.applicants.map((p,i)=>p.name??placeholder(`applicants[${i}].name`,'落款姓名'));
 const subject=[input.subject?.relationship,input.subject?.name].filter(Boolean).join(' ');
 let recipient=input.recipient;
 if(!recipient)recipient=input.purpose==='ancestor'?'历代祖先':input.purpose==='memorial'?subject||placeholder('subject','亡亲姓名或称呼'):placeholder('recipient','呈告对象');
 const date=input.date?.text??placeholder('date','文书日期'),title=input.title??`${PURPOSES[input.purpose]}${FORMS[input.form]}`;
 const classical=input.style==='classical',parts=[];
 parts.push({kind:'recipient',text:classical?`谨呈：${recipient}`:`致：${recipient}`});
 parts.push({kind:'applicants',text:input.applicants.map((p,i)=>`${p.role??'具文人'}：${names[i]}${p.birth_text?`；生辰：${p.birth_text}`:''}${p.residence?`；居所：${p.residence}`:''}`).join('\n')});
 if(input.occasion)parts.push({kind:'occasion',text:classical?`兹因${input.occasion}，谨具此文，敬陈心意。`:`因${input.occasion}，写下这份心意。`});
 if(input.purpose==='memorial'&&subject&&recipient!==subject)parts.push({kind:'subject',text:`追思对象：${subject}`});
 if(input.subject?.death_text)parts.push({kind:'death_text',text:`逝世记述：${input.subject.death_text}`});
 if(input.offerings)parts.push({kind:'offerings',text:classical?`谨以${input.offerings}，寄托诚敬。`:`以${input.offerings}，寄托心意。`});
 let body=input.body_text??(classical?CLASSICAL:PLAIN)[input.purpose];
 if(input.purpose==='custom'&&!input.body_text&&!input.petition){missing.push({field:'body_text','label':'呈告事由与祈愿'});}
 if(input.purpose==='custom'&&input.petition&&!input.body_text)body=input.petition;
 parts.push({kind:'body',text:body});
 if(input.petition&&!(input.purpose==='custom'&&!input.body_text))parts.push({kind:'petition',text:input.petition});
 if(input.commitment)parts.push({kind:'commitment',text:classical?`并愿践行：${input.commitment}`:`我会认真去做：${input.commitment}`});
 parts.push({kind:'closing',text:classical?'谨陈此意，伏愿鉴纳。':'谨以此文，寄托心意。'});
 parts.push({kind:'signature',text:`${names.join('、')} 敬具\n${date}`});
 return {ok:true,schema_version:'bazi-ziwei-shuwen/v1',engine_version:VERSION,status:missing.length?'draft':'complete',title,text:[title,...parts.map(p=>p.text)].join('\n\n')+'\n',parts,missing_fields:missing,calendar:input.date??null,
  provenance:{template_version:'original-folk-document/v1',template_origin:'本项目原创民俗文稿，按用途组织；未复制宫庙网站模板或冒署法师职衔',sources:SOURCES},files:[],saved:false};
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function columns(data){
 const segmenter=new Intl.Segmenter('zh',{granularity:'grapheme'}),out=[];
 const add=(text,title=false)=>{for(const line of text.split('\n')){const chars=[...segmenter.segment(line)].map(x=>x.segment);for(let i=0;i<chars.length;i+=24)out.push({title,chars:chars.slice(i,i+24)});}};
 add(data.title,true);for(const part of data.parts){out.push({chars:[],gap:true});add(part.text);}
 return out;
}
function makeHtml(data,layout='horizontal'){
 check(['horizontal','vertical'].includes(layout),'layout 须为 horizontal / vertical');
 let content;
 if(layout==='horizontal')content=`<main class="sheet horizontal"><h1>${esc(data.title)}</h1>${data.parts.map(p=>`<p>${esc(p.text)}</p>`).join('')}</main>`;
 else{const cols=columns(data),pages=[];for(let i=0;i<cols.length;i+=27)pages.push(`<main class="sheet vertical" aria-label="第${pages.length+1}页">${cols.slice(i,i+27).map(c=>`<div class="column${c.title?' heading':''}${c.gap?' gap':''}">${c.chars.map(ch=>`<span>${esc(ch)}</span>`).join('')}</div>`).join('')}</main>`);content=pages.join('\n');}
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${esc(data.title)}</title><style>
 *{box-sizing:border-box}body{margin:0;background:#ece9e1;color:#231f18;font-family:"Noto Serif CJK SC","Songti SC",SimSun,serif}.sheet{background:#fffdf7;margin:18px auto;padding:10mm;box-shadow:0 2px 12px #0002}.horizontal{width:min(210mm,100%);min-height:269mm}h1{font-size:24px;text-align:center;margin:0 0 12mm}p{font-size:18px;line-height:2;white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 8mm}.vertical{width:269mm;height:182mm;display:flex;flex-direction:row-reverse;gap:1.5mm;align-items:flex-start;padding:10mm;overflow:hidden}.column{flex:0 0 7mm;width:7mm;display:flex;flex-direction:column;align-items:center}.column span{display:block;width:7mm;height:5.5mm;line-height:5.5mm;text-align:center;font-size:5mm}.column.heading span{font-size:6mm}.column.gap{flex-basis:2mm;width:2mm}
 @page{size:A4 ${layout==='vertical'?'landscape':'portrait'};margin:14mm}@media print{body{background:white}.sheet{box-shadow:none;background:white;margin:0;break-after:page}.sheet:last-child{break-after:auto}.horizontal{width:auto;min-height:0;padding:0}.vertical{padding:10mm}.column{break-inside:avoid}}
 </style></head><body>${content}</body></html>\n`;
}
function operation(argv){
 if(argv.length===1&&['--help','-h'].includes(argv[0]))return 'shuwen.cjs --stdin [--out DIR --format txt|html|both --layout horizontal|vertical]\n--stdin 默认只返回文稿，不写文件；--temp-input INPUT.json 使用后清理；--input INPUT.json 明确保留。\n--list 列出用途；--out 明确导出疏文，不生成 chart.json 或报告。';
 if(argv.length===1&&argv[0]==='--list')return {ok:true,purposes:PURPOSES,forms:FORMS,styles:['classical','plain']};
 const options={},keys={'--input':'input','--out':'out','--format':'format','--layout':'layout'};
 for(let i=0;i<argv.length;i++){
  if(argv[i]==='--stdin'){check(options.stdin===undefined,'--stdin 不能重复');options.stdin=true;continue;}
  const key=keys[argv[i]],value=argv[++i];check(key&&options[key]===undefined&&value&&!value.startsWith('--'),'疏文 CLI 参数无效、重复或缺少值');options[key]=value;
 }
 check(Boolean(options.stdin)!==Boolean(options.input),'只提供 --stdin 或 --input 之一');
 check(options.out||options.format===undefined&&options.layout===undefined,'--format / --layout 仅用于 --out 导出');
 const format=options.format??'txt',layout=options.layout??'horizontal';check(['txt','html','both'].includes(format),'format 须为 txt / html / both');check(['horizontal','vertical'].includes(layout),'layout 须为 horizontal / vertical');
 check(format!=='txt'||options.layout===undefined,'文字文件不使用 layout；竖排请选择 html 或 both');
 const raw=options.stdin?readStdinJson():JSON.parse(fs.readFileSync(options.input,'utf8').replace(/^\uFEFF/,'')),data=build(raw);
 if(!options.out)return data;
 const dir=path.resolve(options.out),files=[...(format!=='html'?[{path:path.join(dir,'shuwen.txt'),content:data.text}]:[]),...(format!=='txt'?[{path:path.join(dir,'shuwen.html'),content:makeHtml(data,layout)}]:[])];
 check(!options.input||files.every(f=>f.path!==path.resolve(options.input)),'输出不能覆盖输入');check(files.every(f=>!fs.existsSync(f.path)),'输出文件已存在；请使用新的任务目录');
 fs.mkdirSync(dir,{recursive:true});const created=[];
 try{for(const f of files){const fd=fs.openSync(f.path,'wx');created.push(f.path);try{fs.writeFileSync(fd,f.content,'utf8');}finally{fs.closeSync(fd);}}}
 catch(e){const failures=[];for(const file of created){try{fs.unlinkSync(file);}catch(cleanup){if(cleanup.code!=='ENOENT')failures.push(cleanup.code||'unknown');}}if(failures.length)e.message+='；未完成输出清理：'+failures.join('、');throw e;}
 return {...data,files:files.map(f=>f.path),saved:true,layout:format==='txt'?null:layout};
}
function main(argv){const result=withInputLifecycle(argv,operation);console.log(typeof result==='string'?result:JSON.stringify(result));return result;}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(JSON.stringify({ok:false,error:e.message,type:e.code==='cleanup_error'?'cleanup_error':'input_or_export_error'}));process.exitCode=2;}}
module.exports={build,documentDate,makeHtml,main,VERSION};
