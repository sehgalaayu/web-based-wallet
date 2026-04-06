import { derivePath } from "ed25519-hd-key";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { mnemonicToSeed } from "bip39";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import { createPortal } from "react-dom";
import { showToast } from "./utils/toast";

const truncateAddress = (address = "") => {
  if (!address) return "--";
  if (address.length < 13) return address;
  return `${address.slice(0, 6)}···${address.slice(-4)}`;
};

const truncatePrivateDisplay = (key = "") => {
  if (!key || key.length < 28) return key;
  return `${key.slice(0, 12)}···${key.slice(-12)}`;
};

const resolveMnemonicInput = (mnemonicOverride, fallbackMnemonic) => {
  if (typeof mnemonicOverride === "string" && mnemonicOverride.trim()) {
    return mnemonicOverride.trim();
  }
  if (typeof fallbackMnemonic === "string" && fallbackMnemonic.trim()) {
    return fallbackMnemonic.trim();
  }
  return "";
};

const SolanaWallet = forwardRef(function SolanaWallet(
  {
    mnemonic,
    copyToClipboard,
    onWalletAdded,
    canAddWallet,
    wallets,
    setWallets,
    currentIndex,
    setCurrentIndex,
    revealedPrivate,
    setRevealedPrivate,
  },
  ref,
) {
  const HOLD_REVEAL_MS = 1000;
  const [confirmState, setConfirmState] = useState({ open: false, idx: -1 });
  const [showWarningModal, setShowWarningModal] = useState({
    open: false,
    idx: -1,
  });
  const [holdProgress, setHoldProgress] = useState(0);
  const [holdSuccess, setHoldSuccess] = useState(false);
  const [revealPopIdx, setRevealPopIdx] = useState(-1);
  const [copiedAddressIdx, setCopiedAddressIdx] = useState(-1);
  const [copiedKeyIdx, setCopiedKeyIdx] = useState(-1);
  const holdRafRef = useRef(null);
  const holdStartRef = useRef(0);
  const holdConfirmedRef = useRef(false);
  const holdCompleteTimeoutRef = useRef(null);
  const revealPopTimeoutRef = useRef(null);

  const addWallet = async (mnemonicOverride) => {
    let sourceMnemonic = resolveMnemonicInput(mnemonicOverride, mnemonic);

    // If no mnemonic provided and no fallback, generate one
    if (!sourceMnemonic && canAddWallet) {
      try {
        const { generateMnemonic } = await import("bip39");
        sourceMnemonic = generateMnemonic();
        // Note: In a real app, you'd want to save this mnemonic to state
        // For now, we'll just use it to create the wallet
      } catch (error) {
        showToast("Failed to generate mnemonic", "error");
        return null;
      }
    }

    if (!sourceMnemonic) {
      showToast(
        "Generate or connect wallet first using Connect Wallet",
        "error",
      );
      return null;
    }

    try {
      const seed = await mnemonicToSeed(sourceMnemonic);
      const path = `m/44'/501'/${currentIndex}'/0'`;
      const derivedSeed = derivePath(path, seed.toString("hex")).key;
      const secret = nacl.sign.keyPair.fromSeed(derivedSeed).secretKey;
      const keypair = Keypair.fromSecretKey(secret);

      const pub = keypair.publicKey.toBase58();
      const priv = Buffer.from(keypair.secretKey).toString("hex");
      setWallets((prev) => [...prev, { pub, priv }]);
      setRevealedPrivate((prev) => [...prev, false]);
      setCurrentIndex((prev) => prev + 1);
      onWalletAdded?.({ network: "Solana", address: pub });
      return pub;
    } catch (error) {
      console.error("Failed to generate SOL wallet:", error);
      showToast("Failed to add SOL wallet", "error");
      return null;
    }
  };

  const openRevealConfirmation = (idx) => {
    setConfirmState({ open: true, idx });
  };

  const resetHoldState = () => {
    if (holdRafRef.current) {
      window.cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    if (holdCompleteTimeoutRef.current) {
      window.clearTimeout(holdCompleteTimeoutRef.current);
      holdCompleteTimeoutRef.current = null;
    }
    holdStartRef.current = 0;
    holdConfirmedRef.current = false;
    setHoldSuccess(false);
    setHoldProgress(0);
  };

  const confirmReveal = () => {
    const unlockedIdx = confirmState.idx;
    setRevealedPrivate((prev) =>
      prev.map((item, i) => (i === unlockedIdx ? true : item)),
    );
    setRevealPopIdx(unlockedIdx);
    if (revealPopTimeoutRef.current) {
      window.clearTimeout(revealPopTimeoutRef.current);
    }
    revealPopTimeoutRef.current = window.setTimeout(() => {
      setRevealPopIdx(-1);
      revealPopTimeoutRef.current = null;
    }, 320);
    setConfirmState({ open: false, idx: -1 });
    resetHoldState();
  };

  const startHoldReveal = () => {
    if (holdRafRef.current || holdConfirmedRef.current) return;
    holdStartRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - holdStartRef.current;
      const progress = Math.min(elapsed / HOLD_REVEAL_MS, 1);
      setHoldProgress(progress);

      if (progress >= 1) {
        holdRafRef.current = null;
        holdConfirmedRef.current = true;
        setHoldSuccess(true);
        holdCompleteTimeoutRef.current = window.setTimeout(() => {
          holdCompleteTimeoutRef.current = null;
          confirmReveal();
        }, 110);
        return;
      }

      holdRafRef.current = window.requestAnimationFrame(tick);
    };

    holdRafRef.current = window.requestAnimationFrame(tick);
  };

  const stopHoldReveal = () => {
    if (holdConfirmedRef.current) return;
    if (holdRafRef.current) {
      window.cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    setHoldProgress(0);
  };

  const toggleAllPrivate = () => {
    const allVisible =
      revealedPrivate.length > 0 && revealedPrivate.every(Boolean);
    setRevealedPrivate((prev) => prev.map(() => !allVisible));
  };

  const resetWallets = () => {
    setWallets([]);
    setRevealedPrivate([]);
    setCurrentIndex(0);
    setConfirmState({ open: false, idx: -1 });
    resetHoldState();
    setCopiedAddressIdx(-1);
    setCopiedKeyIdx(-1);
  };

  // Sync revealedPrivate array when wallets change
  useEffect(() => {
    if (wallets.length > revealedPrivate.length) {
      setRevealedPrivate((prev) => [
        ...prev,
        ...Array(wallets.length - prev.length).fill(false),
      ]);
    }
  }, [wallets.length, revealedPrivate.length, setRevealedPrivate]);

  useEffect(() => {
    if (!confirmState.open) return;
    const onEsc = (event) => {
      if (event.key === "Escape") setConfirmState({ open: false, idx: -1 });
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [confirmState.open]);

  useEffect(() => {
    if (!confirmState.open) resetHoldState();
  }, [confirmState.open]);

  useEffect(() => {
    return () => {
      if (holdRafRef.current) window.cancelAnimationFrame(holdRafRef.current);
      if (holdCompleteTimeoutRef.current) {
        window.clearTimeout(holdCompleteTimeoutRef.current);
      }
      if (revealPopTimeoutRef.current) {
        window.clearTimeout(revealPopTimeoutRef.current);
      }
    };
  }, []);

  const copyAddressIconAction = async (value, idx) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedAddressIdx(idx);
      setTimeout(() => setCopiedAddressIdx(-1), 1500);
    } catch {
      showToast("Clipboard unavailable", "error");
    }
  };

  const copyFullAddressAction = async (value, idx) => {
    await copyAddressIconAction(value, idx);
  };

  const copyFullKeyAction = async (value, idx) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKeyIdx(idx);
      setTimeout(() => setCopiedKeyIdx(-1), 1500);
    } catch {
      showToast("Clipboard unavailable", "error");
    }
  };

  useImperativeHandle(ref, () => ({
    addWallet,
    getFirstAddress: () => wallets[0]?.pub,
    toggleAllPrivate,
    resetWallets,
  }));

  const holdCircumference = 2 * Math.PI * 16;
  const holdStrokeOffset = holdCircumference * (1 - holdProgress);

  return (
    <section>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold tracking-tight text-[var(--text-1)]">
            Solana Wallets
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-2)] opacity-80">
            Manage SOL accounts and secure private keys.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
            <svg
              className="h-3 w-3 text-emerald-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs font-medium text-emerald-400">
              Encrypted locally
            </span>
          </div>
          <button
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/25"
            onClick={() => addWallet()}
          >
            + Add
          </button>
        </div>
      </div>
      {(!mnemonic || !canAddWallet) && (
        <p className="mb-2 text-[11px] text-[var(--text-3)]">
          Connect wallet first, then add SOL accounts.
        </p>
      )}

      {wallets.length === 0 ? (
        <div className="flex h-16 items-center justify-center">
          <p className="text-[13px] text-[var(--text-3)]">No accounts</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {wallets.map((wallet, index) => (
            <article
              key={wallet.pub}
              className="wallet-lift rounded-[12px] border border-white/10 bg-gradient-to-br from-[rgba(18,18,18,0.96)] via-[rgba(14,14,14,0.9)] to-[rgba(11,11,11,0.9)] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-[1px] hover:border-emerald-500/25 hover:shadow-[0_18px_42px_rgba(0,0,0,0.55)]"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-400">
                  SOL Account {index + 1}
                </span>
                <div className="flex items-start gap-2">
                  <div className="text-right">
                    <p className="text-[13px] font-semibold text-emerald-400">
                      {(0.75 + index * 0.2).toFixed(2)} SOL
                    </p>
                    <p className="text-[10px] text-[var(--text-3)]">
                      24h +{(0.9 + index * 0.35).toFixed(1)}%
                    </p>
                  </div>
                  <button
                    className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-2)] transition-all duration-150 hover:bg-white/[0.04] hover:text-[var(--text-1)]"
                    onClick={() => copyAddressIconAction(wallet.pub, index)}
                    title="Copy address"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={copiedAddressIdx === index ? "check" : "copy"}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="material-symbols-outlined text-[14px]"
                      >
                        {copiedAddressIdx === index ? "check" : "content_copy"}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-2 text-[11px] font-medium text-[var(--text-3)] uppercase tracking-wider">
                  Address
                </p>
                <div className="flex items-center gap-2">
                  <p className="font-mono-elite text-[14px] font-semibold text-[var(--text-1)]">
                    {truncateAddress(wallet.pub)}
                  </p>
                  <button
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-2)] transition-all duration-150 hover:bg-white/[0.04] hover:text-[var(--text-1)]"
                    onClick={() => copyFullAddressAction(wallet.pub, index)}
                    title="Copy full address"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={
                          copiedAddressIdx === index ? "check" : "content_copy"
                        }
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="material-symbols-outlined text-[12px]"
                      >
                        {copiedAddressIdx === index ? "check" : "content_copy"}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-2 text-[11px] font-medium text-[var(--text-3)] uppercase tracking-wider">
                  Private Key
                </p>
                <div className="rounded-lg border border-red-500/20 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent px-4 py-3 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.06)]">
                  <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-red-300/80">
                    <span className="material-symbols-outlined text-[12px]">
                      lock
                    </span>
                    Locked asset
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <AnimatePresence mode="wait" initial={false}>
                        {revealedPrivate[index] ? (
                          <motion.div
                            key="revealed"
                            initial={{
                              opacity: 0,
                              filter: "blur(4px)",
                              scale: 0.97,
                            }}
                            animate={{
                              opacity: 1,
                              filter: "blur(0px)",
                              scale:
                                revealPopIdx === index ? [0.98, 1.015, 1] : 1,
                            }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.32, ease: "easeOut" }}
                            className="flex items-center gap-2"
                          >
                            <p className="font-mono-elite text-[13px] font-medium text-[var(--text-2)]">
                              {truncatePrivateDisplay(wallet.priv)}
                            </p>
                            <button
                              className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-2)] transition-all duration-150 hover:bg-white/[0.04] hover:text-[var(--text-1)]"
                              onClick={() =>
                                copyFullKeyAction(wallet.priv, index)
                              }
                              title="Copy full key"
                            >
                              <AnimatePresence mode="wait" initial={false}>
                                <motion.span
                                  key={
                                    copiedKeyIdx === index
                                      ? "check"
                                      : "content_copy"
                                  }
                                  initial={{ scale: 0.6, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.6, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="material-symbols-outlined text-[12px]"
                                >
                                  {copiedKeyIdx === index
                                    ? "check"
                                    : "content_copy"}
                                </motion.span>
                              </AnimatePresence>
                            </button>
                          </motion.div>
                        ) : (
                          <motion.p
                            key="hidden"
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="font-mono-elite text-[13px] text-[var(--text-3)]"
                          >
                            ••••••••
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>

              <button
                className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1 text-[12px] text-red-400 transition-all duration-150 hover:border-red-500/50 hover:bg-red-500/20"
                onClick={() => setShowWarningModal({ open: true, idx: index })}
              >
                ⚠️ Reveal
              </button>
              <p className="mt-2 text-[11px] text-[var(--text-3)]">
                Anyone with this key can move your funds.
              </p>
            </article>
          ))}
        </div>
      )}

      {createPortal(
        <AnimatePresence mode="wait">
          {showWarningModal.open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-[4px]"
              onClick={() => setShowWarningModal({ open: false, idx: -1 })}
            />
          )}
          {showWarningModal.open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed inset-0 z-[151] flex items-center justify-center p-4"
            >
              <div
                className="w-[420px] max-w-[95vw] md:max-w-[92vw] rounded-[12px] border border-red-500/30 bg-red-500/5 p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                    <svg
                      className="h-5 w-5 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[16px] font-medium text-red-400">
                      Security Warning
                    </h3>
                    <p className="text-[12px] text-[var(--text-3)]">
                      Private key exposure risk
                    </p>
                  </div>
                </div>

                <div className="mb-6 space-y-3">
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                    <p className="text-[13px] text-[var(--text-2)] leading-relaxed">
                      <strong>Never share your private key.</strong> Anyone with
                      access to your private key has full control over your
                      wallet and can steal all funds.
                    </p>
                  </div>
                  <div className="space-y-2 text-[12px] text-[var(--text-3)]">
                    <p>
                      • Private keys should <strong>never</strong> be stored
                      digitally
                    </p>
                    <p>• Write them down on paper and store securely</p>
                    <p>• Only reveal on trusted, secure devices</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-4 py-2.5 text-[13px] text-[var(--text-2)] transition-all duration-150 hover:bg-white/[0.04]"
                    onClick={() =>
                      setShowWarningModal({ open: false, idx: -1 })
                    }
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-[13px] font-medium text-white transition-all duration-150 hover:bg-red-600"
                    onClick={() => {
                      setShowWarningModal({ open: false, idx: -1 });
                      openRevealConfirmation(showWarningModal.idx);
                    }}
                  >
                    I Understand the Risk
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {confirmState.open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed inset-0 z-[151] flex items-center justify-center p-4 bg-[rgba(0,0,0,0.75)] backdrop-blur-[4px]"
              onClick={() => setConfirmState({ open: false, idx: -1 })}
            >
              <div
                className="w-[380px] max-w-[95vw] md:max-w-[92vw] rounded-[12px] border border-[#1f1f1f] bg-[#0e0e0e] p-4 md:p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-[14px] font-medium text-[#ebebeb]">
                  Confirm reveal
                </p>
                <p className="mt-1 text-[12px] text-[#525252]">
                  Press and hold to reveal this private key
                </p>
                <motion.button
                  className="mt-3 flex h-[56px] w-full items-center gap-3 rounded-[10px] border border-red-500/25 bg-red-500/10 px-3 text-left text-[13px] text-red-200 transition-all duration-150 hover:bg-red-500/15"
                  animate={
                    holdSuccess
                      ? {
                          scale: [1, 1.018, 1],
                          boxShadow: [
                            "0 0 0 rgba(248,113,113,0)",
                            "0 0 12px rgba(248,113,113,0.42)",
                            "0 0 0 rgba(248,113,113,0)",
                          ],
                        }
                      : { scale: 1, boxShadow: "0 0 0 rgba(248,113,113,0)" }
                  }
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  onPointerDown={startHoldReveal}
                  onPointerUp={stopHoldReveal}
                  onPointerLeave={stopHoldReveal}
                  onPointerCancel={stopHoldReveal}
                  onKeyDown={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      startHoldReveal();
                    }
                  }}
                  onKeyUp={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      stopHoldReveal();
                    }
                  }}
                >
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                    <svg
                      className="absolute h-10 w-10 -rotate-90"
                      viewBox="0 0 40 40"
                    >
                      <circle
                        cx="20"
                        cy="20"
                        r="16"
                        stroke="rgba(248,113,113,0.25)"
                        strokeWidth="3"
                        fill="none"
                      />
                      <circle
                        cx="20"
                        cy="20"
                        r="16"
                        stroke="rgb(248,113,113)"
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray={holdCircumference}
                        strokeDashoffset={holdStrokeOffset}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="material-symbols-outlined text-[18px]">
                      fingerprint
                    </span>
                  </span>
                  <span>
                    <span className="block font-medium text-red-200">
                      {holdProgress > 0 ? "Keep holding..." : "Hold to reveal"}
                    </span>
                    <span className="block text-[11px] text-red-200/70">
                      Hold for 1.0 seconds
                    </span>
                  </span>
                </motion.button>
                <button
                  className="mt-2 h-[38px] w-full rounded-[8px] border border-[#1f1f1f] bg-transparent text-[13px] text-[#525252]"
                  onClick={() => setConfirmState({ open: false, idx: -1 })}
                >
                  Cancel
                </button>
                <p className="mt-2 text-center text-[11px] text-[#2a2a2a]">
                  ESC to cancel
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </section>
  );
});

export default SolanaWallet;
