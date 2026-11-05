
/* ==========================================
   PD TOOLS PREMIUM — MARCA D'ÁGUA EM LOTE
   Desenvolvedores: Kraz & HZ
   ========================================== */

(() => {
  "use strict";

  const TOOL_ID = "watermark";

  const grid = document.getElementById("toolGrid");
  const modal = document.getElementById("toolModal");
  const content = document.getElementById("toolContent");

  if (!grid || !modal || !content) return;

  function getClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof supabaseClient !== "undefined") return supabaseClient;
    return null;
  }

  async function hasPremium() {
    const client = getClient();
    if (!client) throw new Error("Supabase indisponível.");

    const { data: session, error: sessionError } =
      await client.auth.getSession();

    if (sessionError) throw sessionError;
    if (!session?.session?.user) return false;

    const { data: userData, error: userError } =
      await client.auth.getUser();

    if (userError || !userData?.user) return false;

    const { data, error } = await client
      .from("premium_access")
      .select("expires_at")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (error) throw error;

    const expires = Date.parse(data?.expires_at || "");
    return Number.isFinite(expires) && expires > Date.now();
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível abrir a imagem."));
      };

      image.src = url;
    });
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("Não foi possível gerar o PNG."));
      }, "image/png");
    });
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) {
      return (bytes / 1024).toFixed(1) + " KB";
    }
    return (bytes / 1048576).toFixed(2) + " MB";
  }

  function getPosition(position, width, height, markWidth, markHeight) {
    const margin = Math.max(12, Math.round(Math.min(width, height) * 0.04));

    const positions = {
      "top-left": [margin, margin],
      "top-center": [(width - markWidth) / 2, margin],
      "top-right": [width - markWidth - margin, margin],

      "center-left": [margin, (height - markHeight) / 2],
      "center": [(width - markWidth) / 2, (height - markHeight) / 2],
      "center-right": [width - markWidth - margin, (height - markHeight) / 2],

      "bottom-left": [margin, height - markHeight - margin],
      "bottom-center": [(width - markWidth) / 2, height - markHeight - margin],
      "bottom-right": [
        width - markWidth - margin,
        height - markHeight - margin
      ]
    };

    return positions[position] || positions["bottom-right"];
  }

  function drawWatermark(image, settings, logoImage) {
    const canvas = document.createElement("canvas");

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível.");

    ctx.drawImage(image, 0, 0);

    const width = canvas.width;
    const height = canvas.height;
    const shortest = Math.min(width, height);

    ctx.save();
    ctx.globalAlpha = settings.opacity;

    if (settings.mode === "logo") {
      if (!logoImage) {
        throw new Error("Selecione uma logo.");
      }

      const maxWidth = width * (settings.size / 100);
      const maxHeight = height * (settings.size / 100);

      const ratio = Math.min(
        maxWidth / logoImage.naturalWidth,
        maxHeight / logoImage.naturalHeight
      );

      const logoWidth = logoImage.naturalWidth * ratio;
      const logoHeight = logoImage.naturalHeight * ratio;

      const [x, y] = getPosition(
        settings.position,
        width,
        height,
        logoWidth,
        logoHeight
      );

      ctx.drawImage(
        logoImage,
        x,
        y,
        logoWidth,
        logoHeight
      );
    } else {
      const text = settings.text.trim();

      if (!text) {
        throw new Error("Digite o texto da marca d'água.");
      }

      let fontSize = Math.max(
        10,
        Math.round(shortest * (settings.size / 100) * 0.35)
      );

      ctx.textBaseline = "top";

      do {
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        if (ctx.measureText(text).width <= width * 0.9) break;
        fontSize -= 2;
      } while (fontSize > 10);

      const textWidth = ctx.measureText(text).width;
      const textHeight = fontSize * 1.2;

      const [x, y] = getPosition(
        settings.position,
        width,
        height,
        textWidth,
        textHeight
      );

      ctx.fillStyle = settings.color;
      ctx.fillText(text, x, y);
    }

    ctx.restore();

    return canvas;
  }

  async function openWatermark() {
    try {
      const allowed = await hasPremium();

      if (!allowed) {
        alert("Você precisa de um Premium ativo para usar esta ferramenta.");
        return;
      }
    } catch (error) {
      console.error(error);
      alert("Não foi possível verificar seu acesso Premium.");
      return;
    }

    document.getElementById("modalTitle").textContent =
      "Marca d'água em lote";

    document.getElementById("modalCategory").textContent =
      "PD TOOLS PREMIUM";

    content.innerHTML = `
      <div class="pd-premium-field">
        <label for="pdWatermarkFiles">Selecionar imagens</label>
        <input
          id="pdWatermarkFiles"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
        >
      </div>

      <div class="pd-premium-field">
        <label for="pdWatermarkMode">Tipo de marca d'água</label>
        <select id="pdWatermarkMode">
          <option value="text">Texto</option>
          <option value="logo">Logo / Imagem</option>
        </select>
      </div>

      <div id="pdWatermarkTextArea" class="pd-premium-field">
        <label for="pdWatermarkText">Texto</label>
        <input
          id="pdWatermarkText"
          type="text"
          value="PD TOOLS"
          maxlength="150"
        >
      </div>

      <div id="pdWatermarkLogoArea" class="pd-premium-field" hidden>
        <label for="pdWatermarkLogo">Selecionar logo</label>
        <input
          id="pdWatermarkLogo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
        >
      </div>

      <div class="pd-premium-field">
        <label for="pdWatermarkPosition">Posição</label>
        <select id="pdWatermarkPosition">
          <option value="top-left">Superior esquerdo</option>
          <option value="top-center">Superior central</option>
          <option value="top-right">Superior direito</option>
          <option value="center-left">Centro esquerdo</option>
          <option value="center">Centro</option>
          <option value="center-right">Centro direito</option>
          <option value="bottom-left">Inferior esquerdo</option>
          <option value="bottom-center">Inferior central</option>
          <option value="bottom-right" selected>Inferior direito</option>
        </select>
      </div>

      <div class="pd-premium-field">
        <label for="pdWatermarkSize">Tamanho: 25%</label>
        <input
          id="pdWatermarkSize"
          type="range"
          min="5"
          max="80"
          value="25"
        >
      </div>

      <div class="pd-premium-field">
        <label for="pdWatermarkOpacity">Transparência: 60%</label>
        <input
          id="pdWatermarkOpacity"
          type="range"
          min="5"
          max="100"
          value="60"
        >
      </div>

      <div class="pd-premium-field" id="pdWatermarkColorArea">
        <label for="pdWatermarkColor">Cor do texto</label>
        <input
          id="pdWatermarkColor"
          type="color"
          value="#ffffff"
        >
      </div>

      <div class="pd-premium-actions">
        <button
          class="action"
          id="pdWatermarkGenerate"
          type="button"
        >
          Aplicar marca d'água
        </button>

        <button
          class="secondary"
          id="pdWatermarkZip"
          type="button"
          disabled
        >
          Baixar todas em ZIP
        </button>
      </div>

      <div class="pd-premium-result" id="pdWatermarkResult">
        Selecione as imagens para começar.
      </div>

      <p style="font-size:12px;color:#999;margin-top:12px">
        Máximo de 30 imagens por vez. Os arquivos são processados
        no seu navegador e exportados em PNG.
        Imagens muito grandes podem consumir bastante memória.
      </p>
    `;

    modal.classList.add("show");

    const $ = id => document.getElementById(id);

    const filesInput = $("pdWatermarkFiles");
    const modeInput = $("pdWatermarkMode");
    const textInput = $("pdWatermarkText");
    const logoInput = $("pdWatermarkLogo");
    const positionInput = $("pdWatermarkPosition");
    const sizeInput = $("pdWatermarkSize");
    const opacityInput = $("pdWatermarkOpacity");
    const colorInput = $("pdWatermarkColor");

    const textArea = $("pdWatermarkTextArea");
    const logoArea = $("pdWatermarkLogoArea");
    const colorArea = $("pdWatermarkColorArea");

    const generateButton = $("pdWatermarkGenerate");
    const zipButton = $("pdWatermarkZip");
    const result = $("pdWatermarkResult");

    let converted = [];
    let processing = false;

    function resetResults() {
      if (processing) return;

      converted = [];
      zipButton.disabled = true;
      result.textContent = "Configurações atualizadas. Pronto para aplicar.";
    }

    modeInput.onchange = () => {
      const logoMode = modeInput.value === "logo";

      textArea.hidden = logoMode;
      logoArea.hidden = !logoMode;
      colorArea.hidden = logoMode;

      resetResults();
    };

    sizeInput.oninput = () => {
      sizeInput.previousElementSibling.textContent =
        `Tamanho: ${sizeInput.value}%`;

      resetResults();
    };

    opacityInput.oninput = () => {
      opacityInput.previousElementSibling.textContent =
        `Transparência: ${opacityInput.value}%`;

      resetResults();
    };

    [
      filesInput,
      textInput,
      logoInput,
      positionInput,
      colorInput
    ].forEach(input => {
      input.addEventListener("change", resetResults);
    });

    textInput.addEventListener("input", resetResults);

    generateButton.onclick = async () => {
      if (processing) return;

      const files = Array.from(filesInput.files || []);

      if (!files.length) {
        result.textContent = "Selecione pelo menos uma imagem.";
        return;
      }

      if (files.length > 30) {
        result.textContent = "Selecione no máximo 30 imagens.";
        return;
      }

      const acceptedTypes = [
        "image/png",
        "image/jpeg",
        "image/webp"
      ];

      if (files.some(file => !acceptedTypes.includes(file.type))) {
        result.textContent = "Use apenas imagens PNG, JPG ou WebP.";
        return;
      }

      if (modeInput.value === "logo" && !logoInput.files?.length) {
        result.textContent = "Selecione uma logo para continuar.";
        return;
      }

      const settings = {
        mode: modeInput.value,
        text: textInput.value,
        position: positionInput.value,
        size: Number(sizeInput.value),
        opacity: Number(opacityInput.value) / 100,
        color: colorInput.value
      };

      processing = true;
      generateButton.disabled = true;
      zipButton.disabled = true;
      converted = [];

      result.textContent = "Aplicando marca d'água...";

      const errors = [];

      try {
        let logoImage = null;

        if (settings.mode === "logo") {
          const logoFile = logoInput.files[0];

          if (!acceptedTypes.includes(logoFile.type)) {
            throw new Error("A logo precisa ser PNG, JPG ou WebP.");
          }

          logoImage = await loadImage(logoFile);
        }

        for (let index = 0; index < files.length; index++) {
          const file = files[index];

          try {
            const image = await loadImage(file);

            const canvas = drawWatermark(
              image,
              settings,
              logoImage
            );

            const blob = await canvasToBlob(canvas);

            const baseName = file.name
              .replace(/\.[^.]+$/, "")
              .replace(/[^a-zA-Z0-9_-]/g, "_")
              .slice(0, 70) || "imagem";

            converted.push({
              filename: `${baseName}-marca-${index + 1}.png`,
              blob
            });
          } catch (error) {
            errors.push(`${file.name}: ${error.message}`);
          }
        }

        result.innerHTML = "";

        const summary = document.createElement("p");

        summary.textContent =
          `${converted.length} de ${files.length} imagens processadas.`;

        result.appendChild(summary);

        converted.forEach(item => {
          const line = document.createElement("div");

          line.style.cssText = `
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:12px;
            padding:10px 0;
            border-bottom:1px solid #302a3c;
            flex-wrap:wrap;
          `;

          const name = document.createElement("span");

          name.textContent =
            `${item.filename} (${formatBytes(item.blob.size)})`;

          const button = document.createElement("button");

          button.type = "button";
          button.className = "secondary";
          button.textContent = "Baixar PNG";

          button.onclick = () => {
            download(item.blob, item.filename);
          };

          line.append(name, button);
          result.appendChild(line);
        });

        if (errors.length) {
          const errorBox = document.createElement("p");

          errorBox.style.color = "#fca5a5";
          errorBox.textContent = errors.join("\n");

          result.appendChild(errorBox);
        }

        zipButton.disabled = converted.length === 0;
      } catch (error) {
        console.error(error);
        result.textContent = error.message || "Erro ao processar imagens.";
      } finally {
        processing = false;
        generateButton.disabled = false;
      }
    };

    zipButton.onclick = async () => {
      if (!converted.length) return;

      if (typeof JSZip === "undefined") {
        alert("Biblioteca ZIP indisponível. Atualize a página.");
        return;
      }

      zipButton.disabled = true;
      zipButton.textContent = "Preparando ZIP...";

      try {
        const zip = new JSZip();

        converted.forEach(item => {
          zip.file(item.filename, item.blob);
        });

        const blob = await zip.generateAsync({
          type: "blob",
          compression: "STORE"
        });

        download(blob, "pdtools-marcas-dagua.zip");
      } catch (error) {
        console.error(error);
        alert("Não foi possível gerar o ZIP.");
      } finally {
        zipButton.disabled = false;
        zipButton.textContent = "Baixar todas em ZIP";
      }
    };
  }

  // Captura os cliques antes do premium-filter.js.
  grid.addEventListener("click", event => {
    const card = event.target.closest(
      `[data-premium-tool="${TOOL_ID}"]`
    );

    if (!card || !grid.contains(card)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    openWatermark();
  }, true);

  // Suporte a teclado.
  grid.addEventListener("keydown", event => {
    if (!["Enter", " "].includes(event.key)) return;

    const card = event.target.closest(
      `[data-premium-tool="${TOOL_ID}"]`
    );

    if (!card || !grid.contains(card)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    openWatermark();
  }, true);

  console.log("PD Tools: Marca d'água em lote carregada.");
})();
