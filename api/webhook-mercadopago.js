
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret || !mpToken || !supabaseUrl || !supabaseKey) {
    return res.status(503).json({ erro: "Configuração incompleta" });
  }

  // 1. Validar a assinatura da notificação.
  const signature = req.headers["x-signature"];
  const requestId = req.headers["x-request-id"];
  const queryId = req.query["data.id"];
  const dataId = Array.isArray(queryId) ? queryId[0] : queryId;

  if (
    typeof signature !== "string" ||
    typeof requestId !== "string" ||
    typeof dataId !== "string" ||
    !dataId
  ) {
    return res.status(401).json({ erro: "Notificação inválida" });
  }

  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const index = part.indexOf("=");
      return [
        part.slice(0, index).trim(),
        part.slice(index + 1).trim()
      ];
    })
  );

  const { ts, v1 } = parts;

  if (
    !/^\d{10,16}$/.test(ts || "") ||
    !/^[a-f0-9]{64}$/i.test(v1 || "")
  ) {
    return res.status(401).json({ erro: "Assinatura inválida" });
  }

  const manifest =
    `id:${dataId.toLowerCase()};` +
    `request-id:${requestId};` +
    `ts:${ts};`;

  const expected = createHmac("sha256", secret)
    .update(manifest)
    .digest();

  const received = Buffer.from(v1, "hex");

  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    return res.status(401).json({ erro: "Assinatura inválida" });
  }

  // 2. Consultar a order diretamente no Mercado Pago.
  try {
    const response = await fetch(
      `https://api.mercadopago.com/v1/orders/${encodeURIComponent(dataId)}`,
      {
        headers: {
          Authorization: `Bearer ${mpToken}`,
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      console.error("Falha ao consultar order:", response.status);
      return res.status(503).json({ erro: "Consulta indisponível" });
    }

    const order = await response.json();

    if (String(order.id) !== dataId) {
      return res.status(400).json({ erro: "Order divergente" });
    }

    // Somente pagamentos creditados são aprovados.
    if (
      order.status !== "processed" ||
      order.status_detail !== "accredited"
    ) {
      return res.status(200).json({
        sucesso: true,
        mensagem: "Pagamento ainda não aprovado"
      });
    }

    if (
      Number(order.total_amount) !== 5 ||
      Number(order.total_paid_amount) !== 5 ||
      typeof order.external_reference !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(
        order.external_reference
      )
    ) {
      return res.status(400).json({
        erro: "Dados do pagamento divergentes"
      });
    }

    const payments = order.transactions?.payments;

    if (!Array.isArray(payments) || payments.length !== 1) {
      return res.status(400).json({
        erro: "Transações inválidas"
      });
    }

    const payment = payments[0];

    if (
      payment.status !== "processed" ||
      payment.status_detail !== "accredited" ||
      payment.payment_method?.id !== "pix" ||
      Number(payment.amount) !== 5 ||
      Number(payment.paid_amount) !== 5 ||
      !payment.id
    ) {
      return res.status(400).json({
        erro: "Pagamento Pix não confirmado"
      });
    }

    // 3. Conferir o pagamento registrado no Supabase.
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: registro, error: consultaErro } = await supabase
      .from("premium_payments")
      .select("id, status, provider_order_id, provider_payment_id")
      .eq("id", order.external_reference)
      .eq("provider", "mercadopago")
      .eq("amount", 5)
      .eq("currency", "BRL")
      .maybeSingle();

    if (consultaErro) {
      console.error("Erro na consulta Supabase:", consultaErro.message);
      return res.status(503).json({ erro: "Consulta indisponível" });
    }

    if (
      !registro ||
      registro.provider_order_id !== String(order.id) ||
      registro.provider_payment_id !== String(payment.id)
    ) {
      return res.status(400).json({
        erro: "Pagamento não corresponde ao registro"
      });
    }

    if (registro.status === "approved") {
      return res.status(200).json({
        sucesso: true,
        mensagem: "Pagamento já processado"
      });
    }

    if (registro.status !== "pending") {
      return res.status(409).json({
        erro: "Pagamento não está pendente"
      });
    }

    // 4. Confirmar e liberar 30 dias de forma atômica.
    const { data: liberado, error: rpcErro } = await supabase.rpc(
      "confirmar_pagamento_premium",
      {
        p_payment_id: registro.id,
        p_provider_order_id: String(order.id),
        p_provider_payment_id: String(payment.id)
      }
    );

    if (rpcErro) {
      console.error("Erro ao liberar Premium:", rpcErro.message);
      return res.status(503).json({
        erro: "Não foi possível confirmar o Premium"
      });
    }

    return res.status(200).json({
      sucesso: true,
      premium_liberado: liberado === true
    });
  } catch (error) {
    console.error("Erro no webhook:", error.message);
    return res.status(503).json({
      erro: "Erro temporário ao processar notificação"
    });
  }
}
