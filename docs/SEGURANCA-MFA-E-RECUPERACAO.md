# PD Tools — autenticação administrativa, recuperação e auditoria

Atualizado em 7 de novembro de 2026.

## Estado atual

- A conta administradora existente possui TOTP verificado e **todos os administradores precisam de sessão AAL2 para alterar o site**.
- A coluna `public.admins.require_mfa` passa a ter `true` como valor inicial; o banco **não aceita mais AAL1 nas gravações administrativas mesmo que a coluna esteja falsa**.
- As policies do Supabase de `tools`, `site_settings` e Storage `site-assets` exigem administrador **e** `auth.jwt()->>'aal' = 'aal2'`.
- O painel valida o AAL atual e exige que continue havendo fator ativo (`nextLevel = 'aal2'`).
- A API `/api/auditar-pix` verifica usuário, administrador, AAL2 atual e próximo AAL2 e permite até 6 auditorias a cada 10 minutos. O limite é transacional, compartilhado por todas as instâncias.
- Modificações de `admins`, `tools` e `site_settings` geram trilha interna em `pd_internal.admin_audit_log`. Essa tabela **não é acessível por usuários comuns nem é exposta via REST**.
- O RPC de confirmação Premium só é executável com `service_role`, aceita assinatura de **exatamente R$ 5,00** e registra cada liberação em `pd_internal.premium_grant_events`.
- Os 20 novos recursos Premium revalidam o status com a API ao executar suas ações principais. Isso evita utilizar o modal aberto depois da expiração, mas **não torna o JavaScript do cliente secreto**.
- A API de geração Pix exige e-mail confirmado pela autenticação.

## Como entrar com 2FA

1. Faça login na conta administrativa.
2. Acesse **Painel administrativo**. Se necessário, o site abrirá a verificação MFA.
3. Informe os seis dígitos do autenticador.
4. O painel somente será aberto após uma sessão AAL2.

Não compartilhe código nem chave do aplicativo autenticador com ninguém.

## Recuperação sem o aplicativo autenticador

O site **não oferece uma opção para burlar o 2FA**, nem códigos de recuperação automáticos. Se perder todos os fatores, o proprietário do projeto deverá confirmar a identidade por um meio independente e remover somente o fator perdido usando os controles oficiais de **Supabase Auth Admin**. Em seguida, autentique-se normalmente e **cadastre e verifique um novo TOTP antes de fazer qualquer alteração administrativa**.

A conta não deve receber uma exceção temporária de senha apenas. Não desabilite RLS e nunca exponha a `service_role` em mensagens ou código público.

## Testes seguros e auditoria

- Com a conta administrativa simulada em AAL1, uma atualização de `tools` afetou zero linhas.
- Com a mesma conta simulada em AAL2, o update alcançou uma linha em transação revertida, sem alterar o catálogo.
- O RPC recusou R$ 4,99 e aceitou R$ 5,00 em transações **revertidas**, sem pagamento Mercado Pago real.
- O limite da API administrativa aceitou seis chamadas simuladas e rejeitou a sétima, também em transação revertida.
- O histórico de auditoria pode ser consultado somente no backend por operadores autorizados do Supabase.

## Limitações

- A proteção contra senha vazada está desativada no plano Supabase atual; considere o recurso disponível em planos pagos, sem upgrade automático.
- Ferramentas Premium implementadas e publicadas no navegador podem ser inspecionadas ou copiadas mesmo se o catálogo estiver oculto. Exclusividade forte requer processamento privado no servidor e/ou arquitetura de distribuição diferente.
- Não houve Pix real de R$ 5,00 confirmado nesta rodada; o fluxo de compra exige um teste completo separado.
- CSP ampla e alguns modelos de IA/CDNs ainda exigem testes multiplataforma antes de um bloqueio mais rígido de conexões.
- Mudanças no código dependem de novo deploy da Vercel; alterações SQL já aplicadas ao Supabase começam a valer imediatamente.
