// v27: "How a native speaker would tell it" + "How it's built" (2–4 moves). Act it out unchanged; old cards unchanged.
const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/";
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1100}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const start=async(prof,rnd,db)=>{ await p.goto('about:blank'); await p.goto(URL); await p.evaluate(([pr,d])=>{ localStorage.clear(); localStorage.setItem('ss.occupation','MES consultant'); for(const k in pr) localStorage.setItem(k,pr[k]); localStorage.setItem('__mockdb',JSON.stringify(d||{})); },[prof||{},db||{}]); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(600);
    if(rnd!=null) await p.evaluate(r=>{ Math.random=()=>r; },rnd); };
  const lastOf=async(tag)=>((await p.evaluate(()=>window.__prompts)).filter(x=>x.includes(tag)).pop()||"");
  const card=async(name)=>{ await p.click('#themegrid .theme:has-text("'+name+'")'); await p.waitForTimeout(400); };
  const moveRows=async(scope)=>p.$$eval(scope+' .fb-built .move',xs=>xs.map(x=>({you:!!x.querySelector('.mv-you'),native:!!x.querySelector('.mv-native'),type:(x.querySelector('.mv-type')||{}).textContent||""})));
  const PROF={"ss.acadField":"PhD in Philosophy","ss.acadTopic":"moral responsibility for AI decisions","ss.acadWhere":"seminars and meetings with my supervisor"};

  await section("Tell the story: the request", async()=>{
    await start({},0.9);
    await card("At Work");
    await p.click('#scene-body .mode:has-text("Tell the story")'); await p.fill('#story-text','It was raining and then the bus was late and then I was late.'); await p.click('#btn-check'); await p.waitForTimeout(400);
    const r=await lastOf("They were shown this scene");
    ok("the model is a native speaker's version, not 'keeping their ideas and their angle'", r.includes("how a native speaker would tell this story") && !r.includes("keeping their ideas and their angle"));
    ok("it keeps facts and point but not their order, development or links", r.includes("Keep their facts and their main point") && r.includes("do NOT keep their order of ideas"));
    ok("it asks for moves with 'you' and 'native' quotes, and the three types", r.includes('"moves"') && r.includes('"you"') && r.includes('"native"') && r.includes("order|development|links"));
    ok("no invented differences; 'Already natural' is allowed", r.includes("Never invent a difference") && r.includes('"Already natural"'));
    ok("Next time may name ONE move when structure held them back", r.includes("make the tip about ONE of your moves"));
  });

  await section("Tell the story: what you see, and the saved card", async()=>{
    ok("the model is headed 'How a native speaker would tell it'", (await p.textContent('#story-out .fb-model h3'))==="How a native speaker would tell it");
    ok("'How it’s built' comes right after the model", await p.$eval('#story-out .fb-model', e=>!!(e.nextElementSibling&&e.nextElementSibling.classList.contains('fb-built'))) && (await p.textContent('#story-out .fb-built h3'))==="How it’s built");
    const mv=await moveRows('#story-out');
    ok("3 moves, each with a 'You:' and a 'Native:' line and a type", mv.length===3 && mv.every(m=>m.you&&m.native&&m.type));
    await p.click('#story-out .btn:has-text("Save as a card")'); await p.waitForTimeout(500);
    const saved=await p.evaluate(P0=>{ const d=JSON.parse(localStorage.getItem('__mockdb')||'{}'); const k=Object.keys(d).find(k=>k.startsWith(P0+'cards/')); return k?d[k]:null; },P);
    const a=saved&&saved.attempts&&saved.attempts[0];
    ok("the practice is saved with its moves (name, type, you, native, why)", !!a && Array.isArray(a.moves) && a.moves.length===3 && ["name","type","you","native","why"].every(k=>k in a.moves[0]));
    await p.click('#nav-cards'); await p.waitForTimeout(200);
    await p.click('.saved-head'); await p.waitForTimeout(200);
    ok("the card shows the native heading and the moves", (await p.textContent('.saved .fb-model h3'))==="How a native speaker would tell it" && (await moveRows('.saved')).length===3);
  });

  await section("Show me one first", async()=>{
    await start({},0.9);
    await card("At Work");
    await p.click('#scene-body .btn:has-text("Show me one first")'); await p.waitForTimeout(400);
    const r=await lastOf("showing a worked example");
    ok("the request asks for moves without a 'you' side", r.includes('"moves"') && !r.includes('"you"') && r.includes("Tell modelStory the way a native speaker would naturally tell it"));
    ok("no target words → no 'whyThisWorks' asked, no extra notes block", !r.includes('"whyThisWorks"') && !(await p.isVisible('#scene-extra .fb-good')));
    ok("headed 'How a native speaker would tell it', then 'How it’s built'", (await p.textContent('#scene-extra .fb-model h3'))==="How a native speaker would tell it" && await p.isVisible('#scene-extra .fb-built'));
    const mv=await moveRows('#scene-extra');
    ok("2 moves with 'Native:' lines and no 'You:' lines", mv.length===2 && mv.every(m=>m.native&&!m.you));
  });

  await section("Write it (academic writing)", async()=>{
    await start({"ss.acadField":"PhD in Philosophy"},0.6); // same route as test24: a Writing scene
    await card("Academic & Research");
    await p.click('#scene-body .mode:has-text("Write it")'); await p.waitForTimeout(100);
    await p.fill('#story-text','This paper argues that responsibility gaps may be smaller than claimed.'); await p.click('#btn-check'); await p.waitForTimeout(400);
    const r=await lastOf("WRITE A PIECE");
    ok("the request asks how a native speaker would write this KIND of text", r.includes("how a native speaker would write this piece") && r.includes("how this KIND of text is built") && r.includes('"moves"'));
    ok("headed 'How a native speaker would write it', with moves", (await p.textContent('#story-out .fb-model h3'))==="How a native speaker would write it" && await p.isVisible('#story-out .fb-built'));
  });

  await section("This is my story", async()=>{
    await start({},0.9);
    await p.fill('#ownseed','The aircon man came and I could not explain which room.'); await p.click('#btn-own-check'); await p.waitForTimeout(500);
    const r=await lastOf("actually happened in their own life");
    ok("the request asks for the native version of the real event, with moves", r.includes("how a native speaker would tell this same real event") && r.includes('"moves"') && !r.includes("keeping their facts and their angle"));
    ok("the feedback shows 'How it’s built'", await p.isVisible('.fb-built'));
  });

  await section("Act it out stays as it is", async()=>{
    await start({},0.9);
    await card("At Work");
    await p.click('#scene-body .mode:has-text("Act it out")'); await p.waitForTimeout(100);
    await p.fill('#chat-text','Hi, could you have a look at this?'); await p.click('#btn-send'); await p.waitForTimeout(300);
    await p.click('#btn-review'); await p.waitForTimeout(400);
    ok("no moves asked in the conversation review", !(await lastOf("TRANSCRIPT:")).includes('"moves"'));
    ok("no 'How it’s built' block; heading unchanged", (await p.$$('.fb-built')).length===0 && (await p.isVisible('text=How you could have played it')));
  });

  await section("Old cards without moves", async()=>{
    const NOW=Date.now(), db={};
    db[P+"cards/old1"]={createdAt:NOW-86400000,updatedAt:NOW-86400000,title:"Old story card",theme:"At Work",setting:"s",
      attempts:[{n:1,at:NOW-86400000,mode:"story",level:"B1",userText:"I went.",strengths:[],corrections:[],highlights:[],modelStory:"An old model.",nextTip:"t"}]};
    await start({},null,db);
    await p.click('#nav-cards'); await p.waitForTimeout(200);
    await p.click('.saved-head:has-text("Old story card")'); await p.waitForTimeout(200);
    ok("an old practice keeps its old heading and has no moves block", (await p.textContent('.saved .fb-model h3'))==="How it could be told" && (await p.$$('.saved .fb-built')).length===0);
  });

  ok("no page errors ("+errs.slice(0,2).join(" | ").slice(0,120)+")", errs.length===0);
  await b.close();
})();
