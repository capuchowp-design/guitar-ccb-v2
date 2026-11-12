globalThis.DH={};require('../js/synth.js');const fs=require('fs');
const FS=44100;
function wav(name,arr,fsr){const n=arr.length;const b=Buffer.alloc(44+n*2);b.write('RIFF',0);b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(fsr,24);b.writeUInt32LE(fsr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(arr[i]*30000))),44+i*2);fs.writeFileSync(name,b)}
const out=process.argv[2]||'/tmp';
// autocorrelacao para checar afinacao
function pitch(a,fs,lo,hi){let best=0,bl=0;const n=Math.min(a.length,fs);for(let lag=Math.floor(fs/hi);lag<=Math.floor(fs/lo);lag++){let s=0;for(let i=fs*0.05|0;i<(fs*0.05|0)+8000;i++)s+=a[i]*a[i+lag];if(s>best){best=s;bl=lag}}return fs/bl}
const t0=Date.now();
for(const type of ['nylon','steel']){
 const seq=[];
 for(const [m,s] of [[40,5],[45,4],[50,3],[55,2],[59,1],[64,0],[69,0],[76,0]]){
  const t1=Date.now();const a=DH.synth.renderNote({fs:FS,midi:m,string:s,type,vel:.7});
  const f=DH.synth.hz(m);const est=pitch(a,FS,f*.7,f*1.4);
  // envelope: rms ao longo do tempo
  const rms=(t0,t1)=>{let s=0,c=0;for(let i=t0*FS|0;i<Math.min(a.length,t1*FS|0);i++){s+=a[i]*a[i];c++}return 20*Math.log10(Math.sqrt(s/c)+1e-9)};
  console.log(type,'midi',m,'f0',f.toFixed(1),'est',est.toFixed(1),'cents',(1200*Math.log2(est/f)).toFixed(1),'dur',(a.length/FS).toFixed(2),'ms',Date.now()-t1,'rms dB @0.1/0.5/1/2s:',[rms(.1,.2),rms(.5,.6),rms(1,1.1),rms(2,2.1)].map(x=>x.toFixed(0)).join('/'),'nan',a.some(x=>isNaN(x)));
  seq.push(a);
 }
 // arpejo em um unico arquivo
 const tot=new Float32Array(FS*10);let off=0;[0,1,2,3,4,5,6,7,5,3].forEach((idx,k)=>{const a=seq[idx%seq.length];const o=Math.floor(k*0.45*FS);for(let i=0;i<a.length&&o+i<tot.length;i++)tot[o+i]+=a[i]*0.6});
 wav(out+'/'+type+'.wav',tot,FS);
}
console.log('total ms',Date.now()-t0);
