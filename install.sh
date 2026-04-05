#!/usr/bin/env bash
# agenteval installer
# Usage: curl -fsSL https://raw.githubusercontent.com/lukasmetzler/agenteval/main/install.sh | bash

set -euo pipefail

REPO="lukasmetzler/agenteval"
INSTALL_DIR="${AGENTEVAL_INSTALL_DIR:-$HOME/.local/bin}"

# Detect platform
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$OS" in
  linux)  PLATFORM="linux" ;;
  darwin) PLATFORM="darwin" ;;
  *)      echo "Unsupported OS: $OS" >&2; exit 1 ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)             echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

# Only valid combinations
BINARY="agenteval-${PLATFORM}-${ARCH}"

if [[ "$PLATFORM" == "linux" && "$ARCH" != "x64" ]]; then
  echo "Only linux-x64 binaries are available. Got: $PLATFORM-$ARCH" >&2
  exit 1
fi
if [[ "$PLATFORM" == "darwin" && "$ARCH" != "arm64" && "$ARCH" != "x64" ]]; then
  echo "Only darwin-arm64 and darwin-x64 binaries are available. Got: $PLATFORM-$ARCH" >&2
  exit 1
fi

# Get latest release tag
API_RESPONSE=$(curl -sS "https://api.github.com/repos/$REPO/releases/latest" 2>&1)
if echo "$API_RESPONSE" | grep -q "rate limit"; then
  echo "GitHub API rate limit exceeded. Try again in a few minutes, or install manually:" >&2
  echo "  https://github.com/$REPO/releases" >&2
  exit 1
fi
VERSION=$(echo "$API_RESPONSE" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p')
if [ -z "$VERSION" ]; then
  echo "Failed to detect latest version. Try installing manually:" >&2
  echo "  https://github.com/$REPO/releases" >&2
  exit 1
fi

URL="https://github.com/$REPO/releases/download/$VERSION/$BINARY"

echo "Installing agenteval $VERSION ($PLATFORM-$ARCH)..."

# Create install directory
mkdir -p "$INSTALL_DIR"

# Download
if ! curl -fsSL "$URL" -o "$INSTALL_DIR/agenteval"; then
  echo "Download failed. Check https://github.com/$REPO/releases for available binaries." >&2
  exit 1
fi

chmod +x "$INSTALL_DIR/agenteval"

echo ""
echo "agenteval $VERSION installed to $INSTALL_DIR/agenteval"
echo ""

# Check if install dir is in PATH
if ! echo "$PATH" | tr ':' '\n' | grep -q "^${INSTALL_DIR}$"; then
  echo "Add this to your shell profile (.bashrc, .zshrc, etc.):"
  echo ""
  echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
  echo ""
fi

echo "Run 'agenteval --help' to get started."
