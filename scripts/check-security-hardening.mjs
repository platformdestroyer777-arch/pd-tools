// Regression tests for PD Tools admin/Premium/Pix hardening.
// Static checks are deliberately credential-free and never create payments.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file = path => readFileSync(path,"utf8");
const db=file("security/migrations/20261107_admin_audit_and_premium.sql");
const rate=file("security/migrations/20261107_admin_audit_rate_limit.sql");
const admin=file("app.js");
const audit=file("api/auditar-pix.js");
const pix=file("api/criar-pix.js");
const premium=file("premium-new-core.js");
const product=file("premium-new-productivity.js");
const media=file("premium-new-media.js");
const vercel=JSON.parse(file("vercel.json"));

// Admin writes are AAL2-only, with no "require_mfa = false" fallback.
assert.match(db,/ALTER TABLE public\.admins ALTER COLUMN require_mfa SET DEFAULT true/);
assert.match(db,/ALTER POLICY "Admins can manage tools" ON public\.tools/);
assert.match(db,/ALTER POLICY "Admins can manage settings" ON public\.site_settings/);
assert.match(db,/ALTER POLICY "PD admins can upload site assets"/);
assert.match(db,/ALTER POLICY "PD admins can update site assets"/);
assert.match(db,/ALTER POLICY "PD admins can view site assets"/);
const policies=db.split("-- Internal schema")[0];
assert.equal((policies.match(/auth\.jwt\(\)->>'aal'\) = 'aal2'/g)||[]).length,8);
assert.doesNotMatch(policies,/NOT a\.require_mfa/);
assert.match(admin,/assurance\?\.currentLevel !== "aal2"/);
assert.match(admin,/assurance\?\.nextLevel !== "aal2"/);
assert.doesNotMatch(admin,/if \(data\.require_mfa === true\)/);

// Audit events are only stored in an internal schema.
assert.match(db,/CREATE SCHEMA IF NOT EXISTS pd_internal/);
assert.match(db,/CREATE TABLE IF NOT EXISTS pd_internal\.admin_audit_log/);
assert.match(db,/ENABLE ROW LEVEL SECURITY/);
assert.match(db,/REVOKE ALL ON SCHEMA pd_internal FROM PUBLIC, anon, authenticated/);
for(const table of ["admins","tools","site_settings"]) {
 assert.match(db,new RegExp("CREATE TRIGGER pd_audit_"+table+"_change"));
}
assert.match(db,/CREATE TABLE IF NOT EXISTS pd_internal\.premium_grant_events/);

// Premium is granted by a private service-only RPC only for exactly R$ 5.
assert.match(db,/AND amount = 5\.00/);
assert.doesNotMatch(db,/AND amount >= 5\.00/);
assert.match(db,/REVOKE ALL ON FUNCTION public\.confirmar_pagamento_premium/);
assert.match(db,/GRANT EXECUTE ON FUNCTION public\.confirmar_pagamento_premium/);
assert.match(pix,/valorCentavos = 500/);
assert.match(pix,/email_confirmed_at/);

// Every new Premium action is freshly checked against /api/premium-status.
assert.match(premium,/if \(!\(await allowed\(\)\)\)/);
assert.match(premium,/\/api\/premium-status/);
assert.match(premium,/if \(busy\) return/);
assert.match(premium,/25_000_000/);
assert.match(premium,/40 \* 1024 \* 1024/);
assert.match(product,/function checkZipFiles/);
assert.equal((product.match(/checkZipFiles\(fs\);/g)||[]).length,3);
assert.match(media,/250 \* 1024 \* 1024/);

// Expensive administrative audits are throttled on the server + require AAL2.
assert.match(rate,/claim_admin_audit_slot/);
assert.match(rate,/v_attempts <= 6/);
assert.match(rate,/INTERVAL '10 minutes'/);
assert.match(audit,/assurance\.currentLevel !== "aal2"/);
assert.match(audit,/assurance\.nextLevel !== "aal2"/);
assert.match(audit,/claim_admin_audit_slot/);
assert.doesNotMatch(audit,/if \(admin\.require_mfa === true\)/);

const headerMap=new Map(vercel.headers.flatMap(x=>x.headers).map(x=>[x.key.toLowerCase(),x.value]));
assert.match(headerMap.get("strict-transport-security"),/max-age=31536000/);
assert.equal(headerMap.get("x-permitted-cross-domain-policies"),"none");

console.log("PD Tools SECURITY: AAL2, trilha admin, Pix R$5, abuso de API, expiração Premium, limites de arquivo e headers aprovados.");
