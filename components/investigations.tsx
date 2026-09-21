'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  BarChart3,
  ArrowUpRight,
  Play,
  FileText,
  FlaskConical,
  LoaderCircle,
  ChevronRight,
} from 'lucide-react';
import type { Dataset, Fact, Review, Run } from '@/lib/types';
import { displayFact, metricLabel } from '@/lib/format';
import type { IterationReport } from '@/lib/reports';
import { activeReviews, comparable } from '@/lib/reports';
import type metricDefinition from '@/data/metrics/cost-to-revenue.json';
const formatUnknown = (v: unknown) =>
  typeof v === 'string' ? v : JSON.stringify(v);
type Summary = {
  example?: boolean;
  id: string;
  question: string;
  dataset_id: string;
  state: string;
  created_at: string;
};
type Artifact = {
  id: string;
  kind: string;
  report: IterationReport;
  markdown: string;
  content_hash: string;
};
const historicalId = 'historical-missing-may';
async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const value = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(value.error ?? 'Request failed.');
  return value;
}
const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
function DataObject({
  value,
  label = 'Raw recorded payload',
}: {
  value: unknown;
  label?: string;
}) {
  return (
    <details className="iw-disclosure">
      <summary>{label}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
function Amount({ fact }: { fact: Fact }) {
  return (
    <span className="iw-amount">
      {fact.unit === 'coverage'
        ? fact.reason
        : fact.unit === 'passage'
          ? fact.passage
          : displayFact(fact)}
    </span>
  );
}
function ModelExchange({
  payload,
  direction,
}: {
  payload: unknown;
  direction: 'input' | 'output';
}) {
  const p = payload as Record<string, unknown>;
  const entries = (
    direction === 'input' ? (p.input ?? p.messages) : (p.output ?? p.content)
  ) as Record<string, unknown>[] | undefined;
  const messages = (Array.isArray(entries) ? entries : []).filter(
    (x) => x.role === 'user' && typeof x.content === 'string',
  );
  const calls = (Array.isArray(entries) ? entries : []).filter((x) =>
    ['function_call', 'tool_use'].includes(String(x.type)),
  );
  const tools = Array.isArray(p.tools) ? (p.tools as { name?: string }[]) : [];
  const results = (Array.isArray(entries) ? entries : []).flatMap((x) =>
    x.type === 'function_call_output'
      ? [x]
      : Array.isArray(x.content)
        ? (x.content as Record<string, unknown>[]).filter(
            (c) => c.type === 'tool_result',
          )
        : [],
  );
  return (
    <div className="iw-readable-exchange">
      {direction === 'input' ? (
        <>
          <p className="iw-muted">
            {tools.length} available tools · {results.length} tool results in
            context
          </p>
          {messages.at(-1) && (
            <blockquote>{String(messages.at(-1)!.content)}</blockquote>
          )}
          <details>
            <summary>Read the analyst instructions</summary>
            <p>{formatUnknown(p.instructions ?? p.system ?? 'Not recorded')}</p>
          </details>
          <details>
            <summary>Available tools</summary>
            {tools.map((t, i) => (
              <p key={i}>{metricLabel(t.name ?? 'tool')}</p>
            ))}
          </details>
          {results.length > 0 && (
            <details>
              <summary>Evidence supplied to this call</summary>
              {results.map((x, i) => {
                let v: { facts?: Fact[]; error?: string } = {};
                try {
                  v = JSON.parse(String(x.output ?? x.content));
                } catch {}
                return (
                  <div key={i}>
                    {v.error ? (
                      <p>{v.error}</p>
                    ) : v.facts?.length ? (
                      <ul>
                        {v.facts.map((f) => (
                          <li key={f.id}>
                            {metricLabel(f.metric)} · {f.period}:{' '}
                            {f.unit === 'coverage'
                              ? f.reason
                              : f.unit === 'passage'
                                ? f.passage
                                : displayFact(f)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Tool result without financial facts.</p>
                    )}
                  </div>
                );
              })}
            </details>
          )}
        </>
      ) : (
        <>
          {p.error && <p className="iw-warning">{formatUnknown(p.error)}</p>}
          {calls.map((c, i) => {
            let args: Record<string, unknown> = {};
            try {
              args =
                typeof c.arguments === 'string'
                  ? JSON.parse(c.arguments)
                  : ((c.input as Record<string, unknown>) ?? {});
            } catch {}
            return (
              <div key={i}>
                <h3>
                  {c.name === 'submit_analysis'
                    ? 'Proposed final answer'
                    : metricLabel(String(c.name))}
                </h3>
                {typeof args.summary === 'string' ? (
                  <p>{args.summary}</p>
                ) : (
                  <dl>
                    {Object.entries(args).map(([k, v]) => (
                      <div key={k}>
                        <dt>{metricLabel(k)}</dt>
                        <dd>{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {!Object.keys(args).length && (
                  <p className="iw-muted">No arguments required.</p>
                )}
              </div>
            );
          })}
          {!calls.length && !p.error && (
            <p className="iw-muted">
              No tool call returned. Inspect the recorded response for text,
              refusal or completion status.
            </p>
          )}
        </>
      )}
    </div>
  );
}
export default function InvestigationWorkspace({
  datasets,
  definition,
}: {
  datasets: { id: string; name: string; synthetic: boolean }[];
  definition: typeof metricDefinition;
}) {
  const [page, setPage] = useState<'inspect' | 'reports' | 'metric' | 'apple'>(
      'inspect',
    ),
    [tab, setTab] = useState('source');
  const [saved, setSaved] = useState<Summary[]>([]),
    [run, setRun] = useState<Run | null>(null),
    [source, setSource] = useState<Dataset | null>(null),
    [reviews, setReviews] = useState<Review[]>([]),
    [selected, setSelected] = useState('summary'),
    [factId, setFactId] = useState('');
  const [datasetId, setDatasetId] = useState('company-06'),
    [provider, setProvider] = useState('openai'),
    [question, setQuestion] = useState(
      'Since reported Q2 profit is $80,000 versus Q1’s $72,000, can I say profit improved by 11.11%?',
    ),
    [instruction, setInstruction] = useState(''),
    [metricEnabled, setMetricEnabled] = useState(false);
  const [busy, setBusy] = useState(false),
    [activeId, setActiveId] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [ready, setReady] = useState<{
      enabled: boolean;
      openai: boolean;
      anthropic: boolean;
    } | null>(null);
  const [reviewer, setReviewer] = useState('William Hwang'),
    [role, setRole] = useState<'author' | 'independent'>('author'),
    [scope, setScope] = useState<'claim' | 'run'>('claim'),
    [verdict, setVerdict] = useState<'fail' | 'pass' | 'not_reviewed'>('fail'),
    [category, setCategory] = useState('Compared incomplete periods'),
    [expected, setExpected] = useState(''),
    [comment, setComment] = useState(''),
    [approved, setApproved] = useState(false),
    [supersedes, setSupersedes] = useState('');
  const [reportSelection, setReportSelection] = useState<string[]>([]),
    [artifact, setArtifact] = useState<Artifact | null>(null),
    [reportHistory, setReportHistory] = useState<
      { id: string; kind: string; created_at: string }[]
    >([]),
    [comparison, setComparison] = useState<Run | null>(null);
  const [adjustment, setAdjustment] = useState({
    amount: '',
    sign: '-1',
    source: '',
    rationale: '',
    recurrence: '',
    tax_treatment: 'Not assessed',
    status: 'proposed',
  });
  async function refresh() {
    const [r, h] = await Promise.all([
      json<{ runs: Summary[] }>('/api/runs'),
      json<{ reports: typeof reportHistory }>('/api/reports'),
    ]);
    setSaved(r.runs);
    setReportHistory(h.reports);
  }
  async function openRun(id: string, quiet = false) {
    const v = await json<{ run: Run; reviews: Review[]; source: Dataset }>(
      '/api/runs/' + id,
    );
    setRun(v.run);
    setReviews(v.reviews);
    setSource(v.source);
    if (!quiet) {
      setSelected('summary');
      setFactId('');
      setComparison(null);
      setPage('inspect');
      setNotice('');
      setSupersedes('');
      window.history.replaceState({}, '', `/investigations?run=${id}`);
    }
    return v.run;
  }
  useEffect(() => {
    void json<typeof ready>('/api/status')
      .then(async (status) => {
        setReady(status);
        await refresh();
        const id =
          new URLSearchParams(window.location.search).get('run') ||
          'recorded-example';
        await openRun(id);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!activeId) return;
    const timer = setInterval(() => {
      openRun(activeId, true).catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [activeId]);
  async function analyze(parent?: Run) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    const id = crypto.randomUUID();
    setActiveId(id);
    setPage('inspect');
    setTab('model');
    try {
      const response = await fetch(
        '/api/analyze',
        post({
          run_id: id,
          dataset_id: parent?.dataset_id ?? datasetId,
          provider,
          question: parent?.question ?? question,
          history: parent?.journal?.history ?? [],
          mode: 'live',
          parent_run_id: parent?.id,
          instruction,
          metric_policy: metricEnabled ? 'include_cost_ratio' : 'core',
          metric_reviewed: metricEnabled,
        }),
      );
      const value = (await response.json()) as {
        run?: Run;
        id?: string;
        error?: string;
      };
      if (value.run) await openRun(value.run.id);
      else if (value.id) await openRun(value.id);
      if (!response.ok) throw new Error(value.error ?? 'Investigation failed.');
      await refresh();
      setNotice(
        'Investigation saved. Review its evidence before relying on the answer.',
      );
    } catch (e) {
      setError((e as Error).message);
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
      setActiveId('');
    }
  }
  function downloadRun() {
    if (!run) return;
    const a = document.createElement('a'),
      url = URL.createObjectURL(
        new Blob([JSON.stringify({ run, reviews }, null, 2)], {
          type: 'application/json',
        }),
      );
    a.href = url;
    a.download = `ledger-${run.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function saveReview() {
    if (!run) return;
    setError('');
    try {
      await json(
        '/api/reviews',
        post({
          run_id: run.id,
          anchor: scope === 'run' ? 'run' : selected,
          scope,
          category,
          verdict,
          expected,
          comment,
          reviewer,
          role,
          approved_test: approved,
          supersedes: supersedes || undefined,
        }),
      );
      await openRun(run.id, true);
      setNotice(
        approved
          ? 'Review and approved regression case saved.'
          : 'Review saved.',
      );
      setSupersedes('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function generateReport(kind = 'iteration') {
    setError('');
    try {
      const ids = kind === 'memo' && run ? [run.id] : reportSelection;
      if (!ids.length) throw new Error('Select at least one investigation.');
      const a = await json<Artifact>(
        '/api/reports',
        post({ run_ids: ids, kind }),
      );
      setArtifact(a);
      setPage('reports');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function saveAdjustment() {
    if (!run) return;
    setError('');
    try {
      await json(
        '/api/reviews',
        post({
          run_id: run.id,
          anchor: 'adjustments',
          scope: 'adjustment',
          category: 'Proposed accounting adjustment',
          verdict: 'not_reviewed',
          expected: '',
          comment,
          reviewer,
          role,
          approved_test: false,
          adjustment: {
            ...adjustment,
            amount: Number(adjustment.amount),
            sign: Number(adjustment.sign),
          },
        }),
      );
      await openRun(run.id, true);
      setNotice('Adjustment saved separately. Reported figures are unchanged.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const finding = run?.analysis.findings.find(
    (f, i) => (f.id ?? 'claim-' + (i + 1)) === selected,
  );
  const facts = run?.facts ?? [],
    linked = finding
      ? facts.filter((f) => finding.evidence_ids.includes(f.id))
      : facts;
  const fact = facts.find((f) => f.id === factId) ?? linked[0] ?? facts[0];
  const journal = run?.journal,
    events = journal?.events ?? [];
  const sourceData = journal?.source ?? source;
  const claimText =
    selected === 'summary' ? run?.analysis.summary : finding?.text;
  const canRun =
    !!ready?.enabled && !!ready?.[provider as 'openai' | 'anthropic'];
  const actualReviews = activeReviews(reviews);
  return (
    <main className="investigation-app">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <BarChart3 size={22} />
          </span>
          ledger<span className="brand-caption">Investigation workspace</span>
        </Link>
        <Link className="iw-link" href="/">
          Financial overview <ArrowUpRight size={16} />
        </Link>
      </header>
      <nav className="iw-nav" aria-label="Workspaces">
        {[
          ['inspect', 'Investigations'],
          ['reports', 'Iteration reports'],
          ['metric', 'Metric lab'],
          ['apple', 'Apple filing pilot'],
        ].map(([key, label]) => (
          <Button
            key={key}
            aria-pressed={page === key}
            onClick={() => setPage(key as typeof page)}
          >
            {label}
          </Button>
        ))}
      </nav>
      {error && (
        <div className="iw-notice error" role="alert">
          {error}
        </div>
      )}
      {notice && <output className="iw-notice iw-success">{notice}</output>}
      {page === 'inspect' && (
        <div className="iw-shell">
          <aside className="iw-rail">
            <div className="iw-section-heading">
              <h2>Saved investigations</h2>
              <Button
                onClick={() => refresh().catch((e) => setError(e.message))}
              >
                Refresh
              </Button>
            </div>
            <Button
              className={`iw-saved ${run?.id === historicalId ? 'is-selected' : ''}`}
              onClick={() =>
                openRun(historicalId).catch((e) => setError(e.message))
              }
            >
              <span className="iw-kicker">Historical failure</span>
              <strong>Missing May, misleading growth</strong>
              <span>Original answer and caveats preserved</span>
            </Button>
            {saved.map((s) => (
              <Button
                key={s.id}
                className={`iw-saved ${run?.id === s.id ? 'is-selected' : ''}`}
                onClick={() => openRun(s.id).catch((e) => setError(e.message))}
              >
                <span className="iw-kicker">
                  {s.example ? 'Recorded example · ' : ''}
                  {s.dataset_id} · {s.state}
                </span>
                <strong>{s.question}</strong>
                <span>{new Date(s.created_at).toLocaleString()}</span>
              </Button>
            ))}
            {!saved.length && (
              <p className="iw-muted">
                Your next investigation will appear here, including partial
                failures.
              </p>
            )}
          </aside>
          <div className="iw-content">
            <form
              className="iw-panel iw-new"
              onSubmit={(e) => {
                e.preventDefault();
                void analyze();
              }}
            >
              <div className="iw-section-heading">
                <h1>Follow the evidence.</h1>
                <span className="iw-muted">
                  {busy
                    ? 'Recording activity…'
                    : 'Saved runs reopen without model calls'}
                </span>
              </div>
              <div className="iw-fields">
                <label htmlFor="iw-field-1">
                  Dataset
                  <NativeSelect
                    id="iw-field-1"
                    aria-label="Dataset"
                    value={datasetId}
                    onChange={(e) => setDatasetId(e.target.value)}
                  >
                    {datasets.map((d) => (
                      <NativeSelectOption key={d.id} value={d.id}>
                        {d.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
                <label htmlFor="iw-field-2">
                  Model provider
                  <NativeSelect
                    id="iw-field-2"
                    aria-label="Model provider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                  >
                    <NativeSelectOption value="openai">
                      OpenAI
                    </NativeSelectOption>
                    <NativeSelectOption value="anthropic">
                      Anthropic
                    </NativeSelectOption>
                  </NativeSelect>
                </label>
              </div>
              <label htmlFor="iw-field-3">
                Investigation question
                <Textarea
                  id="iw-field-3"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={3000}
                />
              </label>
              <div className="iw-actions">
                <Button
                  className="iw-primary"
                  type="submit"
                  disabled={busy || !canRun || !question.trim()}
                >
                  {busy ? (
                    <LoaderCircle className="spinner" size={17} />
                  ) : (
                    <Play size={16} />
                  )}
                  Start investigation
                </Button>
                {!canRun && (
                  <span className="iw-muted">
                    This provider is unavailable. Saved evidence remains
                    accessible.
                  </span>
                )}
              </div>
            </form>
            {run && (
              <>
                <div className="iw-section-heading iw-run-heading">
                  <div>
                    <span className="iw-kicker">
                      {sourceData?.name ?? run.dataset_id} ·{' '}
                      {journal?.state ?? 'Historical record'}
                    </span>
                    <h2>{run.question}</h2>
                    <p className="iw-muted">
                      {run.recording_origin && (
                        <span>{run.recording_origin} · </span>
                      )}
                      {run.model} · {(run.elapsed_ms / 1000).toFixed(1)}s ·
                      Semantic review:{' '}
                      {actualReviews.some((r) => r.scope === 'run')
                        ? 'see reviews'
                        : 'pending'}
                    </p>
                  </div>
                  <div className="iw-actions">
                    <Button onClick={downloadRun}>Export evidence</Button>
                    <Button onClick={() => generateReport('memo')}>
                      <FileText size={16} />
                      Financial memo
                    </Button>
                  </div>
                </div>
                {['failed', 'interrupted'].includes(journal?.state ?? '') && (
                  <div className="error">
                    {journal?.error} Earlier events remain inspectable.
                  </div>
                )}
                <div className="iw-inspector">
                  <aside className="iw-claims">
                    <span className="iw-kicker">Choose a claim to inspect</span>
                    <Button
                      className={selected === 'summary' ? 'is-selected' : ''}
                      onClick={() => {
                        setSelected('summary');
                        setFactId('');
                      }}
                    >
                      <span>Summary</span>
                      <strong>{run.analysis.summary}</strong>
                    </Button>
                    {run.analysis.findings.map((f, i) => (
                      <Button
                        key={i}
                        className={
                          selected === (f.id ?? 'claim-' + (i + 1))
                            ? 'is-selected'
                            : ''
                        }
                        onClick={() => {
                          setSelected(f.id ?? 'claim-' + (i + 1));
                          setFactId('');
                        }}
                      >
                        <span>
                          {f.kind ?? 'Historical finding'} {i + 1}
                        </span>
                        <strong>{f.text}</strong>
                        {f.kind === 'financial' &&
                          f.evidence_ids.map((id) => {
                            const v = facts.find((x) => x.id === id);
                            return v ? (
                              <small key={id}>
                                {metricLabel(v.metric)} · {v.period}:{' '}
                                {displayFact(v)}
                              </small>
                            ) : null;
                          })}
                      </Button>
                    ))}
                    <details>
                      <summary>Limits and next questions</summary>
                      {[
                        ...run.analysis.limitations,
                        ...run.analysis.suggested_questions,
                      ].map((s, i) => (
                        <p key={i}>{s}</p>
                      ))}
                    </details>
                  </aside>
                  <section className="iw-detail">
                    <nav className="iw-detail-nav" aria-label="Evidence views">
                      {[
                        ['source', 'Source'],
                        ['calculation', 'Calculation'],
                        ['model', 'Model I/O'],
                        ['review', 'Review & rerun'],
                      ].map(([key, label], i) => (
                        <Button
                          aria-pressed={tab === key}
                          key={key}
                          onClick={() => setTab(key)}
                        >
                          {i + 1} · {label}
                        </Button>
                      ))}
                    </nav>
                    <div className="iw-detail-body">
                      {tab === 'source' && (
                        <div className="iw-stack">
                          <h2>
                            {selected === 'summary'
                              ? 'What evidence was retrieved?'
                              : 'Which records support this claim?'}
                          </h2>
                          {selected === 'summary' && (
                            <p className="iw-warning">
                              These facts were retrieved during the run. They
                              are not explicitly bound to the qualitative
                              summary; review whether they support it.
                            </p>
                          )}
                          <p>{claimText}</p>
                          {finding &&
                            ['hypothesis', 'recommendation'].includes(
                              finding.kind ?? '',
                            ) && (
                              <div className="iw-warning">
                                This is an unverified {finding.kind}; no
                                financial citation makes it a proven business
                                cause.
                              </div>
                            )}
                          <div className="iw-facts">
                            {linked.map((f) => (
                              <Button
                                key={f.id}
                                onClick={() => {
                                  setFactId(f.id);
                                  setTab('calculation');
                                }}
                              >
                                <span>
                                  {metricLabel(f.metric)} · {f.period}
                                </span>
                                <Amount fact={f} />
                                <ChevronRight size={16} />
                              </Button>
                            ))}
                          </div>
                          {!linked.length && (
                            <p className="iw-muted">
                              No fact is directly bound to this claim. A
                              qualitative summary still requires semantic
                              review.
                            </p>
                          )}
                          <h3>Source snapshot</h3>
                          <p className="iw-muted">
                            {sourceData?.synthetic
                              ? 'Synthetic operating data.'
                              : 'Curated annual filing extract. Amounts in USD millions.'}{' '}
                            {sourceData?.preparation?.unit_note}
                          </p>
                          {sourceData?.preparation?.source_url && (
                            <a
                              className="iw-link"
                              target="_blank"
                              rel="noreferrer"
                              href={sourceData.preparation.source_url}
                            >
                              Open the original filing{' '}
                              <ArrowUpRight size={15} />
                            </a>
                          )}
                          <div className="iw-table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Period</th>
                                  <th>Revenue</th>
                                  <th>Cost of sales</th>
                                  <th>Operating expense</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sourceData?.rows.map((row) => (
                                  <tr key={row.row_id}>
                                    <td>{row.month}</td>
                                    <td>{row.revenue.toLocaleString()}</td>
                                    <td>{row.cogs.toLocaleString()}</td>
                                    <td>
                                      {row.operating_expenses.toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="iw-muted">
                            Absent periods remain unknown. Observed rows alone
                            do not establish a complete quarter.
                          </p>
                          <DataObject
                            label="Source identifier and preparation version"
                            value={{
                              dataset_hash: run.dataset_hash,
                              engine_hash: sourceData?.preparation?.engine_hash,
                              metric_version:
                                sourceData?.preparation?.metric_version,
                              accession: sourceData?.preparation?.accession,
                            }}
                          />
                        </div>
                      )}
                      {tab === 'calculation' && (
                        <div className="iw-stack">
                          <h2>Follow the calculation</h2>
                          <label htmlFor="iw-field-4">
                            Evidence fact
                            <NativeSelect
                              id="iw-field-4"
                              aria-label="Evidence fact"
                              value={fact?.id ?? ''}
                              onChange={(e) => setFactId(e.target.value)}
                            >
                              {facts.map((f) => (
                                <NativeSelectOption key={f.id} value={f.id}>
                                  {metricLabel(f.metric)} · {f.period} ·{' '}
                                  {displayFact(f)}
                                </NativeSelectOption>
                              ))}
                            </NativeSelect>
                          </label>
                          {fact ? (
                            <>
                              <p className="iw-muted">
                                {fact.unit === 'coverage'
                                  ? 'Coverage metadata assembled by the dataset-inspection tool.'
                                  : fact.unit === 'passage'
                                    ? 'Source passage retrieved from the curated filing extract.'
                                    : 'Precomputed in Python, then retrieved during this investigation.'}
                              </p>
                              <div className="iw-recipe">
                                <div>
                                  <span>1</span>
                                  <section>
                                    <h3>Select source periods</h3>
                                    <p>
                                      {fact.lineage?.expected_periods.join(
                                        ' · ',
                                      ) ?? fact.period}
                                    </p>
                                    <div className="iw-periods">
                                      {fact.lineage?.expected_periods.map(
                                        (p) => (
                                          <b
                                            className={
                                              fact.lineage?.missing_periods.includes(
                                                p,
                                              )
                                                ? 'missing'
                                                : ''
                                            }
                                            key={p}
                                          >
                                            {p}
                                            {fact.lineage?.missing_periods.includes(
                                              p,
                                            )
                                              ? ' · missing'
                                              : ''}
                                          </b>
                                        ),
                                      )}
                                    </div>
                                  </section>
                                </div>
                                <div>
                                  <span>2</span>
                                  <section>
                                    <h3>Inspect the operands</h3>
                                    {fact.lineage?.operands.map((o, i) => (
                                      <p key={i}>
                                        {o.label}:{' '}
                                        <strong>
                                          {o.value === null
                                            ? 'Unavailable'
                                            : o.value.toLocaleString()}{' '}
                                          {o.unit}
                                        </strong>
                                      </p>
                                    )) ?? (
                                      <p>
                                        Operand trace was not recorded in this
                                        historical run.
                                      </p>
                                    )}
                                  </section>
                                </div>
                                <div>
                                  <span>3</span>
                                  <section>
                                    <h3>Apply the rule</h3>
                                    <code>{fact.formula}</code>
                                    {fact.lineage?.missing_periods.length ? (
                                      <p className="iw-warning">
                                        Coverage failed. Stop before presenting
                                        a complete-period result.
                                      </p>
                                    ) : null}
                                  </section>
                                </div>
                                <div>
                                  <span>4</span>
                                  <section>
                                    <h3>Stored result</h3>
                                    <Amount fact={fact} />
                                    {fact.reason && (
                                      <p className="iw-muted">{fact.reason}</p>
                                    )}
                                  </section>
                                </div>
                              </div>
                              {fact.source_url && (
                                <a
                                  className="iw-link"
                                  href={fact.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Source disclosure <ArrowUpRight size={16} />
                                </a>
                              )}
                              <DataObject
                                value={fact}
                                label="Exact stored calculation fact"
                              />
                              <details className="iw-disclosure">
                                <summary>
                                  Inspect the versioned Python implementation
                                </summary>
                                <pre>
                                  {journal?.source.preparation?.engine_source ??
                                    'The historical run did not record the executing Python source. Its formula and evidence IDs are preserved.'}
                                </pre>
                              </details>
                              <details className="iw-disclosure">
                                <summary>
                                  Recompute this snapshot locally
                                </summary>
                                <p>
                                  Recomputation rebuilds facts; independent
                                  expected values test correctness. The hosted
                                  service retrieves saved Python results.
                                </p>
                                <pre>
                                  PYTHONPATH=python python3 -m
                                  financial_analyst.verify --dataset{' '}
                                  {run.dataset_id}
                                </pre>
                              </details>
                            </>
                          ) : (
                            <p>
                              No calculation facts were returned before this run
                              stopped.
                            </p>
                          )}
                        </div>
                      )}
                      {tab === 'model' && (
                        <div className="iw-stack">
                          <div>
                            <h2>What was sent, and what came back?</h2>
                            <p className="iw-muted">
                              Recorded API context and visible outputs.
                              Credentials and opaque continuation data are
                              omitted.
                            </p>
                          </div>
                          {!journal && (
                            <div className="iw-warning">
                              Original API request and response payloads were
                              not recorded. The saved tool trace and complete
                              final answer are available below.
                            </div>
                          )}
                          {events
                            .filter((e) => e.kind === 'model.requested')
                            .map((e, i) => {
                              const reply = events.find(
                                (x) =>
                                  x.call_id === e.call_id &&
                                  ['model.responded', 'model.failed'].includes(
                                    x.kind,
                                  ),
                              );
                              return (
                                <article className="iw-call" key={e.id}>
                                  <div className="iw-section-heading">
                                    <h3>Model call {i + 1}</h3>
                                    <span className="iw-kicker">
                                      {reply?.kind === 'model.failed'
                                        ? 'Failed'
                                        : reply
                                          ? 'Returned'
                                          : 'Awaiting response'}
                                    </span>
                                  </div>
                                  <div className="iw-two">
                                    <section>
                                      <h3>Input</h3>
                                      <ModelExchange
                                        payload={e.payload}
                                        direction="input"
                                      />
                                      <DataObject
                                        value={e.payload}
                                        label="Instructions, history, tools and evidence"
                                      />
                                    </section>
                                    <section>
                                      <h3>Output</h3>
                                      {reply && (
                                        <ModelExchange
                                          payload={reply.payload}
                                          direction="output"
                                        />
                                      )}
                                      {reply ? (
                                        <DataObject
                                          value={reply.payload}
                                          label="Visible model response and usage"
                                        />
                                      ) : (
                                        <p>Request saved before execution.</p>
                                      )}
                                    </section>
                                  </div>
                                </article>
                              );
                            })}
                          <details open className="iw-disclosure">
                            <summary>
                              Investigation timeline · {events.length} recorded
                              events
                            </summary>
                            {events.map((e) => (
                              <div className="iw-event" key={e.id}>
                                <span>{e.seq}</span>
                                <section>
                                  <strong>
                                    {e.kind.replaceAll('.', ' · ')}
                                  </strong>
                                  <small>
                                    {new Date(e.at).toLocaleTimeString()}
                                  </small>
                                  {!e.kind.startsWith('model.') && (
                                    <DataObject
                                      value={e.payload}
                                      label="Inspect event"
                                    />
                                  )}
                                </section>
                              </div>
                            ))}
                            {!events.length &&
                              run.trace.map((t) => (
                                <div className="iw-event" key={t.step}>
                                  <span>{t.step}</span>
                                  <section>
                                    <strong>
                                      {t.tool.replaceAll('_', ' ')}
                                    </strong>
                                    <DataObject
                                      value={{
                                        arguments: t.arguments,
                                        result: t.result,
                                      }}
                                      label="Saved tool input and output"
                                    />
                                  </section>
                                </div>
                              ))}
                          </details>
                          <DataObject
                            value={run.analysis}
                            label="Complete final answer, including caveats"
                          />
                          <p className="iw-muted">
                            Known usage:{' '}
                            {run.usage.input_tokens.toLocaleString()} input /{' '}
                            {run.usage.output_tokens.toLocaleString()} output
                            tokens.{' '}
                            {journal?.usage_complete
                              ? 'Usage recorded for every call.'
                              : 'Usage may be incomplete; missing calls are not treated as free.'}
                          </p>
                        </div>
                      )}
                      {tab === 'review' && (
                        <div className="iw-stack">
                          <h2>Explain the issue in plain language</h2>
                          <blockquote>{claimText}</blockquote>
                          <div className="iw-fields">
                            <label htmlFor="iw-field-5">
                              Review scope
                              <NativeSelect
                                id="iw-field-5"
                                aria-label="Review scope"
                                value={scope}
                                onChange={(e) =>
                                  setScope(e.target.value as typeof scope)
                                }
                              >
                                <NativeSelectOption value="claim">
                                  Selected claim only
                                </NativeSelectOption>
                                <NativeSelectOption value="run">
                                  Whole investigation
                                </NativeSelectOption>
                              </NativeSelect>
                            </label>
                            <label htmlFor="iw-field-6">
                              Verdict
                              <NativeSelect
                                id="iw-field-6"
                                aria-label="Verdict"
                                value={verdict}
                                onChange={(e) =>
                                  setVerdict(e.target.value as typeof verdict)
                                }
                              >
                                <NativeSelectOption value="fail">
                                  Needs correction
                                </NativeSelectOption>
                                <NativeSelectOption value="pass">
                                  Passes the review rubric
                                </NativeSelectOption>
                                <NativeSelectOption value="not_reviewed">
                                  Not yet reviewed
                                </NativeSelectOption>
                              </NativeSelect>
                            </label>
                          </div>
                          <details>
                            <summary>Review rubric</summary>
                            <p>
                              A whole investigation passes only if the requested
                              task is complete, numbers and periods are correct,
                              citations support the statements, and uncertainty
                              is handled. Checking one claim does not grade the
                              entire answer.
                            </p>
                          </details>
                          <label htmlFor="iw-field-7">
                            Issue category
                            <NativeSelect
                              id="iw-field-7"
                              aria-label="Issue category"
                              value={category}
                              onChange={(e) => setCategory(e.target.value)}
                            >
                              {[
                                'Compared incomplete periods',
                                'Wrong calculation or amount',
                                'Citation does not support claim',
                                'Business cause is not established',
                                'Accounting does not reconcile',
                                'Task was not completed',
                                'No issue found',
                              ].map((x) => (
                                <NativeSelectOption key={x}>
                                  {x}
                                </NativeSelectOption>
                              ))}
                            </NativeSelect>
                          </label>
                          <label htmlFor="iw-field-8">
                            What should the answer do?
                            <Textarea
                              id="iw-field-8"
                              value={expected}
                              onChange={(e) => setExpected(e.target.value)}
                              maxLength={3000}
                            />
                          </label>
                          <label htmlFor="iw-field-9">
                            Evidence and review notes
                            <Textarea
                              id="iw-field-9"
                              value={comment}
                              onChange={(e) => setComment(e.target.value)}
                              maxLength={3000}
                            />
                          </label>
                          <div className="iw-fields">
                            <label htmlFor="iw-field-10">
                              Reviewer name
                              <Input
                                id="iw-field-10"
                                value={reviewer}
                                onChange={(e) => setReviewer(e.target.value)}
                              />
                            </label>
                            <label htmlFor="iw-field-11">
                              Reviewer role
                              <NativeSelect
                                id="iw-field-11"
                                aria-label="Reviewer role"
                                value={role}
                                onChange={(e) =>
                                  setRole(e.target.value as typeof role)
                                }
                              >
                                <NativeSelectOption value="author">
                                  Project author
                                </NativeSelectOption>
                                <NativeSelectOption value="independent">
                                  Independent human reviewer
                                </NativeSelectOption>
                              </NativeSelect>
                            </label>
                          </div>
                          <label htmlFor="iw-field-12" className="iw-checkbox">
                            <Checkbox
                              id="iw-field-12"
                              checked={approved}
                              onCheckedChange={(v) => setApproved(v === true)}
                            />
                            I approve this expected outcome as a regression
                            test.
                          </label>
                          <Button className="iw-primary" onClick={saveReview}>
                            Save {supersedes ? 'replacement ' : ''}review
                          </Button>
                          {supersedes && (
                            <p className="iw-muted">
                              The previous review is preserved and marked
                              superseded.
                            </p>
                          )}
                          <div className="iw-divider" />
                          <h3>Try a change and compare</h3>
                          <p className="iw-muted">
                            The question, dataset and conversation stay pinned.
                            This creates a separate paid model attempt.
                          </p>
                          <label htmlFor="iw-field-13">
                            Reviewer instruction for the new attempt
                            <Textarea
                              id="iw-field-13"
                              value={instruction}
                              onChange={(e) => setInstruction(e.target.value)}
                              maxLength={1500}
                              placeholder="For example: check period coverage before making a growth comparison."
                            />
                          </label>
                          <p className="iw-muted">
                            Provider: {provider}. Metric:{' '}
                            {metricEnabled
                              ? 'core + reviewed cost ratio'
                              : 'core'}
                            . Up to ten model rounds and eight investigation
                            tools; a run may finish earlier.
                          </p>
                          <Button
                            disabled={busy || !canRun}
                            className="iw-primary"
                            onClick={() => analyze(run)}
                          >
                            Rerun this question
                          </Button>
                          {saved.filter((s) => s.id !== run.id).length > 0 && (
                            <label htmlFor="iw-field-14">
                              Compare a saved attempt
                              <NativeSelect
                                id="iw-field-14"
                                aria-label="Compare a saved attempt"
                                value={comparison?.id ?? ''}
                                onChange={async (e) => {
                                  if (!e.target.value) {
                                    setComparison(null);
                                    return;
                                  }
                                  try {
                                    const r = await json<{ run: Run }>(
                                      '/api/runs/' + e.target.value,
                                    );
                                    setComparison(r.run);
                                  } catch (e) {
                                    setError((e as Error).message);
                                  }
                                }}
                              >
                                <NativeSelectOption value="">
                                  Choose a saved investigation
                                </NativeSelectOption>
                                {saved
                                  .filter((s) => s.id !== run.id)
                                  .map((s) => (
                                    <NativeSelectOption key={s.id} value={s.id}>
                                      {s.question} · {s.state} ·{' '}
                                      {s.id.slice(0, 8)}
                                    </NativeSelectOption>
                                  ))}
                              </NativeSelect>
                            </label>
                          )}
                          {comparison && (
                            <>
                              <div
                                className={
                                  comparable(run, comparison)
                                    ? 'iw-success'
                                    : 'iw-warning'
                                }
                              >
                                {comparable(run, comparison)
                                  ? 'Same question, source snapshot and saved history.'
                                  : 'Different task, source or history. Treat this as a scenario comparison.'}
                              </div>
                              <div className="iw-two">
                                <section>
                                  <h3>Selected investigation</h3>
                                  <p>{run.analysis.summary}</p>
                                  <DataObject
                                    value={run.analysis}
                                    label="All original claims"
                                  />
                                </section>
                                <section>
                                  <h3>Comparison attempt</h3>
                                  <p>{comparison.analysis.summary}</p>
                                  <DataObject
                                    value={comparison.analysis}
                                    label="All comparison claims"
                                  />
                                </section>
                              </div>
                            </>
                          )}
                          <div className="iw-section-heading">
                            <h3>Review history</h3>
                            <a
                              className="iw-link"
                              href="/api/regression-cases"
                              download
                            >
                              Export approved regression cases
                            </a>
                          </div>
                          {reviews.map((r) => (
                            <article className="iw-review" key={r.id}>
                              <strong>
                                {r.reviewer} · {r.role} · {r.scope} ·{' '}
                                {r.verdict}
                              </strong>
                              <p>{r.comment || r.expected}</p>
                              <small>
                                {r.created_at}
                                {r.approved_test
                                  ? ' · Approved regression case'
                                  : ''}
                                {!actualReviews.some((x) => x.id === r.id)
                                  ? ' · Superseded'
                                  : ''}
                              </small>
                              {actualReviews.some((x) => x.id === r.id) &&
                                r.scope !== 'adjustment' && (
                                  <Button
                                    onClick={() => {
                                      setSupersedes(r.id);
                                      setScope(r.scope as typeof scope);
                                      setSelected(
                                        r.anchor === 'run'
                                          ? 'summary'
                                          : r.anchor,
                                      );
                                      setExpected(r.expected);
                                      setComment(r.comment);
                                      setReviewer(r.reviewer);
                                      setRole(r.role);
                                      setVerdict(r.verdict);
                                      setCategory(r.category);
                                      setApproved(r.approved_test);
                                    }}
                                  >
                                    Correct this review
                                  </Button>
                                )}
                            </article>
                          ))}
                          {!reviews.length && (
                            <p className="iw-muted">
                              No human reviews recorded.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {page === 'reports' && (
        <section className="iw-wide">
          <div className="iw-section-heading">
            <div>
              <span className="iw-kicker">Evaluation and iteration</span>
              <h1>Make each change reviewable.</h1>
              <p className="iw-muted">
                Reports use saved attempts and review records. Generating one
                makes no model calls.
              </p>
            </div>
            <Button
              onClick={() => {
                setReportSelection(saved.slice(0, 50).map((r) => r.id));
              }}
            >
              Select recent attempts
            </Button>
          </div>
          <div className="iw-two iw-report-layout">
            <div className="iw-panel iw-pad">
              <h2>Choose the evidence</h2>
              <label htmlFor="iw-field-15" className="iw-checkbox">
                <Checkbox
                  id="iw-field-15"
                  checked={reportSelection.includes(historicalId)}
                  onCheckedChange={(v) =>
                    setReportSelection((xs) =>
                      v === true
                        ? [...xs, historicalId]
                        : xs.filter((x) => x !== historicalId),
                    )
                  }
                />
                Historical missing-May answer
              </label>
              {saved.map((s) => (
                <label
                  htmlFor={`iw-report-${s.id}`}
                  className="iw-checkbox"
                  key={s.id}
                >
                  <Checkbox
                    id={`iw-report-${s.id}`}
                    checked={reportSelection.includes(s.id)}
                    onCheckedChange={(v) =>
                      setReportSelection((xs) =>
                        v === true
                          ? [...xs, s.id]
                          : xs.filter((x) => x !== s.id),
                      )
                    }
                  />
                  <span>
                    {s.question}
                    <small>
                      {s.example ? 'Recorded example · ' : ''}
                      {s.dataset_id} · {s.state} · {s.id.slice(0, 8)}
                    </small>
                  </span>
                </label>
              ))}
              <Button
                className="iw-primary"
                disabled={!reportSelection.length}
                onClick={() => generateReport()}
              >
                Generate iteration report
              </Button>
              <p className="iw-muted">
                Include both original and revised attempts to show their
                changes. Up to fifty records per report.
              </p>
            </div>
            <div className="iw-panel iw-pad">
              <h2>Original evaluation record</h2>
              <p className="iw-muted">
                Earlier prototype · Codex-assisted review
              </p>
              <table>
                <tbody>
                  <tr>
                    <td>Initial task attempts</td>
                    <td>12</td>
                  </tr>
                  <tr>
                    <td>Initial execution completions</td>
                    <td>10 / 12</td>
                  </tr>
                  <tr>
                    <td>Initial assisted-review passes</td>
                    <td>9 / 12</td>
                  </tr>
                  <tr>
                    <td>Total task attempts including reruns</td>
                    <td>14</td>
                  </tr>
                  <tr>
                    <td>Unique cases passing after reruns</td>
                    <td>11 / 12</td>
                  </tr>
                </tbody>
              </table>
              <p className="iw-warning">
                Independent human review remains pending. These counts do not
                describe the new implementation.
              </p>
              <a
                className="iw-link"
                href="/evaluation-report.md"
                target="_blank"
              >
                Read the original evaluation record <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
          {artifact && (
            <div className="iw-panel iw-pad iw-stack">
              <div className="iw-section-heading">
                <h2>
                  {artifact.kind === 'memo'
                    ? 'Financial investigation memo'
                    : 'Iteration report'}
                </h2>
                <div className="iw-actions">
                  {['md', 'html', 'json'].map((format) => (
                    <a
                      className="iw-button"
                      key={format}
                      href={`/api/reports?id=${artifact.id}&format=${format}`}
                    >
                      Download {format.toUpperCase()}
                    </a>
                  ))}
                </div>
              </div>
              {artifact.kind === 'iteration' ? (
                <>
                  <div className="iw-score-grid">
                    {[
                      ['Task attempts', artifact.report.counts.attempts],
                      ['Completed', artifact.report.counts.completed],
                      ['Human passes', artifact.report.counts.reviewed_passes],
                      ['Pending review', artifact.report.counts.pending_review],
                    ].map(([label, n]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{n}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="iw-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Investigation</th>
                          <th>Execution</th>
                          <th>Whole-run review</th>
                          <th>Independent review</th>
                        </tr>
                      </thead>
                      <tbody>
                        {artifact.report.rows.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <Button
                                className="iw-text-button"
                                onClick={() =>
                                  openRun(r.id).catch((e) =>
                                    setError(e.message),
                                  )
                                }
                              >
                                {r.question}
                              </Button>
                            </td>
                            <td>{r.state}</td>
                            <td>{r.review}</td>
                            <td>{r.independent_review}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h3>Paired attempts</h3>
                  {artifact.report.pairs.map((p) => (
                    <article className="iw-review" key={p.new_id}>
                      <p>
                        {p.comparable
                          ? 'Same task and source snapshot'
                          : 'Not comparable / original omitted'}{' '}
                        · {p.original_review} → {p.new_review}
                      </p>
                      <DataObject value={p.changed} label="What changed" />
                    </article>
                  ))}
                  {!artifact.report.pairs.length && (
                    <p className="iw-muted">No paired attempts selected.</p>
                  )}
                  <p>
                    Known tokens:{' '}
                    {artifact.report.counts.known_input_tokens.toLocaleString()}{' '}
                    input /{' '}
                    {artifact.report.counts.known_output_tokens.toLocaleString()}{' '}
                    output.{' '}
                    {artifact.report.counts.usage_complete
                      ? 'Complete recorded usage.'
                      : 'Some usage is unknown.'}
                  </p>
                  {artifact.report.notes.map((n) => (
                    <p className="iw-muted" key={n}>
                      {n}
                    </p>
                  ))}
                </>
              ) : (
                <pre className="iw-memo">{artifact.markdown}</pre>
              )}
              <DataObject
                value={{
                  manifest: artifact.report.manifest,
                  content_hash: artifact.content_hash,
                }}
                label="Frozen report manifest"
              />
            </div>
          )}
          <div className="iw-panel iw-pad">
            <h2>Saved reports</h2>
            {reportHistory.map((r) => (
              <Button
                className="iw-saved"
                key={r.id}
                onClick={() =>
                  json<Artifact>('/api/reports?id=' + r.id)
                    .then(setArtifact)
                    .catch((e) => setError(e.message))
                }
              >
                {r.kind} · {new Date(r.created_at).toLocaleString()}
              </Button>
            ))}
            {!reportHistory.length && (
              <p className="iw-muted">
                Generate a report to preserve its selected runs and reviews.
              </p>
            )}
          </div>
        </section>
      )}
      {page === 'metric' && (
        <section className="iw-wide iw-stack">
          <div>
            <span className="iw-kicker">Reviewed metric pilot</span>
            <h1>A definition you can inspect.</h1>
            <p className="iw-muted">
              The first custom metric uses a registered formula. The analyst
              chooses when it helps answer your question.
            </p>
          </div>
          <div className="iw-two">
            <div className="iw-panel iw-pad iw-stack">
              <h2>{definition.name}</h2>
              <p>{definition.meaning}</p>
              <div className="iw-recipe">
                <div>
                  <span>1</span>
                  <section>
                    <h3>Collect the selected period</h3>
                    <p>Revenue, cost of sales and operating expenses</p>
                  </section>
                </div>
                <div>
                  <span>2</span>
                  <section>
                    <h3>Add costs and divide by revenue</h3>
                    <code>{definition.formula}</code>
                  </section>
                </div>
                <div>
                  <span>3</span>
                  <section>
                    <h3>Apply the missing-data and denominator rules</h3>
                    <p>
                      {definition.missing_policy}{' '}
                      {definition.denominator_policy}
                    </p>
                  </section>
                </div>
              </div>
              <p>
                Example: revenue 100, cost of sales 40, operating expenses 20 →{' '}
                <strong>60%</strong>.
              </p>
              <p className="iw-muted">{definition.rounding}</p>
              <label htmlFor="iw-field-17" className="iw-checkbox">
                <Checkbox
                  id="iw-field-17"
                  checked={metricEnabled}
                  onCheckedChange={(v) => setMetricEnabled(v === true)}
                />
                I reviewed this definition. Enable it for my next investigation.
              </label>
              <Button
                className="iw-primary"
                disabled={!metricEnabled}
                onClick={() => {
                  setQuestion(
                    'Use the reviewed cost-to-revenue ratio to investigate how cost efficiency changed from Q1 to Q2. Check period coverage first.',
                  );
                  setPage('inspect');
                }}
              >
                Investigate with this metric
              </Button>
            </div>
            <div className="iw-panel iw-pad iw-stack">
              <FlaskConical size={24} />
              <h2>One definition, two views</h2>
              <p>
                The visual recipe and Python evaluator use the same registered
                expression. The saved investigation records the metric version
                and whether you enabled it.
              </p>
              <DataObject
                value={definition.expression}
                label="Inspect the expression tree"
              />
              <p className="iw-muted">
                This pilot supports one reviewed metric. General
                natural-language formula authoring and execution of generated
                Python are not enabled.
              </p>
            </div>
          </div>
        </section>
      )}
      {page === 'apple' && (
        <section className="iw-wide iw-stack">
          <div>
            <span className="iw-kicker">
              Public-company pilot · Apple FY2025 10-K
            </span>
            <h1>Connect earnings, cash and evidence.</h1>
            <p className="iw-muted">
              Two annual fiscal periods. Curated filing extract in USD millions;
              independent source review pending.
            </p>
          </div>
          <div className="iw-two">
            <div className="iw-panel iw-pad iw-stack">
              <h2>Start a bounded investigation</h2>
              <p>
                Reconcile net income to operating cash flow, compare annual
                metrics, and inspect management’s explanation for iPhone sales.
              </p>
              {[
                'Reconcile FY2025 net income to cash from operations. Explain the signed adjustments and any remaining residual.',
                'Compare FY2024 and FY2025 earnings, operating cash flow and cash flow after PP&E purchases. What does the filing establish about iPhone sales growth?',
              ].map((q) => (
                <Button
                  key={q}
                  className="iw-saved"
                  onClick={() => {
                    setDatasetId('apple-fy2025');
                    setQuestion(q);
                    setPage('inspect');
                  }}
                >
                  {q}
                  <ChevronRight size={16} />
                </Button>
              ))}
              <a
                className="iw-link"
                href="https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm"
                target="_blank"
                rel="noreferrer"
              >
                Open the pinned filing <ArrowUpRight size={16} />
              </a>
              <p className="iw-muted">
                Fiscal year ends: September 27, 2025 and September 28, 2024. A
                balanced bridge explains accounting movement; it does not
                establish a business cause.
              </p>
            </div>
            <div className="iw-panel iw-pad iw-stack">
              <h2>Keep three explanations distinct</h2>
              <div>
                <h3>Reported accounting</h3>
                <p>
                  Net income plus signed noncash and working-capital adjustments
                  reconciles to operating cash flow.
                </p>
              </div>
              <div>
                <h3>Management attribution</h3>
                <p>
                  A retrieved passage describes management’s explanation. The
                  attribution remains attached to its source.
                </p>
              </div>
              <div>
                <h3>Analyst hypothesis</h3>
                <p>
                  Potential recurring or unusual items require additional
                  evidence. Public filings do not resolve transaction-level QoE
                  questions.
                </p>
              </div>
            </div>
          </div>
          {run?.dataset_id === 'apple-fy2025' ? (
            <div className="iw-panel iw-pad iw-stack">
              <h2>Adjustment ledger for the selected investigation</h2>
              <p>{run.question}</p>
              <p className="iw-warning">
                Entries are analyst judgments. They do not change the reported
                baseline or automatically become supported findings.
              </p>
              <div className="iw-fields">
                <label htmlFor="iw-field-18">
                  Amount · USD millions
                  <Input
                    id="iw-field-18"
                    type="number"
                    min="0"
                    step="any"
                    value={adjustment.amount}
                    onChange={(e) =>
                      setAdjustment((a) => ({ ...a, amount: e.target.value }))
                    }
                  />
                </label>
                <label htmlFor="iw-field-19">
                  Effect on earnings
                  <NativeSelect
                    id="iw-field-19"
                    aria-label="Effect on earnings"
                    value={adjustment.sign}
                    onChange={(e) =>
                      setAdjustment((a) => ({ ...a, sign: e.target.value }))
                    }
                  >
                    <NativeSelectOption value="-1">Subtract</NativeSelectOption>
                    <NativeSelectOption value="1">Add back</NativeSelectOption>
                  </NativeSelect>
                </label>
              </div>
              {(
                ['source', 'rationale', 'recurrence', 'tax_treatment'] as const
              ).map((k) => (
                <label htmlFor={`iw-adjustment-${k}`} key={k}>
                  {metricLabel(k)}
                  <Textarea
                    id={`iw-adjustment-${k}`}
                    value={adjustment[k]}
                    onChange={(e) =>
                      setAdjustment((a) => ({ ...a, [k]: e.target.value }))
                    }
                  />
                </label>
              ))}
              <div className="iw-fields">
                <label htmlFor="iw-field-21">
                  Reviewer
                  <Input
                    id="iw-field-21"
                    value={reviewer}
                    onChange={(e) => setReviewer(e.target.value)}
                  />
                </label>
                <label htmlFor="iw-field-22">
                  Decision
                  <NativeSelect
                    id="iw-field-22"
                    aria-label="Decision"
                    value={adjustment.status}
                    onChange={(e) =>
                      setAdjustment((a) => ({ ...a, status: e.target.value }))
                    }
                  >
                    <NativeSelectOption value="proposed">
                      Proposed
                    </NativeSelectOption>
                    <NativeSelectOption value="approved">
                      Approved by named reviewer
                    </NativeSelectOption>
                    <NativeSelectOption value="rejected">
                      Rejected by named reviewer
                    </NativeSelectOption>
                  </NativeSelect>
                </label>
              </div>
              <Button
                className="iw-primary"
                disabled={!adjustment.amount}
                onClick={saveAdjustment}
              >
                Save adjustment entry
              </Button>
              {reviews
                .filter((r) => r.adjustment)
                .map((r) => (
                  <div className="iw-review" key={r.id}>
                    <strong>
                      {r.adjustment!.status} ·{' '}
                      {r.adjustment!.sign * r.adjustment!.amount} USD millions
                    </strong>
                    <p>{r.adjustment!.rationale}</p>
                    <span>
                      {r.reviewer} · {r.created_at}
                    </span>
                  </div>
                ))}
              <Button onClick={() => generateReport('memo')}>
                Generate financial memo with adjustment ledger
              </Button>
            </div>
          ) : (
            <p className="iw-muted">
              Run or reopen an Apple investigation to attach proposed accounting
              adjustments to its evidence.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
