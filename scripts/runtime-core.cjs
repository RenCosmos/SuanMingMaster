'use strict';
// Local engine facade. No chart dependency is loaded until an adapter is used.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const VERSION=require('../package.json').version;
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function check(condition,message){if(!condition)throw new Error(message);}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
const ADAPTERS=Object.freeze({
 chart:{input_modes:['both','bazi','ziwei'],schemas:['bazi-ziwei/v1'],module:'engine.cjs',report:'report.cjs'},
 relationship:{input_modes:['relationship'],schemas:['bazi-ziwei-relationship/v4'],module:'relationship.cjs',report:'relationship-report.cjs'},
 time_compare:{input_modes:['time_compare'],schemas:['bazi-ziwei-time-compare/v1'],module:'time-compare.cjs',report:'time-compare-report.cjs'},
 divination:{input_modes:['divination'],schemas:['bazi-ziwei-divination/v1'],module:'divination.cjs',report:'divination-report.cjs'}
});
function adapter(data){
 const entry=Object.entries(ADAPTERS).find(([,v])=>data?.schema_version?v.schemas.includes(data.schema_version):v.input_modes.includes(data?.mode??'both'));
 check(entry,'不支持的计算模式或结果格式');
 const [id,definition]=entry;
 return {id,...definition,load:()=>require('./'+definition.module),render:d=>require('./'+definition.report).makeReport(d)};
}
function integrity(data){
 adapter(data);
 const {checksum,...payload}=data;
 check(checksum?.algorithm==='sha256-canonical-json'&&checksum.value===hash(payload),'计算结果校验和不匹配；请使用原始输入重算');
 return checksum.value;
}
// Bind receipts to the shipped code, rules, pinned dependency versions and runtime.
// Hash small local files, never run self-test or a chart calculation on cache reuse.
function fingerprint(){
 const files=['package.json',...fs.readdirSync(__dirname).filter(n=>n.endsWith('.cjs')).sort().map(n=>'scripts/'+n),
  ...fs.readdirSync(path.join(ROOT,'references')).filter(n=>n.endsWith('.json')).sort().map(n=>'references/'+n)];
 const dependencies=Object.keys(readJson(path.join(ROOT,'package.json')).dependencies).sort().map(name=>{
  const file=path.join(ROOT,'node_modules',name,'package.json');return [name,sha(fs.readFileSync(file))];
 });
 return hash({version:VERSION,files:files.map(n=>[n,sha(fs.readFileSync(path.join(ROOT,n)))]),dependencies,
  runtime:{node:process.versions.node,icu:process.versions.icu,tz:process.versions.tz??null}});
}
function calculationKey(input){
 // Only presentation text is excluded. Topics and every effective calculation option remain part of the key.
 check(input&&typeof input==='object'&&!Array.isArray(input),'计算输入必须是 JSON 对象');
 const h=adapter(input);
 const normalizer=h.id==='time_compare'?raw=>h.load().prepare(raw).input:raw=>h.load().normalizeInput(raw);
 const v=structuredClone(normalizer(input));delete v.label;
 if(v.mode==='relationship'||v.mode==='time_compare'){
  delete v.question;if(v.context)delete v.context.narrative;
  if(v.people)for(const p of v.people)delete p.label;
 }
 return hash(v);
}
function buildAndValidate(input){
 const h=adapter(input),data=h.load().build(input);
 h.load().validateArtifact(data);
 return {data,adapter_id:h.id,validation:{ok:true,method:'recalculated',recalculated:true}};
}
function verify(data){adapter(data).load().validateArtifact(data);return {ok:true,method:'recalculated',recalculated:true};}
function atomicJson(file,data){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const temp=file+'.tmp-'+crypto.randomBytes(8).toString('hex');
 try{fs.writeFileSync(temp,JSON.stringify(data)+'\n',{encoding:'utf8',mode:0o600,flag:'wx'});fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
module.exports={ROOT,VERSION,ADAPTERS,adapter,integrity,fingerprint,calculationKey,buildAndValidate,verify,stable,hash,sha,check,readJson,atomicJson};
