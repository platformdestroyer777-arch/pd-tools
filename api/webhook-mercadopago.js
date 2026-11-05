
import {
  createHmac,
  timingSafeEqual
} from "node:crypto";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      erro: "Método não permitido"
    });
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!secret) {
    return res.status(503).json({
      erro: "Assinatura não configurada"
    });
  }

  const signature = req.headers["x-signature"];
  const requestId = req.headers["x-request-id"];

  const queryId = req.query["data.id"];
  const dataId = Array.isArray(queryId)
    ? queryId[0]
    : queryId;

  if (
    typeof signature !== "string" ||
    typeof requestId !== "string" ||
    typeof dataId !== "string" ||
    !dataId
  ) {
    return res.status(401).json({
      erro: "Notificação não autenticada"
    });
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
    return res.status(401).json({
      erro: "Assinatura inválida"
    });
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
    return res.status(401).json({
      erro: "Assinatura inválida"
    });
  }

  // Assinatura validada.
  // Ainda não confirma pagamentos nem libera Premium.
  return res.status(200).json({
    sucesso: true,
    mensagem: "Notificação autenticada"
  });
}
