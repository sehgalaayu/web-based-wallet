export const showToast = (message, type = "default") => {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const typeConfig = {
    default: {
      icon: "info",
      color: "#ebebeb",
      border: "transparent",
    },
    success: {
      icon: "check_circle",
      color: "#4ade80",
      border: "#4ade80",
    },
    error: {
      icon: "error",
      color: "#f87171",
      border: "#f87171",
    },
  };
  const cfg = typeConfig[type] ?? typeConfig.default;

  const toast = document.createElement("div");
  toast.className =
    "pointer-events-auto flex items-center gap-2 rounded-lg border border-[#1a1a1a] bg-[#0e0e0e] px-3.5 py-2.5 text-[#ebebeb]";
  toast.style.borderLeft = `2px solid ${cfg.border}`;
  toast.style.marginTop = "8px";
  toast.style.transition = "all 0.3s ease-out";

  toast.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:16px;color:${cfg.color}">${cfg.icon}</span>
      <span style="font-size:13px">${message}</span>
    `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
};
