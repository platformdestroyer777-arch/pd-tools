/* PD Tools Premium — 6 ferramentas de dados, arquivos e QR */
(() => {
"use strict";
const T=window.PDNewTools;if(!T)return;const reg=T.register;
function parseCSV(input,sep=","){
  const rows=[],row=[];let cell="",quoted=false;
  for(let i=0;i<input.length;i++){
    const c=input[i],n=input[i+1];
    if(quoted){if(c==='"'&&n==='"'){cell+='"';i++}else if(c==='"'){quoted=false}else cell+=c}
    else if(c==='"'){quoted=true}
    else if(c===sep){row.push(cell);cell=""}
    else if(c==="\n"||c==="\r"){if(c==="\r"&&n==="\n")i++;row.push(cell);if(row.some(v=>v!==""))rows.push(row.slice());row.length=0;cell=""}
    else cell+=c;
  }
  if(quoted)throw Error("CSV com aspas não fechadas.");
  row.push(cell);if(row.some(v=>v!==""))rows.push(row);
  return rows;
}
// Impede que conteúdo de células seja executado como fórmula ao abrir
// arquivos CSV no Excel/LibreOffice. Dados simples permanecem legíveis.
function encodeCSV(rows,sep=","){
  return rows.map(row=>row.map(cell=>{
    const raw=String(cell??"");
    const risky=/^[\s\u0000-\u001f]*[=+@\t\r]/.test(raw) ||
      /^[\s\u0000-\u001f]*-(?!\d+(?:[.,]\d+)?\s*$)/.test(raw);
    const value=risky?"'"+raw:raw;
    return /[",\r\n;]/.test(value)||value.includes(sep)
      ? '"'+value.replace(/"/g,'""')+'"'
      : value;
  }).join(sep)).join("\r\n");
}
function requireZip(){if(!window.JSZip)throw Error("Biblioteca ZIP não disponível.");return new JSZip()}
function checkZipFiles(fs) {
  const bytes = fs.reduce((sum, f) => sum + f.size, 0);
  if (bytes > 120 * 1024 * 1024) {
    throw Error("Limite de 120 MB por arquivo ZIP para evitar travamentos.");
  }
}
const clean=name=>String(name).replace(/[/\\<>:"|?*\x00-\x1f]/g,"_").replace(/^\.+$/,"arquivo").slice(0,130)||"arquivo";
reg("csv-editor",async h=>{
 const {$,file,select,btn,result,content,status,textDownload,protect}=h;
 content.innerHTML=file("pnCsv","Arquivo CSV","text/csv,.csv")
 +select("pnDelimiter","Separador",[ [",","Vírgula"],[";","Ponto e vírgula"] ])
 +btn("pnLoad","Carregar CSV")
 +'<div style="overflow:auto;max-height:400px;margin:12px 0"><table id="pnTable" style="border-collapse:collapse;width:100%"></table></div>'
 +btn("pnRow","Adicionar linha")+" "+btn("pnColumn","Adicionar coluna")+" "+btn("pnSave","Baixar CSV")+result();
 let rows=[];
 function render(){
  const table=$("pnTable");table.replaceChildren();
  rows.forEach((row,r)=>{
    const tr=document.createElement("tr");
    row.forEach((val,c)=>{
      const td=document.createElement(r===0?"th":"td");td.style.cssText="padding:4px;border:1px solid #514469";
      const inp=document.createElement("input");inp.value=val;inp.setAttribute("aria-label","Linha "+(r+1)+", coluna "+(c+1));
      inp.style.cssText="width:130px;background:#181522;color:white;border:0;padding:8px";
      inp.oninput=()=>{rows[r][c]=inp.value};td.append(inp);tr.append(td);
    });table.append(tr);
  });
  status(rows.length+" linha(s), "+(rows[0]?.length||0)+" coluna(s).");
 }
 $("pnLoad").onclick=protect(async()=>{
   const f=$("pnCsv").files[0];if(!f)throw Error("Selecione um CSV.");
   if(f.size>2*1024*1024)throw Error("CSV acima de 2 MB.");
   const data=parseCSV((await f.text()).replace(/^\ufeff/,""),$("pnDelimiter").value);
   if(!data.length)throw Error("Arquivo vazio.");
   if(data.length>500||Math.max(...data.map(r=>r.length))>30)throw Error("Limite: 500 linhas e 30 colunas.");
   const width=Math.max(...data.map(r=>r.length));rows=data.map(r=>Array.from({length:width},(_,i)=>r[i]||""));render();
 });
 $("pnRow").onclick=()=>{if(rows.length>=500){status("Limite de 500 linhas.");return}if(!rows.length)rows=[["Coluna 1"]];else rows.push(Array(rows[0].length).fill(""));render()};
 $("pnColumn").onclick=()=>{if(!rows.length)rows=[[]];if(rows[0].length>=30){status("Limite de 30 colunas.");return}rows.forEach((r,i)=>r.push(i===0?"Nova coluna":""));render()};
 $("pnSave").onclick=protect(async()=>{if(!rows.length)throw Error("Carregue uma tabela.");textDownload("\ufeff"+encodeCSV(rows,$("pnDelimiter").value),"pdtools-tabela.csv","text/csv");status("CSV exportado.")});
});
reg("file-organizer",async h=>{
 const {$,file,btn,result,content,status,download,protect}=h;
 content.innerHTML=file("pnFiles","Selecione arquivos para organizar em pastas ZIP","*/*",true)
 +btn("pnSave","Organizar e baixar ZIP")+result();
 $("pnSave").onclick=protect(async()=>{
   const fs=Array.from($("pnFiles").files);
   if(!fs.length)throw Error("Selecione arquivos.");if(fs.length>150)throw Error("Limite de 150 arquivos.");checkZipFiles(fs);
   const zip=requireZip(),used=new Set();
   for(const f of fs){
     const ext=(f.name.split(".").pop()||"").toLowerCase();
     const group=/^(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(ext)?"Imagens":
       /^(mp4|webm|mov|avi|mkv)$/.test(ext)?"Videos":
       /^(mp3|wav|ogg|m4a|flac)$/.test(ext)?"Audios":
       /^(pdf|doc|docx|txt|md|odt)$/.test(ext)?"Documentos":
       /^(csv|xlsx|xls|json|xml)$/.test(ext)?"Dados":"Outros";
     let name=clean(f.name),key=group+"/"+name,n=1;
     while(used.has(key)){name=n+++"-"+clean(f.name);key=group+"/"+name}
     used.add(key);zip.file(key,f);
   }
   download(await zip.generateAsync({type:"blob",compression:"DEFLATE"}),"pdtools-arquivos-organizados.zip");
   status(fs.length+" arquivos organizados.");
 });
});
reg("bulk-rename",async h=>{
 const {$,file,input,btn,result,content,status,download,protect}=h;
 content.innerHTML=file("pnFiles","Arquivos para renomear","*/*",true)
 +input("pnPrefix","Novo nome-base","text","documento")
 +input("pnStart","Numeração inicial","number","1")
 +btn("pnSave","Renomear e baixar ZIP")+result();
 $("pnSave").onclick=protect(async()=>{
   const fs=Array.from($("pnFiles").files),start=Number($("pnStart").value);
   if(!fs.length)throw Error("Selecione arquivos.");if(fs.length>150)throw Error("Limite de 150 arquivos.");checkZipFiles(fs);
   if(!Number.isInteger(start)||start<0||start>999999)throw Error("Numeração inválida.");
   const prefix=clean($("pnPrefix").value);const zip=requireZip();
   fs.forEach((f,i)=>{const ext=f.name.includes(".")?"."+clean(f.name.split(".").pop()):"";zip.file(prefix+"-"+String(start+i).padStart(3,"0")+ext,f)});
   download(await zip.generateAsync({type:"blob",compression:"DEFLATE"}),"pdtools-renomeados.zip");status(fs.length+" arquivos renomeados.");
 });
});
reg("zip-maker",async h=>{
 const {$,file,input,btn,result,content,status,download,protect}=h;
 content.innerHTML=file("pnFiles","Arquivos para compactar","*/*",true)
 +input("pnName","Nome do arquivo ZIP","text","meus-arquivos")+btn("pnSave","Criar arquivo ZIP")+result();
 $("pnSave").onclick=protect(async()=>{
   const fs=Array.from($("pnFiles").files);if(!fs.length)throw Error("Selecione arquivos.");
   if(fs.length>200)throw Error("Limite de 200 arquivos.");checkZipFiles(fs);
   const zip=requireZip(),used=new Set();
   for(const f of fs){let name=clean(f.name),n=1;while(used.has(name))name=n+++"-"+clean(f.name);used.add(name);zip.file(name,f)}
   download(await zip.generateAsync({type:"blob",compression:"DEFLATE"}),clean($("pnName").value)+".zip");
   status(fs.length+" arquivos compactados.");
 });
});
reg("qr-reader",async h=>{
 const {$,file,btn,result,canvas,content,status,image,protect}=h;
 content.innerHTML=file("pnPicture","Imagem que contém QR Code","image/*")+btn("pnRead","Ler QR Code")+canvas("pnCanvas")
 +'<div class="pd-premium-field"><label for="pnDecoded">Conteúdo identificado</label><textarea id="pnDecoded" readonly aria-label="Conteúdo do QR Code"></textarea></div>'
 +btn("pnCopy","Copiar resultado")+result();
 $("pnRead").onclick=protect(async()=>{
   const im=await image($("pnPicture").files[0]);
   const c=$("pnCanvas"),scale=Math.min(1,1800/Math.max(im.width,im.height));
   c.width=Math.max(1,Math.round(im.width*scale));c.height=Math.max(1,Math.round(im.height*scale));
   const ctx=c.getContext("2d",{willReadFrequently:true});ctx.drawImage(im,0,0,c.width,c.height);
   let decoded="";
   if("BarcodeDetector" in window){
     try{
       const supported=await BarcodeDetector.getSupportedFormats();
       if(supported.includes("qr_code")){
         const found=await new BarcodeDetector({formats:["qr_code"]}).detect(c);
         decoded=found[0]?.rawValue||"";
       }
     }catch(err){console.warn("Leitor QR nativo indisponível:",err)}
   }
   if(!decoded){
     if(typeof window.jsQR!=="function"){
       await new Promise((resolve,reject)=>{
         const script=document.createElement("script");
         script.src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
         script.integrity="sha384-hStSInNIZ8ljtOVrmrgf7zdHMapaLBWoSnPTtF0nzsybp4+LuhDz6sHuEVpWIX8o";
         script.crossOrigin="anonymous";
         script.onload=()=>typeof window.jsQR==="function"?resolve():reject(Error("Leitor QR não iniciou."));
         script.onerror=()=>reject(Error("Não foi possível carregar o leitor QR."));
         document.head.append(script);
       });
     }
     const pixels=ctx.getImageData(0,0,c.width,c.height);
     decoded=window.jsQR(pixels.data,c.width,c.height)?.data||"";
   }
   if(!decoded)throw Error("QR Code não encontrado. Use uma imagem mais nítida.");
   $("pnDecoded").value=decoded;status("QR Code lido. Confira o conteúdo antes de abrir links.");
 });
 $("pnCopy").onclick=protect(async()=>{
   const val=$("pnDecoded").value;if(!val)throw Error("Leia um QR Code primeiro.");
   await navigator.clipboard.writeText(val);status("Conteúdo copiado.");
 });
});
reg("sitemap-maker",async h=>{
 const {$,area,input,btn,result,content,status,textDownload,protect}=h;
 content.innerHTML=area("pnUrls","URLs (uma por linha)","https://exemplo.com/\nhttps://exemplo.com/contato")
 +input("pnPriority","Prioridade padrão (0.0 a 1.0)","number","0.5")
 +btn("pnSave","Gerar sitemap.xml")+result();
 $("pnSave").onclick=protect(async()=>{
   const lines=$("pnUrls").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
   if(!lines.length||lines.length>5000)throw Error("Informe entre 1 e 5.000 URLs.");
   const priority=Number($("pnPriority").value);
   if(!Number.isFinite(priority)||priority<0||priority>1)throw Error("Prioridade entre 0 e 1.");
   const urls=[...new Set(lines)].map(line=>{
     let url;try{url=new URL(line)}catch{throw Error("URL inválida: "+line)}
     if(!["http:","https:"].includes(url.protocol))throw Error("Use apenas HTTP ou HTTPS.");
     return url.toString().replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
   });
   const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
     +urls.map(url=>'  <url><loc>'+url+'</loc><priority>'+priority.toFixed(1)+'</priority></url>').join("\n")+"\n</urlset>\n";
   textDownload(xml,"sitemap.xml","application/xml");status(urls.length+" URLs adicionadas ao sitemap.");
 });
});
})();