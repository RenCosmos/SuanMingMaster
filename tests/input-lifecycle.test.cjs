'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),run=require('../scripts/run.cjs'),knowledge=require('../scripts/knowledge.cjs');
const {withInputLifecycle}=require('../scripts/input-lifecycle.cjs');
function temp(t){const d=fs.mkdtempSync(path.join(os.tmpdir(),'bazi-v112-'));t.after(()=>{const r=path.relative(fs.realpathSync(os.tmpdir()),fs.realpathSync(d));assert.ok(r&&!path.isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+path.sep));fs.rmSync(d,{recursive:true,force:true});});return d;}
function capture(fn){const log=console.log,items=[];console.log=x=>items.push(JSON.parse(x));try{fn();return items[0];}finally{console.log=log;}}
// 文件描述符避免 Windows 沙箱禁止 Node 命名管道的问题；验证文件只在系统临时目录，finally 清理。
function child(args,options={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bazi-v112-child-')),fds=[];
 try{
  const input=path.join(dir,'stdin');fs.writeFileSync(input,options.input||'');
  const out=path.join(dir,'stdout'),err=path.join(dir,'stderr');
  fds.push(fs.openSync(input,'r'),fs.openSync(out,'w'),fs.openSync(err,'w'));
  const {input:unused,...rest}=options;
  const result=spawnSync(process.execPath,args,{timeout:30000,...rest,stdio:fds});
  return {...result,stdout:fs.readFileSync(out,'utf8'),stderr:fs.readFileSync(err,'utf8')};
 }finally{
  for(const fd of fds)fs.closeSync(fd);
  const rel=path.relative(fs.realpathSync(os.tmpdir()),fs.realpathSync(dir));assert.ok(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel));fs.rmSync(dir,{recursive:true,force:true});
 }
}
function cli(script,args,options={}){return child([path.join(root,'scripts',script),...args],options);}
function file(dir,name,data){const p=path.join(dir,name);fs.writeFileSync(p,typeof data==='string'?data:JSON.stringify(data));return p;}
const fixture=name=>require('../examples/'+name);

test('知识 CLI 直接 query/topic/limit 与库接口一致，工作目录不产生文件',t=>{
 const dir=temp(t);for(const args of [['--query','寒暖','--limit','3'],['--limit','2','--query','双修'],['--topic','kb-classic-year-decade']]){
  const r=cli('knowledge.cjs',args,{cwd:dir});assert.equal(r.status,0,r.stderr);const data=JSON.parse(r.stdout);
  assert.ok(data.ok);if(args.includes('--topic'))assert.equal(data.topic.slug,'kb-classic-year-decade');else assert.ok(data.matches.length>0&&data.matches.length<=Number(args[args.indexOf('--limit')+1]));
 }assert.deepEqual(fs.readdirSync(dir),[]);
});
test('知识 CLI 拒绝互斥、重复、缺值、非法 limit 和未知参数',()=>{
 for(const args of [['--query','寒暖','--topic','x'],['--query','a','--query','b'],['--limit','0','--query','a'],['--query','a','--limit','3.2'],['--query'],['--topic','--query'],['--input','x','--query','a'],['--unknown','a']])assert.throws(()=>capture(()=>knowledge.main(args)));
});
test('临时知识查询在成功、空命中、JSON 错误与主题错误后均删除',t=>{
 const dir=temp(t);for(const data of [{query:'寒暖',limit:2},{query:'没有这个随机主题xyz'},'{broken',{topic:'no-such-topic'}]){
  const p=file(dir,'knowledge-query2.json',data);
  if(data==='{broken'||data.topic)assert.throws(()=>capture(()=>knowledge.main(['--temp-input',p])));
  else assert.equal(capture(()=>knowledge.main(['--temp-input',p])).temporary_input_removed,true);
  assert.equal(fs.existsSync(p),false);
 }
});
test('六种排盘临时输入自动清理，结果保留并可独立重算',t=>{
 const dir=temp(t),both=fixture('input.json');
 const cases=[{...both,mode:'bazi'},{...both,mode:'ziwei'},both,fixture('liuyao-input.json'),fixture('relationship-single-input.json'),fixture('time-compare-candidates-input.json')];
 cases.forEach((input,i)=>{const p=file(dir,`input-${i}.json`,input),out=path.join(dir,'result-'+i);
  const r=capture(()=>run.main(['--temp-input',p,'--out',out]));assert.ok(r.temporary_input_removed);assert.equal(fs.existsSync(p),false);
  assert.deepEqual(fs.readdirSync(out).sort(),input.mode==='time_compare'?['chart.json','comparison.json']:['chart.json']);
  assert.equal(capture(()=>run.main(['--verify',path.join(out,'chart.json')])).recalculated,true);
 });
});
test('标准输入支持六种模式，无输入文件且默认不生成报告',t=>{
 const dir=temp(t),both=fixture('input.json');const cases=[{...both,mode:'bazi'},{...both,mode:'ziwei'},both,fixture('liuyao-input.json'),fixture('relationship-pair-input.json'),fixture('time-compare-candidates-input.json')];
 cases.forEach((input,i)=>{const out=path.join(dir,'result-'+i),r=cli('run.cjs',['--stdin','--out',out],{cwd:dir,input:JSON.stringify(input)});
  assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).report_generated,false);
  assert.deepEqual(fs.readdirSync(out).sort(),input.mode==='time_compare'?['chart.json','comparison.json']:['chart.json']);
  assert.equal(JSON.parse(cli('run.cjs',['--verify',path.join(out,'chart.json')]).stdout).recalculated,true);
 });assert.equal(fs.readdirSync(dir).filter(n=>n.endsWith('.json')).length,0);
});
test('标准输入的引号、反引号、美元符号和中文原样进入计算，BOM 可解析',t=>{
 const dir=temp(t),input={...fixture('input.json'),label:'合成 `tag` $() "引号" & 字符'};
 const out=path.join(dir,'result'),r=cli('run.cjs',['--stdin','--out',out,'--report'],{input:'\uFEFF'+JSON.stringify(input)});
 assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(fs.readFileSync(path.join(out,'chart.json'),'utf8')).input.label,input.label);
 assert.equal(JSON.parse(r.stdout).report_generated,true);assert.ok(fs.existsSync(path.join(out,'report.html')));
});
test('临时排盘在 JSON、计算参数、CLI 参数和输出写入错误后均清理',t=>{
 const dir=temp(t),valid=fixture('input.json');
 const cases=[['{broken',[]],[{...valid,birth:{...valid.birth,date:'2024-02-30'}},[]],[valid,['--invalid']]];
 for(const [input,extra] of cases){const p=file(dir,'input.json',input),out=path.join(dir,'not-created');assert.throws(()=>capture(()=>run.main(['--temp-input',p,'--out',out,...extra])));assert.equal(fs.existsSync(p),false);assert.equal(fs.existsSync(out),false);}
 const p=file(dir,'input.json',valid),blocked=file(dir,'blocked-output','owned sentinel');
 assert.throws(()=>capture(()=>run.main(['--temp-input',p,'--out',blocked,'--report'])));assert.equal(fs.existsSync(p),false);assert.equal(fs.readFileSync(blocked,'utf8'),'owned sentinel');
});
test('标准输入无效时停止，不生成任务结果或临时 JSON',t=>{
 const dir=temp(t);for(const input of ['', '{broken', JSON.stringify({mode:'invalid'})]){const out=path.join(dir,'not-created'),r=cli('run.cjs',['--stdin','--out',out],{input,cwd:dir});assert.equal(r.status,2);assert.ok(JSON.parse(r.stderr).error);assert.equal(fs.existsSync(out),false);}assert.deepEqual(fs.readdirSync(dir),[]);
});
test('--input 明确保留可复用文件，临时报告开关不影响 chart 复算',t=>{
 const dir=temp(t),p=file(dir,'saved-input.json',fixture('input.json')),bytes=fs.readFileSync(p),out=path.join(dir,'result');
 capture(()=>run.main(['--input',p,'--out',out]));assert.deepEqual(fs.readFileSync(p),bytes);
 const chart=path.join(out,'chart.json'),chartBytes=fs.readFileSync(chart);capture(()=>run.main(['--render',chart,'--out',out]));assert.deepEqual(fs.readFileSync(chart),chartBytes);
 const q=file(dir,'saved-query.json',{query:'寒暖'});capture(()=>knowledge.main(['--input',q]));assert.ok(fs.existsSync(q));
 const broken=file(dir,'saved-invalid.json','{broken');assert.throws(()=>capture(()=>run.main(['--input',broken,'--out',out])));assert.ok(fs.existsSync(broken));
});
test('结果文件、技能示例、目录和缺值不能被当作临时输入删除',t=>{
 const dir=temp(t);for(const name of ['chart.json','comparison.json','report.md','report.html','reading.md']){const p=file(dir,name,'owned sentinel');assert.throws(()=>capture(()=>run.main(['--temp-input',p,'--out',path.join(dir,'result')])),/结果文件/);assert.equal(fs.readFileSync(p,'utf8'),'owned sentinel');}
 const example=path.join(root,'examples/input.json'),before=fs.readFileSync(example);assert.throws(()=>capture(()=>run.main(['--temp-input',example,'--out',path.join(dir,'result')])),/技能包/);assert.deepEqual(fs.readFileSync(example),before);
 assert.throws(()=>capture(()=>knowledge.main(['--temp-input',dir])),/普通文件/);assert.ok(fs.existsSync(dir));
 assert.throws(()=>run.main(['--temp-input','--out',dir]),/文件路径/);
});
test('执行期间替换的文件保留且报清理错误，避免删除别人的新文件',t=>{
 const dir=temp(t),p=file(dir,'input.json','first');
 assert.throws(()=>withInputLifecycle(['--temp-input',p],()=>{fs.renameSync(p,path.join(dir,'old.json'));file(dir,'input.json','replacement');return {ok:true};}),/替换或修改/);
 assert.equal(fs.readFileSync(p,'utf8'),'replacement');
});
test('放在参数值位置或重复的 temp-input 不取得文件清理权限',t=>{
 const dir=temp(t),p=file(dir,'input.json',{query:'寒暖'});
 assert.throws(()=>capture(()=>knowledge.main(['--query','--temp-input',p])),/第一项/);assert.ok(fs.existsSync(p));
 assert.throws(()=>capture(()=>knowledge.main(['--temp-input',p,'--temp-input',p])),/只能提供一次/);assert.ok(fs.existsSync(p));
});
test('缺失计算依赖仍触发 finally，CLI 不先打印成功结果',t=>{
 const dir=temp(t),isolated=path.join(dir,'isolated','scripts');fs.mkdirSync(isolated,{recursive:true});
 for(const name of ['input-lifecycle.cjs','run.cjs','knowledge.cjs'])fs.copyFileSync(path.join(root,'scripts',name),path.join(isolated,name));
 for(const name of ['run.cjs','knowledge.cjs']){const p=file(dir,'input.json',name==='run.cjs'?fixture('input.json'):{query:'寒暖'});
  const args=[path.join(isolated,name),'--temp-input',p,...(name==='run.cjs'?['--out',path.join(dir,'result')]:[])];
  const r=child(args);assert.equal(r.status,2,r.error?.message||r.stderr);assert.equal(r.stdout,'');assert.equal(JSON.parse(r.stderr).ok,false);assert.equal(fs.existsSync(p),false);
 }
});
test('SIGINT / SIGTERM / SIGHUP 处理程序清理输入并按中断状态退出',t=>{
 const dir=temp(t);for(const [signal,status] of [['SIGINT',130],['SIGTERM',143],['SIGHUP',129]]){
  const p=file(dir,'input.json',{query:'合成'});
  const code="require(process.argv[1]).withInputLifecycle(['--temp-input',process.argv[2]],()=>process.emit(process.argv[3]));";
  const r=child(['-e',code,path.join(root,'scripts/input-lifecycle.cjs'),p,signal]);assert.equal(r.status,status,r.error?.message||r.stderr);assert.equal(fs.existsSync(p),false);
 }
});
