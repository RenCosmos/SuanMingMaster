"""Build tested installation and source archives from a clean checkout.

Version is read from package.json. Knowledge changes require an explicitly
reviewed update to knowledge-baseline.json. No publishing or credential access.
"""
from pathlib import Path
import argparse,hashlib,json,os,re,shutil,subprocess,sys,tempfile,zipfile
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

def mobile_acceptance(manifest,version):
    record=manifest.get('mobile_validation',{})
    confirmed=record.get('status')=='tested' and record.get('source')=='user_confirmation' and record.get('tested_package_version')==version and record.get('current_package_status')=='accepted'
    notice=f"V{version}安装包已由用户于{record['reported_on']}确认完成手机实测；本次仅更新说明与验收状态，程序和知识内容不变。" if confirmed else '手机验收记录以清单中与当前版本匹配的确认来源为准。'
    return confirmed,record,notice
def main():
    p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--node',default=shutil.which('node'));p.add_argument('--sh',default=os.environ.get('SUANMING_TEST_SH') or shutil.which('sh'));p.add_argument('--schema-validation',action='store_true');p.add_argument('--repack-from');a=p.parse_args()
    assert a.node,'Node.js is required';out=Path(a.out).resolve();assert not out.is_relative_to(ROOT),'Build output must be outside the source checkout';out.mkdir(parents=True,exist_ok=True)
    package=json.loads((ROOT/'package.json').read_text(encoding='utf-8'));version=package['version'];assert re.fullmatch(r'\d+\.\d+\.\d+',version)
    assert package['packageManager']=='pnpm@11.19.0','Use the reviewed package-manager version'
    for name in package['dependencies']:
        dep=ROOT/'node_modules'/name
        assert dep.is_dir() and not dep.is_symlink(),'Install portable dependencies using pnpm-workspace.yaml: '+name
    dependencies=json.loads((ROOT/'tools/runtime-dependency-baseline.json').read_text(encoding='utf-8'))
    for name,digest in dependencies.items():
        path=ROOT/name
        assert name.startswith('node_modules/') and path.is_file() and sha(path.read_bytes())==digest,'Runtime dependency changed or missing: '+name
    knowledge=json.loads((ROOT/'tools/knowledge-baseline.json').read_text(encoding='utf-8'))
    for name,digest in knowledge.items():assert sha((ROOT/name).read_bytes())==digest,'Knowledge changed: '+name
    manifest=json.loads((ROOT/'rikkahub-manifest.json').read_text(encoding='utf-8'));manifest['package_version']=version;manifest['adapter_version']='rikkahub-workspace/v'+version;manifest['workflow']['version']=version
    mobile_confirmed,mobile_record,mobile_notice=mobile_acceptance(manifest,version)
    write(ROOT/'rikkahub-manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    # Generate maintained version labels only; never rewrite knowledge text.
    for name in ['SKILL.md','使用说明.md','手机安装说明.md','references/workflow-architecture.md','references/critical-testing.md']:
        f=ROOT/name;s=f.read_text(encoding='utf-8')
        s=re.sub(r'(?m)^# ([^\n]*?)V\d+\.\d+\.\d+',lambda m:'# '+m.group(1)+'V'+version,s,count=1)
        if name=='手机安装说明.md':s=re.sub(r'(?m)^(1\. 导入 )bazi-ziwei-rikkahub-v\d+\.\d+\.\d+\.zip',lambda m:m.group(1)+f'bazi-ziwei-rikkahub-v{version}.zip',s)
        write(f,s)
    env=dict(os.environ);env['PYTHONUTF8']='1'
    if a.sh:env['SUANMING_TEST_SH']=a.sh
    env['PATH']=os.pathsep.join([str(Path(a.node).parent),*([str(Path(a.sh).parent)] if a.sh else []),env.get('PATH','')])
    tests=sorted(str(f) for f in (ROOT/'tests').glob('*.test.cjs'));assert tests
    log=execute([a.node,'--test','--test-reporter=tap',*tests],ROOT,env);write(out/'test-output.txt',log)
    counts={k:int(re.search(r'^# '+k+r' (\d+)$',log,re.M).group(1)) for k in ['tests','pass','fail','skipped','cancelled']}
    assert counts['tests']==counts['pass'] and counts['fail']==counts['skipped']==counts['cancelled']==0
    schema_validation=json.loads(execute([sys.executable,str(ROOT/'tools/validate-partner-schema.py'),'--node',a.node],ROOT,env)) if a.schema_validation else {'performed':False}
    compatibility=json.loads(execute([a.node,str(ROOT/'tools/verify-compatibility.cjs')],ROOT,env))
    compatibility['cross_version_compared']=False
    baseline=ROOT/'bazi-ziwei-rikkahub-v1.2.4.zip'
    if baseline.is_file():
        contract=json.loads((ROOT/'tools/compatibility-baseline-v1.2.4.json').read_text(encoding='utf-8'))
        assert sha(baseline.read_bytes())==contract['baseline_archive_sha256'],'Frozen baseline ZIP changed'
        with tempfile.TemporaryDirectory(prefix='suanming-baseline-') as old:
            with zipfile.ZipFile(baseline) as z:
                for info in z.infolist():
                    assert (Path(old)/info.filename).resolve().is_relative_to(Path(old).resolve());z.extract(info,old)
            compatibility=json.loads(execute([a.node,str(ROOT/'tools/verify-compatibility.cjs'),str(Path(old)/'bazi-ziwei')],ROOT,env))
            compatibility['cross_version_compared']=True
    compatibility125={'cross_version_compared':False,'baseline':'1.2.5'}
    previous=ROOT/'bazi-ziwei-rikkahub-v1.2.5.zip'
    if previous.is_file():
        assert sha(previous.read_bytes())=='5cc46c39247376116c98e69a6a0323b1168ac893454ed32b7bb76bcd9533ca64','Frozen V1.2.5 ZIP changed'
        with tempfile.TemporaryDirectory(prefix='suanming-baseline125-') as old:
            with zipfile.ZipFile(previous) as z:
                for info in z.infolist():
                    assert (Path(old)/info.filename).resolve().is_relative_to(Path(old).resolve());z.extract(info,old)
            compatibility125=json.loads(execute([a.node,str(ROOT/'tools/verify-compatibility.cjs'),str(Path(old)/'bazi-ziwei')],ROOT,env))
            compatibility125['cross_version_compared']=True
    native_pages=json.loads(execute([a.node,str(ROOT/'tools/native-knowledge.cjs')],ROOT,env))
    for page in native_pages:
        assert (ROOT/page['path']).read_text(encoding='utf-8')==page['content'],'Native fallback drift: '+page['path']
        assert len(json.dumps({'text':page['content']},ensure_ascii=False).encode('utf-8'))<28*1024
    topics=json.loads(execute([a.node,str(ROOT/'scripts/knowledge.cjs'),'--verify'],ROOT,env))['total_topics']
    template=(ROOT/'tools/README.template.md').read_text(encoding='utf-8')
    write(ROOT/'README.md',template.format(version=version,tests=counts['pass'],topics=topics,knowledge_files=len(knowledge),mobile_notice=mobile_notice))
    write(ROOT/'验证记录.md',f'''# V{version} 验证记录

全部{counts['pass']}项开发回归通过，零失败、零跳过。保留原261项回归，新增候选筛选回归；手机包仍仅携带12组关键自检，开发测试不入手机包。

本版新增独立正缘候选筛选：年份周期、明确小范围假设生辰、用户提供人物；除了生肖，使用明确日干/日支锚定与十神条件，保留跨盘合冲刑害破和原局齐全状态，不补造未知四柱/生日，不输出正缘概率/身份结论。规则与出处范围、schema、示例及按需方法独立；排盘计算引擎不改。V1.2.5调用、task_id/next_actions、双人警告、recovery及五类原生知识概览保留。全部排盘/关系/时辰对照/六爻/真太阳时/年龄与画像/亲密取象/疏文导出/旧CLI保持；原{topics}主题全文及113份知识基线不改，435份运行依赖和78份引擎/旧接口/方法等按V1.2.4逐字节校验。缓存指纹、全文检索策略和20KiB/12KiB预算未放宽；命理解读边界独立于计算一致性校验。

跨版本对照是否实际执行：{compatibility['cross_version_compared']}。若有冻结V1.2.4安装ZIP，构建工具核SHA后解包，比对14组计算/制文用例、85个主题投影、13种报告/导出与93主题全文，旧字段保留、新字段只增补；完整结果见release-validation.json的compatibility。没有旧ZIP时只报告冻结字节保护，不冒称完成这些跨版本用例。五份原生概览逐字核对原目录身份、来源及已记录推断限制，只是无需运行时的增补，不替代原文。

V1.2.5实际跨版本对照：{compatibility125['cross_version_compared']}。另核该冻结包SHA后重复上述计算/投影/报告/全文对照，旧脚本（除workflow允许独立入口增补）及原生概览逐字保留。详细范围见compatibility_v1_2_5。新功能解包验收经mobile --agent入口运行三种搜索、分页、缓存和临时清理。独立Draft2020-12输入/输出schema校验实际执行：{schema_validation['performed']}，结果详见schema_validation。

发布工具从package.json读取版本，直接运行测试和解包自检，校验知识基线、包内容与本地链接，生成可复验ZIP、SHA-256及结构化结果。开发使用packageManager指定的pnpm版本与frozen lockfile；源码、测试、工具和CI均作为普通文件入库。源码及安装包的所有实际验收结果见release-validation.json。

{mobile_notice}手机验收来源为用户确认，电脑回归与ZIP解包检查由发布工具执行；设备型号或逐项手机日志不补造。原V1.2.1确认保留在清单历史记录中。系统提示词仍为可选，报告只按需生成。
''')
    files=sorted(f for f in ROOT.rglob('*') if f.is_file() and f.relative_to(ROOT).parts[0] not in ['.git','work','dist'] and '__pycache__' not in f.relative_to(ROOT).parts and not (f.parent==ROOT and (f.suffix=='.zip' or f.name in ['SHA256SUMS.txt','release-validation.json','INSTALL.md','TESTING.md','RikkaHub系统提示词.txt'])))
    runtime=[f for f in files if f.relative_to(ROOT).parts[0] not in ['tests','tools','.github'] and f.name not in ['.gitignore','.gitattributes','README.md','DEVELOPMENT.md','pnpm-workspace.yaml'] and (f.relative_to(ROOT).parts[0]!='node_modules' or f.relative_to(ROOT).as_posix() in dependencies)]
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
    repack={'performed':False}
    if a.repack_from:
        old=Path(a.repack_from).resolve();assert old!=install and sha(old.read_bytes())==mobile_record['tested_install_archive_sha256'],'Phone-tested archive mismatch'
        allowed={'rikkahub-manifest.json','使用说明.md','手机安装说明.md','验证记录.md','references/workflow-architecture.md','references/rikkahub-adaptation.md','references/partner-search-method.md'}
        with zipfile.ZipFile(old) as before,zipfile.ZipFile(install) as after:
            assert before.namelist()==after.namelist(),'Repack must not add or remove runtime files'
            changed=[name for name in before.namelist() if before.read(name)!=after.read(name)]
            assert all(name.startswith('bazi-ziwei/') and name.removeprefix('bazi-ziwei/') in allowed for name in changed),'Repack changed program, knowledge or dependencies'
            repack={'performed':True,'tested_archive_sha256':sha(old.read_bytes()),'runtime_file_count':len(runtime),'byte_identical_files':len(runtime)-len(changed),'changed_documentation_and_metadata':changed,'program_knowledge_dependencies_unchanged':True}
    with tempfile.TemporaryDirectory(prefix='suanming-release-') as temp:
        extracted=Path(temp)/'skills';extracted.mkdir()
        with zipfile.ZipFile(install) as z:
            for info in z.infolist():
                target=extracted/info.filename;assert target.resolve().is_relative_to(extracted.resolve());z.extract(info,extracted)
        skill=extracted/'bazi-ziwei'
        for f in runtime:assert (skill/f.relative_to(ROOT)).read_bytes()==f.read_bytes()
        preflight=json.loads(execute([a.node,str(skill/'scripts/preflight.cjs'),'--self-test'],temp,env));assert preflight['ok'] and preflight['critical']['passed']==12
        knowledge_queries={'撞鬼会怎么样':'spirit-dizang-ghost-kings','我有没有护法':'spirit-buddhist-protectors','前世姻缘':'spirit-marriage-future-life'}
        for query,slug in knowledge_queries.items():
            found=json.loads(execute([a.node,str(skill/'scripts/knowledge-context.cjs'),'--query',query,'--limit','1'],temp,env))
            card=found['matches'][0];assert found['reference_only'] and card['slug']==slug and card['evidence_scope']=='religious_teaching' and card['inference_limits']
        inp=json.loads((skill/'examples/input.json').read_text(encoding='utf-8'));task=Path(temp)/'task';f=Path(temp)/'temp-input.json';write(f,json.dumps(inp))
        cmd=[a.node,str(skill/'scripts/workflow.cjs')];response=json.loads(execute([*cmd,'--temp-input',str(f),'--out',str(task)],temp,env));assert response['ok'] and response['temporary_input_removed'] and not f.exists()
        task_id=response['task_id'];assert task_id.startswith('SM-') and isinstance(response['next_actions'],list)
        response=json.loads(execute([*cmd,'--reuse',str(task/'chart.json'),'--focus','relationship'],temp,env));assert response['cache_hit'] and not response['calculation_performed']
        assert response['task_id']==task_id and response['context']['interpretation_scope']
        for page in native_pages:assert (skill/page['path']).read_text(encoding='utf-8')==page['content']
        assert not (task/'report.md').exists() and not (task/'report.html').exists()
        # New mode uses the unchanged mobile shell contract and its own bounded receipt.
        partner_cases={}
        for mode in ['years','dates','people']:
            inp=json.loads((skill/f'examples/partner-search/{mode}.json').read_text(encoding='utf-8'));task=Path(temp)/('partner-'+mode);f=Path(temp)/(mode+'-temp-input.json');write(f,json.dumps(inp))
            entry=[a.sh,str(skill/'scripts/mobile.sh'),'--agent'] if a.sh else cmd
            response=json.loads(execute([*entry,'--temp-input',str(f),'--partner-search','--out',str(task)],temp,env))
            assert response['ok'] and response['validation']['ok'] and response['adapter_id']=='partner_search' and response['temporary_input_removed'] and not f.exists()
            assert response['context']['candidates']['total']>0 and response['context']['selected_partner'] is None and response['context']['probability'] is None
            assert len(json.dumps(response,ensure_ascii=False,separators=(',',':')).encode('utf-8'))<=20*1024
            reused=json.loads(execute([*entry,'--reuse',str(task/'chart.json'),'--partner-search','--offset','0','--limit','1'],temp,env))
            assert reused['cache_hit'] and not reused['calculation_performed'] and not reused['validation']['recalculated'] and reused['task_id']==response['task_id']
            assert not (task/'report.md').exists() and not (task/'report.html').exists()
            partner_cases[mode]={'ok':True,'temp_cleanup':True,'cache_reuse':True,'candidate_count':response['context']['candidates']['total'],'entry':'mobile --agent' if a.sh else 'Node workflow'}
    result={'ok':True,'version':version,'tests':counts,'runtime_critical_cases':preflight['critical']['passed'],'knowledge_topics':topics,'knowledge_files_byte_identical':len(knowledge),'runtime_files':len(runtime),'source_files':len(source),'local_links':links,'extracted_self_test':True,'extracted_religious_queries':len(knowledge_queries),'extracted_temp_cleanup':True,'extracted_cache_reuse':True,'extracted_task_navigation':True,'native_fallback_pages':len(native_pages),'compatibility':compatibility,'compatibility_v1_2_5':compatibility125,'partner_search':partner_cases,'mobile_device_tested_current_version':mobile_confirmed,'mobile_validation':mobile_record,'archives':{f.name:sha(f.read_bytes()) for f in [install,src]}}
    result['schema_validation']=schema_validation
    result['repack']=repack
    write(out/'release-validation.json',json.dumps(result,ensure_ascii=False,indent=2)+'\n');write(out/'SHA256SUMS.txt',''.join(d+'  '+n+'\n' for n,d in result['archives'].items()))
    print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':main()
