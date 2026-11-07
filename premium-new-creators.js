/* PD Tools Premium — 4 ferramentas para criadores e desenvolvedores */
(() => {
"use strict";
const T=window.PDNewTools;if(!T)return;const reg=T.register;
reg("meta-generator",async h=>{
 const {$,input,area,btn,result,content,status,textDownload,protect}=h;
 content.innerHTML=input("pnTitle","Título da página","text","Meu site incrível")
 +area("pnDescription","Descrição da página","Ferramentas e conteúdos para você.")
 +input("pnUrl","URL pública","url","https://exemplo.com")
 +input("pnImage","URL da imagem de prévia","url","https://exemplo.com/capa.png")
 +btn("pnGenerate","Gerar meta tags")
 +area("pnOutput","Código HTML gerado","")
 +btn("pnSave","Baixar meta-tags.html")+result();
 const enc=s=>String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
 $("pnGenerate").onclick=protect(async()=>{
   const title=$("pnTitle").value.trim().slice(0,120),desc=$("pnDescription").value.trim().slice(0,320);
   if(!title||!desc)throw Error("Informe título e descrição.");
   const url=$("pnUrl").value.trim(),img=$("pnImage").value.trim();
   for(const u of [url,img]){if(!u)continue;const x=new URL(u);if(!["https:","http:"].includes(x.protocol))throw Error("Links devem usar HTTP ou HTTPS.");}
   const lines=[
    '<title>'+enc(title)+'</title>',
    '<meta name="description" content="'+enc(desc)+'">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="'+enc(title)+'">',
    '<meta property="og:description" content="'+enc(desc)+'">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="'+enc(title)+'">',
    '<meta name="twitter:description" content="'+enc(desc)+'">'
   ];
   if(url){lines.push('<link rel="canonical" href="'+enc(url)+'">','<meta property="og:url" content="'+enc(url)+'">')}
   if(img)lines.push('<meta property="og:image" content="'+enc(img)+'">','<meta name="twitter:image" content="'+enc(img)+'">');
   $("pnOutput").value=lines.join("\n");status("Meta tags prontas para copiar para o head do site.");
 });
 $("pnSave").onclick=protect(async()=>{if(!$("pnOutput").value)throw Error("Gere o código antes.");textDownload($("pnOutput").value,"meta-tags.html","text/html")});
});
reg("css-animations",async h=>{
 const {$,input,select,btn,result,content,status,textDownload,protect}=h;
 content.innerHTML=select("pnPreset","Animação",[["pulse","Pulso"],["bounce","Salto"],["rotate","Rotação"],["fade","Aparecer"],["slide","Deslizar"]])
 +input("pnDuration","Duração em segundos (0,2 a 10)","number","1.2")
 +select("pnRepeat","Repetição",[["infinite","Infinita"],["1","Uma vez"],["3","Três vezes"]])
 +btn("pnGenerate","Gerar animação CSS")
 +'<div id="pnPreview" style="width:120px;height:85px;margin:22px auto;display:grid;place-items:center;background:#a78bfa;color:#140a25;border-radius:12px;font-weight:700">PD Tools</div>'
 +'<div class="pd-premium-field"><label for="pnOutput">CSS para copiar</label><textarea id="pnOutput" readonly></textarea></div>'
 +btn("pnSave","Baixar CSS")+result();
 const effects={
  pulse:"0%,100%{transform:scale(1)}50%{transform:scale(1.16)}",
  bounce:"0%,100%{transform:translateY(0)}50%{transform:translateY(-25px)}",
  rotate:"from{transform:rotate(0deg)}to{transform:rotate(360deg)}",
  fade:"from{opacity:0}to{opacity:1}",
  slide:"from{transform:translateX(-45px);opacity:0}to{transform:translateX(0);opacity:1}"
 };
 let current=null;
 function generate(){
   const d=Number($("pnDuration").value),key=$("pnPreset").value,repeat=$("pnRepeat").value;
   if(!Number.isFinite(d)||d<.2||d>10)throw Error("Duração de 0,2 a 10 segundos.");
   const css="@keyframes pd-"+key+" { "+effects[key]+" }\n\n.pd-animacao { animation: pd-"+key+" "+d+"s ease-in-out "+repeat+"; }";
   $("pnOutput").value=css;
   if(current)current.remove();const style=document.createElement("style");style.textContent="@keyframes pd-"+key+"{"+effects[key]+"}";document.head.append(style);current=style;
   const preview=$("pnPreview");preview.style.animation="none";void preview.offsetWidth;
   preview.style.animation="pd-"+key+" "+d+"s ease-in-out "+repeat;
   status("Animação pronta para usar no CSS.");
 }
 $("pnGenerate").onclick=protect(async()=>generate());
 $("pnSave").onclick=protect(async()=>{if(!$("pnOutput").value)throw Error("Gere uma animação.");textDownload($("pnOutput").value,"pdtools-animacao.css","text/css")});
 generate();
});
function markdown(src){
 const esc=T.esc,tick=String.fromCharCode(96);
 const codeReg=new RegExp(tick+"([^"+tick+"]+)"+tick,"g");
 const inline=s=>esc(s).replace(codeReg,"<code>$1</code>")
  .replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>")
  .replace(/\*([^*]+)\*/g,"<em>$1</em>")
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,(_m,name,url)=>'<a href="'+url.replace(/"/g,"&quot;")+'" target="_blank" rel="noopener noreferrer">'+name+'</a>');
 let code=false;return src.split(/\r?\n/).map(line=>{
   if(line.trim().startsWith("~~~")||line.trim().startsWith(tick.repeat(3))){code=!code;return code?"<pre><code>":"</code></pre>"}
   if(code)return esc(line)+"\n";
   const heading=line.match(/^(#{1,4})\s+(.+)$/);
   if(heading){const n=heading[1].length;return "<h"+n+">"+inline(heading[2])+"</h"+n+">"}
   if(/^---+$/.test(line.trim()))return "<hr>";
   if(/^\s*[-*]\s+/.test(line))return "<p>• "+inline(line.replace(/^\s*[-*]\s+/,""))+"</p>";
   return line.trim()?"<p>"+inline(line)+"</p>":"<div style='height:8px'></div>";
 }).join("");
}
reg("markdown-editor",async h=>{
 const {$,area,btn,result,content,status,textDownload,protect}=h;
 content.innerHTML=area("pnMarkdown","Texto Markdown","# Minha página\n\nTexto em **negrito** e *itálico*.\n\n- Meu primeiro item")
 +'<div class="pd-premium-field"><label>Prévia segura</label><div id="pnPreview" style="min-height:130px;max-height:350px;overflow:auto;background:#1c1929;padding:16px;border-radius:10px"></div></div>'
 +btn("pnSave","Baixar Markdown")+result();
 const render=()=>{$("pnPreview").innerHTML=markdown($("pnMarkdown").value);status($("pnMarkdown").value.length+" caracteres — prévia atualizada.")};
 $("pnMarkdown").oninput=render;render();
 $("pnSave").onclick=protect(async()=>textDownload($("pnMarkdown").value,"pdtools-documento.md","text/markdown"));
});
function convertSubs(data,to){
 let text=data.replace(/^\ufeff/,"").replace(/\r\n/g,"\n").trim();
 if(!text)throw Error("Arquivo de legendas vazio.");
 text=text.replace(/^WEBVTT[^\n]*\n/i,"").trim();
 const chunks=text.split(/\n\s*\n/);const cues=[];
 for(const chunk of chunks){
   const lines=chunk.split("\n").filter(Boolean);if(!lines.length)continue;
   const i=lines.findIndex(x=>x.includes("-->"));if(i<0)continue;
   const time=lines[i].match(/(\d{2}:)?\d{2}:\d{2}[,.]\d{3}\s*-->\s*(\d{2}:)?\d{2}:\d{2}[,.]\d{3}/);
   if(!time)throw Error("Marca de tempo inválida: "+lines[i]);
   const parts=time[0].split(/\s*-->\s*/);
   const normalize=t=>{const a=t.replace(",",".").split(":");return(a.length===2?"00:":"")+a.join(":")};
   cues.push({time:normalize(parts[0])+" --> "+normalize(parts[1]),words:lines.slice(i+1).join("\n")});
 }
 if(!cues.length)throw Error("Nenhuma legenda com marca de tempo foi identificada.");
 if(to==="srt")return cues.map((x,i)=>(i+1)+"\n"+x.time.replace(/\./g,",")+"\n"+x.words).join("\n\n")+"\n";
 return "WEBVTT\n\n"+cues.map(x=>x.time+"\n"+x.words).join("\n\n")+"\n";
}
reg("subtitle-converter",async h=>{
 const {$,file,area,select,btn,result,content,status,textDownload,protect}=h;
 content.innerHTML=file("pnSubtitleFile","Arquivo SRT ou VTT","text/plain,.srt,.vtt")
 +area("pnSubtitleText","Ou cole as legendas","1\n00:00:01,000 --> 00:00:03,000\nOlá, mundo!")
 +select("pnTarget","Converter para",[["vtt","WebVTT (.vtt)"],["srt","SubRip (.srt)"]])
 +btn("pnConvert","Converter legendas")
 +'<div class="pd-premium-field"><label for="pnOutput">Resultado</label><textarea id="pnOutput" readonly></textarea></div>'
 +btn("pnSave","Baixar legenda")+result();
 $("pnConvert").onclick=protect(async()=>{
   const f=$("pnSubtitleFile").files[0],raw=f?await f.text():$("pnSubtitleText").value;
   if(raw.length>2*1024*1024)throw Error("Arquivo acima de 2 MB.");
   $("pnOutput").value=convertSubs(raw,$("pnTarget").value);
   status("Legendas convertidas.");
 });
 $("pnSave").onclick=protect(async()=>{
   if(!$("pnOutput").value)throw Error("Converta as legendas primeiro.");
   textDownload($("pnOutput").value,"pdtools-legendas."+$("pnTarget").value,"text/plain");
 });
});
})();