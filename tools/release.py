"""Build tested installation and source archives from a clean checkout.

Version is read from package.json. Knowledge changes require an explicitly
reviewed update to knowledge-baseline.json. No publishing or credential access.
"""
from pathlib import Path
import argparse,hashlib,json,os,re,shutil,subprocess,sys,tempfile,zipfile
ROOT=Path(__file__).resolve().parents[1]
def sha(data):return hashlib.sha256(data).hexdigest()
def write(path,text):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text,encoding='utf-8',newline='\n')
def execute(args,cwd,env,input_text=None):
    r=subprocess.run(args,cwd=cwd,env=env,input=input_text,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',errors='replace',timeout=180)
    if r.returncode:raise RuntimeError(f'Command failed ({r.returncode}): {args[0]}\n{r.stdout[-8000:]}\n{r.stderr[-4000:]}')
    return r.stdout
def bounded(stdout,max_bytes):
    assert len(stdout.encode('utf-8'))<=max_bytes,'Packaged stdout exceeds budget'
    shell=json.dumps({'exitCode':0,'stdout':stdout,'stderr':'','timedOut':False},ensure_ascii=False,separators=(',',':'))
    assert len(shell.encode('utf-8'))<28*1024,'Packaged shell envelope exceeds budget'
    data=json.loads(stdout);assert data['ok']
    if 'output' in data:assert data['output']['bytes']==len(stdout.encode('utf-8'))
    return data
def archive(path,files,prefix):
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for file in files:
            info=zipfile.ZipInfo(prefix+'/'+file.relative_to(ROOT).as_posix(),(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
            z.writestr(info,file.read_bytes())
    with zipfile.ZipFile(path) as z:assert z.testzip() is None

def mobile_acceptance(manifest,version):
    record=manifest.get('mobile_validation',{})
    confirmed=record.get('status')=='tested' and record.get('source')=='user_confirmation' and record.get('tested_package_version')==version and record.get('current_package_status')=='accepted'
    notice=f"V{version}安装包已由用户于{record['reported_on']}确认完成手机实测。" if confirmed else '当前版本的桌面回归和解包验收与手机实测分开记录；历史V1.3.0的用户手机确认不自动继承为新版验收。'
    return confirmed,record,notice

def baseline_archive(version):
    name=f'bazi-ziwei-rikkahub-v{version}.zip'
    preferred=ROOT/'tools'/'baselines'/name
    return preferred if preferred.is_file() else ROOT/name
def main():
    p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--node',default=shutil.which('node'));p.add_argument('--sh',default=os.environ.get('SUANMING_TEST_SH') or shutil.which('sh'));p.add_argument('--schema-validation',action='store_true');p.add_argument('--repack-from');a=p.parse_args()
    assert a.node,'Node.js is required';out=Path(a.out).resolve()
    assert not out.is_relative_to(ROOT) or out.is_relative_to(ROOT/'releases'),'Build output must be outside the source checkout or under dedicated releases/'
    out.mkdir(parents=True,exist_ok=True)
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
    reviewed=json.loads((ROOT/'tools/reviewed-changes-v1.3.1.json').read_text(encoding='utf-8'))['files']
    knowledge_amendments={name:reviewed[name] for name in knowledge if name in reviewed}
    for name,digest in knowledge.items():
        amendment=knowledge_amendments.get(name)
        if amendment:assert amendment['old_sha256']==digest,'Frozen knowledge baseline rewritten: '+name
        assert sha((ROOT/name).read_bytes())==(amendment['new_sha256'] if amendment else digest),'Knowledge changed outside reviewed wording: '+name
    manifest=json.loads((ROOT/'rikkahub-manifest.json').read_text(encoding='utf-8'));manifest['package_version']=version;manifest['adapter_version']='rikkahub-workspace/v'+version;manifest['workflow']['version']=version
    mobile_confirmed,mobile_record,mobile_notice=mobile_acceptance(manifest,version)
    write(ROOT/'rikkahub-manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    # Generate maintained version labels only; never rewrite knowledge text.
    for name in ['SKILL.md','使用说明.md','手机安装说明.md','references/agent-workflow-guide.md','references/workflow-architecture.md','references/critical-testing.md']:
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
    baseline=baseline_archive('1.2.4')
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
    previous=baseline_archive('1.2.5')
    if previous.is_file():
        assert sha(previous.read_bytes())=='5cc46c39247376116c98e69a6a0323b1168ac893454ed32b7bb76bcd9533ca64','Frozen V1.2.5 ZIP changed'
        with tempfile.TemporaryDirectory(prefix='suanming-baseline125-') as old:
            with zipfile.ZipFile(previous) as z:
                for info in z.infolist():
                    assert (Path(old)/info.filename).resolve().is_relative_to(Path(old).resolve());z.extract(info,old)
            compatibility125=json.loads(execute([a.node,str(ROOT/'tools/verify-compatibility.cjs'),str(Path(old)/'bazi-ziwei')],ROOT,env))
            compatibility125['cross_version_compared']=True
    native_pages=json.loads(execute([a.node,str(ROOT/'tools/native-knowledge.cjs')],ROOT,env))
    compatibility130={'cross_version_compared':False,'baseline':'1.3.0'}
    previous130=baseline_archive('1.3.0')
    if previous130.is_file():
        assert sha(previous130.read_bytes())=='cfd7b6e8ac78339ededce670bbf9e10c1c6c1276c3055993d8aa57af9198d9c0','Frozen V1.3.0 ZIP changed'
        with tempfile.TemporaryDirectory(prefix='suanming-baseline130-') as old:
            with zipfile.ZipFile(previous130) as z:
                for info in z.infolist():
                    assert (Path(old)/info.filename).resolve().is_relative_to(Path(old).resolve());z.extract(info,old)
            compatibility130=json.loads(execute([a.node,str(ROOT/'tools/verify-compatibility.cjs'),str(Path(old)/'bazi-ziwei')],ROOT,env))
            compatibility130['cross_version_compared']=True
    for page in native_pages:
        assert (ROOT/page['path']).read_text(encoding='utf-8')==page['content'],'Native fallback drift: '+page['path']
        assert len(json.dumps({'text':page['content']},ensure_ascii=False).encode('utf-8'))<28*1024
    knowledge_summary=json.loads(execute([a.node,str(ROOT/'scripts/knowledge.cjs'),'--verify'],ROOT,env));topics=knowledge_summary['total_topics']
    template=(ROOT/'tools/README.template.md').read_text(encoding='utf-8')
    write(ROOT/'README.md',template.format(version=version,tests=counts['pass'],topics=topics,knowledge_files=len(knowledge),mobile_notice=mobile_notice))
    write(ROOT/'验证记录.md',f'''# V{version} 验证记录

全部{counts['pass']}项开发回归通过，零失败、零跳过、零取消。保留原296项用例，新增用户反馈专项回归；对知识总数的旧断言明确扣除4张八字与6张六爻增补卡，继续分别验证原85／93／97主题完整。手机安装包不含tests/，只携带12组关键自检；npm test / test:critical拒绝0用例成功，npm run check不是完整开发回归。

V1.3.1修复范围见[反馈核验](references/feedback-v1.3.1.md)：新建正缘任务必填--out；reuse返回可执行argv；主Skill简化为识别/调用/核对/解读并保留按需细则；知识正文和snippet显式无指令权限。四张八字概念卡保留，另增六张[六爻基础卡](references/liuyao-concepts-index.md)，配套语境消歧、具体术语优先、显式领域过滤及最多一次无命中回退；自动领域只参与排序。原主题、来源及全文入口保留，当前共{topics}主题；113份冻结知识基线不重写，{len(knowledge_amendments)}份文案/目录/索引按旧新SHA审定，其余{len(knowledge)-len(knowledge_amendments)}份逐字一致；435份固定运行依赖未变。

紫微只新增本命与运限年/月界标签，不改变yearDivide或horoscopeDivide配置。2024-02-03 / 02-05 / 02-10三段固定预期通过；旧盘可重算校验、缓存复用且源文件不改。已有标签或柱位被篡改即使重签也拒绝。双人共同摘要共用新增年界元数据，双方原有证据都保留；20KiB stdout、28KiB转义包装和12KiB知识预算不放宽。

冻结V1.2.4字节基线不改，受本次修复影响的有限代码/说明按独立审定旧/新SHA验证；其他冻结文件仍严格相等，不声称78份代码全未改。V1.2.4 / V1.2.5 / V1.3.0实际跨版本对照分别为{compatibility['cross_version_compared']} / {compatibility125['cross_version_compared']} / {compatibility130['cross_version_compared']}。程序对14组计算、85个投影、13种报告/导出和原93主题正文逐项比较；仅允许旧盘缺失的新年界标签、精确报告标签及已审定宗教句子的有限替换，不跳过主题、来源或其他正文。旧命盘本身也由当前验证器实际校验。没有相应旧ZIP时结果明确未执行，详细范围见release-validation.json。

安装包解包后验收12组自检、宗教与概念检索、临时清理、缓存及三种候选搜索；新的argv经真实mobile.sh入口实跑年度、时辰变体和正缘分页。本次另验《礼记·月令》无需domain命中、长路径合盘双方/全部comparison证据、长疏文按原JSON续页还原及完整TXT/HTML导出，完整shell包装与最终清理字段均计入预算。独立Draft2020-12输入/输出schema校验实际执行：{schema_validation['performed']}，记录见schema_validation。五份原生知识概览保留全部主题与来源，仅同步审定措辞和完整性说明，不代替正文；新增概念卡有无需运行时的索引。

V1.3.7新增可选批量日期入口，仅协调原<=31日任务并做日期投影。ANY/ALL条件、全部时辰采样、每月完整chart、原候选引擎1.0.1及旧CLI不改。每月最高／全年最高／所有符合条件分开；命中采样共同关系与变体关系分开，不将前三个时刻代表整天或把命中数量当合婚优劣。批量缓存、恢复、月份／日期／时辰argv分页、防篡改与原盘只读导入回归通过，解包后的真实手机入口批量验收见partner_search_batch。

V1.3.8删除候选报告原未成年人排除文案，不删除计算字段或无法计算的采样提示。新增--plan先提炼年支／日干／日支条件，再对应实际年柱周期；明确理论四柱可交给--batch精确核对原采样点，不将唯一身份边界当查询禁令。批量1.0.1支持可选四柱约束并保留1.0.0无约束旧任务兼容，原候选引擎1.0.1不改。Windows文件标识改为BigInt精确比较，保留真实硬链接保护。新增规划/报告和解包后的完整年份→四柱核验见partner_search_plan。

V1.3.9仅调整宗教对话口吻及其派生资料：沿用户采用的传统回答，不主动争论鬼神有无，不把纯宗教问答转成科学或医学科普，不反复复述内部查核限制。三张卡删除/替换无关存在认证插话，原教义、短引、出处、8主题与7来源保留；不添加个人附身、护法或前世身份认证能力，也不删除防恐吓、胁迫、伤害或治病保证的边界。本版全部scripts/、计算规则、输入输出schema及435份依赖与V1.3.8字节相同；新增维护测试核对审定句子之外的三张卡正文可完整还原。

V1.4.0相对V1.3.9仅同步发布版本与说明；运行脚本、计算规则、知识正文、schema与固定依赖不改。源码与安装包按用户授权上传GitHub，旧文件和历史提交保留不覆盖；当前包和摘要以V1.4.0 Release为准。

{mobile_notice}手机历史确认仅记录用户提供的范围，设备型号或逐项日志不补造。构建工具生成V{version}完整安装包、源码包及验收记录，不自行上传；GitHub同步另按用户授权执行。原V1.3.8下载包与源码保留不覆盖，本次汇集后续检索/合盘/六爻/预算/提示词修复。系统提示词按skill-creator的分层披露原则维护，仍为可选；程序解释规则、原知识功能和完整导出不删。
''')
    batch_scale=json.loads(execute([a.node,str(ROOT/'tools/verify-batch-scale.cjs')],ROOT,env))
    assert batch_scale['ok']
    files=sorted(f for f in ROOT.rglob('*') if f.is_file() and f.relative_to(ROOT).parts[0] not in ['.git','work','dist','archive','releases','.codex','.agents'] and '__pycache__' not in f.relative_to(ROOT).parts and not (f.parent==ROOT and (f.suffix=='.zip' or f.name in ['SHA256SUMS.txt','release-validation.json','INSTALL.md','TESTING.md','RikkaHub系统提示词.txt','最新版本说明.md','工作区整理说明.md'])))
    runtime=[f for f in files if f.relative_to(ROOT).parts[0] not in ['tests','tools','.github'] and f.name not in ['.gitignore','.gitattributes','README.md','DEVELOPMENT.md','AGENTS.md','pnpm-workspace.yaml'] and (f.relative_to(ROOT).parts[0]!='node_modules' or f.relative_to(ROOT).as_posix() in dependencies)]
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
        development_test_guard={}
        for name,args in [('test',[]),('test:critical',['--critical'])]:
            tested=subprocess.run([a.node,str(skill/'scripts/test-runner.cjs'),*args],cwd=temp,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',timeout=30)
            assert tested.returncode==2 and not tested.stdout and 'npm run check' in tested.stderr,'Packaged development tests must not report zero-test success'
            development_test_guard[name]={'exit_code':tested.returncode,'clear_missing_tests_notice':True}
        knowledge_queries={'撞鬼会怎么样':'spirit-dizang-ghost-kings','我有没有护法':'spirit-buddhist-protectors','前世姻缘':'spirit-marriage-future-life'}
        for query,slug in knowledge_queries.items():
            found=json.loads(execute([a.node,str(skill/'scripts/knowledge-context.cjs'),'--query',query,'--limit','1'],temp,env))
            card=found['matches'][0];assert found['reference_only'] and card['slug']==slug and card['evidence_scope']=='religious_teaching' and card['inference_limits']
        concept_queries={'官杀混杂是什么意思':'bazi-authority-mixed','什么叫财多身弱':'bazi-wealth-weak-self','伤官见官是什么意思':'bazi-hurting-officer','如何判断喜用神':'bazi-favorable-god'}
        for query,slug in concept_queries.items():
            found=json.loads(execute([a.node,str(skill/'scripts/knowledge-context.cjs'),'--query',query,'--limit','3'],temp,env))
            assert found['matches'][0]['slug']==slug and found['retrieval']['domain']=='bazi' and found['instruction_authority']=='none'
            assert all(t['trust_level']=='untrusted_reference_text' for t in found['matches'])
        liuyao_concept_queries={'六爻用神怎么取':'liuyao-use-god','世爻和应爻有什么区别':'liuyao-shi-ying','六爻元神是什么意思':'liuyao-yuan-ji-chou','动爻和变爻的区别':'liuyao-moving-changing','六爻月建日辰怎么看':'liuyao-month-day','六爻旬空月破的区别':'liuyao-empty-broken'}
        liuyao_catalog=json.loads((skill/'references/knowledge/liuyao-concepts/catalog.json').read_text(encoding='utf-8'))
        assert liuyao_catalog['expected_topics']==len(liuyao_catalog['topics'])==6
        for topic in liuyao_catalog['topics']:
            file=skill/topic['path'];assert sha(file.read_bytes())==topic['sha256'],'Packaged Liuyao concept missing or changed'
        for query,slug in liuyao_concept_queries.items():
            found=json.loads(execute([a.node,str(skill/'scripts/knowledge-context.cjs'),'--query',query,'--limit','3'],temp,env))
            assert found['matches'][0]['slug']==slug and found['retrieval']['domain']=='liuyao' and found['retrieval']['terms']
            assert not any(t['slug'] in ['folk-zhouyi-xian','folk-zhouyi-heng'] for t in found['matches'])
            assert len(json.dumps(found,ensure_ascii=False).encode('utf-8'))<=12*1024
        assert (skill/'references/liuyao-concepts-index.md').is_file()
        inp=json.loads((skill/'examples/input.json').read_text(encoding='utf-8'));task=Path(temp)/'task';f=Path(temp)/'temp-input.json';write(f,json.dumps(inp))
        cmd=[a.node,str(skill/'scripts/workflow.cjs')];response=json.loads(execute([*cmd,'--temp-input',str(f),'--out',str(task)],temp,env));assert response['ok'] and response['temporary_input_removed'] and not f.exists()
        task_id=response['task_id'];assert task_id.startswith('SM-') and isinstance(response['next_actions'],list)
        response=json.loads(execute([*cmd,'--reuse',str(task/'chart.json'),'--focus','relationship'],temp,env));assert response['cache_hit'] and not response['calculation_performed']
        assert response['task_id']==task_id and response['context']['interpretation_scope']
        for page in native_pages:assert (skill/page['path']).read_text(encoding='utf-8')==page['content']
        assert not (task/'report.md').exists() and not (task/'report.html').exists()
        # Exercise the installation's comparison continuations, not the source tests.
        pair_input=(skill/'examples/relationship-pair-input.json').read_text(encoding='utf-8')
        pair_task=Path(temp)/('pair-long-path '+"quoted-'"+'x'*64)
        entry=[a.sh,str(skill/'scripts/mobile.sh')] if a.sh else cmd
        paired=bounded(execute([*entry,'--stdin','--out',str(pair_task),'--focus','relationship'],temp,env,pair_input),20*1024)
        pair_chart=Path(paired['files']['chart']);pair_bytes=pair_chart.read_bytes();original_pair=json.loads(pair_bytes)
        if paired.get('people_page',{}).get('next_person'):
            action=next(x for x in paired['next_actions'] if x.get('person')==paired['people_page']['next_person'])
            other=bounded(execute([*entry,*action['argv']],temp,env),20*1024)
            assert other['task_id']==paired['task_id'] and other['cache_hit']
            action=next(x for x in other['next_actions'] if x.get('comparison'))
            args=action['argv']
        else:args=['--reuse',str(pair_chart),'--comparison','--focus','relationship','--limit','3']
        relations=[];matrix=[];comparison_pages=0
        while True:
            page=bounded(execute([*entry,*args],temp,env),20*1024);comparison_pages+=1;assert comparison_pages<=30
            assert page['task_id']==paired['task_id'] and page['context']['source_checksum']==original_pair['checksum']['value']
            comparison=page['context']['reading']['comparison'];relations+=comparison['bazi']['cross_relations']['items'];matrix+=comparison['bazi']['pillar_matrix']['items']
            actions=[x for x in page['next_actions'] if x.get('comparison')]
            if not actions:break
            args=actions[0]['argv']
        assert relations==original_pair['comparison']['bazi']['cross_relations'] and matrix==original_pair['comparison']['bazi']['pillar_matrix']
        assert pair_chart.read_bytes()==pair_bytes
        pair_acceptance={'ok':True,'comparison_pages':comparison_pages,'complete_cross_relations':True,'source_chart_byte_identical':True}
        classical=bounded(execute([a.node,str(skill/'scripts/knowledge-context.cjs'),'--query','《礼记·月令》','--limit','3'],temp,env),12*1024)
        assert classical['matches'][0]['slug']=='folk-liji-yueling-summer' and classical['retrieval']['filter_domain'] is None
        document={'mode':'shuwen','purpose':'custom','body_text':'甲"\\\n'*1000,'petition':'愿'*1500,'commitment':'诺'*1500,'applicants':[{'name':'名'*120,'role':'称'*120,'birth_text':'时'*120,'residence':'居'*300} for _ in range(20)]}
        document_input=json.dumps(document,ensure_ascii=False)
        complete=json.loads(execute([a.node,str(skill/'scripts/shuwen.cjs'),'--stdin'],temp,env,document_input))
        assert len(json.dumps(complete,ensure_ascii=False).encode('utf-8'))>32*1024
        args=['--shuwen','--stdin','--bounded','--chars','3000','--out',str(Path(temp)/'document'),'--format','both','--layout','vertical']
        document_entry=[a.sh,str(skill/'scripts/mobile.sh')] if a.sh else [a.node,str(skill/'scripts/shuwen.cjs')]
        text='';document_sha=None;document_pages=0;max_stdout=0;export_files=[]
        while True:
            stdout=execute([*document_entry,*(args if a.sh else args[1:])],temp,env,document_input)
            page=bounded(stdout,12*1024);document_pages+=1;assert document_pages<=50
            max_stdout=max(max_stdout,len(stdout.encode('utf-8')))
            document_sha=document_sha or page['document_sha256'];assert page['document_sha256']==document_sha
            if document_pages==1:export_files=page['files']
            text+=page['text']
            if not page['next_actions']:break
            action=page['next_actions'][0];assert action['requires_same_input'] and '--out' not in action['argv'];args=action['argv']
        assert text==complete['text'] and Path(export_files[0]).read_text(encoding='utf-8')==complete['text']
        assert len(export_files)==2 and Path(export_files[1]).read_text(encoding='utf-8').startswith('<!doctype html>')
        html_check='const fs=require("node:fs"),assert=require("node:assert/strict"),sw=require("./scripts/shuwen.cjs");assert.equal(fs.readFileSync(process.argv[1],"utf8"),sw.makeHtml(sw.build(JSON.parse(fs.readFileSync(0,"utf8"))),"vertical"));console.log("ok");'
        assert execute([a.node,'-e',html_check,export_files[1]],skill,env,document_input).strip()=='ok'
        document_acceptance={'ok':True,'pages':document_pages,'max_stdout_bytes':max_stdout,'full_text_reassembled':True,'complete_exports':True,'entry':'mobile --shuwen' if a.sh else 'Node shuwen'}
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
        # Batch is additive: the package entry calculates the same monthly artifacts.
        inp=json.loads((skill/'examples/partner-search/batch.json').read_text(encoding='utf-8'))
        task=Path(temp)/'batch';f=Path(temp)/'batch-input-temp.json';write(f,json.dumps(inp))
        entry=[a.sh,str(skill/'scripts/mobile.sh'),'--agent'] if a.sh else cmd
        response=bounded(execute([*entry,'--temp-input',str(f),'--partner-search','--batch','--out',str(task)],temp,env),20*1024)
        assert response['ok'] and response['validation']['ok'] and response['temporary_input_removed'] and not f.exists()
        assert response['adapter_id']=='partner_search_batch' and response['context']['computed_complete']
        assert response['context']['filters']['match']=='any' and response['context']['candidate_birth_time_is_hypothetical']
        manifest=json.loads((task/'batch.json').read_text(encoding='utf-8'));assert manifest['complete'] and len(manifest['jobs'])==2
        originals={j['chart']:sha((task/j['chart']).read_bytes()) for j in manifest['jobs']}
        reused=bounded(execute([*entry,'--reuse',str(task/'batch.json'),'--partner-search','--batch'],temp,env),20*1024)
        assert reused['cache_hit'] and not reused['calculation_performed'] and not reused['validation']['recalculated']
        date=next(d for m in response['context']['months'] for d in m['dates'])
        detail=bounded(execute([*entry,*date['details']['argv']],temp,env),20*1024)
        assert detail['context']['date_detail']['selection']['date']==date['date'] and detail['context']['date_detail']['birth_time_is_hypothetical']
        pages=0;point_ids=[]
        while True:
            pages+=1;point_ids.extend(c['id'] for c in detail['context']['date_detail']['candidates']['items'])
            next_action=next((a for a in detail['next_actions'] if '--date' in a['argv']),None)
            if next_action is None:break
            detail=bounded(execute([*entry,*next_action['argv']],temp,env),20*1024)
        assert len(point_ids)==date['matching_samples'] and len(set(point_ids))==len(point_ids)
        assert all(sha((task/name).read_bytes())==digest for name,digest in originals.items())
        batch_acceptance={'ok':True,'months':2,'entry':'mobile --agent --batch' if a.sh else 'Node workflow --batch','temp_cleanup':True,'trusted_cache_reuse':True,'month_artifacts_unchanged':True,'unknown_time_sampling_preserved':True,'date_detail_pages':pages,'date_samples_recovered':len(point_ids),'initial_stdout_bytes':response['output']['bytes'],'full_shell_envelope_checked':True}
        # Exercise the new planner and its actual returned whole-cycle input/argv.
        candidate_code='const e=require("./scripts/engine.cjs");console.log(JSON.stringify(e.build({mode:"bazi",birth:{calendar:"solar",date:"1997-06-15",time:"12:00",gender:"male",timezone:"Asia/Shanghai"}}).bazi.chart.pillars.map(p=>p.ganzhi)));'
        candidate=json.loads(execute([a.node,'-e',candidate_code],skill,env))
        inp=json.loads((skill/'examples/partner-search/plan.json').read_text(encoding='utf-8'));inp['candidate_pillars']=candidate
        task=Path(temp)/'plan';f=Path(temp)/'plan-temp-input.json';write(f,json.dumps(inp))
        response=bounded(execute([*entry,'--temp-input',str(f),'--partner-search','--plan','--out',str(task)],temp,env),20*1024)
        assert response['adapter_id']=='partner_search_plan' and response['validation']['ok'] and response['temporary_input_removed'] and not f.exists()
        assert response['context']['proposed_candidate']['calendar_verified'] is False
        plan_bytes=(task/'chart.json').read_bytes()
        reused=bounded(execute([*entry,'--reuse',str(task/'chart.json'),'--partner-search','--plan'],temp,env),20*1024)
        assert reused['cache_hit'] and not reused['calculation_performed'] and (task/'chart.json').read_bytes()==plan_bytes
        action=response['context']['year_mapping']['items'][0]['next_actions'][0]
        assert action['requires_input'] and action['input']['candidate_pillars']==candidate and action['input']['search']['time_uncertainty']['type']=='unknown'
        exact=bounded(execute([*entry,*action['argv']],temp,env,json.dumps(action['input'])),20*1024)
        assert exact['context']['computed_complete'] and exact['context']['scope']['candidate_pillars']==candidate
        queue=[exact];dates=[];summary_pages=0
        while queue:
            page=queue.pop(0);summary_pages+=1
            dates.extend(d for m in page['context']['months'] for d in m['dates'])
            for next_action in page['next_actions']:
                queue.append(bounded(execute([*entry,*next_action['argv']],temp,env),20*1024))
        assert dates and any(d['date']=='1997-06-15' for d in dates)
        detail=bounded(execute([*entry,*dates[0]['details']['argv']],temp,env),20*1024)
        assert detail['context']['date_detail']['candidates']['items'] and all(c['full_bazi']==candidate for c in detail['context']['date_detail']['candidates']['items'])
        batch_file=Path(exact['files']['chart']);manifest=json.loads(batch_file.read_text(encoding='utf-8'))
        assert manifest['engine_version']=='partner-search-batch/1.0.1' and len(manifest['jobs'])>=12
        month_file=batch_file.parent/manifest['jobs'][0]['chart'];month_bytes=month_file.read_bytes()
        rendered=bounded(execute([*entry,'--reuse',str(month_file),'--partner-search','--report','--limit','1'],temp,env),20*1024)
        for file in [rendered['files']['report_md'],rendered['files']['report_html']]:
            text=Path(file).read_text(encoding='utf-8')
            assert '未成年日期／周期排除' not in text and '无法计算采样点' in text
        assert month_file.read_bytes()==month_bytes
        plan_acceptance={'ok':True,'entry':'mobile --agent --plan then returned --batch argv' if a.sh else 'Node plan then returned batch argv','temp_cleanup':True,'trusted_cache_reuse':True,'whole_year_cycle_executed':True,'month_jobs':len(manifest['jobs']),'exact_four_pillars_verified':True,'summary_pages':summary_pages,'target_date_count':len(dates),'old_candidate_engine_unchanged':True,'report_age_exclusion_text_removed':True,'source_bytes_unchanged':True,'full_shell_envelope_checked':True}
    result={'ok':True,'version':version,'tests':counts,'runtime_critical_cases':preflight['critical']['passed'],'knowledge_topics':topics,'knowledge_files_byte_identical':len(knowledge),'runtime_files':len(runtime),'source_files':len(source),'local_links':links,'extracted_self_test':True,'extracted_religious_queries':len(knowledge_queries),'extracted_temp_cleanup':True,'extracted_cache_reuse':True,'extracted_task_navigation':True,'native_fallback_pages':len(native_pages),'compatibility':compatibility,'compatibility_v1_2_5':compatibility125,'partner_search':partner_cases,'partner_search_batch':batch_acceptance,'mobile_device_tested_current_version':mobile_confirmed,'mobile_validation':mobile_record,'archives':{f.name:sha(f.read_bytes()) for f in [install,src]}}
    result['knowledge_files_byte_identical']=len(knowledge)-len(knowledge_amendments)
    result['knowledge_files_reviewed_wording_changes']=list(knowledge_amendments)
    result['religion_discourse']={'requested_tradition_respected':True,'unsolicited_existence_debate':False,'personal_supernatural_identification_supported':False,'topics':8,'sources':7,'three_cards_other_text_exactly_restored_by_tests':True}
    result['schema_validation']=schema_validation
    result['repack']=repack
    result['compatibility_v1_3_0']=compatibility130
    result['packaged_development_test_guard']=development_test_guard
    result['extracted_concept_queries']=len(concept_queries)
    result['original_knowledge_topics_retained']=93
    result['additional_concept_topics']=knowledge_summary['bazi_concept_topics']+knowledge_summary['liuyao_concept_topics']
    result['bazi_concept_topics']=knowledge_summary['bazi_concept_topics']
    result['liuyao_concept_topics']=knowledge_summary['liuyao_concept_topics']
    result['extracted_liuyao_concept_queries']=len(liuyao_concept_queries)
    result['extracted_classical_query']=True
    result['extracted_pair_comparison']=pair_acceptance
    result['extracted_bounded_shuwen']=document_acceptance
    result['full_shell_envelope_checked']=True
    result['batch_scale_validation']=batch_scale
    result['partner_search_plan']=plan_acceptance
    write(out/'release-validation.json',json.dumps(result,ensure_ascii=False,indent=2)+'\n');write(out/'SHA256SUMS.txt',''.join(d+'  '+n+'\n' for n,d in result['archives'].items()))
    print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':main()
