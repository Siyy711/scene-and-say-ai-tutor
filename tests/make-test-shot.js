// Makes test-shot.png (a big 3000x2000 picture) that test8 uploads to check that pictures are shrunk.
const {chromium}=require(process.env.PW||'playwright');
(async()=>{ const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const p=await b.newPage({viewport:{width:3000,height:2000}});
  await p.setContent('<body style="margin:0;background:linear-gradient(135deg,#1a6560,#f0e5c8);font:120px Georgia"><div style="padding:200px">Test picture</div></body>');
  await p.screenshot({path:'test-shot.png'}); await b.close(); })();
