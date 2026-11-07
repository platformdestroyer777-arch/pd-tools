import { createClient } from "@supabase/supabase-js";

// Habilita MFA para uma conta já administrativa — NUNCA promove usuários.
// Executa só depois do Auth validar sessão AAL2 e um fator verificado.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const bearer = req.headers.authorization || "";
  if (!/^Bearer\s+\S+$/i.test(bearer)) {
    return res.status(401).json({ erro: "Sessão necessária" });
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ erro: "Serviço indisponível" });

  try {
    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const token = bearer.replace(/^Bearer\s+/i, "").trim();
    const { data: identity, error: identityError } = await client.auth.getUser(token);
    const id = identity?.user?.id;
    if (identityError || !id) {
      return res.status(401).json({ erro: "Sessão inválida ou expirada" });
    }

    // AAL2 precisa ser atual e continuar exigido (não usar JWT stale).
    const { data: levels, error: levelError } =
      await client.auth.mfa.getAuthenticatorAssuranceLevel(token);
    if (levelError || !levels) {
      return res.status(503).json({ erro: "Verificação do segundo fator indisponível" });
    }
    if (levels.currentLevel !== "aal2" || levels.nextLevel !== "aal2") {
      return res.status(403).json({ erro: "Confirme um fator TOTP ativo" });
    }

    const { data: admin, error: adminError } = await client
      .from("admins")
      .select("user_id,require_mfa")
      .eq("user_id", id)
      .maybeSingle();

    if (adminError) return res.status(503).json({ erro: "Consulta de autorização indisponível" });
    if (!admin) return res.status(403).json({ erro: "Conta não é administradora" });
    if (admin.require_mfa === true) {
      return res.status(200).json({ enabled: true });
    }

    // Só pode marcar true; não expõe operação de remover MFA nem mudar admin.
    const { data: changed, error: changeError } = await client
      .from("admins")
      .update({ require_mfa: true })
      .eq("user_id", id)
      .eq("require_mfa", false)
      .select("require_mfa")
      .maybeSingle();
    if (changeError) return res.status(503).json({ erro: "Não foi possível ativar o 2FA" });

    if (changed?.require_mfa === true) return res.status(200).json({ enabled: true });

    const { data: now } = await client.from("admins")
      .select("require_mfa").eq("user_id", id).maybeSingle();
    if (now?.require_mfa === true) return res.status(200).json({ enabled: true });
    return res.status(503).json({ erro: "Ativação ainda não confirmada" });
  } catch (error) {
    console.error("Falha no MFA administrativo:", error?.message);
    return res.status(503).json({ erro: "Falha temporária na autenticação" });
  }
}
