/**
 * Auditoria não destrutiva de interface com Chromium.
 * Nunca usa tokens reais, nem tenta gerar Pix.
 * Simula Supabase e a resposta de status Premium só em localhost.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import { chromium } from "playwright";

const base = "http://127.0.0.1:8765";
const server = spawn("python3",["-m","http.server","8765","--bind","127.0.0.1"],{stdio:"ignore"});
let browser;
const report = { free:[],premium:[],functional:[],failures:[],pageErrors:[] };
const check=(condition,desc)=>{if(!condition){report.failures.push(desc);throw Error(desc)}};
const authStub = String.raw`
window.__pdSessionEnabled = Boolean(window.__PD_AUDIT_PREMIUM);
window.supabase = {
  createClient: () => ({
    auth: {
      getSession: async () => ({data:{session:window.__pdSessionEnabled?{access_token:"audit-token",user:{id:"11111111-1111-4111-8111-111111111111"}}:null},error:null}),
      getUser: async () => ({data:{user:window.__pdSessionEnabled?{id:"11111111-1111-4111-8111-111111111111",email:"audit@example.invalid"}:null},error:null}),
      onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}}),
      mfa:{getAuthenticatorAssuranceLevel: async()=>({data:{currentLevel:"aal1",nextLevel:"aal1"},error:null}),listFactors:async()=>({data:{totp:[]},error:null})}
    },
    from: table => ({
      select(){return this},
      eq(){return this},
      order(){return Promise.resolve({
        data: table==="tools" ? window.PD_TOOLS_FALLBACK.map((t,i)=>({
           id:t.id,name:t.name,description:t.description||t.desc,
           category:t.category||t.cat,icon:t.icon,position:i,active:t.active
        })) : [],
        error:null
      })},
      maybeSingle(){return Promise.resolve({data:null,error:null})}
    })
  })
};`;
async function newPage(premium){
 const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
 page.on("pageerror",error=>{report.pageErrors.push((premium?"paid ":"guest ")+error.message)});
 // The next line only affects this local audit page; never touches production.
 await page.addInitScript({content:"window.__PD_AUDIT_PREMIUM="+JSON.stringify(premium)+";\n"+authStub});
 await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0",r=>r.abort());
 await page.route("**/popups-ui.js",r=>r.fulfill({status:200,contentType:"text/javascript",body:"// ads disabled only in browser testing"}));
 await page.route("**/api/**",r=>r.fulfill({status:401,contentType:"application/json",body:'{"erro":"Acesso negado em ambiente de testes"}'}));
 await page.route("**/api/premium-status",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({active:premium,expires_at:premium?"2027-01-01T00:00:00Z":null})}));
 await page.goto(base+"/",{waitUntil:"domcontentloaded",timeout:45000});
 await page.waitForSelector('#filters [data-cat="Premium"]',{timeout:15000});
 return page;
}
function extract(list){return list.map(x=>x.id)}
async function openFree(page,id){
 return await page.evaluate(id=>{
   const el=document.querySelector('[data-tool="'+CSS.escape(id)+'"]');
   if(!el)return {error:"card missing"};
   el.click();
   const modal=document.getElementById("toolModal");
   return {
    show:modal.classList.contains("show"),
    title:document.getElementById("modalTitle").textContent,
    html:document.getElementById("toolContent").innerHTML,
    actions:document.getElementById("toolContent").querySelectorAll('button').length,
    inputCount:document.getElementById("toolContent").querySelectorAll("input,textarea,select").length
   };
 },id);
}
async function clickPremium(page,id){
 await page.evaluate(id=>document.querySelector('[data-premium-tool="'+CSS.escape(id)+'"]')?.click(),id);
 await page.waitForFunction(()=>document.getElementById("toolModal").classList.contains("show"),{timeout:6000}).catch(()=>{});
 return page.evaluate(()=>{
   const html=document.getElementById("toolContent").innerHTML;
   return {show:document.getElementById("toolModal").classList.contains("show"),title:document.getElementById("modalTitle").textContent,html,
      inputs:document.getElementById("toolContent").querySelectorAll("input,textarea,select").length,
      buttons:document.getElementById("toolContent").querySelectorAll("button").length};
 });
}
function closeModal(page){return page.evaluate(()=>document.getElementById("toolModal").classList.remove("show"))}
const resultText=page=>page.locator("#pnResult").textContent();
async function main(){
 let started=false;
 for(let i=0;i<60;i++){
  try{const response=await fetch(base);if(response.ok){started=true;break}}catch{}
  await pause(200);
 }
 check(started,"Servidor de teste não iniciou");
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const guest=await newPage(false);
 const free=await guest.evaluate(()=>window.PD_TOOLS_FALLBACK);
 check(free.length===80,"Ferramentas gratuitas esperadas: 80");
 check(new Set(extract(free)).size===80,"Há IDs de ferramentas gratuitas duplicados");
 const stored=await guest.evaluate(()=>[...document.querySelectorAll("[data-tool]")].map(e=>e.dataset.tool));
 check(stored.length===80,"Vitrine não mostra 80 ferramentas gratuitas: "+stored.length);
 for(const item of free){
  const info=await openFree(guest,item.id);
  check(!info.error, "Ferramenta grátis sem card: "+item.id);
  check(info.show, "Modal não abriu: "+item.id);
  check(info.title===item.name,"Título incorreto: "+item.id);
  check(info.html.length>70,"Conteúdo vazio: "+item.id);
  check(!/não foi possível abrir esta ferramenta|em desenvolvimento|ferramenta não implementada/i.test(info.html),
   "Ferramenta grátis sem implementação: "+item.id);
  report.free.push({id:item.id,opened:true,buttons:info.actions,inputs:info.inputCount});
  await closeModal(guest);
 }
 console.log("ABERTURA_FREE: "+report.free.length+"/80");

 // Injeções armazenadas simuladas: todos os campos do catálogo devem ser escapados.
 const xssToolId="audit-xss-dummy";
 await guest.evaluate(id=>{
   tools.push({id,name:'<img src=x onerror="window.__pdXss=true">',desc:'<svg/onload=window.__pdXss=true>',cat:"Injeção <img>",icon:'"><script>window.__pdXss=true</script>',active:true});
   render();
 },xssToolId);
 check(await guest.locator('[data-tool="audit-xss-dummy"] img').count()===0,"Card executou marcação HTML injetada");
 check(await guest.evaluate(()=>!window.__pdXss),"XSS no catálogo de ferramentas");
 await guest.evaluate(()=>{tools=tools.filter(t=>t.id!=="audit-xss-dummy");render()});
 report.functional.push("Campos de catálogo escapam HTML, SVG e atributos maliciosos");


 const imageBase64=await guest.evaluate(()=>{
   const c=document.createElement("canvas");c.width=100;c.height=80;
   const ctx=c.getContext("2d");
   ctx.fillStyle="#9944ff";ctx.fillRect(0,0,100,80);
   ctx.fillStyle="#ffffff";ctx.fillRect(10,10,30,30);
   return c.toDataURL("image/png").split(",")[1];
 });
 const imageBuffer=Buffer.from(imageBase64,"base64");
 const imageCases=[
   ["image-compressor","imgCompFile","imgCompGo","#imgCompDownload"],
   ["image-resizer","imgResizeFile","imgResizeGo","#imgResizeDownload"],
   ["image-converter","imgConvertFile","imgConvertGo","#imgConvertDownload"],
   ["image-crop","imgCropFile","imgCropGo","#imgCropDownload"],
   ["image-rotate","imgRotateFile","imgRotateGo","#imgRotateDownload"],
   ["image-resolution","imgResFile","imgResGo","#imgResDownload"],
   ["image-circle","imgCircleFile","imgCircleGo","#imgCircleDownload"],
   ["image-watermark","imgWaterFile","imgWaterGo","#imgWaterDownload"]
 ];
 for(const [id,fileId,actionId,output] of imageCases){
   await openFree(guest,id);
   await guest.locator("#"+fileId).setInputFiles({name:"amostra.png",mimeType:"image/png",buffer:imageBuffer});
   await guest.waitForTimeout(250);
   if(id==="image-watermark")await guest.locator("#imgWaterText").fill("PD Tools");
   await guest.locator("#"+actionId).click();
   await guest.locator(output).waitFor({state:"visible",timeout:7000});
   report.functional.push("Imagem grátis: "+id+" -> arquivo preparado");
   await closeModal(guest);
 }
 await openFree(guest,"image-color-picker");
 await guest.locator("#imgColorFile").setInputFiles({name:"amostra.png",mimeType:"image/png",buffer:imageBuffer});
 await guest.locator("#imgColorPreview canvas").waitFor({state:"visible",timeout:7000});
 await guest.locator("#imgColorPreview canvas").click({position:{x:50,y:40}});
 check((await guest.locator("#imgColorResult").innerText()).includes("HEX:"),"Seletor de cores não leu pixel");
 report.functional.push("Imagem grátis: seletor HEX/RGB reconheceu pixel");
 await closeModal(guest);

 await guest.locator('#filters [data-cat="Premium"]').click();
 await guest.waitForSelector(".pd-premium-unlock",{timeout:6000});
 check(await guest.locator("[data-premium-tool]").count()===0,"Vitrine revela cards Premium para visitante sem assinatura");
 check((await guest.locator(".pd-premium-unlock").innerText()).includes("35 ferramentas"),"Aviso Premium não mostra 35 ferramentas");
 const payload='<img src=x onerror="window.__pdXss=true">';
 await guest.locator("#search").fill(payload);
 await guest.waitForTimeout(100);
 check(await guest.locator("[data-premium-tool]").count()===0,"Busca Premium expõe ferramentas sem assinatura");
 check(await guest.evaluate(()=>!window.__pdXss),"XSS executado na busca Premium");
 report.functional.push("Acesso gratuito: 80 cards visíveis e 35 ocultos ao visitante");
 await guest.close();

 const paid=await newPage(true);
 await paid.locator('#filters [data-cat="Premium"]').click();
 await paid.waitForSelector('[data-premium-tool="remove-bg"]',{timeout:9000});
 const premiumCards=await paid.evaluate(()=>[...document.querySelectorAll("[data-premium-tool]")].map(e=>e.dataset.premiumTool));
 check(premiumCards.length===35,"Assinante deveria visualizar 35 ferramentas, encontrou "+premiumCards.length);
 check(new Set(premiumCards).size===35,"IDs Premium duplicados");
 for(const id of premiumCards){
  const info=await clickPremium(paid,id);
  check(info.show,"Ferramenta Premium não abriu: "+id);
  check(info.title.trim().length>2,"Título Premium vazio: "+id);
  check(info.html.length>80,"Ferramenta Premium sem conteúdo: "+id);
  check(!info.html.includes("Não foi possível abrir esta ferramenta."),"Ferramenta Premium sem implementação: "+id);
  report.premium.push({id,opened:true,buttons:info.buttons,inputs:info.inputs});
  await closeModal(paid);
 }
 console.log("ABERTURA_PREMIUM: "+report.premium.length+"/35");
 // Injeções no editor Markdown; a prévia nunca deve executar markup do usuário.
 await paid.evaluate(()=>document.querySelector('[data-premium-tool="markdown-editor"]').click());
 await paid.waitForSelector("#pnMarkdown");
 await paid.locator("#pnMarkdown").fill('Título **ok** <img src=x onerror="window.__pdXss=true"> [link](javascript:alert(1))');
 check(await paid.locator("#pnPreview img").count()===0,"Markdown criou imagem HTML insegura");
 check(await paid.locator('#pnPreview a[href^="javascript:"]').count()===0,"Markdown permitiu javascript: URL");
 check(await paid.evaluate(()=>!window.__pdXss),"Markdown executou JavaScript injetado");
 report.functional.push("Markdown XSS e URL javascript: bloqueados");
 await closeModal(paid);

 // CSV real em browser: parser, interface editável e exportação.
 await paid.evaluate(()=>document.querySelector('[data-premium-tool="csv-editor"]').click());
 await paid.waitForSelector("#pnCsv");
 await paid.locator("#pnCsv").setInputFiles({name:"teste.csv",mimeType:"text/csv",buffer:Buffer.from('Nome,Texto\n"Ana, B.","Diz ""oi"""\n')});
 await paid.locator("#pnLoad").click();
 await paid.waitForSelector("#pnTable tr:nth-child(2)");
 check(await paid.locator("#pnTable tr").count()===2,"CSV não mostrou 2 linhas");
 check(await paid.locator("#pnTable input").count()===4,"CSV não tem 4 células editáveis");
 const csvDownload=paid.waitForEvent("download");
 await paid.locator("#pnSave").click();
 check((await csvDownload).suggestedFilename().endsWith(".csv"),"CSV não exportou arquivo");
 report.functional.push("CSV importação, edição e download");
 await closeModal(paid);

 await paid.evaluate(()=>document.querySelector('[data-premium-tool="subtitle-converter"]').click());
 await paid.waitForSelector("#pnSubtitleText");
 await paid.locator("#pnConvert").click();
 check((await paid.locator("#pnOutput").inputValue()).startsWith("WEBVTT"),"SRT não converteu para VTT");
 report.functional.push("SRT para VTT conversão real");
 await closeModal(paid);

 await paid.evaluate(()=>document.querySelector('[data-premium-tool="meta-generator"]').click());
 await paid.waitForSelector("#pnGenerate");
 await paid.locator("#pnGenerate").click();
 check((await paid.locator("#pnOutput").inputValue()).includes('og:title'),"Meta tags não geradas");
 report.functional.push("Meta tags SEO geradas");
 await closeModal(paid);

 await paid.evaluate(()=>document.querySelector('[data-premium-tool="css-animations"]').click());
 await paid.waitForSelector("#pnOutput");
 check((await paid.locator("#pnOutput").inputValue()).includes("@keyframes"),"Animação CSS não gerada");
 report.functional.push("Animações CSS geradas e prévia");
 await closeModal(paid);

 await paid.evaluate(()=>document.querySelector('[data-premium-tool="sitemap-maker"]').click());
 await paid.waitForSelector("#pnSave");
 const sitemapDownload=paid.waitForEvent("download");
 await paid.locator("#pnSave").click();
 check((await sitemapDownload).suggestedFilename()==="sitemap.xml","Sitemap não baixado");
 report.functional.push("Sitemap.xml gerado");
 await closeModal(paid);

 await paid.evaluate(()=>document.querySelector('[data-premium-tool="audio-trim"]').click());
 await paid.waitForSelector("#pnAudio");
 const sampleRate=8000,n=sampleRate*2,arr=Buffer.alloc(44+n*2);
 arr.write("RIFF",0);arr.writeUInt32LE(36+n*2,4);arr.write("WAVE",8);arr.write("fmt ",12);arr.writeUInt32LE(16,16);
 arr.writeUInt16LE(1,20);arr.writeUInt16LE(1,22);arr.writeUInt32LE(sampleRate,24);arr.writeUInt32LE(sampleRate*2,28);
 arr.writeUInt16LE(2,32);arr.writeUInt16LE(16,34);arr.write("data",36);arr.writeUInt32LE(n*2,40);
 for(let i=0;i<n;i++)arr.writeInt16LE(Math.round(Math.sin(i/sampleRate*440*2*Math.PI)*10000),44+i*2);
 await paid.locator("#pnAudio").setInputFiles({name:"som.wav",mimeType:"audio/wav",buffer:arr});
 await paid.locator("#pnEnd").fill("1");
 const audioDownload=paid.waitForEvent("download");
 await paid.locator("#pnCut").click();
 const audioFile=await audioDownload;
 check(audioFile.suggestedFilename().endsWith(".wav"),"Áudio cortado sem gerar WAV");
 report.functional.push("Cortador de áudio: decodificação e exportação WAV");
 await closeModal(paid);
 await paid.evaluate(()=>document.querySelector('[data-premium-tool="audio-volume"]').click());
 await paid.waitForSelector("#pnAudio");
 await paid.locator("#pnAudio").setInputFiles({name:"som.wav",mimeType:"audio/wav",buffer:arr});
 const volumeDownload=paid.waitForEvent("download");await paid.locator("#pnAdjust").click();
 check((await volumeDownload).suggestedFilename().endsWith(".wav"),"Editor de volume não exportou WAV");
 report.functional.push("Editor de volume WAV");
 await closeModal(paid);


 // Funções Premium com processamento real de imagens e arquivos locais.
 const openPaid=async(id,selector)=>{
   await paid.evaluate(id=>document.querySelector('[data-premium-tool="'+id+'"]')?.click(),id);
   await paid.locator(selector).waitFor({state:"attached",timeout:7000});
 };
 const expectFile=async(id,extension)=>{
   const event=paid.waitForEvent("download",{timeout:10000});
   await paid.locator("#"+id).click();
   const name=(await event).suggestedFilename();
   check(name.endsWith(extension),"Saída inválida em "+id+": "+name);
 };
 await openPaid("photo-collage","#pnImages");
 await paid.locator("#pnImages").setInputFiles([
   {name:"a.png",mimeType:"image/png",buffer:imageBuffer},
   {name:"b.png",mimeType:"image/png",buffer:imageBuffer}
 ]);
 await paid.locator("#pnCreate").click();
 await paid.waitForFunction(()=>document.querySelector("#pnResult")?.textContent.includes("Colagem criada"),null,{timeout:7000});
 await expectFile("pnSave",".png");report.functional.push("Colagem Premium gerada com 2 fotos");await closeModal(paid);

 await openPaid("svg-png","#pnSvgText");
 await paid.locator("#pnMake").click();
 await paid.waitForFunction(()=>document.querySelector("#pnResult")?.textContent.includes("convertido"),null,{timeout:7000});
 await expectFile("pnSave",".png");report.functional.push("SVG Premium convertido e exportado");await closeModal(paid);

 await openPaid("device-mockup","#pnPicture");
 await paid.locator("#pnPicture").setInputFiles({name:"imagem.png",mimeType:"image/png",buffer:imageBuffer});
 await paid.locator("#pnMake").click();
 await paid.waitForFunction(()=>document.querySelector("#pnResult")?.textContent.includes("criado"),null,{timeout:7000});
 await expectFile("pnSave",".png");report.functional.push("Mockup Premium gerado");await closeModal(paid);

 await openPaid("thumbnail-maker","#pnPicture");
 await paid.locator("#pnPicture").setInputFiles({name:"imagem.png",mimeType:"image/png",buffer:imageBuffer});
 await paid.locator("#pnMake").click();
 await paid.waitForFunction(()=>document.querySelector("#pnResult")?.textContent.includes("criada"),null,{timeout:7000});
 await expectFile("pnSave",".png");report.functional.push("Miniatura Premium 1280x720");await closeModal(paid);

 await openPaid("privacy-blur","#pnPicture");
 await paid.locator("#pnPicture").setInputFiles({name:"imagem.png",mimeType:"image/png",buffer:imageBuffer});
 await paid.locator("#pnLoad").click();
 const blurCanvas=paid.locator("#pnCanvas");
 await blurCanvas.waitFor({state:"visible"});
 const bounds=await blurCanvas.boundingBox();
 await paid.mouse.move(bounds.x+bounds.width*.2,bounds.y+bounds.height*.2);
 await paid.mouse.down();
 await paid.mouse.move(bounds.x+bounds.width*.7,bounds.y+bounds.height*.7,{steps:5});
 await paid.mouse.up();
 check((await resultText(paid)).includes("área"),"Não houve marcação de área");
 await expectFile("pnSave",".png");report.functional.push("Ocultação Premium com tarja e download");await closeModal(paid);

 check(await paid.evaluate(()=>typeof JSZip==="function"),"JSZip indisponível para ferramentas ZIP");
 await openPaid("favicon-maker","#pnLogo");
 await paid.locator("#pnLogo").setInputFiles({name:"logo.png",mimeType:"image/png",buffer:imageBuffer});
 await paid.locator("#pnMake").click();
 await paid.waitForFunction(()=>document.querySelector("#pnResult")?.textContent.includes("ícone")||document.querySelector("#pnResult")?.textContent.includes("Ícone"),null,{timeout:7000});
 await expectFile("pnSave",".zip");report.functional.push("Pacote de favicons ZIP");await closeModal(paid);

 const exampleFiles=[
  {name:"a.txt",mimeType:"text/plain",buffer:Buffer.from("Exemplo A","utf8")},
  {name:"b.txt",mimeType:"text/plain",buffer:Buffer.from("Exemplo B","utf8")}
 ];
 for(const id of ["file-organizer","bulk-rename","zip-maker"]){
   await openPaid(id,"#pnFiles");
   await paid.locator("#pnFiles").setInputFiles(exampleFiles);
   await expectFile("pnSave",".zip");
   report.functional.push("ZIP Premium: "+id);await closeModal(paid);
 }

 // Teste real do leitor QR usando QR Code gerado na sessão do navegador.
 const qrBase64=await paid.evaluate(async()=>{
   if(typeof QRCode!=="function")return null;
   const div=document.createElement("div");document.body.append(div);
   new QRCode(div,{text:"https://pdtools.vercel.app/audit",width:190,height:190});
   await new Promise(resolve=>setTimeout(resolve,120));
   const cv=div.querySelector("canvas");
   const result=cv?.toDataURL("image/png").split(",")[1]||null;
   div.remove();return result;
 });
 check(qrBase64,"Biblioteca QRCode externa não carregou");
 await openPaid("qr-reader","#pnPicture");
 await paid.locator("#pnPicture").setInputFiles({name:"qr.png",mimeType:"image/png",buffer:Buffer.from(qrBase64,"base64")});
 await paid.locator("#pnRead").click();
 await paid.waitForFunction(()=>document.querySelector("#pnDecoded")?.value.includes("pdtools.vercel.app/audit"),null,{timeout:9000});
 report.functional.push("Leitor QR Premium decodificou QR real");await closeModal(paid);

 const errors=report.pageErrors.filter(x=>!/Failed to load resource|net::ERR|is not defined/i.test(x));
 check(errors.length===0,"Exceções JavaScript no navegador: "+errors.slice(0,5).join(" | "));
 console.log("RESULTADO: "+JSON.stringify({free:report.free.length,premium:report.premium.length,functions:report.functional,pageErrors:report.pageErrors.slice(0,5),failures:report.failures}));
 await paid.close();
}
try{await main();}catch(error){
 console.error("AUDITORIA FALHOU:",error?.stack||error);
 console.error("RELATÓRIO PARCIAL:",JSON.stringify({free:report.free.length,premium:report.premium.length,functional:report.functional,failures:report.failures,pageErrors:report.pageErrors.slice(0,8)}));
 process.exitCode=1;
}finally{await browser?.close();server.kill();}
