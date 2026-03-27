#!/bin/zsh
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: ./.build-report.sh <report.tex>" >&2
  exit 1
fi

report_path="$1"
report_name="$(basename "$report_path")"
report_base="${report_name%.tex}"

mkdir -p .latex-build
latexmk -pdf "$report_name"

if [[ -f ".latex-build/${report_base}.pdf" ]]; then
  cp ".latex-build/${report_base}.pdf" "${report_base}.pdf"
fi
