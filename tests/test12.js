const {chromium}=require(process.env.PW||'playwright');
const fs=require('fs');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const URL='file://'+process.cwd()+'/preview-mock.html';
const P="data/users/u_test/store/";
const BOLT=JSON.parse(fs.readFileSync('fixture-bolt-v3.json','utf8'));   // the REAL entry as it is now (merged)
const BOLT_NOFORM=Object.assign({},BOLT,{pattern:"bolt something onto something",example2:""});
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:900,height:1300}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  /* v38: opening a word also asks how to say it, so this reads the last request that is NOT that one */
  const last=()=>p.evaluate(()=>window.__prompts.filter(x=>x.indexOf("HOW TO SAY IT.")!==0).slice(-1)[0]);
  const terms=async()=>Object.entries(await p.evaluate(()=>window.__mockdb())).filter(([k])=>k.includes('/terms/')).map(([k,v])=>Object.assign({id:k.split('/').pop()},v));
  const start=async(doc)=>{ await p.goto('about:blank'); await p.goto(URL); await p.evaluate(([d,P])=>{ localStorage.clear(); localStorage.setItem('__mockdb',JSON.stringify({[P+"terms/tmuz4wawt92qj"]:d})); },[doc,P]); await p.goto(URL+'#db'); await p.reload(); await p.waitForTimeout(700); await p.click('#nav-words'); await p.waitForTimeout(150); };
  const addNote=async(term,sentence)=>{ await p.click('#note-open'); await p.fill('#note-term',term); if(sentence) await p.fill('#note-eg',sentence); await p.click('#note-go'); await p.waitForTimeout(800); };

  console.log("— Your real, merged 'bolt' entry —");
  await start(BOLT);
  await p.click('.wordbtn:has-text("bolt")'); await p.waitForTimeout(150);
  const d=await p.textContent('.worddetail:visible');
  ok("shows the work example moved from 'bolt-on'", d.includes("We don't want a bolt-on AI tool"));
  ok("shows the British noun as 'Also used as'", d.includes("Also used as:") && d.includes("data bolt-on"));
  ok("still shows the contrast box", d.includes("Usually means:") && d.includes("Here it means:"));
  await p.screenshot({path:'v12-bolt.png',fullPage:true});

  console.log("— 'bolt-on' again: a form the entry already mentions —");
  await addNote("bolt-on","");
  const pr=await last();
  ok("request sends entries with the same ROOT word (bolt for bolt-on)", pr.includes("ALREADY SAVED") && pr.includes("0. bolt — to add something to an existing system") && pr.includes("One meaning = one entry"));
  ok("request asks for addForm", pr.includes('"addForm"'));
  let ts=await terms();
  ok("no new entry", ts.length===1);
  ok("told there was nothing new to add", (await p.textContent('#note-done')).includes("nothing new to add"));

  console.log("— 'bolt-on' when the entry does NOT mention that form yet —");
  await start(BOLT_NOFORM);
  await addNote("bolt-on","");
  ts=await terms();
  ok("still one entry", ts.length===1);
  ok("the form is added to its pattern", ts[0].pattern==="bolt something onto something · bolt-on (adj.)");
  ok("told the form was added", (await p.textContent('#note-done')).includes("added the form “bolt-on (adj.)”"));
  ok("entry shows the new pattern", (await p.textContent('.worddetail:visible')).includes("bolt-on (adj.)"));

  console.log("— Same meaning, new sentence —");
  await addNote("bolted","They bolted analytics onto the legacy ERP.");
  ts=await terms();
  ok("'bolted' found the 'bolt' entry (root match): still one entry", ts.length===1);
  ok("sentence became the 2nd example", ts[0].example2==="They bolted analytics onto the legacy ERP.");
  await addNote("bolt","We bolted a dashboard onto it.");
  ts=await terms();
  ok("a 3rd sentence goes into more examples, nothing overwritten", ts.length===1 && ts[0].example2==="They bolted analytics onto the legacy ERP." && (ts[0].moreExamples||[]).includes("We bolted a dashboard onto it."));
  ok("all examples are shown", (await p.textContent('.worddetail:visible')).includes("We bolted a dashboard onto it."));
  await addNote("bolt","We bolted a dashboard onto it.");
  ok("the same sentence twice is not added twice", ((await terms())[0].moreExamples||[]).length===1 && (await p.textContent('#note-done')).includes("nothing new to add"));

  console.log("— A different meaning is still its own entry —");
  await addNote("bolt","He bolted the door.");
  ts=await terms();
  ok("new entry for the different meaning", ts.length===2 && ts.some(t=>t.meaning.includes("lock")));

  console.log("— A word with no relatives is unaffected —");
  await addNote("touch base","");
  ok("saved normally, no ALREADY SAVED block", (await terms()).some(t=>t.term==="touch base") && !(await last()).includes("ALREADY SAVED"));
  ok("no page errors: "+errs.join(" | "), errs.length===0);
  await b.close();
})();
