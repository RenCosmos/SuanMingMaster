'use strict';
// Actual shell routing with network fixtures; no phone or Linux ELF execution claim.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(process.env.SUANMING_TEST_SKILL_ROOT||path.join(__dirname,'..')),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'suanming-runtime-')),sh=process.env.SUANMING_TEST_SH||'sh';
const p=s=>s.replaceAll('\\','/'),quote=s=>"'"+p(s).replaceAll("'","'\\''")+"'";
test.after(()=>{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));fs.rmSync(tmp,{recursive:true,force:true});});
function write(file,body){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body,{mode:0o755});}
function run(script,args,h){const r=cp.spawnSync(sh,[p(script),...args.map(p)],{cwd:tmp,env:h.env,encoding:'utf8',timeout:30000,maxBuffer:256*1024});assert.ifError(r.error);return r;}
function harness(name,{dependencies=false,node=false}={}){
 const base=path.join(tmp,name),skill=path.join(base,'skill'),bin=path.join(base,'bin'),runtime=path.join(base,'runtime'),marker=path.join(base,'network-called');
 fs.mkdirSync(skill,{recursive:true});write(path.join(bin,'node'),node?'#!/bin/sh\nexec '+quote(process.execPath)+' "$@"\n':'#!/bin/sh\nexit 1\n');write(path.join(bin,'uname'),'#!/bin/sh\nprintf "%s\\n" x86_64\n');
 for(const command of ['apt','apt-get','npm','pnpm','curl','wget'])write(path.join(bin,command),'#!/bin/sh\nprintf "%s\\n" '+quote(command)+' >> '+quote(marker)+'\nexit 99\n');
 if(process.platform==='win32'){
  write(path.join(bin,'tar'),'#!/bin/sh\nexec '+quote(path.join(process.env.SystemRoot||'C:\\Windows','System32/tar.exe'))+' "$@"\n');
  const code="const fs=require('node:fs'),crypto=require('node:crypto');const s=fs.readFileSync(0,'utf8').trimEnd();process.exit(crypto.createHash('sha256').update(fs.readFileSync(s.slice(66))).digest('hex')===s.slice(0,64)?0:1);";
  write(path.join(bin,'sha256sum'),'#!/bin/sh\nexec '+quote(process.execPath)+' -e '+quote(code)+'\n');
 }
 fs.mkdirSync(path.join(skill,'scripts'));
 for(const script of ['mobile.sh','install-node.sh'])fs.copyFileSync(path.join(root,'scripts',script),path.join(skill,'scripts',script));
 if(dependencies){for(const directory of ['scripts','references','node_modules'])fs.cpSync(path.join(root,directory),path.join(skill,directory),{recursive:true});fs.copyFileSync(path.join(root,'package.json'),path.join(skill,'package.json'));}
 write(path.join(base,'os-release'),'ID=debian\n');const installer=path.join(skill,'scripts/install-node.sh');fs.writeFileSync(installer,fs.readFileSync(installer,'utf8').replaceAll('/etc/os-release',p(path.join(base,'os-release'))));
 const env={...process.env};for(const key of Object.keys(env))if(key.toUpperCase()==='PATH')delete env[key];env.PATH=[bin,path.dirname(sh)].join(path.delimiter);env.SUANMING_RUNTIME_DIR=p(runtime);delete env.SUANMING_NODE;
 return {base,skill,bin,runtime,marker,installer,env};
}
const mobile=h=>path.join(h.skill,'scripts/mobile.sh');
const noNetwork=h=>assert.equal(fs.existsSync(h.marker),false);
test('standard entry loads bundled dependencies from unrelated cwd',()=>{
 const h=harness('normal',{dependencies:true,node:true}),r=run(mobile(h),['--check'],h);assert.equal(r.status,0,r.stderr);const d=JSON.parse(r.stdout);assert.equal(d.node_source,'system');assert.equal(d.dependency_source,'skill_bundle');assert.equal(d.dependency_download_required,false);assert.equal(path.resolve(d.dependency_directory),path.join(h.skill,'node_modules'));noNetwork(h);
});
test('missing JavaScript bundle directs reimport, not npm in a different folder',()=>{
 const h=harness('deps',{node:true}),r=run(mobile(h),['--check'],h);assert.equal(r.status,2);assert.equal(r.stdout,'');assert.equal(JSON.parse(r.stderr).type,'bundled_dependencies_missing');noNetwork(h);
});
test('missing Node gives online setup action immediately, never downloads inside a query',()=>{
 const h=harness('missing'),r=run(mobile(h),['--check'],h);assert.equal(r.status,2);const d=JSON.parse(r.stderr);assert.equal(d.type,'runtime_missing');assert.ok(d.action.includes('install-node.sh'));noNetwork(h);assert.ok(!fs.existsSync(h.runtime));
});
test('explicit Node location works without globally changing PATH',()=>{
 const h=harness('explicit',{dependencies:true});h.env.SUANMING_NODE=p(process.execPath);const r=run(mobile(h),['--check'],h);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).node_source,'explicit');noNetwork(h);
});
test('unsupported installation OS stops before downloading',()=>{
 const h=harness('os');write(path.join(h.base,'os-release'),'ID=unsupported\n');const r=run(h.installer,[],h);assert.equal(r.status,2);assert.match(r.stderr,/Ubuntu\/Debian/);noNetwork(h);
});
test('missing setup tool names it and guides separate preparation without executing apt',()=>{
 const h=harness('tools');fs.writeFileSync(h.installer,fs.readFileSync(h.installer,'utf8').replace('curl tar sha256sum mktemp','curl __missing_setup_tool__ tar sha256sum mktemp'));const r=run(h.installer,[],h);assert.equal(r.status,2);assert.match(r.stderr,/__missing_setup_tool__/);assert.match(r.stderr,/apt-get/);noNetwork(h);
});
test('one bounded online download verifies and installs; subsequent shell reuses private Node',()=>{
 const h=harness('download',{dependencies:true}),top='node-v22.23.3-linux-x64',payload=path.join(h.base,'payload'),archive=path.join(h.base,'server.tar.gz');write(path.join(payload,top,'bin/node'),'#!/bin/sh\nexec '+quote(process.execPath)+' "$@"\n');
 const tar=cp.spawnSync(sh,['-c',quote(path.join(h.bin,'tar'))+' -czf '+quote(archive)+' -C '+quote(payload)+' '+quote(top)],{encoding:'utf8',env:h.env});assert.equal(tar.status,0,tar.stderr);
 const digest=crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');fs.writeFileSync(h.installer,fs.readFileSync(h.installer,'utf8').replace('1084aa36196bba4c3a5e69a1ee388a6e4ff729dad09445fbcd434b28fe3c24af',digest));
 write(path.join(h.bin,'curl'),'#!/bin/sh\nprintf "%s\\n" "$*" >> '+quote(h.marker)+'\nwhile [ "$1" != -o ]; do shift; done\nshift\ncp '+quote(archive)+' "$1"\n');
 const installed=run(h.installer,[],h);assert.equal(installed.status,0,installed.stderr);assert.match(fs.readFileSync(h.marker,'utf8'),/--max-time 90/);const calls=fs.readFileSync(h.marker,'utf8'),bytes=fs.readFileSync(path.join(h.runtime,'node22/bin/node'));
 for(let i=0;i<2;i++){const r=run(mobile(h),['--check'],h);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).node_source,'workspace_private');}assert.equal(fs.readFileSync(h.marker,'utf8'),calls);assert.deepEqual(fs.readFileSync(path.join(h.runtime,'node22/bin/node')),bytes);
});
test('failed online download is bounded and not retried or replaced by apt/npm',()=>{
 const h=harness('failure'),r=run(h.installer,[],h);assert.notEqual(r.status,0);assert.equal(fs.readFileSync(h.marker,'utf8').trim(),'curl');assert.ok(!fs.existsSync(path.join(h.runtime,'node22')));assert.deepEqual(fs.readdirSync(h.runtime),[]);
});
