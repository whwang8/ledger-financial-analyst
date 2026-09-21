# Ledger portfolio documentation plan

Prepared September 21, 2026. This is a proposed work plan; experiments, fixes, human reviews, and browser checks below have not been completed by writing this document.

**Latest direction (September 21):** build the visual investigation and debugging workflow in section 8 before the larger baseline experiment. New features and acceptance criteria remain proposed until implementation and measurement.

## Purpose and audience

Create a portfolio case study for AI engineering recruiters and technical reviewers. Lead with an engineering question:

> Can a tool-using LLM investigate financial changes accurately, explain what its evidence supports, and justify the extra complexity compared with a fixed financial summary?

Suggested title: **Ledger: Building and evaluating an evidence-linked financial analyst**.

The case study should make four responsibilities clear: the LLM chooses its investigation and explanation; Python calculates financial evidence; application validation checks specific output constraints; a reviewer assesses whether the explanation follows from the evidence. Avoid implying that references automatically verify prose.

## 1. Establish the evidence record

Start from `docs/evaluation-report.md`, `docs/validation.md`, saved runs in `results/`, and the source implementation. Maintain a small claims ledger: claim, supporting artifact, reviewer, scope, and limitations.

The current report supports these statements:

- The first 12 attempts returned 10 answers: 9 passed Codex-assisted semantic review, 1 failed, and 2 were interrupted by development-server reloads.
- Separate reruns of those two transport failures passed. Thus 11 of 12 unique tasks have passing answers in that assisted review, after 14 attempts.
- Independent human review is pending. These counts are not a production accuracy estimate.
- Thirty-four arithmetic and mocked agent/HTTP tests passed at the recorded source state; these are software checks, not a model-quality score.
- Real OpenAI calls were exercised locally. The Anthropic adapter has mocked protocol tests, not a live-provider validation record.
- Python precomputes the finite financial fact catalog. The model selects tools that retrieve those facts; the hosted application does not run a Python interpreter for each question.
- A private deployment exists. Authenticated hosted behavior and browser interactions still need verification before they are described as tested. A private URL alone will not give portfolio visitors access; provide a recording until public access is deliberately prepared.

Retain the original failures and reruns. The existing inspected check set becomes a regression set for future development; stop describing it as an untouched holdout.

**Deliverable:** an evidence inventory and accurate opening status paragraph. A preliminary case study can be drafted now, with later findings explicitly pending.

## 2. Human-grade the existing answers

William reviews all 12 returned check answers, the original execution failures, and the development conversation follow-up. Read each complete response, including summaries and limitations, against the source rows and task rubric. Keep these verdicts separate from the saved Codex-assisted reviews.

| Dimension | Passing criterion |
|---|---|
| Task completion | Answers the actual question, or explains why available data cannot support the requested answer |
| Financial correctness | Values, signs, units, dates, denominators, and period coverage are correct |
| Claim and citation support | Evidence supports each material factual assertion; a real citation ID alone is insufficient |
| Uncertainty | Missing information and unproven business causes are handled explicitly without invented conclusions |

Define a full task pass before grading: all applicable dimensions pass, with no material unsupported assertion. Mark criteria not applicable where appropriate; do not penalize a correct unavailable-data response for lacking a numeric answer. Keep execution failure separate from semantic failure, while including it in overall attempted-task success.

William's review is **author human review**, not independent review. If another person is available, ask them to grade a method-blinded subset covering successes and all failure families. Preserve the initial disagreements and the adjudicated decisions. An LLM judge may assist triage but cannot replace the human-review label.

**Deliverable:** completed review records, reviewer identity/role, dated rubric, and corrected outcome table. If human verdicts differ from the assisted review, report the difference.

## 3. Fix and explain the observed failure modes

Use two compact before/change/after examples as the case study's main engineering evidence.

**A. Invalid growth comparison.** The original answer conditionally endorsed 11.11% growth while citing a null quarter-comparison fact. It did not adequately distinguish two observed Q2 months from three Q1 months.

Proposed change: represent quantitative findings with explicit fact references, value status, units, periods, and coverage. Validate these fields against the Python catalog. A null fact can support an unavailable-data statement, but cannot support a numeric growth endorsement. Prefer rendering financial values from validated fields so the model cannot freely substitute a number in the main quantitative finding. Review summaries too, since unconstrained summary prose can reintroduce the error.

**B. Misplaced advice citations.** The conversation follow-up attached numeric COGS citations to coverage statements and procurement advice.

Proposed change: separate financial findings, dataset-coverage statements, hypotheses, and recommended next steps. Give coverage claims appropriate metadata evidence. Label advice as proposed action; do not attach unrelated financial citations merely to satisfy a required citation field.

Preserve original and revised responses, source versions, prompts, test inputs, validator outcomes, and remaining limitations. Add regression checks for null-valued evidence, mismatched units/periods, and advice placed in the wrong field. Repeatedly answering the original failure correctly is useful regression evidence, not proof of general improvement.

**Deliverable:** a failure analysis with two inspectable examples. Typed fields improve enforceable constraints; they do not prove arbitrary prose is true.

## 4. Freeze a fresh comparison protocol

Author a small new set of roughly 12 questions across 4–6 new synthetic datasets. Vary the underlying patterns, not just company names or numerical scale. Cover direct metrics, changed profit drivers, non-monotonic monthly changes, contribution ties, differently missing months, weighted margins, nonpositive growth baselines, misleading premises, and unsupported business causes. Stay within the application's declared tool and date scope.

Write independent, hand-worked expected results and semantic rubrics. Verify the fixtures with software checks without using model answers as the oracle. Use separate development examples to debug the protocol. Freeze task IDs, data hashes, source commit, prompt versions, model configuration, retry rules, output limits, grading rubric, and primary measures before the comparison runs. Do not edit the serving application mid-run.

Compare two systems:

| System | Evidence access | Shared requirements |
|---|---|---|
| Ledger agent | Chooses tools, metrics, and periods over multiple model calls | Same model, question, Python facts, answer contract, validation rules, rubric, and compatible model settings |
| Fixed metric-pack summarizer | Receives a predetermined evidence pack in one model context | Same factual scope and sufficient evidence for every declared task family |

Define the baseline pack once, independent of each question: coverage, monthly and quarterly values, quarter bridge, and the adjacent/corresponding-month comparisons needed for the task scope. Include units and evidence IDs; exclude scenario labels and answer keys. Verify required facts are present before running. Do not intentionally starve the baseline of monthly information.

The baseline does not choose investigative tools. Both systems should use the same final response structure and applicable validation/repair policy. Report their actual token use; do not force equal context size when the evidence-delivery strategy is what is being compared. Grade answer quality without rewarding a particular tool path. Inspect tool efficiency separately.

For a manageable first comparison, use **12 questions × 2 systems × 3 repetitions = 72 task attempts**. A task attempt may contain multiple provider requests. This is still a small exploratory study. A lower-cost option is 24 initial attempts plus two further repetitions on six difficult cases selected in advance, for 48 attempts total; stability conclusions then apply only to that subset.

Interleave the systems' requests to reduce order effects, use fresh conversation state for independent tasks, and keep any conversation tests explicitly paired with matching history. Preserve every attempt. Define transport retries in advance and report original-attempt success separately from eventual completion. After inspecting fresh-set failures, treat that version as consumed and retain it for regression rather than silently tuning against an alleged holdout.

**Implementation needed first:** the current runner only supports the original 12 cases, one method, and one run per case. Add task-file selection, method and repetition identifiers, versioned run manifests, safe resume, fixed retry accounting, and separate immutable results before launching this protocol.

## 5. Measure quality, stability, and cost

Predefine the primary outcome as the proportion of attempted tasks passing the full rubric. Also report answer correctness among completed responses and execution success, so transport errors remain visible.

| Measure | Reporting approach |
|---|---|
| Quality | Counts with denominators, by method and task family; paired wins/ties/losses |
| Claim support | Material unsupported claims and misleading-citation failures, including summary statements |
| Stability | Per-case passes out of three runs; distinguish always passes, mixed outcomes, and always fails |
| Latency | End-to-end median and range, with failed/time-limited attempts identified |
| Usage | All provider calls, input/output tokens, cached-token details where available, and tool counts |
| Estimated cost | Dated provider rates, disclosed calculation, cost per attempted answer and per passing answer |
| Reliability | Errors, timeouts, rejected outputs, repairs, retries, and unavailable usage records |

Grade all 72 answers with randomized method labels where practical. Reveal tool traces separately for process analysis. Repeated runs of the same question are not independent new cases; do not inflate the sample size or make broad significance claims. If one method ties or loses, that is still an informative engineering result.

Add per-provider-call usage and failure records: the current success-only aggregate can lose billing information when a later step fails. Missing usage is unknown, not zero. Record output/cache categories needed for the chosen provider's dated pricing and distinguish estimated charges from reconciled billing. Exclude development runs from benchmark totals, but report their exclusion explicitly. Set a run budget after a small development smoke run measures typical usage.

**Deliverable:** a reproducible comparison report and a small results table or chart. A before/after replay on known failures supports regression claims; a fresh agent-versus-baseline comparison tests the value of tool selection. Neither alone establishes that every system change caused a general improvement. A frozen original-agent arm is an optional later experiment if that causal comparison matters.

## 6. Verify the experience and capture a demonstration

Run browser checks for a successful investigation, follow-up context, incomplete data, evidence inspection, trace download, company switching/reset, provider failure, keyboard operation, and narrow-screen layout. Verify a real authenticated hosted session separately from local endpoint tests. Record source version, environment, observed result, and unresolved defects.

Capture a two-minute walkthrough and a few readable screenshots: a question leading to tool selection, a finding linked to its calculation, and a missing-data limitation. Show the tool log as tool activity, not private model reasoning. Keep browser correctness checks, software tests, model evaluation, and polished demo assets distinct in the documentation.

**Deliverable:** a concise browser validation record, demonstration video, and captioned evidence images. Live Anthropic testing is optional unless the write-up claims verified operation or quality parity across providers.

## 7. Produce the documentation package

Keep the main page readable in about five minutes and let technical readers follow links to detail.

| Artifact | Intended content |
|---|---|
| Portfolio project card, 60–100 words | Problem, distinctive LLM behavior, status, and links |
| Main case study, approximately 1,200–1,600 words | Problem, design, LLM decisions, failures, changes, measured outcomes, tradeoffs, and next work |
| Architecture note | Diagram, data flow, tool and claim contracts, Python/LLM boundary, precomputation tradeoff, and failure handling |
| Evaluation protocol | Dataset design, split history, baseline, scoring, repetitions, retry policy, and cost accounting |
| Evaluation report | Actual outcomes with denominators, examples, reviewer roles, limitations, and links to raw artifacts |
| Reproduction guide | Versioned setup, data generation, tests, evaluation commands, environment requirements, and expected outputs |
| Failure/change log | Original issue, hypothesis, implementation change, regression evidence, and remaining uncertainty |
| Demo assets | Captioned screenshots, two-minute recording, and an accessible way for visitors to understand the project |

Use this main-page sequence: project overview; user problem; why investigation needs an LLM; architecture; one end-to-end example; failure and correction; evaluation and baseline results; tradeoffs; next steps. Explain which decisions William made and how AI coding assistance contributed, accurately reflecting the work.

The central narrative is an investigation, not a catalog of technologies: a useful analysis appeared correct, a concrete evaluation exposed a claim-support failure, the output contract changed, and a fresh comparison tested what improved and what still failed.

Suggested completion statement only after measurements exist: “On [number] newly authored questions, under [review method], Ledger passed [count/attempts] versus [baseline count/attempts], with [latency and estimated cost]. Repeated runs showed [stability result].” Never fill these placeholders with desired outcomes.

## Sequence and publication criteria

Work in four bounded blocks: (1) evidence inventory, author review, and draft outline; (2) failure fixes and separate development checks; (3) frozen baseline experiment and grading; (4) browser verification, demo recording, and final writing. These blocks may span several sessions; human grading is likely a substantial part of the work.

A preliminary prototype write-up can be published with the present limitations. The stronger evaluated case study should have: an accurate architecture explanation, author-reviewed results, one retained failure-to-fix example, a fair baseline, repeated-run evidence with explicit scope, a demonstrated browser flow, and reproducible artifacts. Independent review improves confidence but can remain a disclosed limitation. Anthropic, live financial feeds, uploads, additional agents, and more elaborate infrastructure are not prerequisites for this first write-up.

Before publication, check every headline against the claims ledger. Use “evaluated prototype,” avoid “production-ready,” do not imply hallucination elimination, and keep cost/performance claims tied to a specific configuration and small test set. Link the GitHub repository once it is actually published; provide the recording for visitors who cannot enter the private demo.

## 8. Next product phase: visual investigation, debugging, and evaluation

**Design update — September 21, 2026. Status: proposed, not implemented.** This phase makes Ledger understandable and debuggable by a nontechnical reviewer while preserving a path to custom metrics and quality-of-earnings investigations. It takes priority over launching the larger comparison in section 4: record the evidence and make it reviewable before scaling experiments. The original results and limitations above remain unchanged.

The core user question is: **“Where did this claim come from, what did the model actually receive, and what should change?”** Keep the LLM responsible for choosing an investigation, selecting financial tools, retrieving business evidence, testing explanations, and proposing a memo. The debugger reveals those observable actions and their consequences. It does not present a post-hoc explanation as private model reasoning.

### 8.1 Four connected views, with progressive detail

Use a saved-run header containing company, actual period dates, dataset version, model/configuration, execution state, and review state. Keep the selected answer sentence visible while its evidence is inspected. A person should not have to read JSON or write Python to identify a problem.

| View | Default nontechnical presentation | Expandable technical detail |
|---|---|---|
| Investigation | Answer claims beside a chronological list of model requests, tool results, checks, and failures; each claim opens its evidence | Event IDs, dependencies, tool arguments and raw artifacts |
| Data & calculations | Included/excluded source rows, before/after tables, coverage gaps, formula with actual operands, and reconciliation waterfall/residual | Exact versioned Python function, input/output schema, code hash, rounding rules and deterministic verification record |
| Model calls | Paired “What was sent” and “What came back,” organized by instructions, question/history, evidence, available tools and requested action | Sanitized request/response bodies, provider/call IDs, model settings, per-call usage, timing, truncation, errors and retries |
| Review & compare | Flag a claim, state the problem in ordinary language, propose an expected result, compare a new attempt, and read the iteration report | Rubric, reviewer identity/role, test case, configuration diff, grade history and report manifest |

Use text states such as “Calculation passed,” “Source coverage incomplete,” “Explanation needs review,” and “Model call failed.” Do not collapse all checks into a single green “Verified” badge. Missing information, failed execution, rejected output, and correct refusal to calculate are different states.

For accessibility, keep selection usable by keyboard, provide a linear alternative to any graph, pair color with text, and stack panels on smaller screens. The graph is an optional way to navigate the same recorded steps; start with a guided chronological view so users are not required to understand a dependency graph.

### 8.2 Make Python calculations visible without misrepresenting execution

There are two connected histories:

1. **Dataset preparation:** original rows → validation and normalization → selected periods → aggregation → financial calculation → stored facts.
2. **This investigation:** model request → requested tool → returned facts → next model input → proposed answer → checks and review.

Today, Python computes the catalog before the question is asked. Show **“Precomputed by Python; retrieved in this analysis.”** A retrieval duration is not Python execution time. Existing formula text can explain a calculation, but a reconstructed explanation is not an execution trace. Historical runs without captured transformation events must say “Preparation steps not recorded; explanation derived from the saved data.” Never invent missing historical payloads or timings.

Introduce a small registered transformation vocabulary: select/filter rows, map accounts, normalize units/signs, group/aggregate, derive a metric, compare periods, and reconcile a bridge. Each actual operation emits inputs, outputs, selected/excluded row IDs, reason for exclusion, units, dates, coverage, implementation reference, and checks. Generate the visual recipe from those records, not from an LLM's description of what probably happened.

A calculation card should expose, in order:

- The business definition, such as operating profit, and the exact selected period.
- Source values and rows, including visible missing-month slots. Distinguish unknown from zero.
- The arithmetic with substituted operands, plus numerator/denominator and percentage versus percentage-point labels.
- The output or the precise reason no result is available.
- Reconciliation: expected total, summed contributions, signed residual and documented tolerance. Use exact Decimal arithmetic internally and an explicit rounding/display policy; real filings may require a tolerance tied to disclosed precision.
- “Show Python” with the exact function and version that produced the result. This is a read-only technical view by default.

### 8.3 Record model exchanges before building the call inspector

The current `Run` is created only after success. Its tool trace does not preserve provider request/response boundaries; errors can discard earlier trace and usage. Add a run ID and durable `run.started` record before the first provider call. Append call-start, response/error, tool-start/result, validation, and terminal events as they happen. A browser disconnect or later model failure must leave the preceding evidence inspectable.

Record the complete authorized application-visible context for each call: system instructions, question, the actual selected conversation history, tool definitions, facts/passages supplied, visible output, tool calls and corresponding tool results. Link “Model requested” → “Tool returned” → “Evidence sent in the next call” using call IDs. This shows whether evidence was available to the model; it does not prove the model used it correctly. The official function-calling flow supports these explicit request/tool/result boundaries. [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)

Keep a readable display and an expandable sanitized payload. Record provider response ID, model identifier and settings, prompt/tool schema versions, timestamps, client-observed latency, input/output/cache token categories when available, finish reason, and failure category. Unknown usage remains unknown. Record rejected `submit_analysis` attempts and repairs, not just the accepted final answer.

Exclude authentication headers, API keys and unrelated private data from logging. Keep sensitive authorized payloads behind the same owner access as the run; make redactions explicit in exports. Opaque continuation data is an adapter concern and must not be shown as a reasoning explanation. The API does not expose raw private reasoning; any available summary or model-written justification should be explicitly labeled as generated explanation. [OpenAI reasoning documentation](https://developers.openai.com/api/docs/guides/reasoning)

Use a versioned JSON/JSONL contract behind a storage interface first. Local development can use project-local artifacts. The hosted Worker needs durable storage for run metadata/events and large payloads; its filesystem or in-memory map cannot be the persistence layer. A small metadata store plus object storage is sufficient; a new agent framework or external observability platform is not a prerequisite. Persist events first, then add polling or streaming to show their progress; reconnect using the last event sequence rather than restarting paid work. An abandoned call without a completion event is visibly incomplete, not silently successful.

### 8.4 Minimal records that connect the screens

| Record | Required information |
|---|---|
| Run manifest | Run/conversation/case IDs; parent run; dataset hash; code commit; metric/prompt/tool versions; model/provider/settings; limits; method/repetition/attempt; timestamps and terminal state |
| Event | Stable ID and sequence; parent call/event; operation; start/end/status; input/output artifact references; error category; known usage |
| Source and calculation | Original artifact/hash and source location; actual dates/units; transformations and dependencies; operand facts; value or unavailable reason; implementation reference; checks |
| Claim | Stable ID; kind; text; bound financial values/units/periods; supporting fact or passage IDs; applicability and review state |
| Review | Claim/event/run anchor; reviewer identity and role; rubric version; verdict or not-reviewed/not-applicable; evidence and comment; superseded review if corrected |
| Evaluation/report manifest | Frozen task/configuration list; split history; repetitions/retries; grading scope; source run/review IDs; generator version and output artifact hashes |

Include material claims in the summary, not only numbered findings. Distinguish financial findings, coverage statements, source-attributed business explanations, hypotheses, advice, and proposed accounting adjustments. A hypothesis or advice item must not acquire a “supported” label merely because a financial citation ID exists.

### 8.5 A concrete first debugging story

Use the retained `company-06-4` failure as the first end-to-end case. The original answer conditionally endorsed 11.11% growth although the returned quarterly growth fact was null.

The reviewer selects the claim and sees Q1's January–March coverage next to Q2's April and June with May visibly absent. Source-derived operating profit totals are $72,000 for the complete Q1 and $80,000 for the two observed Q2 months; the latter must not be displayed as a complete-quarter result. The user supplied both amounts in the historical question. The calculation tool returned unavailable quarter comparisons and did not establish that the supplied figures represented comparable quarters. The UI must distinguish source inspection now, user-supplied assertions, and tool evidence actually returned in that run. Preserve the complete original answer, including its explicit warning about incomplete Q2, so reviewers can assess both the caveat and the conditional endorsement.

The calculation inspector shows why the coverage check prevented a complete-quarter metric. The model inspector shows the requested comparison, the null result, and the saved output. Missing historical request bodies are labeled “Not recorded.” The reviewer flags “Compared incomplete periods,” adds an expected outcome, and saves a regression case.

The proposed fix binds quantitative claims to available facts and matching periods. A null quarterly-growth fact cannot render a numeric growth assertion; the intended answer explains the coverage mismatch and requests May. This is an acceptance target, not an already observed fixed answer. Summary claims receive the same checks. Separately, the procurement-advice failure is addressed by giving coverage statements metadata evidence and placing recommendations in proposed next steps.

Provide three distinct operations:

- **Replay saved run:** display recorded evidence; no model requests and no new charges.
- **Verify calculation:** rerun the deterministic calculation against the pinned source and implementation, saving a separate verification record. Until a Python execution service is available, make this a local verification action rather than simulating execution in the hosted UI.
- **Try a change and rerun:** create a new run and show the changed prompt, metric definition, source scenario or model before execution. Display the scope and usage limit. Preserve the original. Editing a source value creates a new scenario hash and labels hypothetical inputs; it does not overwrite reported data.

For initial comparisons, rerun the entire question under the new configuration and compare aligned claims/facts. Exact continuation from an arbitrary model step is a later capability with stricter state requirements, not an MVP promise. A new LLM run may choose a different valid tool sequence or answer even with unchanged settings.

### 8.6 Evaluation and automatic reports are part of the workflow

Every flagged problem should become a candidate test containing its source snapshot, question/history, expected behavior, error category and linked original run. A reviewer approves the expected result before the case enters a regression suite; the same model must not invent its own gold answer and mark itself correct.

Separate three layers: deterministic checks (data, arithmetic, units/periods, coverage, reconciliation, typed claims and citation existence); model-assisted semantic review (possible unsupported explanations, misleading summaries and citation entailment); and human review. Keep William's author review distinct from independent review. Calibrate model judges against human labels, retain disagreements, and version their prompts/rubrics. [OpenAI evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices)

Generate two outputs from the same evidence:

1. **Financial investigation memo:** question/scope; reported facts and reconciliations; attributed business explanations; hypotheses; proposed adjustments; unresolved requests; provenance appendix. Proposed adjustments and unreviewed claims remain labeled.
2. **Engineering iteration report:** what changed; frozen configuration/task manifest; initial-attempt success, execution completion, graded-answer results and ungraded count; eventual unique-case results after retries; paired improvements/regressions; failure families; known/missing usage; dated cost assumptions; and linked original/revised examples.

Compute report tables and counts deterministically from the run/review records. An LLM may draft the explanatory narrative from those tables and examples, with claim links, but cannot revise counts or quietly mark pending reviews as passed. Report-generation prompts, visible outputs and failures are themselves logged. A replayed report from saved records requires no new analysis calls; optional narrative regeneration is a separate model call. Produce JSON plus readable Markdown/HTML first; add a print/PDF layout later.

Keep historical denominators explicit: 9/12 passing initial attempts in assisted review, 10/12 executed successfully, and 11/12 unique tasks with passing answers after two transport reruns (14 attempts total). A report must reproduce those values without relabeling them independent human accuracy. For new studies, compare paired cases and report repetitions as stability evidence, not independent new datasets. The fair fixed-pack baseline and frozen comparison in sections 4–5 remain the next measurement step once the recorder and review UI work.

### 8.7 Extend to custom metrics and public-company investigations

Start custom metrics with a reviewed **metric definition**: name, business meaning, input accounts, exact formula, unit, period rules, denominator/null policy, rounding, provenance requirements and example expected output. Let a user describe the metric in ordinary language; the LLM proposes a structured definition and a visual recipe. The user reviews its meaning. A constrained expression builder or registered Python functions execute it after validation. The visual recipe and Python implementation must derive from the same definition, avoiding a diagram that disagrees with the code. Arbitrary model-authored Python execution is a later, separately sandboxed capability.

Keep one orchestrator initially. It can select metric/period tools, retrieval, reconciliation, and evidence checks. Specialized ingestion, accounting, business-evidence or QoE agents can be introduced later as named roles in the same event record when evaluation establishes that they improve results. More agents are not themselves an evaluation objective.

For the first public-data pilot, pin **Apple's FY2025 10-K, accession 0000320193-25-000079**, rather than using a moving latest-company-data response. Start with annual comparisons, then add fiscal quarters and a second issuer. The filing offers income/cash-flow statements, accounting adjustments and narrative disclosures useful for a bounded investigation; Apple uses fiscal reporting periods, including a 53-week FY2023. Preserve exact dates rather than substituting calendar quarters. [Apple filing](https://investor.apple.com/sec-filings/sec-filings-details/default.aspx?FilingId=18880179) · [SEC filing text](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm)

Ingest original filings plus SEC facts server-side, preserve snapshots/hashes and selection decisions, and store taxonomy/concept, units/scale, actual start/end, accession/form/filing date and source location. Company Facts does not supply all company-specific or dimensional disclosures; quarterly flow values may be cumulative, while balance-sheet values are point-in-time. Preserve alternative observations and an explicit as-filed/as-of policy; do not assume every amendment restates every financial fact. Cache retrievals, identify the client, and respect SEC access limits. [SEC APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) · [SEC access guidance](https://www.sec.gov/about/webmaster-frequently-asked-questions)

The first suggested investigations are gross/operating margin, revenue growth, net-income-to-operating-cash-flow reconciliation, CFO/net-income with denominator caveats, and CFO less cash purchases of property/plant/equipment with its exact definition. These are candidate project metrics, not investment recommendations or conclusions about Apple.

Business explanations need a second evidence path: retrieved filing passage → its dates/context → supported statement → linked financial metric. Show “Management attributes the change to…” when that is what the source establishes. Keep a price/volume/mix hypothesis distinct from a measured decomposition. Present conflicting passages or unexplained residuals rather than forcing a complete causal narrative.

For QoE, preserve the reported baseline and a separate adjustment ledger: candidate amount, sign/tax treatment where relevant, source, justification, recurrence evidence, uncertainty, reviewer decision and effect on the reconciliation. An approved adjustment is analyst judgment, not a newly reported fact. Avoid automatic “one-time” addbacks from vague narrative. Public filings often cannot resolve transaction-level cutoff, customer collections or deal-specific normalized working capital; the application should request the missing records. SEC guidance on recurring expenses, consistency and labeling informs this design without implying that Ledger itself is a registrant. [SEC non-GAAP guidance](https://www.sec.gov/rules-regulations/staff-guidance/corporation-finance-interpretations/non-gaap-financial-measures)

### 8.8 Build sequence and evidence required to finish each milestone

| Milestone | Bounded implementation | Acceptance evidence |
|---|---|---|
| 1. Preserve the investigation | Run/event contracts, append-only capture, per-call artifacts, failed-run persistence, preparation provenance; reuse current provider adapters | Inject a failure after a successful tool round and reopen all preceding events; original errors and unknown usage remain visible; credentials absent from exports |
| 2. Visual debugging slice | Claim selection, actual source rows, formula/coverage inspector, model input/output cards, guided replay | A nontechnical reviewer identifies the missing month and the unsupported growth claim without opening JSON; historical logging gaps remain explicit |
| 3. Review and claim controls | Typed financial/coverage/business claims, summary checks, reviewer annotations, candidate regression cases | Null growth cannot appear as an endorsed numeric claim; advice has no unrelated financial citation; annotations survive reopening |
| 4. Iteration and reports | One-factor rerun, aligned comparison, deterministic report tables, optional logged narrative, resumable evaluation runner | Original run is unchanged; replay sends no provider request; known historical counts reproduce; failures, retries and pending reviews appear in exports |
| 5. Custom metric pilot | One new registered metric, visual definition review, Python computation/verification and unit/coverage checks | Source-to-formula-to-answer trace remains complete; independent goldens cover valid, missing and undefined inputs |
| 6. Public-filings pilot | Frozen Apple annual filing, period/concept mapping, retrieval passages, one earnings/cash-flow investigation and proposed adjustment ledger | Human checks mapped facts against the filing; reconciliation residuals and unsupported business causes are exposed; a second issuer is deferred until this passes |

**First deliverable to implement:** one durable, replayable investigation with a source/calculation inspector and recorded model exchanges. Use a newly instrumented synthetic run plus the retained historical missing-May failure. Do not start with an unrestricted upload pipeline, a generic Python IDE, or a large collection of agents. The narrow slice should prove that a person can find and explain one real failure, then reproduce an improved attempt.

### 8.9 Update the documentation after each meaningful change

For every milestone or experiment, append a short record: date; question/hypothesis; what changed; code/prompt/metric/data versions; linked original/new runs; checks actually performed; reviewer role; measured result; remaining uncertainty; and the next decision. Keep status explicit: proposed, implemented, software-tested, browser-observed, model-evaluated, author-reviewed, or independently reviewed. Never turn a planned acceptance target or an interface mockup into evidence of success.

Update the source plan in `financial-analyst-agent/docs/portfolio-documentation-plan.md` and its portfolio download copy, `portfolio-website/dist/documents/ledger-documentation-plan.md`, together. Maintain the claims ledger from section 1. Add an evidence caption to each future screenshot or recording naming its dataset, run, environment, and whether it shows replay or a fresh execution. Preserve original failures when a report is revised.

| Date | Work completed | Evidence/status | Next decision |
|---|---|---|---|
| 2026-09-21 | Inspected current trace, calculation and evaluation contracts; specified the visual debugger, review/report workflow, custom metric path and Apple pilot; prepared a design preview | Planning and source review only. No application behavior change, new benchmark result, human grade, or Apple analysis is claimed | Implement milestone 1 plus the narrow review screen in milestone 2 |


## 9. Implementation journal — investigation workspace

### 2026-09-21 — implementation in progress

- Added versioned run/event recording before provider calls, recorded request/response payloads, retained rejected submissions and partial failures, and explicitly incomplete usage. Opaque continuation bytes and credentials are omitted from saved views.
- Added durable local file storage for development and D1/R2-backed records for the private hosted application, with server-side identity scoping and an initial schema migration. Hosted persistence is not yet deployment-verified at this checkpoint.
- Added investigation source/calculation/model/review screens, saved reviews and candidate tests, paired reruns, deterministic iteration reports and financial memo exports.
- Added typed financial/coverage/attributed/hypothesis/recommendation findings. Financial values are rendered from returned facts. Semantic correctness still requires review.
- Added one reviewed cost-to-revenue metric and a curated Apple FY2025/FY2024 filing extract with signed cash-flow reconciliation. This is a bounded annual pilot, not a general SEC ingestion or arbitrary-code system.
- Checkpoint evidence: 19 Python checks and 28 mocked-agent/report checks pass; TypeScript checking passes. Local route and historical replay API return successfully. Browser interactions, live model evaluation and deployment remain in progress.


### 2026-09-21 — implemented workspace and observed evaluation

**Implemented:** durable investigation recording; visual source/calculation/model inspectors; typed claims and evidence-linked values; saved reviews and approved regression cases; separate reruns and comparisons; deterministic iteration reports and financial memo exports; one registered metric; curated Apple annual reconciliation and proposed-adjustment ledger. The local UI and production-runtime storage paths were exercised. A saved local OpenAI recording and retained failure are available for replay in the workspace.

**Software/browser evidence:** 19 Python and 33 mocked-agent/report tests pass (52 total), plus TypeScript, first-party lint, production Worker build, local D1/R2 persistence/access-isolation checks and browser review/report flows at desktop/mobile widths. Hosted authenticated interactions and independent human filing review are still pending. Full evidence and limitations: `docs/investigation-v2-validation.md`.

**Observed debugging story:** The original instrumented regression set completed 11/12 attempts, with 9/12 strict Codex-assisted passes, two citation-scope defects and one output-validation failure. The citation defects attached date coverage to statements about missing operational evidence; a dedicated dataset evidence-scope fact and prompt guidance corrected this on isolated reruns. The failed missing-May case cited an unreturned Q1 fact; actionable repair feedback produced a completed isolated rerun. Preserve both original rejected submissions and successful repairs.

**Experiments:** Original folder `results/20260921T151838.093339Z`; missing-May rerun `results/20260921T152426.518592Z`; two citation reruns `results/20260921T152741.517803Z`. All three isolated reruns pass assisted review. Across these 15 attempts every unique task has a passing answer, combining configurations and targeted retries. This is not a 12/12 latest-release benchmark, fresh holdout, repeated-run reliability result or independent human review. Smoke examples and paired historical replay are separately retained under `results/investigation-v2-smoke/`.

**Versions:** Recorded model requests, instruction/tool hashes, dataset/engine hashes and per-run events identify what actually ran; later runs also include the application source hash. Initial implementation-time regression records are not retroactively assigned the final release hash. Reports retain source run/review IDs and immutable content hashes. New semantic grades are explicitly Codex-assisted artifacts, not fabricated human review records.

**Remaining scope:** Natural-language metric authoring, arbitrary source editing/uploads, intermediate-step continuation, generic SEC ingestion, multiple QoE agents, model-judge calibration, optional LLM engineering narrative and PDF output are deferred. The implemented recipe is a constrained registered metric. Apple uses a curated two-year extract and one attributed passage; it is not a transaction-level QoE conclusion. Hosted inference remains bounded but lacks a globally durable spend quota.

**Next decision:** Have William perform and document the first author reviews of missing-May, causal-evidence and Apple examples, then freeze the next study and compare against the fixed-pack baseline. Label screenshots with run, dataset, local/hosted environment and replay/fresh-call status. Retain the original study in section 8 as historical context; do not substitute new denominators for its results.
