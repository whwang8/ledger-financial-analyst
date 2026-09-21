"""All financial arithmetic lives here; the web runtime only retrieves facts."""
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json

METRICS = ('revenue', 'cogs', 'operating_expenses', 'gross_profit', 'operating_profit', 'gross_margin', 'operating_margin')
FORMULAS = {
 'revenue': 'sum(revenue)', 'cogs': 'sum(cogs)', 'operating_expenses': 'sum(operating_expenses)',
 'gross_profit': 'sum(revenue) - sum(cogs)',
 'operating_profit': 'sum(revenue) - sum(cogs) - sum(operating_expenses)',
 'gross_margin': '(sum(revenue) - sum(cogs)) / sum(revenue) * 100',
 'operating_margin': '(sum(revenue) - sum(cogs) - sum(operating_expenses)) / sum(revenue) * 100',
}
MONTHS = [f'2025-{i:02}' for i in range(1, 7)]
PERIODS = {**{m:[m] for m in MONTHS}, '2025-Q1': MONTHS[:3], '2025-Q2': MONTHS[3:], '2025-H1': MONTHS}

def number(value):
    if value is None: return None
    return 0.0 if value == 0 else float(value.quantize(Decimal('.000001'), rounding=ROUND_HALF_UP))

def validate(rows):
    seen=set()
    for row in rows:
        if row['month'] not in MONTHS or row['month'] in seen:
            raise ValueError('Duplicate or unsupported month')
        seen.add(row['month'])
        for name in METRICS[:3]:
            value=Decimal(str(row[name]))
            if not value.is_finite(): raise ValueError('Non-finite amount')
            if name != 'revenue' and value < 0: raise ValueError('Costs must be positive expense amounts')
            if value != value.quantize(Decimal('.01')): raise ValueError('Amounts must have at most two decimal places')
    if len({r['row_id'] for r in rows}) != len(rows): raise ValueError('Duplicate row ID')

def aggregate(rows, expected_months):
    selected=[r for r in rows if r['month'] in expected_months]
    missing=sorted(set(expected_months)-{r['month'] for r in selected})
    if missing: return {k:None for k in METRICS}, missing, selected
    v={k:sum((Decimal(str(r[k])) for r in selected), Decimal(0)) for k in METRICS[:3]}
    v['gross_profit']=v['revenue']-v['cogs']
    v['operating_profit']=v['gross_profit']-v['operating_expenses']
    for k in ('gross','operating'):
        v[k+'_margin']=v[k+'_profit']/v['revenue']*100 if v['revenue']>0 else None
    return v, missing, selected

def fact(dataset, period, metric, value, formula, rows, unit=None, reason=None, suffix=''):
    return {'id':f'{dataset}:{period}:{metric}{suffix}', 'dataset_id':dataset, 'period':period, 'metric':metric,
            'value':number(value), 'unit':unit or ('percent' if 'margin' in metric else 'USD'),
            'formula':formula, 'source_row_ids':[r['row_id'] for r in rows], 'reason':reason}

def compile_dataset(source):
    rows=source['rows'];validate(rows); did=source['id']
    periods={}; raw={}
    for period,months in PERIODS.items():
        values,missing,selected=aggregate(rows,months);raw[period]=values
        reason='Missing months: '+', '.join(missing) if missing else None
        facts=[fact(did,period,k,values[k],FORMULAS[k],selected,reason=reason or ('Ratio unavailable: revenue is not positive.' if values[k] is None else None)) for k in METRICS]
        periods[period]={'id':period,'complete':not missing,'missing_months':missing,'facts':facts}
    comparisons={};bridges={}
    for a in PERIODS:
        for b in PERIODS:
            if a==b:continue
            key=a+'→'+b; both=periods[a]['complete'] and periods[b]['complete']
            selected=[r for r in rows if r['month'] in set(PERIODS[a]+PERIODS[b])]
            missing=sorted(set(periods[a]['missing_months']+periods[b]['missing_months']))
            facts=[]
            for k in METRICS:
                x,y=raw[a][k],raw[b][k]
                delta=y-x if both and x is not None and y is not None else None
                reason='Incomplete or undefined comparison' if delta is None else None
                unit='percentage_points' if 'margin' in k else 'USD'
                facts.append(fact(did,key,k,delta,f'{k}({b}) - {k}({a})',selected,unit,reason,':change'))
                if 'margin' not in k:
                    pct=(y-x)/x*100 if both and x is not None and y is not None and x>0 else None
                    facts.append(fact(did,key,k,pct,f'({k}({b}) - {k}({a})) / {k}({a}) * 100',selected,'percent',None if pct is not None else 'Percentage change unavailable: incomplete period or nonpositive baseline.',':percent_change'))
            comparisons[key]={'complete':both,'missing_months':missing,'facts':facts}
            contributions=[]
            for k,sign in [('revenue',1),('cogs',-1),('operating_expenses',-1)]:
                v=(raw[b][k]-raw[a][k])*sign if both else None
                contributions.append(fact(did,key,k,v,f'{sign} * ({k}({b}) - {k}({a}))',selected,'USD',None if both else 'Incomplete period',':profit_contribution'))
            total=raw[b]['operating_profit']-raw[a]['operating_profit'] if both else None
            contributions.append(fact(did,key,'operating_profit',total,'change(revenue) - change(cogs) - change(operating_expenses)',selected,'USD',None if both else 'Incomplete period',':profit_change'))
            bridges[key]={'complete':both,'missing_months':missing,'facts':contributions}
    return {**source,'sha256':hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest(), 'periods':periods,'comparisons':comparisons,'bridges':bridges}
