#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
function main(argv,root=path.resolve(__dirname,'..')){
 if(argv.length>1||argv.length===1&&argv[0]!=='--critical'){console.error('用法：npm test；npm run test:critical');return 2;}
 const dir=path.join(root,'tests'),names=fs.existsSync(dir)?fs.readdirSync(dir).filter(n=>n.endsWith('.test.cjs')&&fs.statSync(path.join(dir,n)).isFile()).sort():[];
 const files=argv[0]==='--critical'?['critical.test.cjs','critical-cli.test.cjs']:names;
 if(!names.length||files.some(n=>!names.includes(n))){console.error('发布安装包不包含开发测试，未运行任何开发测试。请使用 npm run check 执行12组关键自检；完整回归请下载源码包。');return 2;}
 const r=cp.spawnSync(process.execPath,['--test',...files.map(n=>path.join(dir,n))],{cwd:root,stdio:'inherit'});
 if(r.error){console.error(r.error.message);return 2;}return r.status??2;
}
if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={main};
