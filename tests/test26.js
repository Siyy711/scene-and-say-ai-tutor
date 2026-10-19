const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  for(const w of [900,430]) try{
    const p=await b.newPage({viewport:{width:w,height:1000}});
    await p.goto(URL); await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('ss.occupation','MES consultant'); localStorage.setItem('ss.acadField','PhD in Philosophy'); localStorage.setItem('__mockdb','{}'); });
    await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(500);
    const box=async(n)=>p.$eval('#themegrid .theme:has(b:text-is("'+n+'"))',e=>{ const r=e.getBoundingClientRect(), s=getComputedStyle(e); return {w:Math.round(r.width),bg:s.backgroundColor,bc:s.borderColor}; });
    const work=await box("At Work"), acad=await box("Academic & Research");
    ok(w+"px: same width as At Work ("+acad.w+" vs "+work.w+")", acad.w===work.w);
    ok(w+"px: same gold background and border", acad.bg===work.bg && acad.bc===work.bc);
    /* v29: "tuned to:" became "For you:" (M2 round 5a) */
    ok(w+"px: still says what it's tuned to", (await p.textContent('#themegrid .theme.acad .egs'))==="For you: PhD in Philosophy");
    await p.close();
  }catch(e){ ok(w+"px section ran to the end ("+String(e.message).split("\n")[0].slice(0,60)+")",false); }
  /* "Got it" on the home-page lines */
  try{
    const p=await b.newPage({viewport:{width:900,height:1000}});
    const NOW=Date.now(), P="data/users/u_test/store/";
    const db={}; db[P+"terms/a"]={createdAt:NOW,term:"caveat",kind:"word",meaning:"m",usage:"u",example:"e",theme:"At Work",level:"B2",fromScene:""};
    db[P+"sets/s"]={createdAt:NOW,words:["park","pull back"],kind:"words",topic:"",source:"own",explain:{core:"c",uses:[]}};
    await p.goto(URL); await p.evaluate(d=>{ localStorage.clear(); localStorage.setItem('__mockdb',JSON.stringify(d)); },db);
    await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(600);
    ok("both lines have 'Got it'", await p.isVisible('#spotdue-ok') && await p.isVisible('#cmpdue-ok'));
    await p.click('#spotdue-ok'); await p.waitForTimeout(100);
    ok("Got it hides the Spot it line, the Compare line stays", !(await p.isVisible('#spotdue-go')) && await p.isVisible('#cmpdue-go'));
    await p.click('#cmpdue-ok'); await p.waitForTimeout(100);
    ok("both hidden → the whole box goes", !(await p.isVisible('#spotdue')));
    await p.goto('about:blank'); await p.goto(URL+'#db'); await p.waitForTimeout(600);
    ok("still hidden after reload (same day)", !(await p.isVisible('#spotdue')));
    await p.click('#nav-words'); await p.waitForTimeout(150);
    ok("v33: Words shows no count, whether the board is hidden or not", (await p.$$('#spot-count, .spotcount')).length===0 && (await p.textContent('#spot-open')).trim()==="Spot it");
    await p.evaluate(()=>{ const h=JSON.parse(localStorage.getItem('ss.dueHidden')); h.spot="2000-1-1"; h.cmp="2000-1-1"; localStorage.setItem('ss.dueHidden',JSON.stringify(h)); });
    await p.goto('about:blank'); await p.goto(URL+'#db'); await p.waitForTimeout(600);
    ok("on another day they come back", await p.isVisible('#spotdue-go') && await p.isVisible('#cmpdue-go'));
    await p.close();
  }catch(e){ ok("Got it section ran to the end ("+String(e.message).split("\n")[0].slice(0,60)+")",false); }
  await b.close();
})();
