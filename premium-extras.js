
/* PD TOOLS PREMIUM — FERRAMENTAS EXTRAS
   Complementa premium-filter.js sem alterar app.js.
*/
(() => {
  "use strict";

  const IDS = new Set([
    "remove-bg", "pdf-studio", "ocr", "pdf-compress",
    "resume", "image-editor", "site-builder"
  ]);

  const grid = document.getElementById("toolGrid");
  const modal = document.getElementById("toolModal");
  const content = document.getElementById("toolContent");
  const title = document.getElementById("modalTitle");
  const category = document.getElementById("modalCategory");

  if (!grid || !modal || !content || !title || !category) return;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);

  const box = (label, html) =>
    `<div class="pd-premium-field"><label>${label}</label>${html}</div>`;

  const input = (id, label, type = "text", value = "") =>
    box(label, `<input id="${id}" type="${type}" value="${esc(value)}">`);

  const area = (id, label, value = "") =>
    box(label, `<textarea id="${id}">${esc(value)}</textarea>`);

  const file = (id, label, accept, multiple = false) =>
    box(label, `<input id="${id}" type="file" accept="${accept}" ${multiple ? "multiple" : ""}>`);

  const button = (id, label) =>
    `<button type="button" class="action" id="${id}">${label}</button>`;

  const output = () =>
    `<div class="pd-premium-result" id="pxStatus" role="status">Pronto para começar.</div>`;

  const status = message => {
    const el = $("pxStatus");
    if (el) el.textContent = message;
  };

  const canvasHTML = () =>
    `<canvas id="pxCanvas" style="display:block;width:100%;height:auto;max-height:450px;object-fit:contain;margin:14px 0;border-radius:10px;background:#17151e"></canvas>`;

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function toBlob(canvas, type = "image/png", quality = 0.9) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) :
        reject(new Error("Não foi possível exportar a imagem.")), type, quality);
    });
  }

  function imageFromFile(f) {
    return new Promise((resolve, reject) => {
      if (!f) return reject(new Error("Selecione uma imagem."));
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Imagem inválida."));
      };
      img.src = url;
    });
  }

  const loaded = new Map();

  function script(url, check) {
    if (check()) return Promise.resolve();
    if (loaded.has(url)) return loaded.get(url);

    const promise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = () => check()
        ? resolve()
        : reject(new Error("Biblioteca não inicializada."));
      s.onerror = () => reject(new Error("Falha ao carregar biblioteca externa."));
      document.head.appendChild(s);
    });

    loaded.set(url, promise);
    return promise;
  }

  async function pdfLib() {
    await script(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js",
      () => !!window.PDFLib
    );
    return window.PDFLib;
  }

  async function pdfJS() {
    await script(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
      () => !!window.pdfjsLib
    );
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    return window.pdfjsLib;
  }

  async function checkPremium() {
    if (typeof supabaseClient === "undefined") return false;

    const { data: auth, error: authError } =
      await supabaseClient.auth.getUser();

    if (authError || !auth?.user) return false;

    const { data, error } = await supabaseClient
      .from("premium_access")
      .select("expires_at")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (error) throw error;
    return Date.parse(data?.expires_at || "") > Date.now();
  }

  function render(id) {
    switch (id) {
      case "remove-bg":
        return `
          ${file("pxFile", "Imagem PNG, JPG ou WebP", "image/png,image/jpeg,image/webp")}
          ${button("pxRun", "Remover fundo automaticamente")}
          ${canvasHTML()}
          ${output()}
          <p style="color:#999;font-size:12px">
            Usa inteligência artificial no navegador. O primeiro uso
            precisa baixar o modelo e pode demorar. O desempenho
            depende do dispositivo e da conexão.
          </p>`;

      case "pdf-studio":
        return `
          ${file("pxFiles", "Selecionar PDFs", "application/pdf", true)}
          ${box("Operação", `<select id="pxOperation">
            <option value="merge">Unir PDFs</option>
            <option value="extract">Extrair páginas</option>
            <option value="rotate">Girar páginas 90°</option>
          </select>`)}
          ${input("pxPages", "Páginas para extrair (ex.: 1,3-5)", "text", "1")}
          ${button("pxRun", "Processar PDF")}
          ${output()}`;

      case "ocr":
        return `
          ${file("pxFile", "Imagem com texto", "image/png,image/jpeg,image/webp")}
          ${box("Idioma", `<select id="pxLang">
            <option value="por">Português</option>
            <option value="eng">Inglês</option>
            <option value="spa">Espanhol</option>
          </select>`)}
          ${button("pxRun", "Extrair texto")}
          ${area("pxText", "Texto extraído")}
          ${button("pxSave", "Baixar TXT")}
          ${output()}`;

      case "pdf-compress":
        return `
          ${file("pxFile", "Selecionar PDF", "application/pdf")}
          ${box("Qualidade das páginas", `<select id="pxQuality">
            <option value="0.55">Menor arquivo</option>
            <option value="0.75" selected>Equilibrado</option>
            <option value="0.9">Melhor qualidade</option>
          </select>`)}
          ${button("pxRun", "Otimizar PDF")}
          ${output()}
          <p style="font-size:12px;color:#999">
            Este método recria as páginas como imagens.
            Textos deixam de ser selecionáveis e links internos
            podem ser perdidos. Não é indicado para documentos
            assinados digitalmente.
          </p>`;

      case "resume":
        return `
          ${input("pxName", "Nome completo")}
          ${input("pxEmail", "E-mail", "email")}
          ${input("pxPhone", "Telefone")}
          ${input("pxCity", "Cidade / Estado")}
          ${input("pxRole", "Cargo desejado")}
          ${area("pxSummary", "Resumo profissional")}
          ${area("pxExperience", "Experiência profissional")}
          ${area("pxEducation", "Formação")}
          ${area("pxSkills", "Habilidades")}
          ${button("pxRun", "Gerar currículo em PDF")}
          ${output()}`;

      case "image-editor":
        return `
          ${file("pxFile", "Selecionar imagem", "image/png,image/jpeg,image/webp")}
          ${box("Brilho", `<input id="pxBrightness" type="range" min="30" max="200" value="100">`)}
          ${box("Contraste", `<input id="pxContrast" type="range" min="30" max="200" value="100">`)}
          ${box("Saturação", `<input id="pxSaturation" type="range" min="0" max="200" value="100">`)}
          ${box("Rotação", `<select id="pxRotate">
            <option value="0">Normal</option>
            <option value="90">90°</option>
            <option value="180">180°</option>
            <option value="270">270°</option>
          </select>`)}
          ${box("Recorte central", `<select id="pxCrop">
            <option value="original">Sem recorte</option>
            <option value="square">Quadrado 1:1</option>
            <option value="wide">Paisagem 16:9</option>
          </select>`)}
          ${button("pxRun", "Aplicar ajustes")}
          ${button("pxSave", "Baixar PNG")}
          ${canvasHTML()}
          ${output()}`;

      case "site-builder":
        return `
          ${input("pxName", "Nome do site", "text", "Meu projeto")}
          ${input("pxHeadline", "Título principal", "text", "Bem-vindo ao meu site")}
          ${area("pxDescription", "Descrição", "Conheça nosso projeto e nossas novidades.")}
          ${input("pxButton", "Texto do botão", "text", "Saiba mais")}
          ${input("pxLink", "Link do botão", "url", "https://example.com")}
          ${input("pxColor", "Cor de destaque", "color", "#a78bfa")}
          ${button("pxRun", "Visualizar site")}
          ${button("pxSave", "Baixar HTML")}
          <iframe id="pxPreview" sandbox=""
            title="Prévia do site"
            style="width:100%;height:360px;background:white;border:0;border-radius:10px;margin-top:14px"></iframe>
          ${output()}`;
    }
    return output();
  }

  function parsePages(text, total) {
    const pages = new Set();

    for (const part of text.split(",")) {
      const value = part.trim();
      if (!value) continue;

      const match = value.match(/^(\d+)(?:-(\d+))?$/);
      if (!match) throw new Error("Intervalo de páginas inválido.");

      const start = Number(match[1]);
      const end = Number(match[2] || match[1]);

      if (start < 1 || end > total || end < start) {
        throw new Error(`As páginas precisam estar entre 1 e ${total}.`);
      }

      for (let p = start; p <= end; p++) pages.add(p - 1);
    }

    if (!pages.size) throw new Error("Informe pelo menos uma página.");
    return [...pages];
  }

  function buildSite() {
    const name = $("pxName").value.trim() || "Meu projeto";
    const headline = $("pxHeadline").value.trim();
    const description = $("pxDescription").value.trim();
    const buttonText = $("pxButton").value.trim() || "Saiba mais";
    const color = $("pxColor").value;
    const rawLink = $("pxLink").value.trim();

    let link = "#";
    try {
      const parsed = new URL(rawLink);
      if (["http:", "https:"].includes(parsed.protocol)) link = parsed.href;
    } catch (_) {}

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#09090f;color:#fff;font-family:Arial,sans-serif}
header{padding:25px 7%;border-bottom:1px solid #292433;font-weight:700}
main{min-height:75vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:45px 8%}
h1{font-size:clamp(32px,6vw,64px);max-width:900px}
p{color:#bbb;line-height:1.7;max-width:650px}
a{margin-top:24px;background:${color};color:#09090f;padding:15px 25px;border-radius:10px;text-decoration:none;font-weight:bold}
footer{text-align:center;padding:30px;color:#999}
</style>
</head>
<body>
<header>${esc(name)}</header>
<main>
<h1>${esc(headline)}</h1>
<p>${esc(description)}</p>
<a href="${esc(link)}">${esc(buttonText)}</a>
</main>
<footer>© ${new Date().getFullYear()} ${esc(name)}</footer>
</body>
</html>`;
  }

  function wire(id) {
    if (id === "remove-bg") {
      $("pxRun").onclick = async () => {
        const f = $("pxFile").files[0];
        if (!f) return status("Selecione uma imagem.");

        try {
          status("Carregando inteligência artificial. Aguarde...");
          $("pxRun").disabled = true;

          const mod = await import(
            "https://esm.sh/@imgly/background-removal@1.7.0"
          );

          const removeBackground =
            mod.removeBackground || mod.default?.removeBackground || mod.default;

          if (typeof removeBackground !== "function") {
            throw new Error("Biblioteca de remoção indisponível.");
          }

          const result = await removeBackground(f, {
            progress: (key, current, total) => {
              if (total) {
                status(`Carregando modelo: ${Math.round(current / total * 100)}%`);
              }
            }
          });

          const image = await imageFromFile(result);
          const canvas = $("pxCanvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          canvas.getContext("2d").drawImage(image, 0, 0);

          download(result, "pdtools-sem-fundo.png");
          status("Fundo removido. PNG baixado.");
        } catch (e) {
          console.error(e);
          status("Falha na remoção: " + e.message +
            ". Verifique a conexão e a compatibilidade do navegador.");
        } finally {
          $("pxRun").disabled = false;
        }
      };
    }

    if (id === "pdf-studio") {
      $("pxRun").onclick = async () => {
        const files = [...$("pxFiles").files];
        if (!files.length) return status("Selecione um PDF.");

        try {
          $("pxRun").disabled = true;
          status("Processando PDFs...");

          const lib = await pdfLib();
          const result = await lib.PDFDocument.create();
          const operation = $("pxOperation").value;

          if (operation === "merge") {
            for (const f of files) {
              const source = await lib.PDFDocument.load(
                await f.arrayBuffer()
              );
              const pages = await result.copyPages(
                source,
                source.getPageIndices()
              );
              pages.forEach(p => result.addPage(p));
            }
          } else {
            const source = await lib.PDFDocument.load(
              await files[0].arrayBuffer()
            );

            const indices = operation === "extract"
              ? parsePages($("pxPages").value, source.getPageCount())
              : source.getPageIndices();

            const pages = await result.copyPages(source, indices);

            pages.forEach(p => {
              result.addPage(p);
              if (operation === "rotate") {
                const angle = (p.getRotation().angle + 90) % 360;
                p.setRotation(lib.degrees(angle));
              }
            });
          }

          const bytes = await result.save();
          download(new Blob([bytes], {type:"application/pdf"}),
            "pdtools-pdf.pdf");
          status("PDF gerado com sucesso.");
        } catch (e) {
          console.error(e);
          status("Erro: " + e.message +
            ". PDFs protegidos ou danificados podem não abrir.");
        } finally {
          $("pxRun").disabled = false;
        }
      };
    }

    if (id === "ocr") {
      $("pxRun").onclick = async () => {
        const f = $("pxFile").files[0];
        if (!f) return status("Selecione uma imagem.");

        try {
          $("pxRun").disabled = true;
          status("Carregando reconhecimento de texto...");

          await script(
            "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
            () => !!window.Tesseract
          );

          const worker = await Tesseract.createWorker(
            $("pxLang").value
          );

          try {
            const result = await worker.recognize(f);
            $("pxText").value = result.data.text || "";
            status("Texto extraído. Confira possíveis erros de leitura.");
          } finally {
            await worker.terminate();
          }
        } catch (e) {
          console.error(e);
          status("Erro no OCR: " + e.message);
        } finally {
          $("pxRun").disabled = false;
        }
      };

      $("pxSave").onclick = () => {
        download(
          new Blob([$("pxText").value], {type:"text/plain;charset=utf-8"}),
          "pdtools-texto.txt"
        );
      };
    }

    if (id === "pdf-compress") {
      $("pxRun").onclick = async () => {
        const f = $("pxFile").files[0];
        if (!f) return status("Selecione um PDF.");

        try {
          $("pxRun").disabled = true;
          status("Lendo páginas...");

          const lib = await pdfLib();
          const pdfjs = await pdfJS();
          const source = await pdfjs.getDocument({
            data: new Uint8Array(await f.arrayBuffer())
          }).promise;

          const result = await lib.PDFDocument.create();
          const quality = Number($("pxQuality").value);

          for (let i = 1; i <= source.numPages; i++) {
            status(`Otimizando página ${i} de ${source.numPages}...`);

            const page = await source.getPage(i);
            const original = page.getViewport({scale:1});
            const scale = Math.min(1.5, 1400 / original.width);
            const view = page.getViewport({scale});

            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(view.width);
            canvas.height = Math.ceil(view.height);

            await page.render({
              canvasContext: canvas.getContext("2d", {alpha:false}),
              viewport: view
            }).promise;

            const jpeg = await toBlob(canvas, "image/jpeg", quality);
            const img = await result.embedJpg(await jpeg.arrayBuffer());

            const outPage = result.addPage([
              original.width, original.height
            ]);

            outPage.drawImage(img, {
              x:0, y:0,
              width:original.width,
              height:original.height
            });
          }

          const bytes = await result.save();
          const blob = new Blob([bytes], {type:"application/pdf"});
          download(blob, "pdtools-otimizado.pdf");

          const difference = Math.round(
            (1 - blob.size / f.size) * 100
          );

          status(difference >= 0
            ? `PDF gerado. Redução aproximada: ${difference}%.`
            : `PDF gerado, mas ficou ${Math.abs(difference)}% maior.`
          );
        } catch (e) {
          console.error(e);
          status("Erro ao otimizar: " + e.message);
        } finally {
          $("pxRun").disabled = false;
        }
      };
    }

    if (id === "resume") {
      $("pxRun").onclick = async () => {
        try {
          $("pxRun").disabled = true;
          status("Gerando currículo...");

          const lib = await pdfLib();
          const doc = await lib.PDFDocument.create();
const fontkitModule = await import(
  "https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/+esm"
);

const fontkit = fontkitModule.default || fontkitModule;
doc.registerFontkit(fontkit);

const [regularResponse, boldResponse] = await Promise.all([
  fetch("https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@latest/latin-400-normal.ttf"),
  fetch("https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@latest/latin-700-normal.ttf")
]);

if (!regularResponse.ok || !boldResponse.ok) {
  throw new Error("Não foi possível carregar as fontes do currículo.");
}

const font = await doc.embedFont(
  await regularResponse.arrayBuffer()
);

const bold = await doc.embedFont(
  await boldResponse.arrayBuffer()
);
          let page = doc.addPage([595,842]);
          let y = 795;

          function write(text, size = 11, strong = false) {
            const safe = String(text || "")
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^\x20-\x7E]/g, " ");

            const face = strong ? bold : font;
            const maxWidth = 495;
            const words = safe.split(/\s+/);
            let line = "";

            function put(s) {
              if (y < 65) {
                page = doc.addPage([595,842]);
                y = 790;
              }
              page.drawText(s, {
                x:50, y, size, font:face,
                color:lib.rgb(0.15,0.12,0.2)
              });
              y -= size + 7;
            }

            for (const word of words) {
              const next = line ? line + " " + word : word;
              if (face.widthOfTextAtSize(next,size) > maxWidth && line) {
                put(line);
                line = word;
              } else {
                line = next;
              }
            }

            if (line) put(line);
          }

          write($("pxName").value || "Nome completo", 23, true);
          write([
            $("pxEmail").value,
            $("pxPhone").value,
            $("pxCity").value
          ].filter(Boolean).join(" | "), 10);

          y -= 18;
          write($("pxRole").value || "Objetivo profissional", 15, true);
          y -= 14;

          const sections = [
            ["RESUMO", "pxSummary"],
            ["EXPERIENCIA", "pxExperience"],
            ["FORMACAO", "pxEducation"],
            ["HABILIDADES", "pxSkills"]
          ];

          for (const [heading, fieldId] of sections) {
            const value = $(fieldId).value.trim();
            if (!value) continue;
            write(heading, 12, true);
            y -= 4;
            value.split("\n").forEach(line => write(line));
            y -= 16;
          }

          const bytes = await doc.save();
          download(new Blob([bytes], {type:"application/pdf"}),
            "pdtools-curriculo.pdf");
          status("Currículo gerado.");
        } catch (e) {
          console.error(e);
          status("Erro: " + e.message);
        } finally {
          $("pxRun").disabled = false;
        }
      };
    }

    if (id === "image-editor") {
      let lastBlob = null;

      $("pxRun").onclick = async () => {
        try {
          const img = await imageFromFile($("pxFile").files[0]);
          const canvas = $("pxCanvas");
          const ctx = canvas.getContext("2d");

          let sx = 0, sy = 0;
          let sw = img.naturalWidth, sh = img.naturalHeight;
          const crop = $("pxCrop").value;

          if (crop !== "original") {
            const ratio = crop === "square" ? 1 : 16 / 9;

            if (sw / sh > ratio) {
              const newWidth = sh * ratio;
              sx = (sw - newWidth) / 2;
              sw = newWidth;
            } else {
              const newHeight = sw / ratio;
              sy = (sh - newHeight) / 2;
              sh = newHeight;
            }
          }

          const rotation = Number($("pxRotate").value);
          const swap = rotation === 90 || rotation === 270;

          canvas.width = Math.round(swap ? sh : sw);
          canvas.height = Math.round(swap ? sw : sh);

          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(rotation * Math.PI / 180);

          ctx.filter =
            `brightness(${$("pxBrightness").value}%) ` +
            `contrast(${$("pxContrast").value}%) ` +
            `saturate(${$("pxSaturation").value}%)`;

          ctx.drawImage(img, sx, sy, sw, sh,
            -sw / 2, -sh / 2, sw, sh);

          ctx.restore();

          lastBlob = await toBlob(canvas);
          status("Imagem editada. Pronta para baixar.");
        } catch (e) {
          console.error(e);
          status("Erro: " + e.message);
        }
      };

      $("pxSave").onclick = () => {
        if (!lastBlob) return status("Aplique os ajustes primeiro.");
        download(lastBlob, "pdtools-imagem-editada.png");
      };
    }

    if (id === "site-builder") {
      $("pxRun").onclick = () => {
        $("pxPreview").srcdoc = buildSite();
        status("Prévia atualizada.");
      };

      $("pxSave").onclick = () => {
        download(
          new Blob([buildSite()], {type:"text/html;charset=utf-8"}),
          "pdtools-meu-site.html"
        );
        status("Arquivo HTML gerado.");
      };

      $("pxRun").click();
    }
  }

  async function open(id) {
    try {
      const allowed = await checkPremium();

      if (!allowed) {
        alert("Entre com uma conta Premium ativa para continuar.");
        return;
      }

      const names = {
        "remove-bg":"Removedor de fundo",
        "pdf-studio":"PDF Studio",
        "ocr":"Extrator de texto OCR",
        "pdf-compress":"Compressor de PDF",
        "resume":"Criador de currículos",
        "image-editor":"Editor de imagens",
        "site-builder":"Criador de sites"
      };

      title.textContent = names[id];
      category.textContent = "PD TOOLS PREMIUM";
      content.innerHTML = render(id);
      modal.classList.add("show");
      wire(id);
    } catch (e) {
      console.error(e);
      alert("Erro ao verificar o acesso Premium: " + e.message);
    }
  }

  function handle(event) {
    const card = event.target.closest("[data-premium-tool]");
    if (!card || !grid.contains(card)) return;

    const id = card.dataset.premiumTool;
    if (!IDS.has(id)) return;

    if (event.type === "keydown" &&
        !["Enter", " "].includes(event.key)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    open(id);
  }

  grid.addEventListener("click", handle, true);
  grid.addEventListener("keydown", handle, true);

  console.log("PD Tools Premium: 7 ferramentas extras carregadas.");
})();
