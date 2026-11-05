
/* ==========================================
   PD TOOLS — SISTEMA DE FILTRO PREMIUM
   ========================================== */

(() => {
  "use strict";

  const filters = document.getElementById("filters");
  const grid = document.getElementById("toolGrid");
  const search = document.getElementById("search");

  if (!filters || !grid) {
    console.error("PD Tools: filtros não encontrados.");
    return;
  }

  if (typeof supabaseClient === "undefined") {
    console.error("PD Tools: Supabase indisponível.");
    return;
  }

  const client = supabaseClient;

  const premiumTools = [
    ["Removedor de fundo", "Remova fundos de imagens.", "✂️"],
    ["PDF Studio", "Organize arquivos PDF.", "📄"],
    ["Extrator de texto OCR", "Extraia textos de imagens.", "🔎"],
    ["HTML Studio", "Edite e visualize HTML.", "💻"],
    ["Criador de banners", "Crie banners personalizados.", "🎨"],
    ["Conversor de imagens em lote", "Converta várias imagens.", "🔄"],
    ["QR Code avançado", "Personalize QR Codes.", "▦"],
    ["JSON Studio", "Analise arquivos JSON.", "{}"],
    ["Marca d'água em lote", "Proteja suas imagens.", "◈"],
    ["Compressor de PDF", "Reduza arquivos PDF.", "📦"],
    ["Criador de currículos", "Monte currículos.", "📋"],
    ["Editor de imagens", "Edite suas imagens.", "🖼️"],
    ["Criador de legendas SRT", "Crie legendas.", "≡"],
    ["Minificador avançado", "Otimize códigos.", "⌘"],
    ["Criador de sites", "Monte páginas personalizadas.", "🌐"]
  ];

  let premiumSelected = false;
  let requestVersion = 0;

  // ==========================================
  // ESTILOS
  // ==========================================

  const style = document.createElement("style");

  style.textContent = `
    .premium-section,
    #premium {
      display: none !important;
    }

    .filter[data-cat="Premium"] {
      color: #c3b4ff;
      border-color: #9b7bff55;
    }

    .filter[data-cat="Premium"].active {
      color: #e0d7ff;
      background: #9b7bff1a;
      border-color: #9b7bff;
    }

    .pd-premium-message {
      grid-column: 1 / -1;
      width: 100%;
      padding: 32px 20px;
      text-align: center;
      background: #11111b;
      border: 1px solid #252538;
      border-radius: 16px;
      color: #9998ad;
      line-height: 1.7;
    }

    .pd-premium-message h3 {
      color: #c3b4ff;
      margin: 0 0 10px;
    }

    .pd-premium-message p {
      margin: 8px 0;
    }
  `;

  document.head.appendChild(style);

  // ==========================================
  // SEGURANÇA DO TEXTO
  // ==========================================

  function escapeHTML(value) {
    return String(value).replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[character]
    );
  }

  // ==========================================
  // BOTÃO PREMIUM
  // ==========================================

  function addPremiumButton() {
    let button = filters.querySelector(
      '[data-cat="Premium"]'
    );

    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "filter";
      button.dataset.cat = "Premium";
      button.textContent = "🔒 Premium";
    }

    const allButton = filters.querySelector(
      '[data-cat="Todas"]'
    );

    if (allButton) {
      allButton.insertAdjacentElement("afterend", button);
    } else {
      filters.prepend(button);
    }

    button.classList.toggle("active", premiumSelected);

    if (premiumSelected) {
      filters.querySelectorAll("button[data-cat]")
        .forEach(item => {
          if (item !== button) {
            item.classList.remove("active");
          }
        });
    }
  }

  // ==========================================
  // CONSULTA PREMIUM NO SUPABASE
  // ==========================================

  async function hasPremium() {
    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();

    if (sessionError) {
      console.error("Erro de sessão:", sessionError);
      return false;
    }

    if (!sessionData?.session?.user) {
      return false;
    }

    const { data: userData, error: userError } =
      await client.auth.getUser();

    if (userError || !userData?.user) {
      console.error("Erro de autenticação:", userError);
      return false;
    }

    const { data, error } = await client
      .from("premium_access")
      .select("expires_at")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data?.expires_at) {
      return false;
    }

    const expires = Date.parse(data.expires_at);

    return Number.isFinite(expires) &&
      expires > Date.now();
  }

  // ==========================================
  // MENSAGENS
  // ==========================================

  function showMessage(title, description) {
    grid.innerHTML = `
      <div class="pd-premium-message">
        <h3>${escapeHTML(title)}</h3>
        <p>${escapeHTML(description)}</p>
      </div>
    `;
  }

  // ==========================================
  // EXIBIR PREMIUM
  // ==========================================

  async function showPremium() {
    const currentVersion = ++requestVersion;

    premiumSelected = true;

    addPremiumButton();

    showMessage(
      "💜 PD Tools Premium",
      "Verificando seu acesso..."
    );

    try {
      const active = await hasPremium();

      if (
        currentVersion !== requestVersion ||
        !premiumSelected
      ) {
        return;
      }

      if (!active) {
        showMessage(
          "🔒 Premium bloqueado",
          "Você precisa de um Premium ativo para visualizar as ferramentas exclusivas."
        );
        return;
      }

      const query = (search?.value || "")
        .trim()
        .toLowerCase();

      const visible = premiumTools.filter(tool =>
        (tool[0] + " " + tool[1])
          .toLowerCase()
          .includes(query)
      );

      if (!visible.length) {
        showMessage(
          "Nenhuma ferramenta encontrada",
          "Tente pesquisar outro nome."
        );
        return;
      }

      grid.innerHTML = visible.map(tool => `
        <article class="tool-card">
          <span class="tool-arrow">💜</span>
          <div class="tool-icon">
            ${escapeHTML(tool[2])}
          </div>
          <h3>${escapeHTML(tool[0])}</h3>
          <p>${escapeHTML(tool[1])}</p>
        </article>
      `).join("");

    } catch (error) {
      console.error("Erro Premium:", error);

      if (
        currentVersion === requestVersion &&
        premiumSelected
      ) {
        showMessage(
          "Erro ao verificar Premium",
          "Não foi possível consultar seu acesso. Tente novamente."
        );
      }
    }
  }

  // ==========================================
  // VOLTAR ÀS FERRAMENTAS GRATUITAS
  // ==========================================

  function showFreeTools(selectedCategory) {
    ++requestVersion;

    premiumSelected = false;

    if (typeof category !== "undefined") {
      category = selectedCategory;
    }

    if (typeof render === "function") {
      render();
    }

    addPremiumButton();
  }

  // ==========================================
  // CLIQUES NOS FILTROS
  // ==========================================

  filters.addEventListener("click", event => {
    const button = event.target.closest(
      "button[data-cat]"
    );

    if (!button || !filters.contains(button)) {
      return;
    }

    if (button.dataset.cat === "Premium") {
      event.stopPropagation();
      showPremium();
      return;
    }

    showFreeTools(button.dataset.cat);
  }, true);

  // ==========================================
  // PESQUISA
  // ==========================================

  if (search) {
    search.addEventListener("input", () => {
      if (premiumSelected) {
        showPremium();
      }
    });
  }

  // ==========================================
  // MANTER O BOTÃO VISÍVEL
  // ==========================================

  const observer = new MutationObserver(() => {
    if (!filters.querySelector(
      '[data-cat="Premium"]'
    )) {
      addPremiumButton();
    }
  });

  observer.observe(filters, {
    childList: true
  });

  // ==========================================
  // ATUALIZAR APÓS LOGIN / LOGOUT
  // ==========================================

  client.auth.onAuthStateChange(event => {
    if (
      premiumSelected &&
      (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT"
      )
    ) {
      setTimeout(() => {
        showPremium();
      }, 0);
    }
  });

  // ==========================================
  // INICIALIZAÇÃO
  // ==========================================

  addPremiumButton();

  console.log(
    "PD Tools: filtro Premium inicializado."
  );

})();
