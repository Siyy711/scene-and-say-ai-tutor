const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/terms/", NOW=Date.now(), D=86400000;
const W=(term,extra)=>Object.assign({createdAt:NOW-3600000,term,kind:"phrase",meaning:"meaning of "+term,usage:"u",example:"An example with "+term+".",theme:"At Work",level:"B2",fromScene:""},extra||{});
/* r: spotted with no cue 3 times in a row, last time 2 days ago -> resting for 14 days.
   o: practised 3 days ago with no cue once -> resting for 4 days, practised LONGER ago than r. */
const R=()=>W("fire away",{spot:{last:"nocue",at:NOW-2*D,history:[{at:NOW-20*D,stage:"nocue"},{at:NOW-12*D,stage:"nocue"},{at:NOW-2*D,stage:"nocue",reply:"Sure, fire away."}]}});
const O=()=>W("touch base",{spot:{last:"nocue",at:NOW-3*D,history:[{at:NOW-3*D,stage:"nocue"}]}});
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const db=async()=>Object.fromEntries(Object.entries(await p.evaluate(()=>window.__mockdb())).filter(([k])=>k.includes('/terms/')).map(([k,v])=>[k.split('/').pop(),v]));
  const start=async(docs)=>{ await p.goto('about:blank'); await p.goto(URL); await p.evaluate(([d,P])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); },[docs,P]); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700); await p.click('#nav-words'); await p.waitForTimeout(150); };
  const tag=async(term)=>(await p.textContent('.wordbtn:has-text("'+term+'") .spottag')).trim();
  const firstWord=async()=>{ await p.click('#spot-open'); await p.click('#spot-n .chip >> text=1'); await p.click('#spot-start'); await p.waitForTimeout(600);
    const pr=(await p.evaluate(()=>window.__prompts)).filter(x=>x.includes("SPOT IT — SITUATIONS")); const last=pr[pr.length-1]||"";
    return last.includes('"fire away"')||last.includes('fire away')?"fire away":last.includes('touch base')?"touch base":"?"; };

  await section("Control: without a reset, the resting word stays resting", async()=>{
    await start({r:R(),o:O()});
    ok("tag before reset: spotted ✓", (await tag("fire away"))==="spotted ✓");
    ok("Spot it picks the word practised longer ago (touch base)", (await firstWord())==="touch base");
  });

  await section("Reset schedule", async()=>{
    await start({r:R(),o:O()});
    await p.click('.wordbtn:has-text("fire away")'); await p.waitForTimeout(150);
    ok("the button is in the word's Spot it practice section", await p.isVisible('.worddetail:visible .spotrec .spot-reset'));
    await p.click('.worddetail:visible .spot-reset'); await p.waitForTimeout(300);
    const d=await db();
    ok("saved: resetAt is set", Number(d.r.spot.resetAt)>=NOW);
    ok("the practice record stays (3 practices, your sentence kept)", d.r.spot.history.length===3 && d.r.spot.history[2].reply==="Sure, fire away.");
    ok("an Undo shows", await p.isVisible('#undo-btn'));
    ok("tag after reset: spot again", (await tag("fire away"))==="spot again");
    ok("the entry stays open and says 'Schedule reset — due now.'", (await p.textContent('.worddetail:visible .spotrec')).includes("Schedule reset — due now."));
    await p.goto('about:blank'); await p.goto(URL+'#db'); await p.waitForTimeout(700); await p.click('#nav-words'); await p.waitForTimeout(150);
    ok("after reload: still spot again", (await tag("fire away"))==="spot again");
    ok("Spot it now picks the reset word first", (await firstWord())==="fire away");
  });

  await section("The streak starts again after a reset", async()=>{
    const r=R(); r.spot.resetAt=NOW-60000;
    await start({r});
    await p.click('#spot-open'); await p.click('#spot-n .chip >> text=1'); await p.click('#spot-start'); await p.waitForTimeout(600);
    await p.fill('#spot-reply','Sure, fire away.'); await p.click('#spot-check'); await p.waitForTimeout(400);
    const d=await db(), h=d.r.spot.history, e=h[h.length-1];
    ok("the new practice is NOT marked extra practice", e.stage==="nocue" && !e.early);
    ok("resetAt is kept in the saved schedule", Number(d.r.spot.resetAt)===NOW-60000);
    await p.check('#spot-nw-box'); await p.waitForTimeout(300);
    ok("ticking 'needs work' keeps resetAt", Number((await db()).r.spot.resetAt)===NOW-60000);
  });

  await section("Only practices after the reset count toward the gap", async()=>{
    /* fire away: 3 no-cue spots, reset 6 days ago, then 1 no-cue spot 5 days ago.
       Counting from the reset, the streak is 1 -> 4-day gap -> due now. Counting everything, it is 4 -> 14 days -> resting.
       touch base: resting for 14 days, practised 6 days ago (longer ago than fire away). */
    const r=W("fire away",{spot:{last:"nocue",at:NOW-5*D,resetAt:NOW-6*D,history:[{at:NOW-30*D,stage:"nocue"},{at:NOW-20*D,stage:"nocue"},{at:NOW-10*D,stage:"nocue"},{at:NOW-5*D,stage:"nocue"}]}});
    const o=W("touch base",{spot:{last:"nocue",at:NOW-6*D,history:[{at:NOW-30*D,stage:"nocue"},{at:NOW-20*D,stage:"nocue"},{at:NOW-6*D,stage:"nocue"}]}});
    await start({r,o});
    ok("fire away is due again after 4 days, so Spot it picks it", (await firstWord())==="fire away");
  });

  await section("Undo puts the schedule back", async()=>{
    await start({r:R(),o:O()});
    await p.click('.wordbtn:has-text("fire away")'); await p.waitForTimeout(150);
    await p.click('.worddetail:visible .spot-reset'); await p.waitForTimeout(300);
    await p.click('#undo-btn'); await p.waitForTimeout(300);
    const d=await db();
    ok("no reset in the saved data", !Number(d.r.spot.resetAt));
    ok("tag back to spotted ✓, and the button is back", (await tag("fire away"))==="spotted ✓" && await p.isVisible('.worddetail:visible .spot-reset'));
    ok("Spot it again picks touch base (fire away is resting)", (await firstWord())==="touch base");
  });

  await section("No button for a word never practised", async()=>{
    await start({n:W("park")});
    await p.click('.wordbtn:has-text("park")'); await p.waitForTimeout(150);
    ok("no Reset schedule", (await p.$$('.worddetail:visible .spot-reset')).length===0);
  });

  ok("no page errors ("+errs.join(" | ").slice(0,120)+")", errs.length===0);
  await b.close();
})();
