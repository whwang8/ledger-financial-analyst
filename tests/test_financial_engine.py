import unittest
from decimal import Decimal
from financial_analyst.engine import aggregate,compile_dataset,validate,MONTHS

def rows(r,c,o):
    return [{'row_id':str(i),'month':f'2025-{i+1:02}','revenue':a,'cogs':b,'operating_expenses':d} for i,(a,b,d) in enumerate(zip(r,c,o))]
class FinancialEngineTests(unittest.TestCase):
    def test_golden_profit_bridge(self):
        data=rows([100000,0,0,120000,0,0],[60000,0,0,84000,0,0],[20000,0,0,28000,0,0])
        d=compile_dataset({'id':'golden','rows':data})
        bridge=d['bridges']['2025-Q1→2025-Q2']['facts']
        self.assertEqual([f['value'] for f in bridge],[20000,-24000,-8000,-12000])
    def test_weighted_margin(self):
        v,_,_=aggregate(rows([100,900],[50,810],[0,0]),MONTHS[:2])
        self.assertEqual(v['gross_margin'],Decimal(14))
    def test_zero_revenue_margin(self):
        v,_,_=aggregate(rows([0],[10],[5]),MONTHS[:1]);self.assertIsNone(v['gross_margin']);self.assertEqual(v['operating_profit'],-15)
    def test_negative_revenue_margin(self):
        v,_,_=aggregate(rows([-10],[2],[1]),MONTHS[:1]);self.assertIsNone(v['operating_margin'])
    def test_missing_month_nulls_quarter(self):
        v,missing,_=aggregate(rows([100],[50],[10]),MONTHS[:3]);self.assertEqual(missing,['2025-02','2025-03']);self.assertTrue(all(x is None for x in v.values()))
    def test_duplicate_month_rejected(self):
        r=rows([100,200],[50,60],[10,10]);r[1]['month']=r[0]['month']
        with self.assertRaises(ValueError):validate(r)
    def test_nonfinite_rejected(self):
        with self.assertRaises(ValueError):validate(rows([float('nan')],[0],[0]))
    def test_negative_cost_rejected(self):
        with self.assertRaises(ValueError):validate(rows([100],[-10],[0]))
    def test_subcent_input_rejected(self):
        with self.assertRaises(ValueError):validate(rows([100.001],[10],[0]))
    def test_percent_change_nonpositive_baseline_unavailable(self):
        d=compile_dataset({'id':'zero','rows':rows([0,10],[0,0],[0,0])})
        f=next(f for f in d['comparisons']['2025-01→2025-02']['facts'] if f['metric']=='revenue' and f['unit']=='percent')
        self.assertIsNone(f['value'])
    def test_holdout_golden_literals(self):
        d=compile_dataset({'id':'check','rows':rows([100000,105000,110000,110000,115000,120000],[50000,52500,55000,66000,75000,90000],[20000,20000,20000,25000,30000,40000])})
        v={f['metric']:f['value'] for f in d['periods']['2025-Q2']['facts']}
        self.assertEqual(v['operating_profit'],19000);self.assertAlmostEqual(v['gross_margin'],33.043478,places=6)
        self.assertEqual([f['value'] for f in d['bridges']['2025-Q1→2025-Q2']['facts']],[30000,-73500,-35000,-78500])
    def test_decimal_money(self):
        v,_,_=aggregate(rows(['0.10','0.20'],[0,0],[0,0]),MONTHS[:2]);self.assertEqual(v['revenue'],Decimal('0.30'))
    def test_no_changes_between_identical_quarters(self):
        d=compile_dataset({'id':'same','rows':rows([100]*6,[50]*6,[20]*6)})
        self.assertTrue(all(f['value']==0 for f in d['bridges']['2025-Q1→2025-Q2']['facts']))
    def test_generator_rejects_misaligned_arrays(self):
        from financial_analyst.generate import make
        with self.assertRaises(ValueError):make('x','x',[1]*6,[1],[1]*6)
    def test_zero_contribution_has_no_negative_sign(self):
        import math
        d=compile_dataset({'id':'zero','rows':rows([100]*6,[50]*6,[20]*6)})
        self.assertEqual(math.copysign(1,d['bridges']['2025-Q1→2025-Q2']['facts'][1]['value']),1)
if __name__=='__main__':unittest.main()
