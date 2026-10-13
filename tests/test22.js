const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/", NOW=Date.now(), D=86400000;
const W=(term,extra)=>Object.assign({createdAt:NOW-3600000,term,kind:"word",meaning:"meaning of "+term,usage:"usage of "+term,example:"An example with "+term+".",theme:"At Work",level:"B2",fromScene:""},extra||{});
const SET=(words,extra)=>Object.assign({createdAt:NOW-20*D,updatedAt:NOW,words,kind:"words",topic:"",source:"own",explain:{core:"c",uses:[]}},extra||{});
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1100}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const start=async(docs)=>{ await p.goto('about:blank'); await p.goto(URL); await p.evaluate(([d,P])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); },[docs,P]); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700); };
  const prompts=async(tag)=>(await p.evaluate(()=>window.__prompts)).filter(x=>x.includes(tag));
  const db=async()=>Object.fromEntries(Object.entries(await p.evaluate(()=>window.__mockdb())).filter(([k])=>k.startsWith(P+"sets/")).map(([k,v])=>[k.slice((P+"sets/").length),v]));

  await section("Spot it: the scene matches the word's register", async()=>{
    await start({"terms/c":W("contrive",{usage:"Formal; common in reviews and essays.",deep:{register:"Sounds stiff in casual slang."}})});
    await p.click('#nav-words'); await p.click('#spot-open'); await p.click('#spot-start'); await p.waitForTimeout(500);
    const sp=(await prompts("SPOT IT — SITUATIONS")).pop()||"";
    ok("the request says how the word is used (usage + Go deeper's register)", sp.includes("How it's used (register): Formal; common in reviews and essays. Sounds stiff in casual slang."));
    ok("…and tells Claude to match the scene to it", sp.includes("MATCH THE REGISTER"));
    await p.fill('#spot-reply','The ending felt contrived.'); await p.click('#spot-check'); await p.waitForTimeout(400);
    ok("the check also knows the register", ((await prompts("SPOT IT — CHECK")).pop()||"").includes("HOW IT'S USED (register): Formal;"));
  });

  await section("Compare: any form of a word counts", async()=>{
    await start({"terms/h":W("hold",{usage:"Neutral; very common at work."}),"sets/s":SET(["hold","postpone"])});
    await p.click('#nav-compare'); await p.click('#cmp-round-open'); await p.click('#cr-start'); await p.waitForTimeout(500);
    ok("the round says so on screen", (await p.textContent('#cr-item .cr-anyform')).includes("on hold for hold"));
    const sp=(await prompts("COMPARE — SITUATIONS")).filter(x=>x.includes("WORDS:")).pop()||"";
    ok("the situations request includes the saved word's register", sp.includes('HOW "hold" IS USED: Neutral; very common at work.'));
    const sits=await p.$$eval('#cr-item .cr-sit .spot-sit',xs=>xs.map(x=>x.textContent));
    for(let i=0;i<sits.length;i++){
      const k=Number((sits[i].match(/case (\d+)/)||[])[1])-1;
      await p.fill('#cr-item .cr-sit[data-i="'+i+'"] .cr-reply', k===0 ? "Let's put the rollout on hold for now." : "We've postponed it to May.");
    }
    await p.click('#cr-check'); await p.waitForTimeout(400);
    ok("the check request says any natural form counts", ((await prompts("COMPARE — CHECK")).pop()||"").includes("ANY natural form"));
    ok("'on hold' counts as hold and 'postponed' as postpone → all right", (await p.textContent('#cr-result')).includes("All chosen right") && Object.values(await db())[0].compare.last==="right");
  });

  await section("Prepositions: no 'any form' line", async()=>{
    await start({"sets/s":SET(["by","until"],{kind:"prepositions"})});
    await p.click('#nav-compare'); await p.click('#cmp-round-open'); await p.click('#cr-start'); await p.waitForTimeout(500);
    ok("not shown for a prepositions set", (await p.$$('#cr-item .cr-anyform')).length===0 && await p.isVisible('#cr-item .cr-sit'));
  });

  ok("no page errors ("+errs.join(" | ").slice(0,160)+")", errs.length===0);
  await b.close();
})();
