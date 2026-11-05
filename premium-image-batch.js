
/* PD Tools Premium — Conversor de imagens em lote */

(() => {
  "use strict";

  const TOOL_ID = "image-batch";
  const grid = document.getElementById("toolGrid");
  const modal = document.getElementById("toolModal");
  const content = document.getElementById("toolContent");

  if (!grid || !modal || !content) return;

  const escapeHTML = value => String(value).replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );

  const formatBytes = bytes => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  const download = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  async function checkAccess() {
    const client = window.supabaseClient ||
      (typeof supabaseClient !== "undefined" ? supabaseClient : null);

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

  function fileToBlob(file, type, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(url);

        try {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;

          if (!canvas.width || !canvas.height) {
            reject(new Error("Imagem inválida."));
            return;
          }

          const ctx = canvas.getContext("2d");

          if (!ctx) {
            reject(new Error("Canvas indisponível."));
            return;
          }

          if (type === "image/jpeg") {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          ctx.drawImage(image, 0, 0);

          canvas.toBlob(
            blob => {
              if (!blob) {
                reject(new Error("Formato não suportado pelo navegador."));
                return;
              }

              if (blob.type !== type) {
                reject(new Error("Este navegador não suporta a conversão selecionada."));
                return;
              }

              resolve(blob);
            },
            type,
            quality
          );
        } catch (error) {
          reject(error);
        }
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível abrir esta imagem."));
      };

      image.src = url;
    });
  }

  async function openConverter() {
    let allowed = false;

    try {
      allowed = await checkAccess();
    } catch (error) {
      console.error("Erro de verificação Premium:", error);
      alert("Não foi possível verificar seu acesso Premium.");
      return;
    }

    if (!allowed) {
      alert("Você precisa de um Premium ativo para usar esta ferramenta.");
      return;
    }

    document.getElementById("modalTitle").textContent =
      "Conversor de imagens em lote";

    document.getElementById("modalCategory").textContent =
      "PD TOOLS PREMIUM";

    content.innerHTML = `
      <div class="pd-premium-field">
        <label for="pdBatchFiles">Selecionar imagens</label>
        <input
          id="pdBatchFiles"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
        >
      </div>

      <div class="pd-premium-field">
        <label for="pdBatchFormat">Converter para</label>
        <select id="pdBatchFormat">
          <option value="image/png">PNG</option>
          <option value="image/jpeg">JPG</option>
          <option value="image/webp">WebP</option>
        </select>
      </div>

      <div class="pd-premium-field">
        <label for="pdBatchQuality">Qualidade JPG / WebP: 90%</label>
        <input
          id="pdBatchQuality"
          type="range"
          min="10"
          max="100"
          value="90"
        >
      </div>

      <div class="pd-premium-actions">
        <button class="action" id="pdBatchConvert" type="button">
          Converter imagens
        </button>
        <button class="secondary" id="pdBatchZip" type="button" disabled>
          Baixar todas em ZIP
        </button>
      </div>

      <div class="pd-premium-result" id="pdBatchResult">
        Selecione as imagens para começar.
      </div>

      <p style="font-size:12px;color:#999;margin-top:12px">
        Suporta PNG, JPG e WebP. As imagens são processadas
        no seu navegador. Imagens muito grandes podem exigir
        bastante memória.
      </p>
    `;

    modal.classList.add("show");

    const filesInput = document.getElementById("pdBatchFiles");
    const formatInput = document.getElementById("pdBatchFormat");
    const qualityInput = document.getElementById("pdBatchQuality");
    const result = document.getElementById("pdBatchResult");
    const convertButton = document.getElementById("pdBatchConvert");
    const zipButton = document.getElementById("pdBatchZip");

    let converted = [];

    qualityInput.oninput = () => {
      const label = qualityInput.previousElementSibling;
      label.textContent =
        `Qualidade JPG / WebP: ${qualityInput.value}%`;
    };

    function resetResults() {
      converted = [];
      zipButton.disabled = true;
      result.textContent = "Pronto para converter.";
    }

    filesInput.onchange = resetResults;
    formatInput.onchange = resetResults;
    qualityInput.onchange = resetResults;

    convertButton.onclick = async () => {
      const files = Array.from(filesInput.files || []);

      if (!files.length) {
        result.textContent = "Selecione pelo menos uma imagem.";
        return;
      }

      if (files.length > 30) {
        result.textContent = "Selecione no máximo 30 imagens por vez.";
        return;
      }

      const format = formatInput.value;
      const extension = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp"
      }[format];

      const quality = Number(qualityInput.value) / 100;

      converted = [];
      convertButton.disabled = true;
      zipButton.disabled = true;
      result.textContent = "Convertendo imagens...";

      const errors = [];

      try {
        for (let index = 0; index < files.length; index++) {
          const file = files[index];

          try {
            const blob = await fileToBlob(file, format, quality);

            const baseName = file.name
              .replace(/\.[^.]+$/, "")
              .replace(/[^a-zA-Z0-9_-]/g, "_")
              .slice(0, 70) || "imagem";

            converted.push({
              blob,
              filename: `${baseName}-${index + 1}.${extension}`
            });
          } catch (error) {
            errors.push(`${file.name}: ${error.message}`);
          }
        }

        result.innerHTML = "";

        const summary = document.createElement("p");
        summary.textContent =
          `${converted.length} de ${files.length} imagens convertidas.`;
        result.appendChild(summary);

        converted.forEach(item => {
          const line = document.createElement("div");

          line.style.cssText =
            "display:flex;justify-content:space-between;" +
            "align-items:center;gap:12px;padding:10px 0;" +
            "border-bottom:1px solid #302a3c;flex-wrap:wrap";

          const name = document.createElement("span");
          name.textContent =
            `${item.filename} (${formatBytes(item.blob.size)})`;

          const button = document.createElement("button");
          button.type = "button";
          button.className = "secondary";
          button.textContent = "Baixar";

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
      } finally {
        convertButton.disabled = false;
      }
    };

    zipButton.onclick = async () => {
      if (!converted.length) return;

      if (typeof JSZip === "undefined") {
        alert("Biblioteca ZIP não carregada. Atualize a página.");
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

        download(blob, "pdtools-imagens.zip");
      } catch (error) {
        console.error(error);
        alert("Não foi possível criar o ZIP.");
      } finally {
        zipButton.disabled = false;
        zipButton.textContent = "Baixar todas em ZIP";
      }
    };
  }

  // Captura o clique antes do premium-filter.js.
  grid.addEventListener("click", event => {
    const card = event.target.closest(
      '[data-premium-tool="image-batch"]'
    );

    if (!card || !grid.contains(card)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    openConverter();
  }, true);

  grid.addEventListener("keydown", event => {
    const card = event.target.closest(
      '[data-premium-tool="image-batch"]'
    );

    if (!card || !["Enter", " "].includes(event.key)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    openConverter();
  }, true);

  console.log("PD Tools: conversor de imagens em lote carregado.");
})();
