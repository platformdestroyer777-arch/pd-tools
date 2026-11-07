// Smoke test não destrutivo contra a produção: sem login, sem Pix real e sem segredos.
import assert from "node:assert/strict";

const origin = "https://pd-tools-eight.vercel.app";
const requests = [
  { path: "/", method: "GET", status: 200 },
  { path: "/robots.txt", method: "GET", status: 200 },
  { path: "/sitemap.xml", method: "GET", status: 200 },
  { path: "/tools-fallback.js", method: "GET", status: 200 },
  { path: "/api/premium-status", method: "GET", status: 401 },
  { path: "/api/auditar-pix", method: "POST", status: 401 },
  { path: "/api/admin-mfa-enable", method: "POST", status: 401 },
  { path: "/api/criar-pix", method: "POST", status: 401,
    body: JSON.stringify({ tipo: "subscription" }) },
  { path: "/api/webhook-mercadopago", method: "POST", status: 401,
    body: JSON.stringify({ type: "order", data: { id: "invalid" } }) },
  { path: "/api/webhook-mercadopago", method: "GET", status: 405 }
];

for (const check of requests) {
  const strict = process.env.GITHUB_REF === "refs/heads/main";
  let response;
  for (let attempt = 0; attempt < (strict ? 5 : 1); attempt++) {
    response = await fetch(origin + check.path, {
    method: check.method,
    headers: check.body ? { "Content-Type": "application/json" } : {},
    body: check.body,
    redirect: "manual",
    signal: AbortSignal.timeout(12000)
    });
    if (check.path === "/api/admin-mfa-enable" && strict &&
        response.status === 404 && attempt < 4) {
      await response.body?.cancel();
      await new Promise(resolve => setTimeout(resolve, 4000));
      continue;
    }
    break;
  }
  if (check.path === "/api/admin-mfa-enable" && !strict && response.status === 404) {
    console.log("SKIP endpoint MFA ainda não publicado na produção.");
    await response.body?.cancel();
    continue;
  }
  assert.equal(response.status, check.status,
    check.method + " " + check.path + ": esperado " + check.status +
    ", recebido " + response.status);
  if (check.path === "/") {
    assert.ok(response.headers.get("content-security-policy"), "CSP ausente");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.ok((await response.text()).includes("PD Tools"), "Página incorreta");
  } else {
    await response.body?.cancel();
  }
  console.log("OK " + check.method + " " + check.path + " -> " + response.status);
}
console.log("Smoke: 10 verificações sem autenticação/pagamento concluídas.");
