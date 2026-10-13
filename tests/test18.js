const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/terms/", NOW=Date.now(), H=3600000;
const W=(term,ago,extra)=>Object.assign({createdAt:NOW-ago*H,term,kind:"phrase",meaning:"meaning of "+term,usage:"u",example:"An example with "+term+".",theme:"At Work",level:"B2",fromScene:""},extra||{});
const BANK={h1:W("hold",3,{meaning:"to organise and run an event"}), h2:W("hold up",1,{meaning:"to delay something"}),
  h3:W("hold someone's hand",2,{meaning:"to guide someone step by step",theme:"Family & Friends"}),
  r:W("reverse",5), pk:W("park",6),
  o1:W("a one-off",7,{theme:"Small Talk"}), o2:W("a queue building up",8,{theme:"Small Talk"}),
  l1:W("loop in",30), l2:W("loop someone in",4,{theme:"Small Talk"})};
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const start=async(docs)=>{ await p.goto('about:blank'); await p.goto(URL); await p.evaluate(([d,P])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); },[docs,P]); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700); await p.click('#nav-words'); await p.waitForTimeout(150); };
  const G='.wgroup[data-root="hold"]';
  const sectionOf=sel=>p.$eval(sel,e=>{ let c=e.closest('.card'); let h=c&&c.previousElementSibling; while(h&&!h.classList.contains('groupname')) h=h.previousElementSibling; return h?h.firstChild.textContent:""; });

  await section("All: one group for the word", async()=>{
    await start(BANK);
    ok("hold's 3 meanings are ONE group", (await p.$$(G)).length===1);
    ok("it sits under At Work (2 of its 3 meanings)", (await sectionOf(G))==="At Work");
    ok("no Family & Friends heading (its only entry is in the hold group)", !(await p.$$eval('#wordlist .groupname',hs=>hs.some(h=>h.textContent.startsWith("Family")))));
    const head=await p.textContent(G+' .wgroup-head');
    ok("closed: label '3 meanings', and it lists the expressions", head.includes("3 meanings") && head.includes("hold up") && head.includes("hold someone's hand"));
    ok("closed: the meanings' rows are not shown", (await p.$$(G+' .wordrow')).length===0);
    ok("a word with one meaning looks as before (a plain row)", (await p.$$('.wordrow[data-id="r"]')).length===1 && !(await p.$('.wgroup .wordrow[data-id="r"]')));
    await p.click(G+' .wgroup-head'); await p.waitForTimeout(150);
    ok("open: 3 rows", (await p.$$(G+' .wordrow')).length===3);
    ok("the meaning from another theme carries its theme label", (await p.textContent(G+' .wordrow[data-id="h3"] .thlabel'))==="Family & Friends" && (await p.$$(G+' .thlabel')).length===1);
    ok("rows inside a group have no '2 meanings'-style label of their own", (await p.$$(G+' .wordrow .meantag')).length===0);
    await p.click(G+' .wordrow[data-id="h2"] .wordbtn'); await p.waitForTimeout(150);
    ok("tapping a meaning opens its own entry, and the group stays open", await p.isVisible(G+' .wordrow[data-id="h2"] .worddetail') && (await p.$$(G+' .wordrow')).length===3);
    await p.click(G+' .wgroup-head'); await p.waitForTimeout(150);
    ok("closing the group hides the rows again", (await p.$$(G+' .wordrow')).length===0);
  });

  await section("A theme chip: only that theme's meanings", async()=>{
    await start(BANK);
    await p.click('#wordlist .chip >> text=At Work'); await p.waitForTimeout(150);
    ok("label says '2 meanings here'", (await p.textContent(G+' .wgroup-head .meantag'))==="2 meanings here");
    await p.click(G+' .wgroup-head'); await p.waitForTimeout(150);
    ok("open: the 2 work meanings only", (await p.$$(G+' .wordrow')).length===2 && !(await p.$(G+' .wordrow[data-id="h3"]')));
    ok("a line points to the other meaning", (await p.textContent(G+' .wgroup-more'))==="+1 more meaning in Family & Friends →");
    await p.click(G+' .wgroup-more'); await p.waitForTimeout(200);
    ok("…and takes you to Family & Friends", (await p.getAttribute('#wordlist .chip[aria-pressed="true"]','aria-pressed'))==="true" && (await p.textContent('#wordlist .chip[aria-pressed="true"]')).startsWith("Family & Friends"));
    ok("there: '1 meaning here', open, with '+2 more meanings in At Work →'", (await p.textContent(G+' .wgroup-head .meantag'))==="1 meaning here" && (await p.$$(G+' .wordrow')).length===1 && (await p.textContent(G+' .wgroup-more'))==="+2 more meanings in At Work →");
  });

  await section("Where a group sits in All: a tie goes to the newest meaning's theme", async()=>{
    await start(BANK);
    ok("loop (1 At Work, 1 Small Talk; Small Talk is newer) sits under Small Talk", (await sectionOf('.wgroup[data-root="loop"]'))==="Small Talk");
  });

  await section("a / an / the don't make a group", async()=>{
    await start(BANK);
    ok("'a one-off' and 'a queue building up' stay separate rows", (await p.$$('.wordrow[data-id="o1"]')).length===1 && (await p.$$('.wordrow[data-id="o2"]')).length===1 && (await p.$$('.wgroup[data-root="a"]')).length===0);
  });

  await section("Search shows a flat list", async()=>{
    await start(BANK);
    await p.fill('#word-q','hold'); await p.waitForTimeout(150);
    ok("3 rows, no groups", (await p.$$('#wordlist .wordrow')).length===3 && (await p.$$('#wordlist .wgroup')).length===0);
  });

  ok("no page errors ("+errs.join(" | ").slice(0,120)+")", errs.length===0);
  await b.close();
})();
