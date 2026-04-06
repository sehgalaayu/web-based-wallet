import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./scroll-area";
import { Separator } from "./separator";
import {
  Wallet,
  LayoutDashboard,
  Receipt,
  Zap,
  ChevronRight,
  Activity,
} from "lucide-react";
import { useState, useMemo } from "react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "activity", label: "Activity", icon: Receipt },
];

const sidebarVariants = {
  open: { width: 220 },
  closed: { width: 72 },
};

const contentVariants = {
  open: { opacity: 1, x: 0, display: "block" },
  closed: { opacity: 0, x: -10, display: "none" },
};

const transitionProps = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export function PremiumSidebar({
  activePage,
  setActivePage,
  network,
  isConnected,
  totalBalance = "$0.00",
  balanceChange = "+0.00%",
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.aside
      className="fixed left-0 top-0 z-40 h-screen shrink-0 border-r border-white/10"
      initial={false}
      animate={isCollapsed ? "closed" : "open"}
      variants={sidebarVariants}
      transition={transitionProps}
      onMouseEnter={() => setIsCollapsed(false)}
      onMouseLeave={() => setIsCollapsed(true)}
      style={{
        background:
          "linear-gradient(180deg, #0a0a0a 0%, #080808 50%, #0a0a0a 100%)",
      }}
    >
      <div className="relative z-40 flex h-full flex-col">
        {/* Header with Logo */}
        <div className="flex h-16 items-center border-b border-white/10 px-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 blur-lg opacity-50" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
                <Wallet className="h-5 w-5 text-white" />
              </div>
            </div>
            <motion.div
              variants={contentVariants}
              initial="closed"
              animate={isCollapsed ? "closed" : "open"}
              transition={{ duration: 0.2 }}
              className="flex flex-col overflow-hidden"
            >
              <span className="text-sm font-bold text-white whitespace-nowrap">
                Ethereal Vault
              </span>
              <span className="text-xs text-zinc-500">Non-custodial</span>
            </motion.div>
          </div>
        </div>

        {/* Balance Card */}
        <div className="p-3">
          <motion.div
            className={cn(
              "relative rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-zinc-900/90 backdrop-blur-xl overflow-hidden",
              "shadow-[0_0_30px_rgba(139,92,246,0.1)] hover:shadow-[0_0_50px_rgba(139,92,246,0.2)]",
              "transition-all duration-500",
              isCollapsed ? "p-2" : "p-4",
            )}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            {/* Animated gradient border */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/20 via-fuchsia-500/20 to-violet-500/20 opacity-0 hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <motion.div
                  variants={contentVariants}
                  initial="closed"
                  animate={isCollapsed ? "closed" : "open"}
                  className="overflow-hidden"
                >
                  {!isCollapsed && (
                    <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                      Total Balance
                    </span>
                  )}
                </motion.div>
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/20 flex-shrink-0">
                  <Zap className="h-3 w-3 text-violet-400" />
                </div>
              </div>

              <motion.div
                variants={contentVariants}
                initial="closed"
                animate={isCollapsed ? "closed" : "open"}
                className="overflow-hidden"
              >
                {!isCollapsed && (
                  <>
                    <div className="text-xl font-bold text-white mb-1 tracking-tight">
                      {totalBalance}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          balanceChange.startsWith("+")
                            ? "text-emerald-400"
                            : "text-zinc-500",
                        )}
                      >
                        {balanceChange}
                      </span>
                      <span className="text-[10px] text-zinc-500">24h</span>
                    </div>
                  </>
                )}
              </motion.div>

              {!isCollapsed && shouldShowConnectButton && (
                <div className="mt-3 flex gap-2">
                  <button className="flex-1 h-7 text-xs rounded-md bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-green-600 hover:shadow-emerald-500/40 transition-all">
                    Connect
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        <Separator className="bg-white/10" />

        {/* Navigation */}
        <ScrollArea className="flex-1 px-2 py-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;

              return (
                <motion.button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={cn(
                    "relative w-full flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200",
                    "hover:bg-white/5",
                    isActive &&
                      "bg-gradient-to-r from-emerald-500/20 to-green-500/20",
                  )}
                  whileHover={{ scale: 1.02, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeSidebarIndicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-emerald-500 to-green-500"
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                    />
                  )}

                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200 flex-shrink-0",
                      isActive
                        ? "bg-violet-500/20 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.3)]"
                        : "text-zinc-400 hover:text-zinc-200",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <motion.div
                    variants={contentVariants}
                    initial="closed"
                    animate={isCollapsed ? "closed" : "open"}
                    className="flex flex-1 items-center justify-between overflow-hidden"
                  >
                    {!isCollapsed && (
                      <span
                        className={cn(
                          "text-sm font-medium whitespace-nowrap",
                          isActive ? "text-white" : "text-zinc-400",
                        )}
                      >
                        {item.label}
                      </span>
                    )}
                  </motion.div>
                </motion.button>
              );
            })}
          </div>
        </ScrollArea>

        <Separator className="bg-white/10" />

        {/* Network Status Footer */}
        <div className="p-4">
          <motion.div
            className={cn(
              "flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2",
              isCollapsed && "justify-center px-2",
            )}
            whileHover={{ scale: 1.02 }}
          >
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
            </span>
            <motion.span
              variants={contentVariants}
              initial="closed"
              animate={isCollapsed ? "closed" : "open"}
              className="text-[11px] font-medium text-emerald-400 whitespace-nowrap overflow-hidden"
            >
              {!isCollapsed && network}
            </motion.span>
          </motion.div>
        </div>
      </div>
    </motion.aside>
  );
}
