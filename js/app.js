// APLICACIÓN PRINCIPAL MEJORADA - VeriRifa-Sol v2.0 - Fase 1
// Archivo: js/app.js

// ============================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ============================================

// Estado de la aplicación
const AppState = {
  // Estado de conexión
  isConnected: false,
  isAdmin: false,
  isSyncing: false,
  
  // Estado de wallet
  currentWallet: {
    publicKey: null,
    provider: null,
    balance: 0,
    connected: false
  },
  
  // Datos de la aplicación
  raffles: [],
  winners: [],
  currentRaffle: null,
  currentPrizeToClaim: null,
  currentShippingRaffle: null,
  
  // Estado de UI
  selectedNumbers: [],
  currentPage: 1,
  numbersPerPage: 100,
  
  // Estado de formularios
  formState: {
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    isValid: false
  },
  
  // Estado de sincronización
  realtimeEnabled: false,
  lastSync: null,
  syncErrorCount: 0,
  
  // Estado de paginación (por sorteo)
  paginationState: new Map(),
  
  // Estado de event listeners
  eventListeners: new Map()
};

// ============================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ============================================

// Función principal de inicialización mejorada
async function initApp() {
  console.log(`🚀 Inicializando VeriRifa-Sol v${CONFIG.VERSION} - Fase 1`);
  
  try {
    // 1. Mostrar overlay de carga
    showLoadingOverlay('Inicializando aplicación...');
    
    // 2. Validar configuración
    const configValidation = validateConfig();
    if (!configValidation.isValid) {
      throw new Error(`Configuración inválida: ${configValidation.errors.join(', ')}`);
    }
    
    if (configValidation.warnings.length > 0) {
      console.warn('Advertencias de configuración:', configValidation.warnings);
    }
    
    // 3. Verificar modo mantenimiento
    if (CONFIG.FEATURES.MAINTENANCE_MODE) {
      showMaintenanceMode();
      return;
    }
    
    // 4. Precargar datos críticos en caché
    if (CONFIG.FEATURES.CACHE_ENABLED) {
      await preloadCriticalData();
    }
    
    // 5. Cargar datos iniciales con caché
    await loadInitialData();
    
    // 6. Inicializar sincronización en tiempo real
    if (CONFIG.FEATURES.REALTIME_SYNC) {
      AppState.realtimeEnabled = await initRealtimeSync();
      setupRealtimeConnectionHandlers();
      
      if (AppState.realtimeEnabled) {
        console.log('🔄 Sincronización en tiempo real activada');
        updateRealtimeStatus(true);
      }
    }
    
    // 7. Si no hay sorteos, crear algunos de ejemplo
    if (AppState.raffles.length === 0) {
      console.log('📝 Creando sorteos de ejemplo...');
      await createSampleRaffles();
    }
    
    // 8. Renderizar componentes
    renderRaffles();
    renderWinnersArchive();
    renderCompletedRaffles();
    
    // 9. Configurar event listeners
    setupEventListeners();
    setupImagePreview();
    updateClaimButtons();
    
    // 10. Conectar a blockchain
    await connectToBlockchain();
    
    // 11. Ocultar overlay de carga
    hideLoadingOverlay();
    
    // 12. Actualizar estado de la aplicación
    AppState.lastSync = new Date().toISOString();
    
    // 13. Mostrar resumen de seguridad (solo para admin)
    if (AppState.isAdmin) {
      setTimeout(() => {
        showSecuritySummary();
      }, 2000);
    }
    
    // 14. Mostrar notificación de éxito
    showAppInitializedAlert();
    
    // 15. Iniciar auto-refresh si está configurado
    if (CONFIG.UI.AUTO_REFRESH_INTERVAL > 0) {
      startAutoRefresh();
    }
    
    console.log('✅ Aplicación inicializada correctamente');
    
  } catch (error) {
    console.error('❌ Error crítico en inicialización:', error);
    hideLoadingOverlay();
    
    // Manejar error con el sistema mejorado
    errorHandler.handleGlobalError(error, {
      source: 'app_init',
      critical: true,
      context: { version: CONFIG.VERSION }
    });
    
    // Mostrar interfaz de error
    showErrorScreen(error);
  }
}

// Cargar datos iniciales con caché
async function loadInitialData() {
  console.log('📥 Cargando datos iniciales...');
  
  try {
    // Cargar sorteos (con caché)
    if (CONFIG.FEATURES.CACHE_ENABLED) {
      await loadRafflesFromFirebaseWithCache();
    } else {
      await loadRafflesFromFirebase();
    }
    
    // Cargar ganadores
    await loadWinnersFromFirebase();
    
    console.log(`✅ Datos cargados: ${AppState.raffles.length} sorteos, ${AppState.winners.length} ganadores`);
    
  } catch (error) {
    console.error('❌ Error cargando datos iniciales:', error);
    
    errorHandler.handleGlobalError(error, {
      source: 'load_initial_data',
      critical: false
    });
    
    // Intentar cargar desde caché si hay error
    if (CONFIG.FEATURES.CACHE_ENABLED) {
      const cachedRaffles = cacheManager.getCachedRaffles();
      const cachedWinners = cacheManager.getCachedWinners();
      
      if (cachedRaffles) AppState.raffles = cachedRaffles;
      if (cachedWinners) AppState.winners = cachedWinners;
      
      console.log('🔄 Usando datos de caché debido a error de carga');
    }
  }
}

// Mostrar alerta de inicialización exitosa
function showAppInitializedAlert() {
  const message = 
    `✅ VeriRifa-Sol v${CONFIG.VERSION} cargada\n\n` +
    `• Seguridad mejorada: ACTIVADA 🔒\n` +
    `• Sistema de caché: ${CONFIG.FEATURES.CACHE_ENABLED ? 'ACTIVADO 💾' : 'DESACTIVADO'}\n` +
    `• Manejo de errores: MEJORADO 🛡️\n` +
    `• Blockchain Solana: ${AppState.currentWallet.connected ? 'CONECTADA ⚡' : 'DESCONECTADA'}\n` +
    `• Sincronización: ${AppState.realtimeEnabled ? 'ACTIVA 🔄' : 'INACTIVA'}`;
  
  showUserAlert(message, 'success', 8000);
}

// ============================================
// MANEJO DE ESTADO
// ============================================

// Actualizar estado de wallet
function updateWalletState(walletData) {
  AppState.currentWallet = {
    ...AppState.currentWallet,
    ...walletData
  };
  
  // Actualizar UI
  updateWalletUI(
    walletData.publicKey?.toString(),
    walletData.balance || AppState.currentWallet.balance
  );
  
  // Verificar si es admin
  checkIfAdmin(walletData.publicKey?.toString());
  
  // Actualizar botones de reclamación
  updateClaimButtons();
  
  // Actualizar botón de resincronización
  updateResyncButton();
}

// Verificar si el usuario es admin
function checkIfAdmin(publicKey) {
  if (!publicKey) {
    AppState.isAdmin = false;
    return false;
  }
  
  const adminWallets = CONFIG.SECURITY.ADMIN_WALLETS;
  AppState.isAdmin = adminWallets.includes(publicKey.toString());
  
  if (AppState.isAdmin) {
    console.log('✅ Modo verificador activado para:', publicKey.toString());
    document.getElementById('admin-menu-item').classList.add('visible');
    document.getElementById('admin-menu-item').style.display = 'block';
    
    // Cargar tabla de admin si es necesario
    loadWinnersAdminTable();
    
    // Mostrar notificación
    showUserAlert('✅ Modo verificador activado', 'success');
  } else {
    document.getElementById('admin-menu-item').classList.remove('visible');
    document.getElementById('admin-menu-item').style.display = 'none';
    document.getElementById('admin-panel').classList.remove('active');
    document.getElementById('admin-panel').style.display = 'none';
  }
  
  return AppState.isAdmin;
}

// Obtener estado de paginación para un sorteo
function getPaginationState(raffleId) {
  if (!AppState.paginationState.has(raffleId)) {
    AppState.paginationState.set(raffleId, { currentPage: 1 });
  }
  return AppState.paginationState.get(raffleId);
}

// Actualizar estado de paginación
function updatePaginationState(raffleId, newState) {
  AppState.paginationState.set(raffleId, { 
    ...getPaginationState(raffleId), 
    ...newState 
  });
}

// ============================================
// MANEJO DE UI Y EVENTOS
// ============================================

// Configurar event listeners mejorados
function setupEventListeners() {
  console.log('🎮 Configurando event listeners...');
  
  // Limpiar listeners anteriores
  cleanupEventListeners();
  
  // Wallet y conexión
  setupWalletEventListeners();
  
  // Modales
  setupModalEventListeners();
  
  // Formularios
  setupFormEventListeners();
  
  // FAQ
  setupFAQ();
  
  // Panel de admin
  setupAdminEventListeners();
  
  // Validación en tiempo real
  setupRealTimeValidation();
  
  // Botones especiales
  setupSpecialButtons();
  
  // Navegación suave
  setupSmoothNavigation();
  
  // Eventos globales
  setupGlobalEventListeners();
  
  console.log('✅ Event listeners configurados');
}

// Configurar listeners de wallet
function setupWalletEventListeners() {
  // Botón de conectar wallet
  safeAddEventListener('connect-wallet-btn', 'click', () => {
    document.getElementById('wallet-modal').classList.add('active');
  });
  
  // Botón de desconectar
  safeAddEventListener('disconnect-wallet-btn', 'click', disconnectWallet);
  
  // Botón de información de ganador
  safeAddEventListener('winner-info-btn', 'click', () => {
    if (!AppState.currentWallet.publicKey) {
      showUserAlert('🔗 Conecta tu wallet primero para ver información de ganador', 'warning');
      return;
    }
    showWinnerInfoModal();
  });
  
  // Botón de resincronización
  safeAddEventListener('force-resync-btn', 'click', () => {
    forceResync();
  });
  
  // Conexión de wallets reales
  safeAddEventListener('connect-phantom-real', 'click', () => {
    connectRealWallet('phantom');
  });
  
  safeAddEventListener('connect-solflare-real', 'click', () => {
    connectRealWallet('solflare');
  });
}

// Configurar listeners de modales
function setupModalEventListeners() {
  // Cerrar modales con botón X
  safeAddEventListener('close-wallet-modal', 'click', () => {
    document.getElementById('wallet-modal').classList.remove('active');
  });
  
  safeAddEventListener('close-number-modal', 'click', closeNumberSelectionModal);
  safeAddEventListener('cancel-selection-btn', 'click', closeNumberSelectionModal);
  
  safeAddEventListener('close-claim-modal', 'click', closeClaimPrizeModal);
  safeAddEventListener('cancel-claim-btn', 'click', closeClaimPrizeModal);
  
  safeAddEventListener('close-shipping-modal', 'click', closeShippingStatusModal);
  safeAddEventListener('cancel-shipping-btn', 'click', closeShippingStatusModal);
  
  // Cerrar modales haciendo clic fuera
  setupModalOutsideClick();
}

// Configurar cierre de modales al hacer clic fuera
function setupModalOutsideClick() {
  const modals = [
    'wallet-modal',
    'number-selection-modal',
    'claim-prize-modal',
    'shipping-status-modal'
  ];
  
  modals.forEach(modalId => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.addEventListener('click', function(event) {
        if (event.target === this) {
          this.classList.remove('active');
          
          // Limpieza específica para cada modal
          if (modalId === 'number-selection-modal') {
            closeNumberSelectionModal();
          } else if (modalId === 'claim-prize-modal') {
            closeClaimPrizeModal();
          } else if (modalId === 'shipping-status-modal') {
            closeShippingStatusModal();
          }
        }
      });
    }
  });
}

// Configurar listeners de formularios
function setupFormEventListeners() {
  // Formulario de crear sorteo
  safeAddEventListener('create-raffle-form', 'submit', (e) => {
    e.preventDefault();
    createRaffle(e);
  });
  
  // Botón de confirmar pago
  safeAddEventListener('confirm-payment-btn', 'click', processRealPayment);
  
  // Botón de enviar reclamación
  safeAddEventListener('submit-claim-btn', 'click', submitPrizeClaim);
  
  // Botón de guardar estado de envío
  safeAddEventListener('save-shipping-status-btn', 'click', () => {
    const activeBtn = document.querySelector('.shipping-status-btn.active');
    if (activeBtn) {
      const newStatus = activeBtn.getAttribute('data-status');
      updateShippingStatus(newStatus);
    } else {
      showUserAlert('❌ Por favor, selecciona un estado de envío', 'error');
    }
  });
  
  // Botones de estado de envío
  document.querySelectorAll('.shipping-status-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.shipping-status-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });
}

// Configurar listeners del panel admin
function setupAdminEventListeners() {
  // Enlace al panel admin
  safeAddEventListener('admin-panel-link', 'click', (e) => {
    e.preventDefault();
    if (AppState.isAdmin) {
      document.getElementById('admin-panel').classList.add('active');
      renderCompletedRaffles();
      loadWinnersAdminTable();
      window.scrollTo({ 
        top: document.getElementById('admin-panel').offsetTop - 100, 
        behavior: 'smooth' 
      });
    } else {
      showUserAlert('❌ Solo el verificador puede acceder al panel', 'error');
    }
  });
  
  // Botones del panel admin
  safeAddEventListener('close-admin-panel', 'click', () => {
    document.getElementById('admin-panel').classList.remove('active');
  });
  
  safeAddEventListener('view-transactions', 'click', showTransactionsModal);
  
  safeAddEventListener('view-winners-admin', 'click', () => {
    const winnersSection = document.querySelector('.winners-admin-section');
    if (winnersSection) {
      winnersSection.scrollIntoView({ behavior: 'smooth' });
    }
  });
  
  // Filtros de la tabla de ganadores
  setupWinnersAdminFilters();
}

// Configurar botones especiales
function setupSpecialButtons() {
  // Botón de cerrar alerta
  safeAddEventListener('close-alert', 'click', hideUserAlert);
  
  // Botón de preview de imagen
  setupImagePreview();
}

// Configurar navegación suave
function setupSmoothNavigation() {
  // Enlaces de navegación interna
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
        
        // Cerrar menú móvil si está abierto
        const mobileMenu = document.querySelector('.mobile-menu');
        if (mobileMenu && mobileMenu.classList.contains('active')) {
          mobileMenu.classList.remove('active');
        }
      }
    });
  });
}

// Configurar eventos globales
function setupGlobalEventListeners() {
  // Detectar cambios en tamaño de ventana
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      handleWindowResize();
    }, 250);
  });
  
  // Detectar tecla Escape para cerrar modales
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });
  
  // Detectar clics en enlaces externos
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="http"]');
    if (link && link.target === '_blank') {
      logAnalyticsEvent('external_link_click', { url: link.href });
    }
  });
}

// Manejar redimensionamiento de ventana
function handleWindowResize() {
  const width = window.innerWidth;
  
  // Ajustar grid de números según el ancho
  if (document.getElementById('number-selection-modal').classList.contains('active')) {
    renderNumbersGrid();
  }
  
  // Ajustar columnas de tablas en móvil
  if (width <= 768) {
    document.querySelectorAll('.raffles-grid').forEach(grid => {
      grid.style.gridTemplateColumns = '1fr';
    });
  }
}

// Cerrar todos los modales
function closeAllModals() {
  const modals = document.querySelectorAll('.modal.active, .wallet-modal.active');
  modals.forEach(modal => {
    modal.classList.remove('active');
    
    // Limpieza específica
    if (modal.id === 'number-selection-modal') {
      closeNumberSelectionModal();
    } else if (modal.id === 'claim-prize-modal') {
      closeClaimPrizeModal();
    } else if (modal.id === 'shipping-status-modal') {
      closeShippingStatusModal();
    }
  });
}

// ============================================
// FUNCIONES DE UI MEJORADAS
// ============================================

// Mostrar overlay de carga
function showLoadingOverlay(message = 'Cargando...') {
  let overlay = document.getElementById('loading-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    document.body.appendChild(overlay);
  }
  
  overlay.innerHTML = `
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <div class="loading-message">${sanitizeHTML(message)}</div>
      <div class="loading-progress" id="loading-progress"></div>
    </div>
  `;
  
  overlay.style.display = 'flex';
  
  // Añadir estilos si no existen
  if (!document.getElementById('loading-styles')) {
    const styles = document.createElement('style');
    styles.id = 'loading-styles';
    styles.textContent = `
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(18, 18, 18, 0.95);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        flex-direction: column;
      }
      
      .loading-content {
        text-align: center;
        max-width: 400px;
        padding: 2rem;
      }
      
      .loading-spinner {
        width: 60px;
        height: 60px;
        border: 4px solid rgba(255,255,255,0.1);
        border-radius: 50%;
        border-top-color: var(--secondary);
        animation: spin 1s linear infinite;
        margin: 0 auto 1.5rem;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      .loading-message {
        color: var(--light);
        font-size: 1.1rem;
        margin-bottom: 1rem;
        font-weight: 500;
      }
      
      .loading-progress {
        height: 4px;
        background: rgba(255,255,255,0.1);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 1rem;
      }
      
      .loading-progress::after {
        content: '';
        display: block;
        width: 50%;
        height: 100%;
        background: var(--secondary);
        animation: progress 2s ease-in-out infinite;
      }
      
      @keyframes progress {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(200%); }
      }
    `;
    document.head.appendChild(styles);
  }
}

// Ocultar overlay de carga
function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.style.opacity = '1';
    }, 300);
  }
}

// Actualizar progreso de carga
function updateLoadingProgress(percent, message = null) {
  const progress = document.getElementById('loading-progress');
  const messageEl = document.querySelector('.loading-message');
  
  if (progress) {
    progress.style.animation = 'none';
    progress.innerHTML = `
      <div style="width: ${Math.max(0, Math.min(100, percent))}%; 
                  height: 100%; 
                  background: var(--secondary); 
                  transition: width 0.3s ease;"></div>
    `;
  }
  
  if (messageEl && message) {
    messageEl.textContent = message;
  }
}

// Actualizar estado de sincronización en UI
function updateRealtimeStatus(enabled) {
  const statusElement = document.getElementById('realtime-status');
  if (statusElement) {
    if (enabled) {
      statusElement.style.display = 'block';
      statusElement.classList.add('active');
    } else {
      statusElement.style.display = 'none';
      statusElement.classList.remove('active');
    }
  }
}

// Actualizar botón de resincronización
function updateResyncButton() {
  const resyncBtn = document.getElementById('force-resync-btn');
  if (resyncBtn) {
    if (AppState.currentWallet.publicKey) {
      resyncBtn.style.display = 'inline-flex';
    } else {
      resyncBtn.style.display = 'none';
    }
  }
}

// Mostrar modo mantenimiento
function showMaintenanceMode() {
  const container = document.createElement('div');
  container.id = 'maintenance-mode';
  container.innerHTML = `
    <div class="maintenance-content">
      <div class="maintenance-icon">🔧</div>
      <h1>VeriRifa-Sol en Mantenimiento</h1>
      <p>Estamos realizando mejoras en la plataforma. Por favor, vuelve más tarde.</p>
      <div class="maintenance-details">
        <p><strong>Versión:</strong> ${CONFIG.VERSION}</p>
        <p><strong>Última actualización:</strong> ${CONFIG.BUILD}</p>
      </div>
    </div>
  `;
  
  // Aplicar estilos
  const styles = document.createElement('style');
  styles.textContent = `
    #maintenance-mode {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--dark);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 2rem;
    }
    
    .maintenance-content {
      text-align: center;
      max-width: 500px;
    }
    
    .maintenance-icon {
      font-size: 4rem;
      margin-bottom: 1.5rem;
      opacity: 0.8;
    }
    
    .maintenance-content h1 {
      color: var(--secondary);
      margin-bottom: 1rem;
      font-size: 2.5rem;
    }
    
    .maintenance-content p {
      color: var(--gray);
      margin-bottom: 1rem;
      line-height: 1.6;
    }
    
    .maintenance-details {
      margin-top: 2rem;
      padding: 1.5rem;
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      border-left: 4px solid var(--warning);
    }
    
    .maintenance-details p {
      margin: 0.5rem 0;
      text-align: left;
    }
  `;
  
  document.head.appendChild(styles);
  document.body.innerHTML = '';
  document.body.appendChild(container);
}

// Mostrar pantalla de error
function showErrorScreen(error) {
  const container = document.createElement('div');
  container.id = 'error-screen';
  container.innerHTML = `
    <div class="error-screen-content">
      <div class="error-icon">⚠️</div>
      <h1>Error al cargar la aplicación</h1>
      <p>Ha ocurrido un error al inicializar VeriRifa-Sol.</p>
      
      <div class="error-details">
        <p><strong>Error:</strong> ${sanitizeHTML(error.message || 'Desconocido')}</p>
        <p><strong>Código:</strong> ${error.code || 'N/A'}</p>
      </div>
      
      <div class="error-actions">
        <button id="retry-init-btn" class="btn btn-warning">🔄 Reintentar</button>
        <button id="clear-cache-btn" class="btn btn-outline">🧹 Limpiar Caché</button>
        <button id="report-error-btn" class="btn btn-info">📧 Reportar Error</button>
      </div>
      
      <div class="error-help">
        <p>Si el problema persiste:</p>
        <ul>
          <li>Verifica tu conexión a internet</li>
          <li>Intenta recargar la página (F5)</li>
          <li>Contacta con soporte técnico</li>
        </ul>
      </div>
    </div>
  `;
  
  // Aplicar estilos
  const styles = document.createElement('style');
  styles.textContent = `
    #error-screen {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--dark);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 2rem;
    }
    
    .error-screen-content {
      text-align: center;
      max-width: 600px;
      width: 100%;
    }
    
    .error-icon {
      font-size: 4rem;
      margin-bottom: 1.5rem;
      opacity: 0.8;
    }
    
    .error-screen-content h1 {
      color: var(--danger);
      margin-bottom: 1rem;
      font-size: 2rem;
    }
    
    .error-screen-content > p {
      color: var(--gray);
      margin-bottom: 2rem;
      line-height: 1.6;
    }
    
    .error-details {
      background: rgba(220, 53, 69, 0.1);
      padding: 1.5rem;
      border-radius: 12px;
      margin: 2rem 0;
      text-align: left;
      border-left: 4px solid var(--danger);
    }
    
    .error-details p {
      margin: 0.5rem 0;
      font-family: monospace;
      font-size: 0.9rem;
    }
    
    .error-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin: 2rem 0;
      flex-wrap: wrap;
    }
    
    .error-help {
      margin-top: 2rem;
      padding: 1.5rem;
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      text-align: left;
    }
    
    .error-help p {
      color: var(--secondary);
      margin-bottom: 0.5rem;
      font-weight: 600;
    }
    
    .error-help ul {
      margin: 0;
      padding-left: 1.5rem;
      color: var(--gray);
    }
    
    .error-help li {
      margin: 0.25rem 0;
    }
    
    @media (max-width: 768px) {
      .error-actions {
        flex-direction: column;
      }
      
      .error-actions .btn {
        width: 100%;
      }
    }
  `;
  
  document.head.appendChild(styles);
  document.body.innerHTML = '';
  document.body.appendChild(container);
  
  // Configurar event listeners para los botones
  document.getElementById('retry-init-btn').addEventListener('click', () => {
    location.reload();
  });
  
  document.getElementById('clear-cache-btn').addEventListener('click', () => {
    if (cacheManager && cacheManager.clearAll) {
      cacheManager.clearAll();
      showUserAlert('✅ Caché limpiada correctamente', 'success');
    }
    setTimeout(() => location.reload(), 1000);
  });
  
  document.getElementById('report-error-btn').addEventListener('click', () => {
    const errorData = errorHandler.exportErrors();
    const mailtoLink = `mailto:soporte@veririfa.com?subject=Error VeriRifa-Sol v${CONFIG.VERSION}&body=${encodeURIComponent(JSON.stringify(errorData, null, 2))}`;
    window.open(mailtoLink, '_blank');
  });
}

// ============================================
// FUNCIONES DE SEGURIDAD Y MONITOREO
// ============================================

// Mostrar resumen de seguridad
async function showSecuritySummary() {
  if (!AppState.isAdmin) return;
  
  try {
    const cacheStats = cacheManager ? cacheManager.getStats() : null;
    const errorStats = errorHandler ? errorHandler.getErrorStats() : null;
    const securityStats = await getSecurityStats();
    
    const summary = `
      🔒 **Resumen de Seguridad - ${new Date().toLocaleDateString('es-ES')}**
      
      📊 **Caché:**
      • Estado: ${cacheStats?.enabled ? 'ACTIVO' : 'INACTIVO'}
      • Hit Rate: ${cacheStats?.hitRate || 0}%
      • Uso: ${cacheStats?.usage || '0%'}
      
      ⚠️ **Errores (últimas 24h):**
      • Totales: ${errorStats?.lastDay || 0}
      • Por categoría: ${errorStats ? Object.entries(errorStats.byCategory).map(([cat, count]) => `${cat}: ${count}`).join(', ') : 'N/A'}
      
      🛡️ **Actividad reciente:**
      • Compras (última hora): ${securityStats?.recentPurchases || 0}
      • Intentos fallidos: ${securityStats?.failedAttempts || 0}
      
      🔗 **Conexiones:**
      • Firebase: ${db ? '✅ CONECTADO' : '❌ DESCONECTADO'}
      • Solana: ${connection ? '✅ CONECTADO' : '❌ DESCONECTADO'}
      • Wallet: ${AppState.currentWallet.connected ? '✅ CONECTADA' : '❌ DESCONECTADA'}
      
      📈 **Estadísticas:**
      • Sorteos activos: ${AppState.raffles.filter(r => !r.completed).length}
      • Ganadores: ${AppState.winners.length}
      • Última sincronización: ${AppState.lastSync ? new Date(AppState.lastSync).toLocaleTimeString('es-ES') : 'Nunca'}
    `;
    
    console.log('📋 Resumen de seguridad:\n', summary);
    
    // Mostrar advertencias si hay problemas
    if (errorStats && errorStats.lastDay > 10) {
      console.warn(`⚠️ Alto número de errores: ${errorStats.lastDay} en 24h`);
    }
    
    if (securityStats && securityStats.failedAttempts > 5) {
      console.warn(`⚠️ Múltiples intentos fallidos: ${securityStats.failedAttempts}`);
    }
    
  } catch (error) {
    console.error('Error mostrando resumen de seguridad:', error);
  }
}

// Verificar salud del sistema
async function checkSystemHealth() {
  const health = {
    timestamp: new Date().toISOString(),
    online: navigator.onLine,
    firebase: !!db,
    blockchain: !!connection,
    wallet: AppState.currentWallet.connected,
    cache: cacheManager ? cacheManager.enabled : false,
    errors: errorHandler ? errorHandler.getErrorStats().lastHour : 0,
    syncStatus: AppState.realtimeEnabled ? 'active' : 'inactive'
  };
  
  // Verificar problemas
  health.issues = [];
  
  if (!health.online) health.issues.push('offline');
  if (!health.firebase) health.issues.push('firebase_disconnected');
  if (health.errors > 5) health.issues.push('high_error_rate');
  if (!health.wallet && AppState.currentWallet.publicKey) health.issues.push('wallet_disconnected');
  
  health.status = health.issues.length === 0 ? 'healthy' : 'unhealthy';
  
  return health;
}

// Auto-refresh de datos
function startAutoRefresh() {
  if (CONFIG.UI.AUTO_REFRESH_INTERVAL <= 0) return;
  
  setInterval(async () => {
    try {
      // Verificar salud antes de refrescar
      const health = await checkSystemHealth();
      
      if (health.status === 'healthy') {
        await forceResync();
      } else if (CONFIG.FEATURES.DEBUG_MODE) {
        console.log('🔄 Auto-refresh omitido por problemas de salud:', health.issues);
      }
    } catch (error) {
      console.error('Error en auto-refresh:', error);
    }
  }, CONFIG.UI.AUTO_REFRESH_INTERVAL);
}

// ============================================
// FUNCIONES DE UTILIDAD MEJORADAS
// ============================================

// Añadir event listener de forma segura
function safeAddEventListener(elementId, eventType, handler) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Elemento no encontrado: #${elementId}`);
    return;
  }
  
  // Remover listener anterior si existe
  const key = `${elementId}_${eventType}`;
  if (AppState.eventListeners.has(key)) {
    element.removeEventListener(eventType, AppState.eventListeners.get(key));
  }
  
  // Añadir nuevo listener
  const wrappedHandler = withErrorHandling(handler, { source: `event_${elementId}` });
  element.addEventListener(eventType, wrappedHandler);
  AppState.eventListeners.set(key, wrappedHandler);
}

// Limpiar event listeners
function cleanupEventListeners() {
  AppState.eventListeners.forEach((handler, key) => {
    const [elementId, eventType] = key.split('_');
    const element = document.getElementById(elementId);
    if (element) {
      element.removeEventListener(eventType, handler);
    }
  });
  AppState.eventListeners.clear();
}

// Crear sorteos de ejemplo (solo desarrollo)
async function createSampleRaffles() {
  if (window.location.hostname !== 'localhost' && 
      window.location.hostname !== '127.0.0.1') {
    return; // Solo en desarrollo
  }
  
  const sampleRaffles = [
    {
      id: 'ps5-' + Date.now(),
      name: 'PlayStation 5 - Sorteo Verificado',
      description: 'PS5 real en VeriRifa-Sol - Transacciones verificadas en Solana Testnet',
      price: 0.1,
      image: '🎮',
      totalNumbers: 50,
      soldNumbers: [],
      numberOwners: {},
      prize: 'PlayStation 5 Real',
      contractAddress: 'Testnet Contract',
      status: 'active',
      adminWallet: CONFIG.ADMIN_WALLET,
      winner: null,
      prizeClaimed: false,
      isSelectingWinner: false,
      completed: false,
      shippingStatus: 'pending',
      createdAt: new Date().toISOString(),
      validated: true
    },
    {
      id: 'macbook-' + Date.now(),
      name: 'MacBook Pro - Verificado',
      description: 'MacBook Pro real - Blockchain verificada de Solana con garantía',
      price: 0.2,
      image: '💻',
      totalNumbers: 30,
      soldNumbers: [],
      numberOwners: {},
      prize: 'MacBook Pro 14"',
      contractAddress: 'Testnet Contract',
      status: 'active',
      adminWallet: CONFIG.ADMIN_WALLET,
      winner: null,
      prizeClaimed: false,
      isSelectingWinner: false,
      completed: false,
      shippingStatus: 'pending',
      createdAt: new Date().toISOString(),
      validated: true
    },
    {
      id: 'iphone-' + Date.now(),
      name: 'iPhone 15 Pro - Sorteo Premium',
      description: 'iPhone 15 Pro 256GB - Tecnología de punta verificada en blockchain',
      price: 0.15,
      image: '📱',
      totalNumbers: 40,
      soldNumbers: [],
      numberOwners: {},
      prize: 'iPhone 15 Pro 256GB',
      contractAddress: 'Testnet Contract',
      status: 'active',
      adminWallet: CONFIG.ADMIN_WALLET,
      winner: null,
      prizeClaimed: false,
      isSelectingWinner: false,
      completed: false,
      shippingStatus: 'pending',
      createdAt: new Date().toISOString(),
      validated: true
    }
  ];
  
  // Añadir a la lista global
  AppState.raffles.push(...sampleRaffles);
  
  // Guardar en Firebase
  await saveRafflesToFirebase();
  
  // Renderizar
  renderRaffles();
  
  console.log(`✅ ${sampleRaffles.length} sorteos de ejemplo creados`);
}

// ============================================
// INICIALIZACIÓN
// ============================================

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOM cargado, inicializando VeriRifa-Sol...');
  
  // Añadir estilos de animaciones si no existen
  addErrorStyles();
  
  // Inicializar con manejo de errores
  setTimeout(() => {
    initApp().catch(error => {
      console.error('Error fatal en inicialización:', error);
      showErrorScreen(error);
    });
  }, 100);
});

// Añadir estilos para animaciones
function addErrorStyles() {
  if (document.getElementById('app-animation-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'app-animation-styles';
  style.textContent = `
    /* Animaciones para la aplicación */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    @keyframes slideInFromRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutToRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
    
    .fade-in {
      animation: fadeIn 0.3s ease;
    }
    
    .pulse {
      animation: pulse 2s infinite;
    }
    
    .slide-in-right {
      animation: slideInFromRight 0.3s ease;
    }
    
    .slide-out-right {
      animation: slideOutToRight 0.3s ease;
    }
    
    /* Mejoras para responsive */
    @media (max-width: 768px) {
      .hide-on-mobile {
        display: none !important;
      }
      
      .mobile-full-width {
        width: 100% !important;
      }
      
      .mobile-stack {
        flex-direction: column !important;
      }
    }
    
    @media (max-width: 480px) {
      .container {
        padding-left: 15px !important;
        padding-right: 15px !important;
      }
      
      .modal-content {
        margin: 10px !important;
        padding: 1rem !important;
      }
    }
  `;
  
  document.head.appendChild(style);
}

// ============================================
// EXPORTAR PARA USO GLOBAL
// ============================================

// Hacer el estado disponible para debugging (solo desarrollo)
if (CONFIG.FEATURES.DEBUG_MODE) {
  window.AppState = AppState;
  window.CONFIG = CONFIG;
}

// Exportar funciones principales
window.initApp = initApp;
window.forceResync = forceResync;
window.checkSystemHealth = checkSystemHealth;
window.showSecuritySummary = showSecuritySummary;
window.cleanupEventListeners = cleanupEventListeners;
window.safeAddEventListener = safeAddEventListener;

console.log('🎯 App.js mejorado cargado y listo');
