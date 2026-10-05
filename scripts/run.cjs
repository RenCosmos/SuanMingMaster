#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');
const {withInputLifecycle,readStdinJson}=require('./input-lifecycle.cjs');
function handlers(data){if(data?.mode==='time_compare'||data?.schema_version==='bazi-ziwei-time-compare/v1')return {...require('./time-compare.cjs'),makeReport:require('./time-compare-report.cjs').makeReport};if(data?.mode==='relationship'||/^bazi-ziwei-relationship\/v[1-4]$/.test(data?.schema_version??''))return {...require('./relationship.cjs'),makeReport:require('./relationship-report.cjs').makeReport};return data?.mode==='divination'||data?.schema_version==='bazi-ziwei-divination/v1'?{...require('./divination.cjs'),makeReport:require('./divination-report.cjs').makeReport}:{...require('./engine.cjs'),makeReport:require('./report.cjs').makeReport};}
function operation(argv) {
  if(argv.length===1 && ['--help','-h'].includes(argv[0]))return 'node scripts/run.cjs --stdin --out OUTPUT_DIR [--report]\nnode scripts/run.cjs --temp-input INPUT.json --out OUTPUT_DIR [--report]\n--stdin 无中间输入文件；--temp-input 成功或异常均清理；--input 保留可复用输入。\n默认生成 chart.json；时辰对照另有 comparison.json 摘要。--report 显式生成报告。\nnode scripts/run.cjs --verify CHART.json\nnode scripts/run.cjs --render CHART.json --out OUTPUT_DIR\nnode scripts/run.cjs --extract CHART.json --candidate TC-001 --out OUTPUT_DIR\n出生输入见 references/input-schema.md，未知时辰见 references/time-compare-method.md。';
  const {readJson,writeJson,check}=require('./common.cjs');
  if(argv.length===2 && argv[0]==='--verify') {
    const file=path.resolve(argv[1]),data=readJson(file);
    if(data.schema_version==='bazi-ziwei-time-summary/v1'){const parent=readJson(path.join(path.dirname(file),'chart.json')),tc=require('./time-compare.cjs');tc.validateArtifact(parent);const hash=tc.validateSummary(data,parent);return {ok:true,checksum:hash,parent_checksum:parent.checksum.value,recalculated:true,summary_verified:true};}
    const h=handlers(data),hash=h.validateArtifact(data),summaryFile=path.join(path.dirname(file),'comparison.json');let summaryVerified;
    if(h.validateSummary){summaryVerified=fs.existsSync(summaryFile);if(summaryVerified)h.validateSummary(readJson(summaryFile),data);}
    return {ok:true,checksum:hash,recalculated:true,...(summaryVerified!==undefined?{summary_verified:summaryVerified}:{})};
  }
  if(argv.length===6&&argv[0]==='--extract'&&argv[2]==='--candidate'&&argv[4]==='--out'){
    const data=readJson(path.resolve(argv[1]));check(data.schema_version==='bazi-ziwei-time-compare/v1','--extract 只用于时辰对照');handlers(data).validateArtifact(data);
    const candidate=data.candidates.find(c=>c.id===argv[3]);check(candidate?.status==='calculated','候选编号不存在或尚不可计算');const out=path.resolve(argv[5]),file=path.join(out,'chart.json');check(file!==path.resolve(argv[1]),'提取不能覆盖对照数据');writeJson(file,candidate.chart);return {ok:true,files:[file],candidate_id:candidate.id,checksum:candidate.chart.checksum.value,report_generated:false};
  }
  if(argv.length===4&&argv[0]==='--render'&&argv[2]==='--out'){
    const chartPath=path.resolve(argv[1]),out=path.resolve(argv[3]),data=readJson(chartPath),h=handlers(data);
    h.validateArtifact(data);const r=h.makeReport(data),files=['report.md','report.html'].map(f=>path.join(out,f));
    check(!files.includes(chartPath),'报告输出不能覆盖计算数据');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(files[0],r.markdown,'utf8');fs.writeFileSync(files[1],r.html,'utf8');
    return {ok:true,files,checksum:data.checksum.value,recalculated:true,report_generated:true};
  }
  const fromStdin=argv[0]==='--stdin';
  const withReport=argv.length===(fromStdin?4:5)&&argv.at(-1)==='--report';
  check((argv.length===(fromStdin?3:4)||withReport) && (fromStdin?argv[1]==='--out':argv[0]==='--input'&&argv[2]==='--out'),'用法：--stdin --out OUTPUT_DIR [--report]；或 --temp-input / --input INPUT.json --out OUTPUT_DIR [--report]；或 --verify CHART.json；或 --render CHART.json --out OUTPUT_DIR');
  const inputPath=fromStdin?null:path.resolve(argv[1]),out=path.resolve(argv[fromStdin?2:3]);
  const input=fromStdin?readStdinJson():readJson(inputPath);const h=handlers(input);
  const outputFiles=['chart.json',...(h.summary?['comparison.json']:[]),...(withReport?['report.md','report.html']:[])].map(f=>path.join(out,f));
  check(!outputFiles.includes(inputPath),'输出路径不能覆盖输入文件');
  const data=h.build(input);const r=withReport?h.makeReport(data):null;
  // 所有计算和渲染完成后才落盘。Skill 必须检查退出码，以免使用之前遗留的旧报告。
  fs.mkdirSync(out,{recursive:true});
  writeJson(outputFiles[0],data);if(h.summary)writeJson(path.join(out,'comparison.json'),h.summary(data));if(r){fs.writeFileSync(path.join(out,'report.md'),r.markdown,'utf8');fs.writeFileSync(path.join(out,'report.html'),r.html,'utf8');}
  return {ok:true,files:outputFiles,checksum:data.checksum.value,mode:data.input.mode,report_generated:withReport};
}
function main(argv){const result=withInputLifecycle(argv,operation);console.log(typeof result==='string'?result:JSON.stringify(result));return result;}
if(require.main===module) {try{main(process.argv.slice(2));}catch(e){console.error(JSON.stringify({ok:false,error:e.message,type:e.code==='cleanup_error'?'cleanup_error':e.code==='input_error'||e.constructor.name==='InputError'?'input_error':'calculation_error'}));process.exitCode=2;}}
module.exports={main};
