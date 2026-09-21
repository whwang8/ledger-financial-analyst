"""Small registered expression language. Never evaluates model-authored Python."""
import json
from pathlib import Path
from decimal import Decimal
DEFINITION=json.loads((Path(__file__).resolve().parents[2]/'data/metrics/cost-to-revenue.json').read_text())
def evaluate(node, accounts):
    op=node['op']
    if op=='account':
        if node['name'] not in ('revenue','cogs','operating_expenses'): raise ValueError('Unsupported account')
        return accounts[node['name']]
    if op=='add':
        values=[evaluate(v,accounts) for v in node['inputs']]
        return None if any(v is None for v in values) else sum(values,Decimal(0))
    if op=='ratio_percent':
        n=evaluate(node['numerator'],accounts);d=evaluate(node['denominator'],accounts)
        return n/d*100 if n is not None and d is not None and d>0 else None
    raise ValueError('Unsupported metric operator')
