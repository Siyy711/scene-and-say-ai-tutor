const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1100},deviceScaleFactor:2});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+process.cwd()+'/preview-mock.html');

  console.log("— First visit: everything empty —");
  await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
  ok("box is CLOSED on a first visit too (Siyy's choice)", !(await p.$eval('#setup-box',d=>d.open)) && !(await p.isVisible('#occ')));
  /* v30 (M3): the grey example is a made-up life, not the owner's own, because the page is public */
  ok("life example is a made-up life", (await p.$eval('#life',e=>e.placeholder))==="e.g. share a flat with two friends, take the bus to work, cook on weekends, video-call my sister on Sundays");
  await p.click('#setup-sum');
  ok("one click opens it, job field visible", await p.$eval('#setup-box',d=>d.open) && await p.isVisible('#occ'));
  await p.fill('#occ','supply chain consultant'); await p.fill('#place','Singapore'); await p.fill('#life','gym three times a week');
  await p.click('.lvl >> text=B2');
  const line=await p.textContent('#setup-line');
  ok("summary line updates live: "+line, line.includes("B2") && line.includes("supply chain consultant") && line.includes("Singapore") && line.includes("life notes added"));
  await p.screenshot({path:'v7-open.png',clip:{x:0,y:0,width:900,height:1100}});

  console.log("— Coming back: settings filled —");
  await p.reload(); await p.waitForTimeout(500);
  ok("box is closed when settings are filled", !(await p.$eval('#setup-box',d=>d.open)));
  ok("job field hidden while closed", !(await p.isVisible('#occ')));
  ok("summary still shows the profile", (await p.textContent('#setup-line')).includes("B2 · supply chain consultant · Singapore"));
  ok("settings were kept", (await p.inputValue('#occ'))==="supply chain consultant" && (await p.inputValue('#life'))==="gym three times a week");
  ok("themes are visible without scrolling past settings", await p.isVisible('.theme >> nth=0'));
  await p.screenshot({path:'v7-closed.png',clip:{x:0,y:0,width:900,height:900}});
  await p.click('#setup-sum');
  ok("one click opens it", await p.$eval('#setup-box',d=>d.open) && await p.isVisible('#occ'));
  await p.click('#setup-sum');
  ok("a second click closes it", !(await p.$eval('#setup-box',d=>d.open)));

  console.log("— Level change from outside the box —");
  await p.click('#setup-sum'); await p.click('.lvl >> text=C1'); await p.click('#setup-sum');
  ok("summary shows the new level after closing", (await p.textContent('#setup-line')).startsWith("C1"));
  ok("header readout still works", (await p.textContent('#readout')).startsWith("C1"));

  console.log("— Phone width —");
  await p.setViewportSize({width:390,height:844}); await p.waitForTimeout(200);
  const over=await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  ok("no sideways scroll on a phone", !over);
  await p.screenshot({path:'v7-phone.png'});
  ok("no page errors: "+errs.join(" | "), errs.length===0);
  await b.close();
})();
