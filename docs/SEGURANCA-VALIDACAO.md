# PD Tools — Segurança / critérios antes da publicação

Esta alteração é preparada em uma branch separada da produção. Não faça merge antes das etapas abaixo.

## ATENÇÃO: aplicar SQL primeiro
1. Fazer backup do banco e testar no ambiente de homologação.
2. Executar `supabase/migrations/20261107_pix_rate_limit.sql` no SQL Editor do Supabase **ANTES** de publicar as novas APIs.
3. Confirmar EXECUTE para `service_role` e negar para `anon` e `authenticated` nas funções `claim_pix_checkout_slot(uuid)` e `claim_pix_status_slot(uuid)`.
4. A API de criar Pix falha propositalmente com **503** se a migração estiver ausente (proteção fail-closed).
5. Confirmar que as variáveis da Vercel estão configuradas para produção sem expor seus valores: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`.

## Itens da segunda auditoria
- **P-01:** Premium consultado pelo servidor (não usa Date.now do navegador). **Parcial:** o código de ferramentas executadas inteiramente no cliente continua copiável.
- **P-02:** scripts HTML externalizados, `script-src` sem `unsafe-inline`; `connect-src` mais restrito em `Content-Security-Policy-Report-Only` até validar todas as bibliotecas.
- **P-03:** rate limit atômico por usuário: até 4 Pix por 10 min e até 24 Pix por 24h. **Requer migração SQL**. Ainda é recomendado WAF/IP para múltiplas contas.
- **P-04:** webhook vincula IDs de order/Pix recebidos antes da gravação; botão `Já paguei? Verificar pagamento` faz checagem autenticada na API Mercado Pago. Limite de 12 consultas/10 min por usuário.
- **P-05:** ferramentas padrão renderizam mesmo se o Supabase CDN estiver indisponível; autenticação segue dependente do serviço.
- **P-06:** ferramentas gratuitas recebem foco com Tab e ativação por Enter/Espaço.
- **P-07:** webhook rejeita timestamps assinados fora de ±7 dias; reenvios antigos podem precisar de conciliação.
- **P-08:** SVG removido do painel, extensões vinculadas a MIME; favicon e imagem compartilhada exigem PNG.
- **P-09:** SDK Supabase fixado em 2.119.0. **Parcial:** falta lockfile/SRI e auditoria completa das importações dinâmicas.
- **P-10:** README atualizado e `itemap.xml` errado removido; `sitemap.xml` correto mantido.
- **P-11:** aviso de dados enviados ao LanguageTool reforçado.
- **P-12:** QR para API limitado a 2048 caracteres e exceções tratadas.
- **P-13:** **PENDENTE DE REARQUITETURA:** mover algoritmos pagos do navegador para o backend, se o objetivo for impedir cópia/uso fora do site. Consulta server-side não torna código JS público secreto.
- **P-14:** testes reais em produção ainda pendentes.

## Testes obrigatórios em Preview
- Anônimo: ferramentas gratuitas, filtros, busca, Premium bloqueado.
- Usuário com Premium expirado: relógio do navegador alterado **não** libera via API.
- Premium ativo: acesso às 15 ferramentas, validade por 30 dias e funcionamento dos algoritmos.
- Admin real: acesso ao painel, gravação de ferramentas, PNG/JPEG/WebP para logos, SVG rejeitado.
- Criar Pix: login exigido, assinatura R$5, doações separadas, rate limit 429 e resposta Retry-After.
- Webhook: HMAC inválido/antigo 401; pagamentos com ID/valor divergente não concedem acesso.
- Confirmar Pix: botão verifica diretamente a cobrança no Mercado Pago, e repetição não aumenta 30 dias.
- CSP no console: verificar QR, OCR, PDF, remover fundo, fontes, formatação, banco e pagamentos.
- Mobile: teclado, Escape nos modais e responsividade.
- Conferir headers HTTP reais, robots.txt e sitemap.xml na Vercel.

Nenhuma assinatura, banco ou pagamento real foi alterado por esta branch. A execução da migração e testes reais dependem da aprovação do responsável pelo projeto.
