// v36 (Siyy, 19 Oct): a tap on the sun or moon holds only until the device next switches between light and dark.
// On v35 a tap won for ever, so after one tap the town never followed the device again (Siyy's step 1 on claude.ai failed).
// Now the tap is saved together with what the device said at that moment (ss.sky + ss.skyDevice). When the device says
// something else, the tap is forgotten and the town follows the device again. A tap that matches the device is not saved,
// and an old v35 tap (ss.sky alone) is forgotten once.
const {chromium}=require(process.env.PW||'playwright');
const ok=(label,cond)=>{console.log((cond?"PASS ":"FAIL ")+label); if(!cond) process.exitCode=1;};
const FILE=process.argv[2]||'preview-mock.html';
const URL='file://'+process.cwd()+'/'+FILE;
const P="data/users/u_test/store/", NOW=Date.now();
const DB={"terms/a":{createdAt:NOW-3600000,term:"touch base",kind:"phrase",meaning:"talk briefly",usage:"",example:"Let's touch base on Monday.",theme:"At Work",level:"B2",fromScene:""}};
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const errs=[];
  let p, ctx;
  const section=async(name,fn)=>{ console.log('— '+name+' —'); try{ await fn(); }catch(e){ ok('section ran to the end ('+String(e.message).split('\n')[0].slice(0,80)+')', false); } };
  /* scheme: what the device says. saved: what this device already remembers, {sky, device}, or nothing.
     flash: also record which sky was set when the top bar first appeared. */
  const open=async(scheme,saved,file,flash)=>{
    if(ctx) await ctx.close();
    ctx=await b.newContext({viewport:{width:1280,height:800},colorScheme:scheme}); p=await ctx.newPage();
    p.on('pageerror',e=>errs.push(e.message)); p.setDefaultTimeout(4000);
    if(flash) await p.addInitScript(()=>{ new MutationObserver((ms,o)=>{ if(document.querySelector('header.top')){ window.__skyAtHeader=document.documentElement.getAttribute('data-sky')||"day"; o.disconnect(); } }).observe(document,{childList:true,subtree:true}); });
    const url=file?'file://'+process.cwd()+'/'+file:URL;
    await p.goto(url);
    await p.evaluate(([d,P,s])=>{ localStorage.clear(); const o={}; for(const k in d) o[P+k]=d[k]; localStorage.setItem('__mockdb',JSON.stringify(o));
      if(s.sky) localStorage.setItem('ss.sky',s.sky); if(s.device) localStorage.setItem('ss.skyDevice',s.device); },[DB,P,saved||{}]);
    await p.goto(url+(file?'':'#db')); await p.reload(); await p.waitForTimeout(700); await p.mouse.move(0,0);
  };
  const sky=()=>p.evaluate(()=>document.documentElement.getAttribute('data-sky')||"day");
  const mem=()=>p.evaluate(()=>[localStorage.getItem('ss.sky'),localStorage.getItem('ss.skyDevice')].join("|"));
  const tap=async()=>{ await p.click('#v-themes .skylight'); await p.waitForTimeout(200); await p.mouse.move(0,0); };
  const device=async s=>{ await p.emulateMedia({colorScheme:s}); await p.waitForTimeout(200); };
  const label=()=>p.$eval('#v-themes .skylight',x=>x.getAttribute('aria-label'));

  await section("An old tap from v35 is forgotten once, so the town follows the device again", async()=>{
    await open('dark',{sky:"day"},null,true);
    ok("a dark device with an old \"day\" tap opens the night town", await sky()==="night");
    ok("…already when the top bar first appears (no flash of day)", await p.evaluate(()=>window.__skyAtHeader)==="night");
    ok("…and the old tap is gone from this device", await mem()==="|");
    await open('light',{sky:"night"});
    ok("a light device with an old \"night\" tap opens the day town, and the old tap is gone", await sky()==="day" && await mem()==="|");
  });

  await section("A tap holds while the device stays the same", async()=>{
    await open('dark');
    ok("a dark device opens the night town, nothing remembered", await sky()==="night" && await mem()==="|");
    await tap();
    ok("tap the moon: day", await sky()==="day" && await label()==="Switch to night");
    ok("…this device remembers the tap and what the device said then (day | night): "+await mem(), await mem()==="day|night");
    ok("nothing about it goes into your cloud data", await p.evaluate(()=>Object.keys(window.__mockdb()).filter(k=>/sky/i.test(k)).length)===0);
    await p.reload(); await p.waitForTimeout(600);
    ok("after a reload, still day on the dark device", await sky()==="day" && await mem()==="day|night");
  });

  await section("When the device switches, the town follows it again", async()=>{
    await device('light');
    ok("the device turns light: day, and the tap is forgotten ("+await mem()+")", await sky()==="day" && await mem()==="|");
    await device('dark');
    ok("the device turns dark again: the town follows it to night", await sky()==="night" && await label()==="Switch to day");
    await device('light');
    ok("…and back to day with it", await sky()==="day");
  });

  await section("The device switched while SS was closed", async()=>{
    await open('light',{sky:"day",device:"night"},null,true);
    ok("a tap made on a dark device is forgotten when SS opens on a light device", await sky()==="day" && await mem()==="|");
    await device('dark');
    ok("…so when the device turns dark, the town follows it to night", await sky()==="night");
    await open('dark',{sky:"day",device:"night"},null,true);
    ok("the same tap still holds while the device is still dark: day", await sky()==="day" && await mem()==="day|night");
    ok("…already when the top bar first appears (no flash of night)", await p.evaluate(()=>window.__skyAtHeader)==="day");
  });

  await section("A tap that matches the device is not remembered", async()=>{
    await open('dark');
    await tap();
    ok("tap the moon on a dark device: day, remembered", await sky()==="day" && await mem()==="day|night");
    await tap();
    ok("tap the sun: night again, the same as the device, so nothing is remembered ("+await mem()+")", await sky()==="night" && await mem()==="|");
    await p.reload(); await p.waitForTimeout(600);
    await device('light');
    ok("…and the town keeps following the device: light gives day", await sky()==="day");
  });

  await section("claude.ai's own light/dark theme counts as the device", async()=>{
    await open('light');
    await p.evaluate(()=>document.documentElement.setAttribute('data-theme','dark')); await p.waitForTimeout(150);
    ok("the app around the page marks itself dark: night", await sky()==="night");
    await tap();
    ok("tap the moon: day, remembered against the app's dark theme", await sky()==="day" && await mem()==="day|night");
    await p.evaluate(()=>document.documentElement.setAttribute('data-theme','light')); await p.waitForTimeout(150);
    ok("the app switches to light: day, and the tap is forgotten", await sky()==="day" && await mem()==="|");
    await p.evaluate(()=>document.documentElement.setAttribute('data-theme','dark')); await p.waitForTimeout(150);
    ok("…so when the app switches to dark, the town follows it to night", await sky()==="night");
  });

  await section("Help says how it works", async()=>{
    await open('light');
    const help=await p.textContent('#help-box');
    ok("Help: \"Tap the sun or moon to switch between day and night. When your device switches between light and dark, the town follows it again.\"",
      help.includes("Tap the sun or moon to switch between day and night. When your device switches between light and dark, the town follows it again."));
  });

  await section("Friends' own-key page follows the same rule", async()=>{
    await open('dark',{sky:"day"},'preview-own.html');
    ok("the same file without Claude: an old \"day\" tap is forgotten, and a dark device shows night", await sky()==="night" && await mem()==="|");
    await p.click('#v-themes .skylight'); await p.waitForTimeout(200);
    ok("…and a tap there is remembered with the device's setting", await sky()==="day" && await mem()==="day|night");
  });

  ok("no page errors ("+errs.join(" | ").slice(0,160)+")", errs.length===0);
  if(ctx) await ctx.close();
  await b.close();
})();
