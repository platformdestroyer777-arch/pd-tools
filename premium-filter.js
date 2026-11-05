
/* PD TOOLS — FILTRO PREMIUM */

(() => {
  "use strict";

  const premiumTools = [
    ["Removedor de fundo", "Remova fundos de imagens.", "✂"],
    ["PDF Studio", "Una e organize arquivos PDF.", "▤"],
    ["Extrator OCR", "Extraia textos de imagens.", "▣"],
    ["HTML Studio", "Edite e visualize HTML.", "⌘"],
    ["Criador de banners", "Crie banners personalizados.", "▧"],
    ["Conversor em lote", "Converta várias imagens.", "⇄"],
    ["QR Code avançado", "Personalize QR Codes.", "▦"],
    ["JSON Studio", "Analise arquivos JSON.", "{}"],
    ["Marca d'água em lote", "Proteja suas imagens.", "◈"],
    ["Compressor de PDF", "Reduza arquivos PDF.", "▥"],
    ["Criador de currículos", "Monte currículos.", "▤"],
    ["Editor de imagens", "Edite e recorte imagens.", "▧"],
    ["Criador de legendas SRT", "Crie legendas.", "≡"],
    ["Minificador avançado", "Otimize seus códigos.", "⌘"],
    ["Criador de sites", "Monte páginas personalizadas.", "◇"]
  ];

  const filters = document.getElementById("filters");
  const grid = document.getElementById("toolGrid");
  const search = document.getElementById("search");

  if (!filters || !grid || typeof supabaseClient === "undefined") {
    console.error("Premium: elementos necessários não encontrados.");
    return;
  }

  // Oculta a seção antiga de cards Premium.
  const oldSection = document.querySelector(".premium-section");
  if (oldSection) oldSection.hidden = true;

  const style = document.createElement("style");
  style.textContent = `
    .premium-section { display: none !important; }

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
      padding: 30px;
      text-align: center;
      background: #11111b;
      border: 1px solid #252538;
      border-radius: 16px;
      color: #9998ad;
      line-height: 1.7;
    }

    .pd-premium-message h3 {
      color: #c3b4ff;
      margin-top: 0;
    }
  `;
  document.head.appendChild(style);

  let premiumSelected = false;
  let requestId = 0;
  let lastCategory = "Todas";

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  async function hasPremium() {
    const { data: auth, error: authError } =
      await supabaseClient.auth.getUser();

    if (authError) throw authError;

    if (!auth?.user) return false;

    const { data, error } = await supabaseClient
      .from("premium_access")
      .select("expires_at")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (error) throw error;

    const expiration = Date.parse(data?.expires_at || "");

    return Number.isFinite(expiration) &&
      expiration > Date.now();
  }

  function addPremiumButton() {
    let button = filters.querySelector('[data-cat="Premium"]');

    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "filter";
      button.dataset.cat = "Premium";
      button.textContent = "🔒 Premium";
    }

    const allButton = filters.querySelector('[data-cat="Todas"]');

    if (allButton) {
      allButton.insertAdjacentElement("afterend", button);
    } else {
      filters.prepend(button);
    }

    button.classList.toggle("active", premiumSelected);

    if (premiumSelected) {
      filters.querySelectorAll(".filter").forEach(item => {
        if (item !== button) item.classList.remove("active");
      });
    }
  }

  async function showPremium() {
    const currentRequest = ++requestId;
    premiumSelected = true;

    addPremiumButton();

    grid.innerHTML = `
      <div class="pd-premium-message">
        Verificando seu acesso Premium...
      </div>
    `;

    try {
      const active = await hasPremium();

      if (currentRequest !== requestId || !premiumSelected) {
        return;
      }

      if (!active) {
        grid.innerHTML = `
          <div class="pd-premium-message">
            <h3>🔒 Premium bloqueado</h3>
            <p>
              Você precisa ativar o PD Tools Premium
              para visualizar as ferramentas exclusivas.
            </p>
            <p>
              Acesso por 30 dias após a confirmação
              de uma doação de R$ 5,00 ou mais.
            </p>
          </div>
        `;
        return;
      }

      const query = (search?.value || "").toLowerCase();

      const visible = premiumTools.filter(tool =>
        (tool[0] + " " + tool[1]).toLowerCase().includes(query)
      );

      grid.innerHTML = visible.map(tool => `
        <article class="tool-card">
          <span class="tool-arrow">💜</span>
          <div class="tool-icon">${escapeHTML(tool[2])}</div>
          <h3>${escapeHTML(tool[0])}</h3>
          <p>${escapeHTML(tool[1])}</p>
        </article>
      `).join("") || `
        <div class="pd-premium-message">
          Nenhuma ferramenta encontrada.
        </div>
      `;

    } catch (error) {
      console.error("Erro Premium:", error);

      if (currentRequest === requestId && premiumSelected) {
        grid.innerHTML = `
          <div class="pd-premium-message">
            Não foi possível verificar seu Premium.
            Tente novamente.
          </div>
        `;
      }
    }
  }

  function restoreFreeTools(selectedCategory) {
    ++requestId;
    premiumSelected = false;

    if (typeof category !== "undefined") {
      category = selectedCategory;
    }

    if (typeof render === "function") {
      render();
    }

    addPremiumButton();
  }

  filters.addEventListener("click", event => {
    const button = event.target.closest("button[data-cat]");
    if (!button) return;

    if (button.dataset.cat === "Premium") {
      event.stopPropagation();

      if (!premiumSelected &&
          typeof category !== "undefined") {
        lastCategory = category;
      }

      showPremium();
    } else {
      restoreFreeTools(button.dataset.cat);
    }
  }, true);

  if (search) {
    search.addEventListener("input", () => {
      if (premiumSelected) {
        showPremium();
      }
    });
  }

  // Reinsere o botão caso o app.js atualize as categorias.
  const observer = new MutationObserver(() => {
    if (!filters.querySelector('[data-cat="Premium"]')) {
      addPremiumButton();
    }
  });

  observer.observe(filters, {
    childList: true
  });

  supabaseClient.auth.onAuthStateChange(event => {
    if (
      premiumSelected &&
      (event === "SIGNED_IN" || event === "SIGNED_OUT")
    ) {
      setTimeout(showPremium, 0);
    }
  });

  addPremiumButton();
})();
