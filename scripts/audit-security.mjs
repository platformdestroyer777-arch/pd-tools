// Security smoke — non-destructive. No real accounts, payments or secrets.
import assert from "node:assert/strict";

const origin=process.env.PD_AUDIT_ORIGIN||"https://pd-tools-eight.vercel.app";
const validId="00000000-0000-4000-8000-000000000000";
const attacks=[
 ["GET", "/", 200,null],
 ["GET", "/api/premium-status",401,null],
 ["POST","/api/premium-status",405,"{}"],
 ["GET", "/api/premium-status?user_id=11111111-1111-4111-8111-111111111111",401,null],
 ["GET", "/api/premium-status",401,null,{"Authorization":"Bearer forged.jwt.value"}],
 ["POST","/api/admin-mfa-enable",401,"{}"],
 ["POST","/api/admin-mfa-enable",401,"{}",{"Authorization":"Bearer forged.jwt.value"}],
 ["GET","/api/admin-mfa-enable",405,null],
 ["POST","/api/auditar-pix",401,"{}"],
 ["POST","/api/auditar-pix",401,"{}",{"Authorization":"Bearer forged.jwt.value"}],
 ["GET","/api/auditar-pix",405,null],
 ["POST","/api/criar-pix",401,'{"tipo":"subscription"}'],
 ["POST","/api/criar-pix",401,'{"tipo":"donation","valor":5.00}'],
 ["POST","/api/criar-pix",401,'{"tipo":"subscription","valor":0.01,"role":"service_role"}'],
 ["POST","/api/criar-pix",400,'{"tipo":"__proto__","valor":5}'],
 ["POST","/api/criar-pix",400,'{"tipo":"donation","valor":-99}'],
 ["POST","/api/criar-pix",400,'{"tipo":"donation","valor":1e300}'],
 ["POST","/api/criar-pix",400,'{"tipo":"donation","valor":"1; DROP TABLE tools;--"}'],
 ["POST","/api/consultar-pix",401,JSON.stringify({pagamento_id:validId})],
 ["POST","/api/consultar-pix",400,'{"pagamento_id":"\\u0027 OR 1=1 --"}',{"Authorization":"Bearer forged.jwt.value"}],
 ["POST","/api/consultar-pix",401,JSON.stringify({pagamento_id:validId}),{"Authorization":"Bearer forged.jwt.value"}],
 ["GET","/api/consultar-pix",405,null],
 ["POST","/api/webhook-mercadopago",401,'{"data":{"id":"123456"}}'],
 ["POST","/api/webhook-mercadopago?data.id=123456",401,'{"data":{"id":"123456"}}',{"x-signature":"ts=1690000000,v1=abcdef","x-request-id":"fake"}],
 ["POST","/api/webhook-mercadopago?data.id=123456",401,'{"data":{"id":"123456"}}',{"x-signature":"ts=1794030000,v1="+("0".repeat(64)),"x-request-id":"fake"}],
 ["GET","/api/webhook-mercadopago",405,null],
 ["GET","/.env",404,null],
 ["GET","/.git/config",404,null],
 ["GET","/api/unknown-endpoint",404,null]
];
const checks=[];
for(const [method,path,expected,body,customHeaders={}] of attacks){
 const h={...customHeaders};if(body!==null)h["Content-Type"]="application/json";
 let response;
 try{response=await fetch(origin+path,{method,headers:h,body,redirect:"manual",signal:AbortSignal.timeout(10000)})}
 catch(err){throw Error(method+" "+path+" network error: "+err.message)}
 const st=response.status;
 if(method==="GET"&&path==="/"){
  assert.ok(response.headers.get("content-security-policy"),"CSP ausente");
  assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  assert.equal(response.headers.get("x-frame-options"),"DENY");
 }
 assert.equal(st,expected,method+" "+path+" esperava "+expected+" e obteve "+st);
 // Never log user or payment data.
 checks.push(method+" "+path+" => "+st);
 await response.body?.cancel();
}
console.log("AUDITORIA API: "+checks.length+" chamadas controladas. Todas tiveram o bloqueio esperado.");
for(const item of checks)console.log(item);
