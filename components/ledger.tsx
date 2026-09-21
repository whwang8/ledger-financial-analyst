'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BarChart3,
  Sparkles,
  ArrowRight,
  Database,
  FlaskConical,
  ArrowUp,
  RotateCcw,
  Download,
  FileCheck2,
  Clock3,
  Link2,
  AlertCircle,
  ChevronRight,
  LoaderCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Dataset, Fact, Run } from '@/lib/types';
import { displayFact, metricLabel, money } from '@/lib/format';
type Status = {
  enabled: boolean;
  openai: boolean;
  anthropic: boolean;
  default_provider: string;
};
type Report = {
  status: string;
  cases: number;
  attempted: number;
  passed: number | null;
  reviewed: number;
  note: string;
};
const questions = [
  'Why did operating profit change from Q1 to Q2?',
  'Investigate the biggest cost driver month by month.',
  'Is the data complete enough for a quarterly comparison?',
];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
export default function Ledger({ datasets }: { datasets: Dataset[] }) {
  const [datasetId, setDatasetId] = useState(datasets[0].id),
    [provider, setProvider] = useState('openai'),
    [status, setStatus] = useState<Status | null>(null),
    [input, setInput] = useState(''),
    [runs, setRuns] = useState<Run[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [selectedFact, setSelectedFact] = useState<Fact | null>(null),
    [tab, setTab] = useState('overview'),
    [report, setReport] = useState<Report | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null),
    end = useRef<HTMLDivElement>(null),
    current = useRef({ datasetId, runs, busy });
  useEffect(() => {
    current.current = { datasetId, runs, busy };
  }, [datasetId, runs, busy]);
  const dataset = datasets.find((d) => d.id === datasetId)!;
  const ready =
    !!status?.enabled && !!status?.[provider as 'openai' | 'anthropic'];
  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((value) => {
        const s = value as Status;
        setStatus(s);
        setProvider(s.default_provider);
      })
      .catch(() =>
        setError('Could not load provider status. Refresh to try again.'),
      );
    fetch('/evaluation-summary.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((value) => setReport(value as Report | null))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (runs.length)
      end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [runs.length]);
  function changeDataset(id: string) {
    if (busy) return;
    setDatasetId(id);
    setRuns([]);
    setSelectedFact(null);
    setError('');
    setInput('');
  }
  async function analyze(
    mode: 'live' | 'calculation_preview' = 'live',
    question = input,
  ) {
    if (busy) return null;
    if (mode === 'live' && !question.trim()) return null;
    setBusy(true);
    setError('');
    try {
      const history = runs
        .filter((r) => r.mode === 'live')
        .slice(-3)
        .flatMap((r) => [
          { role: 'user', content: r.question },
          {
            role: 'assistant',
            content: [
              r.analysis.summary,
              ...r.analysis.findings.map((f) => f.text),
              ...r.analysis.limitations,
            ]
              .join('\n')
              .slice(0, 3000),
          },
        ]);
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: datasetId,
          provider,
          question,
          history,
          mode,
        }),
      });
      const result = (await response.json()) as Run & { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Analysis failed');
      const run = result as Run;
      setRuns((prev) => [...prev, run]);
      setInput('');
      return run;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
      return null;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    type Context = {
      registerTool: (
        t: {
          name: string;
          description: string;
          inputSchema: object;
          annotations: object;
          execute: (i: unknown) => unknown;
        },
        o: { signal: AbortSignal },
      ) => unknown;
    };
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const specs = [
      {
        name: 'get_current_financial_analysis',
        description:
          'Read the selected synthetic company and latest displayed analysis.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => ({
          dataset_id: current.current.datasetId,
          latest_analysis: current.current.runs.at(-1) ?? null,
          busy: current.current.busy,
        }),
      },
      {
        name: 'select_financial_company',
        description:
          'Select a synthetic company in the visible workspace and clear the current conversation.',
        inputSchema: {
          type: 'object',
          properties: {
            dataset_id: { type: 'string', enum: datasets.map((d) => d.id) },
          },
          required: ['dataset_id'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (i: unknown) => {
          const id = (i as { dataset_id?: unknown })?.dataset_id;
          if (typeof id !== 'string' || !datasets.some((d) => d.id === id))
            throw new Error('Unknown dataset');
          if (current.current.busy)
            throw new Error('Wait until analysis finishes');
          setDatasetId(id);
          setRuns([]);
          setSelectedFact(null);
          setError('');
          setInput('');
          current.current = { datasetId: id, runs: [], busy: false };
          return { dataset_id: id, conversation_cleared: true };
        },
      },
    ];
    for (const tool of specs) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: controller.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => controller.abort();
  }, [datasets]);
  const q2 = dataset.periods['2025-Q2'],
    delta = dataset.comparisons['2025-Q1→2025-Q2'];
  const chart = dataset.rows.map((r) => ({
    month: months[Number(r.month.slice(5)) - 1],
    Revenue: r.revenue,
    'Operating profit': dataset.periods[r.month].facts.find(
      (f) => f.metric === 'operating_profit',
    )!.value,
  }));
  const chooseQuestion = (q: string) => {
    setInput(q);
    textarea.current?.focus();
  };
  function download(run: Run) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-${run.dataset_id}-${run.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main>
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <BarChart3 size={22} />
          </span>
          ledger<span className="brand-caption">Financial analyst</span>
        </Link>
        <div className="header-right">
          <span className="badge">Synthetic data</span>
          <a
            href="https://github.com/whwang8"
            target="_blank"
            rel="noreferrer"
            className="profile-link"
          >
            William Hwang <ArrowUpRight size={16} />
          </a>
        </div>
      </header>
      <div className="workspace">
        <section className="data-panel">
          <div className="eyebrow">COMPANY WORKSPACE / 2025</div>
          <div className="company-row">
            <h1>
              {dataset.name}
              <span className="dot">.</span>
            </h1>
            <Select
              value={datasetId}
              onValueChange={(v) => {
                if (v) changeDataset(v);
              }}
              disabled={busy}
            >
              <SelectTrigger
                aria-label="Select synthetic company"
                className="company-picker"
              >
                <Database size={16} />
                <SelectValue>Change company</SelectValue>
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false}>
                {datasets.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="muted">
            Operating performance · January–June 2025 · USD
          </p>
          <div className="metric-grid">
            {['revenue', 'operating_profit', 'gross_margin'].map((m) => {
              const f = q2.facts.find((f) => f.metric === m)!;
              const change = delta.facts.find(
                (f) =>
                  f.metric === m &&
                  f.id.endsWith(
                    m === 'gross_margin' ? ':change' : ':percent_change',
                  ),
              );
              return (
                <button
                  className="metric"
                  key={m}
                  onClick={() => setSelectedFact(f)}
                  aria-label={`Inspect evidence for Q2 ${metricLabel(m)}`}
                >
                  <span>Q2 {metricLabel(m).toUpperCase()}</span>
                  <strong>
                    {f.value === null
                      ? '—'
                      : m === 'gross_margin'
                        ? `${f.value.toFixed(1)}%`
                        : money(f.value)}
                  </strong>
                  <small
                    className={
                      change?.value === null
                        ? ''
                        : (change?.value ?? 0) >= 0
                          ? 'positive'
                          : 'negative'
                    }
                  >
                    {change?.value === null
                      ? 'Incomplete quarter'
                      : `${(change?.value ?? 0) > 0 ? '+' : ''}${change?.value?.toFixed(1)}${m === 'gross_margin' ? ' pp' : '%'} vs Q1`}
                  </small>
                </button>
              );
            })}
          </div>
          {!q2.complete && (
            <div className="coverage-note">
              <AlertCircle size={17} />
              <span>
                May is missing. Q2 totals and quarter comparisons are
                unavailable.
              </span>
            </div>
          )}
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList variant="line" className="workspace-tabs">
              <TabsTrigger value="overview">
                <BarChart3 size={16} />
                Overview
              </TabsTrigger>
              <TabsTrigger value="source">
                <Database size={16} />
                Source data
              </TabsTrigger>
              <TabsTrigger value="evaluation">
                <FlaskConical size={16} />
                Evaluation
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <div className="panel chart-panel">
                <div className="panel-heading">
                  <h2>Revenue & operating profit</h2>
                  <span className="muted">Monthly · USD</span>
                </div>
                <div className="chart">
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart
                      data={chart}
                      margin={{ top: 8, right: 20, bottom: 0, left: 4 }}
                    >
                      <CartesianGrid vertical={false} stroke="#e7edf4" />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: '#65758a' }}
                      />
                      <YAxis
                        tickFormatter={(v) => `${v / 1000}k`}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: '#65758a' }}
                        width={45}
                      />
                      <Tooltip
                        formatter={(v) => money(Number(v))}
                        contentStyle={{
                          borderRadius: 8,
                          borderColor: '#dce3ed',
                          fontSize: 14,
                        }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={7}
                        wrapperStyle={{ fontSize: 13, paddingTop: 18 }}
                      />
                      <Bar
                        dataKey="Revenue"
                        fill="#2858cc"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={38}
                      />
                      <Line
                        type="linear"
                        dataKey="Operating profit"
                        stroke="#21a590"
                        strokeWidth={2.5}
                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bridge-card">
                <div className="panel-heading">
                  <h2>What changed from Q1 to Q2?</h2>
                  <span className="badge">Profit bridge</span>
                </div>
                {dataset.bridges['2025-Q1→2025-Q2'].facts.map((f) => (
                  <button
                    className="bridge-row"
                    key={f.id}
                    onClick={() => setSelectedFact(f)}
                  >
                    <span>
                      {metricLabel(f.metric)}
                      {f.metric === 'operating_profit'
                        ? ' change'
                        : ' contribution'}
                    </span>
                    <strong
                      className={
                        f.value === null
                          ? ''
                          : f.value >= 0
                            ? 'positive'
                            : 'negative'
                      }
                    >
                      {f.value === null
                        ? 'Unavailable'
                        : `${f.value > 0 ? '+' : ''}${money(f.value)}`}
                    </strong>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="source">
              <div className="panel source-panel">
                <div className="panel-heading">
                  <h2>Monthly source records</h2>
                  <span className="badge">Synthetic · USD</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>COGS</TableHead>
                      <TableHead>Operating expenses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataset.rows.map((r) => (
                      <TableRow key={r.row_id}>
                        <TableCell>{r.month}</TableCell>
                        <TableCell>{money(r.revenue)}</TableCell>
                        <TableCell>{money(r.cogs)}</TableCell>
                        <TableCell>{money(r.operating_expenses)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="source-note">
                  Costs are positive expense amounts. Profit and margins are
                  calculated in Python. Missing months remain unknown.
                </div>
                <div className="hash">
                  Dataset SHA-256
                  <br />
                  {dataset.sha256}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="evaluation">
              <div className="panel evaluation-panel">
                <span className="eval-icon">
                  <FlaskConical />
                </span>
                <h2>Evaluate the investigation.</h2>
                <p>
                  The check set covers financial accuracy, tool selection,
                  missing information, and unsupported business explanations.
                </p>
                <div className="eval-stats">
                  <div>
                    <strong>6</strong>
                    <span>Synthetic datasets</span>
                  </div>
                  <div>
                    <strong>12</strong>
                    <span>Final check tasks</span>
                  </div>
                  <div>
                    <strong>{report?.attempted ?? 0}</strong>
                    <span>Live tasks run</span>
                  </div>
                </div>
                <div className="evaluation-status">
                  <FileCheck2 size={18} />
                  <span>
                    {report?.note ??
                      'Live model evaluation has not been run. Calculation previews are not LLM results.'}
                  </span>
                </div>
                <p className="muted">
                  Three datasets were used for development; three for the
                  first check set. Narrative support requires human review
                  even when evidence references are valid.
                </p>
                <a href="/evaluation-cases.json" download className="text-link">
                  Download tasks and review rubric <ArrowUpRight size={15} />
                </a>
                <p>
                  <a href="/evaluation-report.md" download className="text-link">
                    Download results and known failures <ArrowUpRight size={15} />
                  </a>
                </p>
              </div>
            </TabsContent>
          </Tabs>
          {selectedFact && (
            <section className="evidence-card" aria-live="polite">
              <div className="panel-heading">
                <h2>
                  <Link2 size={16} /> Calculation evidence
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFact(null)}
                >
                  Close
                </Button>
              </div>
              <div className="evidence-body">
                <span className="eyebrow">{selectedFact.period}</span>
                <h3>
                  {metricLabel(selectedFact.metric)}{' '}
                  <strong>{displayFact(selectedFact)}</strong>
                </h3>
                <code>{selectedFact.formula}</code>
                {selectedFact.reason && (
                  <p className="negative">{selectedFact.reason}</p>
                )}
                <p className="muted">
                  Source records:{' '}
                  {selectedFact.source_row_ids.join(', ') ||
                    'No records available'}
                </p>
                <p className="hash">{selectedFact.id}</p>
              </div>
            </section>
          )}
          <div className="bottom-note">
            <ArrowUpRight size={17} />
            Python calculates. The LLM chooses what to investigate.
          </div>
        </section>
        <section className="analyst-panel">
          <div className="analyst-heading">
            <div>
              <Sparkles size={19} />
              <h2>Your analyst</h2>
            </div>
            <div className="analyst-actions">
              <Select
                value={provider}
                onValueChange={(v) => {
                  if (v) setProvider(v);
                }}
                disabled={busy}
              >
                <SelectTrigger aria-label="Model provider">
                  <SelectValue>
                    {provider === 'openai' ? 'OpenAI' : 'Anthropic'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {['openai', 'anthropic'].map((p) => (
                    <SelectItem value={p} key={p}>
                      {p === 'openai' ? 'OpenAI' : 'Anthropic'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Clear conversation"
                disabled={busy || !runs.length}
                onClick={() => {
                  setRuns([]);
                  setError('');
                  setSelectedFact(null);
                }}
              >
                <RotateCcw size={16} />
              </Button>
            </div>
          </div>
          <div className="conversation" aria-live="polite">
            {runs.length === 0 ? (
              <>
                <div className="analyst-mark">
                  <Sparkles />
                </div>
                <h2>Follow the numbers.</h2>
                <p className="muted">
                  Ask a financial question. Your analyst chooses the tools,
                  investigates the changes, and connects its findings to the
                  evidence.
                </p>
                <div className="prompt-list">
                  {questions.map((q) => (
                    <Button
                      variant="outline"
                      className="prompt-card"
                      key={q}
                      onClick={() => chooseQuestion(q)}
                    >
                      {q}
                      <ArrowRight size={16} />
                    </Button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  className="preview-button"
                  disabled={busy}
                  onClick={() => void analyze('calculation_preview')}
                >
                  <FileCheck2 size={17} />
                  Explore a calculation preview
                  <ArrowRight size={15} />
                </Button>
                <p className="preview-label">
                  No model call · Inspect the Python calculations
                </p>
                {!ready && (
                  <Accordion className="setup-accordion">
                    <AccordionItem value="setup">
                      <AccordionTrigger>
                        <span className="setup-title">
                          <span className="status-dot" />
                          Connect a model to start live analysis
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p>
                          Add a provider key to <code>.env.local</code> and
                          restart the app. Set <code>ENABLE_LIVE_LLM=true</code>
                          . Keys stay on the server.
                        </p>
                        <p>
                          Use <code>OPENAI_API_KEY</code> or{' '}
                          <code>ANTHROPIC_API_KEY</code>. Choose the matching
                          provider above.
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </>
            ) : (
              runs.map((run, index) => (
                <article className="run" key={run.id}>
                  <div className="user-question">
                    <span>You</span>
                    <p>{run.question}</p>
                  </div>
                  <div className="answer-heading">
                    <Sparkles size={17} />
                    <strong>
                      {run.mode === 'live'
                        ? 'Ledger analyst'
                        : 'Calculation preview'}
                    </strong>
                    <span className="badge">
                      {run.mode === 'live' ? 'LLM response' : 'No model call'}
                    </span>
                  </div>
                  <h3 className="answer-summary">{run.analysis.summary}</h3>
                  <div className="findings">
                    {run.analysis.findings.map((f, i) => (
                      <div className="finding" key={i}>
                        <p>{f.text}</p>
                        <div className="citations">
                          {f.evidence_ids.map((id) => {
                            const fact = run.facts.find((f) => f.id === id);
                            return (
                              <button
                                key={id}
                                onClick={() => {
                                  if (fact) setSelectedFact(fact);
                                }}
                                title={id}
                              >
                                <Link2 size={11} />
                                {fact
                                  ? `${metricLabel(fact.metric)} · ${fact.period}`
                                  : 'Evidence'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {run.analysis.limitations.length > 0 && (
                    <div className="limitations">
                      <h3>Limits of this analysis</h3>
                      {run.analysis.limitations.map((l, i) => (
                        <p key={i}>{l}</p>
                      ))}
                    </div>
                  )}
                  <Accordion className="trace-accordion">
                    <AccordionItem value="trace">
                      <AccordionTrigger>
                        <span className="trace-title">
                          <Database size={15} />
                          {
                            run.trace.filter(
                              (t) => t.tool !== 'submit_analysis',
                            ).length
                          }{' '}
                          tool calls · Inspect activity
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        {run.trace.map((t) => (
                          <div className="trace-step" key={t.step}>
                            <span>{String(t.step).padStart(2, '0')}</span>
                            <div>
                              <strong>{t.tool.replaceAll('_', ' ')}</strong>
                              <pre>{JSON.stringify(t.arguments, null, 2)}</pre>
                            </div>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  <div className="run-meta">
                    <span>
                      <Clock3 size={12} />
                      {(run.elapsed_ms / 1000).toFixed(1)}s ·{' '}
                      {run.mode === 'live' ? run.model : 'deterministic'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => download(run)}
                    >
                      <Download size={13} />
                      Trace
                    </Button>
                  </div>
                  {index === runs.length - 1 &&
                    run.analysis.suggested_questions.map((q) => (
                      <Button
                        key={q}
                        variant="outline"
                        className="followup"
                        onClick={() => chooseQuestion(q)}
                      >
                        {q}
                        <ArrowRight size={14} />
                      </Button>
                    ))}
                </article>
              ))
            )}
            {busy && (
              <div className="thinking">
                <LoaderCircle className="spinner" size={17} />
                <span>Investigating the available evidence…</span>
              </div>
            )}
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <div ref={end} />
          </div>
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              void analyze();
            }}
          >
            <Textarea
              ref={textarea}
              value={input}
              maxLength={3000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (ready && !busy) void analyze();
                }
              }}
              aria-label="Ask the financial analyst"
              placeholder="Ask about this company's performance…"
              disabled={busy}
            />
            <Button
              type="submit"
              disabled={busy || !input.trim() || !ready}
              aria-label="Send question"
            >
              {busy ? (
                <LoaderCircle size={17} className="spinner" />
              ) : (
                <ArrowUp size={19} />
              )}
            </Button>
          </form>
          <p className="footer-note">
            <span className={`status-dot ${ready ? 'online' : ''}`} />
            {ready
              ? 'Live model connected'
              : status
                ? 'Live analysis needs an API key'
                : 'Checking model connection…'}{' '}
            · Synthetic financial data
          </p>
        </section>
      </div>
    </main>
  );
}
