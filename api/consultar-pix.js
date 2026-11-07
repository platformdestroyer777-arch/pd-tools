import { createClient } from "@supabase/supabase-js";

const money = value => {
  if (!/^[0-9]+(?:\\.[0-9]{1,2})?$/.test(String(value))) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization");
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });

  const authorization = req.headers.authorization || "";
  const id = req.body?.pagamento_id;
  if (!/^Bearer\\s+\\S+$/i.test(authorization)) {
    return res.status(401).json({ erro: "Entre na sua conta" });
  }
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ erro: "Identificador inválido" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!url || !key || !mpToken) {
    return res.status(503).json({ erro: "Servidor temporariamente indisponível" });
  }

  try {
    const db = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const jwt = authorization.replace(/^Bearer\\s+/i, "").trim();
    const { data: identity, error: identityError } = await db.auth.getUser(jwt);
    const userId = identity?.user?.id;
    if (identityError || !userId) return res.status(401).json({ erro: "Sessão inválida" });

    const { data: allowed, error: rateError } = await db.rpc(
      "claim_pix_status_slot", { p_user_id: userId }
    );
    if (rateError) {
      console.error("Consulta Pix sem proteção:", rateError.message);
      return res.status(503).json({ erro: "Consulta de pagamento indisponível" });
    }
    if (allowed !== true) {
      res.setHeader("Retry-After", "600");
      return res.status(429).json({ erro: "Aguarde para verificar novamente" });
    }

    const { data: record, error: recordError } = await db
      .from("premium_payments")
      .select("id,user_id,provider,provider_order_id,provider_payment_id,amount,currency,status,payment_type")
      .eq("id", id).eq("user_id", userId).eq("provider", "mercadopago")
      .maybeSingle();

    if (recordError) {
      console.error("Falha ao consultar Pix:", recordError.message);
      return res.status(503).json({ erro: "Consulta indisponível" });
    }
    if (!record) return res.status(404).json({ erro: "Pagamento não encontrado" });
    if (record.status === "approved") {
      return res.status(200).json({
        sucesso: true, status: "approved",
        premium_liberado: record.payment_type === "subscription"
      });
    }
    if (record.status !== "pending") {
      return res.status(200).json({ sucesso: true, status: record.status, premium_liberado: false });
    }
    if (!record.provider_order_id) {
      return res.status(202).json({ sucesso: true, status: "pending", premium_liberado: false });
    }

    // Apenas a API do Mercado Pago pode provar que houve um Pix creditado.
    const remote = await fetch(
      `https://api.mercadopago.com/v1/orders/${encodeURIComponent(record.provider_order_id)}`,
      { headers: { Authorization: `Bearer ${mpToken}`, Accept: "application/json" } }
    );
    if (!remote.ok) {
      console.error("Falha MP na conciliação:", remote.status);
      return res.status(503).json({ erro: "Mercado Pago indisponível" });
    }

    const order = await remote.json();
    if (order.status !== "processed" || order.status_detail !== "accredited") {
      return res.status(202).json({ sucesso: true, status: "pending", premium_liberado: false });
    }

    const payments = order.transactions?.payments;
    if (!Array.isArray(payments) || payments.length !== 1) {
      return res.status(400).json({ erro: "Dados do pagamento divergentes" });
    }
    const payment = payments[0];
    const amount = money(record.amount);
    if (
      String(order.id) !== String(record.provider_order_id) ||
      String(order.external_reference) !== id ||
      record.currency !== "BRL" ||
      (order.currency_id && order.currency_id !== "BRL") ||
      !["subscription", "donation"].includes(record.payment_type) ||
      !payment.id ||
      (record.provider_payment_id && String(record.provider_payment_id) !== String(payment.id)) ||
      order.status !== "processed" || order.status_detail !== "accredited" ||
      payment.status !== "processed" || payment.status_detail !== "accredited" ||
      payment.payment_method?.id !== "pix" ||
      amount === null || amount < 10 || amount > 10000000 ||
      money(order.total_amount) !== amount ||
      money(order.total_paid_amount) !== amount ||
      money(payment.amount) !== amount ||
      money(payment.paid_amount) !== amount
    ) {
      return res.status(400).json({ erro: "Dados do pagamento divergentes" });
    }

    if (!record.provider_payment_id) {
      const { error: bindError } = await db.from("premium_payments")
        .update({ provider_payment_id: String(payment.id) })
        .eq("id", id).eq("user_id", userId).eq("status", "pending")
        .is("provider_payment_id", null);
      if (bindError) {
        return res.status(503).json({ erro: "Não foi possível conciliar o Pix" });
      }
    }

    if (record.payment_type === "donation") {
      const { error: donationError } = await db.from("premium_payments")
        .update({ status: "approved", paid_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", userId).eq("status", "pending");
      if (donationError) {
        return res.status(503).json({ erro: "Falha ao confirmar doação" });
      }
      return res.status(200).json({ sucesso: true, status: "approved", premium_liberado: false });
    }

    if (amount !== 500) return res.status(400).json({ erro: "Valor Premium incorreto" });
    const { data: granted, error: grantError } = await db.rpc(
      "confirmar_pagamento_premium", {
        p_payment_id: id,
        p_provider_order_id: String(order.id),
        p_provider_payment_id: String(payment.id)
      }
    );
    if (grantError) {
      console.error("Falha ao confirmar Premium:", grantError.message);
      return res.status(503).json({ erro: "Falha ao liberar Premium" });
    }
    if (granted === true) {
      return res.status(200).json({ sucesso: true, status: "approved", premium_liberado: true });
    }
    // Outra tentativa pode ter confirmado a mesma order em paralelo.
    const { data: latest } = await db.from("premium_payments")
      .select("status").eq("id", id).eq("user_id", userId).maybeSingle();
    if (latest?.status === "approved") {
      return res.status(200).json({ sucesso: true, status: "approved", premium_liberado: true });
    }
    return res.status(503).json({ erro: "Confirmação pendente de reprocessamento" });
  } catch (error) {
    console.error("Erro ao conciliar Pix:", error.message);
    return res.status(503).json({ erro: "Erro temporário ao verificar Pix" });
  }
}
