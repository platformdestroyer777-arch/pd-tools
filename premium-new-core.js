/* PD Tools Premium — shared runtime for the 20 new tools.
   All actions require a fresh /api/premium-status check.
   Processing is local in the visitor's browser; no uploads. */
(() => {
  "use strict";
  const handlers = new Map();
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
  const label = (title, html) => '<div class="pd-premium-field"><label>' + esc(title) + '</label>' + html + '</div>';
  const input = (id, title, type="text", value="") => label(title,'<input id="'+id+'" type="'+type+'" value="'+esc(value)+'">');
  const area = (id,title,value="") => label(title,'<textarea id="'+id+'">'+esc(value)+'</textarea>');
  const file = (id,title,accept,multiple=false) => label(title,'<input id="'+id+'" type="file" accept="'+esc(accept)+'" '+(multiple?"multiple":"")+'>');
  const select = (id,title,items) => label(title,'<select id="'+id+'">'+items.map(([value,name])=>'<option value="'+esc(value)+'">'+esc(name)+'</option>').join("")+'</select>');
  const btn = (id,title) => '<button type="button" class="action" id="'+id+'">'+esc(title)+'</button>';
  const result = () => '<p id="pnResult" class="pd-premium-result" role="status" aria-live="polite">Selecione os dados para começar.</p>';
  const canvas = id => '<canvas id="'+id+'" style="width:100%;height:auto;max-height:460px;object-fit:contain;background:#181623;border-radius:10px;margin:12px 0"></canvas>';
  const status = text => { const e=$("pnResult"); if(e) e.textContent=String(text); };
  const error = err => { console.error("PD Tools Premium:",err); status("Não foi possível concluir: "+(err?.message||"erro inesperado")); };
  function download(blob,name) {
    const url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url; a.download=name; document.body.append(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),12000);
  }
  function textDownload(text,name,mime="text/plain") { download(new Blob([text],{type:mime+";charset=utf-8"}),name); }
  async function image(fileObj) {
    if(!fileObj || !fileObj.type.startsWith("image/")) throw Error("Selecione uma imagem válida.");
    const url=URL.createObjectURL(fileObj);
    return await new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(Error("Não foi possível abrir a imagem."))};
      img.src=url;
    });
  }
  function toBlob(c,type="image/png",quality=0.92){
    return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error("Não foi possível exportar.")),type,quality));
  }
  function protect(fn) { return async function(...args){try{await fn(...args)}catch(e){error(e)}} }
  function register(id,handler){if(handlers.has(id))throw Error("Ferramenta duplicada: "+id);handlers.set(id,handler)}
  async function allowed() {
    const client=(typeof supabaseClient!=="undefined"&&supabaseClient)||window.supabaseClient;
    if(!client?.auth?.getSession) return false;
    const {data,error}=await client.auth.getSession();
    if(error) throw error;
    const token=data?.session?.access_token;
    if(!token) return false;
    const reply=await fetch("/api/premium-status",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
    if(reply.status===401)return false;
    if(!reply.ok)throw Error("Não foi possível verificar seu acesso Premium.");
    const dataStatus=await reply.json();
    return dataStatus.active===true;
  }
  async function open(id) {
    if(!handlers.has(id)) return;
    const modal=$("toolModal"),content=$("toolContent"),title=$("modalTitle"),cat=$("modalCategory");
    if(!modal||!content||!title||!cat)return;
    try {
      if(!await allowed()){
        document.getElementById("assinar-premium")?.scrollIntoView({behavior:"smooth"});
        return;
      }
      const card=document.querySelector('[data-premium-tool="'+id+'"]');
      title.textContent=card?.querySelector("h3")?.textContent||"PD Tools Premium";
      cat.textContent="PD TOOLS PREMIUM";
      if(typeof activeToolInterval!=="undefined"&&activeToolInterval) {
        clearInterval(activeToolInterval); activeToolInterval=null;
      }
      content.innerHTML="";
      modal.classList.add("show");
      await handlers.get(id)({ $,esc,label,input,area,file,select,btn,result,canvas,status,download,textDownload,image,toBlob,protect,content });
    }catch(err){error(err)}
  }
  const grid=$("toolGrid");
  if(grid){
    grid.addEventListener("click",ev=>{
      const card=ev.target.closest("[data-premium-tool]");
      if(card && grid.contains(card)) void open(card.dataset.premiumTool);
    });
    grid.addEventListener("keydown",ev=>{
      if(ev.key!=="Enter"&&ev.key!==" ")return;
      const card=ev.target.closest("[data-premium-tool]");
      if(card&&grid.contains(card)){ev.preventDefault();void open(card.dataset.premiumTool)}
    });
  }
  // Não expor o mapa de implementações ao escopo global.
  window.PDNewTools=Object.freeze({register,allowed,esc});
})();