// v31 (S1 slice 2): backup and restore, and the backup reminder.
// Part 1 runs the own-key page over http (browser database); part 2 runs the claude.ai stand-in (#db),
// where the file goes through the "downloads" capability.
const {chromium}=require(process.env.PW||'playwright');
const http=require('http'), fs=require('fs'), path=require('path'), os=require('os');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const OWNFILE=process.argv[2]||'preview-own.html', MOCKFILE=process.argv[3]||'preview-mock.html';
const NOW=Date.now(), D=86400000, P="data/users/local/store/";
const W=(term,extra)=>Object.assign({createdAt:NOW-10*D,term,kind:"phrase",meaning:"meaning of "+term,usage:"u",example:"An example with "+term+".",theme:"At Work",level:"B2",fromScene:""},extra||{});
const CARD=(title,extra)=>Object.assign({createdAt:NOW-10*D,updatedAt:NOW-10*D,title,theme:"Food & Eating Out",setting:"A busy night.",attempts:[{n:1,at:NOW-10*D,mode:"story",level:"B1",userText:"I said it.",strengths:[],corrections:[],highlights:[],modelStory:"m",nextTip:"t"}]},extra||{});
const PIC="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const SEED={};
SEED[P+"terms/t1"]=W("touch base"); SEED[P+"terms/t2"]=W("loop in",{pics:["p1"]}); SEED[P+"cards/c1"]=CARD("Cold soup at the bistro");
SEED[P+"sets/s1"]={createdAt:NOW-10*D,updatedAt:NOW-10*D,words:["postpone","put something on hold"],kind:"words",topic:"",source:"own"};
SEED[P+"pics/p1"]={createdAt:NOW-10*D,termId:"t2",data:PIC};
SEED[P+"meta/notpairs"]={keys:["bolt + fasten"]};

(async()=>{
  const srv=http.createServer((q,s)=>{ s.writeHead(200,{"Content-Type":"text/html; charset=utf-8"}); s.end(fs.readFileSync(path.join(process.cwd(),OWNFILE))); });
  await new Promise(r=>srv.listen(0,"127.0.0.1",r));
  const URL="http://127.0.0.1:"+srv.address().port+"/";
  const MURL='file://'+process.cwd()+'/'+MOCKFILE;
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const errs=[];
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,90)+')', false); } };
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ss-bk-'));
  /* a fresh browser (own storage), with the browser database filled with `docs` */
  const fresh=async(docs,ls)=>{
    const ctx=await b.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(5000);
    await p.goto(URL); await p.waitForTimeout(500);
    await p.evaluate(([docs,ls])=>new Promise(r=>{
      for(const k in ls) localStorage.setItem(k,ls[k]);
      const q=indexedDB.open("scene-and-say",1);
      q.onupgradeneeded=()=>q.result.createObjectStore("docs");
      q.onsuccess=()=>{ const tx=q.result.transaction("docs","readwrite"), st=tx.objectStore("docs"); for(const k in docs) st.put(docs[k],k); tx.oncomplete=()=>{ q.result.close(); r(); }; };
    }),[docs||{},ls||{}]);
    await p.reload(); await p.waitForTimeout(700);
    return p;
  };
  const idbKeys=p=>p.evaluate(()=>new Promise(r=>{ const q=indexedDB.open("scene-and-say"); q.onsuccess=()=>{ const g=q.result.transaction("docs").objectStore("docs").getAll(); const k=q.result.transaction("docs").objectStore("docs").getAllKeys(); let v,kk; g.onsuccess=()=>{v=g.result; if(kk) r(Object.fromEntries(kk.map((x,i)=>[x,v[i]])));}; k.onsuccess=()=>{kk=k.result; if(v) r(Object.fromEntries(kk.map((x,i)=>[x,v[i]])));}; }; }));
  let file, backup;

  await section("Own-key version: 'Your data' row and Back up", async()=>{
    const p=await fresh(SEED);
    ok("Practice has a 'Your data' row with Back up and Restore", (await p.isVisible('#data-row')) && (await p.textContent('#btn-backup'))==="Back up" && (await p.textContent('#btn-restore'))==="Restore");
    ok("…and says 'Last backup: never'", /Last backup: never/.test(await p.textContent('#data-row')));
    ok("…sitting just above Help", await p.evaluate(()=>{ const a=document.getElementById('data-row').getBoundingClientRect(), h=document.getElementById('help-box').getBoundingClientRect(); return a.bottom<=h.top+1 && h.top-a.bottom<60; }));
    const [dl]=await Promise.all([p.waitForEvent('download'), p.click('#btn-backup')]);
    file=path.join(tmp,dl.suggestedFilename()); await dl.saveAs(file);
    const d=new Date(), ymd=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    ok("the file is named scene-and-say-backup-<today>.json ("+dl.suggestedFilename()+")", dl.suggestedFilename()==="scene-and-say-backup-"+ymd+".json");
    backup=JSON.parse(fs.readFileSync(file,'utf8'));
    ok("it says what it is: a Scene & Say backup, version 1, from the own-key version", backup.app==="Scene & Say" && backup.kind==="backup" && backup.version===1 && backup.from==="own key");
    ok("it holds the cards, words and Compare sets, by id", !!backup.data.cards.c1 && !!backup.data.terms.t1 && !!backup.data.terms.t2 && !!backup.data.sets.s1);
    ok("…the picture, in full", backup.data.pics.p1 && backup.data.pics.p1.data===PIC);
    ok("…and your 'Not a pair' choices", JSON.stringify(backup.data.meta.notpairs.keys)===JSON.stringify(["bolt + fasten"]));
    ok("the entries are stored without a copy of their id inside", backup.data.terms.t1.id===undefined && backup.data.terms.t1.term==="touch base");
    ok("the page tells you what it saved, and to keep the file safe", /Saved scene-and-say-backup-.*2 words.*1 pictures?.*Keep it somewhere safe/.test(await p.textContent('#data-msg')));
    ok("'Last backup' now says today", /Last backup: today/.test(await p.textContent('#data-row')));
    await p.context().close();
  });

  await section("Restore into an empty browser", async()=>{
    const p=await fresh({});
    await p.click('#nav-words'); await p.waitForTimeout(200);
    ok("(the new browser starts with no words)", !/touch base/.test(await p.textContent('#v-words')));
    await p.click('#nav-practice');
    await p.setInputFiles('#data-file',file); await p.waitForTimeout(800);
    ok("it says what it did: added, and that nothing was deleted", /Restored: added 5, updated 0\. Nothing was deleted\./.test(await p.textContent('#data-msg')));
    await p.click('#nav-words'); await p.waitForTimeout(200);
    ok("the words are back", /touch base/.test(await p.textContent('#v-words')) && /loop in/.test(await p.textContent('#v-words')));
    await p.click('#nav-cards'); await p.waitForTimeout(200);
    ok("the card is back", /Cold soup at the bistro/.test(await p.textContent('#v-cards')));
    const db=await idbKeys(p);
    ok("…and all of it is in the browser database, picture included", !!db[P+"terms/t1"] && !!db[P+"cards/c1"] && !!db[P+"sets/s1"] && db[P+"pics/p1"] && db[P+"pics/p1"].data===PIC);
    ok("…'Not a pair' choices too", db[P+"meta/notpairs"] && db[P+"meta/notpairs"].keys.indexOf("bolt + fasten")>=0);
    await p.reload(); await p.waitForTimeout(700); await p.click('#nav-words'); await p.waitForTimeout(200);
    ok("after reopening, the words are still there", /touch base/.test(await p.textContent('#v-words')));
    await p.click('#nav-practice');
    await p.setInputFiles('#data-file',file); await p.waitForTimeout(600);
    ok("restoring the same file again changes nothing, and says so", (await p.textContent('#data-msg'))==="Everything in this file is already here.");
    await p.context().close();
  });

  await section("Restore merges: the newer copy wins, nothing is deleted", async()=>{
    const mine={};
    mine[P+"terms/t1"]=W("touch base",{meaning:"MY NEWER MEANING",updatedAt:NOW-D});      /* newer than the backup: kept */
    mine[P+"terms/t2"]=W("loop in",{meaning:"an older meaning",createdAt:NOW-20*D});        /* older than the backup: replaced */
    mine[P+"terms/t9"]=W("only here");                                                       /* not in the backup: untouched */
    const p=await fresh(mine);
    await p.setInputFiles('#data-file',file); await p.waitForTimeout(800);
    ok("it reports 1 updated, and only adds what's missing", /added 3, updated 1/.test(await p.textContent('#data-msg')));
    const db=await idbKeys(p);
    ok("your newer copy is kept", db[P+"terms/t1"].meaning==="MY NEWER MEANING");
    ok("an older copy is replaced by the backup's", db[P+"terms/t2"].meaning==="meaning of loop in");
    ok("an entry that isn't in the backup is still there", !!db[P+"terms/t9"]);
    await p.context().close();
  });

  await section("Files that aren't a backup", async()=>{
    const p=await fresh({});
    const bad=path.join(tmp,'notes.json'); fs.writeFileSync(bad,JSON.stringify({hello:"world"}));
    await p.setInputFiles('#data-file',bad); await p.waitForTimeout(300);
    ok("a random JSON file: 'doesn't look like a Scene & Say backup'", /doesn't look like a Scene & Say backup/.test(await p.textContent('#data-msg')));
    const txt=path.join(tmp,'x.json'); fs.writeFileSync(txt,"not json at all");
    await p.setInputFiles('#data-file',txt); await p.waitForTimeout(300);
    ok("a broken file: the same clear message", /doesn't look like a Scene & Say backup/.test(await p.textContent('#data-msg')));
    const newer=path.join(tmp,'newer.json'); fs.writeFileSync(newer,JSON.stringify(Object.assign({},backup,{version:2})));
    await p.setInputFiles('#data-file',newer); await p.waitForTimeout(300);
    ok("a backup from a newer SS: update this page first", /newer Scene & Say/.test(await p.textContent('#data-msg')));
    ok("…and nothing was added", Object.keys(await idbKeys(p)).length===0);
    await p.context().close();
  });

  await section("The reminder (own-key version)", async()=>{
    let p=await fresh(SEED);
    ok("no backup yet, words from 10 days ago: the reminder shows", (await p.isVisible('#backupnag')) && /haven't made a backup yet/.test(await p.textContent('#backupnag')));
    ok("…it says why: the words live only in this browser", /live only in this browser/.test(await p.textContent('#backupnag')));
    ok("…it sits near the top of Practice, above the profile", await p.evaluate(()=>document.getElementById('backupnag').getBoundingClientRect().top < document.getElementById('setup-box').getBoundingClientRect().top));
    const [dl]=await Promise.all([p.waitForEvent('download'), p.click('#backupnag-go')]); await p.waitForTimeout(200);
    ok("'Back up now' saves the file", /scene-and-say-backup-/.test(dl.suggestedFilename()));
    ok("…and the reminder goes away", !(await p.isVisible('#backupnag')));
    await p.context().close();

    p=await fresh(SEED,{"ss.lastBackup":JSON.stringify({at:NOW-9*D})});
    ok("last backup 9 days ago, nothing new since: no reminder", !(await p.isVisible('#backupnag')));
    await p.context().close();

    const s2=Object.assign({},SEED); s2[P+"terms/t3"]=W("hit the ground running",{createdAt:NOW-2*D});
    p=await fresh(s2,{"ss.lastBackup":JSON.stringify({at:NOW-9*D})});
    ok("last backup 9 days ago, a new word since: 'Last backup: 9 days ago. … Back up now?'", (await p.isVisible('#backupnag')) && /Last backup: 9 days ago\..*Back up now\?/.test(await p.textContent('#backupnag')));
    await p.click('#backupnag-no'); await p.waitForTimeout(150);
    ok("'Not now' hides it", !(await p.isVisible('#backupnag')));
    await p.reload(); await p.waitForTimeout(700);
    ok("…for the rest of today", !(await p.isVisible('#backupnag')));
    await p.context().close();

    const s3={}; s3[P+"terms/t1"]=W("touch base",{createdAt:NOW-2*D});
    p=await fresh(s3);
    ok("no backup yet, but everything is from the last 7 days: no reminder yet", !(await p.isVisible('#backupnag')));
    await p.context().close();
  });

  await section("claude.ai version: Back up through the platform, no reminder", async()=>{
    const ctx=await b.newContext({viewport:{width:1280,height:900}}); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(5000);
    const M={}; for(const k in SEED) M[k.replace("/local/","/u_test/")]=SEED[k];
    await p.goto(MURL); await p.evaluate(d=>{ localStorage.clear(); localStorage.setItem('__mockdb',JSON.stringify(d)); },M);
    await p.goto(MURL+'#db'); await p.reload(); await p.waitForTimeout(700);
    ok("the 'Your data' row is there on claude.ai too", (await p.isVisible('#btn-backup')) && !(await p.isDisabled('#btn-backup')));
    ok("no backup reminder on claude.ai, even with old words and no backup", !(await p.isVisible('#backupnag')));
    await p.click('#btn-backup'); await p.waitForTimeout(500);
    const saved=await p.evaluate(()=>window.__downloads||[]);
    ok("Back up hands one .json file to the platform's downloads", saved.length===1 && /^scene-and-say-backup-\d{4}-\d\d-\d\d\.json$/.test(saved[0].filename));
    const bj=JSON.parse(saved[0].data||"{}");
    ok("…with everything in your account, marked 'from claude.ai'", bj.from==="claude.ai" && !!bj.data.terms.t1 && !!bj.data.cards.c1 && bj.data.pics.p1.data===PIC);
    await p.evaluate(()=>localStorage.setItem("__dlDecline","1"));
    await p.click('#btn-backup'); await p.waitForTimeout(400);
    ok("if you say no to the download, it says so and doesn't count it as a backup", /download was cancelled/.test(await p.textContent('#data-msg')));
    /* restore an own-key backup into the claude.ai account */
    await p.evaluate(()=>{ localStorage.removeItem("__dlDecline"); const db=window.__mockdb(); for(const k in db) if(/terms\/t1$/.test(k)) delete db[k]; localStorage.setItem('__mockdb',JSON.stringify(db));
      /* and from this device's quick copy, so the account really doesn't have it */
      const ls=JSON.parse(localStorage.getItem('ss.terms.v1')||"[]").filter(t=>t.id!=="t1"); localStorage.setItem('ss.terms.v1',JSON.stringify(ls)); });
    await p.reload(); await p.waitForTimeout(700);
    await p.setInputFiles('#data-file',file); await p.waitForTimeout(800);
    ok("restoring an own-key backup on claude.ai adds what's missing to your account", /added 1, updated 0/.test(await p.textContent('#data-msg')) && !!(await p.evaluate(()=>window.__mockdb()["data/users/u_test/store/terms/t1"])));
    await ctx.close();
  });

  ok("no page errors ("+errs.slice(0,2).join(" | ")+")", errs.length===0);
  await b.close(); srv.close();
})();
