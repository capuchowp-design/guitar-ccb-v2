const fs=require('fs');globalThis.DH={};['xml','mxl','harmony','guitar','fingering','arrange'].forEach(m=>require('../js/'+m+'.js'));
const n=6;const sc=DH.mxl.parseScore(DH.xml.loadMusicXML(fs.readFileSync(`hinos/${String(n).padStart(3,'0')}.mxl`)));
const v=DH.mxl.extractVoices(sc);const h=DH.harmony.analyze(sc,v);
const a=DH.arrange.build(sc,v,h,{mode:'full',capo:0});
console.log(a.notes.filter(x=>x.t>=79&&x.t<=84).map(x=>`${x.t} ${x.role} d${x.d} hold${x.hold} s${x.s} f${x.f} p${x.p} ${x.adapted?'AD':''}`).join('\n'));
