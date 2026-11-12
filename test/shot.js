const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});const p=await b.newPage({viewport:{width:1200,height:1000},deviceScaleFactor:1});
 const errs=[];p.on('pageerror',e=>errs.push('PE '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CE '+m.text())});
 await p.goto('http://localhost:8123/index.html');await p.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Pronto')||document.querySelector('#status').textContent.startsWith('Adapta')||document.querySelector('#status').textContent.startsWith('Erro'),null,{timeout:60000});
 console.log(await p.textContent('#status'));
 await p.screenshot({path:process.argv[2]||'/tmp/s1.png'});
 console.log(errs.join('\n')||'sem erros');
 await b.close();
})();
