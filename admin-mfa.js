/* PD Tools — MFA administrativo (TOTP, aplicativo autenticador).
 * Sem segundo fator configurado, o admin atual continua acessível.
 * Após a confirmação do fator, o banco passa a exigir AAL2 para escritas.
 * O segredo TOTP aparece apenas durante a inscrição e nunca é enviado ao PD Tools.
 */
(() => {
  "use strict";

  const getClient = () =>
    typeof supabaseClient !== "undefined" ? supabaseClient : null;

  const find = id => document.getElementById(id);
  const dialog = find("pdAdminMfaDialog");
  if (!dialog) return;

  const info = find("pdMfaInfo");
  const qrImage = find("pdMfaQr");
  const secret = find("pdMfaSecret");
  const codeInput = find("pdMfaCode");
  const codeBox = find("pdMfaCodeBox");
  const startButton = find("pdMfaStart");
  const verifyButton = find("pdMfaVerify");
  const cancelButton = find("pdMfaCancel");
  const status = find("pdMfaStatus");
  let factorId = null;
  let mode = "setup";
  let busy = false;

  const setStatus = text => { status.textContent = text; };
  const showCode = value => {
    codeBox.hidden = !value;
    verifyButton.hidden = !value;
    if (value) codeInput.focus();
  };
  const reset = () => {
    factorId = null;
    codeInput.value = "";
    qrImage.removeAttribute("src");
    qrImage.hidden = true;
    secret.textContent = "";
    secret.hidden = true;
    showCode(false);
    setStatus("");
    startButton.hidden = true;
  };

  async function ensureAuthorized() {
    const client = getClient();
    if (!client?.auth?.mfa?.listFactors) return false;
    const { data: user, error: authError } = await client.auth.getUser();
    if (authError || !user?.user?.id) return false;
    const { data: admin, error } = await client
      .from("admins")
      .select("user_id")
      .eq("user_id", user.user.id)
      .maybeSingle();
    return !error && !!admin;
  }

  async function open(nextMode = "setup") {
    if (busy) return;
    reset();
    mode = nextMode;
    if (!await ensureAuthorized()) {
      if (typeof toast === "function") toast("Faça login como administrador antes de configurar o 2FA.");
      return;
    }
    dialog.showModal();
    info.textContent = "Conferindo os fatores de segurança...";
    try {
      const client = getClient();
      const [levelResult, factorResult] = await Promise.all([
        client.auth.mfa.getAuthenticatorAssuranceLevel(),
        client.auth.mfa.listFactors()
      ]);
      if (levelResult.error || factorResult.error) throw new Error("Falha na consulta MFA");

      const factors = factorResult.data?.totp || [];
      const verified = factors.find(item => item.status === "verified");
      const currentLevel = levelResult.data?.currentLevel;

      if (verified) {
        factorId = verified.id;
        if (currentLevel === "aal2") {
          // Finaliza a ativação somente quando a sessão e um fator estiverem validados.
          const { data: enabled, error: gateError } = await client.rpc("enable_admin_mfa");
          if (gateError || enabled !== true) {
            throw new Error("Não foi possível ativar a proteção MFA no banco");
          }
          info.textContent = "Seu 2FA está ativado e a sessão já foi verificada. Seu painel tem proteção adicional.";
          setStatus("Proteção no banco ativa.");
          showCode(false);
        } else {
          mode = "verify";
          info.textContent = "Abra seu aplicativo autenticador e informe o código de 6 dígitos para acessar o painel administrativo.";
          showCode(true);
        }
      } else {
        mode = "setup";
        info.textContent = "Ative a verificação em duas etapas usando um aplicativo autenticador. Depois disso, o código será exigido no painel.";
        startButton.hidden = false;
        showCode(false);
      }
    } catch (error) {
      info.textContent = "Não foi possível consultar os fatores. Tente novamente após entrar na sua conta.";
      setStatus("Verificação indisponível.");
    }
  }

  async function enroll() {
    if (busy || mode !== "setup") return;
    const client = getClient();
    busy = true;
    startButton.disabled = true;
    setStatus("Preparando o autenticador...");
    try {
      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "PD Tools — Administração"
      });
      if (error || !data?.id || !data?.totp?.secret) throw new Error("Falha na inscrição MFA");
      factorId = data.id;
      const qr = data.totp.qr_code || "";
      if (typeof qr === "string" && /^data:image\/(?:svg\+xml|png)[;,]/i.test(qr)) {
        qrImage.src = qr;
        qrImage.hidden = false;
      }
      secret.textContent = data.totp.secret;
      secret.hidden = false;
      info.textContent = "Escaneie o QR Code no seu autenticador ou digite a chave acima manualmente. Não compartilhe essa chave.";
      startButton.hidden = true;
      showCode(true);
      setStatus("Digite o código gerado pelo aplicativo para concluir a ativação.");
    } catch (error) {
      setStatus("Não foi possível iniciar o 2FA. Tente novamente.");
    } finally {
      busy = false;
      startButton.disabled = false;
    }
  }

  async function verify() {
    if (busy || !factorId) return;
    const code = codeInput.value.trim();
    if (!/^\d{6}$/.test(code)) {
      setStatus("Digite um código de 6 dígitos.");
      return;
    }
    busy = true;
    verifyButton.disabled = true;
    setStatus("Validando seu código com o Supabase...");
    try {
      const client = getClient();
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) throw error;
      const { data: enabled, error: gateError } = await client.rpc("enable_admin_mfa");
      if (gateError || enabled !== true) {
        setStatus("2FA confirmado, mas a proteção do banco não foi ativada. Abra esta tela novamente para concluir.");
        return;
      }
      codeInput.value = "";
      secret.textContent = "";
      qrImage.removeAttribute("src");
      setStatus("2FA confirmado. Sua sessão administrativa está protegida.");
      dialog.close();
      // Nova sessão aal2 emitida pelo Supabase. Reabre o painel após MFA.
      find("adminOpen")?.click();
    } catch (error) {
      codeInput.value = "";
      setStatus("Código inválido ou expirado. Confira o aplicativo e tente novamente.");
      codeInput.focus();
    } finally {
      busy = false;
      verifyButton.disabled = false;
    }
  }

  cancelButton?.addEventListener("click", () => dialog.close());
  startButton?.addEventListener("click", enroll);
  verifyButton?.addEventListener("click", verify);
  codeInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      verify();
    }
  });
  dialog.addEventListener("close", reset);
  window.PD_ADMIN_MFA = {
    open,
    isOpen: () => dialog.open
  };
})();
