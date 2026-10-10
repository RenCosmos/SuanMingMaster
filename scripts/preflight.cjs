'use strict';
// --check checks the environment; --self-test adds independent critical regressions.
function preflight({selfTest=false}={}) {
 const assert=require('node:assert/strict');
 assert.ok(Number(process.versions.node.split('.')[0])>=20,'需要 Node.js 20 或更新版本');
 assert.ok(process.versions.icu,'需要启用 ICU / Intl 的 Node.js');
 const {Temporal}=require('@js-temporal/polyfill');
 assert.equal(Temporal.ZonedDateTime.from('2000-01-01T12:00:00[Asia/Shanghai]').offset,'+08:00');
 assert.throws(()=>Temporal.ZonedDateTime.from('2024-03-10T02:30:00[America/New_York]',{disambiguation:'reject'}));
 const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..'),dependencyDir=path.join(root,'node_modules');
 for(const name of Object.keys(require('../package.json').dependencies)){
  assert.ok(fs.existsSync(path.join(dependencyDir,name,'package.json')),'包内依赖缺失：'+name+'；重新导入完整安装ZIP，不在工作区安装');
  const resolved=require.resolve(name),relative=path.relative(dependencyDir,resolved);
  assert.ok(relative&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative),'依赖必须来自技能包：'+name);
 }
 const {packageVersion}=require('./common.cjs');
 const engines=Object.fromEntries(Object.keys(require('../package.json').dependencies).map(name=>[name,packageVersion(name)]));
 for(const [name,expected] of Object.entries(require('../package.json').dependencies))assert.equal(engines[name],expected,name+' 依赖版本不匹配');
 const result={ok:true,adapter:'rikkahub-workspace/v'+require('../package.json').version,engine_version:'0.4.0',node:process.versions.node,icu:process.versions.icu,tz_database:process.versions.tz||'not_reported',engines,dependency_source:'skill_bundle',dependency_directory:dependencyDir,node_executable:process.execPath,node_source:process.env.SUANMING_NODE_SOURCE??'direct',dependency_download_required:false,checked:['Node >=20','ICU timezone','DST rejection','pinned dependencies','bundled dependency origin']};
 if(selfTest){result.critical=require('./critical-checks.cjs').runCritical();result.ok=result.critical.ok;result.checked.push(...result.critical.cases.filter(c=>c.ok).map(c=>c.id));}
 return result;
}
if(require.main===module){
 try{
  if(process.argv.slice(2).some(x=>x!=='--self-test'))throw Error('用法：node scripts/preflight.cjs [--self-test]');
  const result=preflight({selfTest:process.argv.includes('--self-test')});console.log(JSON.stringify(result));if(!result.ok)process.exitCode=2;
 }catch(e){console.error(JSON.stringify({ok:false,error:e.message,action:'核对 Node.js、完整安装包、依赖及失败用例编号。'}));process.exitCode=2;}
}
module.exports={preflight};
