const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/preview-mock.html';
const NOW=Date.now();
const T=(id,term,extra)=>Object.assign({createdAt:NOW-Number(id.replace(/\D/g,''))*3600000,term,kind:"phrase",meaning:"m",usage:"u",example:"e",theme:"Home & Neighbours",level:"B2",fromScene:""},extra||{});
const OLDRP={createdAt:NOW-86400000,updatedAt:NOW-86400000,theme:"Home & Neighbours",title:"Old chat card",setting:"s",whatsHappening:"w",scene:{youAre:"tenant",partnerRole:"the plumber",firstLine:"Hi",visualDetails:[],usefulLanguage:[]},
  attempts:[{n:1,at:NOW-86400000,mode:"roleplay",level:"B1",userText:"Hello",strengths:[],corrections:[],highlights:[],levelCheck:null,modelStory:"Hi there.",nextTip:"Ask more."}]};
const STORY={createdAt:NOW-2*86400000,updatedAt:NOW-2*86400000,theme:"Food & Eating Out",title:"Story card",setting:"s",whatsHappening:"w",scene:{youAre:"you",partnerRole:"",firstLine:"",visualDetails:[],usefulLanguage:[]},
  attempts:[{n:1,at:NOW-2*86400000,mode:"story",level:"B1",userText:"I ate.",strengths:[],corrections:[],highlights:[],levelCheck:null,modelStory:"I ate.",nextTip:"x"},{n:2,at:NOW-86400000,mode:"story",level:"B1",userText:"I ate rice.",strengths:[],corrections:[],highlights:[],levelCheck:null,modelStory:"x",nextTip:"x"}]};
const P="data/users/u_test/store/";
function seed(extra){
  const db={};
  db[P+"terms/t1"]=T("t1","take a look at");
  db[P+"terms/t2"]=T("t2","playing up",{pic:"p1"});
  db[P+"pics/p1"]={createdAt:NOW,termId:"t2",data:"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="};
  db[P+"terms/t3"]=T("t3","split the bill",{theme:"Food & Eating Out"});
  db[P+"cards/cOld"]=OLDRP; db[P+"cards/cStory"]=STORY;
  return Object.assign(db,extra||{});
}
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1200}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const db=()=>p.evaluate(()=>window.__mockdb());
  const fresh=async(extra)=>{ await p.goto('about:blank'); await p.goto(URL); await p.evaluate(d=>{ localStorage.clear(); localStorage.setItem('ss.occupation','consultant'); localStorage.setItem('__mockdb',JSON.stringify(d)); },seed(extra)); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(600); };
  const last=()=>p.evaluate(()=>window.__prompts[window.__prompts.length-1]);

  console.log("— Act it out: easier to find —");
  await fresh();
  ok("no banner when nothing came from other sessions", await p.isHidden('#chatnews'));
  await p.click('.theme >> nth=3'); await p.waitForTimeout(400);
  await p.click('.mode:has-text("Act it out")'); await p.waitForTimeout(150);
  const cls=()=>p.getAttribute('#btn-review','class');
  ok("review button is quiet at the start", (await cls()).includes("ghost"));
  for(let i=1;i<=6;i++){
    await p.fill('#chat-text','Line '+i+'. Could you fix it today?'); await p.click('#btn-send'); await p.waitForTimeout(120);
    if(i===1) ok("still quiet after 1 turn", (await cls()).includes("ghost"));
    if(i===2) ok("becomes the main button after 2 turns", !(await cls()).includes("ghost"));
    if(i===5) ok("no nudge before 6 turns", !(await p.textContent('#chat-note')).includes("Ready for feedback"));
  }
  ok("nudge appears after 6 turns", (await p.textContent('#chat-note')).includes("Ready for feedback"));
  await p.click('#btn-review'); await p.waitForTimeout(400);
  const rp=await last();
  ok("review request asks for the conversation summary", rp.includes('"convo"') && rp.includes("cameAcross") && rp.includes("Judge the conversation as a conversation"));
  ok("'How the conversation went' comes first", (await p.textContent('#chat-out .fb > .fb-block:first-child h3'))==="How the conversation went");
  const cv=await p.textContent('#chat-out .fb-convo');
  ok("shows summary, goal (Partly), how you came across, skills", cv.includes("asked the plumber") && cv.includes("Partly") && cv.includes("abrupt") && cv.includes("follow-up question"));
  await p.screenshot({path:'v9-convo.png',fullPage:true});
  await p.click('#chat-out >> text=Save as a card'); await p.waitForTimeout(400);
  let d=await db();
  const nk=Object.keys(d).find(k=>k.includes('/cards/')&&!k.endsWith('cOld')&&!k.endsWith('cStory'));
  ok("saved practice keeps the conversation summary", !!nk && d[nk].attempts[0].convo && d[nk].attempts[0].convo.goal.reached==="partly");
  await p.click('#nav-cards'); await p.waitForTimeout(200);
  await p.click('.saved-head:has-text("Old chat card")'); await p.waitForTimeout(150);
  ok("old Act it out card (no summary) shows as before", await p.isVisible('.saved:has-text("Old chat card") >> text=How you could have played it') && !(await p.isVisible('.saved:has-text("Old chat card") .fb-convo')));
  await p.click('.saved-head:has-text("Old chat card")');
  await p.click('.saved-head:has-text("plumber\'s second visit")'); await p.waitForTimeout(150);
  ok("new card shows the conversation summary", await p.isVisible('.saved:has-text("plumber\'s second visit") .fb-convo'));

  console.log("— Story feedback is unchanged —");
  await p.click('#nav-practice'); await p.click('#nav-practice'); await p.waitForTimeout(150);
  await p.click('.theme >> nth=0'); await p.waitForTimeout(400);
  await p.click('.mode:has-text("Tell the story")'); await p.waitForTimeout(150);
  await p.fill('#v-story textarea','He come and fix the sink.'); await p.click('#v-story >> text=Check my story'); await p.waitForTimeout(400);
  ok("story request does not ask for a conversation summary", !(await last()).includes('"convo"'));

  console.log("— Delete one word: confirm, then Undo —");
  await fresh();
  await p.click('#nav-words'); await p.waitForTimeout(200);
  ok("each word shows the date it was added", (await p.$$eval('.wordbtn .when',e=>e.length))===3);
  await p.click('.wordrow:has-text("playing up") .trash'); await p.waitForTimeout(100);
  ok("confirm box appears", await p.isVisible('#confirm'));
  ok("confirm mentions the picture", (await p.textContent('#confirm')).includes("picture will be deleted too"));
  await p.click('#confirm-no'); await p.waitForTimeout(100);
  ok("Cancel keeps the word", await p.isVisible('.wordbtn:has-text("playing up")') && !!(await db())[P+"terms/t2"]);
  await p.click('.wordrow:has-text("playing up") .trash'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok("Escape also cancels", await p.isHidden('#confirm') && await p.isVisible('.wordbtn:has-text("playing up")'));
  await p.click('.wordrow:has-text("playing up") .trash'); await p.click('#confirm-yes'); await p.waitForTimeout(300);
  d=await db();
  ok("word and picture deleted after confirming", !d[P+"terms/t2"] && !d[P+"pics/p1"] && await p.isHidden('.wordbtn:has-text("playing up")'));
  ok("Undo bar appears", (await p.textContent('#undo')).includes("Deleted “playing up”"));
  await p.screenshot({path:'v9-undo.png'});
  await p.click('#undo-btn'); await p.waitForTimeout(300);
  d=await db();
  ok("Undo brings back the word AND its picture", !!d[P+"terms/t2"] && d[P+"terms/t2"].pic==="p1" && !!d[P+"pics/p1"] && await p.isVisible('.wordbtn:has-text("playing up")'));

  console.log("— Delete several words —");
  await p.check('input[data-term="t1"]'); await p.check('input[data-term="t3"]');
  ok("word bar offers 'Delete 2'", (await p.textContent('#wordbar-del'))==="Delete 2");
  await p.click('#wordbar-del'); await p.waitForTimeout(100);
  ok("confirm lists both words", (await p.textContent('#confirm')).includes("take a look at · split the bill"));
  await p.click('#confirm-yes'); await p.waitForTimeout(300);
  d=await db();
  ok("both deleted, the third kept", !d[P+"terms/t1"] && !d[P+"terms/t3"] && !!d[P+"terms/t2"]);
  ok("word bar hides (nothing selected)", await p.isHidden('#wordbar'));
  await p.click('#undo-btn'); await p.waitForTimeout(300);
  ok("Undo brings both back", (await p.$$('.wordrow')).length===3);
  await p.check('input[data-term="t1"]'); await p.click('#wordbar-del'); await p.click('#confirm-yes'); await p.waitForTimeout(300);
  await p.waitForTimeout(8300);
  ok("Undo bar goes away after about 8 seconds", await p.isHidden('#undo'));

  console.log("— Delete cards —");
  await p.click('#nav-cards'); await p.waitForTimeout(200);
  await p.click('.saved:has-text("Story card") .trash'); await p.waitForTimeout(100);
  ok("card confirm says how many practices", (await p.textContent('#confirm')).includes("2 practices"));
  await p.click('#confirm-yes'); await p.waitForTimeout(300);
  ok("card deleted", !(await db())[P+"cards/cStory"] && await p.isHidden('.saved:has-text("Story card")'));
  await p.click('#undo-btn'); await p.waitForTimeout(300);
  d=await db();
  ok("Undo restores the card with both practices", !!d[P+"cards/cStory"] && d[P+"cards/cStory"].attempts.length===2 && await p.isVisible('.saved:has-text("Story card")'));
  await p.click('#cards-select'); await p.waitForTimeout(100);
  ok("select mode shows tick boxes and the delete bar", (await p.$$('input[data-card]')).length===2 && await p.isVisible('#cardbar') && await p.isDisabled('#cardbar-del'));
  await p.check('input[data-card="cOld"]'); await p.check('input[data-card="cStory"]');
  ok("bar counts the selection", (await p.textContent('#cardbar-sel'))==="2 cards selected");
  await p.screenshot({path:'v9-select.png'});
  await p.click('#cardbar-del'); await p.click('#confirm-yes'); await p.waitForTimeout(300);
  d=await db();
  ok("both cards deleted", !d[P+"cards/cOld"] && !d[P+"cards/cStory"]);
  ok("select mode ends when no cards are left", await p.isHidden('#cardbar'));
  await p.click('#undo-btn'); await p.waitForTimeout(300);
  await p.click('#cards-select'); await p.waitForTimeout(100);
  await p.click('#nav-words'); await p.waitForTimeout(100);
  ok("card bar hides when you leave Cards", await p.isHidden('#cardbar'));
  await p.click('#nav-cards'); await p.click('#cardbar-cancel'); await p.waitForTimeout(100);
  ok("Cancel leaves select mode", await p.isHidden('#cardbar') && (await p.$$('input[data-card]')).length===0);

  console.log("— New words from other sessions —");
  await fresh({[P+"terms/tc1"]:T("tc0","work for me",{source:"chat",createdAt:NOW-60000,theme:"At Work"})});
  ok("banner shows on the home page", await p.isVisible('#chatnews') && (await p.textContent('#chatnews')).includes("work for me"));
  d=await db();
  ok("seen time is saved in the cloud", (d[P+"meta/seen"]||{}).chatSeenAt===NOW-60000);
  await p.click('#chatnews-go'); await p.waitForTimeout(200);
  ok("'Show them' opens Words with a NEW tag", await p.isVisible('#v-words') && await p.isVisible('.wordrow:has-text("work for me") .newtag'));
  await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(600);
  ok("after reload: no banner (already seen)", await p.isHidden('#chatnews'));
  await p.evaluate(([k,v])=>{ const d=window.__mockdb(); d[k]=v; localStorage.setItem('__mockdb',JSON.stringify(d)); localStorage.removeItem('ss.chatSeenAt'); },[P+"terms/tc2",T("tc0","between jobs",{source:"chat",createdAt:Date.now(),level:"B1"})]);
  await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(600);
  const nt=await p.textContent('#chatnews');
  ok("next visit shows only the newer word (seen time came from the cloud)", nt.includes("between jobs") && !nt.includes("work for me"));
  await p.click('#chatnews-ok');
  ok("'Got it' hides the banner", await p.isHidden('#chatnews'));

  console.log("— Phone width —");
  await p.setViewportSize({width:390,height:844}); await p.click('#nav-words'); await p.waitForTimeout(150);
  ok("no sideways scroll on a phone", !(await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)));
  await p.screenshot({path:'v9-phone.png'});
  ok("no page errors: "+errs.join(" | "), errs.length===0);
  await b.close();
})();
