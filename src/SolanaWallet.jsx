import { derivePath } from "ed25519-hd-key";
import { useState } from "react";
import { mnemonicToSeed } from "bip39";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";

export default function SolanaWallet({ mnemonic }) {
   const [currentIndex, setCurrentIndex] = useState(0);
   const [wallets, setWallets] = useState([]); // [{pub, priv}]
   const [visiblePrivates, setVisiblePrivates] = useState([]); // [bool]

   if (!mnemonic) {
      return <div>Please generate a mnemonic first.</div>;
   }

   const addWallet = async () => {
      const seed = await mnemonicToSeed(mnemonic);
      const path = `m/44'/501'/${currentIndex}'/0'`;
      const derivedSeed = derivePath(path, seed.toString("hex")).key;
      const secret = nacl.sign.keyPair.fromSeed(derivedSeed).secretKey;
      const keypair = Keypair.fromSecretKey(secret);
      setCurrentIndex(currentIndex + 1);
      setWallets([...wallets, {
        pub: keypair.publicKey.toBase58(),
        priv: Buffer.from(keypair.secretKey).toString('hex')
      }]);
      setVisiblePrivates([...visiblePrivates, false]);
   };

   const togglePrivate = idx => {
      setVisiblePrivates(visiblePrivates => visiblePrivates.map((v, i) => i === idx ? !v : v));
   };

   return <div style={{marginBottom: 24}}>
      <button className="copy-btn minimal-btn" onClick={addWallet}>
         Add Solana wallet
      </button>
      {wallets.map((w, i) => (
         <div key={i} style={{margin: '12px 0', padding: '12px 0', borderBottom: '1px solid #232526'}}>
            <div style={{color: '#24c6dc', fontWeight: 600}}>Public Key: <span style={{color:'#fff'}}>{w.pub}</span></div>
            <div style={{marginTop: 6}}>
              Private Key: {visiblePrivates[i] ? <span style={{color:'#fff'}}>{w.priv}</span> : <span style={{letterSpacing:2}}>••••••••••••••••••••••••</span>}
              <button className="copy-btn minimal-btn" style={{marginLeft: 12, padding: '4px 12px', fontSize: '0.95rem'}} onClick={() => togglePrivate(i)}>
                {visiblePrivates[i] ? 'Hide' : 'Unhide'}
              </button>
            </div>
         </div>
      ))}
   </div>
}