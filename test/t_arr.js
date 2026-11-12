const fs=require('fs');globalThis.DH={};['xml','mxl','harmony','guitar','fingering','arrange'].forEach(m=>require('../js/'+m+'.js'));
const modes=(process.env.MODES||'full,simple,S,A,T,B,satb').split(',');
const ids=process.argv.slice(2).map(Number);
const from=ids.length?ids:Array.from({length:480},(_,i)=>i+1);
const agg={};let bad=0;
for(const n of from){
 const sc=DH.mxl.parseScore(DH.xml.loadMusicXML(fs.readFileSync(`hinos/${String(n).padStart(3,'0')}.mxl`)));
 const v=DH.mxl.extractVoices(sc);const h=DH.harmony.analyze(sc,v);
 const mel=v.S.map(x=>x.p);const cap=DH.harmony.chooseCapo(h.chords,Math.min(...mel),Math.max(...mel)).capo;
 for(const mode of modes){
  const t0=Date.now();
  try{
   const a=DH.arrange.build(sc,v,h,{mode,capo:cap});
   // valida alcance de mao por onset
   const A=agg[mode]=agg[mode]||{n:0,notes:0,dropped:0,adapted:0,ms:0,maxms:0,spanBad:0};
   A.n++;A.notes+=a.notes.length;A.dropped+=a.info.dropped;A.adapted+=a.info.adaptedNotes;const ms=Date.now()-t0;A.ms+=ms;A.maxms=Math.max(A.maxms,ms);
   // check span with holds
   for(let i=0;i<a.notes.length;i++){const x=a.notes[i];const act=a.notes.filter(y=>y.f>0&&y.t<=x.t+1e-6&&y.t+y.hold>x.t+1e-6&&!(y.t<x.t&&y.s===x.s));const fr=act.map(y=>y.f);if(fr.length&&Math.max(...fr)-Math.min(...fr)>4)A.spanBad++;
      if(x.f<0||x.s<0)A.bad=(A.bad||0)+1;
      if(DH.guitar.OPEN[x.s]+x.f+0!==x.sp)A.mism=(A.mism||0)+1;}
   if(ids.length&&ids.length<3){console.log(n,mode,'capo',cap,'notes',a.notes.length,a.info,a.stats)}
  }catch(e){bad++;console.log('ERRO',n,mode,e.message.slice(0,100));}
 }
}
console.log(agg,'erros',bad);
