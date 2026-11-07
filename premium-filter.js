
/* ==========================================
   PD TOOLS — PREMIUM
   15 ferramentas cadastradas
   Integração com Supabase
   ========================================== */

(() => {
  "use strict";

  const filters = document.getElementById("filters");
  const grid = document.getElementById("toolGrid");
  const search = document.getElementById("search");
  const modal = document.getElementById("toolModal");
  const content = document.getElementById("toolContent");

  if (!filters || !grid || !modal || !content) {
    console.error("PD Tools: elementos Premium não encontrados.");
    return;
  }

  if (typeof supabaseClient === "undefined" || !supabaseClient?.auth?.getSession) {
    console.warn("PD Tools Premium: autenticação temporariamente indisponível.");
    return;
  }

  const client = supabaseClient;

  const premiumTools = [
    { id: "remove-bg", name: "Removedor de fundo", desc: "Remova fundos de imagens.", icon: "✂️", ready: true },
    { id: "pdf-studio", name: "PDF Studio", desc: "Organize arquivos PDF.", icon: "📄", ready: true },
    { id: "ocr", name: "Extrator de texto OCR", desc: "Extraia textos de imagens.", icon: "🔎", ready: true },
    { id: "html-studio", name: "HTML Studio", desc: "Edite e visualize HTML.", icon: "💻", ready: true },
    { id: "banner", name: "Criador de banners", desc: "Crie banners personalizados.", icon: "🎨", ready: true },
    { id: "image-batch", name: "Conversor de imagens em lote", desc: "Converta várias imagens.", icon: "🔄", ready: true },
    { id: "qr-advanced", name: "QR Code avançado", desc: "Personalize QR Codes.", icon: "▦", ready: true },
    { id: "json-studio", name: "JSON Studio", desc: "Analise e formate JSON.", icon: "{}", ready: true },
    { id: "watermark", name: "Marca d'água em lote", desc: "Proteja suas imagens.", icon: "◈", ready: true },
    { id: "pdf-compress", name: "Compressor de PDF", desc: "Reduza arquivos PDF.", icon: "📦", ready: true },
    { id: "resume", name: "Criador de currículos", desc: "Monte currículos.", icon: "📋", ready: true },
    { id: "image-editor", name: "Editor de imagens", desc: "Edite suas imagens.", icon: "🖼️", ready: true },
    { id: "srt", name: "Criador de legendas SRT", desc: "Crie legendas para vídeos.", icon: "≡", ready: true },
    { id: "minifier", name: "Minificador avançado", desc: "Compacte códigos HTML, CSS e JavaScript.", icon: "⌘", ready: true },
    { id: "site-builder", name: "Criador de sites", desc: "Monte páginas personalizadas.", icon: "🌐", ready: true },
    { id: "video-frames", name: "Extrator de frames", desc: "Salve imagens de vídeos em PNG.", icon: "🎬", ready: true },
    { id: "audio-trim", name: "Cortador de áudio", desc: "Recorte trechos de áudio e exporte em WAV.", icon: "🎵", ready: true },
    { id: "audio-volume", name: "Editor de volume", desc: "Ajuste o volume e baixe o áudio WAV.", icon: "🔊", ready: true },
    { id: "video-gif", name: "Criador de GIF", desc: "Transforme trechos de vídeos em GIF.", icon: "🎞️", ready: true },
    { id: "photo-collage", name: "Criador de colagens", desc: "Junte até nove fotos em uma imagem.", icon: "🖼️", ready: true },
    { id: "favicon-maker", name: "Gerador de favicon", desc: "Crie ícones para seus projetos e sites.", icon: "🧩", ready: true },
    { id: "svg-png", name: "Conversor SVG para PNG", desc: "Converta desenhos SVG em imagens PNG.", icon: "🎨", ready: true },
    { id: "privacy-blur", name: "Ocultador de dados", desc: "Cubra informações sensíveis em imagens.", icon: "🛡️", ready: true },
    { id: "device-mockup", name: "Criador de mockups", desc: "Mostre seus projetos em telas de dispositivos.", icon: "📱", ready: true },
    { id: "thumbnail-maker", name: "Criador de miniaturas", desc: "Crie capas profissionais para vídeos.", icon: "📸", ready: true },
    { id: "csv-editor", name: "Editor de CSV", desc: "Edite arquivos CSV como uma tabela.", icon: "📊", ready: true },
    { id: "file-organizer", name: "Organizador de arquivos", desc: "Separe arquivos por tipo em um ZIP.", icon: "🗂️", ready: true },
    { id: "bulk-rename", name: "Renomeador em lote", desc: "Renomeie vários arquivos de uma vez.", icon: "✏️", ready: true },
    { id: "zip-maker", name: "Criador de ZIP", desc: "Compacte seus arquivos em um ZIP.", icon: "📦", ready: true },
    { id: "qr-reader", name: "Leitor de QR Code", desc: "Leia QR Codes em imagens compatíveis.", icon: "🔍", ready: true },
    { id: "sitemap-maker", name: "Gerador de sitemap", desc: "Crie sitemap.xml para melhorar a navegação por robôs.", icon: "🌐", ready: true },
    { id: "meta-generator", name: "Gerador de meta tags", desc: "Crie meta tags para páginas de sites.", icon: "📝", ready: true },
    { id: "css-animations", name: "Gerador de animações CSS", desc: "Crie efeitos animados com código CSS.", icon: "✨", ready: true },
    { id: "markdown-editor", name: "Editor Markdown", desc: "Escreva textos Markdown com prévia segura.", icon: "💻", ready: true },
    { id: "subtitle-converter", name: "Conversor SRT/VTT", desc: "Converta legendas entre SRT e WebVTT.", icon: "🎞️", ready: true }
  ];

  const externalTools = new Set([
    "remove-bg",
    "pdf-studio",
    "ocr",
    "image-batch",
    "qr-advanced",
    "watermark",
    "pdf-compress",
    "resume",
    "image-editor",
    "site-builder",
    "video-frames",
    "audio-trim",
    "audio-volume",
    "video-gif",
    "photo-collage",
    "favicon-maker",
    "svg-png",
    "privacy-blur",
    "device-mockup",
    "thumbnail-maker",
    "csv-editor",
    "file-organizer",
    "bulk-rename",
    "zip-maker",
    "qr-reader",
    "sitemap-maker",
    "meta-generator",
    "css-animations",
    "markdown-editor",
    "subtitle-converter"
  ]);

  let premiumSelected = false;
  let premiumVerified = false;
  let requestVersion = 0;

  const $ = selector => document.querySelector(selector);

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const style = document.createElement("style");

  style.textContent = `
    .filter[data-cat="Premium"] {
      color: #c3b4ff;
      border-color: #9b7bff55;
    }

    .filter[data-cat="Premium"].active {
      background: #9b7bff1a;
      border-color: #9b7bff;
      color: #e0d7ff;
    }

    .pd-premium-message {
      grid-column: 1 / -1;
      padding: 30px 20px;
      text-align: center;
      background: #11111b;
      border: 1px solid #252538;
      border-radius: 16px;
      color: #aaa;
    }

    .pd-premium-message h3 {
      color: #c3b4ff;
      margin-bottom: 10px;
    }

    .pd-premium-status {
      display: inline-block;
      margin-top: 12px;
      font-size: 12px;
      color: #b9a5ff;
    }

    .pd-premium-status.pending {
      color: #999;
    }

    .pd-premium-field {
      margin: 14px 0;
    }

    .pd-premium-field label {
      display: block;
      margin-bottom: 7px;
      color: #c3b4ff;
      font-size: 13px;
    }

    .pd-premium-field input,
    .pd-premium-field textarea,
    .pd-premium-field select {
      width: 100%;
      box-sizing: border-box;
      padding: 12px;
      border-radius: 9px;
      border: 1px solid #363044;
      background: #111018;
      color: #fff;
      font: inherit;
    }

    .pd-premium-field textarea {
      min-height: 140px;
      resize: vertical;
      font-family: monospace;
    }

    .pd-premium-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 14px 0;
    }

    .pd-premium-actions button {
      cursor: pointer;
    }

    .pd-premium-result {
      margin-top: 14px;
      padding: 14px;
      border: 1px solid #302a3c;
      border-radius: 10px;
      background: #111018;
      color: #ddd;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .pd-premium-preview {
      width: 100%;
      height: 260px;
      border: 1px solid #363044;
      border-radius: 10px;
      background: white;
      margin-top: 14px;
    }

    #pdBannerCanvas {
      display: block;
      width: 100%;
      height: auto;
      border-radius: 10px;
      margin: 15px 0;
    }
  `;

  document.head.appendChild(style);

  function addPremiumButton() {
    let button = filters.querySelector('[data-cat="Premium"]');

    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "filter";
      button.dataset.cat = "Premium";
      button.textContent = "💜 Premium (35)";
    }

    const all = filters.querySelector('[data-cat="Todas"]');

    if (all) {
      if (all.nextElementSibling !== button) {
        all.insertAdjacentElement("afterend", button);
      }
    } else if (!button.parentElement) {
      filters.prepend(button);
    }

    button.classList.toggle("active", premiumSelected);

    if (premiumSelected) {
      filters.querySelectorAll("button").forEach(item => {
        if (item !== button) item.classList.remove("active");
      });
    }
  }

  async function hasPremium() {
    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();
    if (sessionError) throw sessionError;

    const token = sessionData?.session?.access_token;
    if (!token) return false;

    const response = await fetch("/api/premium-status", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    if (response.status === 401) return false;
    if (!response.ok) throw new Error("Falha ao verificar acesso Premium.");
    const result = await response.json();
    return result.active === true;
  }

  function showMessage(title, description) {
    grid.innerHTML = `
      <div class="pd-premium-message">
        <h3>${escapeHTML(title)}</h3>
        <p>${escapeHTML(description)}</p>
      </div>
    `;
  }

  function renderPremiumCards() {
    if (!premiumSelected) return;

    const query = (search?.value || "").trim().toLowerCase();

    const visible = premiumTools.filter(tool =>
      `${tool.name} ${tool.desc}`.toLowerCase().includes(query)
    );

    if (!visible.length) {
      showMessage(
        "Nenhuma ferramenta encontrada",
        "Tente outra pesquisa."
      );
      return;
    }

    grid.innerHTML = (premiumVerified ? "" : `<div class="pd-premium-unlock"><strong>💜 Conheça as 35 ferramentas Premium</strong><p>Explore os recursos. Para usar, assine por R$ 5,00 e tenha 30 dias de acesso após a confirmação do Pix.</p><a href="#assinar-premium">Quero desbloquear as ferramentas</a></div>`) + visible.map(tool => `
      <article
        class="tool-card"
        data-premium-tool="${escapeHTML(tool.id)}"
        role="button"
        tabindex="0"
        aria-label="${escapeHTML(tool.name)}"
        style="cursor:pointer"
      >
        <span class="tool-arrow">↗</span>
        <div class="tool-icon">${escapeHTML(tool.icon)}</div>
        <h3>${escapeHTML(tool.name)}</h3>
        <p>${escapeHTML(tool.desc)}</p>
        <span class="pd-premium-status ${tool.ready ? "" : "pending"}">
          ${premiumVerified ? "💜 Disponível" : "🔒 Veja o que faz"}
        </span>
      </article>
    `).join("");
  }

  async function showPremium() {
    const version = ++requestVersion;

    premiumSelected = true;
    premiumVerified = false;

    addPremiumButton();

    showMessage(
      "💜 PD Tools Premium",
      "Verificando seu acesso..."
    );

    try {
      const active = await hasPremium();

      if (version !== requestVersion || !premiumSelected) return;

      premiumVerified = active;

      renderPremiumCards();

    } catch (error) {
      console.error("Erro Premium:", error);

      if (version === requestVersion && premiumSelected) {
        showMessage(
          "Erro ao verificar Premium",
          "Não foi possível consultar seu acesso. Tente novamente."
        );
      }
    }
  }

  function showFreeTools(selectedCategory) {
    ++requestVersion;

    premiumSelected = false;
    premiumVerified = false;

    if (typeof category !== "undefined") {
      category = selectedCategory;
    }

    if (typeof render === "function") render();

    addPremiumButton();
  }

  function field(label, id, value = "", type = "text") {
    return `
      <div class="pd-premium-field">
        <label for="${escapeHTML(id)}">${escapeHTML(label)}</label>
        <input
          id="${escapeHTML(id)}"
          type="${escapeHTML(type)}"
          value="${escapeHTML(value)}"
        >
      </div>
    `;
  }

  function textarea(label, id, value = "") {
    return `
      <div class="pd-premium-field">
        <label for="${escapeHTML(id)}">${escapeHTML(label)}</label>
        <textarea id="${escapeHTML(id)}">${escapeHTML(value)}</textarea>
      </div>
    `;
  }

  function actions(buttons) {
    return `
      <div class="pd-premium-actions">
        ${buttons.map(([id, label], index) => `
          <button
            type="button"
            class="${index === 0 ? "action" : "secondary"}"
            id="${escapeHTML(id)}"
          >${escapeHTML(label)}</button>
        `).join("")}
      </div>
    `;
  }

  function setResult(id, message) {
    const element = document.getElementById(id);
    if (element) element.textContent = message;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function downloadText(text, filename, type = "text/plain") {
    downloadBlob(
      new Blob([text], { type: `${type};charset=utf-8` }),
      filename
    );
  }

  function toolHTML(id) {
    switch (id) {
      case "html-studio":
        return `
          ${textarea(
            "Código HTML",
            "pdHtmlInput",
            "<h1>Olá, PD Tools!</h1>\n<p>Minha primeira página.</p>"
          )}
          ${actions([
            ["pdHtmlPreviewBtn", "Visualizar"],
            ["pdHtmlDownload", "Baixar HTML"]
          ])}
          <iframe
            id="pdHtmlPreview"
            class="pd-premium-preview"
            sandbox=""
            title="Prévia HTML"
          ></iframe>
        `;

      case "json-studio":
        return `
          ${textarea(
            "Cole seu JSON",
            "pdJsonInput",
            '{"projeto":"PD Tools","premium":true}'
          )}
          ${actions([
            ["pdJsonFormat", "Formatar e validar"],
            ["pdJsonCompact", "Compactar"],
            ["pdJsonDownload", "Baixar JSON"]
          ])}
          <div class="pd-premium-result" id="pdJsonResult">
            Aguardando JSON...
          </div>
        `;

      case "srt":
        return `
          <p style="color:#aaa">
            Adicione uma legenda por linha no formato:
            início | fim | texto
          </p>
          <p style="color:#aaa;font-size:12px">
            Exemplo: 00:00:01 | 00:00:04 | Olá, pessoal!
          </p>
          ${textarea(
            "Legendas",
            "pdSrtInput",
            "00:00:01 | 00:00:04 | Olá, pessoal!\n00:00:05 | 00:00:08 | Bem-vindos ao PD Tools!"
          )}
          ${actions([
            ["pdSrtGenerate", "Gerar legendas"],
            ["pdSrtDownload", "Baixar SRT"]
          ])}
          <div class="pd-premium-result" id="pdSrtResult">
            Suas legendas aparecerão aqui.
          </div>
        `;

      case "minifier":
        return `
          <div class="pd-premium-field">
            <label for="pdMinType">Tipo de código</label>
            <select id="pdMinType">
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="js">JavaScript (compactação básica)</option>
            </select>
          </div>
          ${textarea("Código original", "pdMinInput")}
          ${actions([
            ["pdMinRun", "Minificar"],
            ["pdMinCopy", "Copiar resultado"],
            ["pdMinDownload", "Baixar código"]
          ])}
          ${textarea("Resultado", "pdMinOutput")}
          <p style="color:#999;font-size:12px">
            Compactação conservadora. Teste o código
            antes de utilizá-lo em produção.
          </p>
        `;

      case "banner":
        return `
          ${field("Título do banner", "pdBannerTitle", "PD TOOLS")}
          ${field(
            "Subtítulo",
            "pdBannerSubtitle",
            "Um projeto da Platform Destroyer"
          )}
          ${field("Cor de fundo", "pdBannerBg", "#09090f", "color")}
          ${field("Cor de destaque", "pdBannerAccent", "#a78bfa", "color")}
          ${actions([
            ["pdBannerMake", "Gerar banner"],
            ["pdBannerDownload", "Baixar PNG"]
          ])}
          <canvas
            id="pdBannerCanvas"
            width="1200"
            height="630"
          ></canvas>
        `;

      default:
        return `
          <div class="pd-premium-result">
            Não foi possível abrir esta ferramenta.
            Verifique se o arquivo JavaScript correspondente
            está carregado no site.
          </div>
        `;
    }
  }

  function wireHTMLStudio() {
    const input = $("#pdHtmlInput");
    const frame = $("#pdHtmlPreview");

    $("#pdHtmlPreviewBtn").onclick = () => {
      frame.srcdoc = input.value;
    };

    $("#pdHtmlDownload").onclick = () => {
      downloadText(
        input.value,
        "pdtools-pagina.html",
        "text/html"
      );
    };

    frame.srcdoc = input.value;
  }

  function wireJSONStudio() {
    const input = $("#pdJsonInput");

    function process(compact = false) {
      try {
        const parsed = JSON.parse(input.value);
        const output = JSON.stringify(
          parsed,
          null,
          compact ? 0 : 2
        );

        input.value = output;

        setResult(
          "pdJsonResult",
          "✓ JSON válido\n\n" + output
        );

        return output;
      } catch (error) {
        setResult(
          "pdJsonResult",
          "JSON inválido: " + error.message
        );
        return null;
      }
    }

    $("#pdJsonFormat").onclick = () => process(false);
    $("#pdJsonCompact").onclick = () => process(true);

    $("#pdJsonDownload").onclick = () => {
      const output = process(false);

      if (output !== null) {
        downloadText(
          output,
          "pdtools-dados.json",
          "application/json"
        );
      }
    };
  }

  function parseTime(value) {
    const match = value.trim().match(
      /^(\d{1,2}):([0-5]\d):([0-5]\d)(?:[,.](\d{1,3}))?$/
    );

    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const millis = Number(
      (match[4] || "0").padEnd(3, "0")
    );

    const total =
      ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;

    const formatted =
      String(hours).padStart(2, "0") + ":" +
      String(minutes).padStart(2, "0") + ":" +
      String(seconds).padStart(2, "0") + "," +
      String(millis).padStart(3, "0");

    return { total, formatted };
  }

  function wireSRT() {
    const input = $("#pdSrtInput");
    let generated = "";

    function generate() {
      const lines = input.value
        .split(/\r?\n/)
        .filter(line => line.trim());

      const entries = [];

      for (const [index, line] of lines.entries()) {
        const parts = line.split("|");

        if (parts.length < 3) {
          setResult(
            "pdSrtResult",
            `Erro na linha ${index + 1}: use início | fim | texto`
          );
          generated = "";
          return false;
        }

        const start = parseTime(parts[0]);
        const end = parseTime(parts[1]);
        const caption = parts.slice(2).join("|").trim();

        if (!start || !end || end.total <= start.total || !caption) {
          setResult(
            "pdSrtResult",
            `Erro na linha ${index + 1}: confira os horários e o texto.`
          );
          generated = "";
          return false;
        }

        entries.push(
          `${index + 1}\n${start.formatted} --> ${end.formatted}\n${caption}`
        );
      }

      if (!entries.length) {
        setResult(
          "pdSrtResult",
          "Adicione pelo menos uma legenda."
        );
        generated = "";
        return false;
      }

      generated = entries.join("\n\n") + "\n";
      setResult("pdSrtResult", generated);
      return true;
    }

    $("#pdSrtGenerate").onclick = generate;

    $("#pdSrtDownload").onclick = () => {
      if (generate()) {
        downloadText(
          generated,
          "pdtools-legendas.srt"
        );
      }
    };
  }

  function wireMinifier() {
    const input = $("#pdMinInput");
    const output = $("#pdMinOutput");
    const type = $("#pdMinType");

    function minify() {
      let result = input.value;

      if (type.value === "html") {
        result = result
          .replace(/>\s+</g, "><")
          .trim();
      }

      if (type.value === "css") {
        result = result
          .replace(/\s+/g, " ")
          .replace(/\s*([{};:,])\s*/g, "$1")
          .replace(/;}/g, "}")
          .trim();
      }

      if (type.value === "js") {
        result = result
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean)
          .join("\n");
      }

      output.value = result;
      return result;
    }

    $("#pdMinRun").onclick = minify;

    $("#pdMinCopy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(output.value);

        if (typeof toast === "function") {
          toast("Código copiado!");
        }
      } catch {
        output.select();

        if (typeof toast === "function") {
          toast("Selecione e copie o resultado.");
        }
      }
    };

    $("#pdMinDownload").onclick = () => {
      const result = minify();

      const extensions = {
        html: "html",
        css: "css",
        js: "js"
      };

      downloadText(
        result,
        `pdtools-minificado.${extensions[type.value]}`
      );
    };
  }

  function wireBanner() {
    const canvas = $("#pdBannerCanvas");
    const ctx = canvas.getContext("2d");

    function draw() {
      const title = $("#pdBannerTitle").value || "PD TOOLS";
      const subtitle = $("#pdBannerSubtitle").value || "";
      const background = $("#pdBannerBg").value;
      const accent = $("#pdBannerAccent").value;

      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = accent;
      ctx.fillRect(90, 115, 8, 400);

      ctx.textBaseline = "middle";

      let fontSize = 82;

      do {
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;

        if (ctx.measureText(title).width <= 990) break;

        fontSize -= 2;
      } while (fontSize > 22);

      ctx.fillStyle = "#ffffff";
      ctx.fillText(title, 130, 270, 990);

      ctx.font = "32px Arial, sans-serif";
      ctx.fillStyle = accent;

      const words = subtitle.split(/\s+/);
      const lines = [];
      let line = "";

      for (const word of words) {
        const candidate = line
          ? line + " " + word
          : word;

        if (ctx.measureText(candidate).width > 950 && line) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }

      if (line) lines.push(line);

      lines.slice(0, 3).forEach((text, index) => {
        ctx.fillText(
          text,
          130,
          355 + index * 44,
          950
        );
      });

      ctx.fillStyle = "#77717f";
      ctx.font = "22px Arial, sans-serif";
      ctx.fillText("PD TOOLS", 130, 545);
    }

    $("#pdBannerMake").onclick = draw;

    $("#pdBannerDownload").onclick = () => {
      draw();

      canvas.toBlob(blob => {
        if (blob) {
          downloadBlob(
            blob,
            "pdtools-banner.png"
          );
        }
      }, "image/png");
    };

    draw();
  }

  async function openPremiumTool(id) {
    const tool = premiumTools.find(item => item.id === id);

    if (!tool || !premiumSelected) return;
    if (!premiumVerified) {
      const notice = document.getElementById("premiumBannerMessage");
      if (notice) notice.textContent = "A ferramenta “" + tool.name + "” faz parte do Premium. Acesso por R$ 5,00 durante 30 dias.";
      document.getElementById("assinar-premium")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    // Ferramentas externas possuem seus próprios eventos.
    // Não abrir aqui para evitar janelas duplicadas.
    if (externalTools.has(id)) return;

    try {
      const allowed = await hasPremium();

      if (!allowed) {
        premiumVerified = false;

        showMessage(
          "🔒 Premium bloqueado",
          "Seu acesso Premium não está ativo."
        );
        return;
      }
    } catch (error) {
      console.error("Erro ao validar Premium:", error);

      showMessage(
        "Erro ao verificar Premium",
        "Tente novamente."
      );
      return;
    }

    $("#modalTitle").textContent = tool.name;
    $("#modalCategory").textContent = "PD TOOLS PREMIUM";

    if (
      typeof activeToolInterval !== "undefined" &&
      activeToolInterval
    ) {
      clearInterval(activeToolInterval);
      activeToolInterval = null;
    }

    content.innerHTML = toolHTML(id);
    modal.classList.add("show");

    switch (id) {
      case "html-studio":
        wireHTMLStudio();
        break;

      case "json-studio":
        wireJSONStudio();
        break;

      case "srt":
        wireSRT();
        break;

      case "minifier":
        wireMinifier();
        break;

      case "banner":
        wireBanner();
        break;
    }
  }

  // Intercepta os filtros antes do app.js.
  filters.addEventListener("click", event => {
    const button = event.target.closest("button[data-cat]");

    if (!button || !filters.contains(button)) return;

    event.stopPropagation();
    event.preventDefault();

    if (button.dataset.cat === "Premium") {
      showPremium();
    } else {
      showFreeTools(button.dataset.cat);
    }
  }, true);

  // Ferramentas internas.
  grid.addEventListener("click", event => {
    const card = event.target.closest("[data-premium-tool]");

    if (!card || !grid.contains(card)) return;

    openPremiumTool(card.dataset.premiumTool);
  });

  grid.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const card = event.target.closest("[data-premium-tool]");

    if (!card || !grid.contains(card)) return;

    event.preventDefault();
    openPremiumTool(card.dataset.premiumTool);
  });

  // Mantém a busca Premium funcionando.
  if (search) {
    search.addEventListener("input", () => {
      if (premiumSelected) {
        renderPremiumCards();
      }
    });
  }

  // Restaura o botão Premium quando o app.js
  // recriar a lista de categorias.
  const observer = new MutationObserver(() => {
    if (!filters.querySelector('[data-cat="Premium"]')) {
      addPremiumButton();
    }
  });

  observer.observe(filters, { childList: true });

  // Restaura os cards quando o app.js
  // atualizar as ferramentas gratuitas.
  const gridObserver = new MutationObserver(() => {
    if (!premiumSelected) return;

    if (!premiumVerified) {
      if (grid.querySelector("[data-tool]")) renderPremiumCards();
      return;
    }

    if (grid.querySelector("[data-tool]")) {
      renderPremiumCards();
    }
  });

  gridObserver.observe(grid, { childList: true });

  client.auth.onAuthStateChange(event => {
    if (
      premiumSelected &&
      (event === "SIGNED_IN" || event === "SIGNED_OUT")
    ) {
      setTimeout(showPremium, 0);
    }
  });

  addPremiumButton();

  console.log("PD Tools Premium: 35 ferramentas cadastradas.");
})();
