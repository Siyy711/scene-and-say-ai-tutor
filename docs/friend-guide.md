# Scene & Say with your own AI service: a 5-minute guide

## Introduction: what's new in this version

Scene & Say (SS) is a web page for practising English through situations from your own life. You pick a situation, tell what happens or act it out as a chat, and get corrections, a model answer and natural expressions. You save them as cards and words, and SS brings them back later for practice.

Until now, SS only worked inside claude.ai, so you needed a Claude account. **This version also works as a normal web page.** You can use it with the AI service you already like, for example OpenAI (the company behind ChatGPT), DeepSeek, Google Gemini or OpenRouter.

What this means for you:

- **Open a link and start.** No Claude account and nothing to install: https://siyy711.github.io/scene-and-say-ai-tutor/
- **You bring your own key.** An API key is like a prepaid card for an AI service: SS uses it to ask the AI for scenes and feedback, and the service bills your own account. It costs very little (see [What it costs](#what-it-costs)).
- **Your things stay with you.** Your key, cards and words are kept in this browser on this device. They're never sent to the person who made SS. Your stories go only to the AI service you choose.
- **Back up with one click.** Because everything lives in one browser, SS has a Back up button. It saves one file you can keep, or restore in another browser.

> 中文小结:这个版本不再只能在 claude.ai 里用,打开一个网址就能用,AI 可以选自己常用的服务(OpenAI、DeepSeek、Gemini、OpenRouter 等)。要用自己的 API key(相当于 AI 服务的预付卡),费用记在自己账户上,很便宜。key 和所有内容只存在你自己的浏览器里;用"Back up"可以存一份备份文件。

## What you need

- A computer or phone with a modern browser (Chrome, Edge, Safari or Firefox).
- An account with one AI service, with a little credit on it (for example 5 US dollars).
- **A ChatGPT Plus or Pro plan is not enough.** Those plans are for the ChatGPT app. SS needs an **API key**, which comes from the service's developer site and is billed separately.

## Step 1: Get an API key

Pick one service. If you're not sure, choose **OpenRouter**: one account gives you models from many companies, and you can set a limit on each key.

| Service | Where to get a key |
|---|---|
| OpenRouter | https://openrouter.ai/keys |
| OpenAI | https://platform.openai.com/api-keys |
| DeepSeek | https://platform.deepseek.com/api_keys |
| Google Gemini | https://aistudio.google.com/apikey |

1. Sign in, add a small amount of credit, and create a new key.
2. **Set a spending limit** if the service offers one (OpenRouter lets you set a credit limit when you create the key). Then a lost key can only cost a little.
3. Copy the key. Most services show it only once, so paste it straight into SS (step 2).

**Keep your key private.** Don't send it in a chat or an email, not even to the person who made SS. If it ever leaks, delete it on the service's website and make a new one.

## Step 2: Connect SS to your service

1. Open https://siyy711.github.io/scene-and-say-ai-tutor/
2. On the card "Connect your AI service":
   - **Service:** pick yours.
   - **Model:** keep the first one ("cheaper, good for practice"). You can change it later.
   - **API key:** paste your key.
3. Press **Test and save**. SS makes one tiny test call. When it says "It works", the page reloads and you're ready.

If the test fails, SS tells you why: for example the key wasn't copied in full, or the account has no credit.

## Step 3: Practise

1. In **Practice**, open **Your profile** and add your work (and your studies, if you like), so the situations fit your life.
2. Pick a situation and **Tell the story**, or **Act it out** as a chat.
3. Save the corrections and expressions you want to keep. They show up under **Cards** and **Words**.

## Step 4: Back up now and then

Your cards and words live **only in this browser on this device**. If you clear your browser data, or use a different computer or browser, you won't see them there.

- At the bottom of **Practice**, under **Your data**, press **Back up**. SS saves a file like `scene-and-say-backup-2026-10-15.json`. Keep it somewhere safe, like your Documents folder or a cloud drive.
- To move to another device, open SS there, connect your key, press **Restore** and pick that file.
- Restore only **adds and updates**. It never deletes anything. When the same card is in both places, the newer copy wins.
- If you haven't made a backup for a week and have saved something new, SS reminds you.

## What it costs

These are rough estimates, not measurements:

- With a "cheaper, good for practice" model, one story check costs about **1 US cent**. A practice session is maybe 5 to 15 cents.
- The "better, costs more" models cost several times more.
- DeepSeek is usually cheaper than OpenAI.

Each service shows your real spending on its own website.

## Good to know

- **Answers may differ from the claude.ai version.** Different models give different feedback. If the corrections feel weak, try a "better" model: open **Help and known limits** and press **Change**.
- **Shared computer?** Anyone who uses this browser could use your key. When you finish, open **Help and known limits** and press **Forget my key**. Your cards and words stay.
- **Nothing syncs between devices.** Use Back up and Restore to move your data.
- **Something broke?** Open **Help and known limits** at the bottom of Practice and press **Run a live test**. Send a screenshot of the result (never your key) to the person who shared SS with you.
