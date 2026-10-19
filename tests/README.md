# SS test suite: how to run it

These are the automated checks for Scene & Say, v5 to v36: 33 files and 954 checks. They run the real app in a browser against a **stand-in** for Claude and the database (`mock-head.html`). They test the app's logic and screens. They **can't** judge the quality of real Claude replies, so for that, try the app by hand after changing a request to Claude.

## Files

| File | What it is |
|---|---|
| `test5.js` … `test29.js` | One file per version or feature. Each line prints PASS or FAIL. `test28.js` checks the v28 design rules: pixel art at whole-number scale, grey text contrast, one filled button per page, delete buttons you can see without hovering, no sideways scroll on a phone. `test29.js` checks round 5a: the Practice order, the new wording, "Surprise me" as the last card, the Help line, tab numbers for what is due again, one date format, the filled chip, word forms highlighted in Compare. |
| `test30.js` | S1 slice 1, the own-key version: SS opened as a normal web page (no `window.claude`), with a **fake** AI service that checks the key and the model like a real one. Setup screen, wrong key, wrong model, Check my story, saving in the browser database (IndexedDB), reopening, a second tab, Act it out, Forget my key, a service without JSON mode, a service that refuses web pages. It serves the page over http, because IndexedDB needs a real web address. |
| `test31.js` | S1 slice 2: backup and restore. Back up makes one JSON file (cards, words, Compare sets, pictures, "Not a pair" choices); Restore adds what's missing and keeps the newer copy, never deletes; bad or newer files are refused; the reminder shows only in the own-key version, after 7 days and only if something is new. Also the claude.ai side, where the file goes through the platform's `downloads` capability. |
| `test32.js` | S1 slice 3: the page GitHub Pages serves has its title and a description in the head; the setup card links to the friend's guide (new tab); with no AI service connected, the own-key version says "… needs your AI service. Connect it at the top of the Practice page." and never shows "Claude" on any page. The claude.ai stand-in keeps its own wording. |
| `test33.js` | v32, Pixel Town: drawings use only the 15 palette colours; the Practice page is a street (5 places a row on a laptop, 3 on a phone, a different building for each theme and for your own themes, names only, the description still sent to the AI); sky and grass on every page top; one sun-yellow button per page; feedback headings in the pixel font, sentence case, with a coloured square; a face on every chat line; no sideways scroll on a phone. `test28.js` was updated on purpose for v32: the active tab is a white plate (was an underline), and a dark computer setting now keeps the daytime colours (was: dark mode has its own colours). `test29.js`: the selected chip is filled with ink (was: with the accent colour). |
| `test34.js` | v33: no due counts on Words, Compare or the tabs (the Practice board keeps them); a register tag on every word (labelled in groups of 20, once per visit, never over your own choice; editable in the open entry); Spot it and Compare pick the place from the register (a jargon word never lands at home, with family or friends; a word with no label keeps every place); a new note gets its tag; one street of 5 places plus the "More places" signpost and the All places board ("+ my street", at least one, at most five, kept on this device, hidden and new themes); 3× buildings on a narrow laptop; no sideways page scroll on a phone. Updated on purpose for v33: `test19`, `test21`, `test26`, `test28`, `test29` (the counts are gone), `test22` (the usage line now starts with the label), `test25`, `test28`, `test29`, `test33` (one street and the board). |
| `test35.js` | v34: the street stands on grass that runs edge to edge (real pixels from a screenshot: grass at both window edges beside and below the signs, sky above the ground line, no strip of sky under the town) at 1440, 1280, 1024, 900, 760 and 390px; a wider street on a laptop (up to 1120px, centred, a gap around each 4× building, each sign on one line); two more clouds outside the text column, hidden on a phone; the All places board on grass, 4 a row; no sideways page scroll. Spot it: "I mixed up the time" counts for the noun "mix-up" (the request says another word class counts, and the feedback shows the saved form), but "I got the time wrong" still gets the hint. |
| `test36.js` | v35, the night town. A browser set to dark opens it at night with nothing saved: deep-blue sky edge to edge, stars on both sides of the column and a crescent moon (real pixels from a screenshot), dim clouds, lit windows; wooden signs with cream letters, the Today and All places boards in lighter wood with cream notes; the yellow main button keeps a dark edge; panels have a light frame and a soft purple shadow. Every text on 8 pages (and the open profile) is 4.5:1 or more at night. Tapping the moon switches to day (a real button with "Switch to day" / "Tap for day"), the choice is saved on this device only (`ss.sky`), survives a reload and works from the keyboard. With nothing saved, the town follows the device as it changes, and the app's own `data-theme`; a saved tap wins. Night is set before the top bar is drawn. At 1440, 1280, 1024, 760 and 390px, day and night: one sun or moon on each of 8 pages, never over a picture, title, text or button, out in the open sky from 1240px, 3× on a phone; clouds on every page's sky; no sideways scroll. The sun lifts under the mouse; Help has the switch line; the Practice title is two lines; daytime colours unchanged; the own-key page gets night too. |
| `test37.js` | v36, a tap holds only until the device switches. A tap on the sun or moon is saved with what the device said at that moment (`ss.sky` + `ss.skyDevice`) and survives a reload; when the device (or the app's `data-theme`) switches, while SS is open or closed, the tap is forgotten and the town follows the device again; a tap back to what the device says is not saved; an old v35 tap is forgotten once, with no flash of the wrong sky; nothing goes to the cloud; the Help line; the own-key page follows the same rule. |
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

`run-all.sh` first builds `preview-mock.html` from `../app/scene-and-say.html`, then runs every file. Every file should show "pass", and the total should match the last known number (954 at v36).

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
