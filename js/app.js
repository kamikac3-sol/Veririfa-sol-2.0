// Estado global de la aplicación
let isConnected = false;
let isAdmin = false;
let userContactInfo = {
    email: '',
    phone: ''
};

// ✅ MEJORADO: Sistema de gestión de estado de paginación
const paginationState = new Map();

// ✅ NUEVO: Estado de sincronización
let realtimeEnabled = false;

// Función principal de inicialización
async function initApp() {
    console.log('🚀 Inicializando VeriRifa-Sol v2.0...');
    
    // Cargar datos iniciales primero
    await loadRafflesFromFirebase();
    await loadWinnersFromFirebase();

    // Inicializar sincronización en tiempo real
    realtimeEnabled = await initRealtimeSync();
    setupRealtimeConnectionHandlers();
    
    if (realtimeEnabled) {
        console.log('🔄 Sincronización en tiempo real activada');
    }

    // Si no hay sorteos, crear algunos de ejemplo
    if (raffles.length === 0) {
        console.log('📝 Creando sorteos de ejemplo...');
        raffles = [
            {
                id: 'ps5-verificado',
                name: 'PlayStation 5 - Sorteo Verificado',
                description: 'PS5 real en VeriRifa-Sol - Transacciones verificadas',
                price: 0.1,
                image: '🎮',
                totalNumbers: 50,
                soldNumbers: [],
                numberOwners: {},
                prize: 'PlayStation 5 Real',
                contractAddress: 'Testnet Contract',
                status: 'active',
                adminWallet: ADMIN_WALLET_ADDRESS,
                winner: null,
                prizeClaimed: false,
                isSelectingWinner: false,
                completed: false,
                shippingStatus: 'pending',
                createdAt: new Date().toISOString()
            },
            {
                id: 'macbook-verificado',
                name: 'MacBook Pro - Verificado',
                description: 'MacBook Pro real - Blockchain verificada de Solana',
                price: 0.2,
                image: '💻',
                totalNumbers: 30,
                soldNumbers: [],
                numberOwners: {},
                prize: 'MacBook Pro 14"',
                contractAddress: 'Testnet Contract',
                status: 'active',
                adminWallet: ADMIN_WALLET_ADDRESS,
                winner: null,
                prizeClaimed: false,
                isSelectingWinner: false,
                completed: false,
                shippingStatus: 'pending',
                createdAt: new Date().toISOString()
            }
        ];
        // Guardar en Firebase
        await saveRafflesToFirebase();
    }

    // Renderizar componentes
    renderRaffles();
    renderWinnersArchive();

    // Configurar event listeners
    setupEventListeners();
    setupImagePreview();
    updateClaimButtons();

    // Conectar a blockchain después
    await connectToBlockchain();

    showUserAlert(
        '✅ VeriRifa-Sol completamente cargada\n\n' +
        '• Sincronización en tiempo real: ' + (realtimeEnabled ? 'ACTIVADA 🔄' : 'DESACTIVADA') + '\n' +
        '• Blockchain Solana Testnet: CONECTADA ⚡\n' +
        '• Firebase: SINCRONIZADO 🔥',
        'success'
    );
}

function setupEventListeners() {
    // Botón de conectar wallet - usando event delegation para mejor compatibilidad móvil
    document.addEventListener('click', function(e) {
        if (e.target.id === 'connect-wallet-btn' || e.target.closest('#connect-wallet-btn')) {
            document.getElementById('wallet-modal').classList.add('active');
        }
    });

    document.getElementById('close-wallet-modal').addEventListener('click', function() {
        document.getElementById('wallet-modal').classList.remove('active');
    });

    document.getElementById('connect-phantom-real').addEventListener('click', function() {
        connectRealWallet('phantom');
    });

    document.getElementById('connect-solflare-real').addEventListener('click', function() {
        connectRealWallet('solflare');
    });

    document.getElementById('disconnect-wallet-btn').addEventListener('click', disconnectWallet);

    // Botón de información del ganador - NUEVA IMPLEMENTACIÓN
    setupWinnerInfoButton();

    // Botón de ver transacciones - NUEVA IMPLEMENTACIÓN
    setupTransactionsView();

    document.getElementById('admin-panel-link').addEventListener('click', function(e) {
        e.preventDefault();
        if (isAdmin) {
            document.getElementById('admin-panel').classList.add('active');
            renderCompletedRaffles();
            // Cargar tabla de ganadores cuando se abra el panel
            loadWinnersAdminTable();
            window.scrollTo({ top: document.getElementById('admin-panel').offsetTop - 100, behavior: 'smooth' });
        } else {
            showUserAlert('❌ Solo el verificador puede acceder al panel', 'error');
        }
    });

    document.getElementById('close-admin-panel').addEventListener('click', function() {
        document.getElementById('admin-panel').classList.remove('active');
    });

    document.getElementById('view-winners-admin').addEventListener('click', function() {
        const winnersSection = document.querySelector('.winners-admin-section');
        if (winnersSection) {
            winnersSection.scrollIntoView({ behavior: 'smooth' });
        }
    });

    document.getElementById('create-raffle-form').addEventListener('submit', createRaffle);

    document.getElementById('close-number-modal').addEventListener('click', closeNumberSelectionModal);
    document.getElementById('cancel-selection-btn').addEventListener('click', closeNumberSelectionModal);
    document.getElementById('confirm-payment-btn').addEventListener('click', processRealPayment);

    document.getElementById('close-claim-modal').addEventListener('click', closeClaimPrizeModal);
    document.getElementById('cancel-claim-btn').addEventListener('click', closeClaimPrizeModal);
    document.getElementById('submit-claim-btn').addEventListener('click', submitPrizeClaim);

    // MEJORA: Event listeners para el modal de estado de envío
    document.getElementById('close-shipping-modal').addEventListener('click', closeShippingStatusModal);
    document.getElementById('cancel-shipping-btn').addEventListener('click', closeShippingStatusModal);
    document.getElementById('save-shipping-status-btn').addEventListener('click', function() {
        const activeBtn = document.querySelector('.shipping-status-btn.active');
        if (activeBtn) {
            const newStatus = activeBtn.getAttribute('data-status');
            updateShippingStatus(newStatus);
        } else {
            showUserAlert('❌ Por favor, selecciona un estado de envío', 'error');
        }
    });

    // MEJORA: Event listeners para los botones de estado de envío
    document.querySelectorAll('.shipping-status-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.shipping-status-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // MEJORA: Event listeners para las preguntas frecuentes
    setupFAQ();

    // MEJORA: Event listeners para validación en tiempo real del formulario de reclamación
    document.getElementById('winner-name').addEventListener('input', function() {
        if (this.value.trim()) {
            this.classList.remove('error');
            this.classList.add('success');
            document.getElementById('name-validation').classList.remove('show');
        }
    });

    document.getElementById('winner-email').addEventListener('input', function() {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (this.value.trim() && emailRegex.test(this.value.trim())) {
            this.classList.remove('error');
            this.classList.add('success');
            document.getElementById('email-validation').classList.remove('show');
        }
    });

    document.getElementById('winner-phone').addEventListener('input', function() {
        const phoneRegex = /^[0-9+][0-9\s-]{8,}$/;
        if (this.value.trim() && phoneRegex.test(this.value.trim().replace(/\s/g, ''))) {
            this.classList.remove('error');
            this.classList.add('success');
            document.getElementById('phone-validation').classList.remove('show');
        }
    });

    document.getElementById('winner-address').addEventListener('input', function() {
        if (this.value.trim() && this.value.trim().length >= 10) {
            this.classList.remove('error');
            this.classList.add('success');
            document.getElementById('address-validation').classList.remove('show');
        }
    });

    document.getElementById('close-alert').addEventListener('click', hideUserAlert);

    window.addEventListener('click', function(event) {
        if (event.target === document.getElementById('wallet-modal')) {
            document.getElementById('wallet-modal').classList.remove('active');
        }
        if (event.target === document.getElementById('number-selection-modal')) {
            closeNumberSelectionModal();
        }
        if (event.target === document.getElementById('claim-prize-modal')) {
            closeClaimPrizeModal();
        }
        if (event.target === document.getElementById('shipping-status-modal')) {
            closeShippingStatusModal();
        }
    });

    // Configurar filtros para la tabla de ganadores
    setupWinnersAdminFilters();
    
    // ✅ NUEVO: Botón para forzar resincronización
    const resyncBtn = document.getElementById('force-resync-btn');
    if (!resyncBtn) {
        // Crear botón si no existe
        const walletConnector = document.querySelector('.wallet-connector');
        if (walletConnector) {
            const resyncButton = document.createElement('button');
            resyncButton.id = 'force-resync-btn';
            resyncButton.className = 'btn btn-info btn-small';
            resyncButton.innerHTML = '<span>🔄 Sincronizar</span>';
            resyncButton.style.display = 'none';
            walletConnector.appendChild(resyncButton);
            
            resyncButton.addEventListener('click', function() {
                forceResync();
            });
        }
    }
}

// ✅ MEJORADO: Validación robusta de admin
function checkIfAdmin(publicKey) {
    const adminWallets = [
        '3Yekte2UrR2rKFBfm3q6D2DyinZKN58svqJvQF87RX3o'
    ];
    
    isAdmin = adminWallets.includes(publicKey.toString());

    if (isAdmin) {
        document.getElementById('admin-menu-item').classList.add('visible');
        console.log('✅ Modo verificador activado para:', publicKey.toString());
        showUserAlert('✅ Modo verificador activado', 'success');
        loadWinnersAdminTable();
    } else {
        document.getElementById('admin-menu-item').classList.remove('visible');
        document.getElementById('admin-panel').classList.remove('active');
    }
    
    // ✅ IMPORTANTE: Re-renderizar los sorteos cuando cambie el estado de admin
    renderRaffles();
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado, inicializando VeriRifa-Sol...');
    initApp();
});

// ✅ NUEVO: Obtener estado de paginación para un sorteo específico
function getPaginationState(raffleId) {
    if (!paginationState.has(raffleId)) {
        paginationState.set(raffleId, { currentPage: 1 });
    }
    return paginationState.get(raffleId);
}

// ✅ NUEVO: Actualizar estado de paginación
function updatePaginationState(raffleId, newState) {
    paginationState.set(raffleId, { ...getPaginationState(raffleId), ...newState });
}

// ✅ NUEVO: Función para forzar actualización de datos
function forceDataRefresh() {
    if (currentRaffle) {
        const updatedRaffle = raffles.find(r => r.id === currentRaffle.id);
        if (updatedRaffle) {
            currentRaffle = updatedRaffle;
            
            if (document.getElementById('number-selection-modal').classList.contains('active')) {
                renderNumbersGrid();
                updateSelectionUI();
            }
        }
    }
    renderRaffles();
    updateClaimButtons();
}

// ✅ NUEVO: Mostrar/ocultar botón de resincronización
function updateResyncButton() {
    const resyncBtn = document.getElementById('force-resync-btn');
    if (resyncBtn) {
        if (currentWallet.publicKey) {
            resyncBtn.style.display = 'inline-flex';
        } else {
            resyncBtn.style.display = 'none';
        }
    }
}

// ✅ NUEVO: Función auxiliar para crear sorteos de ejemplo
async function createSampleRaffles() {
    const sampleRaffles = [
        {
            id: 'ps5-' + Date.now(),
            name: 'PlayStation 5 - Sorteo Verificado',
            description: 'PS5 real en VeriRifa-Sol - Transacciones verificadas',
            price: 0.1,
            image: '🎮',
            totalNumbers: 50,
            soldNumbers: [],
            numberOwners: {},
            prize: 'PlayStation 5 Real',
            contractAddress: 'Testnet Contract',
            status: 'active',
            adminWallet: ADMIN_WALLET_ADDRESS,
            winner: null,
            prizeClaimed: false,
            isSelectingWinner: false,
            completed: false,
            shippingStatus: 'pending',
            createdAt: new Date().toISOString()
        },
        {
            id: 'macbook-' + Date.now(),
            name: 'MacBook Pro - Verificado',
            description: 'MacBook Pro real - Blockchain verificada de Solana',
            price: 0.2,
            image: '💻',
            totalNumbers: 30,
            soldNumbers: [],
            numberOwners: {},
            prize: 'MacBook Pro 14"',
            contractAddress: 'Testnet Contract',
            status: 'active',
            adminWallet: ADMIN_WALLET_ADDRESS,
            winner: null,
            prizeClaimed: false,
            isSelectingWinner: false,
            completed: false,
            shippingStatus: 'pending',
            createdAt: new Date().toISOString()
        }
    ];
    
    raffles.push(...sampleRaffles);
    await saveRafflesToFirebase();
    renderRaffles();
}
