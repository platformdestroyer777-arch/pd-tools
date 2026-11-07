// Verifica que PDFs e OCR só executam JavaScript com SHA-384 fixado.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const expected=new Map([
 ["https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js","sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI"],
 ["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js","sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e"],
 ["https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js","sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F"]
]);
const source=readFileSync("premium-extras.js","utf8");
assert.match(source,/s\.integrity = integrity;/,"Carregamento sem SRI");
assert.match(source,/s\.crossOrigin = "anonymous"/,"CDN sem CORS para SRI");
for(const [url,integrity] of expected){
 assert.ok(source.includes(JSON.stringify(url)),"URL CDN inesperada: "+url);
 assert.ok(source.includes(JSON.stringify(integrity)),"SHA CDN ausente: "+url);
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error("CDN indisponível "+response.status+": "+url);
 const actual="sha384-"+createHash("sha384").update(Buffer.from(await response.arrayBuffer())).digest("base64");
 assert.equal(actual,integrity,"Biblioteca externa foi modificada na CDN: "+url);
 console.log("SRI Premium OK "+url);
}
