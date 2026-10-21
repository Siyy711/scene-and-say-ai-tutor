// v40 (Siyy, 21 Oct): the cats and dogs only make their own sounds ("Meow!", "Woof!"); "Hi!" or "Nice to see you!" felt off
// coming from an animal. A click (or a tap) makes one do a back flip: it jumps, turns over backwards once and lands where it was.
// Not while it sleeps at night, and not with "reduce motion" on. The one on the writing box flips too.
const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/", NOW=Date.now(), D=86400000;
const W=(term,theme,extra)=>Object.assign({createdAt:NOW-3600000,term,kind:"phrase",meaning:"meaning of "+term,usage:"",example:"An example with "+term+".",theme,level:"B2",fromScene:""},extra||{});
const DB={"terms/a":W("touch base","At Work"),"terms/b":W("split the bill","Food & Eating Out"),"terms/c":W("mix-up","At Work",{kind:"word"}),
  "cards/c1":{createdAt:NOW-60000,updatedAt:NOW-60000,title:"Cold soup at the bistro",theme:"Food & Eating Out",setting:"A busy Friday night.",attempts:[{n:1,at:NOW-60000,mode:"story",level:"B1",userText:"I said it.",strengths:[],corrections:[],highlights:[],modelStory:"m",nextTip:"Say what you want first."}]},
  "sets/s1":{createdAt:NOW-20*D,updatedAt:NOW,words:["postpone","put off"],kind:"words",topic:"",source:"own",explain:{core:"core difference",uses:[]}}};
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
  const CAT=["Meow!","Mew!","Purr…","Mrrp?","Meow meow!"], DOG=["Woof!","Arf!","Ruff!","Woof woof!","Yip!"], SLEEPS=["Zzz…","*yawn*","Mm… zzz"];
  const WORDS=/\b(hi|hey|there|going|see|nice|good|walk|long|night|dreams|oh)\b/i;   /* people's words: not from a cat or a dog */
  const centre=async el=>{ const bb=await el.boundingBox(); return [bb.x+bb.width/2,bb.y+bb.height/2]; };
  const sayOf=el=>el.$eval('.petsay',e=>e.textContent).catch(()=>'');
  const flipOf=el=>el.evaluate(x=>{ const b=x.querySelector('.petbody'), a=b.getAnimations().find(a=>/flip/.test(a.animationName||''));
    return {on:x.classList.contains('flip'), name:getComputedStyle(b).animationName, turn:a ? a.effect.getKeyframes().map(k=>k.rotate).filter(Boolean).pop() : null}; });

  await section("they only make their own sounds", async()=>{
    await open(1280); await go('words');
    const seen={cat:new Set(),dog:new Set()};
    for(const el of await p.$$('#v-words .pet')){
      const kind=await el.evaluate(x=>x.dataset.kind), [x,y]=await centre(el);
      for(let i=0;i<12;i++){ await p.mouse.move(0,0); await p.mouse.move(x,y); await p.waitForTimeout(30); seen[kind].add(await sayOf(el)); }
    }
    const cat=[...seen.cat], dog=[...seen.dog];
    ok("the cat only meows and purrs ("+cat.join(' / ')+")", cat.length>0 && cat.every(t=>CAT.includes(t)));
    ok("the dog only woofs ("+dog.join(' / ')+")", dog.length>0 && dog.every(t=>DOG.includes(t)));
    ok("no people's words like \"Hi\" or \"Nice to see you\"", [...cat,...dog].every(t=>!WORDS.test(t)));
    ok("the sound still changes (3 or more each)", cat.length>=3 && dog.length>=3);
    await go('story');
    const h=await p.$('#v-story .pet'), kind=await h.evaluate(x=>x.dataset.kind), [x,y]=await centre(h);
    await p.mouse.move(x,y); await p.waitForTimeout(40);
    ok("the one on the writing box too", (kind==='cat'?CAT:DOG).includes(await sayOf(h)));
    await open(1280,{scheme:'dark'}); await go('words');
    const night=new Set();
    for(const el of await p.$$('#v-words .pet')){ const [x,y]=await centre(el); for(let i=0;i<6;i++){ await p.mouse.move(0,0); await p.mouse.move(x,y); await p.waitForTimeout(30); night.add(await sayOf(el)); } }
    ok("asleep, only sleepy sounds ("+[...night].join(' / ')+")", night.size>0 && [...night].every(t=>SLEEPS.includes(t)));
  });

  await section("a click makes it do a back flip (laptop)", async()=>{
    await open(1280); await go('words');
    const el=(await p.$$('#v-words .pet'))[0], [x,y]=await centre(el);
    await p.mouse.move(x,y); await p.waitForTimeout(60);
    ok("pointing at it is not enough: no flip yet", !(await flipOf(el)).on);
    const before=await el.evaluate(x=>x.style.transform);
    await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(60);
    const f=await flipOf(el);
    ok("a click starts the back flip: a jump and a turn ("+f.name+")", f.on && f.name==='pet-hop, pet-flip');
    ok("…one whole turn backwards: a cat or dog facing right turns anticlockwise ("+f.turn+")", f.turn==='-360deg');
    ok("…and it makes a sound as well", [...CAT,...DOG].includes(await sayOf(el)));
    await p.clock.runFor(1100);
    ok("after the flip it lands where it was", !(await flipOf(el)).on && await el.evaluate(x=>x.style.transform)===before);
    await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(40);
    ok("you can make it flip again", (await flipOf(el)).on);
    await p.clock.runFor(1100);
    await el.evaluate(x=>x.classList.add('goleft'));
    await p.mouse.move(0,0); await p.mouse.move(x,y); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(40);
    const g=await flipOf(el);
    ok("one facing left turns the other way, so it is still a back flip ("+g.name+", "+g.turn+")", g.on && g.name==='pet-hop, pet-flip-left' && g.turn==='360deg');
    ok("…and the click opens nothing else (still on Words)", await p.isVisible('#v-words') && await p.isHidden('#v-spot'));
  });

  await section("a tap makes it flip (phone), and the one on the writing box flips too", async()=>{
    await open(390,{touch:true}); await go('words');
    const el=(await p.$$('#v-words .pet'))[0], [x,y]=await centre(el);
    await p.touchscreen.tap(x,y); await p.waitForTimeout(60);
    ok("phone: a tap starts the back flip", (await flipOf(el)).on);
    await open(1280); await go('story');
    const h=await p.$('#v-story .pet'), spot=await p.$eval('#v-story .pethang',e=>[e.style.top,e.style.left].join());
    const [hx,hy]=await centre(h); await p.mouse.click(hx,hy); await p.waitForTimeout(60);
    ok("the animal on the box flips when you click it", (await flipOf(h)).on);
    await p.clock.runFor(1100);
    ok("…and is back on the box afterwards", !(await flipOf(h)).on && await p.$eval('#v-story .pethang',e=>[e.style.top,e.style.left].join())===spot);
    ok("…and the box still works (you can type)", await p.fill('#story-text','Hello').then(()=>true).catch(()=>false));
  });

  await section("v41: the flip is higher and smooth", async()=>{
    await open(1280); await go('words');
    const el=(await p.$$('#v-words .pet'))[0], [x,y]=await centre(el);
    await p.mouse.click(x,y); await p.waitForTimeout(40);
    const k=await el.evaluate(x=>{ const b=x.querySelector('.petbody'), A=b.getAnimations();
      const hop=A.find(a=>a.animationName==='pet-hop'), turn=A.find(a=>/^pet-flip/.test(a.animationName));
      const ys=hop ? hop.effect.getKeyframes().map(f=>parseFloat(String(f.translate||'0 0').split(' ')[1]||0)) : [];
      const say=x.querySelector('.petsay');
      return {high:ys.length?-Math.min(...ys):0, ms:turn?turn.effect.getTiming().duration:0,
        stops:turn?[...new Set(turn.effect.getKeyframes().map(f=>f.rotate))]:[], easing:turn?turn.effect.getKeyframes().map(f=>f.easing):[],
        room:say?parseFloat(getComputedStyle(say).bottom)-x.offsetHeight:0}; });
    ok("it jumps higher: at least 40px ("+k.high+"px)", k.high>=40);
    ok("it takes its time: about a second ("+k.ms+" ms)", k.ms>=900 && k.ms<=1200);
    ok("one smooth turn, with no stops on the way ("+k.stops.join(' → ')+")", k.stops.length===2 && k.stops[0]==='0deg' && k.stops[1]==='-360deg');
    ok("…that starts slowly and slows down at the end, not at an even, robot-like pace", k.easing.some(e=>/cubic-bezier|ease/.test(e)));
    ok("the speech bubble sits high enough to stay clear of the jump ("+k.room+"px)", k.room>=k.high+16);
  });

  await section("no flip while they sleep, or with 'reduce motion' on", async()=>{
    await open(1280,{scheme:'dark'}); await go('words');
    let el=(await p.$$('#v-words .pet'))[0], [x,y]=await centre(el);
    await p.mouse.click(x,y); await p.waitForTimeout(60);
    ok("asleep: no flip", !(await flipOf(el)).on);
    ok("…but it still makes a sleepy sound", SLEEPS.includes(await sayOf(el)));
    await open(1280,{reduce:true}); await go('words');
    el=(await p.$$('#v-words .pet'))[0]; [x,y]=await centre(el);
    await p.mouse.click(x,y); await p.waitForTimeout(60);
    const f=await flipOf(el);
    ok("reduce motion: nothing turns over ("+f.name+")", f.name==='none' && !f.turn);
    ok("…but it still makes a sound", [...CAT,...DOG].includes(await sayOf(el)));
  });

  ok("no page errors ("+errs.slice(0,2).join(' | ')+")", errs.length===0);
  await b.close();
})();
