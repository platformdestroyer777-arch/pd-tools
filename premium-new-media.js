/* PD Tools Premium — 5 ferramentas de vídeo e áudio */
(() => {
"use strict";
const T=window.PDNewTools;if(!T)return;
const reg=T.register;
function videoFromFile(f){
  if(!f||!f.type.startsWith("video/"))throw Error("Selecione um vídeo compatível (MP4 ou WebM).");
  const url=URL.createObjectURL(f),v=document.createElement("video");
  v.preload="auto";v.muted=true;v.playsInline=true;v.src=url;
  const ready=new Promise((res,rej)=>{
    v.addEventListener("loadedmetadata",res,{once:true});
    v.addEventListener("error",()=>rej(Error("Seu navegador não conseguiu abrir o vídeo.")),{once:true});
  });
  return {v,ready,release:()=>{v.pause();v.removeAttribute("src");v.load();URL.revokeObjectURL(url)}};
}
function seek(v,time){
 return new Promise((res,rej)=>{
   const goal=Math.max(0.02,Math.min(time,Math.max(.02,v.duration-.02)));
   if(Math.abs(v.currentTime-goal)<.002&&v.readyState>=2){res();return}
   const timeout=setTimeout(()=>{cleanup();rej(Error("Não foi possível carregar o frame."))},12000);
   const done=()=>{cleanup();res()},fail=()=>{cleanup();rej(Error("Não foi possível buscar o frame."))};
   function cleanup(){clearTimeout(timeout);v.removeEventListener("seeked",done);v.removeEventListener("error",fail)}
   v.addEventListener("seeked",done,{once:true});v.addEventListener("error",fail,{once:true});v.currentTime=goal;
 });
}
async function decodeAudio(f) {
 if(!f)throw Error("Selecione um arquivo de áudio.");
 if(f.size>70*1024*1024)throw Error("Arquivo acima de 70 MB.");
 const AudioContext=window.AudioContext||window.webkitAudioContext;
 if(!AudioContext)throw Error("Áudio não suportado neste navegador.");
 const ac=new AudioContext();
 try{return {buffer:await ac.decodeAudioData(await f.arrayBuffer()),close:()=>ac.close()}}
 catch(e){await ac.close();throw Error("Formato de áudio não suportado pelo navegador.")}
}
function wav(buffer,start,end,gain=1){
 const rate=buffer.sampleRate,n=Math.ceil((end-start)*rate),channels=Math.min(2,buffer.numberOfChannels);
 if(n<1||n>rate*600)throw Error("Áudio inválido ou maior que 10 minutos.");
 const ab=new ArrayBuffer(44+n*channels*2),view=new DataView(ab);
 function txt(pos,t){for(let i=0;i<t.length;i++)view.setUint8(pos+i,t.charCodeAt(i))}
 txt(0,"RIFF");view.setUint32(4,36+n*channels*2,true);txt(8,"WAVE");txt(12,"fmt ");
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);
 view.setUint32(24,rate,true);view.setUint32(28,rate*channels*2,true);
 view.setUint16(32,channels*2,true);view.setUint16(34,16,true);txt(36,"data");
 view.setUint32(40,n*channels*2,true);
 const samples=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));
 const base=Math.floor(start*rate);
 let p=44;
 for(let i=0;i<n;i++)for(let ch=0;ch<channels;ch++){
   const sample=Math.max(-1,Math.min(1,(samples[ch][base+i]||0)*gain));
   view.setInt16(p,sample<0?Math.round(sample*32768):Math.round(sample*32767),true);p+=2;
 }
 return new Blob([ab],{type:"audio/wav"});
}
function gifLzw(indices){
 const clear=256,end=257;
 let dict=new Map(),next=258,size=9;
 const output=[];let bits=0,acc=0;
 const emit=code=>{acc|=code<<bits;bits+=size;while(bits>=8){output.push(acc&255);acc>>>=8;bits-=8}};
 const reset=()=>{dict=new Map();next=258;size=9};
 emit(clear);
 let previous=String(indices[0]);const codeOf=k=>k.length===1?k.charCodeAt(0):dict.get(k);
 for(let i=1;i<indices.length;i++){
   const ch=String.fromCharCode(indices[i]),joined=previous+ch;
   if(dict.has(joined)){previous=joined;continue}
   emit(codeOf(previous));
   if(next<4096){
     dict.set(joined,next++);
     if(next===(1<<size)&&size<12)size++;
   }else{emit(clear);reset()}
   previous=ch;
 }
 emit(codeOf(previous));emit(end);
 if(bits)output.push(acc&255);
 const blocks=[];for(let i=0;i<output.length;i+=255){const piece=output.slice(i,i+255);blocks.push(piece.length,...piece)}
 blocks.push(0);return blocks;
}
function gif(frames,w,h,delay){
 const bytes=[];
 const put=(...a)=>bytes.push(...a);
 const str=s=>{for(let i=0;i<s.length;i++)bytes.push(s.charCodeAt(i))};
 const word=n=>put(n&255,(n>>8)&255);
 str("GIF89a");word(w);word(h);put(0xf7,0,0);
 for(let i=0;i<256;i++){put(((i>>5)&7)*255/7|0,((i>>2)&7)*255/7|0,(i&3)*85)}
 put(0x21,0xff,11);str("NETSCAPE2.0");put(3,1,0,0,0);
 for(const data of frames){
   put(0x21,0xf9,4,0,delay&255,(delay>>8)&255,0,0);
   put(0x2c,0,0,0,0);word(w);word(h);put(0,8);
   const idx=new Uint8Array(w*h);
   for(let i=0,p=0;i<idx.length;i++,p+=4)idx[i]=((data[p]>>5)<<5)|((data[p+1]>>5)<<2)|(data[p+2]>>6);
   put(...gifLzw(idx));
 }
 put(0x3b);return new Blob([new Uint8Array(bytes)],{type:"image/gif"});
}
reg("video-frames",async h=>{
 const {$,file,input,btn,result,canvas,content,status,download,toBlob,protect}=h;
 content.innerHTML=file("pnVideo","Vídeo MP4 ou WebM","video/*")+input("pnSecond","Segundo do vídeo","number","1")+btn("pnExtract","Extrair imagem PNG")+canvas("pnVideoCanvas")+result();
 $("pnExtract").onclick=protect(async()=>{
  const obj=videoFromFile($("pnVideo").files[0]);
  try{
   await obj.ready;const s=Number($("pnSecond").value);
   if(!Number.isFinite(s)||s<0||s>obj.v.duration)throw Error("Escolha um segundo dentro da duração.");
   await seek(obj.v,s);const c=$("pnVideoCanvas");
   const scale=Math.min(1,1600/Math.max(obj.v.videoWidth,obj.v.videoHeight));
   c.width=Math.max(1,Math.round(obj.v.videoWidth*scale));c.height=Math.max(1,Math.round(obj.v.videoHeight*scale));
   c.getContext("2d").drawImage(obj.v,0,0,c.width,c.height);
   download(await toBlob(c),"pdtools-frame.png");status("Frame extraído e salvo.");
  }finally{obj.release()}
 });
});
reg("audio-trim",async h=>{
 const {$,file,input,btn,result,content,status,download,protect}=h;
 content.innerHTML=file("pnAudio","Áudio (MP3, WAV, OGG, etc.)","audio/*")+input("pnStart","Início em segundos","number","0")+input("pnEnd","Fim em segundos","number","10")+btn("pnCut","Cortar e baixar WAV")+result();
 $("pnCut").onclick=protect(async()=>{
   const a=await decodeAudio($("pnAudio").files[0]);
   try{
    const start=Number($("pnStart").value),end=Number($("pnEnd").value);
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>a.buffer.duration)throw Error("Intervalo inválido. Duração: "+a.buffer.duration.toFixed(1)+" s.");
    download(wav(a.buffer,start,end),"pdtools-audio-cortado.wav");status("Áudio cortado com sucesso.");
   }finally{await a.close()}
 });
});
reg("audio-volume",async h=>{
 const {$,file,input,btn,result,content,status,download,protect}=h;
 content.innerHTML=file("pnAudio","Áudio (MP3, WAV, OGG, etc.)","audio/*")+input("pnGain","Volume em % (0 a 300)","number","150")+btn("pnAdjust","Aplicar volume e baixar WAV")+result();
 $("pnAdjust").onclick=protect(async()=>{
   const gain=Number($("pnGain").value);
   if(!Number.isFinite(gain)||gain<0||gain>300)throw Error("Informe volume de 0 a 300%.");
   const a=await decodeAudio($("pnAudio").files[0]);
   try{download(wav(a.buffer,0,a.buffer.duration,gain/100),"pdtools-volume.wav");status("Volume ajustado. WAV disponível.")}
   finally{await a.close()}
 });
});
reg("video-gif",async h=>{
 const {$,file,input,btn,result,content,status,download,protect}=h;
 content.innerHTML=file("pnVideo","Vídeo MP4 ou WebM","video/*")+input("pnStart","Início em segundos","number","0")+input("pnDuration","Duração (1 a 5 s)","number","2")+btn("pnGif","Criar GIF e baixar")+result();
 $("pnGif").onclick=protect(async()=>{
   const o=videoFromFile($("pnVideo").files[0]);
   try{
    await o.ready;const start=Number($("pnStart").value),duration=Number($("pnDuration").value);
    if(!Number.isFinite(start)||!Number.isFinite(duration)||start<0||duration<1||duration>5||start+duration>o.v.duration)throw Error("Escolha um trecho de 1 a 5 segundos dentro do vídeo.");
    const scale=Math.min(1,320/Math.max(o.v.videoWidth,o.v.videoHeight));
    const w=Math.max(1,Math.floor(o.v.videoWidth*scale)),hh=Math.max(1,Math.floor(o.v.videoHeight*scale));
    const c=document.createElement("canvas");c.width=w;c.height=hh;
    const ctx=c.getContext("2d",{willReadFrequently:true});
    const count=Math.min(20,Math.round(duration*4)),frames=[];
    for(let i=0;i<count;i++){
      await seek(o.v,start+(i+.1)*duration/count);
      ctx.drawImage(o.v,0,0,w,hh);frames.push(ctx.getImageData(0,0,w,hh).data);
      status("Processando frame "+(i+1)+" de "+count+"...");
    }
    download(gif(frames,w,hh,Math.max(1,Math.round(duration*100/count))),"pdtools-animacao.gif");
    status("GIF gerado com sucesso ("+w+"×"+hh+").");
   }finally{o.release()}
 });
});
reg("photo-collage",async h=>{
 const {$,file,select,btn,result,canvas,content,status,download,toBlob,image,protect}=h;
 content.innerHTML=file("pnImages","Selecione de 2 a 9 fotos","image/*",true)+select("pnLayout","Número de colunas",[["2","2 colunas"],["3","3 colunas"]])+btn("pnCreate","Montar colagem")+canvas("pnCollage")+btn("pnSave","Baixar PNG")+result();
 let ready=false;
 $("pnCreate").onclick=protect(async()=>{
   const files=Array.from($("pnImages").files).slice(0,9);
   if(files.length<2)throw Error("Selecione pelo menos 2 imagens.");
   const pics=await Promise.all(files.map(image));
   const cols=Number($("pnLayout").value),rows=Math.ceil(pics.length/cols),cell=480,pad=8;
   const c=$("pnCollage");c.width=cols*cell+(cols+1)*pad;c.height=rows*cell+(rows+1)*pad;
   const ctx=c.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,c.width,c.height);
   pics.forEach((im,i)=>{const x=pad+(i%cols)*(cell+pad),y=pad+Math.floor(i/cols)*(cell+pad);
     const scale=Math.max(cell/im.width,cell/im.height),sw=cell/scale,sh=cell/scale;
     ctx.drawImage(im,(im.width-sw)/2,(im.height-sh)/2,sw,sh,x,y,cell,cell)});
   ready=true;status("Colagem criada com "+files.length+" fotos.");
 });
 $("pnSave").onclick=protect(async()=>{if(!ready)throw Error("Monte a colagem primeiro.");download(await toBlob($("pnCollage")),"pdtools-colagem.png")});
});
})();