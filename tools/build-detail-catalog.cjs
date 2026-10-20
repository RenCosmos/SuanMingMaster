'use strict';
// Mechanical catalog/hash generation from authored cards; no network or calculation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),directory='references/knowledge/bazi-detail';
const specs=[
 ['bazi-twelve-stages','十二长生',['十二長生','长生十二宫','十二运','星运','星運'],'star_fortune',null,'三命通会','卷二·论天干阴阳生死、寄生十二宫'],
 ['bazi-self-seat','自坐',['自坐长生','自坐墓','自坐绝','自坐與星運'],'self_seat',null,'三命通会','卷二·寄生十二宫'],
 ['bazi-xun-kong','八字旬空',['八字空亡','旬空','空亡','六甲空亡'],'xun_kong / void_by_natal',null,'三命通会','卷三·论空亡'],
 ['bazi-nayin','纳音',['納音','纳音五行','纳音取象'],'nayin',null,'三命通会','卷一·总论纳音、纳音取象'],
 ['bazi-taiyuan','胎元',['胎元纳音','胎元怎么求'],'auxiliary.tai_yuan',null,'三命通会','卷二·论胎元'],
 ['bazi-taixi','八字胎息',['胎息','推息法','起息法'],'auxiliary.tai_xi',null,'命理探源','卷二·推息法'],
 ['bazi-minggong','八字命宫',['命宫','命宮','八字命宮','命宫中气','中气进月'],'auxiliary.ming_gong',null,'三命通会','卷二·论坐命官；命理探源卷二·推命宫法'],
 ['bazi-shengong','八字身宫',['身宫','身宮','八字身宮','安身命法'],'auxiliary.shen_gong',null,'刻京台增补渊海子平大全','卷一·论安身命法'],
 ['bazi-month-commander','分日司令',['司令','人元司事','人元用事','月令本气与司令','分日用事'],'month_commander',null,'三命通会','卷二·论人元司事'],
 ['bazi-xiaoyun','小运',['小運','八字小运','大运和小运','小运和流年'],'at_target.small_yun / bazi_periods',null,'三命通会','卷二·论小运'],
 ['bazi-tianyi','天乙贵人',['天乙貴人','天乙'],'shensha','SS-TIANYI','命理探源','卷三·天乙贵人'],
 ['bazi-taiji','太极贵人',['太極貴人','太极贵','太極貴'],'shensha','SS-TAIJI','三命通会','卷三·论太极贵'],
 ['bazi-wenchang','八字文昌贵人',['文昌贵人','文昌貴人','文昌'],'shensha','SS-WENCHANG','命理探源','卷三·文昌'],
 ['bazi-fuxing','福星贵人',['福星貴人','福星'],'shensha','SS-FUXING','渊海子平','卷一·论福星贵人；另本异文对照'],
 ['bazi-lushen','禄神',['祿神','十干禄','十干祿','日禄'],'shensha','SS-LUSHEN','三命通会','卷三·论十干禄'],
 ['bazi-yuede','月德贵人',['月德貴人','月德'],'shensha','SS-YUEDE','命理探源','卷三·月德'],
 ['bazi-tiande','天德贵人',['天德貴人','天德'],'shensha','SS-TIANDE','命理探源','卷三·天德'],
 ['bazi-dexiu','德秀贵人',['德秀貴人','德秀','德秀成格'],'shensha','SS-DEXIU','三命通会','卷三·论德秀'],
 ['bazi-taohua','八字桃花与咸池',['咸池','八字桃花','咸池桃花','桃花神煞'],'shensha','SS-TAOHUA','三命通会','卷二·论咸池'],
 ['bazi-yima','驿马',['驛馬','驿马星','驛馬星'],'shensha','SS-YIMA','三命通会','卷三·论驿马'],
 ['bazi-huagai','华盖',['華蓋','华盖星','華蓋星'],'shensha','SS-HUAGAI','三命通会','卷二·论将星华盖'],
 ['bazi-jiangxing','将星',['將星','八字将星'],'shensha','SS-JIANGXING','三命通会','卷二·论将星华盖'],
 ['bazi-jiesha','劫煞',['劫杀','劫殺','八字劫煞'],'shensha','SS-JIESHA','三命通会','卷三·论劫煞亡神'],
 ['bazi-wangshen','亡神',['八字亡神','亡神和劫煞'],'shensha','SS-WANGSHEN','三命通会','卷三·论劫煞亡神']
];
const topics=specs.map(([slug,name,aliases,field,rule,book,chapter],i)=>{
 const relative=directory+'/cards/'+slug+'.md',content=fs.readFileSync(path.join(root,relative),'utf8');
 const links=[...content.matchAll(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g)].map(m=>({title:m[1],url:m[2]}));
 if(!links.length)throw Error('Card missing source: '+slug);
 const subtitle=content.split(/\r?\n\s*\r?\n/)[2].slice(0,100),url=links[0].url;
 return {id:'BZD-'+String(i+1).padStart(2,'0'),slug,name,domain:'bazi',aliases:[name,...aliases],tags:['八字',name,...aliases.filter(x=>x.length>2)],subtitle,
  kind:'project_concept_reference',evidence_scope:'classical_concept_summary',program_supported:true,program_support_scope:'deterministic_fields_only_not_automatic_interpretation',program_field:field,...(rule?{rule_id:rule}:{}),
  path:relative,sha256:crypto.createHash('sha256').update(content).digest('hex'),url,publisher:'古籍电子转录与官方算法说明；本项目原创释义',book,chapter,locator:chapter,
  access_method:'web_primary_text_transcription',accessed_on:'2026-10-21',copyright_note:'原创摘要与字段说明；不复制现代译注、完整古籍或影像',
  inference_limits:['解释和取象不是自动成格判定','不同版本与实现口径按卡内说明分别采用'],
  source_references:links.map((s,index)=>({...s,book:index===0?book:s.title,chapter:index===0?chapter:s.title,locator:index===0?chapter:s.title,checked_claim:index===0?subtitle:'当前算法或异文对照入口；采用范围见正文',access_method:'web_primary_text_transcription',accessed_on:'2026-10-21'}))};
});
function build(){return {version:'bazi-detail-knowledge/v1',introduced_in:'1.4.6',expected_topics:24,automatic_chart_for_knowledge_questions:false,topics};}
if(require.main===module){
 fs.writeFileSync(path.join(root,directory,'catalog.json'),JSON.stringify(build(),null,2)+'\n');
 const file=path.join(root,'references/knowledge/search-terms.json'),dictionary=JSON.parse(fs.readFileSync(file,'utf8'));
 const ambiguous=new Set(['星运','星運','旬空','空亡','胎息','命宫','命宮','身宫','身宮','文昌']);
 for(const [,term,aliases] of specs){const entry={term,aliases,domain:'bazi'},shared=aliases.filter(x=>ambiguous.has(x));if(shared.length)entry.ambiguous_aliases=shared;
  const index=dictionary.terms.findIndex(t=>t.term===term);if(index<0)dictionary.terms.push(entry);else dictionary.terms[index]=entry;
 }
 fs.writeFileSync(file,JSON.stringify(dictionary,null,2)+'\n');
 console.log(JSON.stringify({ok:true,topics:topics.length,terms:dictionary.terms.length}));
}
module.exports={build,specs};
