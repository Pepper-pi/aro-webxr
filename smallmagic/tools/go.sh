#!/bin/sh
# Builds the page and takes one still: sh tools/go.sh <shots.mjs arguments>. Stops if the build fails.
cd "$(dirname "$0")/.." || exit 1
# CHROME: a Chromium of your own, if Playwright's isn't installed
node build.mjs > .build.log 2>&1 || { grep -v "^ *at " .build.log | head -30; echo "BUILD FAILED"; exit 1; }
if [ $# -gt 0 ]; then timeout 200 node tools/shots.mjs "$@"; fi
