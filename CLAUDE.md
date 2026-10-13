# CLAUDE.md: the working contract for Scene & Say

Read this file first in every new session, whatever AI coding tool you use.

## What Scene & Say (SS) is

An English speaking-practice web app.
The core loop: pick a life situation (or words from the word bank) → practise it (tell the story, or act it out as a chat) → get corrections, a model answer and natural expressions → save them as cards and words → come back later and practise again with last time's tip.

Many people who change SS have no coding background. **The goal is to understand the code, not only to ship it.** So explain every technical decision in plain words.

## How the app is built

- **One HTML file:** `app/scene-and-say.html`. No framework, no build step, no backend, no API key.
- It runs as a **published claude.ai artifact**. Each person publishes their own copy in their own Claude account (see `docs/pilot-guide.md`).
- It uses three runtime capabilities from the claude.ai artifact platform, through `window.claude`:
  - `sample`: the page asks Claude for scenes, marking, chat replies and model answers.
  - `db`: private cloud storage per viewer (`data/users/<id>/store/...`).
  - `user`: the viewer's account id, to find that private path.
- **Opening the file directly in a browser does not work fully**, because `window.claude` only exists on claude.ai. To see it work locally, use the test stand-in (below).

## Repo layout

```
app/scene-and-say.html    the app, exactly as published
tests/                    browser tests against a stand-in for Claude and the database
docs/pilot-guide.md       how a friend sets up their own copy
```

## Testing

```bash
cd tests && ./run-all.sh
```

- First time on a new computer: `cd tests && npm install && npx playwright install chromium`.
- In a Claude cloud session, Playwright is preinstalled: `NODE_PATH=$(npm root -g) ./run-all.sh`.
- **Expected result at v30: 25 files, TOTAL PASS: 614.** Any FAIL means stop and fix before going on.
- Test rules (details in `tests/README.md`): tests only get stricter; a new test must fail on the previous version first; the stand-in must behave like the real platform (it freezes stored data); find items by content, not position.
- The tests use a fake Claude. They can't judge the quality of real Claude replies. When a prompt to Claude changes, give the person a short "Try this first" list to check by hand.

## Publishing

- Publish your copy with the claude.ai **Artifact tool**, and republish to the same URL each time, so the link stays the same.
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
- Never type or handle passwords or credentials.
- This repo is public. Never commit personal notes, real names, email addresses or screenshots of someone's data.
