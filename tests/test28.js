// v28: the M2 redesign (warm palette, pixel art, one shared shape and type system). These checks turn the design rules into tests.
const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/", NOW=Date.now(), D=86400000;
const W=(term,theme,extra)=>Object.assign({createdAt:NOW-3600000,term,kind:"phrase",meaning:"meaning of "+term,usage:"u",example:"An example with "+term+".",theme,level:"B2",fromScene:""},extra||{});
const DB={};
DB[P+"terms/a"]=W("touch base","At Work"); DB[P+"terms/b"]=W("split the bill","Food & Eating Out"); DB[P+"terms/c"]=W("run late","Travel & Transport");
DB[P+"cards/c1"]={createdAt:NOW-D,updatedAt:NOW-D,title:"Cold soup at the bistro",theme:"Food & Eating Out",setting:"A busy Friday night.",attempts:[{n:1,at:NOW-D,mode:"story",level:"B1",userText:"I said it.",strengths:[],corrections:[],highlights:[],modelStory:"m",nextTip:"t"}]};
DB[P+"sets/s1"]={createdAt:NOW-D,updatedAt:NOW-D,words:["for","since"],kind:"prepositions",topic:"",source:"suggested",explain:{core:"c",uses:[]}};
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const errs=[];
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const open=async(w,h,scheme)=>{
    const ctx=await b.newContext({viewport:{width:w,height:h||900},colorScheme:scheme||'light'}); const p=await ctx.newPage();
    p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
    await p.goto(URL); await p.evaluate(d=>{ localStorage.clear(); localStorage.setItem('ss.occupation','MES consultant'); localStorage.setItem('__mockdb',JSON.stringify(d)); },DB);
    await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700);
    return p;
  };
  /* page-side helpers: colours as numbers, and the background a piece of text really sits on */
  const helpers=()=>{
    window.__rgb=s=>{ const m=String(s).match(/[\d.]+/g)||[]; return m.map(Number); };
    window.__hex=h=>{ h=String(h).trim().replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)); };
    window.__lum=c=>{ const f=v=>{ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); };
    window.__bg=e=>{ for(let n=e;n;n=n.parentElement){ const c=window.__rgb(getComputedStyle(n).backgroundColor); if(c.length>=3 && (c.length<4||c[3]>0.5)) return c; } return window.__rgb(getComputedStyle(document.body).backgroundColor); };
    window.__contrast=e=>{ const a=window.__lum(window.__rgb(getComputedStyle(e).color)), b=window.__lum(window.__bg(e)); return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05); };
  };

  await section("Laptop: pixel art on every page", async()=>{
    const p=await open(1280,800);
    const art=await p.$eval('#v-themes',v=>{ const s=v.querySelector('.pagehead-art svg'); return s?{hidden:s.getAttribute('aria-hidden')==="true",shown:s.getBoundingClientRect().width>40}:null; });
    ok("Practice opens with its pixel street scene, hidden from screen readers", !!art && art.hidden && art.shown);
    await p.click('#nav-practice'); await p.waitForTimeout(200);
    const tiles=await p.$$eval('#themegrid .theme',ts=>ts.map(t=>{ const s=t.querySelector('svg.tscene'); return s ? (s.getAttribute('aria-hidden')==="true" ? s.innerHTML : "") : ""; }));
    ok("every place on the street has a pixel scene ("+tiles.length+" places), hidden from screen readers", tiles.length===5 && tiles.every(Boolean));
    const all=await p.$$eval('#town-board .bplace[data-theme] .bplace-go svg.px',ss=>ss.map(s=>s.getAttribute('aria-hidden')==="true"?s.innerHTML:""));
    ok("…and the 14 built-in themes on the All places board each have a different scene ("+all.length+")", all.length===14 && all.every(Boolean) && new Set(all).size===14);   /* v33: one street of 5, the rest on the board */
    ok("only a theme tuned to you shows its keyword line (here: At Work, tuned to MES consultant)", await p.$$eval('#themegrid .theme .egs',es=>es.filter(e=>getComputedStyle(e).display!=="none").map(e=>e.textContent).join("|"))==="For you: MES consultant");   /* v29: "tuned to:" became "For you:" */
    const crisp=await p.$$eval('svg.px',ss=>ss.filter(s=>s.getBoundingClientRect().width>0).every(s=>{ const vb=s.viewBox.baseVal, r=s.getBoundingClientRect(); return s.getAttribute('shape-rendering')==="crispEdges" && Number.isInteger(Math.round(r.width*1000)/1000/vb.width); }));
    ok("all pixel art is drawn at whole-number scale with crisp edges", crisp);
    ok("the logo has its pixel mark", await p.$eval('.mark',m=>!!m.querySelector('svg.px')));
    await p.click('#nav-words'); await p.waitForTimeout(300);
    const heads=await p.$$eval('#wordlist .groupname',hs=>hs.map(h=>({icon:!!h.querySelector('svg.gicon'),text:h.textContent})));
    ok("Words: each theme heading has the theme's icon and still starts with the theme name", heads.length===3 && heads.every(h=>h.icon) && heads.some(h=>h.text.startsWith("At Work")));
    await p.click('#nav-cards'); await p.waitForTimeout(300);
    ok("Cards: each card shows its theme's scene and the theme name", await p.$$eval('.saved',cs=>cs.length>0 && cs.every(c=>!!c.querySelector('.saved-top svg.cardscene') && !!c.querySelector('.saved-head .cardtheme'))) && (await p.textContent('.saved-head .cardtheme'))==="Food & Eating Out");
    ok("Cards: the filter chips are the only grouping (no repeated theme headings)", (await p.$$('#cardlist .groupname')).length===0);
    ok("Cards: 'Select cards to delete' sits in the filter row", await p.$eval('#cards-select',x=>!!x.closest('.chips')));
    ok("Cards: each card shows last time's tip under its title", await p.$eval('.saved',c=>{ const t=c.querySelector('.saved-head .cardtip'); return !!t && t.textContent==="Next timet"; }));
    ok("Cards: each card has a visible 'Practise again' button", await p.$$eval('.saved',cs=>cs.length>0 && cs.every(c=>{ const b=c.querySelector('.saved-top .again'); return !!b && b.offsetParent && b.textContent==="Practise again"; })));
    await p.click('#nav-compare'); await p.waitForTimeout(300);
    const bold=await p.$$eval('#cmp-suggested .cmp-sug-text .hint',hs=>hs.map(h=>[...h.querySelectorAll('b')].map(x=>x.textContent)));
    ok("Compare: the compared words are bold inside each suggested example", bold.length>=5 && bold.every(x=>x.length>=2));
    ok("…and the example text itself is unchanged", await p.$eval('#cmp-suggested .cmp-sug-text .hint',h=>h.textContent==="at 3 pm · on Monday · in March"));
    await p.close();
  });

  await section("Empty lists: each tool page shows its drawing where the list will be", async()=>{
    const ctx=await b.newContext({viewport:{width:1280,height:800}}); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.goto(URL); await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('__mockdb','{}'); }); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700);
    for(const [tab,host] of [["words","#wordlist"],["cards","#cardlist"],["compare","#cmp-list"]]){
      await p.click('#nav-'+tab); await p.waitForTimeout(250);
      ok(tab+": the empty list shows the page's pixel drawing", await p.$eval(host,h=>{ const s=h.querySelector('.empty svg.emptyart'); return !!s && s.getAttribute('aria-hidden')==="true" && s.getBoundingClientRect().width>40; }));
    }
    await p.close();
  });

  await section("Laptop: one filled button per page, a quiet active tab, matching fields", async()=>{
    const p=await open(1280,800); await p.evaluate(helpers);
    const filled=async(view)=>p.$eval('#v-'+view,(v)=>{ const acc=window.__hex(getComputedStyle(document.documentElement).getPropertyValue('--accent'));
      return [...v.querySelectorAll('.btn')].filter(x=>x.offsetParent && window.__rgb(getComputedStyle(x).backgroundColor).slice(0,3).join()===acc.join()).map(x=>x.textContent.trim()); });
    ok("Practice: the review lines are on screen for this check", await p.isVisible('#spotdue-go') && await p.isVisible('#cmpdue-go'));
    const f=await filled("themes");
    ok("Practice: only one filled button ("+f.join(", ")+")", f.length===1 && f[0]==="Build a scene from this");
    /* v32 (Pixel Town): the active tab changed on purpose. It is now a white plate with an ink edge on the sky (it was an underline).
       Still never a filled yellow pill, so the one yellow button stays the only filled thing on the page. */
    const nav=await p.$eval('#nav-practice',n=>{ const cs=getComputedStyle(n), o=getComputedStyle(document.querySelector('#nav-words'));
      return {bg:cs.backgroundColor, other:o.backgroundColor, edge:/inset/.test(cs.boxShadow), bar:getComputedStyle(n,'::after').display}; });
    ok("the active tab is a white plate ("+nav.bg+")", nav.bg==="rgb(255, 255, 255)");
    ok("…with an ink edge, and the other tabs stay on the sky ("+nav.other+")", nav.edge && nav.other!==nav.bg && nav.bar==="none");
    await p.click('#nav-words'); await p.waitForTimeout(300);
    const fw=await filled("words");
    ok("Words: only one filled button ("+fw.join(", ")+")", fw.length===1 && fw[0].startsWith("Spot it"));
    ok("v33: the Spot it button holds only its name (no count)", (await p.$$('#spot-count, .spotcount')).length===0 && (await p.textContent('#spot-open')).trim()==="Spot it");
    const borders=await p.evaluate(()=>[getComputedStyle(document.querySelector('#word-q')).borderTopColor, getComputedStyle(document.querySelector('#occ')).borderTopColor]);
    ok("the search box has the same border as the other text fields", borders[0]===borders[1]);
    await p.close();
  });

  await section("Readable small text (at least 4.5:1, the usual accessibility minimum)", async()=>{
    const p=await open(1280,800); await p.evaluate(helpers);
    const low=async(sel)=>p.$$eval(sel,es=>es.filter(e=>e.offsetParent && e.textContent.trim()).map(e=>Math.round(window.__contrast(e)*100)/100).filter(c=>c<4.5));
    for(const sel of ['#themegrid .theme .egs','#spotdue .spotdue','.setup-line','#v-themes .hint']) { const l=await low(sel); ok("Practice "+sel+(l.length?" (low: "+l.join(", ")+")":""), l.length===0); }
    await p.click('#nav-words'); await p.waitForTimeout(300);
    for(const sel of ['.wordbtn .when','.wordbtn .peek','#wordlist .groupname .count','.regtag']) { const l=await low(sel); ok("Words "+sel+(l.length?" (low: "+l.join(", ")+")":""), l.length===0); }
    await p.click('#nav-cards'); await p.waitForTimeout(300);
    { const l=await low('.saved-head .when'); ok("Cards dates"+(l.length?" (low: "+l.join(", ")+")":""), l.length===0); }
    await p.close();
  });

  /* v28 step 0 (Siyy, 10-12): the bins had been hidden until the mouse pointed at a row or card.
     Pitfall 24: a delete button you can't see is one you can't find (day 3). They must show without hovering.
     The 3:1 checks protect the lighter resting colour: 3:1 is the accessibility minimum for controls. */
  await section("Delete buttons can be found without hovering (pitfall 24)", async()=>{
    for(const scheme of ['light','dark']){
      const p=await open(1280,800,scheme); await p.evaluate(helpers);
      await p.mouse.move(1,1);
      const bins=sel=>p.$$eval(sel,es=>es.filter(e=>e.offsetParent).map(e=>{ const s=getComputedStyle(e), r=e.getBoundingClientRect();
        return {seen:s.opacity==="1" && s.visibility==="visible" && r.width>=24 && r.height>=24, contrast:Math.round(window.__contrast(e)*100)/100}; }));
      await p.click('#nav-words'); await p.waitForTimeout(300);
      const w=await bins('#wordlist .wordline > .trash');
      await p.click('#nav-cards'); await p.waitForTimeout(300);
      const c=await bins('#cardlist .saved .trash');
      if(scheme==='light'){
        ok("Words: every row's bin shows without hovering ("+w.length+" rows)", w.length===3 && w.every(x=>x.seen));
        ok("Cards: every card's bin shows without hovering ("+c.length+" card)", c.length===1 && c.every(x=>x.seen));
      }
      const all=w.concat(c).map(x=>x.contrast);
      ok(scheme+": the resting bin has at least 3:1 contrast ("+all.join(", ")+")", all.length===4 && all.every(x=>x>=3));
      if(scheme==='light'){
        await p.click('#nav-words'); await p.waitForTimeout(300);
        await p.hover('#wordlist .wordline .wordbtn');
        ok("Words: pointing at a row keeps its date on screen", await p.$eval('#wordlist .wordline .wordbtn .when',e=>getComputedStyle(e).visibility==="visible" && e.getBoundingClientRect().width>0));
      }
      await p.close();
    }
  });

  /* v32 (Pixel Town): automatic dark mode was removed on purpose (Siyy, 16 Oct: "night town for later").
     The old check ("dark mode uses different pixel colours") now checks the opposite: a dark system setting keeps the daytime town. */
  await section("The town stays in daytime, even when the computer is set to dark", async()=>{
    const lt=await open(1280,800,'light'), dk=await open(1280,800,'dark');
    const tok=pg=>pg.evaluate(()=>['--px-k','--px-y','--paper','--sky'].map(k=>getComputedStyle(document.documentElement).getPropertyValue(k).trim()).concat([getComputedStyle(document.body).backgroundColor]));
    const a=await tok(lt), c=await tok(dk);
    ok("pixel and page colours are defined ("+a.join(" ")+")", a.every(Boolean));
    ok("…and a dark computer setting shows the very same colours", a.join()===c.join());
    await lt.close(); await dk.close();
  });

  await section("Phone: the header fits", async()=>{
    const p=await open(390,844);
    const tops=await p.$$eval('.navbtn',ns=>ns.map(n=>Math.round(n.getBoundingClientRect().top)));
    ok("the four tabs share one row ("+tops.join(", ")+")", tops.length===4 && tops.every(t=>Math.abs(t-tops[0])<=2));
    const fit=await p.$$eval('.top-in > *',ns=>ns.every(n=>{ const r=n.getBoundingClientRect(); return r.left>=0 && r.right<=window.innerWidth+0.5; }));
    ok("logo, profile and tabs all fit inside the screen", fit);
    /* protects behaviour that must not change: no page scrolls sideways */
    for(const tab of ['practice','words','cards','compare']){
      await p.click('#nav-'+tab); await p.waitForTimeout(250);
      ok(tab+": no sideways scroll on a phone", !(await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)));
    }
    await p.close();
  });

  ok("no script errors on any page", errs.length===0);
  await b.close();
})();
