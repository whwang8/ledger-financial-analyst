"""Rebuild every hosted fact from versioned, independently authored synthetic inputs."""
from pathlib import Path
import json
from .engine import compile_dataset
ROOT=Path(__file__).resolve().parents[2]

def make(identifier,name,revenue,cogs,opex,missing=None):
    if len(revenue) != 6 or len(cogs) != 6 or len(opex) != 6:
        raise ValueError('Expected six monthly values for each account')
    if missing is not None and missing not in range(1,7):
        raise ValueError('Missing month must be within January–June')
    rows=[{'row_id':f'{identifier}-2025-{i+1:02}', 'month':f'2025-{i+1:02}', 'revenue':r,'cogs':c,'operating_expenses':o} for i,(r,c,o) in enumerate(zip(revenue,cogs,opex)) if i+1 != missing]
    return {'id':identifier,'name':name,'currency':'USD','synthetic':True,'rows':rows}

def main():
    sources=[
      make('company-01','Meridian Works',[90000,95000,100000,108000,115000,125000],[45000,48000,50000,65000,74000,87000],[18000,18000,20000,22000,26000,34000]),
      make('company-02','Alder Studio',[70000,75000,80000,85000,90000,95000],[35000,37500,40000,42500,45000,47500],[14000]*6),
      make('company-03','Northline Supply',[80000,90000,100000,110000,120000,130000],[40000,45000,50000,55000,60000,65000],[16000]*6,5),
      make('company-04','Juniper Systems',[100000,110000,120000,140000,150000,160000],[60000,66000,72000,84000,90000,96000],[20000]*6),
      make('company-05','Cobalt Services',[100000,105000,110000,110000,115000,120000],[50000,52500,55000,66000,75000,90000],[20000,20000,20000,25000,30000,40000]),
      make('company-06','Harbor Industries',[100000,110000,120000,140000,150000,160000],[60000,66000,72000,84000,90000,96000],[20000]*6,5),
    ]
    for s in sources:
        p=ROOT/'data'/'synthetic'/f"{s['id']}.json";p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(s,indent=2)+'\n')
    catalog={'version':'1.0','calculation_engine':'Python Decimal','datasets':[compile_dataset(s) for s in sources]}
    p=ROOT/'lib'/'generated'/'catalog.json';p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(catalog,separators=(',',':'))+'\n')
    overview=json.loads(json.dumps(catalog))
    for d in overview['datasets']:
        for key in ('comparisons','bridges'):
            d[key]={k:v for k,v in d[key].items() if k=='2025-Q1→2025-Q2'}
    (ROOT/'lib'/'generated'/'overview.json').write_text(json.dumps(overview,separators=(',',':'))+'\n')
    print(f'Generated {len(sources)} datasets and Python evidence catalog ({p.stat().st_size:,} bytes).')
if __name__=='__main__':main()
