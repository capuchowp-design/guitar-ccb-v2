const fs=require('fs');globalThis.DH={};require('../js/xml.js');require('../js/mxl.js');
let bad=0,tot=0,stats={noS:0,short:0,order:0};const t0=Date.now();
for(let n=1;n<=480;n++){
  const f=`hinos/${String(n).padStart(3,'0')}.mxl`;
  try{
    const sc=DH.mxl.parseScore(DH.xml.loadMusicXML(fs.readFileSync(f)));
    const v=DH.mxl.extractVoices(sc);const o=DH.mxl.unroll(sc);
    tot++;
    if(!v.S.length||!v.B.length) {stats.noS++;console.log('sem voz',n,Object.fromEntries(Object.entries(v).map(([k,a])=>[k,a.length])))}
    if(o.length!==sc.measures.length) stats.order++;
    if(n<=3||n%100==0) console.log(n,sc.title,'|',sc.composer,'tempo',sc.tempo,'fifths',sc.fifths,sc.beats+'/'+sc.beatType,'meas',sc.measures.length,'len',sc.totalLen,'S',v.S.length,'A',v.A.length,'T',v.T.length,'B',v.B.length,'order',o.length, 'lyr',v.S.filter(x=>x.lyr).length);
  }catch(e){bad++;console.log('ERRO',n,e.message)}
}
console.log('ok',tot,'erros',bad,stats,(Date.now()-t0)+'ms');
