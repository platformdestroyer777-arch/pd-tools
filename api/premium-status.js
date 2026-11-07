import { createClient } from "@supabase/supabase-js";

// A validade do Premium é decidida no servidor, nunca pelo relógio do navegador.
// Importante: ferramentas inteiramente executadas no cliente ainda podem ser copiadas.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Vary", "Authorization");
  if (req.method !== "GET") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(503).json({ erro: "Serviço indisponível" });
  }

  const authorization = req.headers.authorization || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    return res.status(401).json({ erro: "Entre na sua conta" });
  }

  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
    const { data: userData, error: userError } = await client.auth.getUser(jwt);
    if (userError || !userData?.user?.id) {
      return res.status(401).json({ erro: "Sessão inválida" });
    }

    const { data, error } = await client
      .from("premium_access")
      .select("expires_at")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (error) {
      console.error("Falha ao consultar Premium:", error.message);
      return res.status(503).json({ erro: "Consulta indisponível" });
    }

    const expiration = data?.expires_at ? Date.parse(data.expires_at) : NaN;
    const active = Number.isFinite(expiration) && expiration > Date.now();

    return res.status(200).json({
      active,
      expires_at: data?.expires_at || null
    });
  } catch (error) {
    console.error("Falha ao verificar Premium:", error.message);
    return res.status(503).json({ erro: "Serviço temporariamente indisponível" });
  }
}
