const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/preview-mock.html';
const NOW=Date.now(), P="data/users/u_test/store/";
const T=(term,extra)=>Object.assign({createdAt:NOW-3600000,term,kind:"phrase",meaning:"a very long meaning that keeps going so that it would never fit on one short line next to the word and its tags and the date at the end",usage:"u",example:"e",theme:"At Work",level:"B2",fromScene:""},extra||{});
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1200}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const setDb=d=>p.evaluate(d=>localStorage.setItem('__mockdb',JSON.stringify(d)),d);
  const addDoc=(k,v)=>p.evaluate(([k,v])=>{ const d=window.__mockdb(); d[k]=v; localStorage.setItem('__mockdb',JSON.stringify(d)); },[k,v]);

  console.log("— Words that exist ONLY in the cloud (the real bug) —");
  await p.goto('about:blank'); await p.goto(URL); await p.evaluate(()=>localStorage.clear());
  await setDb({[P+"terms/tA"]:T("knock-on effect",{source:"note"}),[P+"terms/tB"]:T("fire away",{source:"chat",createdAt:NOW-60000})});
  await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700);
  ok("no page errors on load", errs.length===0);
  ok("banner shows the chat-saved word on entering", await p.isVisible('#chatnews') && (await p.textContent('#chatnews')).includes("fire away"));
  await p.click('#nav-words'); await p.waitForTimeout(200);
  ok("cloud-only words appear in the word bank", await p.isVisible('.wordbtn:has-text("fire away")') && await p.isVisible('.wordbtn:has-text("knock-on effect")'));
  ok("no 'couldn't load' warning", !(await p.textContent('#wordlist')).includes("Couldn't load"));

  console.log("— Saved from a chat while SS is open —");
  await addDoc(P+"terms/tC",T("touch base",{source:"chat",createdAt:Date.now()}));
  await p.waitForTimeout(900);
  ok("new word appears without a reload", await p.isVisible('.wordbtn:has-text("touch base")'));
  ok("…with a NEW tag", await p.isVisible('.wordrow:has-text("touch base") .newtag'));
  await p.click('#nav-practice'); await p.waitForTimeout(150);
  const bn=await p.textContent('#chatnews');
  ok("home banner now lists both new words", bn.includes("touch base") && bn.includes("fire away"));
  await p.click('#nav-words');
  await p.evaluate(k=>{ const d=window.__mockdb(); delete d[k]; localStorage.setItem('__mockdb',JSON.stringify(d)); },P+"terms/tA");
  await p.waitForTimeout(900);
  ok("a word deleted elsewhere disappears too", await p.isHidden('.wordbtn:has-text("knock-on effect")'));

  console.log("— Full meaning —");
  await p.click('.wordbtn:has-text("fire away")'); await p.waitForTimeout(150);
  ok("open entry shows the full meaning", (await p.textContent('.worddetail:visible .term-mean')).includes("the date at the end"));
  const lines=await p.$eval('.wordrow:has-text("touch base") .peek',e=>Math.round(e.getBoundingClientRect().height/parseFloat(getComputedStyle(e).lineHeight)));
  ok("closed row shows up to 2 lines of meaning (shows "+lines+")", lines===2);
  await p.screenshot({path:'v10-words.png',fullPage:true});

  console.log("— Your own saves don't make the page jump —");
  await p.click('#note-open'); await p.fill('#note-term','slip through the cracks'); await p.click('#note-go'); await p.waitForTimeout(1200);
  ok("note saved once, not duplicated by the live update", (await p.$$('.wordbtn:has-text("slip through the cracks")')).length===1);

  console.log("— Profile box —");
  await p.click('#nav-practice'); await p.waitForTimeout(100);
  ok("profile box is closed", !(await p.$eval('#setup-box',d=>d.open)));

  console.log("— A failed read is not hidden by a later save —");
  await p.evaluate(()=>{ localStorage.setItem('__mockReadFail','1'); });
  await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700);
  await p.click('#nav-words'); await p.click('#note-open'); await p.fill('#note-term','loop in'); await p.click('#note-go'); await p.waitForTimeout(800);
  ok("warning stays after a successful save", (await p.textContent('#wordlist')).includes("Couldn't load from your account"));
  await p.evaluate(()=>localStorage.removeItem('__mockReadFail')); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700);
  await p.click('#nav-words');
  ok("after it recovers: no warning", !(await p.textContent('#wordlist')).includes("Couldn't load"));
  const nDb=await p.evaluate(()=>Object.keys(window.__mockdb()).filter(k=>k.includes('/terms/')).length);
  if(await p.$('.showall')) { await p.click('.showall'); await p.waitForTimeout(150); }   /* v15: show the whole theme */
  ok("the word saved during the failure is in the cloud and on screen ("+nDb+" words)", nDb===4 && (await p.$$('.wordrow')).length===nDb);
  ok("no page errors: "+errs.join(" | "), errs.length===0);
  await b.close();
})();
