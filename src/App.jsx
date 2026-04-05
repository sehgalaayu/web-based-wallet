import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import jazzicon from "jazzicon";
import { generateMnemonic } from "bip39";
import { createPortal } from "react-dom";
import EthWallet from "./EthWallet";
import SolanaWallet from "./SolanaWallet";
import "./App.css";
import { showToast } from "./utils/toast";

const TOPBAR_HEIGHT = 52;
const SIDEBAR_WIDTH = 200;

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

function EmptyActivityState() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
      <p className="text-[14px] text-[var(--text-2)]">No transactions yet</p>
      <p className="mt-1 text-[12px] text-[var(--text-3)]">
        Your on-chain activity will appear here
      </p>
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

  const ethWalletRef = useRef(null);
  const solWalletRef = useRef(null);

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

  const runCommand = async (command) => {
    await command.run();
    setIsCommandOpen(false);
    setCommandQuery("");
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
        setIsCommandOpen(true);
      }
      if (event.key === "Escape") {
        setIsCommandOpen(false);
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

  return (
    <div className="min-h-screen bg-[var(--bg)] font-body-elite text-[var(--text-1)]">
      <aside
        className="fixed left-0 top-0 z-40 h-screen border-r border-[var(--border)] bg-[var(--surface)]"
        style={{ width: SIDEBAR_WIDTH }}
      >
        <div className="px-4 py-5">
          <p className="text-[13px] font-medium text-[var(--text-1)]">
            • Ethereal Vault
          </p>
        </div>

        <nav className="px-2">
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "activity", label: "Activity" },
          ].map((tab) => {
            const active = activePage === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActivePage(tab.id)}
                className={`relative mb-1 w-full rounded-none px-3 py-2 text-left text-[13px] transition-all duration-150 ${
                  active
                    ? "bg-white/[0.05] text-[var(--text-1)]"
                    : "text-[#2e2e2e] hover:bg-white/[0.02] hover:text-[#5a5a58]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute left-0 top-0 h-full w-[2px] bg-[#ebebeb]"
                  />
                )}
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-4">
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white/[0.02] px-3 py-1 text-[11px] text-[var(--green)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
            {network}
          </span>
        </div>
      </aside>

      <header
        className="fixed top-0 z-30 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-6"
        style={{ left: SIDEBAR_WIDTH, right: 0, height: TOPBAR_HEIGHT }}
      >
        <p className="label-caps">Non-custodial</p>

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

      <main
        className="px-6 pb-8"
        style={{
          marginLeft: SIDEBAR_WIDTH,
          marginTop: TOPBAR_HEIGHT,
          paddingTop: 24,
        }}
      >
        {activePage === "dashboard" ? (
          <>
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.08 }}
              className="pb-6"
            >
              <p className="label-caps">Total Balance</p>
              <p className="metric-value">$0.00</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full border border-[var(--border)] bg-[rgba(74,222,128,0.1)] px-2 py-0.5 text-[11px] text-[var(--green)]">
                  +0.00%
                </span>
                <span className="text-xs text-[var(--text-2)]">24h</span>
              </div>
            </motion.section>

            <div className="mb-6 h-px bg-[var(--border)]" />

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
                canAddWallet={isConnected}
              />
            </motion.section>

            <motion.section
              className="mt-6"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.24 }}
            >
              <SolanaWallet
                ref={solWalletRef}
                mnemonic={mnemonic}
                copyToClipboard={copyToClipboard}
                onWalletAdded={logWalletAdded}
                canAddWallet={isConnected}
              />
            </motion.section>

            <motion.section
              className="mt-6 elite-panel rounded-[10px] p-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.32 }}
            >
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
                    onClick={() =>
                      copyToClipboard(mnemonic, "Seed phrase copied")
                    }
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="relative rounded-[10px] border border-[var(--border)] bg-[#111] p-3">
                <div
                  className={`grid grid-cols-4 gap-2 transition-all duration-200 ${isSeedRevealed ? "blur-0" : "blur-[6px]"}`}
                >
                  {(
                    mnemonic ||
                    "abandon ability able about above absent absorb abstract absurd abuse access account"
                  )
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
              className="mt-6 elite-panel rounded-[10px] p-4"
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
                  {!notifications.length && (
                    <div className="rounded-md border border-[var(--border)] px-3 py-4 text-center">
                      <p className="text-[12px] text-[var(--text-3)]">
                        No notifications yet
                      </p>
                    </div>
                  )}
                  Activity
                </h2>
                <p className="text-[13px] text-[var(--text-3)]">
                  {relativeTime(item.createdAt)}
                </p>
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
              <EmptyActivityState />
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
      </main>

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
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-[rgba(0,0,0,0.7)] backdrop-blur-[4px]"
                onClick={() => setIsConnectModalOpen(false)}
              />
              <motion.div
                {...modalTransition}
                className="fixed inset-0 z-[101] flex items-center justify-center p-4"
              >
                <div className="elite-panel w-[440px] max-w-[92vw] rounded-[12px] p-6">
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
            </>
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
                onClick={() => setIsCommandOpen(false)}
              />
              <motion.div
                {...modalTransition}
                className="fixed inset-0 z-[51] flex items-center justify-center p-4"
              >
                <div className="elite-panel h-auto max-h-[400px] w-[560px] max-w-[92vw] overflow-hidden rounded-[12px]">
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
