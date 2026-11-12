const {chromium}=require('playwright');
(async()=>{
 const [,, out, hymn, mode, tab]=process.argv;
 const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});const p=await b.newPage({viewport:{width:1200,height:1000},deviceScaleFactor:1.5});
 const errs=[];p.on('pageerror',e=>errs.push('PE '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CE '+m.text())});
 await p.goto('http://localhost:8123/index.html');await p.waitForFunction(()=>window.__dh&&window.__dh.st.arr,null,{timeout:60000});
 if(hymn){await p.evaluate(n=>window.__dh.openHymn(n),Number(hymn));await p.waitForTimeout(1500)}
 await p.click('#settingsBtn');if(mode){await p.selectOption('#mode',mode);await p.waitForTimeout(2500)}
 if(tab){await p.selectOption('#notationMode',tab);await p.waitForTimeout(500)}
 await p.waitForFunction(()=>!window.__dh.st.busy,null,{timeout:60000});
 await (await p.$('#scoreWrap')).screenshot({path:out});
 console.log(await p.textContent('#status'));console.log(errs.join('\n')||'sem erros');
 await b.close();
})();
