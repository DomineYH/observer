#!/bin/sh
# Reads changed paths on stdin, prints code=true or code=false for $GITHUB_OUTPUT.
# Fails toward code: any path outside docs/ or a top-level *.md, and an empty list, mean code=true.
code=false
seen=false
while IFS= read -r path; do
  seen=true
  case "$path" in
    docs/*) ;;
    */*) code=true ;;
    *.md) ;;
    *) code=true ;;
  esac
done
[ "$seen" = true ] || code=true
echo "code=$code"
