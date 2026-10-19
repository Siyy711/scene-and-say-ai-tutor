const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/", NOW=Date.now(), D=86400000;
const EX={core:"core difference",uses:[]};
const SET=(words,extra)=>Object.assign({createdAt:NOW-20*D,updatedAt:NOW,words,kind:words.every(w=>["by","until","at","on","in"].includes(w))?"prepositions":"words",topic:"",source:"own",explain:EX},extra||{});
const H=(ago,right,extra)=>Object.assign({at:NOW-ago*D,right},extra||{});
const CMPD=(hist,extra)=>({compare:Object.assign({last:hist[hist.length-1].right?"right":"wrong",at:hist[hist.length-1].at,history:hist},extra||{})});
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1100}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const start=async(sets)=>{ await p.goto('about:blank'); await p.goto(URL); await p.evaluate(([d,P])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+"sets/"+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); },[sets,P]); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700); };
  const db=async()=>Object.fromEntries(Object.entries(await p.evaluate(()=>window.__mockdb())).filter(([k])=>k.startsWith(P+"sets/")).map(([k,v])=>[k.slice((P+"sets/").length),v]));
  const sitPrompts=async()=>(await p.evaluate(()=>window.__prompts)).filter(x=>x.includes("COMPARE — SITUATIONS")&&x.includes("WORDS:"));
  const round=async(n)=>{ await p.click('#nav-compare'); await p.waitForTimeout(150); await p.click('#cmp-round-open'); await p.click('#cr-n .chip >> text='+n); await p.click('#cr-start'); await p.waitForTimeout(500); };
  const setWords=async()=>p.$$eval('#cr-item .cr-word',xs=>xs.map(x=>x.textContent));
  /* answer each situation: "case N" means the N-th word of the set is best; swap=true answers wrong on purpose */
  const answer=async(swap)=>{
    const words=await setWords();
    const sits=await p.$$eval('#cr-item .cr-sit .spot-sit',xs=>xs.map(x=>x.textContent));
    for(let i=0;i<sits.length;i++){
      const k=Number((sits[i].match(/case (\d+)/)||[])[1])-1;
      const w=swap?words[(k+1)%words.length]:words[k];
      await p.fill('#cr-item .cr-sit[data-i="'+i+'"] .cr-reply','I think we should '+w+' this one.');
    }
    await p.click('#cr-check'); await p.waitForTimeout(400);
  };
  const BASE={s1:SET(["park","hold off on something"]), s2:SET(["pull back","pull the plug on something"],CMPD([H(2,true,{sit:"old twin scene"})])), s3:SET(["by","until"],CMPD([H(2,false)]))};

  await section("Counts: Compare page and home page", async()=>{
    await start(BASE);
    ok("home page: 'Compare: 1 due again · 1 new'", (await p.textContent('#spotdue .cmpdue span'))==="Compare: 1 due again · 1 new");
    await p.click('#nav-compare'); await p.waitForTimeout(150);
    ok("v33: Compare page: Practise button with no count (the Practice board is the only reminder)", await p.isEnabled('#cmp-round-open') && (await p.$$('#cmp-count, .spotcount')).length===0 && (await p.textContent('#cmp-round-open')).trim()==="Practise");
    await p.click('#nav-practice'); await p.waitForTimeout(150);
    await p.click('#cmpdue-go'); await p.waitForTimeout(150);
    ok("home Start opens a Compare round", await p.isVisible('#v-cround') && await p.isVisible('#cr-start'));
  });

  await section("A round: due sets first, twin situations, one line each", async()=>{
    await start(BASE);
    await round(2);
    const sp=await sitPrompts();
    ok("one situations request per set (2 sets → 2 requests, the next fetched in the background)", sp.length===2);
    ok("never the resting set (pull back · pull the plug)", !sp.some(x=>x.includes('"pull back"')));
    ok("the request asks for twins, one per word, with a setting", sp[0].includes("TWINS") && sp[0].includes("Write exactly 2 situations") && /SETTING to use: \S/.test(sp[0]));
    const words=await setWords();
    ok("'Choose from' shows the set's words", words.length===2);
    ok("one situation and one box per word", (await p.$$('#cr-item .cr-sit')).length===2 && (await p.$$('#cr-item .cr-reply')).length===2);
    await p.click('#cr-check'); await p.waitForTimeout(150);
    ok("empty lines → 'Write one line for each situation first'", (await p.textContent('#cr-check-msg')).includes("one line for each"));
  });

  await section("A set word that leaks into a situation is hidden", async()=>{
    await start({s1:SET(["park","hold off on something"])});
    await round(1);
    ok("'park it' becomes '____ it'", !(await p.textContent('#cr-item .cr-sit:has-text("case 1")')).toLowerCase().includes("park it") && (await p.textContent('#cr-item')).includes("____ it"));
  });

  await section("All chosen right → saved, and back in 4 days", async()=>{
    await start({s1:SET(["park","hold off on something"])});
    await round(1);
    await answer(false);
    ok("✓ on every situation, 'All chosen right'", (await p.$$('#cr-item .cr-out.fb-good')).length===2 && (await p.textContent('#cr-result')).includes("All chosen right"));
    ok("feedback and a more natural line are shown", (await p.textContent('#cr-item .cr-out')).includes("More natural:"));
    const c=(await db()).s1.compare, e=c.history[0];
    ok("saved: right, with your lines, feedback and better lines", c.last==="right" && e.right===true && e.items.length===2 && e.items.every(x=>x.reply.startsWith("I think") && x.feedback && x.better && x.ok===true));
    ok("saved: the situation summary (so next time avoids it), not marked extra", !!e.sit && !e.early);
    await p.click('#cr-next'); await p.waitForTimeout(150);
    ok("round summary: 'chosen right — back in 4 days'", (await p.textContent('#cr-summary')).includes("chosen right — back in 4 days"));
  });

  await section("A wrong choice → back tomorrow", async()=>{
    await start({s3:SET(["by","until"])});
    await round(1);
    await answer(true);
    ok("✗ with the best word named, 'Mixed up — this set comes back tomorrow'", (await p.$$('#cr-item .cr-out.fb-fix')).length===2 && (await p.textContent('#cr-item .cr-out')).includes("best here") && (await p.textContent('#cr-result')).includes("comes back tomorrow"));
    ok("saved: wrong", (await db()).s3.compare.last==="wrong" && (await db()).s3.compare.history[0].right===false);
    await p.click('#cr-next'); await p.waitForTimeout(150);
    ok("round summary: 'mixed up — back tomorrow'", (await p.textContent('#cr-summary')).includes("mixed up — back tomorrow"));
  });

  await section("The gap grows only when it should", async()=>{
    /* a: right 3 times in a row, last 10 days ago → 14-day gap → resting.  b: right twice, last 8 days ago → 7-day gap → due. */
    await start({a:SET(["park","pull back"],CMPD([H(40,true),H(25,true),H(10,true)])), b:SET(["by","until"],CMPD([H(20,true),H(8,true)]))});
    await round(1);
    ok("picks the due set (by · until), not the one resting for 14 days", (await setWords()).join("|")==="by|until");
    /* extra practice: everything resting */
    await start({r:SET(["park","pull back"],CMPD([H(1,true)]))});
    await round(1);
    await answer(false);
    const e=(await db()).r.compare.history.pop();
    ok("practising a resting set is marked extra practice", e.right===true && e.early===true);
    await p.click('#cr-next'); await p.waitForTimeout(150);
    ok("…and doesn't stretch the gap (still 4 days, not 7)", (await p.textContent('#cr-summary')).includes("back in 4 days"));
  });

  await section("New situations each time", async()=>{
    await start({s2:SET(["pull back","pull the plug on something"],CMPD([H(9,true,{sit:"old twin scene",setting:"a work meeting"})]))});
    await round(1);
    const sp=(await sitPrompts()).pop();
    ok("the request lists the last situation to avoid", sp.includes("AVOID") && sp.includes("old twin scene"));
    ok("…and a different setting from last time", !sp.includes("SETTING to use: a work meeting"));
  });

  await section("Practice record and Reset schedule in the set", async()=>{
    await start({s1:SET(["park","hold off on something"])});
    await round(1); await answer(false); await p.click('#cr-next'); await p.click('#cr-back'); await p.waitForTimeout(200);
    ok("the set shows 'chose right ✓'", (await p.textContent('.setrow[data-id="s1"] .spottag'))==="chose right ✓");
    await p.click('.setrow[data-id="s1"] .wordbtn'); await p.waitForTimeout(150);
    const rec=await p.textContent('.setrow[data-id="s1"] .spotrec');
    ok("'Compare practice' with Practice 1: your lines, feedback, more natural", rec.includes("Compare practice") && rec.includes("Practice 1") && rec.includes("You wrote: I think") && rec.includes("Feedback:") && rec.includes("More natural:"));
    await p.click('.setrow[data-id="s1"] .cmp-reset'); await p.waitForTimeout(300);
    ok("Reset → due now, record kept, tag 'practise again'", Number((await db()).s1.compare.resetAt)>0 && (await db()).s1.compare.history.length===1 && (await p.textContent('.setrow[data-id="s1"] .spottag'))==="practise again" && (await p.textContent('#spotdue .cmpdue span'))==="Compare: 1 due again");
    await p.click('#undo-btn'); await p.waitForTimeout(300);
    ok("Undo → schedule back", !Number((await db()).s1.compare.resetAt) && (await p.$$('#spotdue .cmpdue')).length===0);
  });

  await section("A reply that breaks: Try again", async()=>{
    await start({x:SET(["brokenset","other"])});
    await round(1);
    ok("the error shows, and Start can be pressed again", (await p.textContent('#cr-msg')).length>0 && await p.isEnabled('#cr-start'));
    await p.click('#cr-start'); await p.waitForTimeout(500);
    ok("second try works", await p.isVisible('#cr-item .cr-sit'));
  });

  ok("no page errors ("+errs.join(" | ").slice(0,160)+")", errs.length===0);
  await b.close();
})();
