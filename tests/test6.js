const {chromium}=require(process.env.PW||'playwright');
const T=(id,term,theme)=>({id,createdAt:Date.now()-Number(id.slice(1))*1000,term,kind:"phrase",meaning:"m",usage:"u",example:"e",theme,level:"B1"});
const TERMS=[T("t1","take a look at","Home & Neighbours"),T("t2","playing up","Home & Neighbours"),T("t3","split the bill","Food & Eating Out")];
const OLD={id:"cOld",createdAt:Date.now()-86400000,mode:"story",level:"B1",theme:"Home & Neighbours",title:"The aircon man arrives",setting:"Tuesday.",whatsHappening:"Rattling.",
  userText:"He come.",strengths:[],corrections:[],highlights:[],levelCheck:null,modelStory:"He came.",nextTip:"Past tense."};
const ok=(label,cond)=>console.log((cond?"PASS ":"FAIL ")+label);
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1300},deviceScaleFactor:2});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{ if(m.type()==='error'&&!/net::|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://'+process.cwd()+'/preview-mock.html');
  await p.evaluate(([t,c])=>{localStorage.clear();localStorage.setItem('ss.terms.v1',JSON.stringify(t));localStorage.setItem('ss.cards.v1',JSON.stringify([c]));},[TERMS,OLD]);
  await p.reload(); await p.waitForTimeout(700);
  /* v38: opening a word also asks how to say it, so this reads the last request that is NOT that one */
  const last=()=>p.evaluate(()=>window.__prompts.filter(x=>x.indexOf("HOW TO SAY IT.")!==0).slice(-1)[0]);

  console.log("— Fix 1: Show me one first, with target words —");
  await p.click('#nav-words'); await p.check('input[data-term="t1"]'); await p.check('input[data-term="t2"]');
  await p.click('#wordbar-go'); await p.waitForTimeout(400);
  await p.click('text=Show me one first'); await p.waitForTimeout(400);
  const wp=await last();
  ok("request asks to use EVERY target word", wp.includes("use EVERY one of them") && wp.includes('"take a look at"') && wp.includes('"playing up"'));
  ok("request asks for [[ ]] marks", wp.includes("double square brackets"));
  ok("request no longer forbids them", !wp.includes("Do NOT use these target expressions in your story"));
  const marks=await p.$$eval('#scene-extra .fb-model mark.tmark',els=>els.map(e=>e.textContent));
  ok("story highlights both words: "+marks.join(" / "), marks.length===2 && marks.includes("playing up") && marks.includes("take a look at"));
  ok("each note highlights its word too", (await p.$$('#scene-extra .fb-good mark.tmark')).length===2);
  ok("no raw [[ ]] left on screen", !(await p.textContent('#scene-extra')).includes("[["));
  ok("hint says words are highlighted", await p.isVisible('#scene-extra >> text=Your target words are highlighted.'));
  const stealTerms=await p.$$eval('#scene-extra .fb-terms .term-head b',els=>els.map(e=>e.textContent));
  ok("Worth stealing drops the target word, keeps 'all week': "+stealTerms.join(","), !stealTerms.includes("playing up") && stealTerms.includes("all week"));
  await p.screenshot({path:'v6-worked.png',fullPage:true});

  console.log("— Fix 3: the way home —");
  ok("scene shows '← All themes'", (await p.textContent('#btn-back-themes')).trim()==="← All themes" && await p.isVisible('#btn-back-themes'));
  ok("scene also shows '← Back to your words'", await p.isVisible('#btn-back-words'));
  await p.click('#btn-back-themes'); await p.waitForTimeout(150);
  ok("'All themes' reaches the home page", await p.isVisible('#v-themes'));
  await p.click('.theme >> nth=0'); await p.waitForTimeout(400);
  ok("normal scene: no 'Back to your words'", await p.isHidden('#btn-back-words'));
  await p.click('text=Tell the story'); await p.waitForTimeout(150);
  await p.click('#nav-practice'); await p.waitForTimeout(150);
  ok("Practice tab from inside a practice → home", await p.isVisible('#v-themes'));
  await p.click('.theme >> nth=1'); await p.waitForTimeout(400);
  await p.click('#nav-words'); await p.waitForTimeout(100);
  await p.click('#nav-practice'); await p.waitForTimeout(150);
  ok("Practice tab from Words → back to the open scene", await p.isVisible('#v-scene'));
  await p.click('#nav-practice'); await p.waitForTimeout(150);
  ok("…and tapping it again → home", await p.isVisible('#v-themes'));

  console.log("— Fix 2: word-practice tag on cards —");
  await p.click('#nav-words'); await p.check('input[data-term="t1"]'); await p.check('input[data-term="t2"]');
  await p.click('#wordbar-go'); await p.waitForTimeout(400);
  await p.click('text=Tell the story'); await p.fill('#story-text','The sink has been playing up.');
  await p.click('#btn-check'); await p.waitForTimeout(400);
  await p.click('#story-out button:has-text("Save as a card")'); await p.waitForTimeout(300);
  await p.click('#nav-cards'); await p.waitForTimeout(150);
  const wpCard=p.locator('.saved',{hasText:"The plumber's second visit"});
  ok("word-practice card header has 'Word practice · 2 words'", (await wpCard.locator('.saved-head .tag.wp').textContent())==="Word practice · 2 words");
  const oldCard=p.locator('.saved',{hasText:'The aircon man arrives'});
  ok("ordinary card has no word-practice tag", (await oldCard.locator('.tag.wp').count())===0);
  await p.screenshot({path:'v6-cards.png',fullPage:false});

  ok("no JS errors", errs.length===0); if(errs.length) console.log(errs.join("\n"));
  await b.close();
})();
