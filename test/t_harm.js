const fs=require('fs');globalThis.DH={};require('../js/xml.js');require('../js/mxl.js');require('../js/harmony.js');
const ids=process.argv.slice(2).map(Number);
for(const n of ids){
 const sc=DH.mxl.parseScore(DH.xml.loadMusicXML(fs.readFileSync(`hinos/${String(n).padStart(3,'0')}.mxl`)));
 const v=DH.mxl.extractVoices(sc);const h=DH.harmony.analyze(sc,v);
 const mel=v.S.map(x=>x.p);const cap=DH.harmony.chooseCapo(h.chords,Math.min(...mel),Math.max(...mel));
 console.log('#'+n,sc.title,'fifths',sc.fifths,h.key.mode,'capo',cap.capo,cap.table.slice(0,3).map(r=>r.capo+':'+r.cost.toFixed(2)).join(' '));
 let s='';let cm=-1;for(const c of h.chords){if(c.m!==cm){s+=' | ';cm=c.m}s+=DH.harmony.chordName(c.root,c.type,sc.fifths)+' '}
 console.log(s);
}
