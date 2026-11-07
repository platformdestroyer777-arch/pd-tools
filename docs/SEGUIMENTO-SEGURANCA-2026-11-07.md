# PD Tools — Continuação das correções de estabilidade e segurança

Este complemento não altera pagamentos ou acesso Premium existente.

## Implementado
- Catálogo de contingência com as 80 ferramentas cadastradas em 7/11/2026, em `tools-fallback.js`. O Supabase continua prevalecendo quando responde. Uma alteração futura das ferramentas via painel requer atualizar o snapshot se for preciso preservar a mesma lista em modo offline.
- Proteção contra exceções na inicialização Premium quando o SDK do Supabase não é carregado. A aba Premium fica indisponível até o serviço voltar; botão da conta mostra erro claro.
- `premium-filter.js`, `premium-qrcode.js`, `premium-image-batch.js`, `premium-watermark.js`, `premium-extras.js` e `premium-auth.js` usam o endpoint autenticado `/api/premium-status` para verificar a validade — sem depender do relógio local.
- Cadastro no site exige senha com 12+ caracteres e combinação de maiúscula, minúscula, número e símbolo. **Essa validação do navegador não substitui os controles de senha do Supabase Auth**.
- Endpoint `/api/auditar-pix` consulta, em modo exclusivamente leitura, até 15 pedidos pendentes diretamente no Mercado Pago. Autorização exige sessão Supabase válida E cadastro em `admins`. Resposta contém apenas contadores, sem dados pessoais.
- No painel administrativo, botão "Verificar Pix pendentes" mostra os contadores para diagnóstico. Nenhuma transação tem status alterado automaticamente.

## Limites não resolvidos sem condições externas
1. **Proteção nativa contra senhas vazadas do Supabase:** depende do plano Pro ou superior; o projeto atualmente está no Free. Não realizar upgrade sem consentimento informado sobre custos. Um validador na interface não evita requisições diretas ao Auth.
2. **Status dos pagamentos antigos:** a situação real só pode ser conhecida consultando o Mercado Pago; a nova auditoria deve ser acionada por um administrador autenticado. Se encontrar crédito confirmado com status local pendente, reprocessar usando validação independente e as RPCs idempotentes; nunca aprovar manualmente apenas por esta lista.
3. **Origem do Premium existente:** a tabela guarda data de expiração, mas não a razão do benefício. Não revogar a assinatura sem evidências adicionais.
4. **CSP mais restritiva:** já existe uma política ativa para scripts e outra `Report-Only` com domínios restritos. A aplicação fornece HTML Studio, previews e ferramentas com recursos de terceiros, portanto proibir todos os destinos externos sem testes de navegação quebraria recursos existentes. Registrar violações reais e revisar antes de promover o `connect-src` restrito.
5. **Premium no navegador:** a verificação está no servidor, mas o JavaScript das operações é público. Exclusividade real requer mover processamento para o backend.

## Validação antes da publicação
- [ ] Sem Supabase CDN: 80 ferramentas visíveis, botão "Minha conta" orienta sobre indisponibilidade, Premium não inicializa com exceção.
- [ ] Com Supabase: 80 ferramentas e login funcionam, conta Premium ativa abre todas as 15 ferramentas, sem acesso Premium expirada é bloqueada.
- [ ] Alterar relógio local não deve desbloquear Premium.
- [ ] Administrador: o novo botão retorna uma contagem do Mercado Pago; usuário comum sem permissão não consulta dados de terceiros.
- [ ] Pagamentos Pix e webhook mantêm os fluxos anteriores; não mexer em cobranças pendentes sem confirmação externa.
- [ ] Checar violações no console CSP em imagens/PDF/OCR, HTML Studio, previews e download.
- [ ] Verificar domínio e versão publicadas na Vercel.
