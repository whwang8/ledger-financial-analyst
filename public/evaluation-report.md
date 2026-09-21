# First live evaluation — September 20, 2026

Ledger completed real OpenAI investigations across all three reserved check datasets. **The first 12 attempts produced 10 answers: 9 passed Codex-assisted semantic review, 1 failed, and 2 requests were interrupted by local server reloads.** Separate reruns of the two transport failures both passed. After those reruns, 11 of the 12 unique tasks have passing answers in this assisted review; 14 requests were attempted. This is not independent human grading or a production accuracy estimate.

## Protocol and artifacts

- Provider: OpenAI Responses; model: `gpt-5.6-luna`; stateless continuation and native function calls.
- Six authored synthetic datasets: three for development, three for the 12 reserved check tasks. Check scenario families resemble development data.
- Twelve tasks cover direct metrics, profit reconciliation, monthly investigation, unsupported causal explanations, and incomplete periods. Literal oracles and rubrics live in `evals/cases.json`.
- Prompt, tool schemas, model identity, source hashes, dataset hashes, tool traces, token usage, and individual outputs are preserved. Human review is still `null`.
- Initial suite: `results/20260921T000301Z/`. Two isolated reruns: `results/20260921T000726Z/`. Folder timestamps are UTC (September 21); local date was September 20.
- The first suite overlapped formatting/configuration edits that restarted the development server twice. Those two interrupted requests are retained as execution failures, not model answers. Source hashes differ for tool-file formatting; saved prompt/tool-schema protocols are identical. Do not describe this as an uninterrupted frozen build benchmark.
- No prompt or tool behavior was changed after seeing the reserved-set semantic failure. This set is now inspected and must not be called an untouched holdout in future iterations.

## Outcomes

| Task family | Initial answers passing assisted review / attempted | After separate transport reruns |
|---|---:|---:|
| Q2 numeric metrics / incomplete Q2 | 1 / 3 | 3 / 3 |
| Quarterly profit bridge | 3 / 3 | 3 / 3 |
| Monthly investigation / coverage | 3 / 3 | 3 / 3 |
| Causation / misleading premise | 2 / 3 | 2 / 3 |
| **Total** | **9 / 12** | **11 / 12 unique tasks** |

Both transport reruns returned correct answers. All seven returned answers with nonempty automatic fact-coverage oracles collected the expected facts. Five tasks have no such oracle and require semantic review. Fact coverage and valid reference IDs are not answer accuracy.

Across the 12 returned answers (initial suite plus transport reruns), median agent latency was **7.92 seconds** (range **4.54–16.19 seconds**). Reported usage totaled **60,744 input tokens and 7,845 output tokens**. These figures exclude development pilots, the conversation follow-up, and any provider work completed during interrupted requests. They are not complete billing totals; dollar cost was not calculated.

## The material failure

`company-06-4` asks whether profit improved 11.11%, using $80,000 of observed Q2 profit and $72,000 of Q1 profit. May is absent, so the first figure covers April and June while the second covers three months. Full-quarter growth is unavailable.

The answer opened with a conditional endorsement, repeated 11.11%, and attached a citation whose value was `null`. It warned about missing data but did not adequately correct the false premise. This fails task completion, period-valid numeric interpretation, and claim support. The reference validator correctly recognizes the evidence ID as real; it does not verify whether prose follows from that evidence.

This is the next engineering priority: stronger premise checking and a claim-level representation that binds each quantitative statement to non-null values, periods, units, and source coverage. Test the change against a newly authored missing-period challenge set and retain this original failure as a regression example. Do not claim hallucination prevention.

## Development findings

A first development pilot correctly reconciled the quarterly decline but incorrectly named the largest month-to-month cost increase. The Python catalog already contained change facts; the monthly tool was expanded to return the relevant changes, and the prompt was clarified. A second saved pilot correctly identified March-to-April's $15,000 increase. Both pilots and reviews are retained.

A real follow-up with conversation history correctly rejected proof of supplier-price increases and retrieved fresh monthly evidence. However, it attached numeric COGS citations to dataset-coverage statements and general advice. This is another citation-entailment limitation, separately documented in `results/development-followup/review.json` and excluded from the 12-task metric.

One check answer initially submitted invalid citation IDs; the validator rejected them, the model retrieved fresh facts, and the answer recovered. Another monthly investigation retrieved all financial metrics, so its trace demonstrates multistep investigation but not especially selective tool arguments.

## Limits and next iteration

This small, single-run suite has shared scenario families, no baseline comparison, no repeated-run stability estimate, no independent human review, and no live Anthropic test. Two development interruptions required separate reruns. Browser UI testing was not performed. Arithmetic/protocol tests are separate from model evaluation.

Next: human-grade the saved answers, address null-evidence endorsements and misplaced advice citations, author fresh checks, and compare the agent with a fixed metric-pack summarizer using the same rubric and cost measurements. A convincing portfolio should show this failure-and-improvement loop as well as the working demo.
