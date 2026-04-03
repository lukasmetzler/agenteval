#!/usr/bin/env bash
# Build agenteval with embedded version string.
# Usage: ./scripts/build.sh [bun build args...]
# Example: ./scripts/build.sh --target=bun-linux-x64 --outfile=agenteval-linux-x64

set -euo pipefail

VERSION=$(cat VERSION)
VERSION_FILE="src/version.ts"

# Inject version into source (macOS sed needs -i '' while GNU sed needs -i)
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/__AGENTEVAL_VERSION__/$VERSION/" "$VERSION_FILE"
else
  sed -i "s/__AGENTEVAL_VERSION__/$VERSION/" "$VERSION_FILE"
fi

# Build (pass all args through)
if [ $# -eq 0 ]; then
  bun build src/cli.ts --compile --outfile=agenteval
else
  bun build src/cli.ts --compile "$@"
fi

# Restore placeholder
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/$VERSION/__AGENTEVAL_VERSION__/" "$VERSION_FILE"
else
  sed -i "s/$VERSION/__AGENTEVAL_VERSION__/" "$VERSION_FILE"
fi

echo "Built agenteval $VERSION"
