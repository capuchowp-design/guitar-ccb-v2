const {chromium}=require('playwright');
(async()=>{
 const S='/tmp/claude-0/-home-claude/82e87485-cd73-5a3a-a0b3-8591927158a2/scratchpad/';
 const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});const p=await b.newPage({viewport:{width:1200,height:1000},deviceScaleFactor:1.2});
 const errs=[];p.on('pageerror',e=>errs.push('PE '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CE '+m.text())});
 await p.goto('http://localhost:8123/index.html');await p.waitForFunction(()=>window.__dh&&window.__dh.st.arr&&!window.__dh.st.busy,null,{timeout:60000});
 await p.click('#playBtn');await p.waitForTimeout(7500);
 console.log('beat',await p.evaluate(()=>window.__dh.player.beat),'plucks cache',await p.evaluate(()=>window.__dh.player.cache.size),await p.textContent('#clock'));
 await (await p.$('#fretboard')).screenshot({path:S+'fb.png'});
 await p.click('#playBtn');
 // upload test
 await p.setInputFiles('#fileIn','hinos/150.mxl');await p.waitForTimeout(2500);console.log(await p.textContent('#hymnTitle'));
 // mobile
 await p.setViewportSize({width:390,height:800});await p.waitForTimeout(800);await p.screenshot({path:S+'mob.png'});
 console.log(errs.join('\n')||'sem erros');await b.close();
})();
