// SISTEMA AVANZADO DE MANEJO DE ERRORES - VeriRifa-Sol v2.0
// Archivo: js/error-handler.js

class ErrorHandler {
  constructor(config = {}) {
    // Configuración
    this.config = {
      enabled: config.ERROR_REPORTING !== false,
      logToConsole: config.DEBUG_MODE !== false,
      showUserAlerts: true,
      maxLogSize: 100,
      autoCleanupDays: 7,
      alertDuration: 5000,
      ...config
    };

    // Registro de errores
    this.errorLog = [];
    this.errorCounts = {
      total: 0,
      byCategory: {},
      byCode: {},
      last24Hours: 0
    };

    // Códigos de error estandarizados
    this.errorCodes = {
      // Errores de wallet/blockchain
      WALLET_NOT_CONNECTED: 'W001',
      WALLET_DISCONNECTED: 'W002',
      INSUFFICIENT_BALANCE: 'W003',
      NETWORK_ERROR: 'W004',
      TRANSACTION_FAILED: 'W005',
      TRANSACTION_TIMEOUT: 'W006',
      TRANSACTION_REJECTED: 'W007',
      
      // Errores de Firebase
      FIREBASE_CONNECTION: 'F001',
      FIREBASE_PERMISSION: 'F002',
      FIREBASE_TIMEOUT: 'F003',
      FIREBASE_QUOTA: 'F004',
      
      // Errores de validación
      VALIDATION_ERROR: 'V001',
      INVALID_INPUT: 'V002',
      RATE_LIMIT_EXCEEDED: 'V003',
      DUPLICATE_ENTRY: 'V004',
      
      // Errores de negocio
      RAFFLE_NOT_FOUND: 'B001',
      NUMBER_NOT_AVAILABLE: 'B002',
      NOT_WINNER: 'B003',
      ALREADY_CLAIMED: 'B004',
      RAFFLE_COMPLETED: 'B005',
      
      // Errores de sistema
      SYSTEM_ERROR: 'S001',
      CACHE_ERROR: 'S002',
      NETWORK_OFFLINE: 'S003',
      UNKNOWN_ERROR: 'S999'
    };

    // Mensajes de error traducidos
    this.errorMessages = {
      es: {
        W001: 'Por favor, conecta tu wallet primero',
        W002: 'Wallet desconectada',
        W003: 'Saldo insuficiente. Necesitas más SOL',
        W004: 'Error de conexión con la red Solana',
        W005: 'Transacción fallida en la blockchain',
        W006: 'La transacción tardó demasiado. Por favor, reintenta',
        W007: 'Transacción rechazada por el usuario',
        
        F001: 'Error conectando con la base de datos',
        F002: 'No tienes permisos para realizar esta acción',
        F003: 'Tiempo de espera agotado al conectar con el servidor',
        F004: 'Límite de uso excedido. Por favor, espera un momento',
        
        V001: 'Error de validación en los datos',
        V002: 'Datos inválidos proporcionados',
        V003: 'Demasiadas solicitudes. Por favor, espera unos minutos',
        V004: 'Esta operación ya fue realizada anteriormente',
        
        B001: 'Sorteo no encontrado',
        B002: 'Número no disponible. Por favor, selecciona otro',
        B003: 'No eres el ganador de este sorteo',
        B004: 'Premio ya reclamado',
        B005: 'Este sorteo ya ha finalizado',
        
        S001: 'Error interno del sistema',
        S002: 'Error al acceder a la memoria caché',
        S003: 'Sin conexión a internet. Por favor, verifica tu conexión',
        S999: 'Error desconocido. Por favor, intenta nuevamente',
        
        DEFAULT: 'Ha ocurrido un error. Por favor, intenta nuevamente'
      },
      en: {
        W001: 'Please connect your wallet first',
        W002: 'Wallet disconnected',
        W003: 'Insufficient balance. You need more SOL',
        W004: 'Network connection error with Solana',
        W005: 'Transaction failed on the blockchain',
        W006: 'Transaction timed out. Please try again',
        W007: 'Transaction rejected by user',
        
        F001: 'Error connecting to database',
        F002: 'You do not have permission to perform this action',
        F003: 'Request timeout connecting to server',
        F004: 'Usage limit exceeded. Please wait a moment',
        
        V001: 'Data validation error',
        V002: 'Invalid data provided',
        V003: 'Too many requests. Please wait a few minutes',
        V004: 'This operation was already performed',
        
        B001: 'Raffle not found',
        B002: 'Number not available. Please select another one',
        B003: 'You are not the winner of this raffle',
        B004: 'Prize already claimed',
        B005: 'This raffle has already ended',
        
        S001: 'Internal system error',
        S002: 'Error accessing cache memory',
        S003: 'No internet connection. Please check your connection',
        S999: 'Unknown error. Please try again',
        
        DEFAULT: 'An error occurred. Please try again'
      }
    };

    // Inicializar
    this.init();
  }

  // Inicializar el sistema
  init() {
    if (!this.config.enabled) {
      console.warn('⚠️ ErrorHandler desactivado por configuración');
      return;
    }

    // Cargar logs anteriores
    this.loadPersistedErrorLog();

    // Configurar captura global de errores
    this.setupGlobalErrorHandling();

    // Configurar limpieza periódica
    this.setupAutoCleanup();

    console.log('✅ ErrorHandler inicializado');
    
    if (this.config.logToConsole) {
      console.log('📊 Errores cargados:', this.errorLog.length);
    }
  }

  // Configurar captura global de errores
  setupGlobalErrorHandling() {
    // Capturar errores no manejados
    window.addEventListener('error', (event) => {
      this.handleGlobalError(event.error || event);
      // Prevenir propagación para evitar mensajes nativos
      event.preventDefault();
    });

    // Capturar promesas rechazadas no manejadas
    window.addEventListener('unhandledrejection', (event) => {
      this.handlePromiseRejection(event.reason);
      // Prevenir propagación
      event.preventDefault();
    });

    // Capturar errores de recursos (imágenes, scripts, etc.)
    window.addEventListener('error', (event) => {
      if (event.target && (event.target.tagName === 'IMG' || event.target.tagName === 'SCRIPT' || event.target.tagName === 'LINK')) {
        const resourceError = {
          message: `Error loading resource: ${event.target.src || event.target.href}`,
          type: 'ResourceError',
          element: event.target.tagName,
          url: event.target.src || event.target.href
        };
        this.handleResourceError(resourceError);
      }
    }, true);
  }

  // Configurar limpieza automática
  setupAutoCleanup() {
    // Limpiar cada hora
    setInterval(() => this.cleanupOldErrors(), 60 * 60 * 1000);
    
    // Limpiar al iniciar
    this.cleanupOldErrors();
  }

  // Normalizar cualquier error a formato estándar
  normalizeError(error, context = {}) {
    const normalized = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      message: error?.message || String(error),
      stack: error?.stack,
      type: error?.name || 'UnknownError',
      code: error?.code || this.errorCodes.UNKNOWN_ERROR,
      category: this.determineCategory(error),
      context: {
        ...context,
        userAgent: navigator.userAgent,
        url: window.location.href,
        wallet: window.currentWallet?.publicKey?.toString() || 'disconnected',
        isAdmin: window.isAdmin || false,
        online: navigator.onLine
      },
      severity: this.determineSeverity(error, context)
    };

    // Añadir información adicional según el tipo
    if (error.isAxiosError || error.status) {
      normalized.context.httpStatus = error.status;
      normalized.context.response = error.response?.data;
    }

    if (error.transactionId || error.signature) {
      normalized.context.transaction = error.transactionId || error.signature;
    }

    return normalized;
  }

  // Generar ID único para el error
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Determinar categoría del error
  determineCategory(error) {
    const message = String(error?.message || error).toLowerCase();
    
    if (message.includes('wallet') || message.includes('phantom') || message.includes('solflare')) {
      return 'WALLET';
    }
    
    if (message.includes('solana') || message.includes('blockchain') || message.includes('transaction')) {
      return 'BLOCKCHAIN';
    }
    
    if (message.includes('firebase') || message.includes('firestore') || message.includes('database')) {
      return 'FIREBASE';
    }
    
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return 'VALIDATION';
    }
    
    if (message.includes('network') || message.includes('offline') || message.includes('connection')) {
      return 'NETWORK';
    }
    
    return 'OTHER';
  }

  // Determinar severidad del error
  determineSeverity(error, context) {
    const message = String(error?.message || error).toLowerCase();
    
    // Errores críticos
    if (message.includes('security') || 
        message.includes('permission') || 
        message.includes('unauthorized') ||
        context.critical === true) {
      return 'CRITICAL';
    }
    
    // Errores importantes
    if (message.includes('transaction failed') || 
        message.includes('insufficient') ||
        message.includes('timeout')) {
      return 'HIGH';
    }
    
    // Errores moderados
    if (message.includes('validation') || 
        message.includes('not found') ||
        message.includes('already')) {
      return 'MEDIUM';
    }
    
    return 'LOW';
  }

  // Manejar error global
  handleGlobalError(error, context = {}) {
    const normalized = this.normalizeError(error, context);
    this.logError(normalized);
    
    // Mostrar al usuario si es necesario
    if (this.shouldShowToUser(normalized)) {
      this.showUserError(normalized);
    }
    
    // Reportar a servicios externos si está configurado
    this.reportToExternalServices(normalized);
    
    return normalized;
  }

  // Manejar rechazo de promesa
  handlePromiseRejection(reason, context = {}) {
    const normalized = this.normalizeError(reason, { ...context, source: 'promise_rejection' });
    this.logError(normalized);
    
    // Mostrar errores importantes de promesas
    if (this.shouldShowPromiseError(normalized)) {
      this.showUserError(normalized, {
        showRetry: true,
        retryCallback: context.retryCallback
      });
    }
    
    return normalized;
  }

  // Manejar error de recursos
  handleResourceError(error) {
    const normalized = this.normalizeError(error, { source: 'resource_load' });
    normalized.severity = 'LOW'; // Generalmente no crítico
    
    this.logError(normalized);
    
    if (this.config.logToConsole) {
      console.warn('⚠️ Error cargando recurso:', error.url);
    }
    
    return normalized;
  }

  // Decidir si mostrar error al usuario
  shouldShowToUser(error) {
    // No mostrar en desarrollo a menos que sea crítico
    if (!this.config.showUserAlerts) return false;
    
    // Mostrar solo errores MEDIUM o superiores
    const showSeverities = ['MEDIUM', 'HIGH', 'CRITICAL'];
    if (!showSeverities.includes(error.severity)) return false;
    
    // No mostrar errores de red si estamos offline
    if (error.category === 'NETWORK' && !navigator.onLine) return false;
    
    // Excepciones específicas que siempre se muestran
    const alwaysShowCodes = [
      this.errorCodes.INSUFFICIENT_BALANCE,
      this.errorCodes.TRANSACTION_FAILED,
      this.errorCodes.WALLET_NOT_CONNECTED
    ];
    
    return alwaysShowCodes.includes(error.code) || error.severity === 'CRITICAL';
  }

  // Decidir si mostrar error de promesa
  shouldShowPromiseError(error) {
    const message = error.message.toLowerCase();
    const showKeywords = [
      'transaction', 'wallet', 'solana', 'firebase', 
      'network', 'connection', 'balance', 'failed'
    ];
    
    return showKeywords.some(keyword => message.includes(keyword)) && 
           error.severity !== 'LOW';
  }

  // Registrar error en el log
  logError(errorData) {
    // Añadir al inicio del array
    this.errorLog.unshift(errorData);
    
    // Actualizar contadores
    this.errorCounts.total++;
    this.errorCounts.byCategory[errorData.category] = (this.errorCounts.byCategory[errorData.category] || 0) + 1;
    this.errorCounts.byCode[errorData.code] = (this.errorCounts.byCode[errorData.code] || 0) + 1;
    
    // Contar errores de las últimas 24 horas
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
    const recentErrors = this.errorLog.filter(e => new Date(e.timestamp).getTime() > last24Hours);
    this.errorCounts.last24Hours = recentErrors.length;
    
    // Mantener tamaño máximo del log
    if (this.errorLog.length > this.config.maxLogSize) {
      const removed = this.errorLog.pop();
      // Actualizar contadores para el error removido
      if (this.errorCounts.byCategory[removed.category] > 0) {
        this.errorCounts.byCategory[removed.category]--;
      }
      if (this.errorCounts.byCode[removed.code] > 0) {
        this.errorCounts.byCode[removed.code]--;
      }
    }
    
    // Persistir en localStorage
    this.persistErrorLog();
    
    // Log en consola si está habilitado
    if (this.config.logToConsole) {
      this.logToConsole(errorData);
    }
    
    return errorData;
  }

  // Persistir log en localStorage
  persistErrorLog() {
    try {
      const logToSave = this.errorLog.slice(0, 50); // Guardar solo los 50 más recientes
      localStorage.setItem('veririfa_error_log_v2', JSON.stringify({
        errors: logToSave,
        counts: this.errorCounts,
        lastUpdated: new Date().toISOString()
      }));
    } catch (error) {
      console.warn('⚠️ No se pudo guardar el log de errores:', error);
    }
  }

  // Cargar log persistido
  loadPersistedErrorLog() {
    try {
      const savedLog = localStorage.getItem('veririfa_error_log_v2');
      if (savedLog) {
        const { errors, counts, lastUpdated } = JSON.parse(savedLog);
        this.errorLog = errors || [];
        this.errorCounts = counts || this.errorCounts;
        
        if (this.config.logToConsole) {
          console.log('📖 Log de errores cargado:', this.errorLog.length, 'errores');
        }
      }
    } catch (error) {
      console.warn('⚠️ No se pudo cargar el log de errores:', error);
    }
  }

  // Mostrar error en consola
  logToConsole(errorData) {
    const style = this.getConsoleStyle(errorData.severity);
    
    console.groupCollapsed(`%c${errorData.code}: ${errorData.message}`, style);
    console.log('Timestamp:', errorData.timestamp);
    console.log('Category:', errorData.category);
    console.log('Severity:', errorData.severity);
    console.log('Stack:', errorData.stack);
    console.log('Context:', errorData.context);
    console.groupEnd();
  }

  // Obtener estilo para consola
  getConsoleStyle(severity) {
    const styles = {
      CRITICAL: 'background: #dc3545; color: white; padding: 2px 4px; border-radius: 3px; font-weight: bold;',
      HIGH: 'background: #fd7e14; color: white; padding: 2px 4px; border-radius: 3px; font-weight: bold;',
      MEDIUM: 'background: #ffc107; color: black; padding: 2px 4px; border-radius: 3px; font-weight: bold;',
      LOW: 'background: #6c757d; color: white; padding: 2px 4px; border-radius: 3px; font-weight: bold;'
    };
    
    return styles[severity] || styles.LOW;
  }

  // Mostrar error al usuario
  showUserError(errorData, options = {}) {
    const {
      duration = this.config.alertDuration,
      showRetry = false,
      retryCallback = null,
      showDetails = false,
      customMessage = null
    } = options;
    
    // Obtener mensaje traducido
    const message = customMessage || this.getErrorMessage(errorData.code);
    
    // Crear elemento de notificación
    const notification = this.createErrorNotification(errorData, message, {
      showRetry,
      retryCallback,
      showDetails
    });
    
    // Añadir al DOM
    document.body.appendChild(notification);
    
    // Configurar auto-eliminación
    if (duration > 0) {
      setTimeout(() => {
        this.removeErrorNotification(notification);
      }, duration);
    }
    
    // Devolver referencia para control manual
    return notification;
  }

  // Crear notificación de error
  createErrorNotification(errorData, message, options) {
    const notification = document.createElement('div');
    notification.className = `error-notification severity-${errorData.severity.toLowerCase()}`;
    notification.setAttribute('data-error-id', errorData.id);
    
    const icon = this.getErrorIcon(errorData.severity);
    const details = options.showDetails ? 
      `<div class="error-details">${errorData.message}</div>` : '';
    
    const retryButton = options.showRetry && options.retryCallback ? 
      `<button class="error-retry-btn">🔄 Reintentar</button>` : 
      `<button class="error-close-btn">&times;</button>`;
    
    notification.innerHTML = `
      <div class="error-notification-content">
        <div class="error-icon">${icon}</div>
        <div class="error-message">
          <div class="error-title">${message}</div>
          ${details}
        </div>
        <div class="error-actions">
          ${retryButton}
        </div>
      </div>
    `;
    
    // Aplicar estilos
    this.applyErrorNotificationStyles(notification, errorData.severity);
    
    // Configurar eventos
    this.setupErrorNotificationEvents(notification, options);
    
    return notification;
  }

  // Obtener icono según severidad
  getErrorIcon(severity) {
    const icons = {
      CRITICAL: '🔥',
      HIGH: '⚠️',
      MEDIUM: '🚧',
      LOW: 'ℹ️'
    };
    return icons[severity] || '❌';
  }

  // Aplicar estilos a la notificación
  applyErrorNotificationStyles(element, severity) {
    const colors = {
      CRITICAL: { bg: '#dc3545', border: '#c82333', text: 'white' },
      HIGH: { bg: '#fd7e14', border: '#e46c10', text: 'white' },
      MEDIUM: { bg: '#ffc107', border: '#e0a800', text: 'black' },
      LOW: { bg: '#6c757d', border: '#545b62', text: 'white' }
    };
    
    const color = colors[severity] || colors.LOW;
    
    element.style.cssText = `
      position: fixed;
      top: 120px;
      right: 20px;
      background: ${color.bg};
      color: ${color.text};
      padding: 1rem;
      border-radius: 8px;
      border-left: 4px solid ${color.border};
      max-width: 400px;
      min-width: 300px;
      z-index: 9999;
      animation: slideInError 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    element.querySelector('.error-notification-content').style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    `;
    
    element.querySelector('.error-icon').style.cssText = `
      font-size: 1.5rem;
      flex-shrink: 0;
    `;
    
    element.querySelector('.error-message').style.cssText = `
      flex: 1;
      min-width: 0;
    `;
    
    element.querySelector('.error-title').style.cssText = `
      font-weight: 600;
      margin-bottom: 0.25rem;
      word-break: break-word;
    `;
    
    element.querySelector('.error-details').style.cssText = `
      font-size: 0.85rem;
      opacity: 0.9;
      margin-top: 0.5rem;
      padding: 0.5rem;
      background: rgba(0,0,0,0.1);
      border-radius: 4px;
      font-family: monospace;
      max-height: 100px;
      overflow-y: auto;
      word-break: break-all;
    `;
    
    element.querySelector('.error-actions').style.cssText = `
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
    `;
    
    element.querySelector('.error-retry-btn, .error-close-btn').style.cssText = `
      background: rgba(255,255,255,0.2);
      border: none;
      color: inherit;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.2s;
    `;
    
    element.querySelector('.error-retry-btn:hover, .error-close-btn:hover').style.cssText = `
      background: rgba(255,255,255,0.3);
    `;
  }

  // Configurar eventos de la notificación
  setupErrorNotificationEvents(notification, options) {
    const closeBtn = notification.querySelector('.error-close-btn');
    const retryBtn = notification.querySelector('.error-retry-btn');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.removeErrorNotification(notification);
      });
    }
    
    if (retryBtn && options.retryCallback) {
      retryBtn.addEventListener('click', () => {
        this.removeErrorNotification(notification);
        options.retryCallback();
      });
    }
  }

  // Eliminar notificación de error
  removeErrorNotification(notification) {
    if (!notification || !notification.parentNode) return;
    
    notification.style.animation = 'slideOutError 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  // Obtener mensaje de error traducido
  getErrorMessage(code, lang = 'es') {
    const messages = this.errorMessages[lang] || this.errorMessages.es;
    return messages[code] || messages.DEFAULT || this.errorMessages.es.DEFAULT;
  }

  // Reportar a servicios externos
  reportToExternalServices(errorData) {
    // Solo en producción y para errores importantes
    if (!this.config.enabled || 
        errorData.severity === 'LOW' || 
        !CONFIG.MONITORING.ENABLED) {
      return;
    }
    
    // Muestreo aleatorio para no saturar
    if (Math.random() > CONFIG.MONITORING.SAMPLE_RATE) {
      return;
    }
    
    try {
      // Aquí integrarías con Sentry, LogRocket, etc.
      // Por ahora solo log
      if (this.config.logToConsole) {
        console.log('📡 Enviando error a servicio de monitoreo:', errorData);
      }
      
      // Ejemplo: enviar a endpoint propio
      if (CONFIG.MONITORING.ENDPOINT) {
        fetch(CONFIG.MONITORING.ENDPOINT, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Error-Source': 'veririfa-sol'
          },
          body: JSON.stringify({
            error: errorData,
            appVersion: CONFIG.VERSION,
            timestamp: new Date().toISOString()
          })
        }).catch(() => {
          // Silenciar errores de envío
        });
      }
    } catch (error) {
      // No queremos errores en el reporte de errores
    }
  }

  // Limpiar errores antiguos
  cleanupOldErrors(days = null) {
    const daysToKeep = days || this.config.autoCleanupDays;
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    const initialCount = this.errorLog.length;
    this.errorLog = this.errorLog.filter(error => 
      new Date(error.timestamp).getTime() > cutoff
    );
    
    // Recalcular contadores
    this.recalculateCounts();
    
    // Persistir cambios
    this.persistErrorLog();
    
    const removedCount = initialCount - this.errorLog.length;
    if (removedCount > 0 && this.config.logToConsole) {
      console.log(`🧹 Limpiados ${removedCount} errores antiguos (más de ${daysToKeep} días)`);
    }
  }

  // Recalcular contadores después de limpieza
  recalculateCounts() {
    this.errorCounts = {
      total: this.errorLog.length,
      byCategory: {},
      byCode: {},
      last24Hours: 0
    };
    
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
    
    this.errorLog.forEach(error => {
      this.errorCounts.byCategory[error.category] = (this.errorCounts.byCategory[error.category] || 0) + 1;
      this.errorCounts.byCode[error.code] = (this.errorCounts.byCode[error.code] || 0) + 1;
      
      if (new Date(error.timestamp).getTime() > last24Hours) {
        this.errorCounts.last24Hours++;
      }
    });
  }

  // Métodos para errores específicos comunes
  handleWalletError(error, context = {}) {
    const normalized = this.normalizeError(error, { ...context, action: 'wallet_connection' });
    normalized.code = this.errorCodes.WALLET_NOT_CONNECTED;
    
    this.logError(normalized);
    
    this.showUserError(normalized, {
      showRetry: true,
      retryCallback: () => {
        document.getElementById('wallet-modal').classList.add('active');
      }
    });
    
    return normalized;
  }

  handleTransactionError(error, transactionData = {}) {
    const normalized = this.normalizeError(error, { 
      ...transactionData, 
      action: 'blockchain_transaction' 
    });
    
    // Determinar código específico de transacción
    if (error.message?.includes('rejected')) {
      normalized.code = this.errorCodes.TRANSACTION_REJECTED;
    } else if (error.message?.includes('timeout')) {
      normalized.code = this.errorCodes.TRANSACTION_TIMEOUT;
    } else {
      normalized.code = this.errorCodes.TRANSACTION_FAILED;
    }
    
    this.logError(normalized);
    
    this.showUserError(normalized, {
      showRetry: true,
      retryCallback: transactionData.retryCallback,
      showDetails: true,
      duration: 10000
    });
    
    // Revertir cambios locales si es necesario
    if (transactionData.revertCallback) {
      transactionData.revertCallback();
    }
    
    return normalized;
  }

  handleValidationError(errors, context = {}) {
    const errorData = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      message: 'Multiple validation errors',
      type: 'ValidationError',
      code: this.errorCodes.VALIDATION_ERROR,
      category: 'VALIDATION',
      context: { errors, ...context },
      severity: 'MEDIUM'
    };
    
    this.logError(errorData);
    
    // Mostrar errores como lista
    const errorList = errors.map(err => `• ${err}`).join('\n');
    this.showUserError(errorData, {
      customMessage: `❌ Errores de validación:\n${errorList}`,
      showDetails: false,
      duration: 8000
    });
    
    return errorData;
  }

  handleNetworkError(error, context = {}) {
    const normalized = this.normalizeError(error, { ...context, action: 'network_request' });
    normalized.code = this.errorCodes.NETWORK_ERROR;
    normalized.severity = 'HIGH';
    
    this.logError(normalized);
    
    this.showUserError(normalized, {
      showRetry: true,
      retryCallback: context.retryCallback,
      customMessage: this.getErrorMessage(this.errorCodes.NETWORK_OFFLINE)
    });
    
    return normalized;
  }

  // Obtener estadísticas de errores
  getErrorStats() {
    const now = Date.now();
    const lastHour = now - (60 * 60 * 1000);
    const lastDay = now - (24 * 60 * 60 * 1000);
    
    const lastHourErrors = this.errorLog.filter(e => 
      new Date(e.timestamp).getTime() > lastHour
    );
    
    const lastDayErrors = this.errorLog.filter(e => 
      new Date(e.timestamp).getTime() > lastDay
    );
    
    return {
      total: this.errorCounts.total,
      lastHour: lastHourErrors.length,
      lastDay: this.errorCounts.last24Hours,
      byCategory: { ...this.errorCounts.byCategory },
      byCode: { ...this.errorCounts.byCode },
      bySeverity: this.getErrorsBySeverity(),
      timestamp: new Date().toISOString()
    };
  }

  // Obtener distribución por severidad
  getErrorsBySeverity() {
    const severities = {};
    this.errorLog.forEach(error => {
      severities[error.severity] = (severities[error.severity] || 0) + 1;
    });
    return severities;
  }

  // Obtener errores recientes
  getRecentErrors(limit = 10) {
    return this.errorLog.slice(0, limit);
  }

  // Exportar errores para debugging
  exportErrors() {
    return {
      errors: this.errorLog,
      stats: this.getErrorStats(),
      systemInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screen: `${window.screen.width}x${window.screen.height}`,
        online: navigator.onLine,
        timestamp: new Date().toISOString()
      },
      appInfo: {
        version: CONFIG.VERSION,
        wallet: window.currentWallet?.publicKey?.toString() || 'disconnected',
        isAdmin: window.isAdmin || false
      }
    };
  }

  // Limpiar todos los errores
  clearAllErrors() {
    const count = this.errorLog.length;
    this.errorLog = [];
    this.errorCounts = {
      total: 0,
      byCategory: {},
      byCode: {},
      last24Hours: 0
    };
    
    // Limpiar localStorage
    try {
      localStorage.removeItem('veririfa_error_log_v2');
    } catch (error) {
      console.warn('Error limpiando log de errores:', error);
    }
    
    console.log(`🗑️ Todos los errores han sido limpiados (${count} errores eliminados)`);
    
    return count;
  }

  // Verificar si hay muchos errores recientes (posible problema)
  hasErrorSpike() {
    const lastHour = Date.now() - (60 * 60 * 1000);
    const recentErrors = this.errorLog.filter(e => 
      new Date(e.timestamp).getTime() > lastHour
    );
    
    // Más de 10 errores en la última hora es una alerta
    return recentErrors.length > 10;
  }
}

// Crear instancia global con configuración
const errorHandler = new ErrorHandler(CONFIG);

// Función helper para manejar errores comunes
function handleCommonError(error, context = {}) {
  console.error('❌ Error detectado:', error, context);
  
  // Si el error ya está normalizado, manejarlo directamente
  if (error.id && error.timestamp) {
    return errorHandler.handleGlobalError(error, context);
  }
  
  // Determinar tipo de error por mensaje
  const errorMessage = String(error?.message || error).toLowerCase();
  
  // Errores de wallet
  if (errorMessage.includes('user rejected') || errorMessage.includes('wallet not connected')) {
    return errorHandler.handleWalletError(error, context);
  }
  
  // Errores de saldo
  if (errorMessage.includes('insufficient') || errorMessage.includes('not enough')) {
    const normalized = errorHandler.normalizeError(error, context);
    normalized.code = errorHandler.errorCodes.INSUFFICIENT_BALANCE;
    errorHandler.logError(normalized);
    
    errorHandler.showUserError(normalized, {
      customMessage: errorHandler.getErrorMessage(errorHandler.errorCodes.INSUFFICIENT_BALANCE)
    });
    
    return normalized;
  }
  
  // Errores de tiempo de espera
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return errorHandler.handleTransactionError(error, {
      ...context,
      retryCallback: context.retryCallback
    });
  }
  
  // Errores de red
  if (!navigator.onLine || errorMessage.includes('network') || errorMessage.includes('offline')) {
    return errorHandler.handleNetworkError(error, context);
  }
  
  // Error genérico
  return errorHandler.handleGlobalError(error, context);
}

// Decorador para envolver funciones con manejo de errores
function withErrorHandling(fn, options = {}) {
  return async function(...args) {
    try {
      const startTime = Date.now();
      const result = await fn.apply(this, args);
      const duration = Date.now() - startTime;
      
      // Log de operaciones exitosas largas
      if (duration > 5000 && CONFIG.FEATURES.DEBUG_MODE) {
        console.warn(`⚠️ Función ${fn.name} tardó ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      return handleCommonError(error, {
        ...options,
        functionName: fn.name,
        args: args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg).slice(0, 200) : String(arg)
        )
      });
    }
  };
}

// Añadir estilos CSS para animaciones
function addErrorStyles() {
  if (document.getElementById('error-handler-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'error-handler-styles';
  style.textContent = `
    @keyframes slideInError {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOutError {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    
    .error-notification {
      animation: slideInError 0.3s ease;
    }
    
    .error-notification.slide-out {
      animation: slideOutError 0.3s ease;
    }
  `;
  
  document.head.appendChild(style);
}

// Inicializar cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
  addErrorStyles();
  
  // Integrar con funciones existentes
  if (typeof window.showUserAlert === 'function') {
    const originalShowUserAlert = window.showUserAlert;
    window.showUserAlert = function(message, type, duration) {
      if (type === 'error') {
        errorHandler.showUserError({
          id: errorHandler.generateErrorId(),
          message: message,
          code: 'USER_ALERT',
          severity: 'MEDIUM'
        }, {
          customMessage: message,
          duration: duration || 5000
        });
      } else {
        originalShowUserAlert.call(this, message, type, duration);
      }
    };
  }
});

// Exportar para uso global
window.errorHandler = errorHandler;
window.handleCommonError = handleCommonError;
window.withErrorHandling = withErrorHandling;

console.log('🛡️ Sistema de manejo de errores cargado y listo');
