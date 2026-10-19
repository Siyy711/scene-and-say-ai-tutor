// v32: "Pixel Town", the bright daytime redesign (Siyy, 16 Oct: the v31 look felt "dark and dirty" after a full day).
// These checks turn the new design rules into tests: one fixed palette, a street of distinct buildings, sky on top,
// one sun-yellow button per page, faces in the chat, and no sideways scroll on a phone.
const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/", NOW=Date.now(), D=86400000;
const W=(term,theme)=>({createdAt:NOW-3600000,term,kind:"phrase",meaning:"meaning of "+term,usage:"u",example:"An example with "+term+".",theme,level:"B2",fromScene:""});
const DB={};
DB[P+"terms/a"]=W("touch base","At Work"); DB[P+"terms/b"]=W("split the bill","Food & Eating Out");
DB[P+"cards/c1"]={createdAt:NOW-D,updatedAt:NOW-D,title:"Cold soup at the bistro",theme:"Food & Eating Out",setting:"A busy Friday night.",attempts:[{n:1,at:NOW-D,mode:"story",level:"B1",userText:"I said it.",strengths:[],corrections:[],highlights:[],modelStory:"m",nextTip:"t"}]};
DB[P+"sets/s1"]={createdAt:NOW-D,updatedAt:NOW-D,words:["for","since"],kind:"prepositions",topic:"",source:"suggested",explain:{core:"c",uses:[]}};
/* the fixed palette: every colour a drawing may use */
const PALETTE=["#26235a","#ffffff","#8fd3ff","#cdeeff","#ffcd3c","#ff9f43","#ff5d5d","#ff9fc2","#9b7bff","#6ccd5c","#3f9e48","#c98a55","#e3e8f5","#3d7bff","#ffd2a8"];
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const errs=[];
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const open=async(w,h,extra)=>{
    const ctx=await b.newContext({viewport:{width:w,height:h||900}}); const p=await ctx.newPage();
    p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
    await p.goto(URL); await p.evaluate(([d,x])=>{ localStorage.clear(); localStorage.setItem('ss.occupation','MES consultant'); localStorage.setItem('__mockdb',JSON.stringify(d)); for(const k in (x||{})) localStorage.setItem(k,x[k]); },[DB,extra]);
    await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700);
    await p.evaluate(()=>{
      window.__rgb=s=>(String(s).match(/[\d.]+/g)||[]).map(Number);
      window.__hexOf=s=>'#'+window.__rgb(s).slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');
      window.__lum=c=>{ const f=v=>{ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); };
      window.__bg=e=>{ for(let n=e;n;n=n.parentElement){ const c=window.__rgb(getComputedStyle(n).backgroundColor); if(c.length>=3 && (c.length<4||c[3]>0.5)) return c; } return window.__rgb(getComputedStyle(document.body).backgroundColor); };
      window.__contrast=e=>{ const a=window.__lum(window.__rgb(getComputedStyle(e).color)), b=window.__lum(window.__bg(e)); return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05); };
    });
    return p;
  };
  const story=async p=>{ await p.click('#themegrid .theme >> nth=1'); await p.waitForTimeout(500); await p.click('#scene-body .mode:has-text("Tell the story")'); await p.fill('#story-text','The soup come and it was cold. I wait the waiter.'); await p.click('#btn-check'); await p.waitForTimeout(500); };
  const acting=async p=>{ await p.click('#nav-practice'); await p.waitForTimeout(200); await p.click('#themegrid .theme >> nth=1'); await p.waitForTimeout(500); await p.click('#scene-body .mode:has-text("Act it out")'); await p.waitForTimeout(300); await p.fill('#chat-text','Excuse me, my soup is cold.'); await p.click('#btn-send'); await p.waitForTimeout(600); };

  await section("One fixed palette", async()=>{
    const p=await open(1280,900);
    const fills=async()=>p.$$eval('svg.px path',ps=>[...new Set(ps.filter(x=>x.closest('svg').getBoundingClientRect().width>0).map(x=>window.__hexOf(getComputedStyle(x).fill)))]);
    let used=await fills();
    await p.click('#nav-words'); await p.waitForTimeout(300); used=used.concat(await fills());
    await p.click('#nav-cards'); await p.waitForTimeout(300); used=used.concat(await fills());
    const off=[...new Set(used)].filter(c=>!PALETTE.includes(c));
    ok("every pixel drawing uses only the 15 palette colours"+(off.length?" (off: "+off.join(", ")+")":""), used.length>0 && off.length===0);
    ok("the main colours are the town's: ink, sky, grass, sun", await p.evaluate(()=>['--ink','--sky','--grass','--sun'].map(k=>getComputedStyle(document.documentElement).getPropertyValue(k).trim()).join()==="#26235a,#8fd3ff,#6ccd5c,#ffcd3c"));
    ok("the page is warm white, not grey or beige", await p.evaluate(()=>window.__hexOf(getComputedStyle(document.body).backgroundColor))==="#fffdf8");
    await p.close();
  });

  await section("Practice: the street is the menu", async()=>{
    const p=await open(1280,900);
    /* v33 (Siyy, 19 Oct): ONE street of 5 places and a "More places" signpost; the other places wait on the All places board */
    const places=await p.$$eval('#themegrid .onestreet > button',bs=>bs.map(x=>{ const s=x.querySelector('.lot svg.tscene'), t=x.querySelector('.turf .sign');
      return {art:s?s.innerHTML:"", vb:s?s.getAttribute('viewBox'):"", w:s?s.getBoundingClientRect().width:0, sign:t?t.textContent:"", text:x.textContent, more:x.id==="btn-more"}; }));
    const themes=places.filter(x=>!x.more);
    ok("each theme is a place: a building on its lot and a sign on the grass ("+themes.length+")", themes.length===5 && places.every(x=>x.art && x.sign));
    ok("every building is drawn on the same 34×30 grid, shown 4× on a laptop", places.every(x=>x.vb==="0 0 34 30" && x.w===136));
    ok("the 5 buildings and the signpost all look different", new Set(places.map(x=>x.art)).size===6);
    const rows=await p.$$eval('#themegrid .onestreet > button',bs=>{ const t={}; bs.forEach(x=>{ const k=Math.round(x.getBoundingClientRect().top); t[k]=(t[k]||0)+1; }); return Object.keys(t).sort((a,b)=>a-b).map(k=>t[k]); });
    ok("one street: all six on one row ("+rows.join(", ")+")", rows.join()==="6");
    ok("the street shows only names, no descriptions", !themes.some(x=>/Ordering, dietary needs|Returns, haggling/.test(x.text)) && themes.some(x=>x.sign==="Food & Eating Out"));
    ok("'More places' is the signpost, last on the street", places[places.length-1].more && places[places.length-1].sign==="More places");
    ok("the street sits on the sky", await p.$eval('#themegrid',g=>window.__hexOf(window.__bg(g)))==="#8fd3ff");
    ok("each place stands on grass", await p.$$eval('#themegrid .turf',ts=>ts.length===6 && ts.every(t=>window.__hexOf(getComputedStyle(t).backgroundColor)==="#6ccd5c")));
    /* this check and the "no sideways scroll" ones also passed on v31: they protect what must not get worse */
    const low=await p.$$eval('#v-themes .pagehead .lede, #v-themes .pagehead .sub, #themegrid .sign, .street .section-head .eyebrow, .setup-line',es=>es.filter(e=>e.offsetParent).map(e=>Math.round(window.__contrast(e)*100)/100).filter(c=>c<4.5));
    ok("text on the sky and on the signs is easy to read (4.5:1 or more)"+(low.length?" (low: "+low.join(", ")+")":""), low.length===0);
    ok("headings use the pixel font, reading text uses Lexend", await p.evaluate(()=>/Pixelify/.test(getComputedStyle(document.querySelector('#v-themes .lede')).fontFamily) && /Pixelify/.test(getComputedStyle(document.querySelector('#themegrid .sign')).fontFamily) && /^"?Lexend/.test(getComputedStyle(document.querySelector('#v-themes .sub')).fontFamily)));
    await p.hover('#themegrid .theme >> nth=2'); await p.waitForTimeout(250);
    ok("pointing at a place lights its sign up in sun yellow", await p.$eval('#themegrid .theme:nth-child(3) .sign',s=>window.__hexOf(getComputedStyle(s).backgroundColor))==="#ffcd3c");
    await p.click('#themegrid .theme:has-text("Food & Eating Out")'); await p.waitForTimeout(500);
    ok("…and the description is still sent to Claude with the scene", await p.evaluate(()=>window.__prompts.some(x=>x.includes("Theme: Food & Eating Out — Ordering, dietary needs"))));
    ok("the scene shows the same building as the street", await p.$eval('#scene-body svg.scene-art',s=>s.getAttribute('viewBox')==="0 0 34 30"));
    await p.close();
  });

  await section("Your own themes get a building too", async()=>{
    const p=await open(1280,900,{'ss.ownThemes':JSON.stringify([{id:"own_visa",name:"Visa & Immigration",blurb:"Forms and offices"}])});
    const r=await p.$$eval('#themegrid .theme',bs=>{ const own=bs.find(x=>x.textContent.includes("Visa & Immigration")); const s=own&&own.querySelector('svg.tscene');
      return {has:!!s, vb:s&&s.getAttribute('viewBox'), unique:!!s && bs.filter(x=>x!==own).every(x=>x.querySelector('svg.tscene').innerHTML!==s.innerHTML)}; });
    ok("your own theme stands on the street as its own building", r.has && r.vb==="0 0 34 30" && r.unique);
    await p.close();
  });

  await section("Sky on top of every page", async()=>{
    const p=await open(1280,900);
    ok("the header is sky blue", await p.$eval('header.top',h=>window.__hexOf(getComputedStyle(h).backgroundColor))==="#8fd3ff");
    for(const tab of ['words','cards','compare']){
      await p.click('#nav-'+tab); await p.waitForTimeout(250);
      ok(tab+": the page top is sky, with grass under it", await p.$eval('#v-'+tab+' .pagehead',h=>window.__hexOf(getComputedStyle(h).backgroundColor)==="#8fd3ff" && getComputedStyle(h,'::after').borderImageSource.includes("gradient")));
    }
    await p.click('#nav-words'); await p.waitForTimeout(250);
    ok("Words: the page top shows the treasure chest", await p.$eval('#v-words .pagehead-art svg',s=>s.getAttribute('viewBox')==="0 0 30 22" && s.getBoundingClientRect().width===120));
    ok("Words: each theme heading shows its building", await p.$$eval('#wordlist .groupname svg.gicon',ss=>ss.length===2 && ss.every(s=>s.getAttribute('viewBox')==="0 0 34 30")));
    await p.click('#nav-cards'); await p.waitForTimeout(250);
    ok("Cards: the page top shows the postcards", await p.$eval('#v-cards .pagehead-art svg',s=>s.getAttribute('viewBox')==="0 0 30 22" && s.getBoundingClientRect().width===120));
    ok("Cards: each card shows its theme's building", await p.$eval('.saved-top svg.cardscene',s=>s.getAttribute('viewBox')==="0 0 34 30"));
    await p.close();
  });

  await section("One sun-yellow button per page, and the rest white", async()=>{
    const p=await open(1280,900);
    const yellow=v=>p.$eval('#v-'+v,x=>[...x.querySelectorAll('.btn')].filter(b=>b.offsetParent && window.__hexOf(getComputedStyle(b).backgroundColor)==="#ffcd3c").map(b=>b.textContent.trim()));
    const y=await yellow("themes");
    ok("the filled button is sun yellow with ink text (Practice: "+y.join(", ")+")", y.length===1 && y[0]==="Build a scene from this" && await p.$eval('#btn-own-scene',b=>window.__hexOf(getComputedStyle(b).color))==="#26235a");
    ok("the others are white with an ink edge", await p.$eval('#btn-own-check',b=>window.__hexOf(getComputedStyle(b).backgroundColor)==="#ffffff" && getComputedStyle(b).borderTopWidth==="3px" && window.__hexOf(getComputedStyle(b).borderTopColor)==="#26235a"));
    ok("the review lines' Start buttons stay white", await p.$$eval('#spotdue .btn:not(.ghost)',bs=>bs.length===2 && bs.every(b=>window.__hexOf(getComputedStyle(b).backgroundColor)==="#ffffff")));
    await story(p);
    const ys=await yellow("story");
    ok("Story page, after marking: one yellow button ("+ys.join(", ")+")", ys.length===1 && ys[0]==="Save as a card");
    await acting(p);
    const yc=await yellow("chat");
    ok("Chat page: one yellow button ("+yc.join(", ")+")", yc.length===1 && yc[0]==="Send");
    await p.close();
  });

  await section("Feedback headings and chat faces", async()=>{
    const p=await open(1280,900);
    await story(p);
    const hs=await p.$$eval('#story-out .fb-block h3',hs=>hs.filter(h=>h.offsetParent).map(h=>({tt:getComputedStyle(h).textTransform, font:getComputedStyle(h).fontFamily, sq:window.__hexOf(getComputedStyle(h,'::before').backgroundColor)})));
    ok("feedback headings: pixel font, sentence case ("+hs.length+" headings)", hs.length>=3 && hs.every(h=>h.tt==="none" && /Pixelify/.test(h.font)));
    ok("…each with a coloured square from the palette", hs.every(h=>PALETTE.includes(h.sq) && h.sq!=="#ffffff"));
    ok("…and the squares tell the kinds apart", new Set(hs.map(h=>h.sq)).size>=3);
    await acting(p);
    const turns=await p.$$eval('#thread .turn',ts=>ts.map(t=>({me:t.classList.contains('me'), face:(t.querySelector('.face svg.px')||{}).innerHTML||"", who:(t.querySelector('.who')||{}).textContent||""})));
    ok("every chat line has a face and a name tag ("+turns.length+" lines)", turns.length>=3 && turns.every(t=>t.face && t.who));
    ok("your face differs from theirs", turns.find(t=>t.me).face!==turns.find(t=>!t.me).face && turns.find(t=>t.me).who==="You");
    ok("your lines sit on the right", await p.$eval('#thread .turn.me',t=>{ const f=t.querySelector('.face').getBoundingClientRect(), b=t.querySelector('.bubble').getBoundingClientRect(); return f.left>b.right; }));
    await p.close();
  });

  await section("Phone: the street slides sideways, the page never does", async()=>{
    const p=await open(390,844);
    /* v33: one street; on a phone it scrolls on its own, three places in view */
    const r=await p.$$eval('#themegrid .onestreet > button',bs=>({rows:(()=>{ const t={}; bs.forEach(x=>{ const k=Math.round(x.getBoundingClientRect().top); t[k]=(t[k]||0)+1; }); return Object.keys(t).sort((a,b)=>a-b).map(k=>t[k]); })(), w:bs[0].querySelector('svg').getBoundingClientRect().width,
      seen:bs.filter(x=>{ const q=x.getBoundingClientRect(); return q.left>=0 && q.right<=window.innerWidth; }).length, first:Math.round(bs[0].getBoundingClientRect().left)}));
    const scroller=await p.$eval('#themegrid .onestreet',s=>({scrolls:s.scrollWidth>s.clientWidth, x:getComputedStyle(s).overflowX}));
    ok("one row of six ("+r.rows.join(", ")+"), three fully in view, the first one 16px from the edge ("+r.first+")", r.rows.join()==="6" && r.seen===3 && r.first===16);
    ok("buildings shown 3× (102 px), and the street itself scrolls sideways", r.w===102 && scroller.scrolls && scroller.x==="auto");
    const wide=async()=>p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
    ok("Practice: no sideways scroll", !(await wide()));
    await p.click('#themegrid .theme >> nth=1'); await p.waitForTimeout(500);
    ok("Scene: no sideways scroll", !(await wide()));
    await p.click('#scene-body .mode:has-text("Act it out")'); await p.waitForTimeout(300);
    await p.fill('#chat-text','Excuse me, my soup is cold.'); await p.click('#btn-send'); await p.waitForTimeout(600);
    ok("Chat: no sideways scroll, faces included", !(await wide()) && await p.$$eval('#thread .face',fs=>fs.length>=2 && fs.every(f=>f.getBoundingClientRect().right<=window.innerWidth)));
    await p.close();
  });

  ok("no script errors on any page", errs.length===0);
  await b.close();
})();
