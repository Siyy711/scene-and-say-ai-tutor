const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/";
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1100}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const start=async(prof,db)=>{ await p.goto('about:blank'); await p.goto(URL); await p.evaluate(([pr,d])=>{ localStorage.clear(); for(const k in pr) localStorage.setItem(k,pr[k]); localStorage.setItem('__mockdb',JSON.stringify(d||{})); },[prof||{},db||{}]); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(600); };
  const openCustom=async()=>{ if(!(await p.evaluate(()=>document.getElementById('setup-box').open))) await p.click('#setup-sum'); if(!(await p.evaluate(()=>document.getElementById('custom-box').open))) await p.click('#custom-sum'); await p.waitForTimeout(100); };
  /* v33: the town is one street of 5 plus the All places board, so "the grid" is every place on the board */
  const grid=async()=>p.$$eval('#town-board .bplace[data-theme] .bplace-go span',xs=>xs.map(x=>x.textContent));
  const street=async()=>p.$$eval('#themegrid .theme b',xs=>xs.map(x=>x.textContent));
  const openBoard=async()=>{ if(await p.isHidden('#town-board')) await p.click('#btn-more'); await p.waitForTimeout(100); };
  const scenePrompts=async()=>(await p.evaluate(()=>window.__prompts)).filter(x=>x.includes("You write short, specific speaking-practice scenes"));

  await section("Out of sight by default, nothing changed", async()=>{
    await start({});
    ok("'Customise situations' sits closed inside the profile", await p.$('#setup-box #custom-box') && !(await p.getAttribute('#custom-box','open')!==null));
    ok("all 14 themes in the town (on the All places board), 5 on the street", (await grid()).length===14 && (await street()).length===5);
    await openCustom();
    ok("two lists: Themes (14) and Academic situation types (7), all ticked", (await p.$$('#cust-themes .custrow input:checked')).length===14 && (await p.$$('#cust-acad .custrow input:checked')).length===7);
  });

  await section("Hide a theme", async()=>{
    await start({},{[P+"terms/w"]:{createdAt:Date.now(),term:"split the bill",kind:"phrase",meaning:"m",usage:"u",example:"e",theme:"Food & Eating Out",level:"B2",fromScene:""}});
    await openCustom();
    await p.uncheck('#cust-themes .custrow:has-text("Food & Eating Out") input'); await p.waitForTimeout(100);
    ok("it leaves the town: the board and the street", !(await grid()).includes("Food & Eating Out") && (await grid()).length===13 && !(await street()).includes("Food & Eating Out") && (await street()).length===5);
    await p.evaluate(()=>{ Math.random=()=>0; });
    await openBoard(); await p.click('#btn-surprise'); await p.waitForTimeout(400);
    ok("'Surprise me' never picks it", !(await scenePrompts()).pop().includes("Theme: Food & Eating Out"));
    await p.click('#nav-words'); await p.waitForTimeout(150);
    ok("your words keep their theme on the Words page", (await p.textContent('#wordlist')).includes("Food & Eating Out"));
    await p.goto('about:blank'); await p.goto(URL+'#db'); await p.waitForTimeout(500);
    ok("kept after reload", !(await grid()).includes("Food & Eating Out") && !(await street()).includes("Food & Eating Out"));
  });

  await section("At least one stays on", async()=>{
    await start({});
    await openCustom();
    for(let i=0;i<20;i++){ const on=await p.$$('#cust-themes .custrow input:checked'); if(!on.length) break; await on[on.length-1].click(); await p.waitForTimeout(30); if(on.length===1) break; }
    ok("the last theme can't be switched off, and you're told why", (await p.$$('#cust-themes .custrow input:checked')).length===1 && (await p.textContent('#cust-themes .custmsg')).includes("At least one") && (await grid()).length===1 && (await street()).length===1);
  });

  await section("Your own theme", async()=>{
    await start({});
    await openCustom();
    await p.fill('#cust-themes .custname','Visa & Immigration'); await p.fill('#cust-themes .custline','Renewing a pass, appointments, documents'); await p.click('#cust-themes .custgo'); await p.waitForTimeout(100);
    ok("it appears in the list, the town and on your street", (await p.textContent('#cust-themes')).includes("Visa & Immigration") && (await grid()).includes("Visa & Immigration") && (await street()).includes("Visa & Immigration"));
    await p.click('#themegrid .theme:has-text("Visa & Immigration")'); await p.waitForTimeout(400);
    ok("its scene request uses your name and line", (await scenePrompts()).pop().includes("Theme: Visa & Immigration — Renewing a pass, appointments, documents"));
    await p.click('#btn-back-themes'); await openCustom();
    await p.fill('#cust-themes .custname','at work'); await p.click('#cust-themes .custgo'); await p.waitForTimeout(100);
    ok("a name that's already there is refused", (await p.textContent('#cust-themes .custmsg')).includes("already"));
    await p.click('#cust-themes .custrow:has-text("Visa & Immigration") .custrm'); await p.waitForTimeout(100);
    ok("Remove takes it out again", !(await grid()).includes("Visa & Immigration") && !(await street()).includes("Visa & Immigration"));
  });

  await section("Academic situation types", async()=>{
    await start({"ss.acadField":"PhD in Philosophy"});
    await openCustom();
    for(const n of ["Seminars & discussions","Presenting & Q&A","Supervisor & professors","Explaining research","Group projects","Conferences & networking"]){ await p.uncheck('#cust-acad .custrow:has-text("'+n+'") input'); await p.waitForTimeout(30); }
    await p.fill('#cust-acad .custname','Thesis defence'); await p.fill('#cust-acad .custline','defending your thesis to a committee'); await p.click('#cust-acad .custgo'); await p.waitForTimeout(100);
    await p.evaluate(()=>{ Math.random=()=>0.99; });
    await p.click('#themegrid .theme:has-text("Academic & Research")'); await p.waitForTimeout(400);
    let sp=(await scenePrompts()).pop();
    ok("only types that are on are used (your own one here)", sp.includes("SITUATION TYPE: Thesis defence — defending your thesis to a committee"));
    await p.click('#scene-body .btn:has-text("Another scene like this")'); await p.waitForTimeout(400);
    sp=(await scenePrompts()).pop();
    ok("…then the other one that's on (Writing), never a hidden one", sp.includes("SITUATION TYPE: Writing"));
    await p.click('#btn-back-themes'); await openCustom();
    await p.uncheck('#cust-acad .custrow:has-text("Writing") input'); await p.waitForTimeout(50);
    await p.click('#cust-acad .custrow:has-text("Thesis defence") input'); await p.waitForTimeout(50);   /* the app refuses: it stays ticked */
    ok("at least one academic type stays on", (await p.$$('#cust-acad .custrow input:checked')).length===1 && (await p.textContent('#cust-acad .custmsg')).includes("At least one"));
  });

  ok("no page errors ("+errs.join(" | ").slice(0,160)+")", errs.length===0);
  await b.close();
})();
