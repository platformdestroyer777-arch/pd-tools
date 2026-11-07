# PD Tools — Proteção e recuperação do 2FA (07/11/2026)

## Implementado
- Login do administrador com segundo fator (TOTP).
- Coluna require_mfa em public.admins com false por padrão, preservando o acesso existente.
- Ao validar o código, a função enable_admin_mfa confirma no banco que existe um fator verificado e que a sessão tem nível aal2; então exige MFA para futuras alterações.
- RLS de tools, site_settings e Storage site-assets exige aal2 quando require_mfa=true.
- A auditoria administrativa Pix também exige aal2 quando a proteção está ativa.
- SRI SHA-384 fixo nas três bibliotecas CDN, lockfile de dependências e auditoria automática.
- Timeouts em consultas Mercado Pago, smoke HTTP sem credenciais.

## Como ativar
1. Entre com sua conta administradora do PD Tools.
2. Abra Painel administrativo > Visão geral > Proteger painel com 2FA.
3. Cadastre o QR Code ou a chave no seu aplicativo autenticador.
4. Informe o código de seis dígitos.
5. Só considere a proteção ativa quando o site confirmar a ativação no banco.
6. Guarde a chave do autenticador em um gerenciador de senhas ou meio seguro separado do computador. Nunca a compartilhe.

## Recuperação
Se perder o autenticador, não há recuperação automática pelo site. O proprietário do Supabase deve verificar a identidade do administrador fora do site, remover o fator perdido com a ferramenta oficial de Auth Admin e restabelecer provisoriamente o cadastro. Reconfigure o 2FA imediatamente. Nunca exponha uma chave service_role em conversas.

## Observações
- Não foram modificados pagamentos, assinaturas, contas ou ferramentas existentes.
- O 2FA ainda precisa ser ativado pelo próprio administrador: antes disso a conta atual continua acessível.
- A doação não libera Premium e a assinatura de R$5 por 30 dias exige confirmação do Mercado Pago.
- A validação real do Pix em produção/sandbox e testes de navegador autenticado continuam necessários.
- A proteção de senhas vazadas do Supabase é Pro+; não houve upgrade.
- Premium implementado em JavaScript de navegador não é código secreto; migrar processamento para backend se a exclusividade for indispensável.
- A CSP mais restritiva de conexões permanece apenas em Report-Only até verificar ferramentas externas e evitar quebra de funcionalidade.
