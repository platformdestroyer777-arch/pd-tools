/* PD Tools Premium — 5 ferramentas visuais */
(() => {
"use strict";
const T=window.PDNewTools;if(!T)return;const reg=T.register;
function fit(c,img,x,y,w,h,cover=true){
 const scale=cover?Math.max(w/img.width,h/img.height):Math.min(w/img.width,h/img.height);
 const sw=w/scale,sh=h/scale;
 c.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,y,w,h);
}
reg("favicon-maker",async h=>{
 const {$,file,input,btn,result,canvas,content,status,download,toBlob,image,protect}=h;
 content.innerHTML=file("pnLogo","Imagem para o ícone","image/*")+input("pnFaviconBg","Cor do fundo","color","#6d28d9")+btn("pnMake","Gerar favicon")+canvas("pnCanvas")+btn("pnSave","Baixar pacote ZIP (16, 32 e 180px)")+result();
 let source=null;
 $("pnMake").onclick=protect(async()=>{
   source=await image($("pnLogo").files[0]);
   const c=$("pnCanvas");c.width=256;c.height=256;const ctx=c.getContext("2d");
   ctx.fillStyle=$("pnFaviconBg").value;ctx.fillRect(0,0,256,256);fit(ctx,source,16,16,224,224,false);
   status("Prévia do ícone pronta.");
 });
 $("pnSave").onclick=protect(async()=>{
   if(!source)throw Error("Gere o favicon primeiro.");
   if(!window.JSZip)throw Error("Biblioteca ZIP não disponível.");
   const zip=new JSZip();
   for(const size of [16,32,180]){
     const c=document.createElement("canvas");c.width=size;c.height=size;
     const ctx=c.getContext("2d");ctx.fillStyle=$("pnFaviconBg").value;ctx.fillRect(0,0,size,size);
     fit(ctx,source,0,0,size,size,false);
     zip.file("favicon-"+size+".png",await toBlob(c));
   }
   zip.file("instalacao.txt",'<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">\n');
   download(await zip.generateAsync({type:"blob"}),"pdtools-favicons.zip");status("Pacote de favicons criado.");
 });
});
function safeSvg(svg){
 if(svg.length>500000)throw Error("SVG acima de 500 KB.");
 const parsed=new DOMParser().parseFromString(svg,"image/svg+xml");
 if(parsed.querySelector("parsererror")||parsed.documentElement.localName!=="svg")throw Error("SVG inválido.");
 const root=parsed.documentElement;
 const forbidden=["script","foreignObject","iframe","image","audio","video","animate","animateTransform","animateMotion","set","style"];
 root.querySelectorAll("*").forEach(el=>{
   if(forbidden.includes(el.localName)||el.namespaceURI!=="http://www.w3.org/2000/svg"){el.remove();return}
   Array.from(el.attributes).forEach(attr=>{
     const name=attr.name.toLowerCase(),value=attr.value.toLowerCase();
     if(name.startsWith("on")||name==="href"||name.endsWith(":href")||value.includes("url(")&&!value.includes("url(#"))
       el.removeAttribute(attr.name);
   });
 });
 return new XMLSerializer().serializeToString(root);
}
reg("svg-png",async h=>{
 const {$,file,area,input,btn,result,canvas,content,status,download,toBlob,protect}=h;
 content.innerHTML=file("pnSvgFile","Arquivo SVG","image/svg+xml,.svg")+area("pnSvgText","Ou cole seu código SVG",'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="85" fill="#8b5cf6"/></svg>')+input("pnWidth","Largura do PNG (64 a 2000)","number","512")+btn("pnMake","Converter SVG")+canvas("pnCanvas")+btn("pnSave","Baixar PNG")+result();
 let ready=false;
 $("pnMake").onclick=protect(async()=>{
   const f=$("pnSvgFile").files[0],raw=f?await f.text():$("pnSvgText").value;
   const safe=safeSvg(raw),width=Number($("pnWidth").value);
   if(!Number.isInteger(width)||width<64||width>2000)throw Error("Escolha uma largura entre 64 e 2000.");
   const url=URL.createObjectURL(new Blob([safe],{type:"image/svg+xml"}));
   try{
     const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(Error("SVG não pode ser renderizado."));i.src=url});
     const c=$("pnCanvas");const proportion=img.naturalHeight/img.naturalWidth||1;
     c.width=width;c.height=Math.min(2000,Math.max(1,Math.round(width*proportion)));
     c.getContext("2d").drawImage(img,0,0,c.width,c.height);
     ready=true;status("SVG convertido para PNG "+c.width+"×"+c.height+".");
   }finally{URL.revokeObjectURL(url)}
 });
 $("pnSave").onclick=protect(async()=>{if(!ready)throw Error("Converta primeiro.");download(await toBlob($("pnCanvas")),"pdtools-vetor.png")});
});
reg("privacy-blur",async h=>{
 const {$,file,input,btn,result,canvas,content,status,download,toBlob,image,protect}=h;
 content.innerHTML=file("pnPicture","Imagem para ocultar informações","image/*")
 +'<p class="pd-premium-result">Arraste o dedo ou mouse sobre a prévia para selecionar a área sensível. A área será <strong>coberta de forma irreversível</strong> na imagem exportada.</p>'
 +input("pnColor","Cor da tarja","color","#18181b")
 +btn("pnLoad","Abrir imagem")+canvas("pnCanvas")
 +btn("pnUndo","Desfazer última tarja")+" "+btn("pnSave","Baixar imagem protegida")+result();
 const c=$("pnCanvas");let base=null,rects=[],start=null,preview=null;
 const coords=e=>{const r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height}};
 function draw(){
   if(!base)return;const ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);
   ctx.drawImage(base,0,0,c.width,c.height);ctx.fillStyle=$("pnColor").value;
   for(const r of [...rects,...(preview?[preview]:[])])ctx.fillRect(r.x,r.y,r.w,r.h);
 }
 $("pnLoad").onclick=protect(async()=>{
   base=await image($("pnPicture").files[0]);const scale=Math.min(1,1800/Math.max(base.width,base.height));
   c.width=Math.round(base.width*scale);c.height=Math.round(base.height*scale);
   rects=[];preview=null;draw();status("Arraste sobre dados que deseja esconder.");
 });
 c.style.touchAction="none";
 c.addEventListener("pointerdown",e=>{if(!base)return;start=coords(e);c.setPointerCapture(e.pointerId)});
 c.addEventListener("pointermove",e=>{if(!start)return;const p=coords(e);preview={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(p.x-start.x),h:Math.abs(p.y-start.y)};draw()});
 const finish=e=>{if(!start)return;const p=coords(e),r={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(p.x-start.x),h:Math.abs(p.y-start.y)};if(r.w>3&&r.h>3)rects.push(r);start=null;preview=null;draw();status(rects.length+" área(s) coberta(s).")};
 c.addEventListener("pointerup",finish);c.addEventListener("pointercancel",()=>{start=null;preview=null;draw()});
 $("pnColor").onchange=draw;
 $("pnUndo").onclick=()=>{rects.pop();draw()};
 $("pnSave").onclick=protect(async()=>{if(!base)throw Error("Abra a imagem primeiro.");if(!rects.length)throw Error("Selecione uma área para proteger.");download(await toBlob(c),"pdtools-informacoes-ocultas.png");status("Imagem protegida exportada.")});
});
reg("device-mockup",async h=>{
 const {$,file,select,btn,result,canvas,content,status,download,toBlob,image,protect}=h;
 content.innerHTML=file("pnPicture","Captura de tela ou imagem","image/*")
 +select("pnDevice","Dispositivo",[["phone","Smartphone"],["laptop","Notebook"],["browser","Janela de navegador"]])
 +btn("pnMake","Criar mockup")+canvas("pnCanvas")+btn("pnSave","Baixar mockup PNG")+result();
 let ready=false;
 $("pnMake").onclick=protect(async()=>{
   const img=await image($("pnPicture").files[0]),device=$("pnDevice").value,c=$("pnCanvas");c.width=1000;c.height=760;
   const ctx=c.getContext("2d");ctx.fillStyle="#f1eff9";ctx.fillRect(0,0,1000,760);
   ctx.fillStyle="#373047";ctx.shadowColor="#0004";ctx.shadowBlur=22;
   if(device==="phone"){
     ctx.beginPath();ctx.roundRect(330,40,340,680,44);ctx.fill();ctx.shadowBlur=0;
     ctx.fillStyle="#08080d";ctx.beginPath();ctx.roundRect(340,52,320,656,34);ctx.fill();
     ctx.save();ctx.beginPath();ctx.roundRect(350,78,300,606,24);ctx.clip();fit(ctx,img,350,78,300,606);ctx.restore();
     ctx.fillStyle="#151515";ctx.beginPath();ctx.roundRect(445,60,110,19,10);ctx.fill();
   }else{
     const x=105,y=100,w=790,h=500;
     ctx.beginPath();ctx.roundRect(x,y,w,h,16);ctx.fill();ctx.shadowBlur=0;
     ctx.fillStyle="#fafafa";ctx.fillRect(x+10,y+34,w-20,h-44);
     ctx.save();ctx.beginPath();ctx.rect(x+10,y+34,w-20,h-44);ctx.clip();fit(ctx,img,x+10,y+34,w-20,h-44);ctx.restore();
     ctx.fillStyle="#bbb4cb";for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(x+28+i*19,y+18,5,0,Math.PI*2);ctx.fill()}
     if(device==="laptop"){
       ctx.fillStyle="#655d70";ctx.beginPath();ctx.moveTo(60,600);ctx.lineTo(940,600);ctx.lineTo(975,626);ctx.lineTo(25,626);ctx.closePath();ctx.fill();
     }
   }
   ready=true;status("Mockup criado.");
 });
 $("pnSave").onclick=protect(async()=>{if(!ready)throw Error("Crie o mockup primeiro.");download(await toBlob($("pnCanvas")),"pdtools-mockup.png")});
});
reg("thumbnail-maker",async h=>{
 const {$,file,input,select,btn,result,canvas,content,status,download,toBlob,image,protect}=h;
 content.innerHTML=file("pnPicture","Imagem de fundo","image/*")+input("pnTitle","Título da miniatura","text","MEU NOVO VÍDEO")
 +input("pnAccent","Cor do destaque","color","#c084fc")
 +select("pnPosition","Alinhamento",[["left","À esquerda"],["center","Centralizado"],["right","À direita"]])
 +btn("pnMake","Criar thumbnail")+canvas("pnCanvas")+btn("pnSave","Baixar PNG 1280×720")+result();
 let ready=false;
 $("pnMake").onclick=protect(async()=>{
   const img=await image($("pnPicture").files[0]),c=$("pnCanvas");c.width=1280;c.height=720;
   const ctx=c.getContext("2d");fit(ctx,img,0,0,1280,720);
   const gradient=ctx.createLinearGradient(0,0,0,720);
   gradient.addColorStop(0,"#00000018");gradient.addColorStop(1,"#000000c9");
   ctx.fillStyle=gradient;ctx.fillRect(0,0,1280,720);
   const text=$("pnTitle").value.trim().slice(0,75);
   if(!text)throw Error("Digite um título.");
   const align=$("pnPosition").value;ctx.textAlign=align;ctx.textBaseline="middle";
   const x=align==="left"?65:align==="right"?1215:640;
   ctx.font="bold 90px system-ui, sans-serif";ctx.lineWidth=9;ctx.strokeStyle="#12101c";
   const words=text.split(/\s+/),lines=[];let line="";
   for(const word of words){const test=line?line+" "+word:word;
     if(ctx.measureText(test).width>1140&&line){lines.push(line);line=word}else line=test}
   if(line)lines.push(line);if(lines.length>4)throw Error("Título muito longo; use menos palavras.");
   lines.forEach((l,i)=>{const y=590-(lines.length-1-i)*110;ctx.strokeText(l,x,y);ctx.fillStyle=i===0?$("pnAccent").value:"#ffffff";ctx.fillText(l,x,y)});
   ready=true;status("Miniatura de vídeo criada.");
 });
 $("pnSave").onclick=protect(async()=>{if(!ready)throw Error("Crie a miniatura primeiro.");download(await toBlob($("pnCanvas")),"pdtools-thumbnail.png")});
});
})();