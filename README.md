# WebWallet by aayu

A minimalistic, futuristic web-based wallet for generating and managing Solana and Ethereum wallets. Built with React, this app allows you to securely generate mnemonics, derive wallets, and view/copy public and private keys (private keys are hidden by default for security).

## 🚀 Live Demo

Check out the live app on Vercel: [WebWallet on Vercel](https://web-based-wallet-32bt.vercel.app/)

## ✨ Features
- Generate a new BIP39 mnemonic (seed phrase)
- Display mnemonic in a matrix-style box with copy-to-clipboard
- Add multiple Solana and Ethereum wallets from the same mnemonic
- View public keys/addresses for each wallet
- Reveal/hide private keys for each wallet entry (hidden by default)
- Minimal, glassmorphic, dark-themed UI
- Built with React and Vite

## 🛠️ Tech Stack
- React
- Vite
- bip39, ethers, @solana/web3.js, ed25519-hd-key
- Custom CSS (minimalistic, glassmorphic, dark theme)

## 🖥️ Getting Started

1. **Clone the repo:**
   ```bash
   git clone https://github.com/sehgalaayu/web-based-wallet.git
   cd web-based-wallet/web-based-wallet
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Run the app locally:**
   ```bash
   npm run dev
   ```
4. **Open in your browser:**
   Visit [http://localhost:5173](http://localhost:5173) (or the port shown in your terminal)


## 👤 Author
- [@sehgalaayu](https://github.com/sehgalaayu)

---

**Note:** Never share your mnemonic or private keys with anyone. This app is for educational and demo purposes. For real funds, always use trusted, audited wallet software.
