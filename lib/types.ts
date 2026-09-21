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
  lineage?: {
    operation: string;
    operands: {
      label: string;
      value: number | null;
      unit: string;
      fact_id?: string;
    }[];
    expected_periods: string[];
    missing_periods: string[];
    engine_hash: string;
  };
  source_url?: string;
  passage?: string;
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
  preparation?: {
    engine_hash: string;
    engine_source: string;
    metric_version: string;
    source_url?: string;
    accession?: string;
    unit_note?: string;
  };
};
export type Finding = {
  id?: string;
  kind?:
    | 'financial'
    | 'coverage'
    | 'attributed'
    | 'hypothesis'
    | 'recommendation';
  text: string;
  evidence_ids: string[];
};
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
  recording_origin?: string;
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
  journal?: RunJournal;
};
export type RunEvent = {
  id: string;
  run_id: string;
  seq: number;
  at: string;
  kind: string;
  call_id?: string;
  parent_id?: string;
  payload: unknown;
};
export type RunJournal = {
  schema_version: 2;
  state: 'running' | 'completed' | 'failed' | 'interrupted';
  history: { role: 'user' | 'assistant'; content: string }[];
  parent_run_id?: string;
  case_id?: string;
  evaluation_id?: string;
  attempt_id?: string;
  configuration: {
    version: string;
    source_hash?: string;
    prompt_hash: string;
    tools_hash: string;
    engine_hash: string;
    instruction: string;
    metric_policy: string;
  };
  source: Pick<
    Dataset,
    'id' | 'name' | 'rows' | 'sha256' | 'synthetic' | 'preparation'
  >;
  events: RunEvent[];
  usage_complete: boolean;
  provider_requests: number;
  error?: string;
  finished_at?: string;
};
export type Review = {
  id: string;
  run_id: string;
  anchor: string;
  scope: 'claim' | 'run' | 'adjustment';
  category: string;
  verdict: 'pass' | 'fail' | 'not_reviewed';
  expected: string;
  comment: string;
  reviewer: string;
  role: 'author' | 'independent';
  rubric: string;
  created_at: string;
  supersedes?: string;
  approved_test: boolean;
  adjustment?: {
    amount: number;
    sign: 1 | -1;
    tax_treatment: string;
    source: string;
    recurrence: string;
    rationale: string;
    status: 'proposed' | 'approved' | 'rejected';
  };
};
