# Scene & Say

**Practise English through situations from your own life: what's happening, and what to say.**

Knowing the answer is not the same as learning. Learning happens when you make a decision, practise it, see how it goes, get feedback, and try to do better next time. Scene & Say (SS) is built around that loop.

## Who it's for

I first built SS for myself, to fix two problems:

1. **Too many passive words.** I recognise them when I meet them, but I can't use them myself.
2. **Slow sentences in unfamiliar situations.** Building a sentence takes me a long time. When I try to speed up, I pick the wrong word or make grammar mistakes. Problem 1 is part of the reason.

SS works on both problems with [three kinds of practice](#what-you-practise). It also fits around your life:

- **Scenes about your own life.** Fill in your profile (your work, and your studies or research if you like), and the AI builds situations you'd really face.
- **Five to ten minutes a day.** One round of Spot it or Compare is up to three short exercises.
- **Words from anywhere.** Save an expression while you work with Claude, or take a screenshot of one you meet in a show or a book. SS brings it back later for practice.

So SS suits people who already have a working base in English and want to keep practising for real situations. For example, people starting a job in an English-speaking workplace, and master's or PhD students. It isn't a course for beginners.

## What you practise

**1. Cards: whole situations.** Pick a situation you'd really find yourself in (a repair visit, a meeting, a seminar), then:
- **Tell the story:** write what happens. This trains your writing.
- **Act it out:** have the whole conversation as a chat with the other person.

You get corrections with a short reason for each one, a model answer in natural English, and the expressions worth keeping. Each situation becomes a card. Later you come back to the same card and try again, with last time's tip.

**2. Words and Spot it: from passive to active words.** A passive word is one you understand when you meet it, but can't use yourself yet. An active word is one you use when a situation calls for it. Your word bank collects expressions from your practice and from anywhere else you meet them. **Spot it** gives you a new situation and asks you to use the right word without seeing it, in three steps:
- **No cue:** you find the word yourself.
- **Hint:** you see where you first met it.
- **Bridge:** you see the old and the new situation side by side, and why the word fits both. Then you use it again.

Words come back on a schedule. The better you do, the longer the gap.

**3. Compare: the right word among similar ones.** Synonyms are rarely exact. Compare gives each word in a group an almost identical situation that differs in one detail, and you choose the word that fits. The feedback says which detail decides it.

## Two ways to use it

Version **v32** (Pixel Town: a bright, daytime pixel-art look). SS runs in two places, from the same file:

1. **As a normal web page, with your own AI service.** Open **https://siyy711.github.io/scene-and-say-ai-tutor/**, pick a service (OpenAI, DeepSeek, Google Gemini, OpenRouter, or any service that speaks the OpenAI format) and paste your own API key. No Claude account needed. Start with the 5-minute guide: [`docs/friend-guide.md`](docs/friend-guide.md).
2. **On claude.ai, with Claude.** Make **your own copy** in your own Claude account (saving needs Claude Pro or higher): see [`docs/pilot-guide.md`](docs/pilot-guide.md).

## How it works

- `app/scene-and-say.html` is the whole app: one HTML file with no framework and no build step. `index.html` is the same app in a plain web page, for GitHub Pages; the tests rebuild it, so don't edit it by hand.
- On claude.ai, the page asks Claude for scenes and feedback, and keeps each person's cards and words in private cloud storage.
- Anywhere else, the page asks your chosen AI service with your own key, and keeps your cards and words in the browser's own database on that device. Your key stays in that browser and goes only to that service. **Back up** and **Restore** move your data between browsers.

## Run the tests

The tests open the real app in a browser, with a stand-in for Claude and the storage.

```bash
cd tests
npm install
npx playwright install chromium
./run-all.sh
```

Expected: every file passes, **TOTAL PASS: 975**. More in [`tests/README.md`](tests/README.md).

## Working on it with an AI coding tool

Start with [`CLAUDE.md`](CLAUDE.md). It explains the app, the working agreements and the safety rules.

## Licence

[MIT](LICENSE) © 2026 Siyy
