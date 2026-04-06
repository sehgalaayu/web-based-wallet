import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import jazzicon from "jazzicon";
import { generateMnemonic } from "bip39";
import { createPortal } from "react-dom";
import EthWallet from "./EthWallet";
import SolanaWallet from "./SolanaWallet";
import { PremiumSidebar } from "./components/ui/premium-sidebar-fixed";
import { GlowCard } from "./components/ui/glow-card";
import "./App.css";
import { showToast } from "./utils/toast";

const TOPBAR_HEIGHT = 52;

const relativeTime = (iso) => {
  if (!iso) return "just now";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.floor(diffMs / 60000));
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const randomHash = (network) => {
  const seed = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return network === "Ethereum"
    ? `0x${seed.padEnd(64, "0").slice(0, 64)}`
    : seed.replace(/[^a-z0-9]/gi, "").slice(0, 44);
};

const modalTransition = {
  initial: { opacity: 0, scale: 0.97, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: -4 },
  transition: { duration: 0.15, ease: "easeOut" },
};

const dropdownTransition = {
  initial: { opacity: 0, scale: 0.97, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: -4 },
  transition: { duration: 0.15, ease: "easeOut" },
};

const truncateAddress = (address = "") => {
  if (!address) return "--";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}···${address.slice(-4)}`;
};

const truncateHash = (hash = "") => {
  if (!hash) return "";
  return `${hash.slice(0, 6)}···${hash.slice(-8)}`;
};

const FALLBACK_SEED_PHRASE =
  "abandon ability able about above absent absorb abstract absurd abuse access account";

const fuzzyIncludes = (query, target) => {
  if (!query.trim()) return true;
  let q = 0;
  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();
  for (let i = 0; i < targetLower.length && q < queryLower.length; i += 1) {
    if (targetLower[i] === queryLower[q]) q += 1;
  }
  return q === queryLower.length;
};

const buildSparklinePath = (points, width, height, pad = 4) => {
  if (!points.length) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1, max - min);

  return points
    .map((value, index) => {
      const x =
        pad + (index / Math.max(1, points.length - 1)) * (width - pad * 2);
      const y = height - pad - ((value - min) / span) * (height - pad * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
};

function WalletAvatar({ address, size = 24 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !address) return;
    ref.current.innerHTML = "";
    const seed = parseInt(address.slice(2, 10), 16) || 1337;
    ref.current.appendChild(jazzicon(size, seed));
  }, [address, size]);

  return (
    <span ref={ref} className="inline-flex overflow-hidden rounded-full" />
  );
}

function EmptyActivityState({ onOpenDashboard, onConnect }) {
  return (
    <div className="glass-panel-premium mx-auto flex min-h-[280px] w-full max-w-[680px] flex-col items-center justify-center rounded-2xl border border-white/10 px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
        <span className="material-symbols-outlined text-[20px] text-emerald-400">
          timeline
        </span>
      </div>
      <p className="text-[17px] font-semibold tracking-tight text-[var(--text-1)]">
        No transactions yet
      </p>
      <p className="mt-1 max-w-[360px] text-[12px] text-[var(--text-2)]">
        Your sends, receives, and swaps will appear here once wallets become
        active.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          className="rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 px-3 py-1.5 text-[12px] font-medium text-white transition-all duration-200 hover:brightness-110"
          onClick={onOpenDashboard}
        >
          Open Dashboard
        </button>
        <button
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] text-[var(--text-2)] transition-all duration-200 hover:text-[var(--text-1)]"
          onClick={onConnect}
        >
          Connect Wallet
        </button>
      </div>
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [network] = useState("Mainnet");
  const [mnemonic, setMnemonic] = useState("");
  const [isSeedRevealed, setIsSeedRevealed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState("");
  const [activityFilter, setActivityFilter] = useState("All");
  const [selectedTx, setSelectedTx] = useState(null);
  const [ethWallets, setEthWallets] = useState([]);
  const [solWallets, setSolWallets] = useState([]);
  const [ethCurrentIndex, setEthCurrentIndex] = useState(0);
  const [solCurrentIndex, setSolCurrentIndex] = useState(0);
  const [ethRevealedPrivate, setEthRevealedPrivate] = useState([]);
  const [solRevealedPrivate, setSolRevealedPrivate] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const ethWalletRef = useRef(null);
  const solWalletRef = useRef(null);
  const commandOpenRef = useRef(false);
  const lastCommandShortcutRef = useRef(0);

  const totalWalletCount = ethWallets.length + solWallets.length;
  const sparklineSeries = [16, 18, 17, 19, 23, 22, 25, 27, 26, 31, 30, 34];
  const sparklinePath = useMemo(
    () => buildSparklinePath(sparklineSeries, 300, 72),
    [],
  );
  const currentSeedPhrase =
    mnemonic && mnemonic.trim() ? mnemonic.trim() : FALLBACK_SEED_PHRASE;
  const hasGeneratedSeedPhrase = Boolean(mnemonic && mnemonic.trim());
  const portfolioTarget = useMemo(
    () => totalWalletCount * 2843.17 + transactions.length * 37.42,
    [totalWalletCount, transactions.length],
  );
  const [portfolioDisplay, setPortfolioDisplay] = useState(0);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const isConnected = Boolean(connectedAddress);

  const filteredTx = useMemo(() => {
    if (activityFilter === "All") return transactions;
    return transactions.filter((tx) => tx.type === activityFilter);
  }, [activityFilter, transactions]);

  const addNotification = ({ icon = "🔔", title, subText }) => {
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      icon,
      title,
      subText,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [item, ...prev].slice(0, 20));
  };

  const addActivity = ({
    type = "Receive",
    amount,
    network,
    from,
    to,
    fee,
  }) => {
    const createdAt = new Date().toISOString();
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      hash: randomHash(network),
      type,
      amount,
      timestamp: relativeTime(createdAt),
      status: "confirmed",
      network,
      from,
      to,
      fee,
      explorer:
        network === "Ethereum"
          ? "https://etherscan.io/tx/"
          : "https://solscan.io/tx/",
      createdAt,
    };
    setTransactions((prev) => [entry, ...prev].slice(0, 100));
  };

  const logWalletAdded = ({ network, address }) => {
    addNotification({
      icon: network === "Ethereum" ? "⟠" : "◎",
      title: `${network} account added`,
      subText: `${truncateAddress(address)} created`,
    });

    addActivity({
      type: "Receive",
      amount: network === "Ethereum" ? "+0.0000 ETH" : "+0.0000 SOL",
      network,
      from: "Vault",
      to: address,
      fee: network === "Ethereum" ? "0.00000 ETH" : "0.000000 SOL",
    });
  };

  const resetVaultState = () => {
    setConnectedAddress("");
    setMnemonic("");
    setIsSeedRevealed(false);
    setIsConnectModalOpen(false);
    setIsNotificationOpen(false);
    setIsCommandOpen(false);
    setIsWalletMenuOpen(false);
    setTransactions([]);
    setNotifications([]);
    ethWalletRef.current?.resetWallets?.();
    solWalletRef.current?.resetWallets?.();
  };

  const createSeedPhrase = async () => {
    try {
      const generated = generateMnemonic();
      setMnemonic(generated);
      setIsSeedRevealed(false);
      addNotification({
        icon: "✨",
        title: "Seed phrase generated",
        subText: "Local wallet seed created successfully",
      });
      showToast("New wallet generated", "success");
      return generated;
    } catch (error) {
      console.error("Error generating mnemonic", error);
      showToast("Failed to generate wallet", "error");
      return null;
    }
  };

  const copyToClipboard = async (text, message = "Copied") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast(message, "success");
    } catch {
      showToast("Clipboard unavailable", "error");
    }
  };

  const connectGeneratedWallet = async () => {
    let sourceMnemonic = mnemonic;
    if (!sourceMnemonic) {
      sourceMnemonic = await createSeedPhrase();
    }
    if (!sourceMnemonic) return;

    const address = await ethWalletRef.current?.addWallet?.(sourceMnemonic);
    if (address) {
      setConnectedAddress(address);
      setIsConnectModalOpen(false);
      addNotification({
        icon: "🔐",
        title: "Wallet connected",
        subText: `${truncateAddress(address)} connected`,
      });
      showToast("Wallet connected", "success");
    }
  };

  const connectMetaMask = async () => {
    if (!window.ethereum?.request) {
      showToast("Install MetaMask", "error");
      return;
    }
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts?.[0]) {
        setConnectedAddress(accounts[0]);
        setIsConnectModalOpen(false);
        addNotification({
          icon: "🦊",
          title: "MetaMask connected",
          subText: `${truncateAddress(accounts[0])} connected`,
        });
        showToast("MetaMask connected", "success");
      }
    } catch {
      showToast("MetaMask connection failed", "error");
    }
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  const commands = useMemo(
    () => [
      {
        id: "copy-eth",
        icon: "content_copy",
        label: "Copy ETH address",
        hint: "⌘E",
        run: () => {
          const address = ethWalletRef.current?.getFirstAddress?.();
          if (address) copyToClipboard(address, "ETH address copied");
          else showToast("No ETH wallet yet", "error");
        },
      },
      {
        id: "copy-sol",
        icon: "content_copy",
        label: "Copy SOL address",
        hint: "⌘S",
        run: () => {
          const address = solWalletRef.current?.getFirstAddress?.();
          if (address) copyToClipboard(address, "SOL address copied");
          else showToast("No SOL wallet yet", "error");
        },
      },
      {
        id: "reveal-seed",
        icon: "visibility",
        label: "Reveal seed phrase",
        hint: "⌘R",
        run: () => {
          setActivePage("dashboard");
          setIsSeedRevealed(true);
          showToast("Seed phrase revealed", "success");
        },
      },
      {
        id: "add-eth",
        icon: "add",
        label: "Add new ETH wallet",
        hint: "⌘1",
        run: async () => {
          const sourceMnemonic = mnemonic;
          if (!isConnected || !sourceMnemonic) {
            showToast(
              "Generate or connect wallet first using Connect Wallet",
              "error",
            );
            setIsConnectModalOpen(true);
            return;
          }
          await ethWalletRef.current?.addWallet?.(sourceMnemonic);
          showToast("ETH wallet added", "success");
        },
      },
      {
        id: "add-sol",
        icon: "add",
        label: "Add new SOL wallet",
        hint: "⌘2",
        run: async () => {
          const sourceMnemonic = mnemonic;
          if (!isConnected || !sourceMnemonic) {
            showToast(
              "Generate or connect wallet first using Connect Wallet",
              "error",
            );
            setIsConnectModalOpen(true);
            return;
          }
          await solWalletRef.current?.addWallet?.(sourceMnemonic);
          showToast("SOL wallet added", "success");
        },
      },
      {
        id: "go-activity",
        icon: "receipt_long",
        label: "Go to Activity",
        hint: "⌘A",
        run: () => setActivePage("activity"),
      },
      {
        id: "toggle-private",
        icon: "lock_open",
        label: "Toggle private key display",
        hint: "⌘P",
        run: () => {
          ethWalletRef.current?.toggleAllPrivate?.();
          solWalletRef.current?.toggleAllPrivate?.();
          showToast("Private key visibility toggled", "success");
        },
      },
      {
        id: "disconnect",
        icon: "logout",
        label: "Disconnect wallet",
        hint: "⌘D",
        run: () => {
          resetVaultState();
          showToast("Wallet disconnected", "default");
        },
      },
    ],
    [isConnected, mnemonic],
  );

  const visibleCommands = useMemo(
    () => commands.filter((cmd) => fuzzyIncludes(commandQuery, cmd.label)),
    [commands, commandQuery],
  );

  const closeCommandPalette = () => {
    setIsCommandOpen(false);
    setCommandQuery("");
  };

  useEffect(() => {
    commandOpenRef.current = isCommandOpen;
  }, [isCommandOpen]);

  const runCommand = async (command) => {
    await command.run();
    closeCommandPalette();
  };

  const onCommandKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedCommandIndex((prev) =>
        Math.min(prev + 1, visibleCommands.length - 1),
      );
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedCommandIndex((prev) => Math.max(prev - 1, 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = visibleCommands[selectedCommandIndex];
      if (selected) runCommand(selected);
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (event.repeat) return;

        const now = Date.now();
        if (now - lastCommandShortcutRef.current < 220) return;
        lastCommandShortcutRef.current = now;

        if (commandOpenRef.current) {
          closeCommandPalette();
        } else {
          setIsCommandOpen(true);
        }
      }
      if (event.key === "Escape") {
        closeCommandPalette();
        setIsConnectModalOpen(false);
        setIsNotificationOpen(false);
        setIsWalletMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setSelectedCommandIndex(0);
  }, [commandQuery]);

  useEffect(() => {
    const start = performance.now();
    const from = portfolioDisplay;
    const to = portfolioTarget;
    const duration = 700;
    let rafId;

    const tick = (time) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setPortfolioDisplay(from + (to - from) * eased);
      if (progress < 1) rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [portfolioTarget]);

  return (
    <div className="min-h-screen bg-[var(--bg)] font-body-elite text-[var(--text-1)]">
      <PremiumSidebar
        activePage={activePage}
        setActivePage={setActivePage}
        network={network}
      />

      {/* Mobile Sidebar Overlay */}
      {createPortal(
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/50 md:hidden"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <motion.div
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed left-0 top-0 z-[101] h-full w-72 md:hidden bg-[#0a0a0a] border-r border-white/10"
              >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <span className="text-sm font-bold text-white">
                    Ethereal Vault
                  </span>
                  <button
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-1)]"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="p-4">
                  <nav className="space-y-2">
                    {[
                      { id: "dashboard", label: "Dashboard", icon: "🏠" },
                      { id: "activity", label: "Activity", icon: "📊" },
                      { id: "settings", label: "Settings", icon: "⚙️" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActivePage(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          activePage === item.id
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-white/5"
                        }`}
                      >
                        <span className="text-lg">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <header
        className="fixed top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#080808]/80 backdrop-blur-xl px-4 md:left-[240px] md:px-6"
        style={{
          left: 0,
          right: 0,
          height: TOPBAR_HEIGHT,
        }}
      >
        <div className="flex items-center gap-3">
          <button
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-1)]"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <p className="label-caps">Non-custodial</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="cursor-pointer rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--text-2)] transition-all duration-150 hover:bg-white/[0.03] hover:text-[var(--text-1)]"
            onClick={() => setIsCommandOpen(true)}
          >
            ⌘K
          </button>

          <div className="relative">
            <button
              className="relative flex h-[30px] w-[30px] items-center justify-center rounded-md border border-[var(--border)] transition-all duration-150 hover:text-[var(--text-1)]"
              onClick={() => setIsNotificationOpen((prev) => !prev)}
            >
              <span className="material-symbols-outlined text-base text-[var(--text-2)]">
                notifications
              </span>
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--red)]" />
              )}
            </button>

            <AnimatePresence>
              {isNotificationOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[70]"
                    onClick={() => setIsNotificationOpen(false)}
                  />
                  <motion.div
                    {...dropdownTransition}
                    className="elite-panel absolute right-0 z-[71] mt-2 w-[320px] rounded-[10px] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[13px] font-medium text-[var(--text-1)]">
                        Notifications
                      </p>
                      <button
                        className="text-[11px] text-[var(--text-2)] transition-all duration-150 hover:text-[var(--text-1)]"
                        onClick={markAllRead}
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="space-y-2">
                      {notifications.map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: -8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{
                            duration: 0.15,
                            delay: index * 0.04,
                            ease: "easeOut",
                          }}
                          className={`rounded-md border border-[var(--border)] px-2 py-2 ${
                            item.read ? "" : "bg-white/[0.02]"
                          }`}
                          style={{
                            borderLeft: item.read
                              ? "1px solid var(--border)"
                              : "2px solid var(--green)",
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-sm">{item.icon}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] text-[var(--text-1)]">
                                {item.title}
                              </p>
                              <p className="text-xs text-[var(--text-2)]">
                                {item.subText}
                              </p>
                              <p className="text-[11px] text-[var(--text-3)]">
                                {item.time}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {!isConnected ? (
            <button
              className="rounded-lg bg-[var(--text-1)] px-3 py-1.5 text-[11px] font-medium text-[var(--bg)] transition-all duration-150"
              onClick={() => setIsConnectModalOpen(true)}
            >
              Connect Wallet
            </button>
          ) : (
            <div className="relative">
              <button
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--text-1)]"
                onClick={() => setIsWalletMenuOpen((prev) => !prev)}
              >
                <WalletAvatar address={connectedAddress} size={20} />
                {truncateAddress(connectedAddress)}
              </button>

              <AnimatePresence>
                {isWalletMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[70]"
                      onClick={() => setIsWalletMenuOpen(false)}
                    />
                    <motion.div
                      {...dropdownTransition}
                      className="elite-panel absolute right-0 z-[71] mt-2 min-w-[160px] rounded-[10px] p-1"
                    >
                      <button
                        className="w-full rounded-md px-[14px] py-2 text-left text-[13px] text-[#ebebeb] transition-all duration-150 hover:bg-white/[0.04]"
                        onClick={() =>
                          copyToClipboard(connectedAddress, "Address copied")
                        }
                      >
                        Copy address
                      </button>
                      <div className="my-1 h-px bg-[#161616]" />
                      <button
                        className="w-full rounded-md px-[14px] py-2 text-left text-[13px] text-[#f87171] transition-all duration-150 hover:bg-white/[0.04]"
                        onClick={() => {
                          resetVaultState();
                          showToast("Disconnected", "default");
                        }}
                      >
                        Disconnect
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </header>

      <div
        className="flex flex-col md:ml-[240px]"
        style={{
          marginTop: TOPBAR_HEIGHT,
          minHeight: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
        }}
      >
        <main className="relative flex-1 px-4 pb-24 pt-6 md:px-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px] bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_48%)]" />
          <div className="mx-auto w-full max-w-[980px]">
            {activePage === "dashboard" ? (
              <>
                {/* Signature Element - Animated Total Balance Card */}
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="mb-12"
                >
                  <div className="glass-panel-premium relative overflow-hidden rounded-2xl p-8">
                    {/* Animated background gradient */}
                    <div className="animated-hero-gradient absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-blue-500/10 opacity-60" />
                    <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
                    <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />

                    <div className="relative z-10">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
                          <svg
                            className="h-4 w-4 text-emerald-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-[var(--text-2)]">
                          Total Portfolio Value
                        </span>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          +2.4%
                        </span>
                      </div>

                      <motion.h1
                        className="mb-4 text-5xl font-extrabold tracking-tight text-white md:text-6xl"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                      >
                        <span className="gradient-text">
                          {portfolioDisplay.toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </motion.h1>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 pulse-glow" />
                          <span className="text-xs text-[var(--text-2)]">
                            {totalWalletCount} wallets active
                          </span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5">
                          <svg
                            className="h-3 w-3 text-[var(--text-3)]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="text-xs text-[var(--text-2)]">
                            Secure
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[11px] uppercase tracking-wider text-[var(--text-3)]">
                            7D Momentum
                          </span>
                          <span className="text-[11px] font-medium text-emerald-400">
                            +8.4%
                          </span>
                        </div>
                        <svg viewBox="0 0 300 72" className="h-[72px] w-full">
                          <defs>
                            <linearGradient
                              id="portfolio-line"
                              x1="0"
                              y1="0"
                              x2="1"
                              y2="0"
                            >
                              <stop
                                offset="0%"
                                stopColor="rgba(16,185,129,0.15)"
                              />
                              <stop
                                offset="45%"
                                stopColor="rgba(16,185,129,0.75)"
                              />
                              <stop
                                offset="100%"
                                stopColor="rgba(123,143,245,0.85)"
                              />
                            </linearGradient>
                          </defs>
                          <motion.path
                            d={sparklinePath}
                            fill="none"
                            stroke="url(#portfolio-line)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            initial={{ pathLength: 0, opacity: 0.35 }}
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={{
                              duration: 1.15,
                              ease: "easeOut",
                              delay: 0.15,
                            }}
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </motion.section>

                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.08 }}
                  className="pb-6"
                >
                  <div className="mb-6 h-px bg-[var(--border)]" />
                </motion.section>

                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.16 }}
                >
                  <EthWallet
                    ref={ethWalletRef}
                    mnemonic={mnemonic}
                    copyToClipboard={copyToClipboard}
                    onWalletAdded={logWalletAdded}
                    canAddWallet={true}
                    wallets={ethWallets}
                    setWallets={setEthWallets}
                    currentIndex={ethCurrentIndex}
                    setCurrentIndex={setEthCurrentIndex}
                    revealedPrivate={ethRevealedPrivate}
                    setRevealedPrivate={setEthRevealedPrivate}
                  />
                </motion.section>

                <motion.section
                  className="mt-10"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.24 }}
                >
                  <SolanaWallet
                    ref={solWalletRef}
                    mnemonic={mnemonic}
                    copyToClipboard={copyToClipboard}
                    onWalletAdded={logWalletAdded}
                    canAddWallet={true}
                    wallets={solWallets}
                    setWallets={setSolWallets}
                    currentIndex={solCurrentIndex}
                    setCurrentIndex={setSolCurrentIndex}
                    revealedPrivate={solRevealedPrivate}
                    setRevealedPrivate={setSolRevealedPrivate}
                  />
                </motion.section>

                <motion.section
                  className="mt-12 rounded-[12px] border border-red-500/20 bg-gradient-to-br from-red-500/5 via-transparent to-transparent p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.32 }}
                >
                  <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-red-400/70">
                    Sensitive Zone
                  </p>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-[var(--text-1)]">
                        Secret Recovery Phrase
                      </p>
                      <span className="rounded-full border border-[var(--border)] bg-[rgba(248,113,113,0.1)] px-2 py-0.5 text-[10px] text-[var(--red)]">
                        never share
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-full border border-[var(--border)] px-3 py-1 text-[11px] text-[var(--text-2)] transition-all duration-150 hover:text-[var(--text-1)]"
                        onClick={() => setIsSeedRevealed((prev) => !prev)}
                      >
                        Reveal
                      </button>
                      <button
                        className="rounded-full border border-[var(--border)] px-3 py-1 text-[11px] text-[var(--text-2)] transition-all duration-150 hover:text-[var(--text-1)]"
                        onClick={() => {
                          copyToClipboard(
                            currentSeedPhrase,
                            hasGeneratedSeedPhrase
                              ? "Seed phrase copied"
                              : "Displayed phrase copied",
                          );
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="relative rounded-[10px] border border-[var(--border)] bg-[#111] p-3">
                    <div
                      className={`grid grid-cols-4 gap-2 transition-all duration-200 ${isSeedRevealed ? "blur-0" : "blur-[6px]"}`}
                    >
                      {currentSeedPhrase
                        .split(" ")
                        .slice(0, 12)
                        .map((word, index) => (
                          <motion.div
                            key={`${word}-${index}`}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.16, delay: index * 0.03 }}
                            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
                          >
                            <span className="font-mono-elite text-[10px] text-[var(--text-3)]">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <p className="font-mono-elite text-[11px] text-[var(--text-2)] transition-all duration-150 hover:text-[var(--text-1)]">
                              {word}
                            </p>
                          </motion.div>
                        ))}
                    </div>
                    {!isSeedRevealed && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-[10px] bg-white/[0.03]">
                        <p className="text-[12px] text-[#2a2a2a]">
                          Click Reveal to view phrase
                        </p>
                      </div>
                    )}
                  </div>
                </motion.section>

                <motion.section
                  className="mt-4 elite-panel rounded-[10px] p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.4 }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-mono-elite text-[11px] uppercase tracking-[0.06em] text-[var(--text-2)]">
                      Mnemonic
                    </p>
                    <span className="rounded-full border border-[var(--border)] bg-[rgba(74,222,128,0.1)] px-2 py-0.5 text-[10px] text-[var(--green)]">
                      Secure
                    </span>
                  </div>
                  <div className="h-px w-full bg-[var(--green)]" />
                </motion.section>
              </>
            ) : (
              <section>
                <div className="mb-6 flex items-end justify-between">
                  <div>
                    <h2 className="text-[20px] font-medium text-[var(--text-1)]">
                      Activity
                    </h2>
                  </div>
                  <div className="flex gap-2">
                    {["All", "Send", "Receive", "Swap"].map((item) => (
                      <button
                        key={item}
                        onClick={() => setActivityFilter(item)}
                        className="relative w-[82px] rounded-full border border-[#1a1a1a] px-[14px] py-[5px] text-center text-[12px] transition-all duration-150"
                      >
                        {activityFilter === item && (
                          <motion.span
                            layoutId="active-filter-pill"
                            className="absolute inset-0 rounded-full border border-[#2a2a2a] bg-white/[0.06]"
                          />
                        )}
                        <span
                          className={`relative z-10 ${
                            activityFilter === item
                              ? "text-[#ebebeb]"
                              : "text-[#3a3a3a] transition-all duration-150 hover:text-[#6a6a68]"
                          }`}
                        >
                          {item}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {!filteredTx.length ? (
                  <EmptyActivityState
                    onOpenDashboard={() => setActivePage("dashboard")}
                    onConnect={() => setIsConnectModalOpen(true)}
                  />
                ) : (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={activityFilter} layout>
                      {filteredTx.map((tx) => (
                        <motion.button
                          key={tx.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          onClick={() => setSelectedTx(tx)}
                          className="flex w-full cursor-pointer items-center justify-between border-b border-[var(--border)] py-3.5 text-left transition-all duration-150 hover:bg-white/[0.02]"
                        >
                          <div>
                            <p className="font-mono-elite text-[11px] text-[#3a3a3a]">
                              {truncateHash(tx.hash)}
                            </p>
                            <p className="text-[11px] text-[#2a2a2a]">
                              {tx.timestamp}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-[10px] py-[3px] text-[11px] font-medium uppercase tracking-[0.04em] ${
                              tx.type === "Receive"
                                ? "border border-[rgba(74,222,128,0.15)] bg-[rgba(74,222,128,0.1)] text-[#4ade80]"
                                : tx.type === "Send"
                                  ? "border border-[rgba(248,113,113,0.15)] bg-[rgba(248,113,113,0.1)] text-[#f87171]"
                                  : "border border-[rgba(123,143,245,0.15)] bg-[rgba(123,143,245,0.1)] text-[#7b8ff5]"
                            }`}
                          >
                            {tx.type}
                          </span>

                          <div className="text-right">
                            <p
                              className={`font-mono-elite text-[13px] font-medium ${
                                tx.amount.startsWith("+")
                                  ? "text-[#4ade80]"
                                  : tx.amount.startsWith("-")
                                    ? "text-[#f87171]"
                                    : "text-[#ebebeb]"
                              }`}
                            >
                              {tx.amount}
                            </p>
                            <p className="inline-flex items-center gap-1 text-xs text-[var(--text-3)]">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  tx.status === "confirmed"
                                    ? "bg-[var(--green)]"
                                    : "bg-[#fbbf24]"
                                }`}
                              />
                              {tx.status}
                            </p>
                          </div>
                        </motion.button>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                )}
              </section>
            )}
          </div>
        </main>

        <footer className="border-t border-white/10 bg-[#080808]/80 px-4 py-3 backdrop-blur-xl md:px-6">
          <div className="flex items-center justify-center text-[11px] text-[var(--text-3)] opacity-70">
            Made with ❤️ by{" "}
            <a
              href="https://github.com/sehgalaayu"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-[var(--text-2)] transition-colors hover:text-[var(--text-1)] hover:underline"
            >
              Aayu
            </a>
          </div>
        </footer>
      </div>

      {createPortal(
        <AnimatePresence mode="wait">
          {selectedTx && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[90] bg-black/70"
                onClick={() => setSelectedTx(null)}
              />
              <motion.aside
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="elite-panel fixed right-0 top-0 z-[91] h-full w-[300px] p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[13px] font-medium text-[var(--text-1)]">
                    Transaction
                  </p>
                  <button
                    className="text-[var(--text-2)]"
                    onClick={() => setSelectedTx(null)}
                  >
                    <span className="material-symbols-outlined text-base">
                      close
                    </span>
                  </button>
                </div>
                <div className="space-y-3 text-[12px]">
                  <div>
                    <p className="text-[var(--text-3)]">Hash</p>
                    <button
                      className="font-mono-elite text-[11px] text-[var(--text-2)]"
                      onClick={() =>
                        copyToClipboard(selectedTx.hash, "Hash copied")
                      }
                    >
                      {selectedTx.hash}
                    </button>
                  </div>
                  <div>
                    <p className="text-[var(--text-3)]">From</p>
                    <p className="font-mono-elite text-[11px] text-[var(--text-2)]">
                      {selectedTx.from}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--text-3)]">To</p>
                    <p className="font-mono-elite text-[11px] text-[var(--text-2)]">
                      {selectedTx.to}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--text-3)]">Amount</p>
                    <p className="font-mono-elite text-[11px] text-[var(--text-1)]">
                      {selectedTx.amount}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--text-3)]">Fee</p>
                    <p className="font-mono-elite text-[11px] text-[var(--text-2)]">
                      {selectedTx.fee}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--text-3)]">Network</p>
                    <p className="text-[12px] text-[var(--text-2)]">
                      {selectedTx.network}
                    </p>
                  </div>
                  <a
                    className="text-[12px] text-[var(--blue)]"
                    href={selectedTx.explorer}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Explorer
                  </a>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {createPortal(
        <AnimatePresence mode="wait">
          {isConnectModalOpen && (
            <motion.div
              {...modalTransition}
              className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-[rgba(0,0,0,0.7)] backdrop-blur-[4px]"
              onClick={() => setIsConnectModalOpen(false)}
            >
              <div
                className="elite-panel w-[440px] max-w-[95vw] md:max-w-[92vw] rounded-[12px] p-4 md:p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-[16px] font-medium text-[var(--text-1)]">
                  Connect a wallet
                </h3>
                <p className="mt-1 text-[12px] text-[var(--text-2)]">
                  Choose how you&apos;d like to connect
                </p>

                <div className="mt-4 overflow-hidden rounded-[10px] border border-[var(--border)]">
                  <button
                    className="flex w-full items-start gap-3 border-b border-[var(--border)] px-3 py-3 text-left transition-all duration-150 hover:bg-white/[0.03]"
                    onClick={connectGeneratedWallet}
                  >
                    <motion.span
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.1 }}
                      className="text-base"
                    >
                      ✨
                    </motion.span>
                    <span>
                      <span className="block text-[13px] font-medium text-[var(--text-1)]">
                        Generate New Wallet
                      </span>
                      <span className="block text-xs text-[var(--text-2)]">
                        Create local wallet from seed phrase
                      </span>
                    </span>
                  </button>
                  <button
                    className="flex w-full items-start gap-3 border-b border-[var(--border)] px-3 py-3 text-left transition-all duration-150 hover:bg-white/[0.03]"
                    onClick={connectMetaMask}
                  >
                    <motion.span
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.1 }}
                      className="text-base"
                    >
                      🦊
                    </motion.span>
                    <span>
                      <span className="block text-[13px] font-medium text-[var(--text-1)]">
                        MetaMask
                      </span>
                      <span className="block text-xs text-[var(--text-2)]">
                        Connect injected browser wallet
                      </span>
                    </span>
                  </button>
                  <button
                    className="flex w-full items-start gap-3 border-b border-[var(--border)] px-3 py-3 text-left transition-all duration-150 hover:bg-white/[0.03]"
                    onClick={() =>
                      showToast("WalletConnect coming soon", "default")
                    }
                  >
                    <motion.span
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.1 }}
                      className="text-base"
                    >
                      🔗
                    </motion.span>
                    <span>
                      <span className="block text-[13px] font-medium text-[var(--text-1)]">
                        WalletConnect
                      </span>
                      <span className="block text-xs text-[var(--text-2)]">
                        Mobile and QR wallet bridge
                      </span>
                    </span>
                  </button>
                  <button
                    className="flex w-full items-start gap-3 px-3 py-3 text-left transition-all duration-150 hover:bg-white/[0.03]"
                    onClick={() =>
                      showToast("Coinbase Wallet coming soon", "default")
                    }
                  >
                    <motion.span
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.1 }}
                      className="text-base"
                    >
                      🏦
                    </motion.span>
                    <span>
                      <span className="block text-[13px] font-medium text-[var(--text-1)]">
                        Coinbase Wallet
                      </span>
                      <span className="block text-xs text-[var(--text-2)]">
                        Connect Coinbase extension wallet
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {createPortal(
        <AnimatePresence mode="wait">
          {isCommandOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[50] bg-[rgba(0,0,0,0.7)]"
                onClick={closeCommandPalette}
              />
              <motion.div
                {...modalTransition}
                className="fixed inset-0 z-[51] flex items-center justify-center p-4"
                onClick={closeCommandPalette}
              >
                <div
                  className="elite-panel h-auto max-h-[400px] w-[560px] max-w-[92vw] overflow-hidden rounded-[12px]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="border-b border-[var(--border)] px-4 py-3">
                    <input
                      autoFocus
                      value={commandQuery}
                      onChange={(event) => setCommandQuery(event.target.value)}
                      onKeyDown={onCommandKeyDown}
                      placeholder="Type a command..."
                      className="w-full border-none bg-transparent p-0 text-[14px] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)]"
                    />
                  </div>
                  <div className="max-h-[320px] overflow-y-auto py-1">
                    <AnimatePresence mode="wait" initial={false}>
                      <div key={commandQuery || "all"}>
                        {visibleCommands.length ? (
                          visibleCommands.map((command, index) => (
                            <motion.button
                              key={command.id}
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                duration: 0.12,
                                delay: index * 0.03,
                              }}
                              onClick={() => runCommand(command)}
                              className={`flex w-full items-center justify-between px-4 py-2 text-left transition-all duration-150 ${
                                selectedCommandIndex === index
                                  ? "border-l-2 border-[var(--green)] bg-white/[0.04]"
                                  : "border-l-2 border-transparent hover:bg-white/[0.04]"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[14px] text-[var(--text-2)]">
                                  {command.icon}
                                </span>
                                <span className="text-[13px] text-[var(--text-1)]">
                                  {command.label}
                                </span>
                              </span>
                              <span className="text-[11px] text-[var(--text-3)]">
                                {command.hint}
                              </span>
                            </motion.button>
                          ))
                        ) : (
                          <p className="px-4 py-4 text-[13px] text-[var(--text-3)]">
                            No commands
                          </p>
                        )}
                      </div>
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

export default App;
