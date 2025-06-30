import { useState, useEffect } from 'react'
import './App.css'
import { generateMnemonic } from "bip39"; 
import SolanaWallet from './SolanaWallet';
import EthWallet from './EthWallet';


function App() {
  const [mnemonic, setMnemonic] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");


  async function createSeedPhrase() {
    try {
      const m = generateMnemonic();
      setMnemonic(m);
      console.log("Mnemonic:", m);
    } catch (error) {
      console.error("Error generating mnemonic or seed:", error);
    }
  }

  const handleCopy = async () => {
    if (mnemonic) {
      await navigator.clipboard.writeText(mnemonic);
      setSnackbarMsg("Mnemonic copied to clipboard!");
      setSnackbarOpen(true);
    }
  };

  useEffect(() => {
    if (snackbarOpen) {
      const timer = setTimeout(() => setSnackbarOpen(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [snackbarOpen]);

  return (
    <>
      <div className="app-container minimal">
        <h1 className="minimal-title">WebWallet by aayu</h1>
        <button className="copy-btn minimal-btn" style={{marginBottom: 16}} onClick={createSeedPhrase}>
          Create Seed Phrase
        </button>
        {mnemonic && (
          <div className="mnemonic-section minimal-section">
            <div className="mnemonic-label minimal-label">Mnemonic:</div>
            <div style={{display: 'flex', alignItems: 'center'}}>
              <div className="mnemonic-matrix minimal-matrix">
                {mnemonic.split(' ').map((word, idx) => (
                  <div className="mnemonic-word minimal-word" key={idx}>{word}</div>
                ))}
              </div>
              <button className="copy-btn minimal-btn" onClick={handleCopy} title="Copy mnemonic">
                Copy
              </button>
            </div>
          </div>
        )}
        <SolanaWallet mnemonic={mnemonic} />
        <EthWallet mnemonic={mnemonic} />
        {snackbarOpen && (
          <div className="snackbar minimal-snackbar" onClick={() => setSnackbarOpen(false)}>
            {snackbarMsg}
          </div>
        )}
      </div>
      <footer className="footer minimal-footer">
        WebWallet by aayu &nbsp;|&nbsp;
        <a href="https://github.com/sehgalaayu" target="_blank" rel="noopener noreferrer">@sehgalaayu</a>
      </footer>
    </>
  )
}

export default App
