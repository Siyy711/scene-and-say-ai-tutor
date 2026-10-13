const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/preview-mock.html';
const OLDT={createdAt:Date.now()-5000,term:"on the blink",kind:"idiom",meaning:"not working",usage:"Informal.",example:"The boiler's on the blink.",theme:"Home & Neighbours",level:"B1",
  deep:{summary:"Old entry.",register:"Informal.",collocations:[],confusedWith:[],contexts:[],citations:[]}};
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1300},deviceScaleFactor:1});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL+'#db');
  await p.evaluate(o=>{ localStorage.clear(); localStorage.setItem('ss.occupation','supply chain consultant');
    localStorage.setItem('__mockdb',JSON.stringify({"data/users/u_test/store/terms/tOld":o})); },OLDT);
  await p.reload(); await p.waitForTimeout(600);
  const db=()=>p.evaluate(()=>window.__mockdb());
  const last=()=>p.evaluate(()=>window.__prompts[window.__prompts.length-1]);

  console.log("— Add a note, with a picture —");
  await p.click('#nav-words'); await p.waitForTimeout(200);
  ok("old word loaded from the cloud", await p.isVisible('.wordbtn >> text=on the blink'));
  ok("'+ Add a note' button is there", await p.isVisible('#note-open'));
  await p.click('#note-open');
  ok("form opens", await p.isVisible('#note-form'));
  await p.click('#note-go');
  ok("empty phrase is refused with a message", (await p.textContent('#note-msg')).includes("Type the word"));
  await p.fill('#note-term','slipped through the cracks');
  await p.fill('#note-sit','Suits S2E3, Harvey says it when a client file goes missing');
  await p.setInputFiles('#note-pic','test-shot.png'); await p.waitForTimeout(800);
  const src=await p.getAttribute('.note-prev img','src');
  ok("big picture (3000×2000) is shrunk to "+Math.round(src.length/1024)+" KB as text", src.startsWith("data:image/jpeg") && src.length<=200000);
  await p.screenshot({path:'v8-form.png',fullPage:false});
  await p.click('#note-go'); await p.waitForTimeout(700);
  const np=await last();
  ok("request includes the phrase, the situation and the theme list", np.includes("EXPRESSION: slipped through the cracks") && np.includes("Suits S2E3") && np.includes("Food & Eating Out | Shopping & Money") && np.includes("| At Work | Academic & Research\"") );   /* v24: the new theme is in the list */
  ok("request mentions your job", np.includes("supply chain consultant"));
  ok("confirmation names the theme", (await p.textContent('#note-done')).includes("under At Work"));
  ok("Claude's check is shown", (await p.textContent('#note-check')).includes("usual form"));
  ok("form is closed and reset", await p.isVisible('#note-open') && await p.isHidden('#note-form'));
  ok("new word shows the 'my note' label", await p.isVisible('.wordrow:has-text("slip through the cracks") .srctag >> text=my note'));
  ok("entry opens with 'Where you met it'", (await p.textContent('.worddetail:visible .term-where')).includes("Suits S2E3"));
  ok("picture is shown in the entry", await p.isVisible('.worddetail:visible .word-pic img'));
  ok("Claude wrote an example (none was given)", (await p.textContent('.worddetail:visible .term-eg')).includes("Small tasks"));
  let d=await db();
  const tkey=Object.keys(d).find(k=>k.includes('/terms/')&&d[k].term==="slip through the cracks");
  const pkey=Object.keys(d).find(k=>k.includes('/pics/'));
  ok("word saved in the cloud with source 'note'", !!tkey && d[tkey].source==="note" && d[tkey].theme==="At Work");
  ok("picture saved in its own collection, linked both ways", !!pkey && d[tkey].pic===pkey.split('/').pop() && d[pkey].termId===tkey.split('/').pop());
  ok("picture item is under the 256 KB limit ("+Math.round(JSON.stringify(d[pkey]).length/1024)+" KB)", JSON.stringify(d[pkey]).length<256*1024);
  ok("picture is NOT in browser storage", !(await p.evaluate(()=>localStorage.getItem('ss.terms.v1'))).includes("data:image"));
  await p.screenshot({path:'v8-entry.png',fullPage:true});

  console.log("— Reload: still there —");
  await p.reload(); await p.waitForTimeout(600);
  await p.click('#nav-words'); await p.waitForTimeout(200);
  await p.click('.wordbtn:has-text("slip through the cracks")'); await p.waitForTimeout(300);
  ok("picture loads again from the cloud after reload", await p.isVisible('.worddetail:visible .word-pic img'));

  console.log("— Move to another theme —");
  await p.selectOption('.worddetail:visible select.themesel','Small Talk'); await p.waitForTimeout(300);
  d=await db();
  ok("theme changed in the cloud", d[tkey].theme==="Small Talk");
  ok("word now listed under Small Talk", (await p.$$eval('.groupname',els=>els.map(e=>e.textContent))).some(t=>t.startsWith("Small Talk")));

  console.log("— Go deeper: At work —");
  await p.click('.worddetail:visible >> text=Go deeper'); await p.waitForTimeout(400);
  const dp=await last();
  ok("deep request asks for an at-work sentence, tailored to your job", dp.includes('"atWork"') && dp.includes("works as supply chain consultant") && dp.includes("never force it"));
  ok("'At work' sentence shown", (await p.textContent('.worddetail:visible')).includes("Can we add a checklist"));
  await p.click('.wordbtn:has-text("on the blink")'); await p.waitForTimeout(200);
  ok("old deep dive (no at-work field) shows no 'At work' section and no button", !(await p.textContent('.worddetail:visible')).includes("At work") && !(await p.isVisible('.worddetail:visible >> text=Add a workplace example')));

  console.log("— Remove: picture goes too —");
  await p.click('.wordbtn:has-text("slip through the cracks")'); await p.waitForTimeout(200);
  await p.click('.worddetail:visible >> text=Delete this word'); await p.waitForTimeout(150);
  ok("a confirm appears before deleting", await p.isVisible('#confirm'));
  await p.click('#confirm-yes'); await p.waitForTimeout(300);
  d=await db();
  ok("word and its picture both deleted", !d[tkey] && !d[pkey]);

  console.log("— Own example sentence is kept —");
  await p.click('#note-open'); await p.fill('#note-term','slip through the cracks'); await p.fill('#note-eg','The invoice slipped through the cracks.');
  await p.click('#note-go'); await p.waitForTimeout(500);
  ok("your sentence is used as the example", (await p.textContent('.worddetail:visible .term-eg')).includes("The invoice slipped"));

  console.log("— Paste a screenshot —");
  await p.click('#note-open');
  await p.evaluate(async()=>{
    const c=document.createElement('canvas'); c.width=50; c.height=40; c.getContext('2d').fillRect(0,0,50,40);
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    const dt=new DataTransfer(); dt.items.add(new File([blob],'shot.png',{type:'image/png'}));
    document.getElementById('note-term').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true}));
  }); await p.waitForTimeout(400);
  ok("pasted screenshot shows in the preview", await p.isVisible('.note-prev img'));
  await p.click('#note-form >> text=Cancel');

  console.log("— No cloud storage in this view —");
  const p2=await b.newPage(); p2.on('pageerror',e=>errs.push(e.message));
  await p2.goto(URL); await p2.evaluate(()=>localStorage.clear()); await p2.reload(); await p2.waitForTimeout(500);
  await p2.click('#nav-words'); await p2.click('#note-open'); await p2.fill('#note-term','on the same page');
  await p2.setInputFiles('#note-pic','test-shot.png'); await p2.waitForTimeout(800);
  await p2.click('#note-go'); await p2.waitForTimeout(500);
  ok("word still saved, and you're told the picture wasn't kept", (await p2.textContent('#note-done')).includes("picture wasn't kept"));

  console.log("— Phone width —");
  await p.setViewportSize({width:390,height:844}); await p.click('#note-open'); await p.waitForTimeout(200);
  ok("no sideways scroll on a phone", !(await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)));
  await p.screenshot({path:'v8-phone.png'});
  ok("no page errors: "+errs.join(" | "), errs.length===0);
  await b.close();
})();
