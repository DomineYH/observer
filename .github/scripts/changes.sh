#!/usr/bin/env bash
# Usage: changes.sh <diff command...>; prints the `changes` output line (code=true|false).
# The line is printed only after the diff and the classifier both succeeded, so a failed diff publishes nothing.
set -euo pipefail
out=$("$@" | sh "$(dirname "$0")/classify-changes.sh")
echo "$out"
