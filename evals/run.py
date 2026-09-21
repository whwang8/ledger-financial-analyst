"""Freeze cases before execution; retain every attempt and never silently retry unknown outcomes."""
import argparse,datetime,hashlib,json,time,urllib.error,urllib.request,uuid
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:3000');p.add_argument('--provider',choices=['openai','anthropic'],default='openai');p.add_argument('--run-live',action='store_true');p.add_argument('--limit',type=int);p.add_argument('--cases-file',type=Path,default=root/'evals/cases.json');p.add_argument('--case-id',action='append');p.add_argument('--no-public-summary',action='store_true');p.add_argument('--resume',type=Path,help='Resume unstarted cases only; attempts with unknown outcomes are never automatically repeated.');a=p.parse_args()
if not a.run_live:p.error('Add --run-live to authorize provider calls.')
status=json.load(urllib.request.urlopen(a.url+'/api/status',timeout=15))
if not status.get('enabled') or not status.get(a.provider):p.error('Selected provider is not enabled.')
if a.resume:
 folder=a.resume.resolve();manifest=json.loads((folder/'manifest.json').read_text());cases=manifest['cases']
 if manifest['provider']!=a.provider or manifest['url']!=a.url:p.error('Resume must use the manifest provider and URL.')
 if manifest['serving_version']!=status.get('implementation_version'):p.error('Serving implementation changed; start a new evaluation manifest.')
else:
 cases=json.loads(a.cases_file.read_text())['cases']
 hashes={d['id']:d['sha256'] for d in status.get('datasets',[])}
 for case in cases:case.setdefault('dataset_hash',hashes.get(case['dataset_id']))
 if a.case_id:
  unknown=set(a.case_id)-{c['id'] for c in cases}
  if unknown:p.error('Unknown case IDs: '+', '.join(unknown))
  cases=[c for c in cases if c['id'] in a.case_id]
 if a.limit is not None:
  if a.limit<1:p.error('--limit must be positive')
  cases=cases[:a.limit]
 stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ');folder=root/'results'/stamp;folder.mkdir(parents=True)
 manifest={'id':str(uuid.uuid4()),'created_at':stamp,'url':a.url,'provider':a.provider,'serving_version':status.get('implementation_version'),'serving_source_hash':status.get('source_hash'),'cases':cases,'case_snapshot_hash':hashlib.sha256(json.dumps(cases,sort_keys=True).encode()).hexdigest(),'review_status':'unreviewed','split_note':'Previously inspected regression tasks; not an untouched holdout.','retry_policy':'No automatic retry of a started attempt.'}
 (folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for index,c in enumerate(cases):
 dest=folder/(c['id']+'.json');started_file=folder/(c['id']+'.started.json')
 if dest.exists():continue
 if started_file.exists():print(c['id']+': outcome unknown; inspect saved run before an explicit new attempt.',flush=True);continue
 id=str(uuid.uuid4());trial={'case_id':c['id'],'question':c['question'],'run_id':id,'attempt_id':id,'evaluation_id':manifest['id'],'human_review':None,'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 started_file.write_text(json.dumps(trial,indent=2)+'\n');started=time.time()
 try:
  req=urllib.request.Request(a.url+'/api/analyze',data=json.dumps({'run_id':id,'attempt_id':id,'evaluation_id':manifest['id'],'case_id':c['id'],'dataset_id':c['dataset_id'],'dataset_hash':c.get('dataset_hash'),'provider':a.provider,'question':c['question'],'history':c.get('history',[]),'mode':'live'}).encode(),headers={'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=125) as res:run=json.load(res)
  if run.get('journal',{}).get('state')!='completed':raise RuntimeError('Run did not complete; inspect '+id)
  actual={f['id']:f['value'] for f in run['facts']}
  checks=[{'id':e['id'],'match':e['id'] in actual and (actual[e['id']] is None if e['value'] is None else actual[e['id']] is not None and abs(actual[e['id']]-e['value'])<=0.005)} for e in c.get('expected_facts',[])]
  trial.update(run=run,execution='success',evidence_checks=checks,evidence_coverage=all(x['match'] for x in checks) if checks else None)
 except urllib.error.HTTPError as e:
  try:err=json.load(e)
  except Exception:err={'error':str(e)}
  trial.update(execution='error',error=err.get('error'),run=err.get('run'),run_id=err.get('run_id',id),evidence_coverage=None)
 except Exception as e:trial.update(execution='unknown',error=str(e),evidence_coverage=None)
 trial['elapsed_seconds']=round(time.time()-started,2);dest.write_text(json.dumps(trial,indent=2)+'\n');print(f"{index+1}/{len(cases)} {c['id']}: {trial['execution']}",flush=True)
 if index+1<len(cases):time.sleep(11)
trials=[json.loads((folder/(c['id']+'.json')).read_text()) for c in cases if (folder/(c['id']+'.json')).exists()]
summary={'status':'needs_human_review','cases':len(cases),'attempted':len(list(folder.glob('*.started.json'))),'execution_successes':sum(t['execution']=='success' for t in trials),'known_failures':sum(t['execution']=='error' for t in trials),'unknown_outcomes':sum(t['execution']=='unknown' for t in trials)+len(list(folder.glob('*.started.json')))-len(trials),'passed':None,'reviewed':0,'provider':a.provider,'evaluation_id':manifest['id'],'note':'Task attempts and completed executions are separate. Evidence retrieval coverage is not answer correctness. Human grading is pending.'}
(folder/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
if not a.no_public_summary:(root/'public/evaluation-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
(folder/'review-template.json').write_text(json.dumps([{'case_id':t['case_id'],'run_id':t['run_id'],'task_complete':None,'numbers_correct':None,'claims_supported':None,'uncertainty_handled':None,'notes':''} for t in trials],indent=2)+'\n')
print('Results saved in '+str(folder),flush=True)
