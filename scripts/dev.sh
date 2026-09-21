#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if ! node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)' 2>/dev/null; then
  ledger_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
  if [ -x "$ledger_node/node" ]; then export PATH="$ledger_node:$PATH"; else printf 'Node.js 22.13+ is required.\n'; exit 1; fi
fi
exec npm run dev
