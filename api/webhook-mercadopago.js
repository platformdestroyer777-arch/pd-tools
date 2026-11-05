
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      erro: "Método não permitido"
    });
  }

  // Ainda não processar notificações nem liberar Premium.
  // A validação da assinatura do Mercado Pago
  // será implementada antes de ativar o webhook.

  return res.status(503).json({
    erro: "Webhook em preparação"
  });
}
