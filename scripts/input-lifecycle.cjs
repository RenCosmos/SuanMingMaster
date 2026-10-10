'use strict';
// 只依赖 Node 内置模块，计算依赖加载失败时也能清理已交给本次调用的临时输入。
const fs=require('node:fs'),path=require('node:path');
const ROOT=fs.realpathSync(path.resolve(__dirname,'..'));
const RESULTS=new Set(['chart.json','batch.json','scan-checkpoint.json','context.json','brief.json','validation.json','comparison.json','report.md','report.html','reading.md','shuwen.txt','shuwen.html']);
function fail(message,code='input_error'){const e=new Error(message);e.code=code;throw e;}
function inside(file,root){const rel=path.relative(root,file);return rel===''||(!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep));}
function prepare(file){
 const resolved=path.resolve(file);
 if(RESULTS.has(path.basename(resolved).toLowerCase()))fail('结果文件不能标记为临时输入');
 if(inside(resolved,ROOT))fail('技能包内的示例和资源不能标记为临时输入；请复制到任务目录');
 let initial;
 try{initial=fs.lstatSync(resolved);}catch(e){if(e.code!=='ENOENT')throw e;}
 if(initial){
  if(!initial.isFile()||initial.isSymbolicLink())fail('临时输入必须是普通文件，不能是目录或符号链接');
  if(inside(fs.realpathSync(resolved),ROOT))fail('技能包资源不能标记为临时输入');
 }
 return ()=>{
  let current;try{current=fs.lstatSync(resolved);}catch(e){if(e.code==='ENOENT')return;throw e;}
  if(!initial||!current.isFile()||current.dev!==initial.dev||current.ino!==initial.ino||current.size!==initial.size||current.mtimeMs!==initial.mtimeMs)
   fail('临时输入在执行期间被替换或修改，已保留该文件；请检查本次任务','cleanup_error');
  try{fs.unlinkSync(resolved);}catch(e){if(e.code!=='ENOENT')fail(`临时输入清理失败（${e.code||'unknown'}）；请检查任务目录权限`,'cleanup_error');}
 };
}
function withInputLifecycle(argv,operation){
 const positions=argv.flatMap((v,i)=>v==='--temp-input'?[i]:[]);
 if(positions.length>1)fail('--temp-input 只能提供一次');
 if(!positions.length)return operation(argv);
 if(positions[0]!==0)fail('--temp-input 必须作为第一项输入选项');
 const i=positions[0],file=argv[i+1];
 if(!file||file.startsWith('--'))fail('--temp-input 后须提供文件路径');
 const cleanup=prepare(file),args=[...argv];args[i]='--input';
 const signals={SIGINT:130,SIGTERM:143,SIGHUP:129};
 const listeners=Object.entries(signals).map(([signal,code])=>{
  const listener=()=>{try{cleanup();}catch(e){process.stderr.write(JSON.stringify({ok:false,error:e.message,type:'cleanup_error'})+'\n');process.exit(2);}process.exit(code);};
  process.on(signal,listener);return [signal,listener];
 });
 let result,error;
 try{result=operation(args);}catch(e){error=e;throw e;}
 finally{
  try{cleanup();}catch(e){if(error)e.message=error.message+'；'+e.message;throw e;}
  finally{for(const [signal,listener] of listeners)process.removeListener(signal,listener);}
 }
 return result&&typeof result==='object'?{...result,temporary_input_removed:true}:result;
}
function readStdinJson(){
 const text=fs.readFileSync(0,'utf8').replace(/^\uFEFF/,'');
 try{return JSON.parse(text);}catch{fail('标准输入须为有效的 UTF-8 JSON');}
}
module.exports={withInputLifecycle,readStdinJson};
