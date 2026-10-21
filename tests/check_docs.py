import os, re, sys
# Checks that the docs agree with each other and with this test run (retro, 21 Oct).
# A wrong line of code fails a test; before this, a wrong line in a doc failed nothing.
# usage (run-all.sh does this at the end): python3 check_docs.py <repo folder> <files run> <total pass>
# Prints "DOCS OK" or "DOCS FAIL" lines. They start with DOCS, so they don't count in TOTAL PASS.
root, files, total = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])

def read(name):
    p = os.path.join(root, name)
    return open(p, encoding='utf-8').read() if os.path.exists(p) else None

bad = []

# 1. The current version. Its home is the last row of docs/changelog.md, when the repo has one.
#    Every line that names the current version must agree with it, and with each other.
says = {}
for name, pattern in [('CLAUDE.md', r'current version: v(\d+)'),
                      ('CLAUDE.md', r'Expected result at v(\d+)'),
                      ('docs/now.md', r'当前版本 \*\*v(\d+)\*\*'),
                      ('docs/now.md', r'已发布到 \*\*v(\d+)\*\*')]:
    text = read(name)
    if text:
        for v in re.findall(pattern, text):
            says.setdefault(int(v), []).append(name)
log = read('docs/changelog.md')
if log:
    rows = re.findall(r'^\| v(\d+) \|', log, re.M)
    if rows:
        says.setdefault(int(rows[-1]), []).append('docs/changelog.md (last row)')
if len(says) > 1:
    bad.append('the docs name different current versions: ' +
               '; '.join('v%d in %s' % (v, ', '.join(n)) for v, n in sorted(says.items())))

# 2. The expected test result. Its home is CLAUDE.md ("35 files, TOTAL PASS: 1016").
#    It must match what this run really counted.
claude = read('CLAUDE.md') or ''
m = re.search(r'(\d+) files, TOTAL PASS: (\d+)', claude)
if not m:
    bad.append('CLAUDE.md has no expected test result ("N files, TOTAL PASS: N")')
elif (int(m.group(1)), int(m.group(2))) != (files, total):
    bad.append('CLAUDE.md expects %s files and %s checks, but this run had %d files and %d checks'
               % (m.group(1), m.group(2), files, total))

for b in bad:
    print('DOCS FAIL: ' + b)
if not bad:
    print('DOCS OK: the current version and the expected test result agree everywhere')
