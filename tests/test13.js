const {chromium}=require(process.env.PW||'playwright');
const fs=require('fs');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/preview-mock.html';
const P="data/users/u_test/store/";
const NOW=Date.now();
const BOLT=Object.assign(JSON.parse(fs.readFileSync('fixture-bolt-v3.json','utf8')),
  {spot:{last:"hint",at:NOW-3*86400000,history:Array.from({length:10},(_, i)=>({at:NOW-(20-i)*86400000,stage:"hint"}))}});
const PIC="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
const W=(term,extra)=>Object.assign({createdAt:NOW-3600000,term,kind:"phrase",meaning:"meaning of "+term,usage:"u",example:"An example with "+term+".",theme:"At Work",level:"B2",fromScene:""},extra||{});
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1200}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  /* v38: opening a word also asks how to say it, so this reads the last request that is NOT that one */
  const last=()=>p.evaluate(()=>window.__prompts.filter(x=>x.indexOf("HOW TO SAY IT.")!==0).slice(-1)[0]);
  const db=async()=>Object.fromEntries(Object.entries(await p.evaluate(()=>window.__mockdb())).filter(([k])=>k.includes('/terms/')).map(([k,v])=>[k.split('/').pop(),v]));
  const start=async(docs)=>{ await p.goto('about:blank'); await p.goto(URL); await p.evaluate(([d,P])=>{ localStorage.clear(); localStorage.setItem('ss.occupation','supply chain consultant'); localStorage.setItem('ss.life','gym three times a week'); const o={}; for(const k in d) o[P+"terms/"+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); },[docs,P]); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700); await p.click('#nav-words'); await p.waitForTimeout(150); };
  const answer=async(text)=>{ await p.fill('#spot-reply',text); await p.click('#spot-check'); await p.waitForTimeout(400); };

  console.log("— Empty word bank —");
  await start({});
  ok("Spot it button is there but disabled", await p.isVisible('#spot-open') && await p.isDisabled('#spot-open'));

  console.log("— Setup and picking —");
  await start({"tmuz4wawt92qj":BOLT,"tFire":W("fire away",{situation:"Saved from a chat on 7 Oct.",pic:"p1"}),"tWork":W("work for me")});
  await p.evaluate(([k,v])=>{ const d=window.__mockdb(); d[k]=v; localStorage.setItem('__mockdb',JSON.stringify(d)); },[P+"pics/p1",{createdAt:NOW,termId:"tFire",data:PIC}]);
  ok("Spot it is a main button at the top of Words", await p.isEnabled('#spot-open') && (await p.getAttribute('#spot-open','class')).includes("btn small") && !(await p.getAttribute('#spot-open','class')).includes("ghost"));
  await p.click('#spot-open'); await p.waitForTimeout(150);
  ok("asks how many (1–3)", (await p.$$('#spot-n .chip')).length===3);
  ok("choose page doesn't announce missed words (v15)", !/missed/i.test(await p.textContent('#v-spot')) && (await p.textContent('#spot-due')).includes("due come first"));
  ok("Words tab stays highlighted", (await p.getAttribute('#nav-words','aria-current'))==="true");
  const before=(await p.evaluate(()=>window.__prompts.length));
  await p.click('#spot-n .chip >> text=3'); await p.click('#spot-start'); await p.waitForTimeout(600);
  /* v16: one request per word, made in round order (the next one is fetched while you work) */
  const sitReqs=async()=>(await p.evaluate(b=>window.__prompts.slice(b),before)).filter(x=>x.includes("SPOT IT — SITUATIONS"));
  const termOf=x=>((x.match(/ITEM 0: ([^—\n]+)/)||[])[1]||"").trim();
  const sp=(await sitReqs())[0];
  ok("situations request: rules + your life", sp.includes("Do NOT use the expression") && sp.includes("DIFFERENT from where they met it") && sp.includes("gym three times a week") && sp.includes("supply chain consultant"));
  const order=[];
  let d;
  /* The order is random now (v15), so handle each word by what it is. */
  for(let k=0;k<3;k++){
    if(k>0){ await p.click('#spot-next'); await p.waitForTimeout(300); }
    const w=termOf((await sitReqs())[k]); order.push(w);
    if(w==="bolt"){
      console.log("— bolt: no cue → hint → bridge —");
      let sit=await p.textContent('#spot-sit');
      ok("situation never shows the word, even when Claude leaks it ('bolted' → ____)", !/bolt/i.test(sit) && sit.includes("____"));
      ok("no model reply before you answer", await p.isHidden('#spot-model'));
      await answer("I think it's fine to add it.");
      ok("missed → the hint appears", await p.isVisible('#spot-hint'));
      const hint=await p.textContent('#spot-hint');
      ok("hint = your own sentence, with the word hidden (v15: Claude-written)", hint.includes("Your sentence: Existing factories do ____ AI onto old layouts") && !/bolt/i.test(hint));
      ok("still no model reply", await p.isHidden('#spot-model'));
      await answer("We could just add AI to it.");
      ok("missed again → the bridge appears", await p.isVisible('#spot-bridge'));
      const br=await p.textContent('#spot-bridge');
      ok("bridge shows the word, its meaning, both situations and why", br.includes("bolt") && br.includes("without redesigning") && br.includes("Where you met it") && br.includes("This situation") && br.includes("adding something on top"));
      ok("bridge asks you to try again, using the word", (await p.textContent('#v-spot')).includes("Now try again, using “bolt”"));
      ok("model reply still hidden until you retry", await p.isHidden('#spot-model'));
      await p.screenshot({path:'v13-bridge.png',fullPage:true});
      await answer("Honestly, they just bolted AI onto the old system.");
      ok("after the retry: result + model reply", (await p.textContent('#spot-result')).includes("Bridge done") && await p.isVisible('#spot-model'));
      d=await db();
      ok("bolt recorded as 'bridge'", d.tmuz4wawt92qj.spot.last==="bridge");
      ok("history keeps only the last 10", d.tmuz4wawt92qj.spot.history.length===10 && d.tmuz4wawt92qj.spot.history[9].stage==="bridge");
      ok("the deep dive on bolt is untouched", !!d.tmuz4wawt92qj.deep && !!d.tmuz4wawt92qj.deep.summary);
    } else if(w==="fire away"){
      console.log("— fire away: spotted with no cue —");
      await answer("Sure, fire away — and Tuesday works for me.");
      ok("✓ Spotted — no cue", (await p.textContent('#spot-result')).includes("Spotted — no cue"));
      ok("check request has the situation, the step and your reply", (await last()).includes("STEP: nocue") && (await last()).includes('REPLY: """Sure, fire away'));
    } else {
      console.log("— work for me: stuck → hint → an equally good phrase —");
      await p.click('#spot-stuck'); await p.waitForTimeout(150);
      ok("'I'm stuck' shows the hint", await p.isVisible('#spot-hint'));
      await answer("We'd just tack on another step.");
      const r3=await p.textContent('#spot-result');
      ok("equally good phrase counts as spotted (with the hint)", r3.includes("Spotted — with the hint") && r3.includes("works just as well"));
    }
  }

  ok("the round had all three due words (the missed bolt included): "+order.join(","), order.slice().sort().join()==="bolt,fire away,work for me");
  console.log("— Round summary —");
  await p.click('#spot-next'); await p.waitForTimeout(150);
  const sum=await p.textContent('#spot-summary');
  ok("summary lists each word and its step", sum.includes("bolt") && sum.includes("bridge — comes back next time") && sum.includes("no cue ✓") && sum.includes("with the hint"));
  d=await db();
  ok("all three recorded", ["tmuz4wawt92qj","tFire","tWork"].every(k=>d[k].spot && d[k].spot.last));
  await p.click('#spot-back'); await p.waitForTimeout(200);
  ok("word rows show their status", await p.isVisible('.wordrow:has-text("bolt") .spottag.again') && (await p.$$('.spottag')).length===3);
  await p.screenshot({path:'v13-words.png',fullPage:true});

  console.log("— Hint with a picture, and the meaning fallback —");
  await start({"tFire":W("fire away",{situation:"Heard it on Suits, when Harvey says fire away.",pic:"p1",spot:{last:"bridge",at:NOW-2*86400000,history:[]}})});
  await p.evaluate(([k,v])=>{ const d=window.__mockdb(); d[k]=v; localStorage.setItem('__mockdb',JSON.stringify(d)); },[P+"pics/p1",{createdAt:NOW,termId:"tFire",data:PIC}]);
  await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700); await p.click('#nav-words');
  await p.click('#spot-open'); await p.click('#spot-n .chip >> text=1'); await p.click('#spot-start'); await p.waitForTimeout(500);
  await p.click('#spot-stuck'); await p.waitForTimeout(400);
  const h2=await p.textContent('#spot-hint');
  ok("hint hides a multi-word phrase too ('fire away' → ____)", h2.includes("Harvey says ____ to a client") && !/fire away/i.test(h2));
  /* changed on purpose in v43 (Siyy, 23 Oct): the hint showed your picture (v13), but a saved picture is often a screenshot
     with the word in it, so it gave the answer away. Now the picture is never on the page before the bridge, and shows there. */
  ok("hint does not show your picture (it can show the word)", (await p.$$('#v-spot img')).length===0 && !(await p.evaluate(()=>document.querySelector('#v-spot').innerHTML.includes('data:image'))));
  await p.click('#spot-stuck'); await p.waitForTimeout(400);
  ok("'Still stuck' goes to the bridge", await p.isVisible('#spot-bridge'));
  ok("…and the bridge shows your picture, under where you met it", await p.isVisible('#spot-bridge .spot-col .word-pic img'));
  await start({"tPlain":W("loop in")});
  await p.click('#spot-open'); await p.click('#spot-start'); await p.waitForTimeout(500); await p.click('#spot-stuck'); await p.waitForTimeout(150);
  ok("no hint from Claude → your own sentence, word hidden (v15; the meaning fallback is tested in test15)", (await p.textContent('#spot-hint')).includes("Your sentence:") && (await p.textContent('#spot-hint')).includes("An example with ____."));

  console.log("— Phone width —");
  await p.setViewportSize({width:390,height:844}); await p.click('#spot-stuck'); await p.waitForTimeout(150);
  ok("no sideways scroll on a phone (bridge view)", !(await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)));
  await p.screenshot({path:'v13-phone.png',fullPage:true});
  ok("no page errors: "+errs.join(" | "), errs.length===0);
  await b.close();
})();
