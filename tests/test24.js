const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/";
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1100}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  /* prof: localStorage profile values; rnd: a fixed Math.random for this page */
  const start=async(prof,rnd)=>{ await p.goto('about:blank'); await p.goto(URL); await p.evaluate(([pr])=>{ localStorage.clear(); localStorage.setItem('ss.occupation','MES consultant'); for(const k in pr) localStorage.setItem(k,pr[k]); localStorage.setItem('__mockdb','{}'); },[prof||{}]); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(600);
    if(rnd!=null) await p.evaluate(r=>{ Math.random=()=>r; },rnd); };
  const scenePrompts=async()=>(await p.evaluate(()=>window.__prompts)).filter(x=>x.includes("You write short, specific speaking-practice scenes"));
  const lastOf=async(tag)=>((await p.evaluate(()=>window.__prompts)).filter(x=>x.includes(tag)).pop()||"");
  const card=async(name)=>{ await p.click('#themegrid .theme:has-text("'+name+'")'); await p.waitForTimeout(400); };
  const tags=async()=>p.$$eval('#scene-body .meta .tag',xs=>xs.map(x=>x.textContent));
  const PROF={"ss.acadField":"PhD in Philosophy","ss.acadTopic":"moral responsibility for AI decisions","ss.acadWhere":"seminars and meetings with my supervisor"};

  await section("Profile: three optional fields", async()=>{
    await start({});
    await p.click('#setup-sum'); await p.waitForTimeout(100);
    ok("Field, Research topic and Where, with example text that isn't a value", await p.isVisible('#acad-field') && await p.isVisible('#acad-topic') && await p.isVisible('#acad-where') && (await p.inputValue('#acad-where'))==="" && (await p.getAttribute('#acad-where','placeholder')).includes("supervisor"));
    await p.fill('#acad-where','seminars');
    ok("only 'Where' filled → the profile doesn't count", !(await p.textContent('#setup-line')).includes("academic"));
    await p.fill('#acad-field','PhD in Philosophy');
    ok("Field filled → it counts (shown in the profile line)", (await p.textContent('#setup-line')).includes("academic: PhD in Philosophy"));
    await p.goto('about:blank'); await p.goto(URL+'#db'); await p.waitForTimeout(500);
    ok("kept on this device after reload", (await p.inputValue('#acad-field'))==="PhD in Philosophy");
  });

  await section("The Academic & Research theme", async()=>{
    await start(PROF,0.45);
    /* v29: the tag now reads "For you:" instead of "tuned to:" (M2 round 5a, Siyy approved the wording) */
    ok("a new theme card, tuned to your topic", (await p.textContent('#themegrid .theme:has-text("Academic & Research")')).includes("For you: moral responsibility for AI decisions"));
    await card("Academic & Research");
    const sp=(await scenePrompts()).pop();
    ok("the scene request has a situation type and your field, topic and 'where'", sp.includes("SITUATION TYPE:") && sp.includes("Field of study or research: PhD in Philosophy") && sp.includes("Research topic: moral responsibility") && sp.includes("Where they use academic English: seminars"));
    ok("'Where' weights the types: with 'supervisor' in it, this pick is Supervisor & professors", sp.includes("SITUATION TYPE: Supervisor & professors"));
    const t=await tags();
    ok("the scene shows its type and the 'Academic standard' label", t.includes("Supervisor & professors") && t.includes("Academic standard"));
    await p.click('#scene-body .mode:has-text("Tell the story")'); await p.fill('#story-text','I think the argument is good.'); await p.click('#btn-check'); await p.waitForTimeout(400);
    const st=await lastOf("They were shown this scene");
    ok("the feedback request uses the academic standard", st.includes("ACADEMIC STANDARD") && st.includes("hedging"));
    ok("the feedback shows the label", (await p.textContent('#story-out .acadlabel')).includes("Academic standard"));
    await p.click('#story-out .btn:has-text("Save as a card")'); await p.waitForTimeout(300);
    const cards=Object.values(await p.evaluate(()=>window.__mockdb())).filter(x=>x.attempts);
    ok("the saved card remembers it", cards.length===1 && cards[0].academic===true && cards[0].attempts[0].academic===true && cards[0].acadType==="Supervisor & professors");
  });

  await section("Without 'where', no weighting", async()=>{
    await start({"ss.acadField":"PhD in Philosophy"},0.45);
    await card("Academic & Research");
    ok("same random pick → Explaining research (all types equal)", (await scenePrompts()).pop().includes("SITUATION TYPE: Explaining research"));
  });

  await section("Writing scenes: you write the piece", async()=>{
    await start({"ss.acadField":"PhD in Philosophy"},0.6);
    await card("Academic & Research");
    const sp=(await scenePrompts()).pop();
    ok("a Writing scene asks Claude for the exact task", sp.includes("SITUATION TYPE: Writing") && sp.includes('"task"'));
    ok("the scene shows 'Your task' and the mode 'Write it'", (await p.textContent('#scene-body .tasknote')).includes("Write the abstract") && await p.isVisible('#scene-body .mode:has-text("Write it")'));
    await p.click('#scene-body .btn:has-text("Show me one first")'); await p.waitForTimeout(400);
    ok("'Show me one first' writes the piece itself, not a story", (await lastOf("showing a worked example")).includes("THE TASK: Write the abstract") && (await lastOf("showing a worked example")).includes("the piece itself"));
    await p.click('#scene-body .mode:has-text("Write it")'); await p.waitForTimeout(100);
    ok("the writing box says 'Write it here'", (await p.textContent('label[for="story-text"]')).includes("Write it here") && (await p.textContent('#story-hint')).includes("length"));
    await p.fill('#story-text','This paper argues that responsibility gaps may be smaller than claimed.'); await p.click('#btn-check'); await p.waitForTimeout(400);
    const st=await lastOf("WRITE A PIECE");
    ok("feedback judges it as that piece, with the academic standard", st.includes("THE TASK: Write the abstract") && st.includes("ACADEMIC STANDARD") && st.includes("how a native speaker would write this piece")); // v27: deliberately changed — the model is now a native speaker's version, not "how you would write it, keeping their angle"
    await p.click('#btn-back-scene'); await p.waitForTimeout(100);
    await p.click('#scene-body .btn:has-text("Another scene like this")'); await p.waitForTimeout(400);
    ok("the next scene is a different type (never the same twice in a row)", !(await scenePrompts()).pop().includes("SITUATION TYPE: Writing"));
  });

  await section("Act it out in an academic scene", async()=>{
    await start(PROF,0.45);
    await card("Academic & Research");
    await p.click('#scene-body .mode:has-text("Act it out")'); await p.waitForTimeout(100);
    await p.fill('#chat-text','I am not sure this follows from the data.'); await p.click('#btn-send'); await p.waitForTimeout(300);
    await p.click('#btn-review'); await p.waitForTimeout(400);
    ok("the review uses the academic standard for speaking", (await lastOf("TRANSCRIPT:")).includes("ACADEMIC STANDARD") && (await lastOf("TRANSCRIPT:")).includes("turn-taking"));
  });

  await section("At Work: only research-like scenes, only with a filled-in profile", async()=>{
    await start({},0);
    await card("At Work");
    ok("no academic profile → never research-like, no label", !(await scenePrompts()).pop().includes("RESEARCH-LIKE") && !(await tags()).includes("Academic standard"));
    await start({"ss.acadWhere":"seminars"},0);
    await card("At Work");
    ok("only 'Where' filled → still never", !(await scenePrompts()).pop().includes("RESEARCH-LIKE") && !(await tags()).includes("Academic standard"));
    await start(PROF,0);
    await card("At Work");
    ok("profile filled + a research-like pick → research-like scene with the label", (await scenePrompts()).pop().includes("RESEARCH-LIKE") && (await tags()).includes("Academic standard"));
    await p.click('#scene-body .mode:has-text("Tell the story")'); await p.fill('#story-text','The findings suggest a delay.'); await p.click('#btn-check'); await p.waitForTimeout(400);
    ok("…and its feedback uses the academic standard", (await lastOf("They were shown this scene")).includes("ACADEMIC STANDARD"));
    await start(PROF,0.9);
    await card("At Work");
    ok("profile filled + an ordinary pick → ordinary work scene, normal standard", !(await scenePrompts()).pop().includes("RESEARCH-LIKE") && !(await tags()).includes("Academic standard"));
    await p.click('#scene-body .mode:has-text("Tell the story")'); await p.fill('#story-text','I told my boss.'); await p.click('#btn-check'); await p.waitForTimeout(400);
    ok("…no academic standard in its feedback", !(await lastOf("They were shown this scene")).includes("ACADEMIC STANDARD") && (await p.$$('#story-out .acadlabel')).length===0);
  });

  await section("Other themes are untouched", async()=>{
    await start(PROF,0);
    await card("Food & Eating Out");
    ok("no academic block, no label", !(await scenePrompts()).pop().includes("THEIR ACADEMIC SIDE") && !(await tags()).includes("Academic standard"));
  });

  await section("Spot it can use an academic setting", async()=>{
    await start({},0);
    await p.evaluate(([P])=>{ const o={}; o[P+"terms/a"]={createdAt:Date.now(),term:"caveat",kind:"word",meaning:"m",usage:"u",example:"e",theme:"At Work",level:"B2",fromScene:""}; localStorage.setItem('__mockdb',JSON.stringify(o)); },[P]);
    await p.reload(); await p.waitForTimeout(600); await p.evaluate(()=>{ Math.random=()=>0; });
    await p.click('#nav-words'); await p.click('#spot-open'); await p.click('#spot-start'); await p.waitForTimeout(500);
    ok("'a seminar, lecture or research meeting' is one of the settings", (await lastOf("SPOT IT — SITUATIONS")).includes("SETTING to use: a seminar, lecture or research meeting"));
  });

  ok("no page errors ("+errs.join(" | ").slice(0,160)+")", errs.length===0);
  await b.close();
})();
