const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/terms/", NOW=Date.now(), D=86400000;
const W=(term,extra)=>Object.assign({createdAt:NOW-3600000,term,kind:"phrase",meaning:"meaning of "+term,usage:"u",example:"An example with "+term+".",theme:"At Work",level:"B2",fromScene:""},extra||{});
const sp=(last,ago,extra)=>({spot:Object.assign({last,at:NOW-ago*D,history:[{at:NOW-ago*D,stage:last}]},extra||{})});
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const start=async(docs)=>{ await p.goto('about:blank'); await p.goto(URL); await p.evaluate(([d,P])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); },[docs,P]); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700); };
  const line=async()=> (await p.isVisible('#spotdue')) ? (await p.textContent('#spotdue .spotdue span')).trim() : "";

  await section("Home page: due again and new, counted separately", async()=>{
    await start({n1:W("fire away"),n2:W("touch base"),d1:W("park",sp("hint",5)),r1:W("caveat",sp("nocue",1)),x1:W("mock",sp("nocue",1,{resetAt:NOW-1000}))});
    ok("the line shows on the home page: "+await line(), (await line())==="Spot it: 2 due again · 2 new");
    ok("…on the first page you see (themes), without opening anything", await p.isVisible('#v-themes') && await p.isVisible('#spotdue'));
    ok("it's a line with Start and Got it", await p.isVisible('#spotdue-go') && await p.isVisible('#spotdue-ok') && (await p.$$('#spotdue button')).length===2);   /* v26: Got it added on Siyy's request */
    await p.click('#nav-words'); await p.waitForTimeout(150);
    ok("the Spot it button on Words shows the same count", (await p.textContent('#spot-count'))==="2 due again · 2 new");
    await p.click('#nav-practice'); await p.waitForTimeout(150);
    await p.click('#spotdue-go'); await p.waitForTimeout(200);
    ok("Start opens Spot it", await p.isVisible('#v-spot') && await p.isVisible('#spot-start'));
  });

  await section("Only new words: no '0 due again'", async()=>{
    await start({n1:W("fire away"),n2:W("touch base"),n3:W("park")});
    ok("'Spot it: 3 new'", (await line())==="Spot it: 3 new");
  });

  await section("Nothing due: the line goes away", async()=>{
    await start({r1:W("caveat",sp("nocue",1)),r2:W("park",sp("hint",1))});
    ok("no line on the home page", !(await p.isVisible('#spotdue')));
    await p.click('#nav-words'); await p.waitForTimeout(150);
    ok("no count next to the Spot it button", (await p.textContent('#spot-count'))==="");
  });

  await section("The count updates after a round", async()=>{
    await start({n1:W("fire away"),n2:W("touch base")});
    ok("before: 2 new", (await line())==="Spot it: 2 new");
    await p.click('#spotdue-go'); await p.click('#spot-n .chip >> text=1'); await p.click('#spot-start'); await p.waitForTimeout(600);
    await p.fill('#spot-reply','Sure, fire away, and let us touch base later.'); await p.click('#spot-check'); await p.waitForTimeout(400);
    await p.click('#spot-exit'); await p.waitForTimeout(150);
    ok("Words count after the round: 1 new", (await p.textContent('#spot-count'))==="1 new");
    await p.click('#nav-practice'); await p.waitForTimeout(150);
    ok("home line after the round: 1 new", (await line())==="Spot it: 1 new");
  });

  ok("no page errors ("+errs.join(" | ").slice(0,120)+")", errs.length===0);
  await b.close();
})();
