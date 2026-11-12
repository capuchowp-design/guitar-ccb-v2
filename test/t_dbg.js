const fs=require('fs');globalThis.DH={};['xml','mxl','harmony','guitar','fingering','arrange'].forEach(m=>require('../js/'+m+'.js'));
const mode=process.env.MODE||'full';let shown=0,tot=0,nfall=0;
for(let n=1;n<=60;n++){
 const sc=DH.mxl.parseScore(DH.xml.loadMusicXML(fs.readFileSync(`hinos/${String(n).padStart(3,'0')}.mxl`)));
 const v=DH.mxl.extractVoices(sc);const h=DH.harmony.analyze(sc,v);
 const mel=v.S.map(x=>x.p);const cap=DH.harmony.chooseCapo(h.chords,Math.min(...mel),Math.max(...mel)).capo;
 const a=DH.arrange.build(sc,v,h,{mode,capo:cap});
 for(const x of a.notes){const act=a.notes.filter(y=>y.f>0&&y.t<=x.t+1e-6&&y.t+y.hold>x.t+1e-6&&!(y.t<x.t&&y.s===x.s));const fr=act.map(y=>y.f);if(fr.length&&Math.max(...fr)-Math.min(...fr)>4){tot++;if(shown<4){shown++;console.log('hino',n,'t',x.t,'capo',cap);console.log(act.map(y=>`${y.role}@${y.t} hold${y.hold.toFixed(2)} s${y.s} f${y.f} p${y.p}`).join('\n'))}}}
}
console.log('total',tot);
