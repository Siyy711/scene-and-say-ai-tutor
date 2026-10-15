# CLAUDE.md: the working contract for Scene & Say

Read this file first in every new session, whatever AI coding tool you use.

## What Scene & Say (SS) is

An English speaking-practice web app.
The core loop: pick a life situation (or words from the word bank) → practise it (tell the story, or act it out as a chat) → get corrections, a model answer and natural expressions → save them as cards and words → come back later and practise again with last time's tip.

Many people who change SS have no coding background. **The goal is to understand the code, not only to ship it.** So explain every technical decision in plain words.

## How the app is built

- **One HTML file:** `app/scene-and-say.html`. No framework, no build step, no backend, no API key.
- It runs in two places from the same file:
  - as a **published claude.ai artifact**: each person publishes their own copy in their own Claude account (see `docs/pilot-guide.md`);
  - as a **normal web page** (GitHub Pages serves `index.html`): each person connects their own AI service with their own API key (see `docs/friend-guide.md`).
- On claude.ai it uses four runtime capabilities from the artifact platform, through `window.claude`:
  - `sample`: the page asks Claude for scenes, marking, chat replies and model answers.
  - `db`: private cloud storage per viewer (`data/users/<id>/store/...`).
  - `user`: the viewer's account id, to find that private path.
  - `downloads`: saving the Back up file (the viewer confirms each save).
- When `window.claude` is missing, `ownRuntime()` fills the same doors: the learner's own AI service (OpenAI-format `chat/completions`) and the browser's own database (IndexedDB). Opened as a `file://` page, the browser database may not work; serve it over http, as the tests do.

## Repo layout

```
app/scene-and-say.html    the app, exactly as published
index.html                the same app in a plain page, for GitHub Pages (rebuilt by tests/run-all.sh; don't edit)
tests/                    browser tests against a stand-in for Claude and the database
docs/friend-guide.md      how a friend uses SS with their own AI service (starts with an introduction)
docs/pilot-guide.md       how a friend sets up their own copy on claude.ai
```

## Testing

```bash
cd tests && ./run-all.sh
```

- First time on a new computer: `cd tests && npm install && npx playwright install chromium`.
- In a Claude cloud session, Playwright is preinstalled: `NODE_PATH=$(npm root -g) ./run-all.sh`.
- **Expected result at v31: 28 files, TOTAL PASS: 732.** Any FAIL means stop and fix before going on.
- Test rules (details in `tests/README.md`): tests only get stricter; a new test must fail on the previous version first; the stand-in must behave like the real platform (it freezes stored data); find items by content, not position.
- The tests use a fake Claude. They can't judge the quality of real Claude replies. When a prompt to Claude changes, give the person a short "Try this first" list to check by hand.

## Publishing

- Publish your copy with the claude.ai **Artifact tool**, and republish to the same URL each time, so the link stays the same. Declare all four capabilities: `sample`, `db`, `user`, `downloads`.
- GitHub Pages serves `index.html` from `main`. Run the tests before pushing, so `index.html` matches the app.
- Never host any other web page under the same `github.io` address: pages there share the browser's storage, so they could read people's API keys.
- Publish only after the tests pass.

## Working agreements

- **Plan first, then build.** Wait for a "go" before any build starts.
- **Every plan has 8 lines:** Parts of the app · Stored data · Requests to Claude · What you'll notice · Tests · Done when · Pre-mortem · Open questions.
- **Small, clear fixes** that don't change stored data: fix first, explain after.
- **Every report has one line "Also changed (not requested)"**, or "None".
- After every change, run the full test suite again.
- Be honest. If something is unknown or can't be done, say so.

## Safety rules

- Never delete a person's stored data. People delete entries in the app (it has Undo).
- The word bank holds English expressions only: no passwords, no personal data.
- API keys are typed by each person into their own browser. Never commit a key, and never ask anyone to send theirs.
- Never type or handle passwords or credentials.
- This repo is public. Never commit personal notes, real names, email addresses or screenshots of someone's data.
