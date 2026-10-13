# SS test suite: how to run it

These are the automated checks for Scene & Say, v5 to v30: 25 files and 614 checks. They run the real app in a browser against a **stand-in** for Claude and the database (`mock-head.html`). They test the app's logic and screens. They **can't** judge the quality of real Claude replies, so for that, try the app by hand after changing a request to Claude.

## Files

| File | What it is |
|---|---|
| `test5.js` … `test29.js` | One file per version or feature. Each line prints PASS or FAIL. `test28.js` checks the v28 design rules: pixel art at whole-number scale, grey text contrast, one filled button per page, delete buttons you can see without hovering, no sideways scroll on a phone. `test29.js` checks round 5a: the Practice order, the new wording, "Surprise me" as the last card, the Help line, tab numbers for what is due again, one date format, the filled chip, word forms highlighted in Compare. |
| `mock-head.html` | The stand-in: a fake `window.claude` with scripted, request-dependent replies, plus a fake database in localStorage that freezes data like the real one. |
| `build_mock.py` | Glues `mock-head.html` + the app into `preview-mock.html`, the page the tests open. |
| `fixture-bolt.json`, `fixture-bolt-v3.json` | Saved real entries used by older tests. |
| `make-test-shot.js` | Makes `test-shot.png`, a 3000×2000 picture used by test8. |
| `run-all.sh` | Runs everything and prints the total. |

## How to run

From the repo root:

```bash
cd tests
npm install                      # once: installs Playwright, the test browser driver
npx playwright install chromium  # once: downloads the browser it drives
./run-all.sh
```

`run-all.sh` first builds `preview-mock.html` from `../app/scene-and-say.html`, then runs every file. Every file should show "pass", and the total should match the last known number (614 at v30).

In a Claude cloud session, Playwright and Chromium are already installed, so you can skip `npm install` and run:

```bash
NODE_PATH=$(npm root -g) ./run-all.sh
```

Two optional settings: `PW` points to a different Playwright install, and `CHROMIUM` points to a different browser file.

## The rules for tests

- **Tests may only get stricter.** If behaviour changes on purpose, update the old test and write a comment saying why and in which version.
- **Every new test must fail on the previous version first.** Run it against the old app (`build_mock.py old.html preview-mock.old.html`, then `node testN.js preview-mock.old.html`). A check that passes on both versions doesn't prove anything, unless it's there to protect behaviour that shouldn't change.
- **The stand-in must behave like the real thing.** It freezes data, answers depend on the request, and it only accepts something when the request says so.
- **Find items by content, not position.** Lists are often shuffled.
