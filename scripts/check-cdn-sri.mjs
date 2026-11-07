// Auditoria SRI de recursos externos fixados. Não exige credenciais.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const sources = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0",
  "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
];
const html = readFileSync("index.html", "utf8");
for (const source of sources) {
  const response = await fetch(source, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("CDN indisponível (" + response.status + "): " + source);
  const bytes = Buffer.from(await response.arrayBuffer());
  const integrity = "sha384-" + createHash("sha384").update(bytes).digest("base64");
  console.log("PDTOOLS_SRI " + JSON.stringify({ source, integrity, size: bytes.length }));
  if (process.argv.includes("--verify")) {
    const tags = Array.from(html.matchAll(/<script\b[^>]*>/gi), m => m[0]);
    const tag = tags.find(t => t.includes('src="' + source + '"'));
    if (!tag || !tag.includes('integrity="' + integrity + '"') ||
      !tag.includes('crossorigin="anonymous"')) {
      throw new Error("Script externo sem SRI válido: " + source);
    }
  }
}
