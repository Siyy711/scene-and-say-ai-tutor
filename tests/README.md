# SS test suite: how to run it

These are the automated checks for Scene & Say, v5 to v31: 28 files and 732 checks. They run the real app in a browser against a **stand-in** for Claude and the database (`mock-head.html`). They test the app's logic and screens. They **can't** judge the quality of real Claude replies, so for that, try the app by hand after changing a request to Claude.

## Files

| File | What it is |
|---|---|
| `test5.js` … `test29.js` | One file per version or feature. Each line prints PASS or FAIL. `test28.js` checks the v28 design rules: pixel art at whole-number scale, grey text contrast, one filled button per page, delete buttons you can see without hovering, no sideways scroll on a phone. `test29.js` checks round 5a: the Practice order, the new wording, "Surprise me" as the last card, the Help line, tab numbers for what is due again, one date format, the filled chip, word forms highlighted in Compare. |
| `test30.js` | S1 slice 1, the own-key version: SS opened as a normal web page (no `window.claude`), with a **fake** AI service that checks the key and the model like a real one. Setup screen, wrong key, wrong model, Check my story, saving in the browser database (IndexedDB), reopening, a second tab, Act it out, Forget my key, a service without JSON mode, a service that refuses web pages. It serves the page over http, because IndexedDB needs a real web address. |
| `test31.js` | S1 slice 2: backup and restore. Back up makes one JSON file (cards, words, Compare sets, pictures, "Not a pair" choices); Restore adds what's missing and keeps the newer copy, never deletes; bad or newer files are refused; the reminder shows only in the own-key version, after 7 days and only if something is new. Also the claude.ai side, where the file goes through the platform's `downloads` capability. |
| `test32.js` | S1 slice 3: the page GitHub Pages serves has its title and a description in the head; the setup card links to the friend's guide (new tab); with no AI service connected, the own-key version says "… needs your AI service. Connect it at the top of the Practice page." and never shows "Claude" on any page. The claude.ai stand-in keeps its own wording. |
| `build_own.py` | Wraps the app in a plain web page with **no** stand-in: `preview-own.html`, the page the tests open. The same script builds `index.html` at the repo root, the page GitHub Pages serves; `run-all.sh` rebuilds it every time. |
| `mock-head.html` | The stand-in: a fake `window.claude` with scripted, request-dependent replies, plus a fake database in localStorage that freezes data like the real one, and (S1) a fake `downloads` that only accepts allowed file types and can be told the viewer said no. |
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

`run-all.sh` first builds `preview-mock.html` from `../app/scene-and-say.html`, then runs every file. Every file should show "pass", and the total should match the last known number (732 at v31).

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
