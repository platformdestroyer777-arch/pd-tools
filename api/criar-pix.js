
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      erro: "Método não permitido"
    });
  }

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!token) {
    return res.status(500).json({
      erro: "Token do Mercado Pago não configurado"
    });
  }

  // Enquanto não houver validação de login e integração
  // com o Supabase, não criar cobranças reais.
  return res.status(503).json({
    erro: "Integração Pix em preparação",
    ambiente: "teste",
    valor: 5,
    moeda: "BRL"
  });
}
// Teste de deploy Preview - PD Tools
