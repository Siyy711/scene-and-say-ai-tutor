// v31 (S1 slice 1): the own-key version. Off claude.ai there is no window.claude, so SS uses
// the learner's own AI service (OpenAI format, their own key) and this browser's database (IndexedDB).
// The page is served over http like GitHub Pages; the AI services are FAKE (Playwright routes),
// and like the real ones they check the key, the model, and answer from what the request says.
const {chromium}=require(process.env.PW||'playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const FILE=process.argv[2]||'preview-own.html';
const GOOD="sk-or-test-good";

/* ---- the fake AI services ---- */
const SEEN=[];   /* every request body, newest last */
function reply(content,finish){ return {id:"x",choices:[{index:0,message:{role:"assistant",content:content},finish_reason:finish||"stop"}]}; }
function answer(body,host){
  const msgs=body.messages||[], last=String((msgs[msgs.length-1]||{}).content||""), all=msgs.map(m=>String(m.content)).join("\n");
  const fence = s => host==="plain.example" ? "```json\n"+s+"\n```" : s;   /* this one wraps JSON in a code fence, as some models do */
  if(last.indexOf("Reply with the single word: ok")>=0) return reply("ok");
  if(all.indexOf("You are playing a part")>=0){
    const you=msgs.filter(m=>m.role==="user").slice(1).map(m=>m.content).join(" ");
    return reply(/leak/i.test(you) ? "A leak again? Let me take a look under the sink." : "Sorry, what was that?");
  }
  if(last.indexOf("You write short, specific speaking-practice scenes")>=0) return reply(fence(JSON.stringify({title:"The plumber's second visit",setting:"Saturday morning in your kitchen.",youAre:"the tenant",partnerRole:"the plumber",
    whatsHappening:"The sink is leaking again.",visualDetails:["a bucket","wet towels","a toolbox","rust","water on the tiles"],
    usefulLanguage:[{phrase:"It's been dripping since…",note:"how long"},{phrase:"How long will it take?",note:"time"},{phrase:"Is it covered?",note:"cost"},{phrase:"Could you show me?",note:"see"},{phrase:"That's a relief",note:"react"}],
    firstLine:"Morning! So it's leaking again, is it?"})));
  if(last.indexOf("You are a warm, precise English teacher")>=0){
    const story=(last.match(/"""([\s\S]*?)"""/)||[])[1]||last;
    const corr = /\bhe fix\b/.test(story) ? [{original:"he fix",fixed:"he fixed",why:"Past tense.",type:"grammar"}] : [];
    return reply(fence(JSON.stringify({strengths:["Clear order of events."],corrections:corr,modelStory:"The plumber came round again on Saturday.",
      highlights:[{term:"came round",kind:"phrase",meaning:"visited",usage:"Casual.",example:"She came round for tea."}],
      levelCheck:{sitsAt:"B1",meetsTarget:true,note:"Mostly consistent.",readyFor:null},nextTip:"Use 'came round' next time."})));
  }
  return reply("{}");
}
async function fakeAI(route){
  const req=route.request(), u=new URL(req.url());
  const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
  if(req.method()==="OPTIONS") return route.fulfill({status:204,headers:cors});
  if(u.hostname==="blocked.example") return route.abort("failed");   /* a service that refuses web pages (CORS) */
  const body=JSON.parse(req.postData()||"{}"); body.__host=u.hostname; body.__auth=req.headers()["authorization"]||""; body.__path=u.pathname; SEEN.push(body);
  const send=(status,obj)=>route.fulfill({status,headers:Object.assign({"Content-Type":"application/json"},cors),body:JSON.stringify(obj)});
  if(body.__auth!=="Bearer "+GOOD) return send(401,{error:{message:"No auth credentials found",code:401}});
  if(body.model==="no-such-model") return send(400,{error:{message:"no-such-model is not a valid model ID",code:400}});
  if(u.hostname==="plain.example" && body.response_format) return send(400,{error:{message:"response_format is not supported by this model"}});
  return send(200,answer(body,u.hostname));
}

(async()=>{
  /* serve the page over http, like GitHub Pages (IndexedDB needs a real web address) */
  const srv=http.createServer((q,s)=>{ const f=path.join(process.cwd(),FILE); s.writeHead(200,{"Content-Type":"text/html; charset=utf-8"}); s.end(fs.readFileSync(f)); });
  await new Promise(r=>srv.listen(0,"127.0.0.1",r));
  const URL="http://127.0.0.1:"+srv.address().port+"/";
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const errs=[];
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,90)+')', false); } };
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  await ctx.route(/^https:\/\/(openrouter\.ai|api\.openai\.com|plain\.example|blocked\.example)\//,fakeAI);
  const page=async()=>{ const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(5000); await p.goto(URL); await p.waitForTimeout(600); return p; };
  const setup=async(p,svc,key,model,base)=>{
    await p.selectOption('#own-svc',svc);
    if(base) await p.fill('#own-base',base);
    if(model){   /* a model from the dropdown, or "Type another model name…" and type it */
      const vals=await p.$$eval('#own-model-pick option',o=>o.map(x=>x.value));
      if(vals.indexOf(model)>=0) await p.selectOption('#own-model-pick',model);
      else { await p.selectOption('#own-model-pick','__type'); await p.fill('#own-model',model); }
    }
    await p.fill('#own-key',key);
    await p.click('#own-save'); await p.waitForTimeout(500);
  };
  const help=async p=>{ await p.click('#help-box > summary'); await p.waitForTimeout(150); };

  let p;
  await section("First visit off claude.ai: a setup card, not the Claude guest message", async()=>{
    p=await page();
    ok("the setup card shows: 'Connect your AI service'", (await p.isVisible('#blocked .ownkey')) && (await p.textContent('#blocked h2'))==="Connect your AI service");
    const txt=await p.textContent('#blocked');
    ok("…and it doesn't talk about guests from outside the owner's organisation", txt.indexOf("organisation")<0);
    ok("…it says the key and the data stay in this browser", /stay in this browser on this device/.test(txt));
    ok("…it suggests a monthly spending limit", /monthly spending limit/.test(txt));
    ok("it offers the five services from the plan", JSON.stringify(await p.$$eval('#own-svc option',o=>o.map(x=>x.textContent)))===JSON.stringify(["OpenAI","DeepSeek","Google Gemini","OpenRouter","Other (custom address)"]));
    /* changed on purpose (Siyy, 15 Oct): the model is picked from a dropdown, the text field is only for other names */
    ok("OpenRouter is chosen first, with its model picked in the dropdown", (await p.inputValue('#own-svc'))==="openrouter" && (await p.inputValue('#own-model-pick'))==="openai/gpt-5.4-mini" && (await p.inputValue('#own-model'))==="openai/gpt-5.4-mini");
    ok("the model dropdown says what each model is for, and ends with 'Type another model name…'", JSON.stringify(await p.$$eval('#own-model-pick option',o=>o.map(x=>x.textContent)))===JSON.stringify(["GPT-5.4 mini · cheaper, good for practice","GPT-5.4 · better, costs more","Type another model name…"]));
    ok("…the text field for a model name stays hidden until you need it", !(await p.isVisible('#own-model')));
    await p.selectOption('#own-model-pick','openai/gpt-5.4');
    ok("picking the other model puts its exact name in the field that gets saved", (await p.inputValue('#own-model'))==="openai/gpt-5.4" && !(await p.isVisible('#own-model')));
    await p.selectOption('#own-model-pick','__type');
    ok("'Type another model name…' shows an empty field to type in", (await p.isVisible('#own-model')) && (await p.inputValue('#own-model'))==="");
    ok("the key field hides what you type (password field)", (await p.getAttribute('#own-key','type'))==="password");
    ok("the address field only shows for 'Other'", !(await p.isVisible('#own-base')));
    await p.selectOption('#own-svc','other');
    ok("…and appears when you pick 'Other'", await p.isVisible('#own-base'));
    await p.selectOption('#own-svc','openai');
    ok("picking OpenAI picks its own models (gpt-5.4-mini first) and hides the text field again", (await p.inputValue('#own-model-pick'))==="gpt-5.4-mini" && (await p.inputValue('#own-model'))==="gpt-5.4-mini" && !(await p.isVisible('#own-model')));
    await p.selectOption('#own-svc','other');
    ok("for 'Other' there's no list: you type the model name", (await p.isVisible('#own-model')) && (await p.$$eval('#own-model-pick option',o=>o.length))===1);
    await p.selectOption('#own-svc','openai');
    ok("there's a link to get a key from the chosen service", (await p.getAttribute('.ownkey-help a','href'))==="https://platform.openai.com/api-keys");
    await p.fill('#ownseed','The aircon man came today.'); await p.click('#btn-own-scene'); await p.waitForTimeout(200);
    ok("an AI button pressed before connecting says to connect first, not 'this view isn't allowed to ask Claude'", /Connect your AI service first/.test(await p.textContent('#scene-body')) && !/Claude/.test(await p.textContent('#scene-body')));
    await p.click('#nav-practice'); await p.waitForTimeout(150);
    await help(p);
    ok("Help's check names the engine: 'own key (this browser)'", /own key \(this browser\)/.test(await p.textContent('#diag')));
    ok("Help says no AI service is connected yet", /No AI service connected yet/.test(await p.textContent('#own-help')));
    ok("saving works off claude.ai: the database is available", /Storage \(db\)\s*available/.test(await p.textContent('#diag')));
  });

  await section("Test and save: wrong key, wrong model, then the right ones", async()=>{
    await setup(p,'openrouter','sk-or-wrong');
    ok("a wrong key says the service didn't accept it", /didn't accept the key/.test(await p.textContent('#own-msg')));
    ok("…and nothing is saved", (await p.evaluate(()=>localStorage.getItem('ss.own.v1')))===null);
    ok("…the key went only to the chosen service, as 'Bearer …'", SEEN.length===1 && SEEN[0].__host==="openrouter.ai" && SEEN[0].__path==="/api/v1/chat/completions" && SEEN[0].__auth==="Bearer sk-or-wrong");
    await setup(p,'openrouter',GOOD,'no-such-model');
    ok("a wrong model name says so", /doesn't know that model name/.test(await p.textContent('#own-msg')));
    await setup(p,'openrouter',GOOD,'openai/gpt-5.4-mini');
    await p.waitForTimeout(1200);   /* it reloads after "It works" */
    ok("the right key is saved in this browser", JSON.parse(await p.evaluate(()=>localStorage.getItem('ss.own.v1'))).key===GOOD);
    ok("after the reload the setup card is gone", !(await p.isVisible('#blocked .ownkey')));
    ok("…and 'Build a scene' works now", !(await p.isDisabled('#btn-own-scene')));
    await help(p);
    ok("Help names the service and the model", /OpenRouter · openai\/gpt-5\.4-mini/.test(await p.textContent('#own-help')) && /available — OpenRouter/.test(await p.textContent('#diag')));
    await p.click('#btn-diag'); await p.waitForTimeout(400);
    ok("the live test reaches your AI service", /replied “ok”/.test(await p.textContent('#diag')) && /Your AI service is reachable/.test(await p.textContent('#diag-out')));
  });

  await section("Check my story and save it as a card", async()=>{
    await p.fill('#ownseed','Yesterday the plumber came. He looked at the sink and he fix it in ten minutes.');
    await p.click('#btn-own-check'); await p.waitForTimeout(600);
    const last=SEEN[SEEN.length-1];
    ok("the request asked for JSON only (response_format)", last.response_format && last.response_format.type==="json_object");
    ok("…sent the teacher prompt with the story in it", /warm, precise English teacher/.test(JSON.stringify(last.messages)) && /he fix it/.test(JSON.stringify(last.messages)));
    ok("the correction from the AI shows: 'he fixed'", /he fixed/.test(await p.textContent('#story-out')));
    await p.click('#story-out .btn:has-text("Save as a card")'); await p.waitForTimeout(500);
    ok("it saves: 'It's under Cards'", /It's under Cards/.test(await p.textContent('#story-out')));
    ok("…and doesn't say 'this device only' (the browser database counts as saved)", !/this device only/.test(await p.textContent('#story-out')));
  });

  await section("Close and reopen: the card is still there, from the browser database", async()=>{
    await p.close();
    p=await page();
    /* wipe the small quick copy, so only the browser database (IndexedDB) can bring it back */
    await p.evaluate(()=>{ localStorage.removeItem('ss.cards.v1'); localStorage.removeItem('ss.terms.v1'); });
    await p.reload(); await p.waitForTimeout(700);
    await p.click('#nav-cards'); await p.waitForTimeout(300);
    ok("the card is still under Cards after reopening", /Something from your week|From your week/.test(await p.textContent('#v-cards')));
    const n=await p.evaluate(()=>new Promise(r=>{ const q=indexedDB.open("scene-and-say"); q.onsuccess=()=>{ const g=q.result.transaction("docs").objectStore("docs").getAllKeys(); g.onsuccess=()=>r(g.result); }; }));
    ok("it's stored in the browser database under the cards path", n.some(k=>/^data\/users\/local\/store\/cards\//.test(k)));
    await p.click('#nav-practice'); await p.waitForTimeout(200);
  });

  await section("A second tab sees a new card without reloading", async()=>{
    const p2=await page();
    await p2.click('#nav-cards'); await p2.waitForTimeout(200);
    await p.fill('#ownseed','On Monday the bus was late, so I take a taxi to the office.');
    await p.click('#btn-own-check'); await p.waitForTimeout(600);
    await p.click('#story-out .btn:has-text("Save as a card")'); await p.waitForTimeout(900);
    const txt=await p2.textContent('#v-cards');
    ok("the other tab shows 2 cards now", (txt.match(/rom your week/g)||[]).length>=2);
    await p2.close();
  });

  await section("Act it out: a real conversation with the AI", async()=>{
    await p.click('#nav-practice'); await p.waitForTimeout(200);
    await p.click('#themegrid .theme'); await p.waitForTimeout(700);
    ok("a scene comes back from the AI", /The plumber's second visit/.test(await p.textContent('#scene-body')));
    await p.click('#scene-body .mode:has-text("Act it out")'); await p.waitForTimeout(200);
    await p.fill('#chat-text','Hi, the sink is leaking again.'); await p.click('#btn-send'); await p.waitForTimeout(600);
    ok("the partner answers what you said", /A leak again\? Let me take a look under the sink\./.test(await p.textContent('#thread')));
    const last=SEEN[SEEN.length-1];
    ok("the chat is sent as turns: the brief, the first line (assistant), then you", last.messages[0].role==="user" && /You are playing a part/.test(last.messages[0].content) && last.messages[1].role==="assistant" && last.messages[2].content==="Hi, the sink is leaking again.");
    ok("…and plain text, not JSON mode", !last.response_format);
    await p.click('#btn-back-scene2').catch(()=>{}); await p.click('#nav-practice'); await p.waitForTimeout(200);
  });

  await section("Forget my key", async()=>{
    await help(p);
    await p.click('#own-forget'); await p.waitForTimeout(150);
    ok("the first click asks to be sure (in the page, no browser pop-up)", (await p.textContent('#own-forget'))==="Forget it? Click again");
    ok("…and nothing is forgotten yet", JSON.parse(await p.evaluate(()=>localStorage.getItem('ss.own.v1'))).key===GOOD);
    await p.click('#own-forget'); await p.waitForTimeout(900);
    const cfg=JSON.parse(await p.evaluate(()=>localStorage.getItem('ss.own.v1')));
    ok("the second click removes the key from this browser", !cfg.key);
    ok("…but keeps the service and model, to make a new start easier", cfg.service==="openrouter" && cfg.model==="openai/gpt-5.4-mini");
    ok("the setup card is back, with OpenRouter still chosen and the key field empty", (await p.isVisible('#blocked .ownkey')) && (await p.inputValue('#own-svc'))==="openrouter" && (await p.inputValue('#own-key'))==="");
    await p.click('#nav-cards'); await p.waitForTimeout(300);
    ok("your cards are still there", /rom your week/.test(await p.textContent('#v-cards')));
    await p.click('#nav-practice');
  });

  await section("Other services: no JSON mode, code fences, a service that refuses web pages", async()=>{
    await setup(p,'other',GOOD,'some-model','https://blocked.example/v1');
    ok("a service that refuses requests from web pages gets a clear message", /may not accept requests from web pages/.test(await p.textContent('#own-msg')));
    await setup(p,'other',GOOD,'some-model','https://plain.example/v1/');
    await p.waitForTimeout(1200);
    ok("a custom address is saved without the trailing slash problem", (await p.isVisible('#blocked .ownkey'))===false && SEEN[SEEN.length-1].__path==="/v1/chat/completions");
    const n0=SEEN.length;
    await p.fill('#ownseed','Last week he fix my bike in the park.');
    await p.click('#btn-own-check'); await p.waitForTimeout(800);
    const tries=SEEN.slice(n0);
    ok("when the service refuses JSON mode, SS asks once more without it", tries.length===2 && !!tries[0].response_format && !tries[1].response_format);
    ok("…and reads the JSON even inside a code fence", /he fixed/.test(await p.textContent('#story-out')));
  });

  await section("Change service from Help", async()=>{
    await p.click('#nav-practice'); await help(p);
    await p.click('#own-change'); await p.waitForTimeout(150);
    ok("Change opens the setup inside Help, with the current settings", (await p.isVisible('#own-help .ownkey')) && (await p.inputValue('#own-svc'))==="other" && (await p.inputValue('#own-base'))==="https://plain.example/v1/");
    ok("…including a typed model name, shown in its text field", (await p.inputValue('#own-model-pick'))==="__type" && (await p.isVisible('#own-model')) && (await p.inputValue('#own-model'))==="some-model");
    await p.click('#own-cancel'); await p.waitForTimeout(100);
    ok("Cancel goes back to the summary line", /Your AI service: Other/.test(await p.textContent('#own-help')));
  });

  ok("no page errors ("+errs.slice(0,2).join(" | ")+")", errs.length===0);
  await b.close(); srv.close();
})();
