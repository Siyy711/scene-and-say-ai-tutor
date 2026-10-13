const {chromium}=require(process.env.PW||'playwright');
const T=(id,term,theme,meaning)=>({id,createdAt:Date.now()-Number(id.slice(1))*1000,term,kind:"phrase",meaning,usage:"u",example:"e",theme,level:"B1"});
const TERMS=[T("t1","take a look at","Home & Neighbours","examine"),T("t2","playing up","Home & Neighbours","not working"),T("t3","split the bill","Food & Eating Out","share cost"),
             T("t4","run late","Travel & Transport","be delayed"),T("t5","touch base","At Work","check in"),T("t6","on the house","Food & Eating Out","free")];
const OLD={id:"cOld",createdAt:Date.now()-86400000,mode:"story",level:"B1",theme:"Home & Neighbours",title:"The aircon man arrives",setting:"Tuesday.",whatsHappening:"Rattling.",
  userText:"He come.",strengths:[],corrections:[],highlights:[],levelCheck:{sitsAt:"A2",meetsTarget:false,note:"x",readyFor:null},modelStory:"He came.",nextTip:"Past tense."};
const ok=(label,cond)=>console.log((cond?"PASS ":"FAIL ")+label);
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1300},deviceScaleFactor:2});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{ if(m.type()==='error'&&!/net::|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://'+process.cwd()+'/preview-mock.html');
  await p.evaluate(([t,c])=>{localStorage.clear();localStorage.setItem('ss.terms.v1',JSON.stringify(t));localStorage.setItem('ss.cards.v1',JSON.stringify([c]));},[TERMS,OLD]);
  await p.reload(); await p.waitForTimeout(700);
  const prompts=()=>p.evaluate(()=>window.__prompts.slice());
  const tick=id=>p.check(`input[data-term="${id}"]`);

  console.log("— Words: picking —");
  await p.click('#nav-words'); await p.waitForTimeout(150);
  ok("bar hidden with nothing ticked", await p.isHidden('#wordbar'));
  await tick("t1"); await tick("t2");
  ok("bar shows 2 words", /2 words/.test(await p.textContent('#wordbar-sel')));
  ok("button says 'Practise with these 2'", (await p.textContent('#wordbar-go'))==="Practise with these 2");
  await tick("t3"); await tick("t4"); await tick("t5");
  ok("6th box disabled at five", await p.isDisabled('input[data-term="t6"]'));
  await p.click('#wordbar-clear'); await p.waitForTimeout(100);
  ok("Clear hides bar and unticks", await p.isHidden('#wordbar') && !(await p.isChecked('input[data-term="t1"]')));

  console.log("— Scene from two words —");
  await tick("t1"); await tick("t2");
  await p.click('#wordbar-go'); await p.waitForTimeout(400);
  let pr=await prompts(); const sp=pr[pr.length-1];
  ok("scene prompt lists both words", sp.includes("take a look at") && sp.includes("playing up"));
  ok("scene prompt forbids using them", sp.includes("CRITICAL: do NOT use any of the target expressions"));
  ok("eyebrow says word practice", (await p.textContent('#scene-body .eyebrow')).includes("word practice"));
  ok("target chips on scene", (await p.$$('#scene-body .tchip')).length===2);
  ok("scene has BOTH back buttons in word practice", await p.isVisible('#btn-back-themes') && await p.isVisible('#btn-back-words'));
  ok("scene phrases have Pin buttons", (await p.$$('#scene-body .lang-row .pinbtn')).length===5);
  ok("bar hidden after leaving Words", await p.isHidden('#wordbar'));

  console.log("— Tell the story —");
  await p.click('text=Tell the story'); await p.waitForTimeout(150);
  ok("focus banner shows 'Try to use' + 2 chips", (await p.textContent('#story-focus')).includes("Try to use") && (await p.$$('#story-focus .tchip')).length===2);
  await p.fill('#story-text','The plumber came. Could you take a look at the pipe, I asked.');
  await p.click('#btn-check'); await p.waitForTimeout(400);
  pr=await prompts(); const fp=pr[pr.length-1];
  ok("feedback prompt carries TARGET EXPRESSIONS + wordUse rule", fp.includes("TARGET EXPRESSIONS") && fp.includes('For "wordUse"'));
  ok("Target words block: 'used well' + 'not used'", (await p.textContent('.fb-words')).includes("used well") && (await p.textContent('.fb-words')).includes("not used"));
  ok("Worth stealing heading renamed", await p.isVisible('text=Worth stealing · from the model answer'));

  console.log("— More for situations like this —");
  const before=(await prompts()).length;
  await p.click('.fb-more button:has-text("Show them")'); await p.waitForTimeout(300);
  pr=await prompts();
  ok("one extra request made", pr.length===before+1 && pr[pr.length-1].includes("phrase list"));
  ok("excludes what's on screen", pr[pr.length-1].includes("came round") && pr[pr.length-1].includes("That's a relief"));
  ok("grouped by purpose (2 headings, 3 items)", (await p.$$('.fb-more .purpose')).length===2 && (await p.$$('.fb-more .term')).length===3);
  const termsBefore=await p.evaluate(()=>JSON.parse(localStorage.getItem('ss.terms.v1')).length);
  await p.click('.fb-more .term >> nth=1 >> text=Pin this'); await p.waitForTimeout(200);
  const termsAfter=await p.evaluate(()=>JSON.parse(localStorage.getItem('ss.terms.v1')));
  ok("Pin from new list adds to word bank", termsAfter.length===termsBefore+1 && termsAfter.some(t=>t.term==="on the blink"));
  await p.click('.fb-more button:has-text("Hide them")'); await p.waitForTimeout(100);
  ok("Hide collapses, button shows count", (await p.textContent('.fb-more .row button'))==="Show them (3)");

  console.log("— Save —");
  await p.click('#story-out button:has-text("Save as a card")'); await p.waitForTimeout(300);
  let cards=await p.evaluate(()=>JSON.parse(localStorage.getItem('ss.cards.v1')));
  const nc=cards.find(c=>c.id!=="cOld");
  ok("new card has 2 targetWords", nc && nc.targetWords.length===2);
  ok("new card kept sceneExpressions", nc && nc.sceneExpressions && nc.sceneExpressions.length===2);
  ok("attempt stored wordUse", nc && nc.attempts[0].wordUse.length===2);
  ok("new card theme = model's pick", nc && nc.theme==="Home & Neighbours");

  console.log("— Cards view —");
  await p.click('#nav-cards'); await p.waitForTimeout(150);
  await p.click(`.saved-head:has-text("The plumber")`); await p.waitForTimeout(150);
  const pc=p.locator('.saved',{hasText:"The plumber's second visit"});
  ok("card shows target chips", (await pc.locator('.targets .tchip').count())===2);
  ok("card attempt shows Target words", await pc.locator('.fb-words').isVisible());
  const n1=(await prompts()).length;
  const moreBtn=pc.locator('.fb-more .row button');
  ok("saved list offered without asking again", (await moreBtn.textContent())==="Show them (3)");
  await moreBtn.click(); await p.waitForTimeout(150);
  ok("opening saved list made no request", (await prompts()).length===n1);

  console.log("— Practise again from the card —");
  await pc.locator('text=Tell it again with this in mind').click(); await p.waitForTimeout(200);
  const fx=await p.textContent('#story-focus');
  ok("banner: Practice 2 + Try to use", fx.includes("Practice 2") && fx.includes("Try to use"));
  await p.fill('#story-text','The sink has been playing up. Could you take a look at it?');
  await p.click('#btn-check'); await p.waitForTimeout(400);
  pr=await prompts();
  ok("practice-2 prompt has both PRACTICE NUMBER 2 and TARGET EXPRESSIONS", pr[pr.length-1].includes("PRACTICE NUMBER 2") && pr[pr.length-1].includes("TARGET EXPRESSIONS"));
  ok("save button says Practice 2", (await p.textContent('#story-out button:has-text("Save as")'))==="Save as Practice 2");
  await p.click('#btn-back-scene'); await p.waitForTimeout(150);

  console.log("— Old card from yesterday —");
  await p.click(`.saved-head:has-text("aircon")`); await p.waitForTimeout(150);
  const oldCard=p.locator('.saved',{hasText:'The aircon man arrives'});
  ok("old card still renders as Practice 1", (await oldCard.locator('.attempt-meta').textContent()).includes("Practice 1"));
  await oldCard.locator('.fb-more .row button').click(); await p.waitForTimeout(300);
  cards=await p.evaluate(()=>JSON.parse(localStorage.getItem('ss.cards.v1')));
  const oc=cards.find(c=>c.id==="cOld");
  ok("generated list saved onto the old card", oc.sceneExpressions && oc.sceneExpressions.length===2);
  ok("old card's own data untouched", oc.userText==="He come." && !oc.attempts);
  await p.screenshot({path:'v5-card.png',fullPage:true});

  console.log("— Single word shortcut —");
  await p.click('#nav-words'); await p.waitForTimeout(150);
  await p.click('.wordbtn:has-text("split the bill")'); await p.waitForTimeout(150);
  await p.locator('.wordrow',{hasText:'split the bill'}).locator('text=Practise this one').click(); await p.waitForTimeout(400);
  ok("one target chip on scene", (await p.$$('#scene-body .tchip')).length===1);
  pr=await prompts(); ok("prompt names that one word", pr[pr.length-1].includes("split the bill") && !pr[pr.length-1].includes("playing up\n"));
  await p.click('#btn-back-words'); await p.waitForTimeout(150);
  ok("scene 'Back to your words' returned to Words", await p.isVisible('#v-words'));
  await p.click('#nav-words');
  await tick("t1"); await tick("t4"); await tick("t5"); await p.waitForTimeout(100);
  await p.screenshot({path:'v5-words.png',fullPage:false});

  console.log("— General —");
  ok("no JS errors", errs.length===0); if(errs.length) console.log(errs.join("\n"));
  const m=await b.newPage({viewport:{width:390,height:900}});
  await m.goto('file://'+process.cwd()+'/preview-mock.html');   /* was preview.html, an old copy of the app that only existed in the old workspace (fixed 12 Oct) */ await m.waitForTimeout(500);
  await m.evaluate(t=>localStorage.setItem('ss.terms.v1',JSON.stringify(t)),TERMS); await m.reload(); await m.waitForTimeout(400);
  await m.click('#nav-words'); await m.check('input[data-term="t1"]'); await m.check('input[data-term="t2"]');
  const sw=await m.evaluate(()=>document.documentElement.scrollWidth);
  ok("phone: no sideways scroll with bar open ("+sw+")", sw<=390);
  await m.screenshot({path:'v5-phone.png'});
  await b.close();
})();
