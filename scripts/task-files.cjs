'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const {ROOT,check}=require('./runtime-core.cjs');
const LOCK='.suanming-task.lock';
function actualPath(file){
 const absolute=path.resolve(file);let ancestor=absolute;
 while(!fs.existsSync(ancestor)){const parent=path.dirname(ancestor);check(parent!==ancestor,'无法解析输出路径');ancestor=parent;}
 return path.resolve(fs.realpathSync(ancestor),path.relative(ancestor,absolute));
}
function samePath(a,b){return process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;}
function inside(file,root){const rel=path.relative(root,file);return rel===''||(!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep));}
function identity(file){try{const s=fs.statSync(file);return {dev:s.dev,ino:s.ino};}catch(e){if(e.code==='ENOENT')return null;throw e;}}
function assertOutputs(source,targets){
 const realSource=source?actualPath(source):null,sourceStat=source?identity(source):null;
 for(const target of targets){
  const realTarget=actualPath(target),targetStat=identity(target);
  check(!inside(realTarget,actualPath(ROOT)),'任务结果不能写入技能包');
  check(!realSource||(!samePath(realSource,realTarget)&&!(sourceStat&&targetStat&&sourceStat.dev===targetStat.dev&&sourceStat.ino===targetStat.ino)),'输出不能覆盖输入或复用命盘；请使用另一个输出目录');
 }
}
function busy(){const e=new Error('任务目录正在使用，或锁记录需要检查；请稍后重试或使用独立任务目录');e.code='task_busy';return e;}
function record(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
function alive(pid){if(!Number.isSafeInteger(pid)||pid<1)return true;try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}}
function abandoned(r){return r?.hostname===os.hostname()&&typeof r.token==='string'&&!alive(r.pid);}
function create(file){
 const token=crypto.randomBytes(16).toString('hex'),fd=fs.openSync(file,'wx',0o600);
 try{fs.writeFileSync(fd,JSON.stringify({pid:process.pid,hostname:os.hostname(),token,created_at:new Date().toISOString()}));}
 catch(e){fs.closeSync(fd);fs.unlinkSync(file);throw e;}
 fs.closeSync(fd);return token;
}
function release(file,token){if(record(file)?.token===token)fs.unlinkSync(file);}
function acquire(dir){
 fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,LOCK);let token;
 try{token=create(file);}catch(e){
  if(e.code!=='EEXIST')throw e;
  if(!abandoned(record(file)))throw busy();
  // Serialize recovery, then recheck the owner before removing an abandoned lock.
  const gate=file+'.recover';let gateToken;
  try{gateToken=create(gate);}catch(error){if(error.code==='EEXIST')throw busy();throw error;}
  try{
   if(!abandoned(record(file)))throw busy();
   fs.unlinkSync(file);
   try{token=create(file);}catch(error){if(error.code==='EEXIST')throw busy();throw error;}
  }finally{release(gate,gateToken);}
 }
 return ()=>release(file,token);
}
function acquireTaskLocks(dirs){
 const releases=[];
 const cleanup=()=>{for(const releaseLock of releases.splice(0).reverse())releaseLock();};
 try{for(const dir of [...new Set(dirs.map(actualPath))].sort())releases.push(acquire(dir));return cleanup;}
 catch(e){cleanup();throw e;}
}
function withTaskLocks(dirs,operation){const unlock=acquireTaskLocks(dirs);try{return operation();}finally{unlock();}}
module.exports={actualPath,inside,assertOutputs,acquireTaskLocks,withTaskLocks,LOCK};
