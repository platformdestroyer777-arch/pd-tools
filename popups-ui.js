(() => {
      "use strict";

      const premiumPopup =
        document.getElementById("premiumPopupOverlay");

      const donationPopup =
        document.getElementById("donationPopup");

      const premiumClose =
        document.getElementById("premiumPopupClose");

      const donationClose =
        document.getElementById("closeDonationPopup");

      const premiumGo =
        document.getElementById("premiumPopupGo");

      const donationGo =
        document.getElementById("goToDonations");

      const popups = [premiumPopup, donationPopup];

      let currentIndex = -1;
      let previousFocus = null;

      function closeCurrent() {
        if (currentIndex < 0) return;

        const popup = popups[currentIndex];

        popup.classList.remove("open");
        popup.hidden = true;

        document.body.style.overflow = "";

        const nextIndex = currentIndex + 1;

        if (nextIndex < popups.length) {
          openPopup(nextIndex);
        } else {
          currentIndex = -1;
          previousFocus?.focus?.();
        }
      }

      function openPopup(index) {
        if (index < 0 || index >= popups.length) {
          return;
        }

        currentIndex = index;

        const popup = popups[index];

        popup.hidden = false;
        popup.classList.add("open");

        document.body.style.overflow = "hidden";

        const closeButton =
          popup.querySelector(".pd-ad-close");

        closeButton?.focus();
      }

      function goToSection(sectionId) {
        const section = document.getElementById(sectionId);

        closeCurrent();

        // Fecha também o anúncio seguinte quando
        // a pessoa decide visitar uma seção.
        if (currentIndex >= 0) {
          const popup = popups[currentIndex];
          popup.classList.remove("open");
          popup.hidden = true;
          currentIndex = -1;
          document.body.style.overflow = "";
        }

        if (section) {
          section.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      }

      premiumClose.addEventListener("click", closeCurrent);
      donationClose.addEventListener("click", closeCurrent);

      premiumGo.addEventListener("click", () => {
        goToSection("assinar-premium");
      });

      donationGo.addEventListener("click", () => {
        goToSection("doacoes");
      });

      premiumPopup.addEventListener("click", event => {
        if (event.target === premiumPopup) {
          closeCurrent();
        }
      });

      donationPopup.addEventListener("click", event => {
        if (event.target === donationPopup) {
          closeCurrent();
        }
      });

      document.addEventListener("keydown", event => {
        if (currentIndex < 0) return;

        if (event.key === "Escape") {
          event.preventDefault();
          closeCurrent();
        }

        if (event.key === "Tab") {
          const popup = popups[currentIndex];

          const controls = Array.from(
            popup.querySelectorAll(
              "button:not([disabled]),a[href]"
            )
          );

          if (!controls.length) return;

          const first = controls[0];
          const last = controls[controls.length - 1];

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
      }, true);

      // Os dois anúncios reaparecem em toda visita.
      window.addEventListener("load", () => {
        previousFocus = document.activeElement;
        openPopup(0);
      });
    })();
