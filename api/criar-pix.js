
import { createClient } from "@supabase/supabase-js";

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
    const mercadoPagoToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!supabaseUrl || !supabaseKey || !mercadoPagoToken) {
      return res.status(500).json({
        erro: "Configuração do servidor incompleta"
      });
    }

    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        erro: "Você precisa estar logado para gerar um Pix"
      });
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
      return res.status(401).json({
        erro: "Sessão inválida"
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data?.user) {
      return res.status(401).json({
        erro: "Sua sessão expirou. Entre novamente"
      });
    }

    // Login validado pelo Supabase.
    // Ainda não criamos cobranças nesta etapa.
    return res.status(503).json({
      erro: "Pix em preparação",
      autenticado: true,
      valor: 5,
      moeda: "BRL",
      duracao_dias: 30
    });

  } catch (error) {
    console.error("Erro na API Pix:", error.message);

    return res.status(500).json({
      erro: "Erro interno ao preparar o Pix"
    });
  }
}
