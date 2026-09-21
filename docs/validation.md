# Validation record

Validated on September 20, 2026 (America/New_York).

- Python: 15 independent arithmetic, data-validation, and generator tests passed.
- Agent/HTTP: 19 tests passed, including both provider continuation formats, citation validation, bounded loops, request-size limits, rate-limit retention, and monthly change evidence.
- TypeScript compilation and first-party lint passed. Generated `components/ui` and its generated mobile hook are excluded from first-party lint; they were retained unchanged.
- The production Worker build passed. Dependency upgrades resolved the generated scaffold's reported advisories; the final installation audit reported zero vulnerabilities.
- Local HTTP requests successfully rendered `/`, fetched provider status, and returned a deterministic evidence trace. Live OpenAI testing is recorded in `results/`.
- The first development pilot had a wrong monthly-change superlative. Its original output and review are retained. Monthly tool results were expanded with existing Python-calculated change facts; the second pilot identified the correct March-to-April increase.
- Broader browser UI testing was not requested and was not performed. Two WebMCP tools are feature-detected and registered when supported; no supported WebMCP validation context was used, so runtime registration is not claimed as verified.

The patched Cloudflare Vite development bridge failed to connect to its local Worker socket on this host. Local development uses Vinext's Node runtime; production still builds as a Cloudflare Worker. The same financial tool catalog and agent code run in both. Server configuration uses `process.env`, supported by the Worker's `nodejs_compat` mode and current compatibility date.

Model-quality findings belong in the evaluation report; software tests and valid citation IDs are not measures of LLM accuracy. Any Codex-assisted semantic review is labeled separately from human review.
