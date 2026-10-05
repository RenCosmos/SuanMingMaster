"""Build tested installation and source archives from a clean checkout.

Version is read from package.json. Knowledge changes require an explicitly
reviewed update to knowledge-baseline.json. No publishing or credential access.
"""
from pathlib import Path
import argparse,hashlib,json,os,re,shutil,subprocess,tempfile,zipfile
ROOT=Path(__file__).resolve().parents[1]
def sha(data):return hashlib.sha256(data).hexdigest()
def write(path,text):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text,encoding='utf-8',newline='\n')
def execute(args,cwd,env):
    r=subprocess.run(args,cwd=cwd,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',errors='replace',timeout=180)
    if r.returncode:raise RuntimeError(f'Command failed ({r.returncode}): {args[0]}\n{r.stdout[-8000:]}\n{r.stderr[-4000:]}')
    return r.stdout
def archive(path,files,prefix):
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for file in files:
            info=zipfile.ZipInfo(prefix+'/'+file.relative_to(ROOT).as_posix(),(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
            z.writestr(info,file.read_bytes())
    with zipfile.ZipFile(path) as z:assert z.testzip() is None
def main():
    p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--node',default=shutil.which('node'));p.add_argument('--sh',default=os.environ.get('SUANMING_TEST_SH'));a=p.parse_args()
    assert a.node,'Node.js is required';out=Path(a.out).resolve();assert not out.is_relative_to(ROOT),'Build output must be outside the source checkout';out.mkdir(parents=True,exist_ok=True)
    package=json.loads((ROOT/'package.json').read_text(encoding='utf-8'));version=package['version'];assert re.fullmatch(r'\d+\.\d+\.\d+',version)
    assert package['packageManager']=='pnpm@11.19.0','Use the reviewed package-manager version'
    knowledge=json.loads((ROOT/'tools/knowledge-baseline.json').read_text(encoding='utf-8'))
    for name,digest in knowledge.items():assert sha((ROOT/name).read_bytes())==digest,'Knowledge changed: '+name
    manifest=json.loads((ROOT/'rikkahub-manifest.json').read_text(encoding='utf-8'));manifest['package_version']=version;manifest['adapter_version']='rikkahub-workspace/v'+version;manifest['workflow']['version']=version
    write(ROOT/'rikkahub-manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    # Generate maintained version labels only; never rewrite knowledge text.
    for name in ['SKILL.md','使用说明.md','手机安装说明.md','references/workflow-architecture.md','references/critical-testing.md']:
        f=ROOT/name;s=f.read_text(encoding='utf-8')
        s=re.sub(r'(?m)^# ([^\n]*?)V\d+\.\d+\.\d+',lambda m:'# '+m.group(1)+'V'+version,s,count=1)
        if name=='手机安装说明.md':s=re.sub(r'(?m)^(1\. 导入 )bazi-ziwei-rikkahub-v\d+\.\d+\.\d+\.zip',lambda m:m.group(1)+f'bazi-ziwei-rikkahub-v{version}.zip',s)
        write(f,s)
    env=dict(os.environ);env['PYTHONUTF8']='1'
    if a.sh:env['SUANMING_TEST_SH']=a.sh
    tests=sorted(str(f) for f in (ROOT/'tests').glob('*.test.cjs'));assert tests
    log=execute([a.node,'--test','--test-reporter=tap',*tests],ROOT,env);write(out/'test-output.txt',log)
    counts={k:int(re.search(r'^# '+k+r' (\d+)$',log,re.M).group(1)) for k in ['tests','pass','fail','skipped','cancelled']}
    assert counts['tests']==counts['pass'] and counts['fail']==counts['skipped']==counts['cancelled']==0
    topics=json.loads(execute([a.node,str(ROOT/'scripts/knowledge.cjs'),'--verify'],ROOT,env))['total_topics']
    template=(ROOT/'tools/README.template.md').read_text(encoding='utf-8')
    write(ROOT/'README.md',template.format(version=version,tests=counts['pass'],topics=topics,knowledge_files=len(knowledge)))
    write(ROOT/'验证记录.md',f'''# V{version} 验证记录

全部{counts['pass']}项开发回归通过，零失败、零跳过。新增9项运行缺陷回归；手机包仍仅携带12组关键自检，开发测试不入手机包。

修复：统一输出碰撞保护（包含真实路径和硬链接）、有效输入归一化缓存、目录独占锁与已结束进程锁恢复、单次最终摘要发布；统一嵌套重算校验，39个候选基础排盘从158次降到78次。命理算法、口径、固定依赖和{topics}主题知识保持原内容。

发布工具从package.json读取版本，直接运行测试和解包自检，校验知识基线、包内容与本地链接，生成可复验ZIP、SHA-256及结构化结果。开发使用packageManager指定的pnpm版本与frozen lockfile；源码、测试、工具和CI均作为普通文件入库。源码及安装包的所有实际验收结果见release-validation.json。

原V1.2.1安装包的手机测试确认记录保留在清单中，后续版本沿用该工作区方式。系统提示词仍为可选，报告只按需生成。
''')
    files=sorted(f for f in ROOT.rglob('*') if f.is_file() and f.relative_to(ROOT).parts[0] not in ['.git','work','dist'] and '__pycache__' not in f.relative_to(ROOT).parts and not (f.parent==ROOT and (f.suffix=='.zip' or f.name in ['SHA256SUMS.txt','release-validation.json','INSTALL.md','TESTING.md'])))
    runtime=[f for f in files if f.relative_to(ROOT).parts[0] not in ['tests','tools','.github'] and f.name not in ['.gitignore','README.md','DEVELOPMENT.md']]
    source=[f for f in files if f.relative_to(ROOT).parts[0]!='node_modules']
    for f in runtime:
        rel=f.relative_to(ROOT);assert not f.is_symlink()
        assert f.name not in ['chart.json','context.json','validation.json','comparison.json','report.md','report.html','reading.md'] and not f.name.startswith('knowledge-query') and '.tmp-' not in f.name
        if f.suffix=='.sh':assert b'\r' not in f.read_bytes(),rel
    links=0
    for f in runtime:
        if f.suffix!='.md' or any(x in ['node_modules','third-party','examples','supe888-bazi-skills'] for x in f.relative_to(ROOT).parts):continue
        for target in re.findall(r'\]\(([^)]+)\)',f.read_text(encoding='utf-8')):
            target=target.strip().strip('<>')
            if re.match(r'^[a-zA-Z]+:',target) or target.startswith('#'):continue
            from urllib.parse import unquote
            assert (f.parent/unquote(target.split('#')[0])).is_file(),(f,target);links+=1
    install=out/f'bazi-ziwei-rikkahub-v{version}.zip';src=out/f'SuanMingMaster-source-v{version}.zip';archive(install,runtime,'bazi-ziwei');archive(src,source,'SuanMingMaster')
    with tempfile.TemporaryDirectory(prefix='suanming-release-') as temp:
        extracted=Path(temp)/'skills';extracted.mkdir()
        with zipfile.ZipFile(install) as z:
            for info in z.infolist():
                target=extracted/info.filename;assert target.resolve().is_relative_to(extracted.resolve());z.extract(info,extracted)
        skill=extracted/'bazi-ziwei'
        for f in runtime:assert (skill/f.relative_to(ROOT)).read_bytes()==f.read_bytes()
        preflight=json.loads(execute([a.node,str(skill/'scripts/preflight.cjs'),'--self-test'],temp,env));assert preflight['ok'] and preflight['critical']['passed']==12
        inp=json.loads((skill/'examples/input.json').read_text(encoding='utf-8'));task=Path(temp)/'task';f=Path(temp)/'temp-input.json';write(f,json.dumps(inp))
        cmd=[a.node,str(skill/'scripts/workflow.cjs')];response=json.loads(execute([*cmd,'--temp-input',str(f),'--out',str(task)],temp,env));assert response['ok'] and response['temporary_input_removed'] and not f.exists()
        response=json.loads(execute([*cmd,'--reuse',str(task/'chart.json'),'--focus','relationship'],temp,env));assert response['cache_hit'] and not response['calculation_performed']
        assert not (task/'report.md').exists() and not (task/'report.html').exists()
    result={'ok':True,'version':version,'tests':counts,'runtime_critical_cases':preflight['critical']['passed'],'knowledge_topics':topics,'knowledge_files_byte_identical':len(knowledge),'runtime_files':len(runtime),'source_files':len(source),'local_links':links,'extracted_self_test':True,'extracted_temp_cleanup':True,'extracted_cache_reuse':True,'archives':{f.name:sha(f.read_bytes()) for f in [install,src]}}
    write(out/'release-validation.json',json.dumps(result,ensure_ascii=False,indent=2)+'\n');write(out/'SHA256SUMS.txt',''.join(d+'  '+n+'\n' for n,d in result['archives'].items()))
    print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':main()
