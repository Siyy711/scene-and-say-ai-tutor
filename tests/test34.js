// v33 (Siyy, 19 Oct): register tags on words, places picked from the register, no due counts outside Practice, and one street.
const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/", NOW=Date.now(), D=86400000;
const W=(term,extra)=>Object.assign({createdAt:NOW-3600000,term,kind:"phrase",meaning:"meaning of "+term,usage:"",example:"An example with "+term+".",theme:"At Work",level:"B2",fromScene:""},extra||{});
const SET=(words)=>({createdAt:NOW-20*D,updatedAt:NOW,words,kind:"words",topic:"",source:"own",explain:{core:"core difference",uses:[]}});
/* the place lists in the app, copied here so the test notices if a jargon word can reach home again */
const TECH=["a stand-up or planning meeting with a software team","a chat with a developer or IT support","a work meeting","an email or chat message at work"];
const CASUAL=["chatting with a friend","family","a hobby, the gym or free time","your home or neighbours","travel or getting around"];
const PRIVATE=["your home or neighbours","family","chatting with a friend","a hobby, the gym or free time"];
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const errs=[];
  let p;
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const open=async(w,h,docs,ls)=>{
    if(p) await p.close();
    p=await b.newPage({viewport:{width:w,height:h}}); p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
    await p.goto(URL);
    await p.evaluate(([d,P,ls])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); for(const k in ls) localStorage.setItem(k,ls[k]); },[docs||{},P,ls||{}]);
    await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700);
  };
  const db=async()=>Object.fromEntries(Object.entries(await p.evaluate(()=>window.__mockdb())).filter(([k])=>k.startsWith(P+"terms/")).map(([k,v])=>[k.slice((P+"terms/").length),v]));
  const prompts=async(tag)=>(await p.evaluate(()=>window.__prompts)).filter(x=>x.includes(tag));
  const regCalls=async()=>p.evaluate(()=>window.__regCalls||0);
  const tag=async(term)=>{ const t=await p.$('.wordrow:has(.wordbtn:has-text("'+term+'")) .regtag'); return t ? (await t.textContent()) : ""; };
  const street=async()=>p.$$eval('#themegrid .onestreet .theme .sign',xs=>xs.map(x=>x.textContent));
  const ls=async(k)=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)||"null"),k);

  await section("No due counts on Words, Compare or the tabs; the Practice board keeps them", async()=>{
    /* one word practised a month ago (due again) and one new; one set new */
    await open(1280,900,{"terms/n1":W("fire away",{spot:{last:"nocue",at:NOW-30*D,history:[{at:NOW-30*D,stage:"nocue"}]}}),"terms/n2":W("touch base"),"sets/s1":SET(["park","hold off on something"])});
    ok("the Practice board shows both lines", (await p.textContent('#spotdue .spotdue:not(.cmpdue) span'))==="Spot it: 1 due again · 1 new" && (await p.textContent('#spotdue .cmpdue span'))==="Compare: 1 new");
    ok("no number on any tab", (await p.$$('.navcount')).length===0);
    await p.click('#nav-words'); await p.waitForTimeout(200);
    ok("Words: the Spot it button says only 'Spot it'", (await p.$$('.spotcount, #spot-count')).length===0 && (await p.textContent('#spot-open')).trim()==="Spot it");
    await p.click('#nav-compare'); await p.waitForTimeout(200);
    ok("Compare: the Practise button says only 'Practise'", (await p.$$('.spotcount, #cmp-count')).length===0 && (await p.textContent('#cmp-round-open')).trim()==="Practise");
  });

  await section("Words: every word shows its register, without Go deeper", async()=>{
    await open(1280,900,{"terms/m":W("MVP",{meaning:"minimum viable product: the smallest version of a product you can test"}),"terms/t":W("touch base"),"terms/s":W("split the bill",{theme:"Food & Eating Out"}),
      "terms/y":W("notwithstanding",{reg:{level:"formal",domain:"academic",by:"you"}})});
    ok("nothing is asked before you open Words", (await regCalls())===0);
    await p.click('#nav-words'); await p.waitForTimeout(500);
    ok("one request labels the three words that had no label", (await regCalls())===1);
    const req=(await prompts("REGISTER LABELS.")).pop()||"";
    ok("…it sends each word with its meaning, and leaves out the one you labelled", req.includes("MVP — minimum viable product") && req.includes("touch base — ") && !req.includes("notwithstanding"));
    ok("…and tells Claude to judge the meaning given ('chunk' for an AI tool is jargon)", req.includes("Judge the meaning given") && req.includes("'chunk' as a piece of a long text for an AI tool is jargon · tech"));
    ok("MVP: 'jargon · tech' ("+await tag("MVP")+")", (await tag("MVP"))==="jargon · tech");
    ok("touch base: 'casual · work'", (await tag("touch base"))==="casual · work");
    ok("split the bill: 'neutral · everyday'", (await tag("split the bill"))==="neutral · everyday");
    ok("your own label stays: 'formal · academic'", (await tag("notwithstanding"))==="formal · academic");
    const d=await db();
    ok("the labels are saved with the words", d.m.reg.level==="jargon" && d.m.reg.domain==="tech" && d.t.reg.level==="casual" && d.s.reg.domain==="everyday" && d.y.reg.by==="you");
    ok("…and nothing else in the words changed", d.m.term==="MVP" && d.m.meaning.startsWith("minimum viable product") && d.s.theme==="Food & Eating Out");
    await p.click('#nav-practice'); await p.waitForTimeout(150); await p.click('#nav-words'); await p.waitForTimeout(400);
    ok("opening Words again asks nothing more", (await regCalls())===1);
    const contrast=await p.$eval('.regtag',e=>{ const rgb=c=>c.match(/\d+(\.\d+)?/g).map(Number); const lum=c=>{ const f=v=>{ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); };
      const a=lum(rgb(getComputedStyle(e).color)), bg=lum(rgb(getComputedStyle(e).backgroundColor)); return (Math.max(a,bg)+0.05)/(Math.min(a,bg)+0.05); });
    ok("the tag is easy to read ("+contrast.toFixed(1)+":1)", contrast>=4.5);
  });

  await section("Change the register yourself, in the open entry", async()=>{
    await p.click('.wordbtn:has-text("touch base")'); await p.waitForTimeout(250);
    ok("the open entry has two register menus, set to the label", (await p.$eval('.wordrow:has(.wordbtn:has-text("touch base")) select.reg-level',s=>s.value))==="casual" && (await p.$eval('.wordrow:has(.wordbtn:has-text("touch base")) select.reg-domain',s=>s.value))==="work");
    ok("…with their own class, so the theme menu is still the only .themesel", (await p.$$('.wordrow:has(.wordbtn:has-text("touch base")) select.themesel')).length===1);
    await p.selectOption('.wordrow:has(.wordbtn:has-text("touch base")) select.reg-level','neutral'); await p.waitForTimeout(400);
    const d=await db();
    ok("saved as yours: neutral · work", d.t.reg.level==="neutral" && d.t.reg.domain==="work" && d.t.reg.by==="you");
    ok("the tag on the row changes at once", (await tag("touch base"))==="neutral · work");
  });

  /* Spot it asks for one word per request, so each round here holds one word; Math.random is fixed to steer the draw. */
  const spotRound=async(r)=>{ await p.evaluate(r=>{ Math.random=()=>r; },r); await p.click('#nav-words'); await p.waitForTimeout(250); await p.click('#spot-open'); await p.click('#spot-start'); await p.waitForTimeout(600);
    const sp=(await prompts("SPOT IT — SITUATIONS")).pop()||""; await p.click('#spot-exit'); await p.waitForTimeout(150); return sp; };
  const settingOf=sp=>((sp.match(/SETTING to use: ([^\n]*)/)||[])[1]||"").trim();

  await section("Spot it: the place comes from the word's register", async()=>{
    await open(1280,900,{"terms/m":W("MVP",{meaning:"minimum viable product",reg:{level:"jargon",domain:"tech"}})});
    const sp=await spotRound(0.6);
    ok("MVP gets a tech place ("+settingOf(sp)+")", TECH.includes(settingOf(sp)));
    ok("…and the request says its register", sp.includes("ITEM 0: MVP — ") && sp.includes("REGISTER: jargon · tech"));
    ok("the rule says the place fits and jargon stays with people in that field", sp.includes("The SETTING was chosen to fit them") && sp.includes("never with neighbours, family or a shop assistant"));
    ok("the old rule 'keep the place but change the moment' is gone", !sp.includes("keep the place but change the moment"));
    const draws=[]; for(const r of [0,0.3,0.55,0.8,0.99]) draws.push(settingOf(await spotRound(r)));
    ok("in 5 rounds a jargon word never lands at home, with family or friends ("+draws.join(" / ")+")", draws.every(x=>TECH.includes(x)) && !draws.some(x=>PRIVATE.includes(x)));
    ok("…and the place still varies", new Set(draws).size>=3);
  });

  await section("Spot it: a casual word gets a relaxed place", async()=>{
    await open(1280,900,{"terms/h":W("hang out",{meaning:"spend relaxed time together"})});
    const draws=[]; for(const r of [0,0.5,0.99]) draws.push(await spotRound(r));
    ok("labelled casual first ("+((await db()).h.reg||{}).level+"), then a relaxed place each time ("+draws.map(settingOf).join(" / ")+")", draws.every(x=>CASUAL.includes(settingOf(x)) && x.includes("REGISTER: casual · everyday")));
    ok("one label request for three rounds", (await regCalls())===1);
  });

  await section("Old words with no label still work, even if labelling fails", async()=>{
    await open(1280,900,{"terms/r":W("regfail",{meaning:"a word whose label request breaks"})});
    await p.click('#nav-words'); await p.waitForTimeout(400);
    ok("the word shows, with no tag", (await p.$$('.wordbtn:has-text("regfail")')).length===1 && (await tag("regfail"))==="");
    await p.click('#spot-open'); await p.click('#spot-start'); await p.waitForTimeout(700);
    const sp=(await prompts("SPOT IT — SITUATIONS")).pop()||"";
    ok("Spot it still runs, with no REGISTER line", await p.isVisible('#spot-reply') && sp.includes("ITEM 0: regfail") && !sp.includes("REGISTER:"));
    await p.click('#spot-exit'); await p.waitForTimeout(150);
    const draws=[]; for(const r of [0,0.5,0.99]) draws.push(settingOf(await spotRound(r)));
    ok("…and every place is allowed, as before ("+draws.join(" / ")+")", draws[0]==="a seminar, lecture or research meeting" && draws[2]==="a doctor, bank or other appointment");
    ok("a failed request is not repeated in the same visit", (await regCalls())===1);
    ok("nothing is saved for it", !(await db()).r.reg);
  });

  await section("Many old words: asked in small groups, one after another", async()=>{
    const docs={}; for(let i=0;i<25;i++) docs["terms/w"+i]=W("word "+i);
    await open(1280,900,docs);
    await p.click('#nav-words'); await p.waitForTimeout(900);
    const reqs=await prompts("REGISTER LABELS.");
    ok("25 words → 2 requests (20 + 5)", reqs.length===2 && (reqs[0].match(/\n\d+\. word/g)||[]).length===20 && (reqs[1].match(/\n\d+\. word/g)||[]).length===5);
    ok("all 25 are labelled and saved", Object.values(await db()).filter(x=>x.reg).length===25);
    await p.click('.wgroup-head'); await p.waitForTimeout(250);   /* "word 0" … "word 24" share a first word, so they sit in one closed group */
    ok("…and show their tag when the group opens", (await p.$$('.wordrow .regtag')).length===25);
  });

  await section("Compare: the place fits all the words in the set", async()=>{
    await open(1280,900,{"terms/m":W("MVP",{reg:{level:"jargon",domain:"tech"}}),"terms/d":W("deploy",{meaning:"put new software live"}),"sets/s1":SET(["MVP","deploy"])});
    await p.evaluate(()=>{ Math.random=()=>0.3; });
    await p.click('#nav-compare'); await p.waitForTimeout(150); await p.click('#cmp-round-open'); await p.click('#cr-start'); await p.waitForTimeout(700);
    const sp=(await prompts("COMPARE — SITUATIONS")).filter(x=>x.includes("WORDS:")).pop()||"";
    const set=((sp.match(/SETTING to use: ([^\n(]*)/)||[])[1]||"").trim();
    ok("the round labelled 'deploy' first", (await db()).d.reg && (await db()).d.reg.domain==="tech");
    ok("the setting is a tech place ("+set+")", TECH.includes(set));
    ok("…and the request says why and how each word is used", sp.includes("chosen to fit these words' register") && sp.includes('HOW "MVP" IS USED: [jargon · tech]') && sp.includes('HOW "deploy" IS USED: [jargon · tech]'));
  });

  await section("A new note gets its register when it's saved", async()=>{
    await open(1280,900,{});
    await p.click('#nav-words'); await p.click('#note-open'); await p.fill('#note-term','MVP'); await p.click('#note-go'); await p.waitForTimeout(1000);
    const np=(await prompts("file an expression they met outside")).pop()||"";
    ok("the note request asks for the register", np.includes('"register": {"level"'));
    const d=Object.values(await db());
    ok("saved with it: jargon · tech", d.length===1 && d[0].reg && d[0].reg.level==="jargon" && d[0].reg.domain==="tech");
    ok("…shown on the row, with no extra request", (await tag("MVP"))==="jargon · tech" && (await regCalls())===0);
  });

  await section("Word practice: the scene request carries each word's register", async()=>{
    await open(1280,900,{"terms/m":W("MVP",{reg:{level:"jargon",domain:"tech"}})});
    await p.click('#nav-words'); await p.waitForTimeout(300);
    await p.click('.wordbtn:has-text("MVP")'); await p.waitForTimeout(200);
    await p.click('.wordrow:has(.wordbtn:has-text("MVP")) button:has-text("Practise this one")'); await p.waitForTimeout(600);
    const sp=(await prompts("practise using these expressions")).pop()||"";
    ok("'[register: jargon · tech]' next to the word, and the matching rule", sp.includes("MVP   (meaning of MVP)   [register: jargon · tech]") && sp.includes("jargon only among people who share that field"));
  });

  await section("One street: 5 places and a signpost", async()=>{
    await open(1280,900,{"cards/c1":{createdAt:NOW,updatedAt:NOW,title:"a",theme:"Health & Wellbeing",setting:"s",attempts:[]},"cards/c2":{createdAt:NOW,updatedAt:NOW,title:"b",theme:"Health & Wellbeing",setting:"s",attempts:[]}},{"ss.occupation":"MES consultant"});
    const s0=await street();
    ok("until you choose: your tuned place, then the one you practise most, then everyday ones ("+s0.join(", ")+")", s0.join("|")==="At Work|Health & Wellbeing|Food & Eating Out|Home & Neighbours|Small Talk");
    ok("the board is closed at first", await p.isHidden('#town-board') && (await p.getAttribute('#btn-more','aria-expanded'))==="false");
    await p.click('#btn-more'); await p.waitForTimeout(150);
    ok("'More places' opens the All places board with all 14 and Surprise me", await p.isVisible('#town-board') && (await p.$$('#town-board .bplace[data-theme]')).length===14 && await p.isVisible('#btn-surprise') && (await p.getAttribute('#btn-more','aria-expanded'))==="true");
    ok("the 5 on your street say so", (await p.$$('#town-board .bplace-pin[aria-pressed="true"]')).length===5);
    ok("the street is full, so the others' '+ my street' wait, and the board says how to swap", (await p.$eval('#town-board .bplace[data-theme="shop"] .bplace-pin',b=>b.disabled && b.textContent==="+ my street")) && (await p.textContent('#town-board .board-head .hint')).includes("take one off first"));
    ok("…and the keyboard stays on the signpost, though the street is redrawn", await p.evaluate(()=>document.activeElement && document.activeElement.id==="btn-more"));
    await p.click('#town-board .bplace[data-theme="small"] .bplace-pin'); await p.waitForTimeout(150);
    ok("taking Small Talk off: 4 on the street, saved on this device", !(await street()).includes("Small Talk") && (await street()).length===4 && (await ls('ss.street')).length===4);
    ok("…the keyboard stays on that place's button, which now says '+ my street'", await p.evaluate(()=>{ const a=document.activeElement; return !!a && a.classList.contains("bplace-pin") && a.closest('[data-theme]').getAttribute('data-theme')==="small" && a.textContent==="+ my street"; }));
    await p.click('#town-board .bplace[data-theme="shop"] .bplace-pin'); await p.waitForTimeout(150);
    ok("'+ my street' on Shopping & Money: it joins the end of the street", (await street()).join("|")==="At Work|Health & Wellbeing|Food & Eating Out|Home & Neighbours|Shopping & Money");
    ok("…and the board says the street is full", (await p.textContent('#board-msg')).includes("Your street is full"));
    await p.goto('about:blank'); await p.goto(URL+'#db'); await p.waitForTimeout(600);
    ok("kept after reload", (await street()).join("|")==="At Work|Health & Wellbeing|Food & Eating Out|Home & Neighbours|Shopping & Money");
    await p.click('#btn-more'); await p.click('#town-board .bplace[data-theme="travel"] .bplace-go'); await p.waitForTimeout(500);
    ok("a place on the board starts its scene, like one on the street", await p.isVisible('#v-scene') && (await prompts("You write short, specific speaking-practice scenes")).pop().includes("Theme: Travel & Transport"));
  });

  await section("The street keeps at least one place; hidden and new themes", async()=>{
    await open(1280,900,{},{"ss.street":JSON.stringify(["food"])});
    await p.click('#btn-more'); await p.click('#town-board .bplace[data-theme="food"] .bplace-pin'); await p.waitForTimeout(150);
    ok("the last place can't be taken off, and you're told why", (await street()).join()==="Food & Eating Out" && (await p.textContent('#board-msg'))==="Your street needs at least one place.");
    await open(1280,900,{},{"ss.street":JSON.stringify(["food","home","small","travel","shop"]),"ss.hiddenThemes":JSON.stringify(["home"])});
    ok("a theme hidden in Customise situations leaves the street", (await street()).join("|")==="Food & Eating Out|Small Talk|Travel & Transport|Shopping & Money");
    await open(1280,900,{},{"ss.street":JSON.stringify(["food","home","small","travel","shop"])});
    await p.click('#setup-sum'); await p.click('#custom-sum'); await p.waitForTimeout(100);
    await p.fill('#cust-themes .custname','Visa & Immigration'); await p.click('#cust-themes .custgo'); await p.waitForTimeout(150);
    ok("a new own theme with a full street waits on the board, and you're told where", !(await street()).includes("Visa & Immigration") && (await p.$$('#town-board .bplace-go:has-text("Visa & Immigration")')).length===1 && (await p.textContent('#cust-themes .custmsg')).includes("on the All places board"));
    await open(1280,900,{},{"ss.street":JSON.stringify(["food","home"])});
    await p.click('#setup-sum'); await p.click('#custom-sum'); await p.waitForTimeout(100);
    await p.fill('#cust-themes .custname','Visa & Immigration'); await p.click('#cust-themes .custgo'); await p.waitForTimeout(150);
    ok("…with room, it goes straight onto your street", (await street()).join("|")==="Food & Eating Out|Home & Neighbours|Visa & Immigration");
  });

  await section("Sizes: whole-pixel buildings, and the page never scrolls sideways", async()=>{
    await open(760,900,{});
    const w=await p.$$eval('#themegrid .onestreet svg.tscene',ss=>ss.map(s=>Math.round(s.getBoundingClientRect().width)));
    ok("a narrow laptop window shows the buildings at 3× (102px), so they don't overlap ("+[...new Set(w)].join()+")", w.length===6 && w.every(x=>x===102));
    await open(390,844,{});
    await p.click('#btn-more'); await p.waitForTimeout(200);
    ok("phone, board open: no sideways page scroll", !(await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)));
    ok("…the board lists one place per line, each with room for '+ my street'", await p.$$eval('#town-board .bplace[data-theme]',bs=>bs.every(x=>{ const q=x.getBoundingClientRect(), pin=x.querySelector('.bplace-pin').getBoundingClientRect(); return q.right<=window.innerWidth && pin.right<=q.right && Math.abs(pin.top-q.top)<q.height; })));
  });

  ok("no page errors ("+errs.join(" | ").slice(0,160)+")", errs.length===0);
  await b.close();
})();
