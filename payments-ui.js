(() => {
      "use strict";

      const $ = id => document.getElementById(id);

      const amountInput = $("donationAmount");
      const donationTotal = $("donationTotal");
      const donationMessage = $("donationMessage");
      const donationSubmit = $("donationSubmit");

      const subscribePremium = $("subscribePremium");
      const premiumMessage = $("premiumMessage");

      const premiumBannerSubscribe = $("premiumBannerSubscribe");
      const premiumBannerMessage = $("premiumBannerMessage");

      const pixOverlay = $("pdPixOverlay");
      const pixBox = $("pdPixBox");

      const valueButtons =
        document.querySelectorAll("[data-donation-value]");

      const formatBRL = value =>
        Number(value).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL"
        });

      function updateDonation() {
        const value = Number(amountInput.value);

        donationTotal.textContent =
          Number.isFinite(value) && value > 0
            ? formatBRL(value)
            : "R$ 0,00";

        valueButtons.forEach(button => {
          const selected =
            Number(button.dataset.donationValue) === value;

          button.classList.toggle("selected", selected);
          button.setAttribute("aria-pressed", String(selected));
        });

        donationMessage.textContent = "";
      }

      valueButtons.forEach(button => {
        button.addEventListener("click", () => {
          amountInput.value = button.dataset.donationValue;
          updateDonation();
        });
      });

      amountInput.addEventListener("input", updateDonation);

      let pixReturnFocus = null;

      function closePix() {
        pixOverlay.classList.remove("open");
        pixOverlay.hidden = true;
        pixBox.replaceChildren();
        pixReturnFocus?.focus?.();
      }

      pixOverlay.addEventListener("click", event => {
        if (event.target === pixOverlay) {
          closePix();
        }
      });

      function addText(tag, text, parent = pixBox) {
        const element = document.createElement(tag);
        element.textContent = text;
        parent.appendChild(element);
        return element;
      }

      function addButton(text, callback) {
        const button = addText("button", text);
        button.type = "button";
        button.addEventListener("click", callback);
        return button;
      }

      function showPix(data, tipo) {
        pixBox.replaceChildren();

        const isPremium = tipo === "subscription";

        addText(
          "h2",
          isPremium
            ? "✦ Assinatura PD Tools Premium"
            : "♡ Doação para o PD Tools"
        );

        addText(
          "p",
          "Valor: " + formatBRL(data.valor)
        );

        if (data.qr_code_base64) {
          const image = document.createElement("img");

          image.src = data.qr_code_base64.startsWith("data:")
            ? data.qr_code_base64
            : "data:image/png;base64," + data.qr_code_base64;

          image.alt = "QR Code do pagamento Pix";
          pixBox.appendChild(image);
        }

        if (data.qr_code) {
          addText("p", "Pix copia e cola:");

          const textarea = document.createElement("textarea");
          textarea.value = data.qr_code;
          textarea.readOnly = true;
          pixBox.appendChild(textarea);

          const copyStatus = addText("p", "");

          addButton("Copiar código Pix", async () => {
            try {
              await navigator.clipboard.writeText(data.qr_code);
              copyStatus.textContent = "Código Pix copiado!";
            } catch {
              textarea.focus();
              textarea.select();
              copyStatus.textContent =
                "Selecione e copie o código acima.";
            }
          });
        }

        if (data.ticket_url) {
          addButton("Abrir pagamento", () => {
            try {
              const url = new URL(data.ticket_url);

              if (url.protocol === "https:") {
                window.open(
                  url.href,
                  "_blank",
                  "noopener,noreferrer"
                );
              }
            } catch {
              // Link de pagamento inválido.
            }
          });
        }

        addText(
          "p",
          isPremium
            ? "O acesso Premium será liberado após a confirmação do pagamento pelo Mercado Pago."
            : "Esta é uma doação voluntária e não libera o Premium."
        );

        // Consulta autenticada: nunca libera Premium pela resposta do navegador.
        if (data.pagamento_id) {
          const checkStatus = addText("p", "");
          const checkButton = addButton("Já paguei? Verificar pagamento", async () => {
            checkButton.disabled = true;
            checkStatus.textContent = "Conferindo pagamento no Mercado Pago...";
            try {
              const client = typeof supabaseClient !== "undefined" ? supabaseClient : null;
              const { data: sessionData } = await client.auth.getSession();
              const token = sessionData?.session?.access_token;
              if (!token) throw new Error("Entre novamente na sua conta.");

              const response = await fetch("/api/consultar-pix", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: "Bearer " + token
                },
                body: JSON.stringify({ pagamento_id: data.pagamento_id })
              });
              const result = await response.json();
              if (!response.ok && response.status !== 202) {
                throw new Error(result.erro || "Falha na consulta.");
              }
              if (result.status === "approved") {
                checkStatus.textContent = result.premium_liberado
                  ? "💜 Premium confirmado! Atualize a página para utilizar."
                  : "Doação confirmada! Obrigado pelo apoio.";
                if (result.premium_liberado) {
                  addButton("Atualizar página", () => window.location.reload());
                }
              } else {
                checkStatus.textContent = "Pagamento ainda pendente. Aguarde a compensação e tente novamente.";
              }
            } catch (error) {
              checkStatus.textContent = error.message || "Não foi possível consultar o pagamento.";
            } finally {
              checkButton.disabled = false;
            }
          });
        }

        addButton("Fechar", closePix);

        pixOverlay.hidden = false;
        pixOverlay.classList.add("open");
      }

      async function createPixPayment(tipo, valor = null) {
        const isPremium = tipo === "subscription";

        const button = isPremium
          ? subscribePremium
          : donationSubmit;

        const message = isPremium
          ? premiumMessage
          : donationMessage;

        const originalText = button.textContent;

        const client =
          typeof supabaseClient !== "undefined"
            ? supabaseClient
            : null;

        if (!client) {
          message.textContent =
            "Sistema de contas indisponível.";

          if (isPremium) {
            premiumBannerMessage.textContent =
              message.textContent;
          }
          return;
        }

        button.disabled = true;
        button.textContent = "Gerando Pix...";

        if (isPremium) {
          premiumBannerSubscribe.disabled = true;
          premiumBannerSubscribe.textContent = "Gerando Pix...";
        }

        message.textContent = "Preparando pagamento...";

        if (isPremium) {
          premiumBannerMessage.textContent =
            "Preparando pagamento...";
        }

        try {
          const { data, error } =
            await client.auth.getSession();

          if (error) throw error;

          const token = data.session?.access_token;

          if (!token) {
            message.textContent =
              "Entre na sua conta para continuar.";

            if (isPremium) {
              premiumBannerMessage.textContent =
                "Entre na sua conta para continuar.";
            }

            $("pdAccountOpen")?.click();
            return;
          }

          const payload = { tipo };

          if (!isPremium) {
            payload.valor = valor;
          }

          const response = await fetch("/api/criar-pix", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token
            },
            body: JSON.stringify(payload)
          });

          const result = await response.json();

          if (!response.ok || !result.sucesso) {
            throw new Error(
              result.erro || "Não foi possível gerar o Pix."
            );
          }

          if (
            !result.qr_code &&
            !result.qr_code_base64 &&
            !result.ticket_url
          ) {
            throw new Error(
              "O pagamento foi criado, mas os dados Pix não estão disponíveis."
            );
          }

          message.textContent =
            "Pix gerado. Confira a janela de pagamento.";

          if (isPremium) {
            premiumBannerMessage.textContent =
              "Pix gerado. Confira a janela de pagamento.";
          }

          pixReturnFocus = document.activeElement;
          showPix(result, tipo);

        } catch (error) {
          console.error("Erro no Pix:", error);

          message.textContent =
            error.message || "Erro ao gerar o Pix.";

          if (isPremium) {
            premiumBannerMessage.textContent =
              message.textContent;
          }

        } finally {
          button.disabled = false;
          button.textContent = originalText;

          if (isPremium) {
            premiumBannerSubscribe.disabled = false;
            premiumBannerSubscribe.textContent =
              "✦ Quero virar Premium — R$ 5,00";
          }
        }
      }

      donationSubmit.addEventListener("click", () => {
        const valorTexto = amountInput.value.trim();

        if (!/^\d+(?:\.\d{1,2})?$/.test(valorTexto)) {
          donationMessage.textContent =
            "Digite um valor válido com até duas casas decimais.";
          return;
        }

        const valor = Number(valorTexto);

        if (
          !Number.isFinite(valor) ||
          valor < 0.10 ||
          valor > 100000
        ) {
          donationMessage.textContent =
            "Digite um valor entre R$ 0,10 e R$ 100.000,00.";
          return;
        }

        createPixPayment("donation", valor);
      });

      subscribePremium.addEventListener("click", () => {
        createPixPayment("subscription");
      });

      premiumBannerSubscribe.addEventListener("click", () => {
        if (!subscribePremium.disabled) {
          createPixPayment("subscription");
        }
      });

      updateDonation();

      document.addEventListener("keydown", event => {
        if (
          event.key === "Escape" &&
          pixOverlay.classList.contains("open")
        ) {
          closePix();
        }
      });

      $("year").textContent = new Date().getFullYear();
    })();
