# Investigation workspace — implementation and validation

Date: September 21, 2026. Review role: Codex-assisted engineering and semantic review; independent human review is pending.

## What is implemented

- Durable versioned investigations and append-only events; exact visible provider request/response payloads, tool arguments/results, rejected submissions, partial failures, interrupted outcomes, source snapshots and configuration hashes. Credentials and opaque/private continuation bytes are redacted. Historical gaps stay labeled as not recorded.
- A claim-led visual inspector: source rows and units, calculation recipe and operands, missing-period checks, exact Python source, readable model exchanges and optional raw payloads. The recorded examples require no inference to replay.
- Persisted claim/run reviews, self-declared reviewer roles, preserved corrections, approved expected-outcome regression cases, whole-question reruns and aligned comparisons. A claim review never silently grades the whole answer; failed runs cannot count as passing tasks.
- Deterministic iteration reports and financial memos with JSON/Markdown/HTML downloads and frozen input manifests. Known/unknown usage, selected-attempt completion, pending review, retries and disagreements remain separate. Reports are selected-subset reports, not claims about an entire hidden evaluation history.
- One constrained, reviewed Python cost-to-revenue expression. A curated Apple FY2024/FY2025 extract with annual metrics, signed CFO reconciliation, source-attributed management evidence and a separate proposed-adjustment ledger. The baseline is never overwritten.
- Local file persistence; hosted D1 record index plus R2 payloads; authenticated owner scoping, same-origin mutation checks and generated schema migrations.

## Software and browser evidence

- 19 Python tests pass: independent literal arithmetic/reconciliation goldens, missing coverage, denominator rules, expression restrictions and provenance.
- 33 agent/report tests pass: mocked OpenAI/Anthropic continuation, invalid submissions, interrupted-run reconstruction, redaction, incomplete usage, typed references, pending reviews, retries and report counts. These are software checks, not model-quality measurements.
- TypeScript and first-party lint pass. The production Worker build and migration staging pass.
- Playwright/Chrome local workflow checks pass: historical replay with logging gaps, missing-May calculation inspection, actual model I/O, persistent review after reload, report generation, metric opt-in, Apple navigation, and widths 1024/780/390/320 without horizontal overflow. No browser page errors. Automated smoke reviews are explicitly `not_reviewed`, never human passes.
- Local production Worker/D1/R2 checks pass: create/reopen a keyless calculation preview, save review, generate report, and deny a different authenticated owner with 404. This is local production-runtime evidence, not an authenticated hosted end-to-end test.
- Python recomputation consistency records are retained in `results/verification/`, including Apple record `a6c7fd16-3ba9-43aa-871b-3d363309b2bc.json`. Matching the current catalog is distinct from independently verifying a filing mapping.
- Runtime dependency audit reports zero advisories. Four moderate development-only transitive esbuild advisories remain in the full dependency audit; no blanket zero-vulnerability claim is made.
- Authenticated hosted persistence/model interaction, live Anthropic behavior, independent human filing review and WebMCP runtime registration remain unverified.

## Live OpenAI regression results

The first instrumented regression set is `results/20260921T151838.093339Z`: 12 previously inspected tasks across synthetic companies 04–06. The actual per-run requests, prompts, tool schema, data and engine hashes are retained. This run occurred during implementation; it is not a frozen final-release benchmark. Older configuration records may lack the subsequently added application source hash.

| Measure | Result |
|---|---:|
| Original attempts | 12 |
| Completed answers | 11 |
| Codex-assisted strict full-rubric passes | 9 |
| Completed answers with citation-scope defects | 2 |
| Execution/output-validation failures | 1 |
| Independently human-reviewed answers | 0 |

The completed answers had substantively correct financial values and conclusions. In `company-04-4` and `company-05-4`, a claim about missing customer/supplier/operational evidence cited only facts establishing complete dates. The context contained the absence information, but those particular citations did not support the full sentence. Added a distinct dataset evidence-scope fact and instructed the model to cite it separately from period coverage.

`company-06-4` failed twice at final submission: the model cited Q1 profit without retrieving it. Both rejected submissions remain visible. Validation now identifies unreturned evidence explicitly and tells the model to retrieve it or remove the claim.

Three isolated reruns are retained separately:

| Case | Folder | Assisted review |
|---|---|---|
| company-06-4 | `20260921T152426.518592Z` | Pass; one rejected submission repaired. Rejects unsupported full-quarter growth and cites missing May. Could explain two observed months versus three more directly. |
| company-04-4 | `20260921T152741.517803Z` | Pass; one rejected submission repaired. Operational-data absence now binds the evidence-scope fact. |
| company-05-4 | `20260921T152741.517803Z` | Pass; one disabled-custom-metric tool request recovered. Cites both dates and evidence scope; supplier-price causation stays unproven. |

Across 15 attempts, every unique regression case has at least one passing answer. This combines configurations and targeted retries; it is **not a 12/12 run of the final implementation**, a new holdout benchmark, or independent human grading. Original attempt counts and failures are unchanged.

For `company-05-2`, automatic expected-evidence coverage is false because the runner expects bridge IDs; the answer correctly uses the corresponding account-change facts and explicitly subtracts costs. Retrieval coverage is not answer correctness. Do not tune the evidence checker into a semantic quality score.

Three additional live smoke investigations (missing coverage, registered ratio, Apple CFO) and a paired historical missing-May rerun are saved in `results/investigation-v2-smoke/`. These demonstrate execution, not a separately graded benchmark. The built-in workspace examples copy one successful local synthetic recording and the original instrumented failure. They are labeled recordings; no hosted live inference is implied.

## Boundaries and next steps

The UI is a bounded implementation of the plan, not all of its future extensions. Arbitrary uploads, arbitrary Python, natural-language metric authoring, exact continuation from an intermediate model step, generic SEC ingestion, multi-agent QoE analysis, automated judge calibration, LLM-written engineering report narratives and PDF layout remain deferred. Hosted calculations use the Python-generated catalog; the verification action is an explicit local Python command, not simulated server execution.

Quantitative values are bound to returned facts, and unsupported references/types are rejected. Qualitative semantic entailment and causal claims still require review; a lexical number guard is not a proof of correctness. Reviewer roles are self-declared in this private prototype. Token/round limits and per-instance throttling are not globally durable dollar caps.

Next: William reviews the saved missing-May example, one causal-evidence case and the Apple filing mapping; then freeze a configuration and collect a fresh paired evaluation against the fixed-pack baseline, with repetitions and independently reviewed outcomes. Use the preserved originals to show the debugging process in the portfolio.
