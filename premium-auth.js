
/* PD Tools — Autenticação dos membros */
(() => {
  "use strict";

  const client =
    typeof supabaseClient !== "undefined"
      ? supabaseClient
      : null;

  const byId = id => document.getElementById(id);
  const overlay = byId("pdAccountOverlay");

  if (!client || !overlay) return;

  const trigger = byId("pdAccountOpen");
  const close = byId("pdAccountClose");
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

  let mode = "login";
  let previousFocus = null;

  const status = text => {
    message.textContent = text;
  };

  const dateBR = value =>
    new Date(value).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

  async function refresh() {
    const { data: { user }, error } =
      await client.auth.getUser();

    if (error || !user) {
      form.hidden = false;
      profile.hidden = true;
      toggle.hidden = false;

      trigger.textContent = "Entrar / Criar conta";
      title.textContent =
        mode === "login" ? "Entrar" : "Criar conta";

      desc.textContent =
        mode === "login"
          ? "Entre para acompanhar seu acesso Premium."
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

      return;
    }

    trigger.textContent = "Minha conta";
    title.textContent = "Minha conta";
    desc.textContent =
      "Acompanhe seu acesso ao PD Tools Premium.";

    form.hidden = true;
    toggle.hidden = true;
    profile.hidden = false;

    byId("pdAccountUser").textContent =
      user.email || "Conta conectada";

    byId("pdAccountStatus").textContent =
      "Consultando seu Premium...";

    const { data, error: accessError } = await client
      .from("premium_access")
      .select("expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (accessError) {
      byId("pdAccountStatus").textContent =
        "Não foi possível consultar o Premium agora.";
    } else if (
      data &&
      new Date(data.expires_at).getTime() > Date.now()
    ) {
      byId("pdAccountStatus").textContent =
        `💜 Premium ativo até ${dateBR(data.expires_at)}.`;
    } else {
      byId("pdAccountStatus").textContent =
        "🔒 Premium inativo. Doe R$ 5,00 ou mais para obter 30 dias após a confirmação do pagamento.";
    }
  }

  trigger.addEventListener("click", async () => {
    previousFocus = document.activeElement;
    status("");
    overlay.hidden = false;

    try {
      await refresh();
    } catch (error) {
      console.error(error);
      status("Não foi possível carregar a conta.");
    }

    close.focus();
  });

  function hide() {
    overlay.hidden = true;
    previousFocus?.focus?.();
  }

  close.addEventListener("click", hide);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) hide();
  });

  document.addEventListener("keydown", event => {
    if (overlay.hidden) return;

    if (event.key === "Escape") hide();

    if (event.key === "Tab") {
      const focusables = [
        ...overlay.querySelectorAll(
          "button:not([hidden]):not(:disabled), input:not([hidden]):not(:disabled)"
        )
      ].filter(el => el.getClientRects().length);

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
    }
  });

  toggle.addEventListener("click", async () => {
    mode = mode === "login" ? "signup" : "login";
    status("");
    await refresh();
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (password.value.length < 8) {
      status("Use uma senha com pelo menos 8 caracteres.");
      return;
    }

    submit.disabled = true;
    status("Aguarde...");

    try {
      if (mode === "signup") {
        const { data, error } =
          await client.auth.signUp({
            email: email.value.trim(),
            password: password.value,
            options: {
              emailRedirectTo:
                `${location.origin}${location.pathname}`
            }
          });

        if (error) throw error;

        password.value = "";

        if (data.session) {
          status("Conta criada com sucesso!");
          await refresh();
        } else {
          status(
            "Confira seu e-mail e confirme o cadastro. Depois, volte para entrar."
          );
        }
      } else {
        const { error } =
          await client.auth.signInWithPassword({
            email: email.value.trim(),
            password: password.value
          });

        if (error) throw error;

        password.value = "";
        status("Login realizado com sucesso!");
        await refresh();
      }
    } catch (error) {
      console.error("Erro de autenticação:", error);

      status(
        "Não foi possível concluir. Confira e-mail, senha e confirmação da conta e tente novamente."
      );
    } finally {
      submit.disabled = false;
    }
  });

  logout.addEventListener("click", async () => {
    const { error } = await client.auth.signOut();

    if (error) {
      status("Não foi possível sair agora.");
      return;
    }

    mode = "login";
    status("Você saiu da conta.");
    await refresh();
  });

  client.auth.onAuthStateChange(() => {
    if (!overlay.hidden) {
      setTimeout(() => {
        refresh().catch(console.error);
      }, 0);
    } else {
      client.auth.getSession()
        .then(({ data }) => {
          trigger.textContent = data.session
            ? "Minha conta"
            : "Entrar / Criar conta";
        })
        .catch(console.error);
    }
  });

  client.auth.getSession()
    .then(({ data }) => {
      trigger.textContent = data.session
        ? "Minha conta"
        : "Entrar / Criar conta";
    })
    .catch(console.error);
})();
