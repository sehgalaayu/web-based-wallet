import { useState } from "react";
import {
  Home,
  Activity,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

export function PremiumSidebar({
  activePage,
  setActivePage,
  network,
  collapsed,
  setCollapsed,
}) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const isControlled =
    typeof collapsed === "boolean" && typeof setCollapsed === "function";
  const isCollapsed = isControlled ? collapsed : internalCollapsed;
  const toggleCollapsed = () => {
    if (isControlled) setCollapsed(!isCollapsed);
    else setInternalCollapsed(!isCollapsed);
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-40 hidden h-screen border-r border-white/5 bg-black/80 backdrop-blur-xl md:flex md:flex-col md:justify-between ${
        isCollapsed ? "w-[80px]" : "w-[240px]"
      } overflow-hidden transition-all duration-300`}
    >
      <div>
        <div
          className={`flex items-center justify-between py-5 ${
            isCollapsed ? "px-2" : "px-4"
          }`}
        >
          <div
            className={`flex items-center ${isCollapsed ? "gap-0" : "gap-3"}`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20">
              <Wallet className="h-5 w-5 text-black" />
            </div>

            {!isCollapsed && (
              <span className="text-lg font-semibold tracking-tight text-white">
                Ethereal
              </span>
            )}
          </div>

          <button
            onClick={toggleCollapsed}
            className="rounded-md border border-white/10 bg-white/5 p-1 text-white/50 transition hover:text-white"
          >
            {isCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-2 px-2">
          <NavItem
            icon={<Home size={18} />}
            label="Dashboard"
            active={activePage === "dashboard"}
            collapsed={isCollapsed}
            onClick={() => setActivePage("dashboard")}
          />
          <NavItem
            icon={<Activity size={18} />}
            label="Activity"
            active={activePage === "activity"}
            collapsed={isCollapsed}
            onClick={() => setActivePage("activity")}
          />
        </div>
      </div>

      <div className="px-3 pb-5">
        <div
          className={`flex items-center rounded-lg border border-white/5 bg-white/5 py-2 ${
            isCollapsed ? "justify-center" : "justify-between px-3"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            {!isCollapsed && (
              <span className="text-xs text-white/70">
                {network || "Mainnet"}
              </span>
            )}
          </div>

          {!isCollapsed && (
            <span className="text-[10px] text-white/40">LIVE</span>
          )}
        </div>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active = false, collapsed, onClick }) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={`flex w-full cursor-pointer items-center rounded-lg py-2.5 transition-all duration-200 ${
          collapsed ? "justify-center px-0" : "gap-3 px-3"
        } ${
          active
            ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
            : "text-white/60 hover:bg-white/5 hover:text-white"
        }`}
      >
        <div className="flex h-6 w-6 items-center justify-center">{icon}</div>

        {!collapsed && (
          <span className="text-sm font-medium tracking-tight">{label}</span>
        )}
      </button>

      {collapsed && (
        <div className="pointer-events-none absolute left-14 top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black px-2 py-1 text-xs text-white/80 opacity-0 transition group-hover:opacity-100">
          {label}
        </div>
      )}
    </div>
  );
}
