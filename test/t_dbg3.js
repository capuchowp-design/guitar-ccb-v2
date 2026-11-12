const fs=require('fs');globalThis.DH={};['xml','mxl','harmony','guitar','fingering','arrange'].forEach(m=>require('../js/'+m+'.js'));
// monkeypatch to log fallback
const orig=DH.fingering.solve;
const n=6;const sc=DH.mxl.parseScore(DH.xml.loadMusicXML(fs.readFileSync(`hinos/${String(n).padStart(3,'0')}.mxl`)));
const v=DH.mxl.extractVoices(sc);const h=DH.harmony.analyze(sc,v);
const items=[];
const a=DH.arrange.build(sc,v,h,{mode:'full',capo:0});
// replicate items near 80..83
const sub=a.notes.filter(x=>x.t>=79.5&&x.t<=83).map(x=>({id:x.id,t:x.t,hold:x.hold,p:x.p,role:x.role,pri:x.role==='melody'?0:x.role==='bass'?1:2,drop:x.role==='melody'?null:(x.role==='bass'?8:5),alts:x.role==='bass'?[{p:x.p-12,cost:1.6},{p:x.p+12,cost:1.6}].filter(y=>y.p>=40):[]}));
const r=orig(sub,{});
sub.forEach(s=>{const q=r.get(s.id);console.log(s.t,s.role,'p',s.p,'->',q.p,'s',q.s,'f',q.f,'fin',q.fin,'pos',q.pos,q.dropped?'DROP':'')});
