"""Independent Draft 2020-12 contract check; local resources, no network refs."""
import argparse,json,subprocess,tempfile
from pathlib import Path
from jsonschema import Draft202012Validator,ValidationError
from referencing import Registry,Resource
ROOT=Path(__file__).resolve().parents[1]

def validate(node):
    schemas=[json.loads((ROOT/'references'/('partner-search-'+name+'.schema.json')).read_text(encoding='utf-8')) for name in ['input','output']]
    batch_schemas=[json.loads((ROOT/'references'/('partner-search-batch-'+name+'.schema.json')).read_text(encoding='utf-8')) for name in ['input','output']]
    plan_schemas=[json.loads((ROOT/'references'/('partner-search-plan-'+name+'.schema.json')).read_text(encoding='utf-8')) for name in ['input','output']]
    for schema in [*schemas,*batch_schemas,*plan_schemas]:Draft202012Validator.check_schema(schema)
    registry=Registry().with_resources((s['$id'],Resource.from_contents(s)) for s in [*schemas,*batch_schemas,*plan_schemas])
    vin,vout=[Draft202012Validator(s,registry=registry) for s in schemas]
    results={}
    code='const fs=require("node:fs"),s=require("./scripts/partner-search.cjs");console.log(JSON.stringify(s.build(JSON.parse(fs.readFileSync(0,"utf8")))));'
    for name in ['years','dates','people','pillars']:
        raw=json.loads((ROOT/'examples/partner-search'/(name+'.json')).read_text(encoding='utf-8'));vin.validate(raw)
        r=subprocess.run([node,'-e',code],input=json.dumps(raw),cwd=ROOT,text=True,encoding='utf-8',stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60)
        assert r.returncode==0,r.stderr
        data=json.loads(r.stdout);vout.validate(data);vin.validate(data['input']);results[name]=True
        data['probability']=0.99
        try:vout.validate(data)
        except ValidationError:pass
        else:raise AssertionError('probability not rejected')
        data['probability']=None
        if name=='years':
            data['candidates'][0]['full_bazi']=['甲子']*4
            try:vout.validate(data)
            except ValidationError:pass
            else:raise AssertionError('fabricated year-only pillars not rejected')
    vb_in,vb_out=[Draft202012Validator(s,registry=registry) for s in batch_schemas]
    raw=json.loads((ROOT/'examples/partner-search/batch.json').read_text(encoding='utf-8'));vb_in.validate(raw)
    code='const w=require("./scripts/workflow.cjs");console.log(JSON.stringify(w.operation(["--stdin","--partner-search","--batch","--out",process.argv[1]])));'
    with tempfile.TemporaryDirectory(prefix='suanming-batch-schema-') as temp:
        r=subprocess.run([node,'-e',code,str(Path(temp)/'task')],input=json.dumps(raw),cwd=ROOT,text=True,encoding='utf-8',stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120)
        assert r.returncode==0,r.stderr
        data=json.loads(r.stdout);vb_out.validate(data);assert data['ok']
        partial_code='const w=require("./scripts/workflow.cjs");console.log(JSON.stringify(w.operation(["--stdin","--partner-search","--batch","--out",process.argv[1],"--max-days","1"])));'
        partial=subprocess.run([node,'-e',partial_code,str(Path(temp)/'partial')],input=json.dumps(raw),cwd=ROOT,text=True,encoding='utf-8',stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60)
        assert partial.returncode==0,partial.stderr
        paused=json.loads(partial.stdout);vb_out.validate(paused);assert paused['execution']['state']=='yielded' and paused['partial'] and not paused['context']['computed_complete']
        data['context']['probability']=0.99
        try:vb_out.validate(data)
        except ValidationError:pass
        else:raise AssertionError('batch probability not rejected')
        data['context']['probability']=None;data['partial']=True
        try:vb_out.validate(data)
        except ValidationError:pass
        else:raise AssertionError('batch false completeness not rejected')
    vp_in,vp_out=[Draft202012Validator(s,registry=registry) for s in plan_schemas]
    raw=json.loads((ROOT/'examples/partner-search/plan.json').read_text(encoding='utf-8'));vp_in.validate(raw)
    code='const w=require("./scripts/workflow.cjs");console.log(JSON.stringify(w.operation(["--stdin","--partner-search","--plan","--out",process.argv[1]])));'
    with tempfile.TemporaryDirectory(prefix='suanming-plan-schema-') as temp:
        r=subprocess.run([node,'-e',code,str(Path(temp)/'plan')],input=json.dumps(raw),cwd=ROOT,text=True,encoding='utf-8',stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60)
        assert r.returncode==0,r.stderr
        data=json.loads(r.stdout);vp_out.validate(data);assert data['ok']
        for row in data['context']['year_mapping']['items']:
            for action in row['next_actions']:vb_in.validate(action['input'])
        data['context']['probability']=0.8
        try:vp_out.validate(data)
        except ValidationError:pass
        else:raise AssertionError('plan probability not rejected')
        data['context']['probability']=None
        candidate_code='const e=require("./scripts/engine.cjs");console.log(JSON.stringify(e.build({mode:"bazi",birth:{calendar:"solar",date:"1997-06-15",time:"12:00",gender:"male",timezone:"Asia/Shanghai"}}).bazi.chart.pillars.map(p=>p.ganzhi)));'
        target=subprocess.run([node,'-e',candidate_code],cwd=ROOT,text=True,encoding='utf-8',stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60)
        assert target.returncode==0,target.stderr
        raw['candidate_pillars']=json.loads(target.stdout);vp_in.validate(raw)
        r=subprocess.run([node,'-e',code,str(Path(temp)/'target')],input=json.dumps(raw),cwd=ROOT,text=True,encoding='utf-8',stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60)
        assert r.returncode==0,r.stderr
        target_plan=json.loads(r.stdout);vp_out.validate(target_plan)
        batch_input=target_plan['context']['year_mapping']['items'][0]['next_actions'][0]['input'];vb_in.validate(batch_input)
        target_plan['context']['proposed_candidate']['calendar_verified']=True
        try:vp_out.validate(target_plan)
        except ValidationError:pass
        else:raise AssertionError('unverified theoretical calendar claimed verified')
        batch_input['search'].update(start='1997-06-15',end='1997-06-16')
        batch_code='const w=require("./scripts/workflow.cjs");console.log(JSON.stringify(w.operation(["--stdin","--partner-search","--batch","--out",process.argv[1]])));'
        r=subprocess.run([node,'-e',batch_code,str(Path(temp)/'exact')],input=json.dumps(batch_input),cwd=ROOT,text=True,encoding='utf-8',stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60)
        assert r.returncode==0,r.stderr
        exact=json.loads(r.stdout);vb_out.validate(exact);assert exact['context']['scope']['candidate_pillars']==raw['candidate_pillars']
    return {'performed':True,'draft':'2020-12','input_and_output_examples':results,'negative_probability_and_fabricated_year_pillars_rejected':True,'batch_input_output_validated':True,'batch_probability_and_false_completion_rejected':True,'plan_input_output_and_generated_queries_validated':True,'plan_probability_and_false_calendar_verification_rejected':True,'exact_pillar_batch_validated':True,'network_ref_loading':False}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--node',required=True);args=p.parse_args();print(json.dumps(validate(args.node)))
