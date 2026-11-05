
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

    // Validar o valor recebido.
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

    const valorCentavos = Math.round(Number(valorTexto) * 100);

    if (
      !Number.isSafeInteger(valorCentavos) ||
      valorCentavos < 10 ||
      valorCentavos > 10000000
    ) {
      return res.status(400).json({
        erro: "O valor deve estar entre R$ 0,10 e R$ 100.000,00"
      });
    }

    const valorFormatado = (valorCentavos / 100).toFixed(2);

    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        erro: "Faça login para gerar o Pix"
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const accessToken = authorization.slice(7).trim();

    const { data, error } =
      await supabase.auth.getUser(accessToken);

    if (error || !data?.user) {
      return res.status(401).json({
        erro: "Sessão inválida ou expirada"
      });
    }

    const user = data.user;
    const paymentId = randomUUID();

    const { error: dbError } = await supabase
      .from("premium_payments")
      .insert({
        id: paymentId,
        user_id: user.id,
        amount: valorFormatado,
        currency: "BRL",
        status: "pending"
      });

    if (dbError) {
      console.error("Erro ao registrar pagamento:", dbError.message);

      return res.status(500).json({
        erro: "Não foi possível preparar o pagamento"
      });
    }

    const mpResponse = await fetch(
      "https://api.mercadopago.com/v1/orders",
      {
        method: "POST",
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

    const payment = mpData.transactions?.payments?.[0];

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
      console.error("Erro ao salvar order:", updateError.message);

      return res.status(500).json({
        erro: "Pagamento criado, mas não foi possível registrá-lo"
      });
    }

    return res.status(200).json({
      sucesso: true,
      pagamento_id: paymentId,
      valor: valorCentavos / 100,
      moeda: "BRL",
      premium_elegivel: valorCentavos >= 500,
      qr_code: payment?.payment_method?.qr_code || null,
      qr_code_base64:
        payment?.payment_method?.qr_code_base64 || null,
      ticket_url:
        payment?.payment_method?.ticket_url || null,
      status: mpData.status
    });

  } catch (error) {
    console.error("Erro ao criar Pix:", error.message);

    return res.status(500).json({
      erro: "Erro interno ao gerar o Pix"
    });
  }
}
