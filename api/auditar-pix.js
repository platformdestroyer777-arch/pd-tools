import { createClient } from "@supabase/supabase-js";

// Diagnóstico administrativo somente de leitura.
// Não libera, cancela, reembolsa ou modifica qualquer pagamento.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization");
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const authHeader = req.headers.authorization || "";
  if (!/^Bearer\s+\S+$/i.test(authHeader)) {
    return res.status(401).json({ erro: "Sessão necessária" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!url || !key || !mpToken) {
    return res.status(503).json({ erro: "Configuração de servidor incompleta" });
  }

  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: identity, error: authError } = await client.auth.getUser(token);
    const userId = identity?.user?.id;
    if (authError || !userId) {
      return res.status(401).json({ erro: "Sessão inválida" });
    }

    const { data: admin, error: adminError } = await client
      .from("admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (adminError) {
      console.error("Falha ao verificar admin Pix:", adminError.message);
      return res.status(503).json({ erro: "Falha na autorização" });
    }
    if (!admin) return res.status(403).json({ erro: "Acesso administrativo necessário" });

    const { data: pending, error: paymentError, count } = await client
      .from("premium_payments")
      .select("provider_order_id,payment_type,created_at", { count: "exact" })
      .eq("provider", "mercadopago")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(15);

    if (paymentError) {
      console.error("Falha ao listar Pix pendentes:", paymentError.message);
      return res.status(503).json({ erro: "Falha ao consultar pagamentos" });
    }

    const summary = {
      total_pendentes: count ?? pending?.length ?? 0,
      analisados: pending?.length ?? 0,
      creditados: 0,
      ainda_pendentes: 0,
      cancelados_ou_rejeitados: 0,
      inconclusivos: 0,
      falhas_consulta: 0,
      // Todos os dados enviados ao navegador são agregados; sem IDs ou informações pessoais.
      observacao: "Auditoria de leitura; nenhum pagamento foi alterado."
    };

    await Promise.all((pending || []).map(async payment => {
      if (!payment.provider_order_id) {
        summary.inconclusivos++;
        return;
      }
      try {
        const response = await fetch(
          `https://api.mercadopago.com/v1/orders/${encodeURIComponent(payment.provider_order_id)}`,
          {
            headers: { Authorization: `Bearer ${mpToken}`, Accept: "application/json" },
            signal: AbortSignal.timeout(7000)
          }
        );
        if (!response.ok) {
          summary.falhas_consulta++;
          return;
        }
        const order = await response.json();
        if (String(order.id) !== String(payment.provider_order_id)) {
          summary.inconclusivos++;
        } else if (order.status === "processed" && order.status_detail === "accredited") {
          summary.creditados++;
        } else if (["cancelled", "canceled", "rejected", "expired"].includes(order.status)) {
          summary.cancelados_ou_rejeitados++;
        } else {
          summary.ainda_pendentes++;
        }
      } catch (error) {
        console.error("Falha de consulta de pedido Pix:", error.message);
        summary.falhas_consulta++;
      }
    }));

    return res.status(200).json({ sucesso: true, ...summary });
  } catch (error) {
    console.error("Falha na auditoria administrativa Pix:", error.message);
    return res.status(503).json({ erro: "Serviço temporariamente indisponível" });
  }
}
