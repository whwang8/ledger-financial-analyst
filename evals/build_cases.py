"""Hand-authored task oracles: deliberately do not import the calculation engine."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
cases=[]
def add(company,n,question,expected,review):cases.append({'id':f'{company}-{n}','dataset_id':company,'question':question,'expected_facts':expected,'human_review':review})
def f(company,period,metric,value,suffix=''):return {'id':f'{company}:{period}:{metric}{suffix}','value':value}
for d,values in [('company-04',[450000,270000,60000,120000,40]),('company-05',[345000,231000,95000,19000,33.043478])]:
 add(d,1,'For Q2 2025, report revenue, COGS, operating expenses, operating profit, and gross margin.',[f(d,'2025-Q2',k,v) for k,v in zip(['revenue','cogs','operating_expenses','operating_profit','gross_margin'],values)],['All five values appear correctly in the answer with correct units and period.','Gross margin is not an average of monthly percentages.'])
for d,values in [('company-04',[120000,-72000,0,48000]),('company-05',[30000,-73500,-35000,-78500])]:
 add(d,2,'How much did operating profit change from Q1 to Q2 2025? Reconcile the change across revenue, COGS, and operating expenses.',[f(d,'2025-Q1→2025-Q2',k,v,':profit_contribution' if k!='operating_profit' else ':profit_change') for k,v in zip(['revenue','cogs','operating_expenses','operating_profit'],values)],['Contribution signs are correct and reconcile to the total change.','No unsupported business cause is asserted.'])
add('company-04',3,'Investigate the largest positive account contribution to the Q1-to-Q2 profit change. Compare corresponding months across the quarters and identify the biggest contributing month.',[f('company-04',a+'→'+b,'revenue',40000,':change') for a,b in [('2025-01','2025-04'),('2025-02','2025-05'),('2025-03','2025-06')]],['Select revenue after inspecting the bridge.','April/January, May/February, June/March each add $40,000; report the three-way tie.'])
add('company-05',3,'Investigate the largest negative account contribution to the Q1-to-Q2 profit change. Compare corresponding months across the quarters and identify the biggest contributing month.',[f('company-05',a+'→'+b,'cogs',v,':change') for a,b,v in [('2025-01','2025-04',16000),('2025-02','2025-05',22500),('2025-03','2025-06',35000)]],['Select COGS after inspecting the bridge.','June versus March has the largest cost increase ($35,000), which contributes negatively to profit.'])
add('company-04',4,'Was the revenue increase from Q1 to Q2 caused by acquiring more customers?',[],['Customer acquisition cannot be established from aggregate financial data.','Identify missing customer count, volume, or pricing evidence; no invented cause.'])
add('company-05',4,'Did higher supplier prices cause the Q1-to-Q2 profit decline?',[],['Separate the accounting COGS contribution from unproven supplier-price causation.','Ask for unit prices, purchasing volumes, or product mix; no invented business cause.'])
add('company-06',1,'For Q2 2025, report revenue, COGS, operating expenses, operating profit, and gross margin.',[f('company-06','2025-Q2','operating_profit',None)],['Identify missing May 2025. Full Q2 totals are unavailable.','Do not call observed April+June totals full-quarter results.'])
add('company-06',2,'How much did operating profit change from Q1 to Q2 2025? Reconcile the change across revenue, COGS, and operating expenses.',[],['No complete-quarter bridge is produced; May is missing.','Request the missing figures instead of filling with zero.'])
add('company-06',3,'Which months are available in each quarter? Is Q2 usable for a complete quarterly comparison?',[],['Q1 has January, February, March. Q2 has April and June, with May missing.','Reject a complete-quarter comparison.'])
add('company-06',4,'Since reported Q2 profit is $80,000 versus Q1’s $72,000, can I say profit improved by 11.11%?',[],['Correct the misleading premise: $80,000 covers two months, $72,000 covers three.','Do not endorse 11.11% as the full-quarter profit improvement.'])
result={'version':'1.0','split':'reserved_check','scope':'Small synthetic prototype check; shared scenario families, not a production benchmark.','cases':sorted(cases,key=lambda c:c['id'])}
(root/'evals'/'cases.json').write_text(json.dumps(result,indent=2)+'\n')
(root/'public'/'evaluation-cases.json').write_text(json.dumps(result,indent=2)+'\n')
summary={'status':'not_run','cases':12,'attempted':0,'passed':None,'reviewed':0,'note':'Live model evaluation has not been run. Calculation previews are not LLM results.'}
p=root/'public'/'evaluation-summary.json'
if not p.exists():p.write_text(json.dumps(summary,indent=2)+'\n')
