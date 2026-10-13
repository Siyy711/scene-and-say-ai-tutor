const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/preview-mock.html';
const P="data/users/u_test/store/terms/", NOW=Date.now(), D=86400000;
const W=(term,extra)=>Object.assign({createdAt:NOW-3600000,term,kind:"phrase",meaning:"meaning of "+term,usage:"u",example:"An example with "+term+".",theme:"At Work",level:"B2",fromScene:""},extra||{});
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const prompts=()=>p.evaluate(()=>window.__prompts);
  const db=async()=>Object.fromEntries(Object.entries(await p.evaluate(()=>window.__mockdb())).filter(([k])=>k.includes('/terms/')).map(([k,v])=>[k.split('/').pop(),v]));
  const start=async(docs)=>{ await p.goto('about:blank'); await p.goto(URL); await p.evaluate(([d,P])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); },[docs,P]); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700); await p.click('#nav-words'); await p.waitForTimeout(150); };
  const sitPrompts=async()=>(await prompts()).filter(x=>x.includes("SPOT IT — SITUATIONS"));

  await section("One word per request", async()=>{
    await start({a:W("fire away"),b:W("work for me"),c:W("touch base")});
    await p.click('#spot-open'); await p.click('#spot-n .chip >> text=3'); await p.click('#spot-start'); await p.waitForTimeout(700);
    const sp=await sitPrompts();
    ok("every scene request asks for exactly ONE word ("+sp.length+" requests so far)", sp.length>=1 && sp.every(x=>(x.match(/\nITEM \d+: /g)||[]).length===1));
    ok("the first scene is on screen", await p.isVisible('#spot-sit'));
    ok("the next word was fetched in the background (2 requests)", sp.length===2);
    await p.fill('#spot-reply','Fire away, and Tuesday works for me, let us touch base.'); await p.click('#spot-check'); await p.waitForTimeout(400);
    await p.click('#spot-next'); await p.waitForTimeout(300);
    ok("moving on: the next scene appears straight away (already fetched)", await p.isVisible('#spot-sit'));
  });

  await section("A reply that breaks: Try again", async()=>{
    await start({x:W("broken")});
    await p.click('#spot-open'); await p.click('#spot-start'); await p.waitForTimeout(500);
    ok("the error shows, and Start can be pressed again", (await p.textContent('#spot-msg')).length>0 && await p.isEnabled('#spot-start'));
    await p.click('#spot-start'); await p.waitForTimeout(500);
    ok("second try works", await p.isVisible('#spot-sit'));
  });

  await section("Your sentence, the feedback and the better version are kept", async()=>{
    await start({f:W("fire away",{spot:{last:"hint",at:NOW-3*D,history:[{at:NOW-3*D,stage:"hint"}]}})});
    await p.click('#spot-open'); await p.click('#spot-start'); await p.waitForTimeout(500);
    await p.fill('#spot-reply','Sure, fire away.'); await p.click('#spot-check'); await p.waitForTimeout(400);
    const d=await db(); const e=d.f.spot.history[d.f.spot.history.length-1];
    ok("saved: your sentence", e.reply==="Sure, fire away.");
    ok("saved: feedback and the more natural version", !!e.feedback && !!e.model);
    await p.click('#spot-next'); await p.click('#spot-back'); await p.waitForTimeout(200);
    await p.click('.wordbtn:has-text("fire away")'); await p.waitForTimeout(150);
    const rec=await p.textContent('.worddetail:visible .spotrec');
    ok("the word's entry shows 'Spot it practice' with Practice 1 and 2", rec.includes("Spot it practice") && (await p.$$('.worddetail:visible .spotrec .chip')).length===2);
    ok("the latest practice is shown: what you wrote, feedback, more natural", rec.includes("What you wrote: Sure, fire away.") && rec.includes("Feedback:") && rec.includes("More natural:"));
    await p.click('.worddetail:visible .spotrec .chip >> text=Practice 1'); await p.waitForTimeout(100);
    ok("an older practice (result only) says so", (await p.textContent('.worddetail:visible .spotrec')).includes("Only the result was saved"));
    ok("switching chips keeps the entry open", await p.isVisible('.worddetail:visible .spotrec'));
  });

  await section("You decide 'needs work'", async()=>{
    await start({m:W("mock",{spot:{last:"nocue",at:NOW-8*D,history:[{at:NOW-15*D,stage:"nocue"},{at:NOW-8*D,stage:"nocue"}]}})});
    await p.click('#spot-open'); await p.click('#spot-start'); await p.waitForTimeout(500);
    await p.fill('#spot-reply','They mocked me the API.'); await p.click('#spot-check'); await p.waitForTimeout(400);
    ok("after a spot: the option is there, unticked", await p.isVisible('#spot-nw') && !(await p.isChecked('#spot-nw-box')));
    ok("SS does not decide for you: the result says spotted", (await p.textContent('#spot-result')).includes("Spotted — no cue"));
    await p.check('#spot-nw-box'); await p.waitForTimeout(300);
    let d=await db(); let h=d.m.spot.history;
    ok("ticked → this practice is saved as 'not right'", h[h.length-1].right===false);
    await p.uncheck('#spot-nw-box'); await p.waitForTimeout(300);
    d=await db(); h=d.m.spot.history;
    ok("unticked again → back to normal", h[h.length-1].right===undefined);
    await p.check('#spot-nw-box'); await p.waitForTimeout(300);
    await p.click('#spot-next'); await p.waitForTimeout(150);
    ok("round summary says 'needs work — back tomorrow'", (await p.textContent('#spot-summary')).includes("needs work — back tomorrow"));
    await p.click('#spot-back'); await p.waitForTimeout(150);
    ok("the word row says 'needs work'", (await p.textContent('.wordrow:has-text("mock") .spottag'))==="needs work");
  });

  await section("Schedule for 'needs work'", async()=>{
    const pick1=async(docs)=>{ await start(docs); await p.click('#spot-open'); await p.click('#spot-n .chip >> text=1'); await p.click('#spot-start'); await p.waitForTimeout(500); const sp=(await sitPrompts()).pop(); return (sp.match(/ITEM 0: ([^—\n]+)/)||[])[1].trim(); };
    /* alpha: 'needs work' 1.5 days ago -> due after 1 day. beta: a plain no cue, practised earlier (2 days ago) -> resting.
       Without the rule, both rest and SS would pick beta (practised longest ago). */
    let w=await pick1({a:W("alpha",{spot:{last:"nocue",at:NOW-1.5*D,history:[{at:NOW-1.5*D,stage:"nocue",right:false}]}}),
                       b:W("beta",{spot:{last:"nocue",at:NOW-2*D,history:[{at:NOW-2*D,stage:"nocue"}]}})});
    ok("'needs work' comes back after 1 day (picked "+w+")", w==="alpha");
    /* gamma: no cue, 'needs work', no cue (5 days ago): the streak restarted at 1 -> 4 days -> due.
       delta: two no-cues in a row (last 6 days ago) -> 7 days -> resting. Without the restart, gamma would rest too and delta (older) would be picked. */
    w=await pick1({c:W("gamma",{spot:{last:"nocue",at:NOW-5*D,history:[{at:NOW-20*D,stage:"nocue"},{at:NOW-12*D,stage:"nocue",right:false},{at:NOW-5*D,stage:"nocue"}]}}),
                   d:W("delta",{spot:{last:"nocue",at:NOW-6*D,history:[{at:NOW-14*D,stage:"nocue"},{at:NOW-6*D,stage:"nocue"}]}})});
    ok("after 'needs work' the no-cue streak starts again (picked "+w+")", w==="gamma");
  });

  await section("'Go deeper' without 'Seen in the wild'", async()=>{
    await start({g:W("caveat",{deep:{summary:"S.",register:"R.",collocations:["x"],confusedWith:[],contexts:[],citations:[{quote:"Q",source:"S"}]}}),h:W("tune")});
    await p.click('.wordbtn:has-text("caveat")'); await p.waitForTimeout(150);
    ok("an old deep dive no longer shows 'Seen in the wild'", !(await p.textContent('.worddetail:visible')).includes("Seen in the wild"));
    await p.click('.wordbtn:has-text("tune")'); await p.waitForTimeout(150);
    await p.click('.worddetail:visible >> text=Go deeper'); await p.waitForTimeout(400);
    const dp=(await prompts()).filter(x=>x.includes("careful lexicographer")).pop();
    ok("the deep request no longer asks for quotations", dp && !/citation/i.test(dp) && dp.includes('"atWork"'));
  });

  ok("no page errors: "+errs.join(" | "), errs.length===0);
  await b.close();
})();
