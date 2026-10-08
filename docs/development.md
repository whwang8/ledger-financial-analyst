# Development and evaluation

See the [project README](../README.md) for an overview and quick start. Run commands below from the repository root.

## Local development and production builds

Requirements are Node.js 22.13+ (Node 24 works), npm, and Python 3.10+. No third-party Python package installation is required.

```sh
npm ci
npm run data:build
npm run dev
```

The development server runs on Node; open the Local URL it prints. On the original development Mac, `./scripts/dev.sh` also locates Codex's bundled Node if the shell's Node is too old.

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

`npm test` runs the Python goldens and mocked agent/report tests. `npm run build` targets a Cloudflare Worker; it does not create a standalone Node production server. `npm start` uses Wrangler with the generated Worker configuration. Hosted storage bindings, authentication, and secrets are separate from local `.env.local` configuration.

## Financial rules

- Gross profit = revenue − COGS; operating profit = revenue − COGS − operating expenses.
- Period margins use aggregate profits divided by aggregate revenue.
- Margin changes use percentage points; percentage growth requires a positive baseline.
- Incomplete periods produce unavailable full-period values. Missing records are not treated as zero.
- Profit bridges reconcile account changes; they do not establish supplier, customer, hiring, or pricing causes.
- Money is validated to cents and calculated using `Decimal`. Ratios are serialized to six decimal places and formatted separately.

The six synthetic companies have committed source records and deterministic generator parameters. Companies 01–03 were development data; 04–06 were originally reserved check data. Their evaluation tasks have since been inspected and reused as regressions, so they are no longer untouched holdouts. Scenario labels and evaluation oracles are excluded from the model context.

After changing data or supported formulas, run `npm run data:build` and the relevant tests. Save a catalog consistency record with:

```sh
PYTHONPATH=python python3 -m financial_analyst.verify --dataset company-06
PYTHONPATH=python python3 -m financial_analyst.verify --dataset apple-fy2025
```

Agreement with the generated catalog does not independently validate a filing's source mapping.

## Run live evaluations

Configure a provider in `.env.local`, enable live inference, restart the server, and use a separate terminal. These commands make paid provider calls. The runner defaults to `http://127.0.0.1:3000`; supply `--url` with the server's actual URL if it uses another port.

```sh
# Small pilot; retained separately.
python3 evals/run.py --provider openai --run-live --limit 2

# All twelve current regression tasks; this starts a new evaluation.
python3 evals/run.py --provider openai --run-live

# An explicit isolated rerun, preserving the original attempt.
python3 evals/run.py --provider openai --run-live \
  --case-id company-05-1 --no-public-summary
```

Use `--cases-file PATH` for approved cases exported from the review screen. `--resume RESULTS_DIRECTORY` runs only unstarted tasks and requires the same serving implementation. Inspect unknown outcomes before creating another explicit attempt; the runner does not silently retry started tasks.

Every attempted task is retained under `results/<timestamp>/`, including errors, run identifiers, available traces, model identity, dataset/configuration hashes, latency, usage, and a blank human-review template. The default run also updates `public/evaluation-summary.json`; use `--no-public-summary` to retain an isolated experiment without replacing that summary. A source hash describes recorded application code, not a Git commit or an independent quality guarantee.

## Grade answers separately from execution

Expected-fact coverage establishes whether particular evidence was retrieved. Valid reference IDs and successful execution do not establish semantic correctness. Review the whole answer, including the summary, against the rubric: numeric accuracy, periods/units, support for claims, uncertainty, and task completion.

Keep original attempts, later retries, and changed configurations separate. Leave unreviewed outcomes unreviewed; label Codex-assisted review distinctly from human review. A claim review must not automatically grade the entire answer. Reports describe selected saved runs, not an unobserved evaluation history.

For saved outcomes, use [Investigation v2 validation](investigation-v2-validation.md). [The original study](evaluation-report.md) and [original validation record](validation.md) describe earlier versions and remain historical evidence.

## Runtime and storage boundaries

Investigations have a maximum of eight executed calculation tools, ten model rounds, a 90-second deadline, and bounded per-call output. The token ceiling is checked after responses, so costs may accrue before a run fails. The six-per-minute in-memory request limiter is per Worker instance; it is not a global quota.

Local investigations, reviews, and reports persist in `.ledger-data/`, which is ignored by Git. Hosted records use D1 and R2 with owner scoping. Export JSON for a portable record. The original conversation view resets its active conversation when changing companies.

OpenAI uses stateless Responses continuation with prior output, including encrypted reasoning items needed for continuation. Anthropic groups tool results immediately after each assistant tool-use message. Inspectable recordings exclude credentials, private reasoning, and opaque continuation bytes. Older recordings explicitly label unavailable fields.
