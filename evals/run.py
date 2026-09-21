"""Run the real analyst through its HTTP endpoint. Live calls require explicit opt-in."""
import argparse,json,urllib.request,urllib.error,time,datetime,hashlib,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--url',default='http://localhost:3000');p.add_argument('--provider',choices=['openai','anthropic'],default='openai');p.add_argument('--run-live',action='store_true');p.add_argument('--limit',type=int,default=12);p.add_argument('--case-id',action='append',help='Run only this case; repeat for several cases. Each invocation preserves a new result directory.');p.add_argument('--no-public-summary',action='store_true',help='Preserve the dashboard report during an isolated rerun.');a=p.parse_args()
if not a.run_live:p.error('Add --run-live to authorize provider calls; configure the API key on the server first.')
if not 1<=a.limit<=12:p.error('--limit must be 1–12')
status=json.load(urllib.request.urlopen(a.url+'/api/status',timeout=15))
if not status.get('enabled') or not status.get(a.provider):p.error('The selected provider is not configured on the server.')
cases=json.loads((root/'evals'/'cases.json').read_text())['cases']
if a.case_id:
    unknown=set(a.case_id)-{c['id'] for c in cases}
    if unknown:p.error('Unknown case ID: '+', '.join(sorted(unknown)))
    cases=[c for c in cases if c['id'] in a.case_id]
cases=cases[:a.limit]
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ');folder=root/'results'/stamp;folder.mkdir(parents=True)
protocol=root/'evals'/'protocol.json'
if protocol.exists():shutil.copyfile(protocol,folder/'protocol.json')
(folder/'source-hashes.json').write_text(json.dumps({str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [root/'lib'/'agent.ts',root/'lib'/'tools.ts',root/'python'/'financial_analyst'/'engine.py',root/'package-lock.json']},indent=2)+'\n')
trials=[]
for i,c in enumerate(cases):
    started=time.time();trial={'case_id':c['id'],'question':c['question'],'human_review':None}
    try:
        req=urllib.request.Request(a.url+'/api/analyze',data=json.dumps({'dataset_id':c['dataset_id'],'provider':a.provider,'question':c['question'],'history':[],'mode':'live'}).encode(),headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=125) as res:run=json.load(res)
        actual={f['id']:f['value'] for f in run['facts']}
        checks=[{'id':e['id'],'match':e['id'] in actual and (actual[e['id']] is None if e['value'] is None else actual[e['id']] is not None and abs(actual[e['id']]-e['value'])<=0.005)} for e in c['expected_facts']]
        trial.update(run=run,execution='success',evidence_checks=checks,evidence_coverage=all(x['match'] for x in checks) if checks else None)
    except Exception as e:
        msg=str(e)
        if isinstance(e,urllib.error.HTTPError):
            try:msg=json.load(e).get('error',msg)
            except Exception:pass
        trial.update(execution='error',error=msg,evidence_coverage=False)
    trial['elapsed_seconds']=round(time.time()-started,2);trials.append(trial)
    (folder/f"{c['id']}.json").write_text(json.dumps(trial,indent=2)+'\n')
    print(f"{i+1}/{len(cases)} {c['id']}: {trial['execution']}")
    if i+1<len(cases):time.sleep(11) # stay below the prototype endpoint's rate limit
summary={'status':'needs_human_review','cases':12,'attempted':len(trials),'execution_successes':sum(t['execution']=='success' for t in trials),'passed':None,'reviewed':0,'provider':a.provider,'created_at':stamp,'note':f'{len(trials)} live tasks attempted. Answer accuracy is unscored until human review. Evidence coverage is not answer correctness.'}
(folder/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
if not a.no_public_summary:(root/'public'/'evaluation-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
(folder/'review-template.json').write_text(json.dumps([{'case_id':t['case_id'],'task_complete':None,'numbers_correct':None,'claims_supported':None,'uncertainty_handled':None,'notes':''} for t in trials],indent=2)+'\n')
print(f'Results saved in {folder}; review every answer against evals/cases.json.')
