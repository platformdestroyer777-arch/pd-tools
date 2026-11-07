
/* PD Tools — Login, cadastro e assinatura Premium */

(() => {
  "use strict";

  const client =
    typeof supabaseClient !== "undefined"
      ? supabaseClient
      : null;

  const byId = id => document.getElementById(id);

  const overlay = byId("pdAccountOverlay");
  const trigger = byId("pdAccountOpen");
  const closeButton = byId("pdAccountClose");
  const form = byId("pdAccountForm");
  const email = byId("pdAccountEmail");
  const password = byId("pdAccountPassword");
  const submit = byId("pdAccountSubmit");
  const profile = byId("pdAccountProfile");
  const logout = byId("pdAccountLogout");
  const toggle = byId("pdAccountSwitch");
  const title = byId("pdAccountTitle");
  const desc = byId("pdAccountDesc");
  const message = byId("pdAccountMessage");
  const userLabel = byId("pdAccountUser");
  const premiumStatus = byId("pdAccountStatus");

  if (!client?.auth?.getSession) {
    trigger?.addEventListener("click", () => {
      if (typeof toast === "function") {
        toast("Sistema de contas temporariamente indisponível. Tente novamente.");
      }
    });
    console.warn("PD Tools: Supabase indisponível; login temporariamente desativado.");
    return;
  }

  if (
    !overlay || !trigger ||
    !closeButton || !form || !email ||
    !password || !submit || !profile ||
    !logout || !toggle || !title ||
    !desc || !message || !userLabel ||
    !premiumStatus
  ) {
    console.error(
      "PD Tools Premium: configuração incompleta."
    );
    return;
  }

  let mode = "login";
  let previousFocus = null;
  let refreshVersion = 0;

  function showMessage(text) {
    message.textContent = text;
  }

  function dateBR(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "data indisponível";
    }

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function showGuest() {
    form.hidden = false;
    profile.hidden = true;
    toggle.hidden = false;

    trigger.textContent = "Entrar / Criar conta";

    title.textContent =
      mode === "login" ? "Entrar" : "Criar conta";

    desc.textContent =
      mode === "login"
        ? "Entre para acompanhar sua assinatura Premium."
        : "Crie sua conta com e-mail e senha.";

    submit.textContent =
      mode === "login" ? "Entrar" : "Criar conta";

    toggle.textContent =
      mode === "login"
        ? "Não tem conta? Criar conta"
        : "Já tem conta? Entrar";

    password.autocomplete =
      mode === "login"
        ? "current-password"
        : "new-password";
  }

  async function refresh() {
    const version = ++refreshVersion;

    const {
      data: { user },
      error
    } = await client.auth.getUser();

    if (version !== refreshVersion) return;

    if (error || !user) {
      showGuest();
      return;
    }

    trigger.textContent = "Minha conta";
    title.textContent = "Minha conta";

    desc.textContent =
      "Acompanhe sua assinatura do PD Tools Premium.";

    form.hidden = true;
    toggle.hidden = true;
    profile.hidden = false;

    userLabel.textContent =
      user.email || "Conta conectada";

    premiumStatus.textContent =
      "Consultando sua assinatura Premium...";

    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (sessionError || !token) {
      premiumStatus.textContent = "Entre novamente para conferir o Premium.";
      return;
    }

    try {
      const response = await fetch("/api/premium-status", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (!response.ok) throw new Error("Falha na consulta Premium");
      const result = await response.json();
      if (version !== refreshVersion) return;
      premiumStatus.textContent = result.active === true
        ? `💜 Premium ativo até ${dateBR(result.expires_at)}.`
        : "🔒 Premium inativo. Assine por R$ 5,00 e tenha acesso às ferramentas exclusivas por 30 dias.";
    } catch (error) {
      if (version !== refreshVersion) return;
      premiumStatus.textContent = "Não foi possível consultar sua assinatura agora.";
    }
  }

  function hideModal() {
    overlay.hidden = true;
    previousFocus?.focus?.();
  }

  trigger.addEventListener("click", async () => {
    previousFocus = document.activeElement;
    showMessage("");
    overlay.hidden = false;
    closeButton.focus();

    try {
      await refresh();
    } catch (error) {
      console.error(error);

      showMessage(
        "Não foi possível carregar sua conta."
      );
    }
  });

  closeButton.addEventListener(
    "click",
    hideModal
  );

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      hideModal();
    }
  });

  document.addEventListener("keydown", event => {
    if (overlay.hidden) return;

    if (event.key === "Escape") {
      hideModal();
      return;
    }

    if (event.key !== "Tab") return;

    const focusables = [
      ...overlay.querySelectorAll(
        "button:not(:disabled), input:not(:disabled)"
      )
    ].filter(element =>
      element.getClientRects().length > 0
    );

    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (
      event.shiftKey &&
      document.activeElement === first
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === last
    ) {
      event.preventDefault();
      first.focus();
    }
  });

  toggle.addEventListener("click", async () => {
    mode = mode === "login" ? "signup" : "login";
    showMessage("");

    try {
      await refresh();
    } catch (error) {
      console.error(error);

      showMessage(
        "Não foi possível atualizar a tela."
      );
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const userEmail = email.value.trim();
    const userPassword = password.value;

    if (!userEmail || !userPassword) {
      showMessage(
        "Preencha seu e-mail e sua senha."
      );
      return;
    }

    if (userPassword.length < 8) {
      showMessage("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    // Proteção adicional de UX no plano Free; o Supabase Auth continua
    // responsável pela validação no servidor.
    if (mode === "signup" &&
        (userPassword.length < 12 ||
         !/[a-z]/.test(userPassword) ||
         !/[A-Z]/.test(userPassword) ||
         !/[0-9]/.test(userPassword) ||
         !/[^A-Za-z0-9]/.test(userPassword))) {
      showMessage("Para criar a conta, use ao menos 12 caracteres com maiúscula, minúscula, número e símbolo.");
      return;
    }

    submit.disabled = true;
    showMessage("Aguarde...");

    try {
      if (mode === "signup") {
        const { data, error } =
          await client.auth.signUp({
            email: userEmail,
            password: userPassword,
            options: {
              emailRedirectTo:
                location.origin + location.pathname
            }
          });

        if (error) throw error;

        password.value = "";

        if (data.session) {
          await refresh();

          showMessage(
            "Conta criada com sucesso!"
          );
        } else {
          showMessage(
            "Confira seu e-mail e confirme o cadastro. Depois, volte para entrar."
          );
        }
      } else {
        const { error } =
          await client.auth.signInWithPassword({
            email: userEmail,
            password: userPassword
          });

        if (error) throw error;

        password.value = "";

        await refresh();

        showMessage(
          "Login realizado com sucesso!"
        );
      }
    } catch (error) {
      console.error(
        "Erro de autenticação:",
        error
      );

      showMessage(
        "Não foi possível concluir. Confira seu e-mail, sua senha e a confirmação da conta."
      );
    } finally {
      submit.disabled = false;
    }
  });

  logout.addEventListener("click", async () => {
    logout.disabled = true;

    try {
      const { error } =
        await client.auth.signOut();

      if (error) throw error;

      mode = "login";
      password.value = "";

      await refresh();

      showMessage(
        "Você saiu da conta."
      );
    } catch (error) {
      console.error(error);

      showMessage(
        "Não foi possível sair agora."
      );
    } finally {
      logout.disabled = false;
    }
  });

  client.auth.onAuthStateChange(
    (_event, session) => {
      trigger.textContent = session
        ? "Minha conta"
        : "Entrar / Criar conta";

      if (!overlay.hidden) {
        setTimeout(() => {
          refresh().catch(console.error);
        }, 0);
      }
    }
  );

  client.auth.getSession()
    .then(({ data }) => {
      trigger.textContent = data.session
        ? "Minha conta"
        : "Entrar / Criar conta";
    })
    .catch(console.error);
})();
