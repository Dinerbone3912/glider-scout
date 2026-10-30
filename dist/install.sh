#!/usr/bin/env bash
# glider-scout-mcp installer — one command, no dependencies beyond Node >=18.
set -euo pipefail
PKG="${1:-glider-scout-mcp-1.1.0.tgz}"
echo "Installing $PKG ..."
if command -v npm >/dev/null 2>&1; then
  npm install -g "$PKG" || npm install "$PKG"
  echo "Done. Run: glider-scout-mcp   (stdio MCP server)"
elif command -v node >/dev/null 2>&1; then
  echo "npm not found; unpacking for direct node use:"
  mkdir -p glider-scout-mcp && tar -xzf "$PKG" -C glider-scout-mcp --strip-components=1
  echo "Run: node glider-scout-mcp/server.mjs"
else
  echo "ERROR: need Node >=18 (npm optional)" >&2; exit 1
fi
