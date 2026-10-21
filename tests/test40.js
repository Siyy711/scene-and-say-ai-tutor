// v39 (Siyy, 21 Oct): a livelier town. Tiny cats and dogs on the grass of Practice, Words, Cards and Compare: they lie,
// flick their tails, blink and stroll, and say hi when you point at them or tap them. One cat or dog hangs on the top edge
// of the box you write in (Tell the story, Act it out, Spot it, Compare practice). 1 to 5 little birds fly across the sky
// now and then, the clouds drift, and the grass has tufts and small flowers. Coats are picked at random each time a page
// opens (5 cats, 5 dogs). At night the animals sleep and no birds fly. With "reduce motion", nothing moves.
// Nothing is stored and nothing is asked of Claude. The timing is tested with Playwright's clock, so no test waits 40 s.
const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/", NOW=Date.now(), D=86400000;
const W=(term,theme,extra)=>Object.assign({createdAt:NOW-3600000,term,kind:"phrase",meaning:"meaning of "+term,usage:"",example:"An example with "+term+".",theme,level:"B2",fromScene:""},extra||{});
const DB={"terms/a":W("touch base","At Work"),"terms/b":W("split the bill","Food & Eating Out"),"terms/c":W("mix-up","At Work",{kind:"word"}),
  "cards/c1":{createdAt:NOW-60000,updatedAt:NOW-60000,title:"Cold soup at the bistro",theme:"Food & Eating Out",setting:"A busy Friday night.",attempts:[{n:1,at:NOW-60000,mode:"story",level:"B1",userText:"I said it.",strengths:[],corrections:[],highlights:[],modelStory:"m",nextTip:"Say what you want first."}]},
  "sets/s1":{createdAt:NOW-20*D,updatedAt:NOW,words:["postpone","put off"],kind:"words",topic:"",source:"own",explain:{core:"core difference",uses:[]}}};
/* v40: only their own sounds (the people's words like "Hi!" went) */
const GREET=["Meow!","Mew!","Purr…","Mrrp?","Meow meow!","Woof!","Arf!","Ruff!","Woof woof!","Yip!"];
const NIGHTSAY=["Zzz…","*yawn*","Mm… zzz"];
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const errs=[];
  let p, ctx;
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const open=async(w,opt)=>{
    opt=opt||{};
    if(ctx) await ctx.close();
    ctx=await b.newContext({viewport:{width:w,height:opt.h||900},colorScheme:opt.scheme||'light',reducedMotion:opt.reduce?'reduce':'no-preference',hasTouch:!!opt.touch,isMobile:!!opt.touch});
    p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
    await p.clock.install();
    await p.goto(URL);
    await p.evaluate(([d,P])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); },[DB,P]);
    await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(800); await p.mouse.move(0,0);
  };
  const go=async v=>{
    await p.mouse.move(0,0);
    if(v==='themes'){ await p.click('#nav-practice'); await p.waitForTimeout(150); if(await p.isHidden('#v-themes')) await p.click('#nav-practice'); }
    else if(v==='words'||v==='cards'||v==='compare') await p.click('#nav-'+v);
    else if(v==='story'||v==='chat'){ await go('themes'); await p.click('#themegrid .theme >> nth=1'); await p.waitForTimeout(600); await p.click('#scene-body .mode:has-text("'+(v==='story'?'Tell the story':'Act it out')+'")'); }
    else if(v==='spot'){ await go('words'); await p.waitForTimeout(150); await p.click('#spot-open'); await p.click('#spot-start'); }
    else if(v==='cround'){ await go('compare'); await p.waitForTimeout(150); await p.click('#cmp-round-open'); await p.click('#cr-start'); }
    await p.waitForTimeout(700);
  };
  const SEC={themes:'#v-themes',words:'#v-words',cards:'#v-cards',compare:'#v-compare',story:'#v-story',chat:'#v-chat',spot:'#v-spot',cround:'#v-cround'};
  const pets=v=>p.$$eval(SEC[v]+' .pet',xs=>xs.filter(x=>x.getClientRects().length).map(x=>{ const r=x.querySelector('.petbody').getBoundingClientRect();
    return {kind:x.dataset.kind,coat:x.dataset.coat,on:[...x.querySelectorAll('svg.on')].map(s=>s.dataset.f),hang:!!x.closest('.pethang'),l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height,tf:x.style.transform}; }));
  const hit=(a,c)=>!(a.r<=c.l+1||a.l>=c.r-1||a.b<=c.t+1||a.t>=c.b-1);
  /* everything on the page you read or press, where it can really be seen: the boxes of the words themselves (each line
     of text, not the whole paragraph), and buttons, links and fields. A part cut off by a closed panel does not count. */
  const things=v=>p.$$eval(SEC[v]+' *, header *',xs=>{
    const clip=(e,r)=>{ for(let a=e.parentElement;a;a=a.parentElement){ const cs=getComputedStyle(a); if(cs.overflow!=='visible'||cs.overflowX!=='visible'||cs.overflowY!=='visible'){ const c=a.getBoundingClientRect();
        r={l:Math.max(r.l,c.left),r:Math.min(r.r,c.right),t:Math.max(r.t,c.top),b:Math.min(r.b,c.bottom)}; } } return r; };
    const out=[];
    xs.forEach(e=>{
      if(e.closest('.pet,.birds,svg,[hidden]')) return;
      const d=e.closest('details'); if(d && !d.open && !e.closest('summary')) return;   /* inside a closed panel */ if(!e.getClientRects().length || getComputedStyle(e).visibility==='hidden') return;
      const what=e.tagName+' '+(e.id||'')+' '+e.textContent.trim().slice(0,20);
      const add=r=>{ r=clip(e,r); if(r.r-r.l>1 && r.b-r.t>1) out.push(Object.assign(r,{what})); };
      if(/^(BUTTON|A|INPUT|TEXTAREA|SELECT)$/.test(e.tagName)){ const r=e.getBoundingClientRect(); add({l:r.left,r:r.right,t:r.top,b:r.bottom}); return; }
      [...e.childNodes].forEach(n=>{ if(n.nodeType!==3||!n.textContent.trim()) return; const g=document.createRange(); g.selectNodeContents(n);
        [...g.getClientRects()].forEach(r=>add({l:r.left,r:r.right,t:r.top,b:r.bottom})); });
    });
    return out; });
  /* every picture an animal shows, as it happens (a recorder in the page, so a short blink is never missed) */
  const record=()=>p.evaluate(()=>{ window.__shown=[]; window.__bad=0;
    new MutationObserver(ms=>ms.forEach(m=>{ const s=m.target; if(!s.parentNode || !s.parentNode.classList || !s.parentNode.classList.contains('petbody')) return; if(s.classList.contains('on')) window.__shown.push(s.dataset.f);
      const body=s.parentNode; if(body && body.querySelectorAll('svg.on').length!==1) window.__bad++; })).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']}); });
  const shown=()=>p.evaluate(()=>({f:[...new Set(window.__shown)],bad:window.__bad,n:window.__shown.length}));
  const sideways=()=>p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);

  for(const w of [1280,390]){
    await section(w+"px: cats and dogs on the grass of the four main pages", async()=>{
      await open(w,{touch:w<500});
      for(const v of ['themes','words','cards','compare']){
        await go(v); await p.evaluate(()=>window.scrollTo(0,0));
        if(v==='themes') await p.evaluate(()=>document.querySelector('#themegrid').scrollIntoView({block:'center'}));
        const ps=await pets(v);
        const want=w<500?1:2;
        ok(v+": "+want+" animal"+(want>1?"s":"")+" on the grass ("+ps.length+")", ps.length===want);
        if(want===2) ok(v+": one cat and one dog", ps.some(x=>x.kind==='cat') && ps.some(x=>x.kind==='dog'));
        ok(v+": each shows exactly one picture", ps.length>0 && ps.every(x=>x.on.length===1));
        ok(v+": each is drawn at a whole-number size (2 screen pixels per art pixel)", await p.$$eval(SEC[v]+' .pet svg',xs=>xs.length>0 && xs.every(s=>{ const vb=s.viewBox.baseVal; return +s.getAttribute('width')===vb.width*2 && +s.getAttribute('height')===vb.height*2; })));
        /* they stand on the grass. Practice: on the lawn below the street signs, never in front of a place.
           The other pages: on the top edge of the strip of grass under the sky (within a few pixels). */
        if(v==='themes'){
          const lawn=await p.evaluate(()=>{ const g=document.querySelector('#themegrid').getBoundingClientRect();
            return {top:Math.max(...[...document.querySelectorAll('#themegrid .sign')].map(s=>s.getBoundingClientRect().bottom)),bottom:g.bottom}; });
          ok(v+": they sit on the lawn below the street signs", ps.length>0 && ps.every(x=>x.t>=lawn.top && x.b<=lawn.bottom));
        } else {
          const ph=await p.evaluate(s=>document.querySelector(s+' .pagehead').getBoundingClientRect().bottom,SEC[v]);
          if(w>=641) ok(v+": they sit on the top edge of the grass", ps.length>0 && ps.every(x=>Math.abs(x.b-(ph-22))<=6));
          else ok(v+": phone: they lie in the strip of grass", ps.length>0 && ps.every(x=>x.b>ph-22 && x.b<=ph));
        }
        const vw=await p.evaluate(()=>document.documentElement.clientWidth);
        ok(v+": inside the window", ps.length>0 && ps.every(x=>x.l>=0 && x.r<=vw));
        const th=await things(v), over=[];
        ps.forEach(x=>th.forEach(t=>{ if(hit(x,t)) over.push(t.what); }));
        ok(v+": they never cover a button, a field or any text"+(over.length?" (covers: "+over.slice(0,3).join(' | ')+")":""), ps.length>0 && over.length===0);
        ok(v+": the page does not scroll sideways", await sideways()<=0);
      }
    });
  }

  await section("pointing at an animal (laptop) or tapping it (phone) makes it say hi", async()=>{
    await open(1280); await go('words');
    const pet=(await p.$$('#v-words .pet'))[0], bb=await pet.boundingBox();
    await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.waitForTimeout(100);
    const say=await p.$eval('#v-words .pet .petsay',e=>e.textContent).catch(()=>null);
    ok("a speech bubble appears ("+say+")", !!say && GREET.includes(say));
    const sb=await p.$eval('#v-words .pet .petsay',e=>{ const r=e.getBoundingClientRect(); return {t:r.top,b:r.bottom}; });
    ok("…above the animal", sb.b<=bb.y+2);
    await p.mouse.move(0,0); await p.clock.runFor(2600);
    ok("…and goes after a couple of seconds", (await p.$$('#v-words .petsay')).length===0);
    const seen=new Set();
    for(let i=0;i<8;i++){ await p.mouse.move(0,0); await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.waitForTimeout(40); seen.add(await p.$eval('#v-words .pet .petsay',e=>e.textContent).catch(()=>'')); }
    ok("the greeting changes ("+[...seen].join(' / ')+")", seen.size>=3);
    await open(390,{touch:true}); await go('words');
    const t=(await p.$$('#v-words .pet'))[0], tb=await t.boundingBox();
    await p.touchscreen.tap(tb.x+tb.width/2,tb.y+tb.height/2); await p.waitForTimeout(100);
    const s2=await p.$eval('#v-words .pet .petsay',e=>e.textContent).catch(()=>null);
    ok("phone: a tap makes it say hi ("+s2+")", !!s2 && GREET.includes(s2));
    ok("…and the tap opens nothing else (still on Words)", await p.isVisible('#v-words') && await p.isHidden('#v-spot'));
  });

  await section("by day they lie, flick their tails, blink and stroll, and never flash", async()=>{
    await open(1280); await go('words'); await record();
    const start=(await pets('words')).map(x=>x.tf);
    for(let i=0;i<30;i++) await p.clock.runFor(1000);
    const r=await shown(), seen=new Set(r.f), bad=r.bad;
    ok("every animal always shows exactly one picture: no gaps, no doubles ("+r.n+" switches in 30 s, "+bad+" bad)", r.n>20 && bad===0);
    ok("they lie down", seen.has('lie'));
    ok("they flick their tails", seen.has('lie2'));
    ok("they blink", seen.has('blink'));
    ok("they stroll (two walking pictures)", seen.has('walk1') && seen.has('walk2'));
    const end=(await pets('words'));
    ok("at least one has moved along the grass", end.some((x,i)=>x.tf!==start[i]));
    const vw=await p.evaluate(()=>document.documentElement.clientWidth);
    ok("…and stayed inside the window", end.length>0 && end.every(x=>x.l>=0 && x.r<=vw));
    const th=await things('words'), over=[]; end.forEach(x=>th.forEach(t=>{ if(hit(x,t)) over.push(t.what); }));
    ok("…without walking onto any text or button"+(over.length?" ("+over.slice(0,2).join(' | ')+")":""), end.length>0 && over.length===0);
  });

  await section("coats are picked at random each time a page opens, and not redrawn while it stays open", async()=>{
    await open(1280); await go('words');
    const first=await p.$('#v-words .pet');
    await p.clock.runFor(5000);
    ok("the same animals stay while the page stays open", await first.evaluate(e=>document.contains(e)));
    const coats=new Set();
    for(let i=0;i<12;i++){ await go('cards'); await go('words'); (await pets('words')).forEach(x=>coats.add(x.kind+':'+x.coat)); }
    ok("several different coats show up over 12 visits ("+coats.size+")", coats.size>=5);
    ok("…for cats and for dogs", [...coats].filter(c=>c.startsWith('cat:')).length>=2 && [...coats].filter(c=>c.startsWith('dog:')).length>=2);
    ok("a page you left has no animals running in the background", (await p.$$('#v-cards .pet')).length===0 || await p.isHidden('#v-cards'));
    await go('cards');
    ok("…Words has none while you are on Cards", (await p.$$('#v-words .pet')).length===0);
  });

  for(const v of ['story','chat','spot','cround']){
    await section(v+": one cat or dog hangs on the top edge of the box you write in", async()=>{
      await open(1280); await go(v);
      const ps=await pets(v);
      ok("exactly one animal on this page ("+ps.length+")", ps.length===1);
      const x=ps[0]||{};
      ok("it is a cat or a dog, hanging", (x.kind==='cat'||x.kind==='dog') && x.hang);
      ok("it shows one picture", (x.on||[]).length===1);
      const fr=await p.evaluate(v=>{ const s={story:'#story-text',chat:'.composer',spot:'#spot-host > *',cround:'#cr-host > *'}[v];
        const e=document.querySelector({story:'#v-story',chat:'#v-chat',spot:'#v-spot',cround:'#v-cround'}[v]+' '+s), r=e.getBoundingClientRect(); return {l:r.left,r:r.right,t:r.top,b:r.bottom}; },v);
      ok("its paws are on the top edge of the box", x.b>=fr.t && x.b<=fr.t+8);
      ok("…on the right side of the box", x.l>(fr.l+fr.r)/2 && x.r<=fr.r);
      const th=await things(v), over=[]; th.forEach(t=>{ if(hit(x,t) && !/^TEXTAREA/.test(t.what) && !/composer|spot-host|cr-host/.test(t.what)) over.push(t.what); });
      ok("it covers no text or button"+(over.length?" ("+over.slice(0,2).join(' | ')+")":""), over.length===0);
      await record(); for(let i=0;i<20;i++) await p.clock.runFor(1000);
      const r=await shown();
      ok("it blinks now and then, and never flashes ("+r.f.join(', ')+"; "+r.bad+" bad)", r.f.includes('hang') && r.f.includes('hang2') && r.bad===0 && (await pets(v)).every(y=>y.on.length===1));
      const pet=await p.$(SEC[v]+' .pet'), bb=await pet.boundingBox();
      await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.waitForTimeout(80);
      ok("pointing at it makes it say hi", GREET.includes(await p.$eval(SEC[v]+' .petsay',e=>e.textContent).catch(()=>'')));
    });
  }

  await section("birds: now and then 1 to 5 fly across the sky, above the words", async()=>{
    await open(1280); await go('words');
    await p.evaluate(()=>{ window.__flocks=[]; new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{ if(n.classList&&n.classList.contains('birds')) setTimeout(()=>window.__flocks.push(n.querySelectorAll('.bird').length),0); }))).observe(document.body,{subtree:true,childList:true}); });
    let maxSide=0, high=true;
    for(let i=0;i<60;i++){ await p.clock.runFor(4000);
      maxSide=Math.max(maxSide,await sideways());
      const r=await p.evaluate(()=>{ const L=document.querySelector('#v-words .birds'); if(!L) return null; const h=document.querySelector('#v-words .pagehead h1').getBoundingClientRect(); return {b:L.getBoundingClientRect().bottom,h1:h.top}; });
      if(r && r.b>r.h1+1) high=false; }
    const f=await p.evaluate(()=>window.__flocks);
    ok("birds come by every 20–40 s (flocks in 4 minutes: "+f.length+")", f.length>=5 && f.length<=13);
    ok("each flock has 1 to 5 birds ("+f.join(', ')+")", f.length>0 && f.every(n=>n>=1&&n<=5));
    ok("…not always the same number", new Set(f).size>=2);
    ok("they fly above the headline, not through the words", f.length>0 && high);
    ok("the page never scrolls sideways while they fly", f.length>0 && maxSide<=0);
  });

  await section("the clouds drift, and the grass has tufts and flowers", async()=>{
    await open(1280); await go('words');
    ok("the clouds drift slowly", await p.$eval('#v-words .cloud',e=>getComputedStyle(e).animationName!=='none' && parseFloat(getComputedStyle(e).animationDuration)>=20));
    const g=await p.evaluate(()=>({head:getComputedStyle(document.querySelector('#v-words .pagehead'),'::after').borderImageSource,
      street:getComputedStyle(document.querySelector('#themegrid'),'::before').borderImageSource,
      turf:getComputedStyle(document.querySelector('#themegrid .turf')).backgroundImage}));
    ok("the grass under the sky is drawn with tufts and flowers", /svg/.test(g.head) && /pattern/.test(decodeURIComponent(g.head)));
    ok("…the street's grass too", /svg/.test(g.street) && g.street===g.head);
    ok("…and the grass under each street sign", /svg/.test(g.turf));
    await p.click('#v-words .skylight');
    const n=await p.evaluate(()=>getComputedStyle(document.querySelector('#v-words .pagehead'),'::after').borderImageSource);
    ok("at night the grass has its own darker texture", /svg/.test(n) && n!==g.head);
  });

  await section("at night the animals sleep, and no birds fly", async()=>{
    await open(1280,{scheme:'dark'}); await go('words');
    const ps=await pets('words');
    ok("two animals, asleep", ps.length===2 && ps.every(x=>x.on.length===1 && x.on[0]==='sleep'));
    ok("…with a little z z", (await p.$$('#v-words .pet .petzz')).length===2);
    const start=ps.map(x=>x.tf); await p.clock.runFor(60000);
    ok("…and they stay where they are", start.length===2 && (await pets('words')).every((x,i)=>x.tf===start[i] && x.on[0]==='sleep'));
    ok("no birds at night (after 60 s)", (await p.$$('.birds')).length===0);
    const pet=(await p.$$('#v-words .pet'))[0], bb=await pet.boundingBox();
    await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.waitForTimeout(80);
    ok("pointing at a sleeping one gives a sleepy line", NIGHTSAY.includes(await p.$eval('#v-words .petsay',e=>e.textContent).catch(()=>'')));
    await p.mouse.move(0,0); await p.click('#v-words .skylight'); await p.waitForTimeout(100);
    const day=await pets('words');
    ok("tapping the sun or moon wakes them up (day pictures)", day.length===2 && day.every(x=>x.on[0]!=='sleep'));
    await p.click('#v-words .skylight'); await p.waitForTimeout(100); await go('story');
    const h=await pets('story');
    ok("at night the animal on the writing box has its eyes closed", h.length===1 && h[0].on[0]==='hang2');
  });

  await section("with 'reduce motion' on, nothing moves", async()=>{
    await open(1280,{reduce:true}); await go('words');
    const start=await pets('words'); const seen=new Set();
    for(let i=0;i<40;i++){ await p.clock.runFor(1000); (await pets('words')).forEach(x=>seen.add(x.on[0])); }
    const end=await pets('words');
    ok("the animals stay where they are", end.length===2 && end.every((x,i)=>x.tf===start[i].tf));
    ok("…and keep one picture", seen.size===1);
    ok("no birds", (await p.$$('.birds')).length===0);
    ok("the clouds stay still", await p.$eval('#v-words .cloud',e=>getComputedStyle(e).animationName==='none'));
    const pet=(await p.$$('#v-words .pet'))[0], bb=await pet.boundingBox();
    await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.waitForTimeout(80);
    ok("they still say hi when you point at them", GREET.includes(await p.$eval('#v-words .petsay',e=>e.textContent).catch(()=>'')));
  });

  await section("decoration only: hidden from screen readers and skipped by the Tab key", async()=>{
    await open(1280); await go('words');
    ok("every animal and bird is hidden from screen readers", await p.$$eval('.pet,.pethang',xs=>xs.length>0 && xs.every(x=>x.closest('[aria-hidden="true"]'))));
    ok("none can be reached with Tab", await p.$$eval('.pet, .pet *',xs=>xs.length>0 && xs.every(x=>x.tabIndex<0 || !x.matches('a,button,input,[tabindex]'))));
  });

  ok("no page errors ("+errs.slice(0,2).join(' | ')+")", errs.length===0);
  await b.close();
})();
