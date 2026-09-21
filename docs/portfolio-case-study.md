# Ledger: an evidence-linked financial analyst

**Current stage:** prototype with real OpenAI investigations. See the evaluation report for actual run counts and review status; do not infer production reliability or hallucination reduction from the small synthetic suite.

**Problem.** A financial summary should explain what changed and let the reader inspect the numbers supporting the explanation. Plausible prose alone does not establish that an analysis is correct.

**Approach.** A tool-using LLM chooses metrics and comparison periods, investigates a financial change, and answers follow-up questions. Python calculates the financial evidence using Decimal. A versioned fact catalog makes each selected result traceable to source records and formulas.

**Demonstration.** Select a synthetic company with shrinking profit, ask why profit changed while revenue grew, inspect the bridge, then ask for a monthly investigation of the largest cost contribution. Open the evidence references. Switch to a dataset with a missing month and ask for the same comparison. The analyst should explain the missing evidence rather than invent a full-quarter answer.

**Evaluation design.** Twelve reserved tasks across three check datasets, paired with three development datasets. Independent arithmetic goldens and mocked protocol tests check the software. The initial suite returned 10 answers from 12 attempts: 9 passed Codex-assisted review, 1 failed, and 2 requests were interrupted by server reloads. Separate transport reruns passed, bringing the result to 11 passing unique tasks out of 12. Independent human review remains pending. The retained failure endorses a misleading growth figure for an incomplete quarter; valid evidence IDs did not prevent unsupported prose. See `evaluation-report.md` for denominators and limitations.

**Engineering tradeoff.** Precomputing financial facts in Python allows a small hosted web runtime and auditable calculations. It restricts the prototype to known datasets and periods. A subsequent version could put the same Python engine behind a live service for validated uploads.

**Portfolio page outline.** Use a short introduction, project cards, and contact/GitHub links. This project's card should link its repository, a two-minute recording of a real run, and the evaluation report. Add a live demo link once deployed. Show the current status directly, and label any deterministic preview as such.

**Next improvements.** Address the incomplete-quarter premise failure and citation entailment, human-grade the saved answers, then compare adaptive investigation against a fixed metric-pack summarizer on new tasks.
