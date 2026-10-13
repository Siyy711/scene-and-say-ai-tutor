const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/", NOW=Date.now(), H=3600000;
const W=(term,ago,extra)=>Object.assign({createdAt:NOW-ago*H,term,kind:"phrase",meaning:"meaning of "+term,usage:"u",example:"An example with "+term+".",theme:"At Work",level:"B2",fromScene:""},extra||{});
const BANK={a:W("pull the plug on something",1),b:W("pull back",2),c:W("hold off on something",3),d:W("park",4),
  e:W("hold",5,{deep:{summary:"s",confusedWith:[{other:"organise",difference:"organise = plan it; hold = it takes place"}]}})};
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const start=async(terms,extra)=>{ await p.goto('about:blank'); await p.goto(URL); await p.evaluate(([d,x,P])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+"terms/"+k]=d[k]; for(const k in (x||{})) o[P+k]=x[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); },[terms,extra||{},P]); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700); };
  const db=async(coll)=>Object.fromEntries(Object.entries(await p.evaluate(()=>window.__mockdb())).filter(([k])=>k.startsWith(P+coll+"/")).map(([k,v])=>[k.slice((P+coll+"/").length),v]));
  const prompts=async(tag)=>(await p.evaluate(()=>window.__prompts)).filter(x=>x.includes(tag));
  const openCompare=async()=>{ await p.click('#nav-compare'); await p.waitForTimeout(200); };

  await section("A Compare page of its own", async()=>{
    await start(BANK);
    ok("a Compare tab next to Words and Cards", await p.isVisible('#nav-compare'));
    await openCompare();
    ok("it opens its own page", await p.isVisible('#v-compare') && !(await p.isVisible('#v-words')) && (await p.getAttribute('#nav-compare','aria-current'))==="true");
    ok("empty state explains the three ways in", (await p.textContent('#cmp-list')).includes("Find pairs"));
    ok("7 suggested preposition sets, none added by themselves", (await p.$$('#cmp-suggested .cmp-add-prep')).length===7 && Object.keys(await db("sets")).length===0);
  });

  await section("Find pairs: from your words, you confirm", async()=>{
    await start(BANK);
    await openCompare();
    await p.click('#cmp-find'); await p.waitForTimeout(400);
    const fp=(await prompts("COMPARE — FIND PAIRS"))[0]||"";
    ok("Claude gets your word bank with meanings", fp.includes("pull back — meaning of pull back") && fp.includes("park — meaning of park"));
    const found=await p.$$eval('#cmp-found .cmp-sug b',bs=>bs.map(b=>b.textContent));
    ok("suggestions shown, nothing saved yet ("+found.join(" / ")+")", found.includes("pull the plug on something · pull back") && Object.keys(await db("sets")).length===0);
    ok("a set with a word that's NOT in your bank is dropped (Claude invented it)", !found.some(x=>x.includes("made-up")));
    ok("source 2: 'Don't confuse it with' pairs are offered too", found.includes("hold · organise") && (await p.textContent('#cmp-found')).includes("Not in your word bank: organise"));
    await p.click('#cmp-found .cmp-sug:has-text("pull the plug") .cmp-yes'); await p.waitForTimeout(400);
    let sets=Object.values(await db("sets"));
    ok("Add → saved as a set", sets.length===1 && sets[0].words.join("|")==="pull the plug on something|pull back" && sets[0].kind==="words" && sets[0].source==="find");
    ok("…and its explanation is written and saved", sets[0].explain && sets[0].explain.core.includes("pull the plug") && sets[0].explain.uses.length===2);
    await p.click('#cmp-found .cmp-sug:has-text("hold off on") .cmp-no'); await p.waitForTimeout(200);
    ok("Not a pair → gone from the list, and remembered", !(await p.textContent('#cmp-found')).includes("hold off on") && JSON.stringify(await db("meta")).includes("hold off on something|park"));
    await p.click('#cmp-find'); await p.waitForTimeout(400);
    const fp2=(await prompts("COMPARE — FIND PAIRS")).pop();
    ok("next time Claude is told what you rejected and what you already have", fp2.includes("REJECTED") && fp2.includes("hold off on something + park") && fp2.includes("ALREADY COMPARED") && fp2.includes("pull the plug on something · pull back"));
    const found2=await p.$$eval('#cmp-found .cmp-sug b',bs=>bs.map(b=>b.textContent));
    ok("…and neither comes back", !found2.some(x=>x.includes("hold off on")) && !found2.includes("pull the plug on something · pull back"));
  });

  await section("A set opens to its explanation", async()=>{
    await start(BANK,{"sets/s1":{createdAt:NOW,updatedAt:NOW,words:["park","hold off on something"],kind:"words",topic:"",source:"own",
      explain:{core:"Park = set a topic aside; hold off = wait before acting.",uses:[{word:"park",when:"topics in a meeting",example:"Let's park that for now."},{word:"hold off on something",when:"actions you delay",example:"Hold off on ordering."}]}}});
    await openCompare();
    ok("the set is listed with its core difference", (await p.textContent('.setrow[data-id="s1"]')).includes("Park = set a topic aside"));
    await p.click('.setrow[data-id="s1"] .wordbtn'); await p.waitForTimeout(150);
    const d=await p.textContent('.setrow[data-id="s1"] .setdetail');
    ok("open: when to use each, and an example each", d.includes("topics in a meeting") && d.includes("Let's park that for now.") && d.includes("Hold off on ordering."));
  });

  await section("Suggested preposition sets", async()=>{
    await start(BANK);
    await openCompare();
    await p.click('#cmp-suggested .cmp-sug:has-text("(time)") .cmp-add-prep'); await p.waitForTimeout(400);
    const s=Object.values(await db("sets"));
    ok("Add → a prepositions set with its topic", s.length===1 && s[0].kind==="prepositions" && s[0].topic==="time" && s[0].words.join(" ")==="at on in");
    const ex=(await prompts("COMPARE — EXPLAIN")).pop()||"";
    ok("the explanation request is about that use only", ex.includes("TOPIC: time"));
    ok("the time set leaves the suggestions; the place set (same words) stays", (await p.$$('#cmp-suggested .cmp-add-prep')).length===6 && (await p.textContent('#cmp-suggested')).includes("(place)"));
  });

  await section("Your own set", async()=>{
    await start(BANK);
    await openCompare();
    await p.click('#cmp-new-open'); await p.fill('#cmp-new-words','bolt on'); await p.click('#cmp-new-go'); await p.waitForTimeout(200);
    ok("one word → 'needs at least 2'", (await p.textContent('#cmp-new-msg')).includes("at least 2"));
    await p.fill('#cmp-new-words','a, b, c, d, e'); await p.click('#cmp-new-go'); await p.waitForTimeout(200);
    ok("five words → 'up to 4'", (await p.textContent('#cmp-new-msg')).includes("up to 4"));
    await p.fill('#cmp-new-words','bolt on, integrate, retrofit'); await p.click('#cmp-new-go'); await p.waitForTimeout(400);
    const s=Object.values(await db("sets"));
    ok("three words → saved, words not in your bank are fine", s.length===1 && s[0].words.join("|")==="bolt on|integrate|retrofit" && s[0].source==="own");
    ok("the new set opens with its explanation", (await p.textContent('.setrow .setdetail:visible')).includes("bolt on"));
    await p.click('#cmp-new-open'); await p.fill('#cmp-new-words','Retrofit, integrate, bolt on'); await p.click('#cmp-new-go'); await p.waitForTimeout(200);
    ok("the same set again (any order) → 'already have'", (await p.textContent('#cmp-new-msg')).includes("already have") && Object.keys(await db("sets")).length===1);
  });

  await section("A broken explanation can be written again", async()=>{
    await start(BANK);
    await openCompare();
    await p.click('#cmp-new-open'); await p.fill('#cmp-new-words','brokenword, other'); await p.click('#cmp-new-go'); await p.waitForTimeout(400);
    ok("the set is kept, with a 'Write the explanation' button", Object.keys(await db("sets")).length===1 && await p.isVisible('.cmp-explain'));
    await p.click('.cmp-explain'); await p.waitForTimeout(400);
    ok("second try works", !!Object.values(await db("sets"))[0].explain);
  });

  await section("The Compare button in a word's entry", async()=>{
    await start(BANK);
    await p.click('#nav-words'); await p.waitForTimeout(150);
    await p.click('.wgroup[data-root="hold"] .wgroup-head'); await p.waitForTimeout(100);   /* hold + hold off on = a group */
    const row='.wordrow[data-id="e"]';
    await p.click(row+' .wordbtn'); await p.waitForTimeout(100);
    await p.click(row+' .cmp-open'); await p.waitForTimeout(400);
    const fp=(await prompts("COMPARE — FIND PAIRS")).pop()||"";
    ok("Claude looks for close words to THIS word", fp.includes("FOCUS: hold — meaning of hold"));
    const cands=await p.$$eval(row+' .cmp-cand b',bs=>bs.map(b=>b.textContent));
    ok("candidates: the 'Don't confuse it with' word and close words ("+cands.join(", ")+")", cands.includes("organise") && cands.includes("integrate") && cands.includes("pull the plug on something"));
    ok("sets without this word are not offered", !cands.includes("pull back") && !cands.includes("hold off on something"));
    await p.check(row+' .cmp-cand:has-text("organise") input'); await p.fill(row+' .cmp-own','arrange'); await p.click(row+' .cmp-make'); await p.waitForTimeout(400);
    const s=Object.values(await db("sets"));
    ok("Create set → hold + ticked + typed, and you land on Compare", s.length===1 && s[0].words.join("|")==="hold|organise|arrange" && s[0].source==="entry" && s[0].fromTerm==="e" && await p.isVisible('#v-compare'));
  });

  await section("Delete a set (with Undo)", async()=>{
    await start(BANK,{"sets/s1":{createdAt:NOW,words:["park","pull back"],kind:"words",topic:"",source:"own",explain:{core:"c",uses:[]}}});
    await openCompare();
    await p.click('.setrow[data-id="s1"] .trash'); await p.click('#confirm-yes'); await p.waitForTimeout(300);
    ok("deleted after confirm", Object.keys(await db("sets")).length===0);
    await p.click('#undo-btn'); await p.waitForTimeout(300);
    ok("Undo puts it back", Object.keys(await db("sets")).length===1);
  });

  await section("Your words are not changed", async()=>{
    await start(BANK);
    const before=JSON.stringify(await db("terms"));
    await openCompare(); await p.click('#cmp-find'); await p.waitForTimeout(400);
    await p.click('#cmp-found .cmp-yes'); await p.waitForTimeout(400);
    ok("word bank identical after making a set", JSON.stringify(await db("terms"))===before);
  });

  ok("no page errors ("+errs.join(" | ").slice(0,160)+")", errs.length===0);
  await b.close();
})();
