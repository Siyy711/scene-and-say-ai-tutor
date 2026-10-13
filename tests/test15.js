const {chromium}=require(process.env.PW||'playwright');
const fs=require('fs');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/preview-mock.html';
const P="data/users/u_test/store/terms/", NOW=Date.now(), D=86400000;
const W=(term,extra)=>Object.assign({createdAt:NOW-3600000,term,kind:"phrase",meaning:"meaning of "+term,usage:"u",example:"An example with "+term+".",theme:"At Work",level:"B2",fromScene:""},extra||{});
const SP=(last,at,hist)=>({spot:{last,at,history:hist||[{at,stage:last}]}});
const BOLT=JSON.parse(fs.readFileSync('fixture-bolt-v3.json','utf8'));
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const prompts=()=>p.evaluate(()=>window.__prompts);
  const db=async()=>Object.fromEntries(Object.entries(await p.evaluate(()=>window.__mockdb())).filter(([k])=>k.includes('/terms/')).map(([k,v])=>[k.split('/').pop(),v]));
  const start=async(docs)=>{ await p.goto('about:blank'); await p.goto(URL); await p.evaluate(([d,P])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); },[docs,P]); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700); await p.click('#nav-words'); await p.waitForTimeout(150); };
  /* v16: one request per word. round() returns the request for the FIRST word of the round. */
  const round=async(n)=>{ const before=(await prompts()).length; await p.click('#spot-open'); if(n) await p.click('#spot-n .chip >> text='+n); await p.click('#spot-start'); await p.waitForTimeout(600); const ps=(await prompts()).slice(before).filter(x=>x.includes("SPOT IT — SITUATIONS")); return ps[0]; };
  /* walk a whole round (stuck → stuck → answer) and read the words from the summary */
  const walk=async()=>{ for(let k=0;k<5;k++){ if(await p.$('#spot-summary')) break; await p.click('#spot-stuck'); await p.click('#spot-stuck'); await p.fill('#spot-reply','x'); await p.click('#spot-check'); await p.waitForTimeout(300); await p.click('#spot-next'); await p.waitForTimeout(300); } return (await p.$$eval('#spot-summary .spot-sumrow b',bs=>bs.map(b=>b.textContent))); };
  const rowsIn=th=>p.$$eval('#wordlist .groupname',(hs,th)=>{ const h=hs.find(x=>x.textContent.startsWith(th)); return h? h.nextElementSibling.querySelectorAll(':scope > .wordrow, :scope > .wgroup').length : -1; },th);   /* v18: a group of meanings counts as one row */
  const items=sp=>(sp.match(/ITEM \d+: [^—\n]+/g)||[]).map(x=>x.replace(/ITEM \d+: /,"").trim());

  await section("Schedule: which words are due", async()=>{
  const sched={
    tA:W("alpha",SP("bridge",NOW-2*D)),          // gap 1 day  -> due
    tB:W("beta",SP("hint",NOW-1*D)),             // gap 2 days -> resting
    tC:W("gamma",SP("nocue",NOW-5*D)),           // gap 4 days -> due
    tD:W("delta",SP("nocue",NOW-5*D,[{at:NOW-12*D,stage:"nocue"},{at:NOW-5*D,stage:"nocue"}])), // 2 in a row: gap 7 -> resting
    tE:W("epsilon")                              // never practised -> due
  };
  await start(sched);
  await p.click('#spot-open');
  const msg=await p.textContent('#spot-due');
  ok("choose page no longer announces missed words", !/missed/i.test(await p.textContent('#v-spot')) && msg.includes("due come first"));
  await p.click('#nav-words');
  let sp=await round(3);
  const got=await walk();
  ok("round = exactly the due words (alpha, gamma, epsilon): "+got.join(","), got.slice().sort().join()==="alpha,epsilon,gamma");
  let firsts=new Set();
  for(let i=0;i<8;i++){ await start(sched); const s2=await round(3); firsts.add(items(s2)[0]); }
  ok("order is random (first item varied over 8 rounds: "+[...firsts].join(",")+")", firsts.size>=2);

  });
  await section("Everything resting: still a round, oldest first", async()=>{
  await start({tX:W("xray",SP("nocue",NOW-1*D)), tY:W("yankee",SP("nocue",NOW-3*D)), tZ:W("zulu",SP("nocue",NOW-2*D))});
  await p.click('#spot-open');
  ok("says all words are resting (extra practice)", (await p.textContent('#spot-due')).includes("All your words are resting"));
  await p.click('#nav-words');
  sp=await round(1);
  ok("picks the word practised longest ago (yankee)", items(sp)[0]==="yankee");
  await p.fill('#spot-reply','Yankee is the word here.'); await p.click('#spot-check'); await p.waitForTimeout(400);
  let d=await db();
  const last=d.tY.spot.history[d.tY.spot.history.length-1];
  ok("extra practice is marked 'early', so it can't stretch the gap", last.stage==="nocue" && last.early===true);

  });
  await section("Scenes: rules, setting, no repeats", async()=>{
  await start({tBolt:BOLT});
  sp=await round(1);
  ok("rules: nobody fishes for the word; language words → editing/feedback; no 'this week' rule", sp.includes("Nobody in the situation asks for the expression") && sp.includes("ABOUT language itself") && !/this week/i.test(sp));
  ok("SS picks a setting", /SETTING to use: \S/.test(sp));
  const set1=(sp.match(/SETTING to use: ([^\n]*)/)||[])[1];
  const sit1=await p.textContent('#spot-sit');
  await p.fill('#spot-reply','They just bolted it on.'); await p.click('#spot-check'); await p.waitForTimeout(400);
  d=await db();
  const e1=d.tBolt.spot.history[d.tBolt.spot.history.length-1];
  ok("result saves a short scene summary and the setting", e1.sit==="Mei asks about the planning tool" && e1.setting===set1);
  ok("…and the deep dive is untouched", !!d.tBolt.deep);
  await p.click('#spot-next'); await p.waitForTimeout(150);
  await p.click('#spot-back'); await p.waitForTimeout(150);
  sp=await round(1);
  ok("next time Claude is told what to AVOID", sp.includes("AVOID — earlier situations for this item") && sp.includes("Mei asks about the planning tool"));
  const set2=(sp.match(/SETTING to use: ([^\n]*)/)||[])[1];
  ok("…and gets a different setting ("+set1+" → "+set2+")", set2 && set2!==set1);
  ok("…so the scene is different", (await p.textContent('#spot-sit'))!==sit1);

  });
  await section("Hints", async()=>{
  await p.click('#spot-stuck'); await p.waitForTimeout(150);
  const h1=await p.textContent('#spot-hint');
  ok("Claude's hint is used, with the word hidden: "+h1.trim().slice(0,90), h1.includes("Your sentence: Existing factories do ____ AI onto old layouts") && !/bolt/i.test(h1) && !h1.includes("Where you met it"));
  await start({tSyn:W("synonym",{example:"Is there a synonym for issue?",situation:"Saved from a chat on 8 Oct."})});
  await round(1); await p.click('#spot-stuck'); await p.waitForTimeout(150);
  const h2=await p.textContent('#spot-hint');
  ok("a generic hint is rejected → your sentence, word hidden", !/saved from a chat/i.test(h2) && h2.includes("Is there a ____ for issue?"));
  ok("reply type 'feedback' changes the label", (await p.textContent('#spot-label'))==="Write your feedback");
  await p.fill('#spot-reply','Maybe use another word here.'); await p.click('#spot-check'); await p.waitForTimeout(400);
  const cps=await prompts();
  ok("check request knows the reply type", cps[cps.length-1].includes("REPLY TYPE: written feedback"));
  await start({tLoop:W("loop in",{example:"",situation:"Saved from a chat on 8 Oct."})});
  await round(1);
  ok("reply type 'message' changes the label", (await p.textContent('#spot-label'))==="Write your message");
  await p.click('#spot-stuck'); await p.waitForTimeout(150);
  ok("no hint, no sentence, generic 'where' → the meaning", (await p.textContent('#spot-hint')).includes("It means: meaning of loop in"));

  });
  await section("Words page with a big word bank", async()=>{
  const big={};
  for(let i=0;i<40;i++) big["w"+i]=W("n"+i+" phrase number "+i,{   /* v18: own first word each */createdAt:NOW-(i+1)*60000, meaning:"meaning "+i});
  big.wOld=W("bolt",{createdAt:NOW-90*D, meaning:"to lock a door with a bar"});
  big.wNew=W("bolt",{createdAt:NOW-1000, meaning:"add on without redesigning"});
  big.wChat=W("touch base",{createdAt:NOW-80*D, source:"chat"});
  big.f1=W("split the bill",{theme:"Food & Eating Out"}); big.f2=W("takeaway",{theme:"Food & Eating Out"});
  await start(big);
  ok("At Work shows only the 3 newest (+ the NEW chat word): "+(await rowsIn("At Work")), (await rowsIn("At Work"))===4 && await p.isVisible('.wgroup[data-root="bolt"]') && !(await p.isVisible('.wordbtn:has-text("phrase number 5")')));
  ok("…the NEW word from a chat is visible though it is old", await p.isVisible('.wordbtn:has-text("touch base")'));
  ok("'Show all 43' under At Work", (await p.textContent('.showall[data-theme="At Work"]'))==="Show all 42");   /* v18: 43 meanings, 42 rows (the two bolts are one group) */
  ok("a theme with 2 words has no button", (await rowsIn("Food & Eating Out"))===2 && !(await p.$('.showall[data-theme="Food & Eating Out"]')));
  await p.click('.wordbtn:has-text("phrase number 0")'); await p.waitForTimeout(100);
  await p.click('.wordbtn:has-text("phrase number 0")'); await p.waitForTimeout(100);
  await p.click('.showall[data-theme="At Work"]'); await p.waitForTimeout(150);
  ok("Show all → all 42 rows", (await rowsIn("At Work"))===42 && (await p.textContent('.showall[data-theme="At Work"]'))==="Show fewer");
  await p.click('.showall[data-theme="At Work"]'); await p.waitForTimeout(150);
  ok("Show fewer → back to the short list", (await rowsIn("At Work"))===4);
  await p.click('#wordlist .chip >> text=At Work (43)'); await p.waitForTimeout(150);
  ok("theme chip shows the whole theme", (await rowsIn("At Work"))===42);
  await p.click('#wordlist .chip >> text=All (45)'); await p.waitForTimeout(150);
  await p.click('.wgroup[data-root="bolt"] .wgroup-head'); await p.waitForTimeout(150);   /* v18: open the group first */
  await p.click('.wordbtn:has-text("add on without redesigning")'); await p.waitForTimeout(150);
  await p.click('.worddetail:visible .othermean .linkish'); await p.waitForTimeout(200);
  ok("'Other meanings' opens an old, hidden meaning (it becomes visible)", await p.isVisible('.wordrow[data-id="wOld"] .worddetail'));

  });
  await section("Search", async()=>{
  await p.click('#word-q'); await p.keyboard.type('number 17', {delay:20}); await p.waitForTimeout(150);
  ok("search finds one word", (await p.$$('#wordlist .wordrow')).length===1 && (await p.textContent('#word-results')).includes("1 word matches"));
  ok("typing doesn't lose focus", await p.evaluate(()=>document.activeElement&&document.activeElement.id==="word-q"));
  await p.fill('#word-q','without redesigning'); await p.waitForTimeout(150);
  ok("search by meaning", (await p.$$('#wordlist .wordrow')).length===1 && await p.isVisible('.wordbtn:has-text("bolt")'));
  await p.fill('#word-q','zzzz'); await p.waitForTimeout(150);
  ok("no match → a clear message", (await p.textContent('#word-results')).includes("No words match"));
  await p.fill('#word-q',''); await p.waitForTimeout(150);
  ok("clearing search → back to the short lists", (await rowsIn("At Work"))<=6);

  });
  console.log("— Phone —");
  await p.setViewportSize({width:390,height:844}); await p.waitForTimeout(150);
  ok("no sideways scroll on a phone", !(await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)));
  await p.screenshot({path:'v15-words.png',fullPage:false});
  ok("no page errors: "+errs.join(" | "), errs.length===0);
  await b.close();
})();
