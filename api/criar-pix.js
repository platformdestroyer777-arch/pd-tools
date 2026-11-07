
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      erro: "Método não permitido"
    });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!supabaseUrl || !supabaseKey || !mpToken) {
      return res.status(500).json({
        erro: "Configuração do servidor incompleta"
      });
    }

    // Identificar a modalidade de pagamento.
    const tipo = req.body?.tipo || "donation";

    if (!["subscription", "donation"].includes(tipo)) {
      return res.status(400).json({
        erro: "Tipo de pagamento inválido"
      });
    }

    let valorCentavos;

    if (tipo === "subscription") {
      // Premium: valor fixo de R$ 5,00.
      valorCentavos = 500;
    } else {
      // Doações: valor livre.
      const valor = req.body?.valor;

      if (
        typeof valor !== "number" &&
        typeof valor !== "string"
      ) {
        return res.status(400).json({
          erro: "Informe um valor válido"
        });
      }

      const valorTexto = String(valor);

      if (!/^\d+(?:\.\d{1,2})?$/.test(valorTexto)) {
        return res.status(400).json({
          erro: "Informe um valor com até duas casas decimais"
        });
      }

      valorCentavos = Math.round(Number(valorTexto) * 100);

      if (
        !Number.isSafeInteger(valorCentavos) ||
        valorCentavos < 10 ||
        valorCentavos > 10000000
      ) {
        return res.status(400).json({
          erro: "O valor deve estar entre R$ 0,10 e R$ 100.000,00"
        });
      }
    }

    const valorFormatado =
      (valorCentavos / 100).toFixed(2);

    // Validar autenticação.
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        erro: "Faça login para continuar"
      });
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const accessToken = authorization.slice(7).trim();

    const { data, error } =
      await supabase.auth.getUser(accessToken);

    if (error || !data?.user) {
      return res.status(401).json({
        erro: "Sessão inválida ou expirada"
      });
    }

    const user = data.user;

    if (!user.email || !user.email_confirmed_at) {
      return res.status(403).json({
        erro: "Confirme o e-mail da sua conta antes de gerar um Pix"
      });
    }

    // Proteção transacional contra abuso: 4 Pix/10min e 24 Pix/24h por usuário.
    // Esta função deve ser instalada no Supabase antes do deploy.
    const { data: slotAllowed, error: slotError } = await supabase.rpc(
      "claim_pix_checkout_slot", { p_user_id: user.id }
    );
    if (slotError) {
      console.error("Rate limit indisponível:", slotError.message);
      return res.status(503).json({ erro: "Proteção de pagamentos indisponível" });
    }
    if (slotAllowed !== true) {
      res.setHeader("Retry-After", "600");
      return res.status(429).json({
        erro: "Muitas cobranças recentes. Aguarde antes de gerar outro Pix."
      });
    }

    const paymentId = randomUUID();

    // Registrar o pagamento com seu tipo correto.
    const { error: dbError } = await supabase
      .from("premium_payments")
      .insert({
        id: paymentId,
        user_id: user.id,
        provider: "mercadopago",
        amount: valorFormatado,
        currency: "BRL",
        status: "pending",
        payment_type: tipo
      });

    if (dbError) {
      console.error(
        "Erro ao registrar pagamento:",
        dbError.message
      );

      return res.status(500).json({
        erro: "Não foi possível preparar o pagamento"
      });
    }

    // Criar cobrança no Mercado Pago.
    const mpResponse = await fetch(
      "https://api.mercadopago.com/v1/orders",
      {
        method: "POST",
        signal: AbortSignal.timeout(12000),
        headers: {
          Authorization: `Bearer ${mpToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Idempotency-Key": paymentId
        },
        body: JSON.stringify({
          type: "online",
          total_amount: valorFormatado,
          external_reference: paymentId,
          processing_mode: "automatic",
          transactions: {
            payments: [
              {
                amount: valorFormatado,
                payment_method: {
                  id: "pix",
                  type: "bank_transfer"
                }
              }
            ]
          },
          payer: {
            email: user.email
          }
        })
      }
    );

    const mpData = await mpResponse.json();

    if (!mpResponse.ok || !mpData.id) {
      console.error("Mercado Pago:", {
        status: mpResponse.status,
        message: mpData.message,
        errors: mpData.errors
      });

      return res.status(502).json({
        erro: "Mercado Pago não conseguiu gerar o Pix",
        codigo: mpResponse.status
      });
    }

    const payment =
      mpData.transactions?.payments?.[0];

    // Salvar os identificadores da cobrança.
    const { error: updateError } = await supabase
      .from("premium_payments")
      .update({
        provider_order_id: String(mpData.id),
        provider_payment_id: payment?.id
          ? String(payment.id)
          : null
      })
      .eq("id", paymentId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error(
        "Erro ao salvar order:",
        updateError.message
      );

      return res.status(500).json({
        erro: "Pagamento criado, mas não foi possível registrá-lo"
      });
    }

    return res.status(200).json({
      sucesso: true,
      pagamento_id: paymentId,
      tipo: tipo,
      valor: valorCentavos / 100,
      moeda: "BRL",
      premium_elegivel: tipo === "subscription",
      qr_code:
        payment?.payment_method?.qr_code || null,
      qr_code_base64:
        payment?.payment_method?.qr_code_base64 || null,
      ticket_url:
        payment?.payment_method?.ticket_url || null,
      status: mpData.status
    });

  } catch (error) {
    console.error(
      "Erro ao criar Pix:",
      error.message
    );

    return res.status(500).json({
      erro: "Erro interno ao gerar o Pix"
    });
  }
}
