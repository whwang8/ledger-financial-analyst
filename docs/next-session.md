# Tomorrow's build plan

The prototype now has a working OpenAI integration, six synthetic datasets, Python-calculated evidence, a conversational investigation UI, exported traces, and 12 evaluated tasks. See `evaluation-report.md` for the retained failure and transport reruns. Anthropic is implemented and mock-tested, but not live-tested.

1. Start `./scripts/dev.sh` and try the current OpenAI chat. Ask why Meridian Works profit changed, follow up on monthly costs, and inspect the calculation citations.
2. Human-review the saved check answers using `evals/cases.json` and each result folder's blank review template. Keep human verdicts separate from existing Codex-assisted reviews.
3. Fix the misleading-premise failure: bind quantitative claims to available values and matching periods. Separate general investigation advice from evidence-backed numeric findings. Keep the original failures.
4. Add newly authored challenge cases before measuring the changes; the original check set has now been inspected. Freeze source/configuration and avoid development reloads during evaluation.
5. Compare agent-selected tools against a fixed metric-pack summary baseline, using the same questions and rubric. Record latency, tokens, and failures, including failed attempts.
6. Test the visible browser interactions, responsive layout, and keyboard flow. Record a two-minute walkthrough with a successful investigation and a missing-data case.
7. Create the intended GitHub repository and publish the source, then connect the project card on your portfolio to the repository, walkthrough, and evaluation report. This project has not been pushed to github.com/whwang8.

The existing `.env.local` contains the user-configured OpenAI key and is ignored by Git. Hosted credentials are separate server secrets. Keep the prototype owner-private until durable access and spending controls are ready.
