// v35 (Siyy, 19 Oct): the night town. A deep-blue sky with stars and a crescent moon, wooden signs, cream notes on the boards.
// It follows the device's light/dark setting; tapping the sun or moon switches, and this device remembers the tap (ss.sky).
// v36 changed two checks on purpose: a tap now holds only until the device switches (see test37.js), so a tap back to what
// the device says is not saved, and a saved tap carries what the device said at that moment (ss.skyDevice).
// The sun or moon sits in the sky of every page, well to the right of the page's own picture. The Practice title is two lines.
const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const FILE=process.argv[2]||'preview-mock.html';
const URL='file://'+process.cwd()+'/'+FILE;
const P="data/users/u_test/store/", NOW=Date.now();
const W=(term,theme,extra)=>Object.assign({createdAt:NOW-3600000,term,kind:"phrase",meaning:"meaning of "+term,usage:"",example:"An example with "+term+".",theme,level:"B2",fromScene:""},extra||{});
const DB={"terms/a":W("mix-up","At Work",{kind:"word",meaning:"a mistake where one thing is confused with another",reg:{level:"neutral",domain:"everyday"}}),
  "terms/b":W("split the bill","Food & Eating Out",{reg:{level:"casual",domain:"everyday"}}),"terms/c":W("touch base","At Work",{reg:{level:"neutral",domain:"work"}}),
  "cards/c1":{createdAt:NOW-60000,updatedAt:NOW-60000,title:"Cold soup at the bistro",theme:"Food & Eating Out",setting:"A busy Friday night.",attempts:[{n:1,at:NOW-60000,mode:"story",level:"B1",userText:"I said it.",strengths:[],corrections:[],highlights:[],modelStory:"m",nextTip:"Say what you want first."}]}};
const NIGHT={sky:"#2b2873",paper:"#17153f",grass:"#3c9a4c",wood:"#966236",sign:"#8a5a3a",cream:"#fbf3dc",edge:"#100e2e",star:"#fff3c4",lit:"#ffe08a"};
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const errs=[];
  let p, ctx;
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const helpers=()=>{
    window.__rgb=s=>(String(s).match(/[\d.]+/g)||[]).map(Number);
    window.__hexOf=s=>'#'+window.__rgb(s).slice(0,3).map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
    window.__lum=c=>{ const f=v=>{ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); };
    window.__bg=e=>{ for(let n=e;n;n=n.parentElement){ const c=window.__rgb(getComputedStyle(n).backgroundColor); if(c.length>=3 && (c.length<4||c[3]>0.5)) return c; } return window.__rgb(getComputedStyle(document.body).backgroundColor); };
    window.__contrast=e=>{ const a=window.__lum(window.__rgb(getComputedStyle(e).color)), b=window.__lum(window.__bg(e)); return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05); };
    /* every element on screen that holds its own text, with its contrast against what is behind it */
    window.__lowText=(min)=>{ const out=[];
      document.querySelectorAll('main *, header *').forEach(e=>{
        if(!e.offsetParent && getComputedStyle(e).position!=="fixed") return;
        const own=[...e.childNodes].some(n=>n.nodeType===3 && n.textContent.trim()); if(!own) return;
        if(e.closest('[hidden],:disabled,svg')) return;
        const r=e.getBoundingClientRect(); if(r.width<1||r.height<1) return;
        const c=window.__contrast(e); if(c<min) out.push(e.textContent.trim().slice(0,24)+" "+(Math.round(c*100)/100)); });
      return out; };
  };
  /* scheme: what the device says (light/dark). saved: an ss.sky value already on this device, or none.
     "night:day" also saves what the device said at the tap (ss.skyDevice = day), as v36 does. */
  const open=async(w,h,scheme,saved,file)=>{
    if(ctx) await ctx.close();
    ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:scheme||'light'}); p=await ctx.newPage();
    p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
    const url=file?'file://'+process.cwd()+'/'+file:URL;
    await p.goto(url);
    await p.evaluate(([d,P,saved])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); if(saved){ const [s,d]=saved.split(':'); localStorage.setItem('ss.sky',s); if(d) localStorage.setItem('ss.skyDevice',d); } },[DB,P,saved||""]);
    await p.goto(url+(file?'':'#db')); await p.reload(); await p.waitForTimeout(700);
    await p.evaluate(helpers); await p.mouse.move(0,0);
  };
  const go=async v=>{
    await p.mouse.move(0,0);
    if(v==='themes'){ await p.click('#nav-practice'); await p.waitForTimeout(150); if(await p.isHidden('#v-themes')) await p.click('#nav-practice'); }   /* from Words, the Practice tab first returns to the last scene */
    else if(v==='words'||v==='cards'||v==='compare') await p.click('#nav-'+v);
    else if(v==='scene'){ await p.click('#nav-practice'); await p.waitForTimeout(150); await p.click('#themegrid .theme >> nth=1'); }
    else if(v==='story'||v==='chat'){ await go('scene'); await p.waitForTimeout(500); await p.click('#scene-body .mode:has-text("'+(v==='story'?'Tell the story':'Act it out')+'")'); await p.waitForTimeout(200);
      if(v==='story'){ await p.fill('#story-text','The soup come and it was cold. I wait the waiter.'); await p.click('#btn-check'); }
      else { await p.fill('#chat-text','Excuse me, my soup is cold.'); await p.click('#btn-send'); } }
    else if(v==='spot'){ await p.click('#nav-words'); await p.waitForTimeout(200); await p.click('#spot-open'); await p.click('#spot-start'); }
    await p.waitForTimeout(600); await p.evaluate(()=>window.scrollTo(0,0)); await p.mouse.move(0,0); await p.waitForTimeout(100);
  };
  /* Read real pixels from a screenshot (stars and the moon are drawn, not text, so only the picture can tell) */
  const shot=async()=>{ const png=(await p.screenshot()).toString('base64'); await p.evaluate(async png=>{ const img=new Image(); img.src='data:image/png;base64,'+png; await img.decode();
    const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; const x=c.getContext('2d'); x.drawImage(img,0,0); window.__px=x; },png); };
  const colourAt=pts=>p.evaluate(pts=>pts.map(([a,b])=>{ const d=window.__px.getImageData(Math.round(a),Math.round(b),1,1).data; return '#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join(''); }),pts);
  const countIn=(x0,y0,x1,y1,hex)=>p.evaluate(([x0,y0,x1,y1,hex])=>{ const d=window.__px.getImageData(x0,y0,x1-x0,y1-y0).data; let n=0; const t=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
    for(let i=0;i<d.length;i+=4) if(d[i]===t[0]&&d[i+1]===t[1]&&d[i+2]===t[2]) n++; return n; },[x0,y0,x1,y1,hex]);
  const box=sel=>p.$eval(sel,e=>{ const r=e.getBoundingClientRect(); return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height}; });
  const sky=()=>p.evaluate(()=>document.documentElement.getAttribute('data-sky')||"day");
  /* the sun-or-moon button of the page on screen, and what it shows */
  const light=()=>p.evaluate(()=>{ const bs=[...document.querySelectorAll('.skylight')].filter(x=>x.offsetParent); const x=bs[0]; if(!x) return {n:0};
    const vis=[...x.querySelectorAll('svg')].filter(s=>getComputedStyle(s).display!=="none"); const r=x.getBoundingClientRect(), s=vis[0]&&vis[0].getBoundingClientRect();
    return {n:bs.length, shows:vis.length===1?(vis[0].classList.contains('sky-moon')?"moon":"sun"):"?", label:x.getAttribute('aria-label'), title:x.title, tag:x.tagName,
      box:{l:r.left,r:r.right,t:r.top,b:r.bottom}, art:s?{l:s.left,r:s.right,t:s.top,b:s.bottom,w:s.width}:null}; });

  await section("A device set to dark opens the night town", async()=>{
    await open(1440,900,'dark');
    ok("the page is switched to night (data-sky=\"night\") with nothing saved on this device", await sky()==="night" && await p.evaluate(()=>localStorage.getItem('ss.sky'))===null);
    const tok=await p.evaluate(()=>['--sky','--paper','--grass'].map(k=>getComputedStyle(document.documentElement).getPropertyValue(k).trim()).concat([window.__hexOf(getComputedStyle(document.body).backgroundColor)]));
    ok("deep-blue sky, a dark page and darker grass ("+tok.join(" ")+")", tok.join()===[NIGHT.sky,NIGHT.paper,NIGHT.grass,NIGHT.paper].join());
    const l=await light();
    ok("the sky shows the moon, not the sun", l.n===1 && l.shows==="moon");
    ok("…a crescent with craters (two colours, and an empty bite out of its square)", await p.$eval('#v-themes .skylight .sky-moon',s=>{ const fills=[...s.querySelectorAll('path')].map(x=>getComputedStyle(x).fill); return s.getAttribute('viewBox')==="0 0 14 14" && new Set(fills).size===2; }));
    await shot();
    const head=await box('#v-themes .pagehead'), art=l.art;
    const moonPx=await countIn(Math.round(art.l),Math.round(art.t),Math.round(art.r),Math.round(art.b),NIGHT.star);
    ok("the moon is really drawn there ("+moonPx+" pale-yellow pixels)", moonPx>800);
    const left=await countIn(0,Math.round(head.t),Math.round(head.l)-4,Math.round(head.b),NIGHT.star), right=await countIn(Math.round(head.r)+170,Math.round(head.t),1440,Math.round(head.b),NIGHT.star);
    ok("stars in the open sky on both sides of the column ("+left+" and "+right+" star pixels)", left>=10 && right>=10);
    const c=await colourAt([[2,head.t+6],[1437,head.t+6],[2,head.b-60],[1437,head.b-60],[720,head.t+4]]);
    ok("the night sky runs edge to edge ("+c.join(", ")+")", c.filter(x=>x===NIGHT.sky).length>=4);
    ok("the clouds are dimmed", await p.$$eval('.town .cloud',cs=>cs.length===4 && cs.every(c=>getComputedStyle(c).opacity==="0.35")));
    ok("windows are lit in warm yellow", await p.$$eval('#themegrid svg.tscene path.px-c',ps=>ps.length>0 && ps.every(x=>window.__hexOf(getComputedStyle(x).fill)==="#ffe08a")));
  });

  await section("Night: wooden signs, a wooden board, cream notes", async()=>{
    const sg=await p.$eval('#themegrid .theme .sign',s=>{ const c=getComputedStyle(s); return {bg:window.__hexOf(c.backgroundColor),fg:window.__hexOf(c.color),edge:window.__hexOf(c.borderTopColor),contrast:window.__contrast(s)}; });
    ok("street signs are wood with cream letters and a dark edge ("+sg.bg+", "+sg.fg+", "+sg.edge+")", sg.bg===NIGHT.sign && sg.fg==="#fff6dc" && sg.edge===NIGHT.edge && sg.contrast>=4.5);
    const td=await p.$eval('#spotdue',s=>{ const c=getComputedStyle(s), n=s.querySelector('.spotdue'), nc=getComputedStyle(n), btn=n.querySelector('.btn:not(.ghost)');
      return {bg:window.__hexOf(c.backgroundColor),title:window.__hexOf(getComputedStyle(s,'::before').color),note:window.__hexOf(nc.backgroundColor),noteEdge:window.__hexOf(nc.borderTopColor),
        low:[...n.querySelectorAll('*')].filter(e=>[...e.childNodes].some(x=>x.nodeType===3&&x.textContent.trim())).map(e=>window.__contrast(e)).filter(x=>x<4.5).length,
        btn:btn?window.__hexOf(getComputedStyle(btn).backgroundColor):""}; });
    ok("the Today board is lighter wood with a cream title ("+td.bg+", "+td.title+")", td.bg===NIGHT.wood && td.title==="#fff6dc");
    ok("…its note is cream paper with a dark edge, every word on it easy to read ("+td.note+")", td.note===NIGHT.cream && td.noteEdge==="#1b1945" && td.low===0);
    ok("…and its Start button is cream too", td.btn===NIGHT.cream);
    await p.click('#btn-more'); await p.waitForTimeout(300); await p.mouse.move(0,0);
    const bd=await p.$eval('#town-board',s=>{ const pl=s.querySelector('.bplace'); return {bg:window.__hexOf(getComputedStyle(s).backgroundColor),title:window.__hexOf(getComputedStyle(s.querySelector('.board-title')).color),
      note:window.__hexOf(getComputedStyle(pl).backgroundColor),low:[...s.querySelectorAll('.bplace-go span,.board-title,.board-head .hint')].map(e=>window.__contrast(e)).filter(x=>x<4.5).length}; });
    ok("the All places board is the same wood, with cream notes and readable names ("+bd.bg+", "+bd.note+")", bd.bg===NIGHT.wood && bd.title==="#fff6dc" && bd.note===NIGHT.cream && bd.low===0);
    await p.click('#btn-more'); await p.waitForTimeout(200);
    await p.hover('#themegrid .theme >> nth=2'); await p.waitForTimeout(250);
    const hv=await p.$eval('#themegrid .theme:nth-child(3) .sign',s=>({bg:window.__hexOf(getComputedStyle(s).backgroundColor),contrast:window.__contrast(s)}));
    ok("pointing at a place still lights its sign up in sun yellow, with dark letters ("+hv.bg+", "+Math.round(hv.contrast*10)/10+":1)", hv.bg==="#ffcd3c" && hv.contrast>=4.5);
    await p.mouse.move(0,0);
  });

  await section("Night: buttons and panels", async()=>{
    await go('words');
    const y=await p.$eval('#spot-open',s=>{ const c=getComputedStyle(s); return {bg:window.__hexOf(c.backgroundColor),edge:window.__hexOf(c.borderTopColor),fg:window.__contrast(s)}; });
    ok("the yellow main button still glows: sun yellow, dark edge, dark letters ("+y.bg+", "+y.edge+")", y.bg==="#ffcd3c" && y.edge===NIGHT.edge && y.fg>=4.5);
    await go('cards');
    const pn=await p.$eval('#cardlist .saved',s=>{ const c=getComputedStyle(s); return {bg:window.__hexOf(c.backgroundColor),edge:window.__hexOf(c.borderTopColor),shadow:c.boxShadow}; });
    ok("panels are night blue with a light frame and a soft purple shadow, not a white glare ("+pn.bg+", "+pn.edge+", "+pn.shadow+")", pn.bg==="#2a2766" && pn.edge==="#f4f1ff" && /rgb\(74, 70, 143\)/.test(pn.shadow));
    const ch=await p.$eval('#cardlist .chip[aria-pressed="true"]',s=>({bg:window.__hexOf(getComputedStyle(s).backgroundColor),c:window.__contrast(s)}));
    ok("the selected filter is light with dark letters ("+ch.bg+")", ch.bg==="#f4f1ff" && ch.c>=4.5);
  });

  await section("Night: every text on every page is easy to read (4.5:1 or more)", async()=>{
    for(const v of ['themes','words','cards','compare','scene','story','chat','spot']){
      await go(v);
      const low=await p.evaluate(()=>window.__lowText(4.5));
      ok(v+": no text below 4.5:1"+(low.length?" (low: "+low.slice(0,4).join(" | ")+")":""), low.length===0);
    }
    await go('themes'); await p.click('#setup-sum'); await p.waitForTimeout(200);
    const low=await p.evaluate(()=>window.__lowText(4.5));
    ok("the open profile too"+(low.length?" (low: "+low.slice(0,4).join(" | ")+")":""), low.length===0);
    await p.click('#setup-sum');
  });

  await section("Tapping the moon switches to day, and this device remembers", async()=>{
    await go('themes');
    let l=await light();
    ok("the moon is a real button that says what it does (\""+l.label+"\", \""+l.title+"\")", l.tag==="BUTTON" && l.label==="Switch to day" && l.title==="Tap for day");
    await p.click('#v-themes .skylight'); await p.waitForTimeout(200);
    l=await light();
    ok("one tap: day, the sun is back, and the button now offers night", await sky()==="day" && l.shows==="sun" && l.label==="Switch to night" && l.title==="Tap for night");
    ok("…the page colours are the daytime ones again", await p.evaluate(()=>window.__hexOf(getComputedStyle(document.body).backgroundColor))==="#fffdf8");
    ok("…and the choice is saved on this device only (ss.sky = day)", await p.evaluate(()=>localStorage.getItem('ss.sky'))==="day");
    const db=await p.evaluate(()=>Object.keys(window.__mockdb()).filter(k=>/sky/i.test(k)).length);
    ok("nothing about it goes into your cloud data", db===0);
    await p.reload(); await p.waitForTimeout(600);
    ok("after a reload, still day, even though the device is set to dark", await sky()==="day");
    await go('words');
    await p.focus('#v-words .skylight'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
    ok("the sun on another page switches back to night, from the keyboard too (the same as the device, so nothing stays saved)", await sky()==="night" && await p.evaluate(()=>localStorage.getItem('ss.sky'))===null);
    await go('themes');
    ok("…and every page follows: Practice shows the moon again", (await light()).shows==="moon");
  });

  await section("With nothing saved, the town follows the device, and changes when it does", async()=>{
    await open(1280,800,'light');
    ok("a light device opens the day town with the sun", await sky()==="day" && (await light()).shows==="sun");
    await p.emulateMedia({colorScheme:'dark'}); await p.waitForTimeout(200);
    ok("the device turns dark: the town turns to night by itself", await sky()==="night" && (await light()).label==="Switch to day");
    await p.emulateMedia({colorScheme:'light'}); await p.waitForTimeout(200);
    ok("…and back to day when the device does", await sky()==="day");
    await p.evaluate(()=>document.documentElement.setAttribute('data-theme','dark')); await p.waitForTimeout(150);
    ok("if the app around the page marks itself dark (data-theme), the town follows that", await sky()==="night");
    await p.evaluate(()=>document.documentElement.setAttribute('data-theme','light')); await p.waitForTimeout(150);
    ok("…and light", await sky()==="day");
    await open(1280,800,'light','night:day');
    await p.emulateMedia({colorScheme:'light'}); await p.waitForTimeout(150);
    ok("a saved tap wins while the device stays the same: night tapped on a light device stays night", await sky()==="night");
  });

  await section("Night is decided before anything is drawn (no flash of the day sky)", async()=>{
    if(ctx) await ctx.close();
    ctx=await b.newContext({viewport:{width:1280,height:800},colorScheme:'dark'}); p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.addInitScript(()=>{ new MutationObserver((ms,o)=>{ if(document.querySelector('header.top')){ window.__skyAtHeader=document.documentElement.getAttribute('data-sky')||"day"; o.disconnect(); } }).observe(document,{childList:true,subtree:true}); });
    await p.goto(URL); await p.waitForTimeout(400);
    ok("the night is already set when the top bar first appears", await p.evaluate(()=>window.__skyAtHeader)==="night");
  });

  /* the sun or moon must never sit on top of a page's picture, its title, its text or its buttons */
  const clear=async(view,dark)=>p.evaluate(([view])=>{
    const sec=document.getElementById('v-'+view), s=[...sec.querySelectorAll('.skylight')].find(x=>x.offsetParent); if(!s) return "no sun or moon";
    const a=[...s.querySelectorAll('svg')].find(x=>getComputedStyle(x).display!=="none").getBoundingClientRect();
    const hit=r=>!(r.right<=a.left||r.left>=a.right||r.bottom<=a.top||r.top>=a.bottom);
    const rects=[];
    sec.querySelectorAll('.pagehead-art svg, .btn, h1, h2, .sub, .eyebrow').forEach(e=>{ if(!e.offsetParent && e.tagName!=="svg") return;
      if(e.tagName==="svg"||e.classList.contains('btn')) rects.push([e,e.getBoundingClientRect()]);
      else { const r=document.createRange(); r.selectNodeContents(e); [...r.getClientRects()].forEach(x=>rects.push([e,x])); } });
    const bad=rects.filter(([e,r])=>r.width>0 && hit(r)).map(([e])=>(e.className&&e.className.baseVal!==undefined?"picture":e.textContent.trim().slice(0,20)));
    return bad.length?"covers: "+bad.join(", "):"";
  },[view]);
  for(const [w,h] of [[1440,900],[1280,800],[1024,800],[760,900],[390,844]]){
    await section(w+"px: a sun or moon on every page, clear of everything else", async()=>{
      for(const scheme of ['light','dark']){
        await open(w,h,scheme);
        const out=[];
        for(const v of ['themes','words','cards','compare','scene','story','chat','spot']){
          await go(v);
          const l=await light(), c=await clear(v), wide=await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
          const want=scheme==='dark'?"moon":"sun";
          if(l.n!==1||l.shows!==want) out.push(v+": "+l.n+" "+l.shows);
          else if(c) out.push(v+": "+c);
          else if(wide) out.push(v+": sideways scroll");
          else if(w>=1240){ const col=await box('#v-'+v+' .section'); if(l.art.l<col.r+60) out.push(v+": not out in the open sky"); }
          else if(w<=640 && Math.round(l.art.w)!==(want==="moon"?42:36)) out.push(v+": "+l.art.w+"px on a phone");
        }
        ok((scheme==='dark'?"night: the moon":"day: the sun")+" on all 8 pages, never over a picture, title, text or button"+(w>=1240?", out in the open sky":"")+(out.length?" ("+out.join(" | ")+")":""), out.length===0);
      }
    });
  }

  await section("Clouds on every page's sky, at the sides on a wide screen", async()=>{
    await open(1440,900,'light');
    const out=[];
    for(const v of ['words','cards','compare','story']){
      await go(v);
      const cs=await p.$$eval('#v-'+v+' .cloud',cs=>cs.filter(c=>getComputedStyle(c).display!=="none").map(c=>{ const r=c.getBoundingClientRect(); return {l:r.left,r:r.right,w:r.width}; }));
      const col=await box('#v-'+v+' .section');
      const sides=cs.filter(c=>c.r<col.l).length>=1 && cs.filter(c=>c.l>col.r).length>=1;
      if(cs.length<2||!sides||cs.some(c=>c.w!==48)) out.push(v+": "+cs.length);
    }
    ok("Words, Cards, Compare and the practice screens have clouds, with one in the open sky on each side"+(out.length?" ("+out.join(" | ")+")":""), out.length===0);
    ok("every page with a sky has exactly one sun-or-moon button", await p.$$eval('main > section',ss=>ss.filter(s=>s.querySelector('.sky')).every(s=>s.querySelectorAll('.skylight').length===1) && ss.filter(s=>s.querySelector('.sky')).length===9));
    await open(390,844,'light');
    await go('words');
    ok("on a phone, the clouds stay hidden", (await p.$$eval('.cloud',cs=>cs.filter(c=>getComputedStyle(c).display!=="none").length))===0);
  });

  await section("The sun lifts a little under the mouse, and Help says how to switch", async()=>{
    await open(1280,800,'light');
    await p.hover('#v-themes .skylight'); await p.waitForTimeout(250);
    ok("pointing at the sun lifts it", await p.$eval('#v-themes .skylight',s=>{ const m=getComputedStyle(s).transform; return /matrix\(1, 0, 0, 1, 0, -3\)/.test(m) && getComputedStyle(s).cursor==="pointer"; }));
    await p.mouse.move(0,0);
    ok("Help has the line \"Tap the sun or moon to switch between day and night.\"", (await p.textContent('#help-box')).includes("Tap the sun or moon to switch between day and night."));
  });

  await section("The Practice title is two lines on a laptop", async()=>{
    for(const [w,h] of [[1440,900],[1280,800],[1024,800],[900,800]]){
      await open(w,h,'light');
      const lines=await p.$eval('#v-themes .lede',e=>{ const r=document.createRange(); r.selectNodeContents(e); return new Set([...r.getClientRects()].map(x=>Math.round(x.top))).size; });
      ok(w+"px: \"Pick a situation you'd actually find yourself in.\" fits on "+lines+" lines", lines===2);
    }
  });

  await section("Daytime is unchanged where it matters", async()=>{
    await open(1280,800,'light');
    const d=await p.evaluate(()=>({sign:window.__hexOf(getComputedStyle(document.querySelector('#themegrid .theme .sign')).backgroundColor),
      note:window.__hexOf(getComputedStyle(document.querySelector('#spotdue .spotdue')).backgroundColor),
      nav:window.__hexOf(getComputedStyle(document.querySelector('#nav-practice')).backgroundColor),
      sun:[...document.querySelectorAll('#v-themes .skylight .sky-sun path')].map(x=>window.__hexOf(getComputedStyle(x).fill)).join()}));
    ok("by day the signs, the Today note and the tab plate are still white, and the sun still sun yellow ("+Object.values(d).join(" ")+")", d.sign==="#ffffff" && d.note==="#ffffff" && d.nav==="#ffffff" && d.sun==="#ffcd3c");
    await go('cards');
    ok("…and a selected filter still has white letters on ink", await p.$eval('#cardlist .chip[aria-pressed="true"]',s=>window.__hexOf(getComputedStyle(s).color)==="#ffffff" && window.__hexOf(getComputedStyle(s).backgroundColor)==="#26235a"));
  });

  await section("Friends' own-key page gets the night town too", async()=>{
    await open(1280,800,'dark',null,'preview-own.html');
    ok("the same file without Claude: a dark device opens it at night, with the moon", await sky()==="night" && (await p.$$eval('.skylight',bs=>bs.length))===9);
  });

  ok("no page errors ("+errs.join(" | ").slice(0,160)+")", errs.length===0);
  if(ctx) await ctx.close();
  await b.close();
})();
