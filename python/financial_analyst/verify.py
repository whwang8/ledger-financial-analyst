"""Recompute a versioned dataset and save a separate verification record."""
import argparse,datetime,hashlib,json,uuid
from pathlib import Path
from .engine import compile_dataset
from .apple import compile_apple
ROOT=Path(__file__).resolve().parents[2]
def main():
    p=argparse.ArgumentParser();p.add_argument('--dataset',required=True);a=p.parse_args()
    catalog=json.loads((ROOT/'lib/generated/catalog.json').read_text());stored=next((d for d in catalog['datasets'] if d['id']==a.dataset),None)
    if stored is None:p.error('Unknown dataset')
    rebuilt=compile_apple() if a.dataset=='apple-fy2025' else compile_dataset(json.loads((ROOT/'data/synthetic'/f'{a.dataset}.json').read_text()))
    differences=[]
    for group in ('periods','comparisons','bridges'):
        if rebuilt[group]!=stored[group]:differences.append(group)
    result={'id':str(uuid.uuid4()),'verified_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'dataset_id':a.dataset,'source_hash':rebuilt['sha256'],'engine_hash':rebuilt['preparation']['engine_hash'],'stored_source_hash':stored['sha256'],'matches_stored_facts':not differences,'different_groups':differences,'scope':'Recomputation consistency, not independent financial correctness.'}
    folder=ROOT/'results'/'verification';folder.mkdir(parents=True,exist_ok=True);dest=folder/(result['id']+'.json');dest.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'matches_stored_facts':not differences,'record':str(dest)}))
    if differences:raise SystemExit(1)
if __name__=='__main__':main()
