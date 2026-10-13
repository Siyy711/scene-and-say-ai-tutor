// v29: M2 round 5a — Practice back in v27's order (new look), clearer wording, "Surprise me" as the last card,
// one Help line, numbers on the tabs (due AGAIN only), one date format, a filled selected chip,
// word forms highlighted in Compare, "+ Add" next to its set.
const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/", NOW=Date.now(), D=86400000;
const W=(term,theme,extra)=>Object.assign({createdAt:NOW-60000,term,kind:"phrase",meaning:"meaning of "+term,usage:"u",example:"An example with "+term+".",theme,level:"B2",fromScene:""},extra||{});
const DUE={spot:{last:"nocue",at:NOW-30*D,history:[{at:NOW-30*D,stage:"nocue"}]}};   /* practised a month ago: due again */
const DB={};
DB[P+"terms/a"]=W("touch base","At Work",DUE); DB[P+"terms/b"]=W("split the bill","Food & Eating Out"); DB[P+"terms/c"]=W("run late","Travel & Transport");
DB[P+"cards/c1"]={createdAt:NOW-60000,updatedAt:NOW-60000,title:"Cold soup at the bistro",theme:"Food & Eating Out",setting:"A busy Friday night.",attempts:[{n:1,at:NOW-60000,mode:"story",level:"B1",userText:"I said it.",strengths:[],corrections:[],highlights:[],modelStory:"m",nextTip:"t"}]};
DB[P+"sets/s1"]={createdAt:NOW-D,updatedAt:NOW-D,words:["put something on hold","postpone"],kind:"words",topic:"",source:"own",
  explain:{core:"Hold = stop for now. Postpone = move to a later date.",uses:[{word:"put something on hold",when:"w",example:"The project is on hold."},{word:"postpone",when:"w",example:"We postponed it to May."}]},
  compare:{last:"right",at:NOW-30*D,history:[{at:NOW-30*D,right:true}]}};
const NEWONLY={}; NEWONLY[P+"terms/a"]=W("touch base","At Work"); NEWONLY[P+"sets/s1"]=Object.assign({},DB[P+"sets/s1"]); delete NEWONLY[P+"sets/s1"].compare;
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const errs=[];
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const open=async(w,h,db,scheme)=>{
    const ctx=await b.newContext({viewport:{width:w,height:h||900},colorScheme:scheme||'light'}); const p=await ctx.newPage();
    p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
    await p.goto(URL); await p.evaluate(d=>{ localStorage.clear(); localStorage.setItem('ss.occupation','MES consultant'); localStorage.setItem('__mockdb',JSON.stringify(d)); },db||DB);
    await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700);
    return p;
  };

  await section("Practice: one clear order, as in v27", async()=>{
    const p=await open(1280,800);
    const tops=await p.evaluate(()=>['#v-themes .pagehead','#spotdue','#setup-box','#themegrid','.ownweek','#help-box'].map(s=>{ const e=document.querySelector(s); return e&&e.offsetParent ? Math.round(e.getBoundingClientRect().top) : null; }));
    ok("headline, then today's reviews, then the profile line, then the themes, then your own week, then Help ("+tops.join(", ")+")", tops.every(t=>t!==null) && tops.every((t,i)=>!i||t>tops[i-1]));
    ok("…the headline itself is unchanged", (await p.textContent('#v-themes .lede'))==="Pick a situation you'd actually find yourself in.");
    const last=await p.$eval('#themegrid',g=>{ const x=g.lastElementChild; return x?{id:x.id,cls:x.className,art:!!x.querySelector('svg.px[aria-hidden="true"]'),name:(x.querySelector('b')||{}).textContent}:null; });
    ok("'Surprise me' is the last card in the theme grid, with its own drawing", !!last && last.id==="btn-surprise" && last.cls==="surprise" && last.art && last.name==="Surprise me");
    ok("…and it isn't counted as a theme (still 14 theme cards)", (await p.$$('#themegrid .theme')).length===14);
    ok("the themes heading has no extra link any more", (await p.$$('#v-themes .section-head button')).length===0);
    ok("At Work says 'For you: MES consultant'", (await p.textContent('#themegrid .theme.tuned .egs'))==="For you: MES consultant");
    ok("the review line offers 'Hide for today'", (await p.textContent('#spotdue-ok'))==="Hide for today");
    await p.click('#spotdue-ok'); await p.waitForTimeout(200);
    ok("…which hides that line, as 'Got it' did", !(await p.isVisible('#spotdue-go')));
    ok("the your-week button is 'Check my story'", (await p.textContent('#btn-own-check'))==="Check my story");
    ok("…its help line uses the same name", (await p.textContent('.ownweek .hint')).includes("“Check my story” marks what you wrote"));
    ok("…and the your-week text has no 'actually'", !(await p.textContent('.ownweek .strip p')).includes("actually"));
    const help=await p.evaluate(()=>{ const f=document.querySelector('.footnote'); return {details:f.querySelectorAll('details').length, loose:f.querySelectorAll(':scope > .notice').length, sum:(f.querySelector('#help-box > summary')||{}).textContent, inside:!!document.querySelector('#help-box .notice') && document.querySelector('#help-box .notice').textContent.startsWith("Known limit:")}; });
    ok("the footer is one 'Help and known limits' line, with the microphone note inside it", help.details===1 && help.loose===0 && help.sum==="Help and known limits" && help.inside);
    ok("…closed at first", !(await p.isVisible('#help-box .notice')) && !(await p.isVisible('#btn-diag')));
    await p.click('#help-box > summary'); await p.waitForTimeout(150);
    ok("…and opening it shows the note and the live check", await p.isVisible('#help-box .notice') && await p.isVisible('#btn-diag'));
    await p.click('#btn-surprise'); await p.waitForTimeout(500);
    /* protects behaviour that must not change */
    ok("'Surprise me' still starts a scene", await p.isVisible('#v-scene'));
    await p.close();
  });

  await section("Wording: no long dashes in buttons or placeholders", async()=>{
    const p=await open(1280,800);
    const dashed=await p.evaluate(()=>[...document.querySelectorAll('button')].map(x=>x.textContent).concat([...document.querySelectorAll('[placeholder]')].map(x=>x.getAttribute('placeholder'))).filter(t=>t.includes('—')));
    ok("none on any page"+(dashed.length?" (found: "+dashed.join(" | ")+")":""), dashed.length===0);
    ok("Words search says 'Search words or meanings'", (await p.getAttribute('#word-q','placeholder'))==="Search words or meanings");
    ok("the Words subtitle explains Spot it", (await p.textContent('#v-words .sub')).includes("Spot it gives you a new situation, and you find the right word yourself."));
    ok("the Cards subtitle has no 'actually'", !(await p.textContent('#v-cards .sub')).includes("actually"));
    await p.close();
  });

  await section("Tabs: a number for what is due again", async()=>{
    const p=await open(1280,800);
    ok("Words shows 1 (one word practised a month ago)", (await p.textContent('#nav-words .navcount'))==="1");
    ok("Compare shows 1 (one set practised a month ago)", (await p.textContent('#nav-compare .navcount'))==="1");
    ok("…and screen readers hear it as 'Words, 1 due again'", (await p.getAttribute('#nav-words','aria-label'))==="Words, 1 due again");
    ok("Practice and Cards have no number", (await p.$$('#nav-practice .navcount, #nav-cards .navcount')).length===0);
    await p.close();
    const q=await open(1280,800,NEWONLY);
    ok("new words and sets alone don't make a number", (await q.$$('.navcount')).length===0 && !(await q.getAttribute('#nav-words','aria-label')));
    await q.close();
  });

  await section("Dates and chips", async()=>{
    const p=await open(1280,800);
    await p.click('#nav-cards'); await p.waitForTimeout(300);
    const when=(await p.textContent('.saved-head .when')).trim();
    ok("a card from this year shows its date without the year ("+when+")", !/\d{4}/.test(when) && /[A-Za-z]{3}/.test(when));
    await p.click('#nav-words'); await p.waitForTimeout(300);
    const chip=await p.$eval('#wordlist .chip[aria-pressed="true"]',c=>{ const h=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().replace('#',''); return {bg:getComputedStyle(c).backgroundColor, acc:'rgb('+[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)).join(', ')+')'}; });
    ok("the selected filter chip is filled ("+chip.bg+")", chip.bg===chip.acc);
    await p.close();
  });

  await section("Compare: word forms highlighted, '+ Add' next to its set", async()=>{
    const p=await open(1280,800);
    await p.click('#nav-compare'); await p.waitForTimeout(400);
    const bold=await p.$eval('#cmp-list .setrow .setex',e=>({b:[...e.querySelectorAll('b')].map(x=>x.textContent), t:e.textContent}));
    ok("'on hold' and 'postponed' are highlighted in the set's examples ("+bold.b.join(", ")+")", bold.b.join("|")==="on hold|postponed");
    ok("…and the example text itself is unchanged", bold.t==="The project is on hold. · We postponed it to May.");
    const prep=await p.$eval('#cmp-suggested .cmp-sug-text .hint',h=>[...h.querySelectorAll('b')].map(x=>x.textContent).join("|"));
    /* protects behaviour that must not change: prepositions match only as they are */
    ok("prepositions are still highlighted exactly (at|on|in)", prep==="at|on|in");
    const pos=await p.$eval('#cmp-suggested .cmp-sug',r=>{ const t=r.querySelector('.cmp-sug-head .settitle'), a=r.querySelector('.cmp-sug-head .cmp-add-prep'); if(!t||!a) return null; const x=t.getBoundingClientRect(), y=a.getBoundingClientRect(); return {gap:Math.round(y.left-x.right), dy:Math.round(Math.abs((y.top+y.bottom)/2-(x.top+x.bottom)/2))}; });
    ok("'+ Add' sits right after the set's title"+(pos?" (gap "+pos.gap+"px)":""), !!pos && pos.gap>=0 && pos.gap<=40 && pos.dy<=12);
    await p.close();
  });

  await section("Phone: still fits", async()=>{
    const p=await open(390,844);
    const tops=await p.$$eval('.navbtn',ns=>ns.map(n=>Math.round(n.getBoundingClientRect().top)));
    ok("the four tabs (with their numbers) share one row", tops.length===4 && tops.every(t=>Math.abs(t-tops[0])<=2));
    ok("…and fit inside the screen", await p.$$eval('.top-in > *',ns=>ns.every(n=>{ const r=n.getBoundingClientRect(); return r.left>=0 && r.right<=window.innerWidth+0.5; })));
    /* protects behaviour that must not change: no page scrolls sideways */
    for(const tab of ['practice','words','cards','compare']){
      await p.click('#nav-'+tab); await p.waitForTimeout(250);
      ok(tab+": no sideways scroll", !(await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)));
    }
    await p.close();
  });

  ok("no script errors on any page", errs.length===0);
  await b.close();
})();
