
/* PD Tools Premium — QR Code Avançado */
(() => {
  "use strict";

  const TOOL_ID = "advanced-qr";
  const grid = document.getElementById("toolGrid");
  const modal = document.getElementById("toolModal");
  const content = document.getElementById("toolContent");

  if (!grid || !modal || !content) return;

  const getClient = () =>
    window.supabaseClient ||
    (typeof supabaseClient !== "undefined" ? supabaseClient : null);

  async function hasPremium() {
    const client = getClient();
    if (!client) return false;

    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();

    if (sessionError || !sessionData?.session?.user) return false;

    const { data: userData, error: userError } =
      await client.auth.getUser();

    if (userError || !userData?.user) return false;

    const { data, error } = await client
      .from("premium_access")
      .select("expires_at")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (error) throw error;

    return Boolean(
      data?.expires_at &&
      Date.parse(data.expires_at) > Date.now()
    );
  }

  function loadQRLibrary() {
    if (typeof QRCode !== "undefined") return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
      script.onload = resolve;
      script.onerror = () => reject(
        new Error("Não foi possível carregar a biblioteca QR Code.")
      );
      document.head.appendChild(script);
    });
  }

  function downloadCanvas(canvas, filename) {
    canvas.toBlob(blob => {
      if (!blob) {
        alert("Não foi possível gerar o PNG.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 3000);
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
        alert("Você precisa de um Premium ativo para usar esta ferramenta.");
        return;
      }

      await loadQRLibrary();
    } catch (error) {
      console.error(error);
      alert("Não foi possível verificar o acesso ou carregar o QR Code.");
      return;
    }

    document.getElementById("modalTitle").textContent =
      "QR Code Avançado";

    document.getElementById("modalCategory").textContent =
      "PD TOOLS PREMIUM";

    content.innerHTML = `
      <div class="pd-premium-field">
        <label for="pdQrText">Link ou texto</label>
        <textarea
          id="pdQrText"
          rows="3"
          placeholder="https://seusite.com"
        >https://pdtools.vercel.app</textarea>
      </div>

      <div class="pd-premium-field">
        <label for="pdQrSize">Tamanho</label>
        <select id="pdQrSize">
          <option value="256">256 × 256</option>
          <option value="512" selected>512 × 512</option>
          <option value="1024">1024 × 1024</option>
        </select>
      </div>

      <div class="pd-premium-field">
        <label for="pdQrForeground">Cor do QR Code</label>
        <input id="pdQrForeground" type="color" value="#7c3aed">
      </div>

      <div class="pd-premium-field">
        <label for="pdQrBackground">Cor do fundo</label>
        <input id="pdQrBackground" type="color" value="#ffffff">
      </div>

      <div class="pd-premium-field">
        <label for="pdQrLogo">Logo no centro (opcional)</label>
        <input
          id="pdQrLogo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
        >
      </div>

      <div class="pd-premium-actions">
        <button class="action" id="pdQrGenerate" type="button">
          Gerar QR Code
        </button>

        <button class="secondary" id="pdQrDownload" type="button" disabled>
          Baixar PNG
        </button>
      </div>

      <div
        id="pdQrPreview"
        style="margin-top:20px;display:flex;justify-content:center"
      ></div>

      <p id="pdQrMessage" role="status" style="margin-top:12px"></p>

      <p style="font-size:12px;color:#999;margin-top:12px">
        Dica: use cores com bastante contraste. Uma logo muito grande
        pode dificultar a leitura do QR Code.
      </p>
    `;

    modal.classList.add("show");

    const textInput = document.getElementById("pdQrText");
    const sizeInput = document.getElementById("pdQrSize");
    const foregroundInput = document.getElementById("pdQrForeground");
    const backgroundInput = document.getElementById("pdQrBackground");
    const logoInput = document.getElementById("pdQrLogo");
    const generateButton = document.getElementById("pdQrGenerate");
    const downloadButton = document.getElementById("pdQrDownload");
    const preview = document.getElementById("pdQrPreview");
    const message = document.getElementById("pdQrMessage");

    let outputCanvas = null;
    let generationId = 0;

    function invalidate() {
      generationId++;
      outputCanvas = null;
      downloadButton.disabled = true;
      message.textContent = "Clique em Gerar QR Code para atualizar.";
    }

    [
      textInput,
      sizeInput,
      foregroundInput,
      backgroundInput,
      logoInput
    ].forEach(input => input.addEventListener("input", invalidate));

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
        message.textContent = "Use um texto de até 1000 bytes.";
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
          throw new Error("A biblioteca não gerou o QR Code.");
        }

        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas indisponível.");

        ctx.drawImage(qrCanvas, 0, 0, size, size);

        const logoFile = logoInput.files?.[0];

        if (logoFile) {
          if (!logoFile.type.startsWith("image/")) {
            throw new Error("Selecione uma imagem válida para a logo.");
          }

          const image = await loadImage(logoFile);

          if (requestId !== generationId) return;

          const logoSize = Math.round(size * 0.16);
          const padding = Math.round(size * 0.025);
          const boxSize = logoSize + padding * 2;
          const boxX = (size - boxSize) / 2;
          const boxY = (size - boxSize) / 2;

          ctx.fillStyle = backgroundInput.value;
          ctx.fillRect(boxX, boxY, boxSize, boxSize);

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

        if (requestId !== generationId) return;

        preview.innerHTML = "";
        canvas.style.cssText =
          "width:100%;max-width:320px;height:auto;" +
          "border-radius:10px;display:block";

        preview.appendChild(canvas);

        outputCanvas = canvas;
        downloadButton.disabled = false;
        message.textContent = "QR Code gerado com sucesso!";
      } catch (error) {
        console.error(error);

        if (requestId === generationId) {
          message.textContent =
            error.message || "Erro ao gerar QR Code.";
        }
      } finally {
        temporary.remove();
        generateButton.disabled = false;
      }
    }

    generateButton.onclick = generate;

    downloadButton.onclick = () => {
      if (outputCanvas) {
        downloadCanvas(outputCanvas, "pdtools-qrcode.png");
      }
    };

    generate();
  }

  // Abre o QR Code Premium sem alterar as ferramentas gratuitas.
  grid.addEventListener("click", event => {
    const card = event.target.closest(
      '[data-premium-tool="advanced-qr"]'
    );

    if (!card || !grid.contains(card)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    openQRCode();
  }, true);

  grid.addEventListener("keydown", event => {
    const card = event.target.closest(
      '[data-premium-tool="advanced-qr"]'
    );

    if (!card || !["Enter", " "].includes(event.key)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    openQRCode();
  }, true);

  console.log("PD Tools: QR Code Avançado carregado.");
})();
