#!/bin/bash
# Runs every test file and prints the total. Every line should be PASS.
cd "$(dirname "$0")"
# Build the test page from the real app: the stand-in (mock-head.html) + app/scene-and-say.html.
python3 build_mock.py ../app/scene-and-say.html preview-mock.html || exit 1
# The own-key page (S1): the same app with no stand-in, as GitHub Pages serves it.
python3 build_own.py ../app/scene-and-say.html preview-own.html || exit 1
# In the public repo, index.html (the page GitHub Pages serves) is rebuilt the same way, so it never falls behind the app.
[ -f ../index.html ] && { python3 build_own.py ../app/scene-and-say.html ../index.html || exit 1; }
[ -f test-shot.png ] || node make-test-shot.js
tot=0
for t in $(ls test*.js | sort -V); do
  r=$(node "$t" 2>&1); code=$?; f=$(echo "$r" | grep -c '^FAIL'); p=$(echo "$r" | grep -c '^PASS'); tot=$((tot+p))
  if [ "$code" != "0" ] && [ "$f" == "0" ]; then echo "$t: CRASHED before the end (exit $code)"; echo "$r" | grep -m3 -i "error"; continue; fi
  if [ "$f" != "0" ]; then echo "$t: $f FAIL"; echo "$r" | grep '^FAIL' | head -5; else echo "$t: $p pass"; fi
done
echo "TOTAL PASS: $tot"
