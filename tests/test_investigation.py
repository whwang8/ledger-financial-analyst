import unittest
from decimal import Decimal
from financial_analyst.metrics import DEFINITION,evaluate
from financial_analyst.apple import compile_apple
from financial_analyst.engine import compile_dataset
from financial_analyst.generate import make
class InvestigationTests(unittest.TestCase):
 def test_metric_golden_and_undefined(self):
  self.assertEqual(evaluate(DEFINITION['expression'],{'revenue':Decimal(100),'cogs':Decimal(40),'operating_expenses':Decimal(20)}),Decimal(60))
  self.assertIsNone(evaluate(DEFINITION['expression'],{'revenue':Decimal(0),'cogs':Decimal(40),'operating_expenses':Decimal(20)}))
  self.assertIsNone(evaluate(DEFINITION['expression'],{'revenue':None,'cogs':Decimal(40),'operating_expenses':Decimal(20)}))
 def test_metric_missing_period_and_provenance(self):
  d=compile_dataset(make('golden','Golden',[100]*6,[40]*6,[20]*6,5));f=next(f for f in d['periods']['2025-Q2']['facts'] if f['metric']=='cost_to_revenue_ratio');self.assertIsNone(f['value']);self.assertEqual(f['lineage']['missing_periods'],['2025-05']);self.assertEqual(f['lineage']['operands'][0]['value'],200)
 def test_apple_independent_literal_reconciliation(self):
  d=compile_apple()
  for p,cfo,residual in [('FY2025',111482,0),('FY2024',118254,0)]:
   fs={f['metric']:f for f in d['bridges'][p]['facts']};self.assertEqual(fs['cash_from_operations']['value'],cfo);self.assertEqual(fs['cash_flow_residual']['value'],residual)
  self.assertEqual(next(f['value'] for f in d['periods']['FY2025']['facts'] if f['metric']=='cfo_less_ppe'),98767)
  self.assertEqual(next(f['value'] for f in d['periods']['FY2024']['facts'] if f['metric']=='cfo_less_ppe'),108807)
 def test_expression_rejects_unregistered_operations(self):
  with self.assertRaises(ValueError):evaluate({'op':'exec','code':'anything'}, {})
