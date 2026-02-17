// scripts/modal.js — NioSports Pro (Confirm modal replacement)
// Reemplaza confirm() del navegador con un modal premium no bloqueante.
// Uso: NioModal.confirm({title, message, okText, cancelText}).then(ok => { ... });

(function () {
  function ensureModal() {
    let root = document.getElementById("ns-modal");
    if (root) return root;

    root = document.createElement("div");
    root.id = "ns-modal";
    root.innerHTML = `
      <div class="ns-modal-backdrop" data-ns-modal-close="1"></div>
      <div class="ns-modal-card" role="dialog" aria-modal="true" aria-labelledby="nsModalTitle">
        <div class="ns-modal-title" id="nsModalTitle"></div>
        <div class="ns-modal-message"></div>
        <div class="ns-modal-actions"></div>
      </div>
    `;
    document.body.appendChild(root);
    return root;
  }

  function openConfirm(opts) {
    const { title = "Confirmar", message = "", okText = "Aceptar", cancelText = "Cancelar" } = (opts || {});
    const root = ensureModal();

    const titleEl = root.querySelector(".ns-modal-title");
    const msgEl = root.querySelector(".ns-modal-message");
    const actionsEl = root.querySelector(".ns-modal-actions");
    const backdrop = root.querySelector(".ns-modal-backdrop");

    titleEl.textContent = title;
    msgEl.textContent = message;
    actionsEl.innerHTML = "";

    // lock scroll
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    return new Promise((resolve) => {
      let resolved = false;

      function close(result) {
        if (resolved) return;
        resolved = true;

        root.classList.remove("open");
        document.removeEventListener("keydown", onKeydown);
        backdrop.onclick = null;
        document.documentElement.style.overflow = prevOverflow;

        resolve(!!result);
      }

      function onKeydown(e) {
        if (e.key === "Escape") close(false);
        if (e.key === "Enter") close(true);
      }

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "ns-btn ns-btn-ghost";
      cancelBtn.type = "button";
      cancelBtn.textContent = cancelText;
      cancelBtn.onclick = () => close(false);

      const okBtn = document.createElement("button");
      okBtn.className = "ns-btn ns-btn-primary";
      okBtn.type = "button";
      okBtn.textContent = okText;
      okBtn.onclick = () => close(true);

      actionsEl.appendChild(cancelBtn);
      actionsEl.appendChild(okBtn);

      backdrop.onclick = () => close(false);
      document.addEventListener("keydown", onKeydown);

      root.classList.add("open");
      // focus
      setTimeout(() => okBtn.focus(), 0);
    });
  }

  window.NioModal = { confirm: openConfirm };
})();
