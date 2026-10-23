// v42 (Siyy, 23 Oct): Spot it set "pull someone aside" in a team chat message, and the model answer read "could I pull you aside
// for a quick chat later today?". Correct, but not how people say it: you pull someone aside face to face, in the moment.
// Now the scene request says to match how the expression is done (face to face or in writing), and Claude checks its own scene
// first (Siyy's idea): a draft, one sentence a native speaker would really say there, "does it feel right?", then the final scene.
// Only the final scene is shown. The draft and the sentence (it has the word in it) never reach the page.
const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/", NOW=Date.now();
const W=(term,extra)=>Object.assign({createdAt:NOW-3600000,term,kind:"phrase",meaning:"meaning of "+term,usage:"",example:"An example with "+term+".",theme:"At Work",level:"B2",fromScene:"",reg:{level:"neutral",domain:"work"}},extra||{});
const ASIDE=W("pull someone aside",{meaning:"to take someone away from a group to talk to them privately",example:"After the meeting, my manager pulled me aside."});
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const errs=[];
  let p;
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const open=async(docs)=>{
    if(p) await p.close();
    p=await b.newPage({viewport:{width:1280,height:900}}); p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
    await p.goto(URL);
    await p.evaluate(([d,P])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); localStorage.setItem('ss.dueHidden',JSON.stringify({spot:'x'})); },[docs,P]);
    await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700);
    await p.mouse.move(0,0);
  };
  const spot=async()=>{ await p.click('#nav-words'); await p.waitForTimeout(300); await p.click('#spot-open'); await p.click('#spot-start'); await p.waitForTimeout(700); };
  const prompts=k=>p.evaluate(()=>window.__prompts||[]).then(xs=>xs.filter(x=>x.includes(k)));
  /* everything the page holds, shown or not: the text and every attribute (not the scripts, where the stand-in itself lives) */
  const leaked=()=>p.evaluate(()=>{ const c=document.body.cloneNode(true); c.querySelectorAll('script').forEach(x=>x.remove()); const h=c.outerHTML+document.title; return ["DRAFTCHAT","NATIVELINE","DRAFTBAD"].filter(m=>h.includes(m)); });

  await section("the scene request: match how it's done, and check before the learner sees it", async()=>{
    await open({"terms/a":ASIDE}); await spot();
    const req=(await prompts("SPOT IT — SITUATIONS")).pop()||"";
    ok("it says some expressions are face to face, with pull someone aside as the example", req.includes("MATCH HOW IT'S DONE") && req.includes("face to face") && req.includes("pull someone aside, catch someone's eye"));
    ok("…and some only work in writing", req.includes("Some only work in writing"));
    ok("…and a chat SETTING moves to a spoken moment with the same people", req.includes("if it is an email or chat but the expression only works face to face, keep the same people and move to a spoken moment"));
    ok("it asks for a draft, one native line, feelsRight, then the final situation", req.includes("CHECK IT BEFORE THE LEARNER SEES IT") && req.includes('"nativeLine": ONE reply a native speaker would really say or write'));
    const shape=(req.match(/JSON shape: (.*)/)||[])[1]||"";
    const at=k=>shape.indexOf('"'+k+'"');
    ok("in the reply's shape they come in that order: draft, nativeLine, feelsRight, situation, replyType", at("draft")>0 && at("draft")<at("nativeLine") && at("nativeLine")<at("feelsRight") && at("feelsRight")<at("situation") && at("situation")<at("replyType"));
    ok("it says the learner never sees the draft or the line", req.includes("The learner never sees draft or nativeLine"));
  });

  await section("pull someone aside: a face-to-face scene, not a chat message", async()=>{
    await open({"terms/a":ASIDE}); await spot();
    const sit=await p.textContent('#spot-sit');
    ok("the scene is the fixed one, in the corridor ("+sit.slice(0,60)+"…)", sit.includes("in the corridor") && !sit.includes("team chat"));
    ok("you say it, you don't write a message", (await p.textContent('#spot-label'))==="What do you say?");
    ok("the draft and the native line are nowhere on the page ("+(await leaked()).join(", ")+")", (await leaked()).length===0);
    await p.click('#spot-stuck'); await p.waitForTimeout(300);
    ok("…not with the hint either", (await leaked()).length===0 && (await p.isVisible('#spot-hint')));
    await p.click('#spot-stuck'); await p.waitForTimeout(300);
    ok("…not on the bridge either, where the word is shown", (await leaked()).length===0 && (await p.isVisible('#spot-bridge')) && (await p.textContent('#spot-bridge')).includes("in the corridor"));
  });

  await section("spotted: the round keeps the final scene, and the model answer fits the reply", async()=>{
    await open({"terms/a":ASIDE}); await spot();
    await p.fill('#spot-reply','Wei Ling, could I pull you aside for a sec?'); await p.click('#spot-check'); await p.waitForTimeout(500);
    ok("spotted with no cue", await p.isVisible('#spot-result') && (await p.textContent('#spot-result h3'))==="✓ Spotted — no cue");
    const req=(await prompts("SPOT IT — CHECK")).pop()||"";
    ok("the check says the model answer is what a native speaker would really say, in person for pull someone aside", req.includes("MODEL REPLY:") && req.includes("what a native speaker would really say or write in this kind of reply") && req.includes("said in person, in the moment"));
    ok("the check is told it's a spoken reply", req.includes("REPLY TYPE: spoken reply"));
    const rec=await p.evaluate(P=>window.__mockdb()[P+"terms/a"].spot,P);
    const last=rec&&rec.history&&rec.history[rec.history.length-1];
    ok("the saved summary is the final scene's, so next time avoids the right one ("+(last&&last.sit)+")", last && last.sit==="corridor after stand-up");
    ok("nothing of the draft or the line is saved", !JSON.stringify(rec).includes("DRAFTCHAT") && !JSON.stringify(rec).includes("NATIVELINE"));
    ok("…or shown", (await leaked()).length===0);
  });

  await section("a reply with only a draft that felt right: the draft is used", async()=>{
    await open({"terms/a":W("only a draft")}); await spot();
    ok("the draft shows as the scene", (await p.textContent('#spot-sit')).includes("Your manager asks how the week went."));
  });

  await section("a draft that didn't feel right, with no fixed scene: no scene, nothing saved", async()=>{
    await open({"terms/a":W("no fix given")}); await spot();
    ok("the bad draft is not shown", (await leaked()).length===0 && !(await p.isVisible('#spot-sit')));
    /* the first word is fetched before the round starts, so the setup page says so and Start comes back */
    ok("it says it couldn't set up the round, and Start comes back", (await p.textContent('#spot-msg')).length>0 && await p.isEnabled('#spot-start'));
    const t=await p.evaluate(P=>window.__mockdb()[P+"terms/a"],P);
    ok("nothing is saved on the word", t && !t.spot);
  });

  await section("other words: the same scene as before", async()=>{
    await open({"terms/a":W("touch base")}); await spot();
    ok("the scene a word got before v42 is unchanged", (await p.textContent('#spot-sit')).includes("Your colleague Mei says the team just used a new tool"));
    ok("…and the line is not on the page", (await leaked()).length===0);
  });

  ok("no page errors ("+errs.join(" | ").slice(0,160)+")", errs.length===0);
  await b.close();
})();
