
/* ==========================================
   PD TOOLS PREMIUM — QR CODE AVANÇADO
   Desenvolvedores: Kraz & HZ
   ========================================== */

(() => {
  "use strict";

  const TOOL_ID = "qr-advanced";

  const grid = document.getElementById("toolGrid");
  const modal = document.getElementById("toolModal");
  const content = document.getElementById("toolContent");

  if (!grid || !modal || !content) {
    console.error("PD Tools: elementos do QR Code não encontrados.");
    return;
  }

  function getClient() {
    if (window.supabaseClient) {
      return window.supabaseClient;
    }

    if (typeof supabaseClient !== "undefined") {
      return supabaseClient;
    }

    return null;
  }

  async function hasPremium() {
    const client = getClient();

    if (!client) {
      throw new Error("Supabase indisponível.");
    }

    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!sessionData?.session?.user) {
      return false;
    }

    const { data: userData, error: userError } =
      await client.auth.getUser();

    if (userError || !userData?.user) {
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

    const expires = Date.parse(data?.expires_at || "");

    return Number.isFinite(expires) && expires > Date.now();
  }

  function loadQRLibrary() {
    if (typeof QRCode !== "undefined") {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const existing = document.querySelector(
        'script[data-pd-qr-library="true"]'
      );

      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Erro ao carregar QR Code.")),
          { once: true }
        );
        return;
      }

      const script = document.createElement("script");

      script.dataset.pdQrLibrary = "true";
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";

      script.onload = resolve;

      script.onerror = () => {
        reject(
          new Error("Não foi possível carregar a biblioteca QR Code.")
        );
      };

      document.head.appendChild(script);
    });
  }

  function downloadCanvas(canvas, filename) {
    canvas.toBlob(blob => {
      if (!blob) {
        alert("Não foi possível gerar o arquivo PNG.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 3000);
    }, "image/png");
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
        reject(new Error("Não foi possível abrir a logo."));
      };

      image.src = url;
    });
  }

  async function openQRCode() {
    try {
      const allowed = await hasPremium();

      if (!allowed) {
        alert(
          "Você precisa de um Premium ativo para usar esta ferramenta."
        );
        return;
      }

      await loadQRLibrary();
    } catch (error) {
      console.error("PD Tools QR Code:", error);

      alert(
        "Não foi possível verificar seu Premium ou carregar o QR Code."
      );
      return;
    }

    const title = document.getElementById("modalTitle");
    const category = document.getElementById("modalCategory");

    if (title) {
      title.textContent = "QR Code avançado";
    }

    if (category) {
      category.textContent = "PD TOOLS PREMIUM";
    }

    content.innerHTML = `
      <div class="pd-premium-field">
        <label for="pdQrText">Link ou texto</label>

        <textarea
          id="pdQrText"
          rows="3"
          placeholder="Digite um link ou texto..."
        >https://pdtools.vercel.app</textarea>
      </div>

      <div class="pd-premium-field">
        <label for="pdQrSize">Tamanho do QR Code</label>

        <select id="pdQrSize">
          <option value="256">256 × 256</option>
          <option value="512" selected>512 × 512</option>
          <option value="1024">1024 × 1024</option>
        </select>
      </div>

      <div class="pd-premium-field">
        <label for="pdQrForeground">Cor do QR Code</label>

        <input
          id="pdQrForeground"
          type="color"
          value="#7c3aed"
        >
      </div>

      <div class="pd-premium-field">
        <label for="pdQrBackground">Cor do fundo</label>

        <input
          id="pdQrBackground"
          type="color"
          value="#ffffff"
        >
      </div>

      <div class="pd-premium-field">
        <label for="pdQrLogo">Adicionar logo (opcional)</label>

        <input
          id="pdQrLogo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
        >
      </div>

      <div class="pd-premium-actions">
        <button
          class="action"
          id="pdQrGenerate"
          type="button"
        >
          Gerar QR Code
        </button>

        <button
          class="secondary"
          id="pdQrDownload"
          type="button"
          disabled
        >
          Baixar PNG
        </button>
      </div>

      <div
        id="pdQrPreview"
        style="
          margin-top:20px;
          display:flex;
          justify-content:center;
        "
      ></div>

      <p
        id="pdQrMessage"
        role="status"
        style="margin-top:12px;color:#c3b4ff"
      ></p>

      <p
        style="
          font-size:12px;
          color:#999;
          margin-top:12px;
        "
      >
        Use cores com bom contraste para facilitar
        a leitura do QR Code. Logos muito grandes
        podem dificultar a leitura.
      </p>
    `;

    modal.classList.add("show");

    const textInput = document.getElementById("pdQrText");
    const sizeInput = document.getElementById("pdQrSize");
    const foregroundInput =
      document.getElementById("pdQrForeground");
    const backgroundInput =
      document.getElementById("pdQrBackground");
    const logoInput = document.getElementById("pdQrLogo");

    const generateButton =
      document.getElementById("pdQrGenerate");
    const downloadButton =
      document.getElementById("pdQrDownload");

    const preview = document.getElementById("pdQrPreview");
    const message = document.getElementById("pdQrMessage");

    let outputCanvas = null;
    let generationId = 0;

    function invalidate() {
      generationId++;
      outputCanvas = null;
      downloadButton.disabled = true;

      message.textContent =
        "Clique em Gerar QR Code para atualizar.";
    }

    [
      textInput,
      sizeInput,
      foregroundInput,
      backgroundInput,
      logoInput
    ].forEach(input => {
      input.addEventListener("input", invalidate);
      input.addEventListener("change", invalidate);
    });

    async function generate() {
      const requestId = ++generationId;

      const value = textInput.value.trim();
      const size = Number(sizeInput.value);

      if (!value) {
        message.textContent = "Digite um link ou texto.";
        downloadButton.disabled = true;
        return;
      }

      if (new TextEncoder().encode(value).length > 1000) {
        message.textContent =
          "Texto muito longo. Use no máximo 1000 bytes.";
        downloadButton.disabled = true;
        return;
      }

      generateButton.disabled = true;
      downloadButton.disabled = true;

      message.textContent = "Gerando QR Code...";

      const temporary = document.createElement("div");

      temporary.style.cssText =
        "position:absolute;left:-99999px;top:-99999px";

      document.body.appendChild(temporary);

      try {
        new QRCode(temporary, {
          text: value,
          width: size,
          height: size,
          colorDark: foregroundInput.value,
          colorLight: backgroundInput.value,
          correctLevel: QRCode.CorrectLevel.H
        });

        const qrCanvas = temporary.querySelector("canvas");

        if (!qrCanvas) {
          throw new Error(
            "A biblioteca não conseguiu gerar o QR Code."
          );
        }

        const canvas = document.createElement("canvas");

        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Canvas indisponível.");
        }

        ctx.drawImage(qrCanvas, 0, 0, size, size);

        const logoFile = logoInput.files?.[0];

        if (logoFile) {
          const acceptedTypes = [
            "image/png",
            "image/jpeg",
            "image/webp"
          ];

          if (!acceptedTypes.includes(logoFile.type)) {
            throw new Error(
              "Selecione uma logo PNG, JPG ou WebP."
            );
          }

          const image = await loadImage(logoFile);

          if (requestId !== generationId) {
            return;
          }

          const logoSize = Math.round(size * 0.16);
          const padding = Math.round(size * 0.025);

          const boxSize = logoSize + padding * 2;
          const boxX = (size - boxSize) / 2;
          const boxY = (size - boxSize) / 2;

          ctx.fillStyle = backgroundInput.value;

          ctx.fillRect(
            boxX,
            boxY,
            boxSize,
            boxSize
          );

          const ratio = Math.min(
            logoSize / image.naturalWidth,
            logoSize / image.naturalHeight
          );

          const width = image.naturalWidth * ratio;
          const height = image.naturalHeight * ratio;

          ctx.drawImage(
            image,
            (size - width) / 2,
            (size - height) / 2,
            width,
            height
          );
        }

        if (requestId !== generationId) {
          return;
        }

        preview.innerHTML = "";

        canvas.style.cssText = `
          width:100%;
          max-width:320px;
          height:auto;
          border-radius:10px;
          display:block;
        `;

        preview.appendChild(canvas);

        outputCanvas = canvas;

        downloadButton.disabled = false;

        message.textContent =
          "QR Code gerado com sucesso! 💜";
      } catch (error) {
        console.error("Erro ao gerar QR Code:", error);

        if (requestId === generationId) {
          outputCanvas = null;
          downloadButton.disabled = true;

          message.textContent =
            error.message || "Erro ao gerar QR Code.";
        }
      } finally {
        temporary.remove();
        generateButton.disabled = false;
      }
    }

    generateButton.addEventListener("click", generate);

    downloadButton.addEventListener("click", () => {
      if (!outputCanvas) {
        return;
      }

      downloadCanvas(
        outputCanvas,
        "pdtools-qrcode.png"
      );
    });

    generate();
  }

  // Intercepta o clique antes do premium-filter.js.
  grid.addEventListener("click", event => {
    const card = event.target.closest(
      `[data-premium-tool="${TOOL_ID}"]`
    );

    if (!card || !grid.contains(card)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    openQRCode();
  }, true);

  // Permite abrir usando Enter ou Espaço.
  grid.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const card = event.target.closest(
      `[data-premium-tool="${TOOL_ID}"]`
    );

    if (!card || !grid.contains(card)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    openQRCode();
  }, true);

  console.log(
    "PD Tools Premium: QR Code Avançado carregado."
  );
})();
