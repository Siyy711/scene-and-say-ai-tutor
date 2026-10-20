// v37 (Siyy, 20 Oct): after "+ Add a note", the search field slid on top of the Spot it button, and the messages
// ("Added … under …", "Worth knowing: …") never went away. The messages sat inside the narrow button column next to the
// search field, so that column grew and squeezed the search field to nothing. Now they get their own full-width row
// under the search field, a Close button, and they go when you start another note, open Spot it or leave Words.
const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/preview-mock.html';
const P="data/users/u_test/store/", NOW=Date.now();
const DB={"terms/a":{createdAt:NOW-3600000,term:"touch base",kind:"phrase",meaning:"talk briefly",usage:"",example:"Let's touch base on Monday.",theme:"At Work",level:"B2",fromScene:""}};
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const errs=[];
  let p, ctx;
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const open=async(w,scheme)=>{
    if(ctx) await ctx.close();
    ctx=await b.newContext({viewport:{width:w,height:900},colorScheme:scheme||'light'}); p=await ctx.newPage();
    p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
    await p.goto(URL);
    await p.evaluate(([d,P])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); },[DB,P]);
    await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700);
    await p.click('#nav-words'); await p.waitForTimeout(300);
  };
  const box=sel=>p.$eval(sel,e=>{ const r=e.getBoundingClientRect(); return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height}; });
  const hit=(a,c)=>!(a.r<=c.l||a.l>=c.r||a.b<=c.t||a.t>=c.b);
  const addNote=async term=>{ await p.click('#note-open'); await p.fill('#note-term',term); await p.click('#note-go'); await p.waitForTimeout(800); };
  const news=()=>p.evaluate(()=>[...document.querySelectorAll('#note-done,#note-check')].filter(e=>e.offsetParent).length);

  for(const w of [1280,900,400]){
    await section(w+"px: after adding a note, the search field and the buttons stay apart", async()=>{
      await open(w, w===900?'dark':'light');
      const before=await box('#word-q');
      await addNote('slipped through the cracks');
      ok("the messages are shown (Added …, Worth knowing …)", await news()===2 && (await p.textContent('#note-done')).includes("Added"));
      const q=await box('#word-q'), sp=await box('#spot-open'), add=await box('#note-open');
      ok("the search field does not cover Spot it or + Add a note", !hit(q,sp) && !hit(q,add));
      ok("the search field keeps its width ("+Math.round(before.w)+" → "+Math.round(q.w)+"px)", Math.abs(q.w-before.w)<2);
      const d=await box('#note-done'), list=await box('#wordlist');
      ok("the messages sit in their own row, under the search field and above the list", d.t>=q.b && d.b<=list.t+1);
      ok("…as wide as the word list", Math.abs(d.w-list.w)<2 || Math.abs(d.l-list.l)<2 && Math.abs(d.r-list.r)<2);
    });
  }

  await section("The messages go away", async()=>{
    await open(1280);
    await addNote('slipped through the cracks');
    ok("there is a Close button that says what it does", await p.$eval('#notenews .btn',x=>x.textContent.trim()==="Close" && x.getAttribute('aria-label')==="Close these messages"));
    await p.click('#notenews .btn'); await p.waitForTimeout(150);
    ok("Close: the messages are gone, and so is their row", await news()===0 && await p.isHidden('#notenews'));
    await addNote('slipped through the cracks');
    await p.click('#note-open'); await p.waitForTimeout(150);
    ok("starting another note clears the last note's messages", await news()===0);
    await p.click('#note-form .btn:has-text("Cancel")'); await p.waitForTimeout(150);
    await addNote('slipped through the cracks');
    await p.click('#nav-cards'); await p.waitForTimeout(200); await p.click('#nav-words'); await p.waitForTimeout(200);
    ok("leaving Words and coming back: the messages are gone", await news()===0);
    await addNote('slipped through the cracks');
    await p.click('#spot-open'); await p.waitForTimeout(200); await p.click('#spot-exit'); await p.waitForTimeout(200);
    ok("opening Spot it and coming back: the messages are gone", await news()===0);
  });

  ok("no page errors ("+errs.join(" | ").slice(0,160)+")", errs.length===0);
  if(ctx) await ctx.close();
  await b.close();
})();
