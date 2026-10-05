'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const os=require('node:os');const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-divination-'));test.after(()=>{assert.equal(path.dirname(temporary),path.resolve(os.tmpdir()));fs.rmSync(temporary,{recursive:true,force:true});});
const {build,validateArtifact,hexagram,najia,relative,sixSpirits,voidBranches,castingHexagrams}=require('../scripts/divination.cjs');
const {digest}=require('../scripts/common.cjs');const {makeReport}=require('../scripts/divination-report.cjs');
const input=(lines=[7,7,7,7,7,7])=>({mode:'divination',method:'liuyao',question:'合成测试问题',casting:{lines},time:{date:'2005-12-23',time:'08:37',timezone:'Asia/Shanghai'}});
// 固定结构样例与纳甲预期来自 bopo/najia 的 const.py 与 tests/test_najia.py，未由待测程序生成。
test('乾、泰、晋、大有的八宫世应含游魂归魂固定案例',()=>{
 for(const [bits,name,palace,stage,shi,ying] of [['111111','乾为天','乾','本宫',6,3],['111000','地天泰','坤','三世',3,6],['000101','火地晋','乾','游魂',4,1],['111101','火天大有','乾','归魂',3,6]]) {
  const h=hexagram(bits);assert.equal(h.name,name);assert.equal(h.palace.trigram,palace);assert.equal(h.palace.stage,stage);assert.equal(h.palace.shi_line,shi);assert.equal(h.palace.ying_line,ying);
 }
});
test('离卦纳甲与金克木六亲固定样例',()=>{assert.deepEqual(najia('101101'),['己卯','己丑','己亥','己酉','己未','己巳']);assert.equal(relative('金','木'),'妻财');});
test('六十四卦分别归属唯一八宫、各宫八卦、世应距离为三爻',()=>{
 const names=new Set(),counts={};for(let n=0;n<64;n++){const bits=Array.from({length:6},(_,i)=>String((n>>i)&1)).join('');const h=hexagram(bits);names.add(h.name);counts[h.palace.trigram]=(counts[h.palace.trigram]||0)+1;assert.equal(Math.abs(h.palace.shi_line-h.palace.ying_line),3);assert.equal(najia(bits).length,6);}
 assert.equal(names.size,64);assert.deepEqual(Object.values(counts),Array(8).fill(8));
});
test('4096 种爻值组合：仅老阴老阳翻转，六个位置保持初爻到上爻',()=>{
 for(let n=0;n<4096;n++){let k=n;const values=Array.from({length:6},()=>{const v=6+k%4;k=Math.floor(k/4);return v;});const r=castingHexagrams(values);for(let i=0;i<6;i++){const old=[6,9].includes(values[i]);assert.equal(r.base_bits[i]===r.changed_bits[i],!old);assert.equal(r.base_bits[i],values[i]===7||values[i]===9?'1':'0');}assert.ok(hexagram(r.base_bits).name);assert.ok(hexagram(r.changed_bits).name);}
});
test('铜钱原始结果守恒，正面 3 / 反面 2 映射四类爻值',()=>{
 const i=input([6,7,8,9,6,9]);i.casting={coins:[[2,2,2],[3,2,2],[3,3,2],[3,3,3],[2,2,2],[3,3,3]]};const d=build(i);assert.deepEqual(d.chart.lines.map(l=>l.value),[6,7,8,9,6,9]);assert.deepEqual(d.calculations.moving_lines,[1,4,5,6]);assert.deepEqual(d.input.casting,i.casting);
});
test('全老阳乾变坤，变爻六亲用本卦乾金而非变卦坤土',()=>{
 const d=build(input(Array(6).fill(9)));assert.equal(d.chart.base.name,'乾为天');assert.equal(d.chart.changed.name,'坤为地');assert.equal(d.chart.changed.palace.element,'土');assert.equal(d.chart.lines[0].changed.relative_to_base_palace,'父母');assert.equal(d.chart.lines[0].changed.najia,'乙未');
});
test('历法固定案例：戊子月辛巳日、申酉旬空与白虎起六神',()=>{
 const d=build(input());assert.equal(d.chart.calendar.month_ganzhi,'戊子');assert.equal(d.chart.calendar.day_ganzhi,'辛巳');assert.deepEqual(d.chart.calendar.void_branches,['申','酉']);assert.equal(d.chart.lines[0].spirit,'白虎');assert.deepEqual(voidBranches('甲子'),['戌','亥']);
});
test('十天干六神起点与上游固定表一致',()=>{const expected=['青龙','青龙','朱雀','朱雀','勾陈','螣蛇','白虎','白虎','玄武','玄武'];[...'甲乙丙丁戊己庚辛壬癸'].forEach((g,i)=>{assert.equal(sixSpirits(g)[0],expected[i]);assert.equal(new Set(sixSpirits(g)).size,6);});});
test('23 点换日可配置，拒绝不存在与重复夏令时时刻',()=>{
 const i=input();i.time={date:'1988-02-15',time:'23:30',timezone:'+08:00'};assert.equal(build(i).chart.calendar.day_ganzhi,'庚子');i.options={day_boundary:'late_zi'};assert.equal(build(i).chart.calendar.day_ganzhi,'辛丑');
 for(const date of ['2024-03-10','2024-11-03']){const j=input();j.time={date,time:date.includes('03-10')?'02:30':'01:30',timezone:'America/New_York'};assert.throws(()=>build(j),/夏令时/);}
});
test('月建按节气瞬间，跨时区同一瞬间的月柱相同',()=>{
 const a=input(),b=input();a.time={date:'2024-02-04',time:'16:27:07',timezone:'+08:00'};b.time={date:'2024-02-04',time:'00:27:07',timezone:'-08:00'};assert.equal(build(a).chart.calendar.month_ganzhi,build(b).chart.calendar.month_ganzhi);assert.equal(build(a).chart.calendar.month_ganzhi,'丙寅');
});
test('非法爻值、顺序长度、重复输入、随机请求与未知配置均拒绝',()=>{
 for(const lines of [[7,7],[7,7,7,7,7,10],[7,7,7,7,7,'9']])assert.throws(()=>build(input(lines)));
 for(const change of [i=>i.casting.coins=Array(6).fill([2,2,2]),i=>i.casting={coins:Array(6).fill([1,2,3])},i=>i.method='random',i=>i.casting={seed:'123'},i=>i.options={day_boundary:''},i=>i.options=null,i=>i.options={true_solar:true},i=>i.question='',i=>i.time.date='2024-02-30']){const i=input();change(i);assert.throws(()=>build(i));}
});
test('伏神只补本卦缺失六亲，六爻账本有对应证据且不输出概率',()=>{
 const d=build(input([8,7,8,8,7,8]));const present=new Set(d.chart.lines.map(l=>l.relative));for(const h of d.calculations.hidden_relatives)assert.ok(!present.has(h.relative));assert.equal(d.calculations.line_ledger.length,6);assert.ok(d.calculations.line_ledger.every(x=>d.chart.lines.some(l=>l.id===x.line_id)));assert.equal(d.calculations.success_probability,undefined);
});
test('报告重算识别改动，即使重新生成摘要也不能绕过',()=>{
 const d=build(input());assert.equal(validateArtifact(d),d.checksum.value);d.chart.base.name='伪造';assert.throws(()=>validateArtifact(d),/校验和/);const {checksum,...payload}=d;d.checksum.value=digest(payload);assert.throws(()=>validateArtifact(d),/重算/);
});
test('占问标签 HTML 转义，报告按上到下展示而 JSON 原始顺序不变',()=>{
 const i=input([9,8,7,8,7,8]);i.question='<script>alert(1)</script>';i.label='<img src=x onerror=alert(1)>';const d=build(i);const r=makeReport(d);assert.ok(!r.html.includes('<script>')&&!r.html.includes('<img src=x'));assert.ok(r.html.includes('&lt;script&gt;'));assert.ok(r.markdown.indexOf('LY-L6')<r.markdown.indexOf('LY-L1'));assert.deepEqual(d.chart.lines.map(l=>l.position),[1,2,3,4,5,6]);
});
test('统一 CLI 完成六爻生成与重算，不影响已有八字紫微接口',()=>{
 const dir=temporary;fs.mkdirSync(dir,{recursive:true});const f=path.join(dir,'input.json');fs.writeFileSync(f,JSON.stringify(input()));const {main}=require('../scripts/run.cjs');const saved=console.log;const outputs=[];console.log=x=>outputs.push(JSON.parse(x));try{main(['--input',f,'--out',path.join(dir,'result'),'--report']);main(['--verify',path.join(dir,'result/chart.json')]);}finally{console.log=saved;}assert.equal(outputs[0].mode,'divination');assert.equal(outputs[1].recalculated,true);assert.ok(fs.existsSync(path.join(dir,'result/report.html')));
});
