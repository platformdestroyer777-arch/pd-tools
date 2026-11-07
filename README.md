# PD Tools — Platform Destroyer

Site de ferramentas gratuitas e Premium, com hospedagem estática na Vercel, autenticação e dados no Supabase e cobrança Pix pelo Mercado Pago.

## Estrutura
- `index.html`, `style.css`, `fixes.css`, `app.js`: interface e ferramentas gratuitas.
- `premium-filter.js` e `premium-*.js`: catálogo e processamento local das 15 ferramentas Premium.
- `premium-auth.js`: autenticação e tela de assinatura.
- `payments-ui.js` e `popups-ui.js`: pagamentos e avisos (sem JavaScript inline).
- `api/criar-pix.js`: criação autenticada de cobranças (Premium R$ 5,00 / 30 dias; doação separada).
- `api/webhook-mercadopago.js`: validação assinada e confirmação com a API do Mercado Pago.
- `api/premium-status.js`: validade do Premium baseada no relógio do servidor.
- `supabase/migrations/20261107_pix_rate_limit.sql`: limite atômico de Pix por usuário.

## Publicação segura (obrigatória)
1. Testar em uma implantação de Preview da Vercel.
2. **ANTES de publicar as novas APIs de pagamentos**, executar `supabase/migrations/20261107_pix_rate_limit.sql` no SQL Editor do Supabase.
3. Confirmar no Supabase as políticas RLS de `admins`, `tools`, `site_settings`, `premium_access` e `premium_payments`.
4. Configurar somente no servidor: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`. Não expor segredos no navegador.
5. No Mercado Pago, configurar o webhook de Orders para `https://pdtools.vercel.app/api/webhook-mercadopago` com assinatura de produção.
6. Validar login, administração, Pix real, confirmação automática, duração de 30 dias, doações, PDFs/imagens/OCR e as ferramentas nos navegadores.
7. Checar os avisos de Content-Security-Policy-Report-Only no console antes de endurecer `connect-src`.

## Segurança e limitações
- A chave publicável do Supabase no cliente é esperada; **segredos nunca são públicos**. RLS controla o banco.
- O Premium agora é consultado no servidor, eliminando a dependência do relógio do navegador para a tela. **As ferramentas continuam implementadas em JavaScript público, que pode ser copiado ou modificado**. Proteger comercialmente o processamento exige migrar as operações pagas para o servidor; não há solução completa por ocultação de botões.
- O rate limit implementado é por usuário autenticado. Proteções adicionais contra múltiplas contas, IPs e bots dependem de WAF/regras de infraestrutura.
- Doações não liberam Premium, independentemente do valor.
- As ferramentas que usam serviços externos enviam dados a esses provedores; evite textos confidenciais no corretor ortográfico.
- Não há garantia de segurança absoluta: recomenda-se monitoramento e testes periódicos.

## Testes e checklist
Consulte `docs/SEGURANCA-VALIDACAO.md`. Os testes com banco e pagamentos reais exigem ambiente de homologação e autorização do proprietário.
