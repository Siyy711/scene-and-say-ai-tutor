// v38 (Siyy, 20 Oct): how to say a word (自然拼读), under the word in its open entry. Siyy chose, one question at a time:
// in each word's entry for new and old words; chunks + letter-sound tips + IPA; made the first time you open the word;
// the IPA matches the reading voice (Any English or Australian: both, marked UK and US).
// Claude makes it once per word and SS keeps it on the word as `sound`, so the next time it shows at once.
const {chromium}=require(process.env.PW||'playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/preview-mock.html';
const P="data/users/u_test/store/", NOW=Date.now();
const HASBEEN={chunks:"HAZ · been",tips:["the s in has sounds like z"],uk:"/ˈhæz.biːn/",us:"/ˈhæz.bɪn/"};
const DB={
  "terms/a":{createdAt:NOW-3600000,term:"touch base",kind:"phrase",meaning:"talk briefly",usage:"",example:"Let's touch base on Monday.",theme:"At Work",level:"B2",fromScene:""},
  "terms/h":{createdAt:NOW-3700000,term:"has-been",kind:"word",meaning:"someone no longer popular",usage:"",example:"He's a has-been.",theme:"Small Talk",level:"B2",fromScene:"",sound:HASBEEN},
  "terms/r1":{createdAt:NOW-3800000,term:"record",kind:"word",meaning:"a written account kept for later",usage:"",example:"Keep a record of the call.",theme:"Home & Neighbours",level:"B2",fromScene:""},
  "terms/r2":{createdAt:NOW-3900000,term:"record",kind:"word",meaning:"to store sound or pictures",usage:"",example:"We record every meeting.",theme:"Home & Neighbours",level:"B2",fromScene:""},
  "terms/x":{createdAt:NOW-4000000,term:"brokensound",kind:"word",meaning:"a word whose first answer breaks",usage:"",example:"",theme:"Shopping & Money",level:"B2",fromScene:""},
  "terms/s":{createdAt:NOW-4100000,term:"same sound",kind:"phrase",meaning:"sounds the same in both accents",usage:"",example:"",theme:"Travel & Transport",level:"B2",fromScene:""}
};
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const errs=[];
  let p, ctx;
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  const open=async(w,flags)=>{
    if(ctx) await ctx.close();
    ctx=await b.newContext({viewport:{width:w||1280,height:900}}); p=await ctx.newPage();
    p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
    await p.goto(URL);
    await p.evaluate(([d,P,f])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o)); (f||[]).forEach(k=>localStorage.setItem(k,"1")); },[DB,P,flags]);
    await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700);
    await p.click('#nav-words'); await p.waitForTimeout(300);
  };
  const row=id=>'.wordrow[data-id="'+id+'"]';
  const toggle=async id=>{ await p.click(row(id)+' .wordbtn'); await p.waitForTimeout(250); };
  const asks=()=>p.evaluate(()=>window.__soundAsks||0);
  const soundTxt=id=>p.$eval(row(id)+' .term-sound',e=>e.textContent.replace(/\s+/g," ").trim());
  const ipas=id=>p.$$eval(row(id)+' .term-sound .snd-ipa',a=>a.map(e=>e.textContent.replace(/\s+/g," ").trim()));
  const lastSound=()=>p.evaluate(()=>window.__prompts.filter(x=>x.indexOf("HOW TO SAY IT.")===0).slice(-1)[0]||"");
  const saved=id=>p.evaluate(([P,id])=>(window.__mockdb()[P+"terms/"+id]||{}).sound||null,[P,id]);
  const voice=async label=>{
    await p.click('#nav-practice'); await p.waitForTimeout(150);
    if(!(await p.isVisible('#accents'))){ await p.click('#setup-sum'); await p.waitForTimeout(150); }
    await p.click('#accents .chip:has-text("'+label+'")'); await p.waitForTimeout(150);
    await p.click('#nav-words'); await p.waitForTimeout(200);
  };

  await section("An old word gets its sound line the first time you open it", async()=>{
    await open();
    ok("nothing is asked before you open a word", await asks()===0);
    await toggle('a');
    ok("open \"touch base\": the sound line shows", await p.isVisible(row('a')+' .term-sound .snd-chunks'));
    ok("…it starts with \"Say it:\" and the chunks: "+await soundTxt('a'), (await soundTxt('a')).indexOf("Say it: TOUCH · BASE")===0);
    ok("…it sits under the word, first in the entry, above the meaning", await p.$eval(row('a')+' .worddetail',d=>d.firstElementChild.classList.contains('term-sound') && d.querySelector('.term-sound').getBoundingClientRect().bottom<=d.querySelector('.term-mean').getBoundingClientRect().top));
    ok("…with up to two letter-sound tips", await p.$$eval(row('a')+' .snd-tips li',l=>l.length)===2);
    ok("…and, with \"Any English\" as your voice, both IPA, marked UK and US: "+JSON.stringify(await ipas('a')), JSON.stringify(await ipas('a'))===JSON.stringify(["UK /ˈʌk touch base/","US /ˈʊs touch base/"]));
    const q=await lastSound();
    ok("the request names the word, its meaning here and your sentence", q.indexOf("EXPRESSION: touch base")>=0 && q.indexOf("MEANING HERE: talk briefly")>=0 && q.indexOf('SENTENCE: "Let\'s touch base on Monday."')>=0);
    ok("…and asks for chunks, tips, British and American IPA", ['"chunks"','"tips"','"uk"','"us"'].every(k=>q.indexOf(k)>=0));
    const sv=await saved('a');
    ok("it is saved on the word (sound: chunks, tips, uk, us)", !!sv && sv.chunks==="TOUCH · BASE" && sv.tips.length===2 && sv.uk==="/ˈʌk touch base/" && sv.us==="/ˈʊs touch base/");
    ok("…and nothing else on the word changed", await p.evaluate(P=>{ const t=window.__mockdb()[P+"terms/a"]; return t.term==="touch base" && t.meaning==="talk briefly" && t.example==="Let's touch base on Monday."; },P));
    ok("asked once", await asks()===1);
    await toggle('a'); await toggle('a');
    ok("close and open again: it shows at once, nothing new is asked", await asks()===1 && (await soundTxt('a')).indexOf("TOUCH · BASE")>=0);
    await p.reload(); await p.waitForTimeout(700); await p.click('#nav-words'); await p.waitForTimeout(300);
    await toggle('a');
    ok("after a reload: it shows at once from your saved words, nothing is asked", await asks()===0 && (await soundTxt('a')).indexOf("TOUCH · BASE")>=0);
    await toggle('h');
    ok("a word that already has its sounds shows them and asks nothing: "+await soundTxt('h'), await asks()===0 && (await soundTxt('h')).indexOf("Say it: HAZ · been")===0 && (await soundTxt('h')).indexOf("the s in has sounds like z")>=0);
    ok("the IPA uses a font that has the IPA symbols, not the app's font (Lexend lacks ɪ ʊ ʌ ɔ ː)", await p.$eval(row('h')+' .snd-ph',e=>!/^\s*"?Lexend/i.test(getComputedStyle(e).fontFamily)));
    ok("a closed word asks nothing: only the two words you opened have sounds", await p.evaluate(P=>Object.keys(window.__mockdb()).filter(k=>window.__mockdb()[k].sound).length,P)===2);
  });

  await section("The IPA follows your reading voice", async()=>{
    await open();
    await toggle('h');
    await voice("British");
    ok("voice British: only the British IPA: "+JSON.stringify(await ipas('h')), JSON.stringify(await ipas('h'))===JSON.stringify(["UK /ˈhæz.biːn/"]));
    await voice("American");
    ok("voice American: only the American IPA: "+JSON.stringify(await ipas('h')), JSON.stringify(await ipas('h'))===JSON.stringify(["US /ˈhæz.bɪn/"]));
    await voice("Australian");
    ok("voice Australian: both, marked UK and US", JSON.stringify(await ipas('h'))===JSON.stringify(["UK /ˈhæz.biːn/","US /ˈhæz.bɪn/"]));
    await voice("American");
    await p.reload(); await p.waitForTimeout(700); await p.click('#nav-words'); await p.waitForTimeout(300); await toggle('h');
    ok("the voice is remembered: after a reload, still only the American IPA", JSON.stringify(await ipas('h'))===JSON.stringify(["US /ˈhæz.bɪn/"]));
    await voice("Any English");
    ok("voice Any English: both again", (await ipas('h')).length===2);
    ok("changing the voice asks Claude nothing", await asks()===0);
    await toggle('s');
    ok("when British and American are the same, it shows once, marked \"UK & US\": "+JSON.stringify(await ipas('s')), JSON.stringify(await ipas('s'))===JSON.stringify(["UK & US /ˈseɪm ˈsaʊnd/"]));
  });

  await section("Each meaning is asked on its own", async()=>{
    await open();
    await p.click('.wgroup[data-root="record"] .wgroup-head'); await p.waitForTimeout(200);
    await toggle('r1');
    ok("\"record\" (a written account): asked with that meaning and sentence", (await lastSound()).indexOf("MEANING HERE: a written account kept for later")>=0 && (await lastSound()).indexOf('SENTENCE: "Keep a record of the call."')>=0);
    await toggle('r2');
    ok("\"record\" (to store sound): asked again, with its own meaning", await asks()===2 && (await lastSound()).indexOf("MEANING HERE: to store sound or pictures")>=0);
    ok("…and each meaning keeps its own answer", (await saved('r1')).tips[0].indexOf("a written account")>=0 && (await saved('r2')).tips[0].indexOf("to store sound")>=0);
  });

  await section("When the answer breaks", async()=>{
    await open();
    await toggle('x');
    ok("a broken answer says so, with a Try again button", /Couldn't get the sounds\./.test(await soundTxt('x')) && await p.isVisible(row('x')+' .term-sound .btn:has-text("Try again")'));
    ok("…and nothing is saved", await saved('x')===null);
    await p.click(row('x')+' .term-sound .btn:has-text("Try again")'); await p.waitForTimeout(250);
    ok("Try again: the sound line shows and is saved", (await soundTxt('x')).indexOf("Say it: BROKENSOUND")===0 && !!(await saved('x')));
    ok("…and the rest of the entry stayed open (only the sound line was redrawn)", await p.isVisible(row('x')+' .worddetail') && await p.isVisible(row('x')+' .btn:has-text("Go deeper")'));
  });

  await section("No AI in this view: no sound line, and nothing else changes", async()=>{
    await open(1280,["__noSample"]);
    await toggle('a');
    ok("the entry opens with its meaning, without a sound line or an error", await p.isVisible(row('a')+' .term-mean') && !(await p.isVisible(row('a')+' .term-sound')) && !/Couldn't/.test(await p.textContent(row('a'))));
    await toggle('h');
    ok("…a word with saved sounds still shows them", (await soundTxt('h')).indexOf("HAZ · been")>=0);
  });

  await section("A new note gets its sound line too", async()=>{
    await open();
    await p.click('#note-open'); await p.fill('#note-term','slipped through the cracks'); await p.click('#note-go'); await p.waitForTimeout(900);
    const id=await p.evaluate(P=>Object.keys(window.__mockdb()).filter(k=>window.__mockdb()[k].term==="slip through the cracks").map(k=>k.split("/").pop())[0],P);
    ok("the new word opens with its sound line", !!id && (await soundTxt(id)).indexOf("Say it: SLIP · THROUGH · THE · CRACKS")===0);
    ok("…and it is saved on the new word", !!id && !!(await saved(id)));
  });

  await section("Phone width (400px)", async()=>{
    await open(400);
    await toggle('a');
    ok("the sound line shows", await p.isVisible(row('a')+' .term-sound .snd-chunks'));
    ok("nothing sticks out sideways", await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    ok("the sound line stays inside the entry", await p.$eval(row('a')+' .term-sound',e=>{ const r=e.getBoundingClientRect(), d=e.parentNode.getBoundingClientRect(); return r.left>=d.left-1 && r.right<=d.right+1; }));
  });

  await section("Help says how to find it", async()=>{
    await open();
    ok("Help: \"Open a word to see how to say it: its chunks, its sounds (IPA) and a tip or two. The IPA follows your reading voice in Your profile.\"",
      (await p.textContent('#help-box')).includes("Open a word to see how to say it: its chunks, its sounds (IPA) and a tip or two. The IPA follows your reading voice in Your profile."));
  });

  /* Friends' own-key page: the same request goes to their own AI service (fake here, like test30). */
  await section("Friends' own-key page", async()=>{
    const GOOD="sk-or-test-good", SEEN=[];
    const srv=http.createServer((q,s)=>{ s.writeHead(200,{"Content-Type":"text/html; charset=utf-8"}); s.end(fs.readFileSync(path.join(process.cwd(),'preview-own.html'))); });
    await new Promise(r=>srv.listen(0,"127.0.0.1",r));
    const OURL="http://127.0.0.1:"+srv.address().port+"/";
    try{
      if(ctx) await ctx.close();
      ctx=await b.newContext({viewport:{width:1280,height:900}});
      await ctx.route(/^https:\/\/openrouter\.ai\//,async route=>{
        const req=route.request(), cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
        if(req.method()==="OPTIONS") return route.fulfill({status:204,headers:cors});
        const body=JSON.parse(req.postData()||"{}"), msgs=body.messages||[], last=String((msgs[msgs.length-1]||{}).content||"");
        SEEN.push(last);
        if((req.headers()["authorization"]||"")!=="Bearer "+GOOD) return route.fulfill({status:401,headers:cors,body:"{}"});
        let out={};
        if(last.indexOf("file an expression they met outside")>=0) out={term:"touch base",kind:"phrase",meaning:"talk briefly",usage:"Neutral.",example:"Let's touch base on Monday.",alsoUsed:null,theme:"At Work",situation:"",check:"",pattern:"",sameAs:-1,addForm:"",register:{level:"neutral",domain:"work"}};
        else if(last.indexOf("HOW TO SAY IT.")===0) out={chunks:"TOUCH BASE",tips:["ou in touch sounds like the u in cup"],uk:"/ˌtʌtʃ ˈbeɪs/",us:"/ˌtʌtʃ ˈbeɪs/"};
        return route.fulfill({status:200,headers:Object.assign({"Content-Type":"application/json"},cors),body:JSON.stringify({id:"x",choices:[{index:0,message:{role:"assistant",content:JSON.stringify(out)},finish_reason:"stop"}]})});
      });
      p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(5000);
      await p.goto(OURL);
      await p.evaluate(k=>localStorage.setItem('ss.own.v1',JSON.stringify({service:"openrouter",base:"https://openrouter.ai/api/v1",model:"openai/gpt-5.4-mini",key:k})),GOOD);
      await p.reload(); await p.waitForTimeout(800);
      await p.click('#nav-words'); await p.waitForTimeout(300);
      await p.click('#note-open'); await p.fill('#note-term','touch base'); await p.click('#note-go'); await p.waitForTimeout(1200);
      ok("a new note on the own-key page opens with its sound line: "+(await p.textContent('.term-sound').catch(()=>"")).replace(/\s+/g," ").trim(),
        /Say it:\s*TOUCH BASE/.test(await p.textContent('.term-sound')) && /UK & US\s*\/ˌtʌtʃ ˈbeɪs\//.test(await p.textContent('.term-sound')));
      ok("…the request went to the learner's own AI service", SEEN.some(x=>x.indexOf("HOW TO SAY IT.")===0 && x.indexOf("EXPRESSION: touch base")>=0));
    } finally { srv.close(); }
  });

  ok("no page errors ("+errs.join(" | ").slice(0,160)+")", errs.length===0);
  if(ctx) await ctx.close();
  await b.close();
})();
