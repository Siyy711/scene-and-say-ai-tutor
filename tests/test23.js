const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/", NOW=Date.now(), H=3600000, D=86400000;
const W=(term,ago)=>({createdAt:NOW-ago*H,term,kind:"phrase",meaning:"meaning of "+term,usage:"u",example:"e",theme:"At Work",level:"B2",fromScene:""});
const BANK={"terms/t0":W("fix it",1),"terms/t1":W("sort it out",2),"terms/t2":W("work around a problem",3),"terms/t3":W("work through something",4),"terms/t4":W("work out",5),"terms/t5":W("park",6)};
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1100}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const start=async(docs)=>{ await p.goto('about:blank'); await p.goto(URL); await p.evaluate(([d,P])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); },[docs,P]); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700); };
  const prompts=async(tag)=>(await p.evaluate(()=>window.__prompts)).filter(x=>x.includes(tag));
  const found=async()=>p.$$eval('#cmp-found .cmp-sug b',bs=>bs.map(b=>b.textContent.split(" · ")));
  const db=async()=>Object.fromEntries(Object.entries(await p.evaluate(()=>window.__mockdb())).filter(([k])=>k.startsWith(P+"sets/")).map(([k,v])=>[k.slice((P+"sets/").length),v]));
  const share=(a,b)=>a.filter(x=>b.includes(x)).length;

  await section("Find pairs: small sets, no heavy overlap", async()=>{
    await start(BANK);
    await p.click('#nav-compare'); await p.click('#cmp-find'); await p.waitForTimeout(400);
    const fp=(await prompts("COMPARE — FIND PAIRS")).pop()||"";
    ok("Claude is asked for pairs first, never more than 3", fp.includes("Prefer PAIRS") && fp.includes("Never more than 3"));
    const f=await found();
    ok("a 4-word set Claude sent anyway is dropped ("+f.map(x=>x.join("+")).join(" / ")+")", f.every(x=>x.length<=3) && f.length>0);
    ok("no two suggestions share 2 or more words", f.every((x,i)=>f.every((y,j)=>i===j||share(x,y)<2)));
    ok("the limit is visible", (await p.textContent('#cmp-msg')).includes("up to 5 each time. Press Find pairs again for more"));
  });

  await section("Each press continues", async()=>{
    await start(BANK);
    await p.click('#nav-compare'); await p.click('#cmp-find'); await p.waitForTimeout(400);
    const first=await found();
    await p.click('#cmp-find'); await p.waitForTimeout(400);
    const fp=(await prompts("COMPARE — FIND PAIRS")).pop()||"";
    ok("Claude is told what it already showed", fp.includes("ALREADY SHOWN") && fp.includes("fix it · sort it out"));
    const second=await found();
    ok("undecided suggestions stay, nothing is listed twice", first.every(x=>second.filter(y=>y.join("|")===x.join("|")).length===1));
    ok("no new ones left → said so", (await p.textContent('#cmp-msg')).includes("No more new pairs"));
  });

  await section("A set you already have blocks close suggestions", async()=>{
    await start(Object.assign({},BANK,{"sets/s":{createdAt:NOW,words:["fix it","sort it out","work out"],kind:"words",topic:"",source:"own",explain:{core:"c",uses:[]}}}));
    await p.click('#nav-compare'); await p.click('#cmp-find'); await p.waitForTimeout(400);
    const f=await found();
    ok("'fix it · sort it out' is not suggested (shares 2 words with your set)", !f.some(x=>share(x,["fix it","sort it out","work out"])>=2) && f.length>0);
  });

  await section("Edit words in a set", async()=>{
    await start(Object.assign({},BANK,{"sets/s":{createdAt:NOW,words:["hold","postpone"],kind:"words",topic:"",source:"confused",explain:{core:"old core",uses:[]},
      compare:{last:"wrong",at:NOW-D,history:[{at:NOW-D,right:false,items:[]}]}}}));
    await p.click('#nav-compare'); await p.click('.setrow[data-id="s"] .wordbtn'); await p.waitForTimeout(150);
    await p.click('.setrow[data-id="s"] .cmp-edit'); await p.waitForTimeout(100);
    ok("the words are ready to edit", (await p.inputValue('.setrow[data-id="s"] .cmp-edit-words'))==="hold, postpone");
    await p.fill('.setrow[data-id="s"] .cmp-edit-words','postpone'); await p.click('.setrow[data-id="s"] .cmp-edit-save'); await p.waitForTimeout(150);
    ok("one word → 'at least 2'", (await p.textContent('.setrow[data-id="s"] .cmp-edit-msg')).includes("at least 2"));
    await p.fill('.setrow[data-id="s"] .cmp-edit-words','put something on hold, postpone'); await p.click('.setrow[data-id="s"] .cmp-edit-save'); await p.waitForTimeout(500);
    const s=(await db()).s;
    ok("saved: the new words", s.words.join("|")==="put something on hold|postpone");
    ok("the explanation is rewritten for the new words", s.explain && s.explain.core.includes("put something on hold") && ((await prompts("COMPARE — EXPLAIN")).pop()||"").includes('"put something on hold"'));
    ok("the practice record stays", s.compare && s.compare.history.length===1);
    ok("the set shows its new name", (await p.textContent('.setrow[data-id="s"] .wordbtn b')).includes("put something on hold"));
  });

  ok("no page errors ("+errs.join(" | ").slice(0,160)+")", errs.length===0);
  await b.close();
})();
