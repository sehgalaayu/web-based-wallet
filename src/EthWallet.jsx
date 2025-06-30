import { useState } from "react";
import { mnemonicToSeed } from "bip39";
import { Wallet, HDNodeWallet } from "ethers";

const EthWallet = ({mnemonic}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [wallets, setWallets] = useState([]); // [{address, priv}]
    const [visiblePrivates, setVisiblePrivates] = useState([]); // [bool]

    if (!mnemonic) {
        return <div>Please generate a mnemonic first.</div>;
    }

    const addWallet = async () => {
        try {
            const seed = await mnemonicToSeed(mnemonic);
            const derivationPath = `m/44'/60'/${currentIndex}'/0'`;
            const hdNode = HDNodeWallet.fromSeed(seed);
            const child = hdNode.derivePath(derivationPath);
            const privateKey = child.privateKey;
            const wallet = new Wallet(privateKey);
            setCurrentIndex(currentIndex + 1);
            setWallets([...wallets, {
                address: wallet.address,
                priv: privateKey
            }]);
            setVisiblePrivates([...visiblePrivates, false]);
        } catch (error) {
            alert("Failed to generate wallet. Please make sure a mnemonic is generated.");
            console.error(error);
        }
    };

    const togglePrivate = idx => {
        setVisiblePrivates(visiblePrivates => visiblePrivates.map((v, i) => i === idx ? !v : v));
    };

    return (
        <div style={{marginBottom: 24}}>
            <button className="copy-btn minimal-btn" onClick={addWallet}>
                Add ETH wallet
            </button>
            {wallets.map((w, i) => (
                <div key={i} style={{margin: '12px 0', padding: '12px 0', borderBottom: '1px solid #232526'}}>
                    <div style={{color: '#24c6dc', fontWeight: 600}}>Eth Address: <span style={{color:'#fff'}}>{w.address}</span></div>
                    <div style={{marginTop: 6}}>
                        Private Key: {visiblePrivates[i] ? <span style={{color:'#fff'}}>{w.priv}</span> : <span style={{letterSpacing:2}}>••••••••••••••••••••••••</span>}
                        <button className="copy-btn minimal-btn" style={{marginLeft: 12, padding: '4px 12px', fontSize: '0.95rem'}} onClick={() => togglePrivate(i)}>
                            {visiblePrivates[i] ? 'Hide' : 'Unhide'}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}

export default EthWallet;