import { createHash } from "node:crypto";
const sources = [
 "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js",
 "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
 "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"
];
for(const source of sources){
 const response=await fetch(source,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error("CDN inválido "+response.status+": "+source);
 const bytes=Buffer.from(await response.arrayBuffer());
 const integrity="sha384-"+createHash("sha384").update(bytes).digest("base64");
 console.log("DEPENDENCY_SRI "+JSON.stringify({source,integrity,size:bytes.length}));
}
