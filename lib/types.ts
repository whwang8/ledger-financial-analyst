export type Fact = {
  id: string;
  dataset_id: string;
  period: string;
  metric: string;
  value: number | null;
  unit: string;
  formula: string;
  source_row_ids: string[];
  reason: string | null;
};
export type FactSet = {
  complete: boolean;
  missing_months: string[];
  facts: Fact[];
};
export type Dataset = {
  id: string;
  name: string;
  currency: string;
  synthetic: boolean;
  sha256: string;
  rows: {
    row_id: string;
    month: string;
    revenue: number;
    cogs: number;
    operating_expenses: number;
  }[];
  periods: Record<string, FactSet>;
  comparisons: Record<string, FactSet>;
  bridges: Record<string, FactSet>;
};
export type Finding = { text: string; evidence_ids: string[] };
export type Analysis = {
  decision: 'answer' | 'limited' | 'clarify';
  summary: string;
  findings: Finding[];
  limitations: string[];
  suggested_questions: string[];
};
export type Trace = {
  step: number;
  tool: string;
  arguments: Record<string, unknown>;
  result: unknown;
  elapsed_ms: number;
};
export type Run = {
  id: string;
  dataset_id: string;
  dataset_hash: string;
  question: string;
  analysis: Analysis;
  trace: Trace[];
  facts: Fact[];
  provider: string;
  model: string;
  elapsed_ms: number;
  usage: { input_tokens: number; output_tokens: number };
  mode: 'live' | 'calculation_preview';
  created_at: string;
  validation: { references_valid: boolean; semantic_review: 'not_reviewed' };
};
