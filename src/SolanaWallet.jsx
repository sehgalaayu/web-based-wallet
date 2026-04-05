import { derivePath } from "ed25519-hd-key";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
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
  { mnemonic, copyToClipboard, onWalletAdded, canAddWallet },
  ref,
) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [wallets, setWallets] = useState([]);
  const [revealedPrivate, setRevealedPrivate] = useState([]);
  const [confirmState, setConfirmState] = useState({ open: false, idx: -1 });
  const [pinInput, setPinInput] = useState("");
  const [copiedAddressIdx, setCopiedAddressIdx] = useState(-1);
  const [copiedKeyIdx, setCopiedKeyIdx] = useState(-1);

  const addWallet = async (mnemonicOverride) => {
    const sourceMnemonic = resolveMnemonicInput(mnemonicOverride, mnemonic);
    if (!canAddWallet || !sourceMnemonic) {
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
    setPinInput("");
    setConfirmState({ open: true, idx });
  };

  const confirmReveal = () => {
    if (pinInput.trim().length < 1) {
      showToast("Enter PIN/password", "error");
      return;
    }
    setRevealedPrivate((prev) =>
      prev.map((item, i) => (i === confirmState.idx ? true : item)),
    );
    setConfirmState({ open: false, idx: -1 });
    showToast("Private key revealed", "success");
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
    setPinInput("");
    setCopiedAddressIdx(-1);
    setCopiedKeyIdx(-1);
  };

  useEffect(() => {
    if (!confirmState.open) return;
    const onEsc = (event) => {
      if (event.key === "Escape") setConfirmState({ open: false, idx: -1 });
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [confirmState.open]);

  const copyAddressIconAction = async (value, idx) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedAddressIdx(idx);
      setTimeout(() => setCopiedAddressIdx(-1), 1500);
    } catch {
      showToast("Clipboard unavailable", "error");
    }
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

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <p className="label-caps">Solana Wallets</p>
        <button
          className="text-[13px] text-[var(--text-2)] transition-all duration-150 hover:text-[var(--text-1)]"
          onClick={() => addWallet()}
        >
          + Add
        </button>
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
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {wallets.map((wallet, index) => (
            <article
              key={wallet.pub}
              className="wallet-lift rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full border border-[var(--border)] bg-[rgba(167,139,250,0.12)] px-2 py-0.5 text-[11px] text-[var(--purple)]">
                  SOL Account {index + 1}
                </span>
                <button
                  className="rounded-md border border-[var(--border)] p-1 text-[var(--text-2)] transition-all duration-150 hover:text-[var(--text-1)]"
                  onClick={() => copyAddressIconAction(wallet.pub, index)}
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

              <p
                className="mb-3 font-mono-elite text-[11px] text-[var(--text-2)]"
                title={wallet.pub}
              >
                {truncateAddress(wallet.pub)}
              </p>

              <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-white/[0.02] px-2.5 py-2">
                <div>
                  <p className="label-caps">Private key</p>
                  <AnimatePresence mode="wait" initial={false}>
                    {revealedPrivate[index] ? (
                      <motion.div
                        key="revealed"
                        initial={{ opacity: 0, filter: "blur(4px)" }}
                        animate={{ opacity: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="flex items-center gap-2"
                      >
                        <p className="font-mono-elite text-[11px] text-[var(--text-2)]">
                          {truncatePrivateDisplay(wallet.priv)}
                        </p>
                        <button
                          className="rounded-md border border-[var(--border)] p-1 text-[var(--text-2)]"
                          onClick={() => copyFullKeyAction(wallet.priv, index)}
                          title="Copy full key"
                        >
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.span
                              key={
                                copiedKeyIdx === index
                                  ? "key-check"
                                  : "key-copy"
                              }
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.6, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="material-symbols-outlined text-[13px]"
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
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="font-mono-elite text-[11px] text-[var(--text-3)]"
                      >
                        ••••••••
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  className="rounded-md border border-[var(--border)] px-3 py-1 text-[12px] text-[var(--text-1)] transition-all duration-150 hover:border-[#2a2a2a]"
                  onClick={() => openRevealConfirmation(index)}
                >
                  Reveal
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {createPortal(
        <AnimatePresence mode="wait">
          {confirmState.open && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-[150] bg-[rgba(0,0,0,0.75)] backdrop-blur-[4px]"
                onClick={() => setConfirmState({ open: false, idx: -1 })}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="fixed left-1/2 top-1/2 z-[151] w-[380px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-[#1f1f1f] bg-[#0e0e0e] p-6"
              >
                <p className="text-[14px] font-medium text-[#ebebeb]">
                  Confirm reveal
                </p>
                <p className="mt-1 text-[12px] text-[#525252]">
                  Enter PIN/password before exposing key
                </p>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(event) => setPinInput(event.target.value)}
                  className="mt-3 w-full rounded-[8px] border border-[#1f1f1f] bg-[#080808] px-[14px] py-[10px] text-[13px] text-[#ebebeb] outline-none focus:border-[#3a3a3a]"
                  placeholder="PIN / password"
                  autoFocus
                />
                <button
                  className="mt-3 h-[38px] w-full rounded-[8px] bg-[#ebebeb] text-[13px] font-medium text-[#080808]"
                  onClick={confirmReveal}
                  disabled={!pinInput.length}
                >
                  Confirm
                </button>
                <button
                  className="mt-2 h-[38px] w-full rounded-[8px] border border-[#1f1f1f] bg-transparent text-[13px] text-[#525252]"
                  onClick={() => setConfirmState({ open: false, idx: -1 })}
                >
                  Cancel
                </button>
                <p className="mt-2 text-center text-[11px] text-[#2a2a2a]">
                  ESC to cancel
                </p>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </section>
  );
});

export default SolanaWallet;
