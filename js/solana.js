// Configuración de Solana
const network = 'testnet';
const connection = new solanaWeb3.Connection(
    solanaWeb3.clusterApiUrl(network),
    'confirmed'
);

// Wallet verificada del administrador
const ADMIN_WALLET_ADDRESS = '3Yekte2UrR2rKFBfm3q6D2DyinZKN58svqJvQF87RX3o';
const ADMIN_WALLET_PUBKEY = new solanaWeb3.PublicKey(ADMIN_WALLET_ADDRESS);

// Estado de la wallet
let currentWallet = {
    publicKey: null,
    provider: null,
    balance: 0
};

// Funciones de conexión a Solana
async function connectToBlockchain() {
    try {
        document.getElementById('real-connection-status').innerHTML = '<strong>Estado Blockchain:</strong> Conectando a Solana Testnet...';

        const version = await connection.getVersion();
        const slot = await connection.getSlot();

        document.getElementById('real-connection-status').innerHTML =
            `<strong>Estado Blockchain:</strong> ✅ Conectado a Solana Testnet<br>
             <small>Version: ${version['solana-core']} | Slot: ${slot.toLocaleString()}</small>`;

        console.log('✅ Conectado a Solana Testnet:', version);

        await updateAdminBalance();

        return true;
    } catch (error) {
        document.getElementById('real-connection-status').innerHTML =
            '<strong>Estado Blockchain:</strong> ❌ Error conectando a Solana Testnet';
        console.error('Error conectando a Solana:', error);
        return false;
    }
}

async function connectRealWallet(walletType) {
    try {
        let provider;

        if (walletType === 'phantom') {
            provider = window.solana;
        } else if (walletType === 'solflare') {
            provider = window.solflare;
        } else {
            throw new Error('Wallet no soportada');
        }

        if (!provider) {
            showUserAlert(
                `${walletType} no está instalada. Por favor, instálala desde ${walletType === 'phantom' ? 'phantom.app' : 'solflare.com'} para continuar.`,
                'warning',
                8000
            );
            return false;
        }

        const response = await provider.connect();
        const publicKey = provider.publicKey;

        const balance = await connection.getBalance(publicKey);
        const balanceInSOL = balance / solanaWeb3.LAMPORTS_PER_SOL;

        currentWallet = {
            publicKey: publicKey,
            provider: provider,
            balance: balanceInSOL
        };

        updateWalletUI(publicKey.toString(), balanceInSOL);
        checkIfAdmin(publicKey.toString());

        document.getElementById('wallet-modal').classList.remove('active');

        showUserAlert(
            `✅ ${walletType} conectada correctamente a VeriRifa-Sol`,
            'success',
            5000
        );

        return true;

    } catch (error) {
        console.error('Error conectando wallet:', error);
        showUserAlert(`❌ Error conectando wallet: ${error.message}`, 'error');
        return false;
    }
}

async function updateUserBalance() {
    if (!currentWallet.publicKey) return;
    
    try {
        const balance = await connection.getBalance(currentWallet.publicKey);
        const balanceInSOL = balance / solanaWeb3.LAMPORTS_PER_SOL;
        currentWallet.balance = balanceInSOL;
        
        document.getElementById('wallet-balance').textContent = `${balanceInSOL.toFixed(4)} SOL`;
        
        if (document.getElementById('number-selection-modal').classList.contains('active')) {
            document.getElementById('user-balance').textContent = `${balanceInSOL.toFixed(4)} SOL`;
        }
        
        return balanceInSOL;
    } catch (error) {
        console.error('Error actualizando balance del usuario:', error);
        return currentWallet.balance;
    }
}

async function updateAdminBalance() {
    try {
        const balance = await connection.getBalance(ADMIN_WALLET_PUBKEY);
        const balanceInSOL = balance / solanaWeb3.LAMPORTS_PER_SOL;
        document.getElementById('admin-wallet-balance').textContent = `Balance: ${balanceInSOL.toFixed(4)} SOL`;
        return balanceInSOL;
    } catch (error) {
        console.error('Error obteniendo balance del admin:', error);
        document.getElementById('admin-wallet-balance').textContent = 'Balance: Error al cargar';
        return 0;
    }
}

function disconnectWallet() {
    if (currentWallet.provider) {
        currentWallet.provider.disconnect();
    }

    currentWallet = {
        publicKey: null,
        provider: null,
        balance: 0
    };

    isConnected = false;
    isAdmin = false;

    document.getElementById('connected-wallet-address').style.display = 'none';
    document.getElementById('wallet-balance').style.display = 'none';
    document.getElementById('connect-wallet-btn').innerHTML = '<span>👛 Conectar Wallet</span>';
    document.getElementById('connect-wallet-btn').className = 'btn';
    document.getElementById('network-indicator').textContent = '🔴 Desconectado';
    document.getElementById('network-indicator').style.background = 'rgba(153, 69, 255, 0.2)';
    document.getElementById('disconnect-wallet-btn').style.display = 'none';
    document.getElementById('winner-info-btn').style.display = 'none';
    
    // OCULTAR ELEMENTOS DE ADMIN AL DESCONECTAR
    document.getElementById('admin-menu-item').style.display = 'none';
    document.getElementById('admin-menu-item').classList.remove('visible');
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('admin-panel').classList.remove('active');

    document.getElementById('connection-status').innerHTML = '<strong>Estado Wallet:</strong> Desconectado';

    showUserAlert('🔌 Wallet desconectada', 'info');
    
    // Re-renderizar los sorteos al desconectar
    renderRaffles();
}

function updateWalletUI(publicKey, balance) {
    const shortAddress = `${publicKey.substring(0, 6)}...${publicKey.substring(publicKey.length - 4)}`;

    document.getElementById('connected-wallet-address').textContent = shortAddress;
    document.getElementById('connected-wallet-address').style.display = 'block';
    document.getElementById('wallet-balance').textContent = `${balance.toFixed(4)} SOL`;
    document.getElementById('wallet-balance').style.display = 'block';
    document.getElementById('connect-wallet-btn').innerHTML = '<span>✅ Conectado</span>';
    document.getElementById('connect-wallet-btn').className = 'btn btn-success';
    document.getElementById('network-indicator').textContent = '🟢 Solana Testnet';
    document.getElementById('network-indicator').style.background = 'rgba(20, 241, 149, 0.2)';
    document.getElementById('disconnect-wallet-btn').style.display = 'block';
    document.getElementById('winner-info-btn').style.display = 'block';

    document.getElementById('connection-status').innerHTML = '<strong>Estado Wallet:</strong> ✅ Conectada a VeriRifa-Sol';

    // Verificar si es admin y mostrar/ocultar elementos
    checkIfAdmin(publicKey);
    
    // Actualizar botones de reclamar premio si es ganador
    updateClaimButtons();
}
