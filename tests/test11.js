const {chromium}=require(process.env.PW||'playwright');
const fs=require('fs');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/preview-mock.html';
const P="data/users/u_test/store/";
const BOLT=JSON.parse(fs.readFileSync('fixture-bolt.json','utf8'));   // the REAL document the skill saved
const OLD={createdAt:Date.now()-86400000,term:"take a look at",kind:"phrase",meaning:"check something",usage:"u",example:"Could you take a look at it?",theme:"Home & Neighbours",level:"B1",fromScene:""};
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1300}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  /* v38: opening a word also asks how to say it, so this reads the last request that is NOT that one */
  const last=()=>p.evaluate(()=>window.__prompts.filter(x=>x.indexOf("HOW TO SAY IT.")!==0).slice(-1)[0]);
  const db=()=>p.evaluate(()=>window.__mockdb());
  const terms=async()=>Object.entries(await db()).filter(([k])=>k.includes('/terms/')).map(([k,v])=>Object.assign({id:k.split('/').pop()},v));
  const addNote=async(term,sentence)=>{ await p.click('#note-open'); await p.fill('#note-term',term); if(sentence) await p.fill('#note-eg',sentence); await p.click('#note-go'); await p.waitForTimeout(700); };

  console.log("— The real 'bolt' document (saved by the skill, cloud only, read-only data) —");
  await p.goto('about:blank'); await p.goto(URL);
  await p.evaluate(([bolt,old,P])=>{ localStorage.clear(); localStorage.setItem('__mockdb',JSON.stringify({[P+"terms/tmuz4wawt92qj"]:bolt,[P+"terms/tOld"]:old})); },[BOLT,OLD,P]);
  await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700);
  await p.click('#nav-words'); await p.waitForTimeout(200);
  ok("the real document shows up", await p.isVisible('.wordbtn:has-text("bolt")'));
  ok("row has a NEW USE label", await p.isVisible('.wordrow:has-text("bolt") .usetag'));
  await p.click('.wordbtn:has-text("bolt")'); await p.waitForTimeout(150);
  const det=await p.textContent('.worddetail:visible');
  ok("shows 'Usually means: a metal fastener…'", det.includes("Usually means:") && det.includes("metal fastener"));
  ok("shows 'Here it means: …without redesigning…'", det.includes("Here it means:") && det.includes("without redesigning"));
  ok("shows the pattern", det.includes("Pattern:") && det.includes("bolt something onto something"));
  ok("your sentence is the example", det.includes("Existing factories do bolt AI onto old layouts."));
  await p.screenshot({path:'v11-bolt.png',fullPage:true});
  await p.click('.worddetail:visible >> text=Go deeper'); await p.waitForTimeout(300);
  const dp=await last();
  ok("Go deeper stays on THIS meaning (pattern + your sentence sent)", dp.includes("Pattern on file: bolt something onto something") && dp.includes("Existing factories do bolt AI") && dp.includes("Write the WHOLE entry about the meaning on file"));
  await p.click('.wordbtn:has-text("take a look at")'); await p.waitForTimeout(150);
  const od=await p.textContent('.worddetail:visible');
  ok("an old word looks as before (no contrast, pattern or labels)", !od.includes("Usually means") && !od.includes("Pattern:") && !(await p.isVisible('.wordrow:has-text("take a look at") .usetag')) && od.includes("check something"));

  console.log("— Same word, SAME meaning: not saved again —");
  await addNote("bolt","They bolted a chatbot onto the old CRM.");
  const sp=await last();
  ok("request lists the meaning already saved", sp.includes("ALREADY SAVED") && sp.includes("0. bolt — to add something to an existing system"));
  ok("request asks for the meaning IN THE SENTENCE", sp.includes("Explain the meaning the expression has IN THAT SENTENCE"));
  ok("not saved twice", (await terms()).filter(t=>t.term==="bolt").length===1);
  ok("your new sentence is added to the existing entry (v12 rule)", (await terms()).find(t=>t.term==="bolt").example2==="They bolted a chatbot onto the old CRM.");
  ok("you're told what was added, and the existing entry opens", (await p.textContent('#note-done')).includes("instead of a new entry I added your sentence") && (await p.textContent('.worddetail:visible')).includes("without redesigning"));

  console.log("— Same word, DIFFERENT meaning: saved as another meaning —");
  await addNote("bolt","He bolted the door before the storm.");
  let ts=(await terms()).filter(t=>t.term==="bolt");
  const lock=ts.find(t=>t.meaning.includes("lock"));
  ok("a second 'bolt' is saved", ts.length===2 && !!lock);
  ok("…with the meaning in YOUR sentence and the common meaning for contrast", lock && lock.knownAs==="a metal fastener" && lock.newUse===true && lock.example==="He bolted the door before the storm." && !!lock.example2);
  /* v18: the two meanings are shown as ONE group with one '2 meanings' label (was: a label on each row) */
  ok("both meanings are shown as one 'bolt · 2 meanings' group", (await p.$$('.wgroup[data-root="bolt"] .wordrow')).length===2 && (await p.$$('.meantag')).length===1 && (await p.textContent('.wgroup[data-root="bolt"] .wgroup-head .meantag'))==="2 meanings");
  const op=await p.textContent('.worddetail:visible .othermean');
  ok("the open entry links to the other meaning", op.includes("without redesigning"));
  await p.click('.worddetail:visible .othermean .linkish'); await p.waitForTimeout(200);
  ok("clicking it opens the other meaning", (await p.textContent('.worddetail:visible')).includes("Existing factories"));

  console.log("— A sentence where the meaning IS the usual one: no contrast —");
  await addNote("fire away","Fire away, I'm listening.");
  const fa=(await terms()).find(t=>t.term==="fire away");
  ok("saved without 'usual', no NEW USE", fa && !fa.knownAs && !fa.newUse && fa.example==="Fire away, I'm listening.");
  ok("entry shows just the meaning", !(await p.textContent('.worddetail:visible')).includes("Usually means"));

  console.log("— No sentence: common meaning + 'Also used as' —");
  await addNote("touch base","");
  const np=await last();
  ok("request asks for the common meaning and one less obvious use", np.includes("NO SENTENCE GIVEN") && np.includes('"alsoUsed"') && !np.includes('"usual"'));
  const tb=(await terms()).find(t=>t.term==="touch base");
  ok("saved with alsoUsed, no contrast", tb && tb.alsoUsed && tb.alsoUsed.meaning && !tb.knownAs);
  ok("entry shows 'Also used as'", (await p.textContent('.worddetail:visible')).includes("Also used as:"));

  console.log("— Saved from a chat while SS is open (skill-shaped, with the new fields) —");
  await p.evaluate(([k,v])=>{ const d=window.__mockdb(); d[k]=v; localStorage.setItem('__mockdb',JSON.stringify(d)); },[P+"terms/tLive",Object.assign({},BOLT,{term:"retrofit",meaning:"to add new technology to an old machine",knownAs:"",newUse:false,pattern:"retrofit something with something",example:"We retrofitted the line with sensors.",createdAt:Date.now()})]);
  await p.waitForTimeout(900);
  ok("appears live, with its pattern", await p.isVisible('.wordbtn:has-text("retrofit")'));
  await p.click('.wordbtn:has-text("retrofit")'); await p.waitForTimeout(150);
  ok("…pattern shown, no contrast (knownAs empty)", (await p.textContent('.worddetail:visible')).includes("retrofit something with something") && !(await p.textContent('.worddetail:visible')).includes("Usually means"));

  console.log("— Phone width —");
  await p.setViewportSize({width:390,height:844}); await p.click('.wordbtn:has-text("bolt") >> nth=0'); await p.waitForTimeout(150);
  ok("no sideways scroll on a phone", !(await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)));
  await p.screenshot({path:'v11-phone.png',fullPage:true});
  ok("no page errors: "+errs.join(" | "), errs.length===0);
  await b.close();
})();
