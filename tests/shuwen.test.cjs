'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const sw=require('../scripts/shuwen.cjs'),root=path.resolve(__dirname,'..');
const fixture=()=>({mode:'shuwen',purpose:'ancestor',applicants:[{name:'合成甲'}],date:{calendar:'solar',date:'2026-10-05'}});
function temp(t){const d=fs.mkdtempSync(path.join(os.tmpdir(),'shuwen-v115-'));t.after(()=>{const rel=path.relative(fs.realpathSync(os.tmpdir()),fs.realpathSync(d));assert.ok(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel));fs.rmSync(d,{recursive:true,force:true});});return d;}
function file(d,n,x){const p=path.join(d,n);fs.writeFileSync(p,typeof x==='string'?x:JSON.stringify(x));return p;}
function capture(fn){const log=console.log;let data;console.log=x=>{data=JSON.parse(x);};try{fn();return data;}finally{console.log=log;}}
function cli(t,args,input,cwd,script=path.join(root,'scripts/shuwen.cjs')){const d=temp(t),fds=[];try{const p=file(d,'stdin',input??''),out=path.join(d,'stdout'),err=path.join(d,'stderr');fds.push(fs.openSync(p,'r'),fs.openSync(out,'w'),fs.openSync(err,'w'));const r=spawnSync(process.execPath,[script,...args],{cwd,stdio:fds,timeout:30000});return {...r,stdout:fs.readFileSync(out,'utf8'),stderr:fs.readFileSync(err,'utf8')};}finally{for(const f of fds)fs.closeSync(f);}}

test('七种用途与两种语体独立生成，完整输入无虚构供物、生辰或职衔',()=>{
 const texts=new Set();for(const purpose of ['peace','ancestor','memorial','thanks','repentance','wealth','custom'])for(const style of ['classical','plain']){const d=sw.build({...fixture(),purpose,style,recipient:'用户给定对象',...(purpose==='custom'?{body_text:'用户的通用呈告'}:{})});assert.equal(d.status,'complete');assert.equal(d.saved,false);assert.deepEqual(d.files,[]);assert.ok(d.text.includes('用户给定对象'));assert.ok(!d.text.includes('生辰：'));assert.ok(!d.parts.some(p=>p.kind==='offerings'));assert.ok(!d.text.includes('法师'));texts.add(d.parts.find(p=>p.kind==='body').text);}assert.equal(texts.size,13);
});
test('未填个人信息形成显式草稿，不默认姓名、神明或机器日期',()=>{
 const d=sw.build({mode:'shuwen',purpose:'peace'});assert.equal(d.status,'draft');assert.deepEqual(d.missing_fields.map(x=>x.field),['applicants[0].name','recipient','date']);assert.ok(d.text.includes('[文书日期待填]'));assert.equal(d.calendar,null);assert.ok(!d.text.includes('2026'));assert.ok(!d.text.includes('玉皇'));assert.ok(!d.text.includes('免责声明'));
});
test('祭祖与祭亡称呼分别处理，可向神明呈告亡亲，不假定供物与死因',()=>{
 const a=sw.build(fixture());assert.equal(a.parts[0].text,'谨呈：历代祖先');const m=sw.build({...fixture(),purpose:'memorial',subject:{relationship:'先母',name:'合成乙'},applicants:[{name:'合成甲',role:'女儿'}]});assert.equal(m.parts[0].text,'谨呈：先母 合成乙');assert.ok(m.text.includes('女儿：合成甲'));assert.ok(!m.text.includes('逝世记述'));const other=sw.build({...fixture(),purpose:'memorial',recipient:'用户指定神号',subject:{relationship:'先母',name:'合成乙',death_text:'用户指定记述'},offerings:'清茶'});assert.ok(other.parts.some(p=>p.kind==='subject'&&p.text.includes('先母 合成乙')));assert.ok(other.text.includes('谨以清茶'));
});
test('多人落款及用户自填字句保留，通用祈愿不重复插入',()=>{
 const d=sw.build({...fixture(),purpose:'custom',form:'biaowen',title:'家中自定标题',petition:'第一愿\r\n第二愿',applicants:[{name:'合成甲'},{name:'合成乙',role:'后人',birth_text:'家谱所记文字',residence:'用户提供居所'}]});assert.equal(d.title,'家中自定标题');assert.equal(d.text.split('第一愿').length,2);assert.ok(d.text.includes('第一愿\n第二愿'));assert.ok(d.text.includes('合成甲、合成乙 敬具'));const draft=sw.build({mode:'shuwen',purpose:'custom'});assert.ok(draft.missing_fields.some(x=>x.field==='body_text'));
});
test('公历、农历闰月和农历二月三十准确换算且按农历年界显示',()=>{
 assert.equal(sw.documentDate({calendar:'lunar',date:'2023-02-01',is_leap_month:true}).solar_date,'2023-03-22');assert.equal(sw.documentDate({calendar:'lunar',date:'2024-02-30'}).solar_date,'2024-04-08');assert.ok(sw.documentDate({calendar:'solar',date:'2025-01-28'}).lunar_text.startsWith('农历甲辰年'));assert.ok(sw.documentDate({calendar:'solar',date:'2025-01-29'}).lunar_text.startsWith('农历乙巳年'));assert.equal(sw.documentDate({calendar:'solar',date:'2026-10-05'}).lunar.day,25);
});
test('不存在的公历、农历及闰月停止生成，不把非法日期静默归一化',()=>{
 for(const date of [{calendar:'solar',date:'2024-02-30'},{calendar:'solar',date:'2024-04-31'},{calendar:'solar',date:'2024-04-01',is_leap_month:true},{calendar:'lunar',date:'2024-02-01',is_leap_month:true},{calendar:'lunar',date:'2024-01-31'},{calendar:'solar',date:'1899-12-31'}])assert.throws(()=>sw.build({...fixture(),date}));
});
test('地方自填纪年原样标为自填，没有假称程序换算',()=>{
 const d=sw.build({...fixture(),date:{calendar:'text',text:'地方纪年文字'}});assert.deepEqual(d.calendar,{source:'user_text',text:'地方纪年文字'});assert.ok(d.text.includes('地方纪年文字'));assert.throws(()=>sw.documentDate({calendar:'text',text:'某日',date:'2026-10-05'}));
});
test('拒绝未知字段、控制字符、过长正文、空人员表及非法参数',()=>{
 for(const input of [{...fixture(),private_data:'x'},{...fixture(),recipient:'甲\n乙'},{...fixture(),body_text:'\u0000'},{...fixture(),body_text:'长'.repeat(4001)},{...fixture(),applicants:[]},{...fixture(),applicants:[{name:'甲',identity_number:'123'}]}])assert.throws(()=>sw.build(input));for(const args of [['--stdin','--unknown','x'],['--stdin','--format','html'],['--stdin','--stdin'],['--input','--stdin'],['--list','--stdin']])assert.throws(()=>capture(()=>sw.main(args)));
});
test('标准输入只返回文稿，工作目录没有输入、文稿或报告文件',t=>{
 const d=temp(t),r=cli(t,['--stdin'],'\uFEFF'+JSON.stringify(fixture()),d);assert.equal(r.status,0,r.stderr);const data=JSON.parse(r.stdout);assert.equal(data.status,'complete');assert.equal(data.saved,false);assert.deepEqual(fs.readdirSync(d),[]);const bad=cli(t,['--stdin'],'{broken',d);assert.equal(bad.status,2);assert.equal(JSON.parse(bad.stderr).ok,false);assert.deepEqual(fs.readdirSync(d),[]);
});
test('显式导出只有 TXT 与 HTML，成稿与返回文字相同，输入保留由标志决定',t=>{
 const d=temp(t),p=file(d,'saved-input.json',fixture()),out=path.join(d,'document');const r=capture(()=>sw.main(['--input',p,'--out',out,'--format','both']));assert.equal(r.saved,true);assert.deepEqual(fs.readdirSync(out).sort(),['shuwen.html','shuwen.txt']);assert.equal(fs.readFileSync(path.join(out,'shuwen.txt'),'utf8'),r.text);assert.ok(fs.existsSync(p));assert.ok(fs.readFileSync(path.join(out,'shuwen.html'),'utf8').includes('<html lang="zh-CN">'));
});
test('HTML 转义用户文本且没有网络脚本和字体，换行保留',()=>{
 const d=sw.build({...fixture(),body_text:'<script>alert("甲")</script> &\n第二行',recipient:'<神号>'}),html=sw.makeHtml(d);assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;神号&gt;'));assert.ok(html.includes('第二行'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('@import'));assert.ok(!html.includes('url('));assert.ok(!html.includes('src='));
});
test('竖排多页不丢文字，完整保留 Unicode 字素，每列与每页不超容量',()=>{
 const d=sw.build({...fixture(),body_text:'甲乙👨‍👩‍👧‍👦<>&'.repeat(200)}),html=sw.makeHtml(d,'vertical');assert.ok((html.match(/<main /g)||[]).length>1);const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');const actual=[...html.matchAll(/<span>(.*?)<\/span>/gs)].map(x=>decode(x[1])).join('');const expected=[d.title,...d.parts.map(p=>p.text)].join('').replace(/\n/g,'');assert.equal(actual,expected);for(const page of html.matchAll(/<main [^>]*>(.*?)<\/main>/gs)){assert.ok((page[1].match(/class="column/g)||[]).length<=27);for(const col of page[1].matchAll(/<div class="column[^>]*>(.*?)<\/div>/gs))assert.ok((col[1].match(/<span>/g)||[]).length<=24);}assert.ok(html.includes('flex-direction:row-reverse'));
});
test('既有文稿和输入不会被覆盖，错误导出不留下新文稿',t=>{
 const d=temp(t),p=file(d,'saved-input.json',fixture()),out=path.join(d,'document');fs.mkdirSync(out);const old=file(out,'shuwen.html','owned sentinel');assert.throws(()=>capture(()=>sw.main(['--input',p,'--out',out,'--format','both'])),/已存在/);assert.equal(fs.readFileSync(old,'utf8'),'owned sentinel');assert.ok(!fs.existsSync(path.join(out,'shuwen.txt')));const collision=file(d,'shuwen.txt',fixture());assert.throws(()=>capture(()=>sw.main(['--input',collision,'--out',d])),/覆盖输入/);assert.ok(fs.readFileSync(collision,'utf8').includes('ancestor'));
});
test('显式临时输入在成功、JSON 或日期错误后清理，结果和技能示例受保护',t=>{
 const d=temp(t);for(const input of [fixture(),'{broken',{...fixture(),date:{calendar:'solar',date:'2024-02-30'}}]){const p=file(d,'input.json',input);if(typeof input==='string'||input.date.date==='2024-02-30')assert.throws(()=>capture(()=>sw.main(['--temp-input',p])));else assert.equal(capture(()=>sw.main(['--temp-input',p])).temporary_input_removed,true);assert.ok(!fs.existsSync(p));}for(const n of ['shuwen.txt','SHUWEN.HTML']){const p=file(d,n,'owned sentinel');assert.throws(()=>capture(()=>sw.main(['--temp-input',p])),/结果文件/);assert.equal(fs.readFileSync(p,'utf8'),'owned sentinel');}const ex=path.join(root,'examples/shuwen-input.json'),before=fs.readFileSync(ex);assert.throws(()=>capture(()=>sw.main(['--temp-input',ex])),/技能包/);assert.deepEqual(fs.readFileSync(ex),before);
});
test('写入第二份文稿失败时删除本次半成品并清理临时输入',t=>{
 const d=temp(t),p=file(d,'input.json',fixture()),out=path.join(d,'document'),write=fs.writeFileSync;try{fs.writeFileSync=function(fd,...args){if(typeof fd==='number'&&String(args[0]).startsWith('<!doctype'))throw Object.assign(new Error('synthetic ENOSPC'),{code:'ENOSPC'});return write.call(this,fd,...args);};assert.throws(()=>capture(()=>sw.main(['--temp-input',p,'--out',out,'--format','both'])),/ENOSPC/);}finally{fs.writeFileSync=write;}assert.ok(!fs.existsSync(p));assert.deepEqual(fs.readdirSync(out),[]);
});
test('日期依赖缺失也会清理临时输入，并且不会打印成功结果',t=>{
 const d=temp(t),scripts=path.join(d,'isolated','scripts');fs.mkdirSync(scripts,{recursive:true});for(const n of ['shuwen.cjs','input-lifecycle.cjs'])fs.copyFileSync(path.join(root,'scripts',n),path.join(scripts,n));const p=file(d,'input.json',fixture()),r=cli(t,['--temp-input',p],undefined,d,path.join(scripts,'shuwen.cjs'));assert.equal(r.status,2,r.stderr);assert.equal(r.stdout,'');assert.equal(JSON.parse(r.stderr).ok,false);assert.ok(!fs.existsSync(p));
});
