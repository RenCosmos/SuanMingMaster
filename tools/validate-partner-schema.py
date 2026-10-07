"""Independent Draft 2020-12 contract check; local resources, no network refs."""
import argparse,json,subprocess
from pathlib import Path
from jsonschema import Draft202012Validator,ValidationError
from referencing import Registry,Resource
ROOT=Path(__file__).resolve().parents[1]

def validate(node):
    schemas=[json.loads((ROOT/'references'/('partner-search-'+name+'.schema.json')).read_text(encoding='utf-8')) for name in ['input','output']]
    for schema in schemas:Draft202012Validator.check_schema(schema)
    registry=Registry().with_resources((s['$id'],Resource.from_contents(s)) for s in schemas)
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
    return {'performed':True,'draft':'2020-12','input_and_output_examples':results,'negative_probability_and_fabricated_year_pillars_rejected':True,'network_ref_loading':False}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--node',required=True);args=p.parse_args();print(json.dumps(validate(args.node)))
