#!/usr/bin/env bash
# Builds dist/overclock-itch.zip with index.html at the root, ready for itch.io.
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/overclock-itch.zip
zip -r -q dist/overclock-itch.zip index.html lib src assets
echo "Built dist/overclock-itch.zip"
unzip -l dist/overclock-itch.zip | tail -n 1
