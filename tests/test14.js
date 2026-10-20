const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/preview-mock.html';
const P="data/users/u_test/store/terms/", NOW=Date.now();
const W=(term,i,extra)=>Object.assign({createdAt:NOW-i*60000,term,kind:"phrase",meaning:"meaning of "+term,usage:"u",example:"e",theme:"At Work",level:"B2",fromScene:""},extra||{});
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:800}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const start=async(d)=>{ await p.goto('about:blank'); await p.goto(URL); await p.evaluate(([d])=>{ localStorage.clear(); localStorage.setItem('__mockdb',JSON.stringify(d)); },[d]); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700); await p.click('#nav-words'); await p.waitForTimeout(150); };

  console.log("— Opening a word near the bottom keeps your place —");
  const many={}; for(let i=0;i<25;i++) many[P+"t"+i]=W("n"+i+" phrase number "+i,i);   /* v18: each its own first word, or they would form one group */
  await start(many);
  await p.click('.showall'); await p.waitForTimeout(150);   /* v15: show the whole theme first */
  await p.evaluate(()=>{ document.querySelector('#wordlist .chips').__marker=1; document.querySelector('.wordrow[data-id="t3"]').__marker=1; });
  await p.click('.wordbtn:has-text("phrase number 3")'); await p.waitForTimeout(100);
  ok("opening a word redraws only its row (the rest of the list is untouched)", await p.evaluate(()=>document.querySelector('#wordlist .chips').__marker===1 && document.querySelector('.wordrow[data-id="t3"]').__marker!==1));
  await p.click('.wordbtn:has-text("phrase number 5")'); await p.waitForTimeout(100);
  ok("opening another closes the first", await p.isHidden('.wordrow[data-id="t3"] .worddetail') && await p.isVisible('.wordrow[data-id="t5"] .worddetail'));
  await p.click('.wordbtn:has-text("phrase number 5")'); await p.waitForTimeout(100);
  await p.evaluate(()=>window.scrollTo(0,0));
  await p.locator('.wordbtn:has-text("phrase number 24")').scrollIntoViewIfNeeded();
  const y0=await p.evaluate(()=>window.scrollY);
  ok("scrolled down first (y="+Math.round(y0)+")", y0>500);
  await p.click('.wordbtn:has-text("phrase number 24")'); await p.waitForTimeout(200);
  const y1=await p.evaluate(()=>window.scrollY);
  ok("page does NOT jump to the top (y="+Math.round(y1)+")", Math.abs(y1-y0)<40);
  const inView=await p.$eval('.wordrow:has-text("phrase number 24") .worddetail',e=>{ const r=e.getBoundingClientRect(); return r.top<window.innerHeight && r.bottom>0; });
  ok("the opened entry is on screen", inView);
  await p.click('.wordbtn:has-text("phrase number 24")'); await p.waitForTimeout(200);
  ok("closing it keeps your place too", Math.abs((await p.evaluate(()=>window.scrollY))-y0)<40);
  await p.click('.wordrow:has-text("phrase number 23") .trash'); await p.click('#confirm-no'); await p.waitForTimeout(100);
  ok("tick a box near the bottom: still in place", Math.abs((await p.evaluate(()=>window.scrollY))-y0)<40);
  await p.click('#nav-cards'); await p.click('#nav-words'); await p.waitForTimeout(150);
  ok("switching to Words from another tab still starts at the top", (await p.evaluate(()=>window.scrollY))<5);

  console.log("— A miss in Spot it never gives the answer away —");
  await start({[P+"tSort"]:W("sort it out",1,{situation:"From the scene “Wrong Order at the Kopitiam”."})});
  await p.click('#spot-open'); await p.click('#spot-start'); await p.waitForTimeout(500);
  await p.fill('#spot-reply','I will fix the problem.'); await p.click('#spot-check'); await p.waitForTimeout(400);
  const page1=await p.textContent('#v-spot');
  ok("after a miss: no 'sort it out' anywhere on the page", !/sort it out/i.test(page1));
  ok("…a neutral message instead", page1.includes("Not quite — you saved a word that fits here. Here's a hint."));
  ok("…and the hint", await p.isVisible('#spot-hint'));
  /* v38: opening a word also asks how to say it, so this reads the last request that is NOT that one */
  const cp=await p.evaluate(()=>window.__prompts.filter(x=>x.indexOf("HOW TO SAY IT.")!==0).slice(-1)[0]);
  ok("check request tells Claude not to name the word on a miss", cp.includes("must NOT name or hint at the target expression"));
  await p.fill('#spot-reply','I will handle it.'); await p.click('#spot-check'); await p.waitForTimeout(400);
  ok("second miss: now the word may appear (bridge)", await p.isVisible('#spot-bridge') && (await p.textContent('#v-spot')).includes("Not quite — here's the word."));
  ok("no page errors: "+errs.join(" | "), errs.length===0);
  await b.close();
})();
