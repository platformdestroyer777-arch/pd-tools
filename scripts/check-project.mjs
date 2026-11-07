import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

// Verificações sem credenciais, sem acesso à produção e sem criar cobranças.
const jsFiles = [
  "app.js", "tools-fallback.js", "payments-ui.js", "popups-ui.js",
  "premium-auth.js", "admin-mfa.js", "premium-filter.js", "premium-image-batch.js",
  "premium-qrcode.js", "premium-watermark.js", "premium-extras.js",
  "premium-new-core.js", "premium-new-media.js", "premium-new-design.js",
  "premium-new-productivity.js", "premium-new-creators.js", "premium-marketing.js",
  "api/admin-mfa-enable.js", "api/auditar-pix.js", "api/consultar-pix.js", "api/criar-pix.js",
  "api/premium-status.js", "api/webhook-mercadopago.js"
];

for (const filename of jsFiles) {
  assert.ok(existsSync(filename), "Arquivo ausente: " + filename);
  const test = spawnSync(process.execPath, ["--check", filename], { encoding: "utf8" });
  assert.equal(test.status, 0, "Sintaxe inválida em " + filename + ": " + test.stderr);
}

const sandbox = { window: {} };
vm.runInNewContext(readFileSync("tools-fallback.js", "utf8"), sandbox, { timeout: 3000 });
const fallback = sandbox.window.PD_TOOLS_FALLBACK;
assert.ok(Array.isArray(fallback), "Catálogo offline não é uma lista");
assert.equal(fallback.length, 80, "A cópia de contingência não contém as 80 ferramentas");
assert.equal(new Set(fallback.map(item => item.id)).size, 80, "Há IDs duplicados no catálogo");
assert.ok(fallback.every(item => typeof item.id === "string" && typeof item.name === "string" && item.active === true), "Ferramenta inválida ou inativa no fallback");

const html = readFileSync("index.html", "utf8");
assert.match(html, /<title>[^<]+<\/title>/i, "Título da página ausente");
for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
  const src = match[1].split("?")[0];
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("data:")) continue;
  assert.ok(existsSync(src.replace(/^\//, "")), "Script local inexistente: " + src);
}

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const headers = vercel.headers.flatMap(rule => rule.headers || []);
const csp = headers.find(h => h.key.toLowerCase() === "content-security-policy")?.value;
assert.ok(csp, "Falta cabeçalho CSP");
const scriptDirective = csp.split(";").find(part => part.trim().startsWith("script-src"));
assert.ok(scriptDirective && !scriptDirective.includes("'unsafe-inline'"), "Scripts inline inseguros permitidos");

assert.ok(existsSync("robots.txt") && existsSync("sitemap.xml"), "SEO: arquivos ausentes");
const frontend = readFileSync("app.js", "utf8");
assert.doesNotMatch(frontend, /SUPABASE_SERVICE_ROLE_KEY|MERCADOPAGO_ACCESS_TOKEN|MERCADOPAGO_WEBHOOK_SECRET/, "Possível referência a segredo no frontend");
assert.match(readFileSync("api/criar-pix.js", "utf8"), /claim_pix_checkout_slot/, "Proteção anti-abuso do Pix ausente");
assert.match(readFileSync("api/webhook-mercadopago.js", "utf8"), /timingSafeEqual/, "Validação HMAC ausente");
assert.match(readFileSync("api/premium-status.js", "utf8"), /auth\.getUser/, "Consulta Premium sem autenticação");
const mfaScript = readFileSync("admin-mfa.js", "utf8");
const mfaMigration = readFileSync("supabase/migrations/20261107_admin_mfa_enforcement.sql", "utf8");
assert.match(html, /id="pdAdminMfaDialog"/, "Diálogo MFA ausente");
assert.match(html, /src="admin-mfa.js"/, "Script MFA não carregado");
assert.match(mfaScript, /challengeAndVerify/, "Desafio TOTP ausente");
assert.match(mfaScript, /\/api\/admin-mfa-enable/, "Ativação do MFA no backend ausente");
assert.match(mfaMigration, /require_mfa/, "MFA não marcado na tabela admins");
assert.match(mfaMigration, /auth\.jwt\(\)\s*->>\s*'aal'/, "Validação AAL2 ausente nas policies");
assert.match(mfaMigration, /DROP FUNCTION IF EXISTS public\.enable_admin_mfa/, "RPC pública antiga não removida");
assert.match(mfaMigration, /storage\.objects/, "Uploads do admin sem MFA");
assert.match(readFileSync("api/auditar-pix.js", "utf8"), /getAuthenticatorAssuranceLevel/, "Auditoria Pix sem MFA");
for (const file of ["api/criar-pix.js", "api/consultar-pix.js", "api/webhook-mercadopago.js"]) {
  assert.match(readFileSync(file, "utf8"), /AbortSignal\.timeout/, "Timeout do Mercado Pago ausente: " + file);
}


console.log("PD Tools: sintaxe de " + jsFiles.length + " arquivos JS, catálogo offline (80), HTML, CSP, SEO e contratos Pix validados.");

const mfaBackend = readFileSync("api/admin-mfa-enable.js", "utf8");
assert.match(mfaBackend, /getAuthenticatorAssuranceLevel/, "Servidor MFA não verifica AAL2");
assert.match(mfaBackend, /auth\.getUser/, "Servidor MFA não valida JWT");
assert.match(mfaBackend, /require_mfa:\s*true/, "Servidor MFA não ativa proteção");
