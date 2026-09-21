"""Curated annual filing extract, not a general SEC ingestion pipeline."""
from pathlib import Path
from decimal import Decimal
import json,hashlib
from .engine import number
from .metrics import DEFINITION,evaluate
ROOT=Path(__file__).resolve().parents[2]
def compile_apple():
    source=json.loads((ROOT/'data/public/apple-fy2025-extract.json').read_text())
    did='apple-fy2025';engine_source=Path(__file__).read_text();eh=hashlib.sha256(engine_source.encode()).hexdigest()
    mapping={'revenue':'revenue','cogs':'costOfSales','operating_expenses':'operatingExpenses','net_income':'netIncome','cash_from_operations':'cashFromOperations','cash_ppe_purchases':'cashPpePurchasesPositiveOutflow'}
    rows=[];periods={};bridges={};raw={}
    def fact(period,metric,value,formula,operands,unit='USD_millions',suffix=''):
        return {'id':f'{did}:{period}:{metric}{suffix}','dataset_id':did,'period':period,'metric':metric,'value':number(value),'unit':unit,'formula':formula,'source_row_ids':[f'{did}-{p}' for p in period.split('→')],'reason':None if value is not None else 'Nonpositive denominator.','source_url':source['sourceUrl'],'lineage':{'operation':formula,'operands':operands,'expected_periods':period.split('→'),'missing_periods':[],'engine_hash':eh}}
    for i,p in enumerate(source['valueOrder']):
        v={m:Decimal(source['reported'][name][i]) for m,name in mapping.items()};v['gross_profit']=v['revenue']-v['cogs'];v['operating_profit']=v['gross_profit']-v['operating_expenses'];v['cfo_less_ppe']=v['cash_from_operations']-v['cash_ppe_purchases'];v['cash_conversion_ratio']=v['cash_from_operations']/v['net_income'] if v['net_income']>0 else None
        v['gross_margin']=v['gross_profit']/v['revenue']*100;v['operating_margin']=v['operating_profit']/v['revenue']*100;v['cost_to_revenue_ratio']=evaluate(DEFINITION['expression'],v)
        raw[p]=v;row={'row_id':f'{did}-{p}','month':p,**{m:float(v[m]) for m in mapping}};rows.append(row)
        fs=[]
        deps={'gross_profit':['revenue','cogs'],'operating_profit':['revenue','cogs','operating_expenses'],'cfo_less_ppe':['cash_from_operations','cash_ppe_purchases'],'cash_conversion_ratio':['cash_from_operations','net_income'],'gross_margin':['gross_profit','revenue'],'operating_margin':['operating_profit','revenue'],'cost_to_revenue_ratio':['cogs','operating_expenses','revenue']}
        formulas={'gross_profit':'revenue - cogs','operating_profit':'revenue - cogs - operating_expenses','cfo_less_ppe':'cash_from_operations - cash_ppe_purchases','cash_conversion_ratio':'cash_from_operations / net_income','gross_margin':'gross_profit / revenue * 100','operating_margin':'operating_profit / revenue * 100','cost_to_revenue_ratio':DEFINITION['formula']}
        for m,val in v.items():
            inputs=[{'label':x,'value':number(v[x]),'unit':'USD_millions','fact_id':f'{did}:{p}:{x}'} for x in deps.get(m,[m])]
            fs.append(fact(p,m,val,formulas.get(m,'Reported in filing; USD millions'),inputs,'ratio' if m=='cash_conversion_ratio' else 'percent' if 'margin' in m or m=='cost_to_revenue_ratio' else 'USD_millions'))
        adjustments=[]
        for key,values in source['signedNetIncomeToCfoAdjustments'].items():
            val=Decimal(values[i]);adjustments.append(fact(p,key,val,'Signed cash-flow statement contribution',[{'label':key,'value':number(val),'unit':'USD_millions'}],suffix=':contribution'))
        total=v['net_income']+sum((Decimal(values[i]) for values in source['signedNetIncomeToCfoAdjustments'].values()),Decimal(0));residual=v['cash_from_operations']-total
        if residual!=0:raise ValueError('Apple CFO bridge does not reconcile')
        residual_fact=fact(p,'cash_flow_residual',residual,'reported CFO - (net income + signed adjustments)',[{'label':'Reported CFO','value':number(v['cash_from_operations']),'unit':'USD_millions'},{'label':'Net income + signed adjustments','value':number(total),'unit':'USD_millions'}])
        bridges[p]={'complete':True,'missing_months':[],'facts':[next(f for f in fs if f['metric']=='net_income'),*adjustments,next(f for f in fs if f['metric']=='cash_from_operations'),residual_fact]}
        periods[p]={'complete':True,'missing_months':[],'facts':fs}
    evidence=source['managementEvidence'];periods['FY2025']['facts'].append({'id':did+':FY2025:iphone_management','dataset_id':did,'period':'FY2025','metric':'iphone_management_explanation','value':None,'unit':'passage','formula':'Management attribution; not measured causality','source_row_ids':[],'reason':evidence['limitations'],'passage':evidence['quote'],'source_url':evidence['sourceUrl']})
    comparisons={}
    for a,b in [('FY2024','FY2025'),('FY2025','FY2024')]:
        facts=[]
        for m in raw[a]:
            x,y=raw[a][m],raw[b][m];unit='ratio' if m=='cash_conversion_ratio' else 'percentage_points' if 'margin' in m or m=='cost_to_revenue_ratio' else 'USD_millions';ops=[{'label':a,'value':number(x),'unit':unit},{'label':b,'value':number(y),'unit':unit}]
            facts.append(fact(a+'→'+b,m,y-x if x is not None and y is not None else None,m+'('+b+') - '+m+'('+a+')',ops,unit,':change'))
            if unit=='USD_millions':facts.append(fact(a+'→'+b,m,(y-x)/x*100 if x and x>0 else None,'(new - old) / old * 100',ops,'percent',':percent_change'))
        comparisons[a+'→'+b]={'complete':True,'missing_months':[],'facts':facts}
        contributions=[]
        for m,sign in [('revenue',1),('cogs',-1),('operating_expenses',-1)]:
            contributions.append(fact(a+'→'+b,m,(raw[b][m]-raw[a][m])*sign,str(sign)+' * (new - old)',[{'label':a,'value':number(raw[a][m]),'unit':'USD_millions'},{'label':b,'value':number(raw[b][m]),'unit':'USD_millions'}],suffix=':profit_contribution'))
        contributions.append(fact(a+'→'+b,'operating_profit',raw[b]['operating_profit']-raw[a]['operating_profit'],'change(revenue) - change(cogs) - change(operating_expenses)',[{'label':f['metric']+' contribution','value':f['value'],'unit':'USD_millions'} for f in contributions],suffix=':profit_change'))
        bridges[a+'→'+b]={'complete':True,'missing_months':[],'facts':contributions}
    return {'id':did,'name':'Apple · annual filing pilot','currency':'USD','synthetic':False,'sha256':hashlib.sha256(json.dumps(source,sort_keys=True).encode()).hexdigest(),'rows':rows,'periods':periods,'comparisons':comparisons,'bridges':bridges,'preparation':{'engine_hash':eh,'engine_source':engine_source,'metric_version':'apple-annual-1','source_url':source['sourceUrl'],'accession':source['accession'],'unit_note':'USD millions, as reported. Curated extract, independently unreviewed. Fiscal year ends 2025-09-27 and 2024-09-28; starts derived from 52-week duration.'}}
