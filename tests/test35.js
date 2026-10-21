// v34 (Siyy, 19 Oct): the street on grass like mock-up B (grass edge to edge, a wider street), and Spot it counts any word class.
const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/'+(process.argv[2]||'preview-mock.html');
const P="data/users/u_test/store/", NOW=Date.now();
const W=(term,extra)=>Object.assign({createdAt:NOW-3600000,term,kind:"phrase",meaning:"meaning of "+term,usage:"",example:"An example with "+term+".",theme:"At Work",level:"B2",fromScene:""},extra||{});
const GRASS="#6ccd5c", SKY="#8fd3ff";
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const errs=[];
  let p;
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const open=async(w,h,docs)=>{
    if(p) await p.close();
    p=await b.newPage({viewport:{width:w,height:h}}); p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
    await p.goto(URL);
    await p.evaluate(([d,P])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); localStorage.setItem('ss.dueHidden',JSON.stringify({spot:'x'})); },[docs||{},P]);
    await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700);
    await p.mouse.move(0,0);
  };
  /* Read real pixels: take a screenshot, decode it in the page, and return the colour at each point (pitfall: the grass is a
     border-image painted outside its box, so no element's style can tell where it shows). */
  const colours=async(points)=>{
    /* v40: this reads the ground, so the cats and dogs (v39) step out of the picture for a moment: one lying on a sample
       point made the check fail now and then, though the grass under it was fine (test40 checks the animals themselves) */
    await p.evaluate(()=>document.querySelectorAll('.petyard').forEach(y=>y.style.visibility='hidden'));
    const png=(await p.screenshot()).toString('base64');
    await p.evaluate(()=>document.querySelectorAll('.petyard').forEach(y=>y.style.visibility=''));
    return p.evaluate(async([png,points])=>{
      const img=new Image(); img.src='data:image/png;base64,'+png; await img.decode();
      const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; const x=c.getContext('2d'); x.drawImage(img,0,0);
      const hex=v=>v.toString(16).padStart(2,'0');
      return points.map(([a,b])=>{ const d=x.getImageData(Math.round(a),Math.round(b),1,1).data; return '#'+hex(d[0])+hex(d[1])+hex(d[2]); });
    },[png,points]);
  };
  const box=async(sel)=>p.$eval(sel,e=>{ const r=e.getBoundingClientRect(); return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height}; });

  await section("Laptop: the street stands on grass that runs edge to edge", async()=>{
    await open(1440,900);
    await p.evaluate(()=>window.scrollTo(0,document.querySelector('#themegrid').getBoundingClientRect().top+window.scrollY-120)); await p.waitForTimeout(150);
    const sign=await box('#themegrid .theme .sign'), grid=await box('#themegrid'), lot=await box('#themegrid .theme .lot');
    const ySign=sign.t+sign.h/2, yBelow=sign.b+(grid.b-sign.b)/2, ySky=lot.t+10;
    const c=await colours([[4,ySign],[1435,ySign],[4,yBelow],[1435,yBelow],[720,yBelow],[4,ySky],[1435,ySky]]);
    ok("beside the signs, at both edges of the screen: grass ("+c[0]+", "+c[1]+")", c[0]===GRASS && c[1]===GRASS);
    ok("below the signs, all the way across: grass ("+c.slice(2,5).join(", ")+")", c[2]===GRASS && c[3]===GRASS && c[4]===GRASS);
    ok("above the ground line, at both edges: sky ("+c[5]+", "+c[6]+")", c[5]===SKY && c[6]===SKY);
    const ends=await p.evaluate(()=>{ const t=document.querySelector('#v-themes .town').getBoundingClientRect(), g=document.querySelector('#themegrid').getBoundingClientRect(); return Math.round(t.bottom-g.bottom); });
    ok("the town ends on grass, with no strip of sky under it ("+ends+"px)", ends===0);
    ok("there is grass under the signs (at least 40px)", grid.b-sign.b>=40);
  });

  await section("Laptop: a wider street, with room around each place", async()=>{
    const col=await box('#v-themes .pagehead'), row=await box('#themegrid .onestreet');
    ok("the street is wider than the reading column ("+Math.round(row.w)+"px vs "+Math.round(col.w)+"px) and centred under it", row.w>=1100 && row.w>col.w && Math.abs((row.l+row.r)/2-(col.l+col.r)/2)<2);
    const lots=await p.$$eval('#themegrid .onestreet > button',bs=>bs.map(x=>{ const r=x.getBoundingClientRect(), s=x.querySelector('svg.tscene').getBoundingClientRect(); return {w:r.width, art:s.width}; }));
    ok("each lot is wider than its 4× building, so the buildings don't touch", lots.length===6 && lots.every(x=>x.art===136 && x.w>x.art+30));
    ok("each sign shows its name on one line", await p.$$eval('#themegrid .theme .sign',ss=>ss.every(s=>{ return s.scrollHeight<=s.clientHeight && s.getBoundingClientRect().height<70 && s.textContent.length>0 && s.getClientRects().length===1; })));
    const clouds=await p.$$eval('.town .cloud',cs=>cs.filter(c=>getComputedStyle(c).display!=="none").map(c=>{ const r=c.getBoundingClientRect(); return {l:r.left,r:r.right}; }));
    ok("two more clouds in the open sky at the sides, outside the text column ("+clouds.length+" clouds)", clouds.length===4 && clouds.some(c=>c.r<col.l) && clouds.some(c=>c.l>col.r));
    ok("no sideways scroll", !(await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)));
  });

  await section("The All places board sits on the grass", async()=>{
    await p.click('#btn-more'); await p.mouse.move(0,0); await p.waitForTimeout(300);
    await p.evaluate(()=>document.querySelector('#town-board').scrollIntoView({block:"center"})); await p.waitForTimeout(150);
    const bd=await box('#town-board');
    const c=await colours([[4,bd.t+bd.h/2],[1435,bd.t+bd.h/2],[bd.l-6,bd.t+20],[bd.r+6,bd.t+20]]);
    ok("grass on both sides of the board ("+c.join(", ")+")", c.every(x=>x===GRASS));
    ok("the board shows 4 places a row on a wide screen", await p.$$eval('#town-board .bplace',bs=>{ const t={}; bs.forEach(x=>{ const k=Math.round(x.getBoundingClientRect().top); t[k]=(t[k]||0)+1; }); return Object.values(t)[0]===4; }));
  });

  await section("Other widths: no sideways scroll, grass at the edges", async()=>{
    for(const [w,h] of [[1280,800],[1024,800],[900,800],[760,900]]){
      await open(w,h);
      await p.evaluate(()=>window.scrollTo(0,document.querySelector('#themegrid').getBoundingClientRect().top+window.scrollY-120)); await p.waitForTimeout(150);
      const sign=await box('#themegrid .theme .sign');
      const c=await colours([[3,sign.t+sign.h/2],[w-4,sign.t+sign.h/2]]);
      const wide=await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
      const art=await p.$$eval('#themegrid .onestreet svg.tscene',ss=>[...new Set(ss.map(s=>Math.round(s.getBoundingClientRect().width)))]);
      ok(w+"px: grass at both edges, no sideways scroll, buildings at a whole size ("+art.join()+"px)", c[0]===GRASS && c[1]===GRASS && !wide && art.length===1 && (art[0]===136 || art[0]===102));
    }
  });

  await section("Phone: grass edge to edge too", async()=>{
    await open(390,844);
    await p.evaluate(()=>window.scrollTo(0,document.querySelector('#themegrid').getBoundingClientRect().top+window.scrollY-120)); await p.waitForTimeout(150);
    const sign=await box('#themegrid .theme .sign'), grid=await box('#themegrid');
    const yBelow=sign.b+(grid.b-sign.b)/2;   /* on the right, the next place's sign slides under the edge, so look below the signs there */
    const c=await colours([[2,sign.t+sign.h/2],[2,yBelow],[195,yBelow],[387,yBelow]]);
    ok("beside and below the signs, edge to edge: grass ("+c.join(", ")+")", c.every(x=>x===GRASS));
    ok("the street still slides on its own, and the page doesn't", await p.$eval('#themegrid .onestreet',s=>s.scrollWidth>s.clientWidth) && !(await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)));
    ok("the side clouds stay hidden on a phone", (await p.$$eval('.town .cloud',cs=>cs.filter(c=>getComputedStyle(c).display!=="none").length))===0);
  });

  await section("Spot it: the same word in another word class counts", async()=>{
    await open(1280,900,{"terms/m":W("mix-up",{kind:"word",meaning:"a mistake where one thing is confused with another"})});
    await p.click('#nav-words'); await p.waitForTimeout(300);
    await p.click('#spot-open'); await p.click('#spot-start'); await p.waitForTimeout(700);
    await p.fill('#spot-reply','Sorry, I mixed up the time. Can we meet at four instead?'); await p.click('#spot-check'); await p.waitForTimeout(500);
    const req=(await p.evaluate(()=>window.__prompts)).filter(x=>x.includes("SPOT IT — CHECK")).pop()||"";
    ok("the check says any form counts, another word class too, with mix-up as the example", req.includes("ANY FORM COUNTS") && req.includes("another word class") && req.includes("counts for \"a mix-up\""));
    ok("'I mixed up the time' is spotted with no cue", await p.isVisible('#spot-result') && (await p.textContent('#spot-result h3'))==="✓ Spotted — no cue");
    ok("…and the feedback shows the saved form as a noun", (await p.textContent('#spot-result')).includes("or as a noun: there was a mix-up"));
    const rec=await p.evaluate(P=>window.__mockdb()[P+"terms/m"].spot,P);
    ok("saved as spotted with no cue", rec && rec.last==="nocue");
  });

  await section("…but a different word still doesn't count", async()=>{
    await open(1280,900,{"terms/m":W("mix-up",{kind:"word",meaning:"a mistake where one thing is confused with another"})});
    await p.click('#nav-words'); await p.waitForTimeout(300);
    await p.click('#spot-open'); await p.click('#spot-start'); await p.waitForTimeout(700);
    await p.fill('#spot-reply','Sorry, I got the time wrong.'); await p.click('#spot-check'); await p.waitForTimeout(500);
    ok("'I got the time wrong' gets the hint, not a tick", !(await p.isVisible('#spot-result')) && (await p.textContent('#spot-out')).includes("Here's a hint"));
  });

  ok("no page errors ("+errs.join(" | ").slice(0,160)+")", errs.length===0);
  await b.close();
})();
