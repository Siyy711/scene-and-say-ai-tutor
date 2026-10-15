// v31 (S1 slice 3): the own-key page friends open on GitHub Pages.
// The wrapper gives the page a proper title; the setup card links to the friend's guide; and with no AI service
// connected yet, the page says "needs your AI service" (and how to fix it), never "needs Claude".
// Part 2 checks the claude.ai stand-in keeps its own wording and has no guide link.
const {chromium}=require(process.env.PW||'playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const OWNFILE=process.argv[2]||'preview-own.html', MOCKFILE=process.argv[3]||'preview-mock.html';
const NOW=Date.now(), D=86400000, P="data/users/local/store/";
const SEED={};
SEED[P+"terms/t1"]={createdAt:NOW-D,term:"touch base",kind:"phrase",meaning:"to make brief contact",usage:"u",example:"Let's touch base on Monday.",theme:"At Work",level:"B2",fromScene:""};
SEED[P+"cards/c1"]={createdAt:NOW-D,updatedAt:NOW-D,title:"Cold soup at the bistro",theme:"Food & Eating Out",setting:"A busy night.",attempts:[{n:1,at:NOW-D,mode:"story",level:"B1",userText:"I said it.",strengths:[],corrections:[],highlights:[],modelStory:"m",nextTip:"t"}]};
const FIX="needs your AI service. Connect it at the top of the Practice page.";

(async()=>{
  const srv=http.createServer((q,s)=>{ s.writeHead(200,{"Content-Type":"text/html; charset=utf-8"}); s.end(fs.readFileSync(path.join(process.cwd(),OWNFILE))); });
  await new Promise(r=>srv.listen(0,"127.0.0.1",r));
  const URL="http://127.0.0.1:"+srv.address().port+"/";
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const errs=[];
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,90)+')', false); } };
  const claudeText=p=>p.evaluate(()=>{ const t=document.body.innerText+"\n"+[...document.querySelectorAll('[title]')].map(e=>e.title).join("\n"); return (t.match(/[^\n]*\bClaude\b[^\n]*/g)||[]); });

  await section("The page itself (what GitHub Pages serves)", async()=>{
    const html=fs.readFileSync(path.join(process.cwd(),OWNFILE),'utf8');
    const head=html.slice(0,html.indexOf('<body'));
    ok("the title 'Scene & Say' is in the page head (browser tab, bookmarks, link previews)", /<head>[\s\S]*<title>Scene &amp; Say<\/title>[\s\S]*<\/head>/.test(head));
    ok("…with a one-line description for link previews", /<meta name="description" content="[^"]*own AI service[^"]*">/.test(head));
  });

  await section("Own-key version, no AI service connected yet", async()=>{
    const ctx=await b.newContext({viewport:{width:1280,height:900}});
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(5000);
    await p.goto(URL); await p.waitForTimeout(500);
    await p.evaluate(docs=>new Promise(r=>{ const q=indexedDB.open("scene-and-say",1); q.onupgradeneeded=()=>q.result.createObjectStore("docs");
      q.onsuccess=()=>{ const tx=q.result.transaction("docs","readwrite"); for(const k in docs) tx.objectStore("docs").put(docs[k],k); tx.oncomplete=()=>{ q.result.close(); r(); }; }; }),SEED);
    await p.reload(); await p.waitForTimeout(700);
    ok("the browser tab says 'Scene & Say'", (await p.title())==="Scene & Say");
    ok("the setup card links to the friend's guide", (await p.isVisible('#own-guide')) && /New here\? Read the 5-minute guide/.test(await p.textContent('#own-guide')));
    const g=await p.evaluate(()=>{ const a=document.getElementById('own-guide'); if(!a) return {}; return {href:a.href,target:a.target,rel:a.rel,line:a.parentNode.textContent}; });
    ok("…the guide in the public repo", g.href==="https://github.com/Siyy711/scene-and-say-ai-tutor/blob/main/docs/friend-guide.md");
    ok("…opening in a new tab, so the setup card stays where it is", g.target==="_blank" && /noopener/.test(g.rel||""));
    ok("…and says what's in it", /costs.*key.*data safe/.test(g.line||""));
    ok("Practice shows no 'Claude' anywhere", (await claudeText(p)).length===0);
    await p.click('#nav-words'); await p.waitForTimeout(200);
    await p.click('text=touch base'); await p.waitForTimeout(200);
    await p.click('text=Go deeper'); await p.waitForTimeout(200);
    ok("Go deeper says: 'This "+FIX+"'", (await p.textContent('#v-words')).indexOf("This "+FIX)>=0);
    await p.click('#note-open'); await p.waitForTimeout(200);
    ok("Add a note says: 'Adding a note "+FIX+"'", (await p.textContent('#note-msg'))==="Adding a note "+FIX);
    ok("Words shows no 'Claude' anywhere", (await claudeText(p)).length===0);
    await p.click('#nav-cards'); await p.waitForTimeout(200);
    await p.click('text=Cold soup at the bistro'); await p.waitForTimeout(300);
    ok("an open card says: 'Practising again "+FIX+"'", (await p.textContent('#v-cards')).indexOf("Practising again "+FIX)>=0);
    ok("Cards shows no 'Claude' anywhere", (await claudeText(p)).length===0);
    await p.click('#nav-compare'); await p.waitForTimeout(200);
    ok("Compare's Find pairs says 'The AI looks through your word bank…'", /^The AI looks through your word bank/.test(await p.getAttribute('#cmp-find','title')));
    ok("Compare shows no 'Claude' anywhere", (await claudeText(p)).length===0);
    await p.click('#nav-practice'); await p.evaluate(()=>{ document.getElementById('help-box').open=true; }); await p.waitForTimeout(200);
    ok("Help shows no 'Claude' anywhere", (await claudeText(p)).length===0);
    await ctx.close();
  });

  await section("claude.ai stand-in keeps its own wording", async()=>{
    const ctx=await b.newContext({viewport:{width:1280,height:900}});
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(5000);
    await p.goto('file://'+process.cwd()+'/'+MOCKFILE+'#db'); await p.waitForTimeout(900);
    ok("no setup card and no guide link on claude.ai", !(await p.$('#own-guide')) && !(await p.isVisible('#own-svc').catch(()=>false)));
    await p.click('#nav-compare'); await p.waitForTimeout(200);
    ok("Find pairs still says 'Claude looks through your word bank…'", /^Claude looks through your word bank/.test(await p.getAttribute('#cmp-find','title')));
    await ctx.close();
  });

  ok("no page errors ("+errs.slice(0,2).join(" | ").slice(0,160)+")", errs.length===0);
  await b.close(); srv.close();
})();
