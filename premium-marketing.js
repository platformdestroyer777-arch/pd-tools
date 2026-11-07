/* PD Tools — demonstração do valor Premium sem depoimentos nem urgência falsa. */
(() => {
"use strict";
const examples={
 gif:{title:"Transforme um vídeo em GIF",detail:"Escolha um trecho curto e baixe um GIF para compartilhar.",before:"vídeo.mp4",after:"animação.gif"},
 miniatura:{title:"Crie miniaturas para vídeos",detail:"Adicione título e destaque visual a uma foto e exporte em PNG.",before:"foto.jpg",after:"thumbnail.png"},
 arquivo:{title:"Organize arquivos de uma vez",detail:"Separe fotos, documentos e outros arquivos em pastas dentro de um ZIP.",before:"arquivos soltos",after:"pastas.zip"},
 audio:{title:"Corte um áudio em segundos",detail:"Selecione o início e o fim do trecho e baixe em WAV.",before:"áudio.mp3",after:"trecho.wav"}
};
const tabs=document.querySelectorAll("[data-pd-example]");
const display=document.getElementById("pdPremiumExample");
function activate(key){
 const x=examples[key];if(!x||!display)return;
 tabs.forEach(t=>t.setAttribute("aria-pressed",String(t.dataset.pdExample===key)));
 display.replaceChildren();
 const left=document.createElement("div");
 const heading=document.createElement("strong");heading.textContent=x.title;
 const p=document.createElement("p");p.textContent=x.detail;
 left.append(heading,p);
 const right=document.createElement("div");right.className="pd-premium-transform";
 const before=document.createElement("span"),after=document.createElement("span"),arrow=document.createElement("b");
 before.textContent=x.before;after.textContent=x.after;arrow.textContent="→";
 right.append(before,arrow,after);display.append(left,right);
}
tabs.forEach(t=>t.addEventListener("click",()=>activate(t.dataset.pdExample)));
activate("gif");
document.getElementById("premiumExplore")?.addEventListener("click",()=>{
 const filter=document.querySelector('#filters [data-cat="Premium"]');
 if(filter){filter.click();document.getElementById("ferramentas")?.scrollIntoView({behavior:"smooth"})}
 else document.getElementById("ferramentas")?.scrollIntoView({behavior:"smooth"});
});
})();