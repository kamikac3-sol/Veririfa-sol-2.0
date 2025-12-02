// CONFIGURACIÓN MEJORADA DE FIREBASE - VeriRifa-Sol v2.0
// Archivo: js/firebase.js

// Configuración de seguridad
const SECURITY_CONFIG = {
  adminWallets: CONFIG.SECURITY.ADMIN_WALLETS,
  maxNumbersPerPurchase: CONFIG.SECURITY.MAX_NUMBERS_PER_PURCHASE,
  minTicketPrice: CONFIG.SECURITY.MIN_TICKET_PRICE,
  maxTicketPrice: CONFIG.SECURITY.MAX_TICKET_PRICE,
  rateLimits: CONFIG.SECURITY.RATE_LIMITS,
  validation: CONFIG.SECURITY.VALIDATION
};

// Sistema de rate limiting mejorado
class RateLimiter {
  constructor() {
    this.store = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000); // Cada 5 minutos
  }

  checkLimit(key, maxAttempts, windowMs) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!this.store.has(key)) {
      this.store.set(key, []);
    }
    
    const attempts = this.store.get(key);
    const recentAttempts = attempts.filter(time => time > windowStart);
    
    if (recentAttempts.length >= maxAttempts) {
      return false; // Límite excedido
    }
    
    recentAttempts.push(now);
    this.store.set(key, recentAttempts);
    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, attempts] of this.store.entries()) {
      const activeAttempts = attempts.filter(time => now - time < 3600000); // Mantener 1 hora
      if (activeAttempts.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, activeAttempts);
      }
    }
  }

  getRemainingTime(key, maxAttempts, windowMs) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!this.store.has(key)) {
      return 0;
    }
    
    const attempts = this.store.get(key);
    const recentAttempts = attempts.filter(time => time > windowStart);
    const oldestAttempt = Math.min(...recentAttempts);
    
    return Math.max(0, windowMs - (now - oldestAttempt));
  }
}

const rateLimiter = new RateLimiter();

// Variables globales de Firebase
let firebaseApp;
let db;
let analytics;
let realtimeListeners = {
  raffles: null,
  winners: null,
  claims: null,
  auditLogs: null
};

// Inicialización mejorada de Firebase
async function initializeFirebase() {
  try {
    console.log('🔥 Inicializando Firebase...');
    
    // Verificar si Firebase ya está inicializado
    if (firebase.apps.length > 0) {
      firebaseApp = firebase.apps[0];
    } else {
      firebaseApp = firebase.initializeApp(CONFIG.FIREBASE);
    }
    
    // Inicializar servicios
    db = firebase.firestore();
    analytics = firebase.analytics();
    
    // Configuración específica para desarrollo
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      db.settings({
        experimentalForceLongPolling: true,
        ignoreUndefinedProperties: true
      });
      console.log("🔧 Modo desarrollo activado para Firebase");
    }
    
    // Configurar persistencia de caché offline
    await db.enablePersistence()
      .then(() => console.log("✅ Persistencia offline activada"))
      .catch(err => {
        if (err.code === 'failed-precondition') {
          console.warn("⚠️ Persistencia offline no disponible: Múltiples pestañas abiertas");
        } else if (err.code === 'unimplemented') {
          console.warn("⚠️ Persistencia offline no soportada por el navegador");
        }
      });
    
    // Verificar conexión
    await verifyFirebaseConnection();
    
    console.log('✅ Firebase inicializado correctamente');
    
    // Registrar evento de analytics
    logAnalyticsEvent('app_init', { 
      version: CONFIG.VERSION,
      network: CONFIG.NETWORK 
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Error crítico inicializando Firebase:', error);
    
    // Mostrar error amigable al usuario
    errorHandler.handleGlobalError(error, { 
      source: 'firebase_init',
      critical: true 
    });
    
    showUserAlert(
      '⚠️ No se puede conectar con el servidor. ' +
      'Algunas funciones pueden no estar disponibles. ' +
      'Por favor, verifica tu conexión a internet.',
      'warning',
      10000
    );
    
    return false;
  }
}

// Verificar conexión a Firebase
async function verifyFirebaseConnection() {
  try {
    const startTime = Date.now();
    await db.collection("raffles").limit(1).get();
    const duration = Date.now() - startTime;
    
    console.log(`📡 Conexión a Firestore verificada: ${duration}ms`);
    
    // Log de conexión lenta
    if (duration > 2000) {
      console.warn(`⚠️ Conexión lenta a Firebase: ${duration}ms`);
      logAuditEvent('slow_connection', { duration });
    }
    
    return { success: true, latency: duration };
    
  } catch (error) {
    console.error('❌ Error verificando conexión a Firestore:', error);
    logAuditEvent('connection_failed', { error: error.message });
    
    throw error;
  }
}

// Sistema de validación mejorado
function validateRaffleData(raffleData, isAdmin) {
  const errors = [];
  const warnings = [];
  
  // Validar nombre
  if (!raffleData.name || typeof raffleData.name !== 'string') {
    errors.push('El nombre del sorteo es requerido');
  } else if (raffleData.name.length < SECURITY_CONFIG.validation.minRaffleNameLength) {
    errors.push(`El nombre debe tener al menos ${SECURITY_CONFIG.validation.minRaffleNameLength} caracteres`);
  } else if (raffleData.name.length > SECURITY_CONFIG.validation.maxRaffleNameLength) {
    errors.push(`El nombre no puede exceder ${SECURITY_CONFIG.validation.maxRaffleNameLength} caracteres`);
  }
  
  // Validar precio
  if (!raffleData.price || typeof raffleData.price !== 'number') {
    errors.push('El precio es requerido');
  } else if (raffleData.price < SECURITY_CONFIG.minTicketPrice) {
    errors.push(`El precio mínimo es ${SECURITY_CONFIG.minTicketPrice} SOL`);
  } else if (raffleData.price > SECURITY_CONFIG.maxTicketPrice) {
    errors.push(`El precio máximo es ${SECURITY_CONFIG.maxTicketPrice} SOL`);
  } else if (raffleData.price.toString().split('.')[1]?.length > 9) {
    errors.push('El precio no puede tener más de 9 decimales');
  }
  
  // Validar cantidad de números
  if (!raffleData.totalNumbers || typeof raffleData.totalNumbers !== 'number') {
    errors.push('La cantidad de números es requerida');
  } else if (raffleData.totalNumbers < SECURITY_CONFIG.validation.minNumbersPerRaffle) {
    errors.push(`Debe haber al menos ${SECURITY_CONFIG.validation.minNumbersPerRaffle} números`);
  } else if (raffleData.totalNumbers > SECURITY_CONFIG.validation.maxNumbersPerRaffle) {
    errors.push(`No puede haber más de ${SECURITY_CONFIG.validation.maxNumbersPerRaffle} números`);
  } else if (!isAdmin && raffleData.totalNumbers > 100) {
    errors.push('Solo administradores pueden crear sorteos con más de 100 números');
  }
  
  // Validar imagen/emoji
  if (!raffleData.image || typeof raffleData.image !== 'string') {
    errors.push('La imagen o emoji es requerido');
  } else if (raffleData.image.startsWith('http')) {
    // Validar URL
    try {
      new URL(raffleData.image);
    } catch (e) {
      errors.push('La URL de la imagen no es válida');
    }
  } else if (raffleData.image.length > 10) {
    warnings.push('El emoji parece muy largo. ¿Es correcto?');
  }
  
  // Validar descripción
  if (raffleData.description && raffleData.description.length > 1000) {
    warnings.push('La descripción es muy larga (máximo 1000 caracteres)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    timestamp: new Date().toISOString()
  };
}

// Validar compra de números
function validatePurchase(raffle, numbers, userWallet, userBalance) {
  const errors = [];
  const validation = {
    passed: true,
    totalCost: 0,
    availableNumbers: []
  };
  
  // Verificar que la wallet esté conectada
  if (!userWallet) {
    errors.push('Wallet no conectada');
    validation.passed = false;
  }
  
  // Verificar que el sorteo exista y esté activo
  if (!raffle || raffle.completed) {
    errors.push('El sorteo no está disponible o ya ha finalizado');
    validation.passed = false;
  }
  
  // Verificar límite de números por compra
  if (numbers.length > SECURITY_CONFIG.maxNumbersPerPurchase) {
    errors.push(`No puedes comprar más de ${SECURITY_CONFIG.maxNumbersPerPurchase} números a la vez`);
    validation.passed = false;
  }
  
  // Verificar rate limiting
  const rateLimitKey = `purchase_${userWallet}`;
  if (!rateLimiter.checkLimit(rateLimitKey, 
      SECURITY_CONFIG.rateLimits.purchases.max, 
      SECURITY_CONFIG.rateLimits.purchases.windowMs)) {
    
    const remainingTime = rateLimiter.getRemainingTime(rateLimitKey, 
      SECURITY_CONFIG.rateLimits.purchases.max, 
      SECURITY_CONFIG.rateLimits.purchases.windowMs);
    
    errors.push(`Demasiadas compras recientemente. Espera ${Math.ceil(remainingTime / 1000)} segundos.`);
    validation.passed = false;
  }
  
  // Verificar números individualmente
  numbers.forEach(number => {
    // Verificar rango
    if (number < 1 || number > raffle.totalNumbers) {
      errors.push(`El número ${number} está fuera del rango válido (1-${raffle.totalNumbers})`);
      validation.passed = false;
      return;
    }
    
    // Verificar disponibilidad
    if (raffle.soldNumbers.includes(number) || raffle.numberOwners[number]) {
      errors.push(`El número ${number} ya no está disponible`);
      validation.passed = false;
    } else {
      validation.availableNumbers.push(number);
    }
  });
  
  // Calcular costo total
  validation.totalCost = validation.availableNumbers.length * raffle.price;
  
  // Verificar saldo suficiente
  if (userBalance < validation.totalCost) {
    errors.push(`Saldo insuficiente. Necesitas ${validation.totalCost.toFixed(4)} SOL`);
    validation.passed = false;
  }
  
  // Verificar que haya al menos un número disponible
  if (validation.availableNumbers.length === 0 && validation.passed) {
    errors.push('No hay números disponibles para comprar');
    validation.passed = false;
  }
  
  return {
    ...validation,
    errors: errors.length > 0 ? errors : null,
    warnings: validation.availableNumbers.length < numbers.length ? 
      [`${numbers.length - validation.availableNumbers.length} números no estaban disponibles`] : []
  };
}

// Función principal para guardar sorteos
async function saveRafflesToFirebase() {
  if (!db) {
    errorHandler.handleGlobalError(new Error('Firebase no disponible'), { 
      source: 'save_raffles',
      critical: true 
    });
    return false;
  }

  const batch = db.batch();
  const updates = [];
  
  try {
    // Validar cada sorteo antes de guardar
    for (const raffle of raffles) {
      const validation = validateRaffleData(raffle, isAdmin);
      
      if (!validation.isValid) {
        throw new Error(`Sorteo inválido "${raffle.name}": ${validation.errors.join(', ')}`);
      }
      
      if (validation.warnings.length > 0 && CONFIG.FEATURES.DEBUG_MODE) {
        console.warn(`Advertencias para sorteo "${raffle.name}":`, validation.warnings);
      }
      
      const raffleRef = db.collection('raffles').doc(raffle.id);
      const raffleData = {
        ...raffle,
        validated: true,
        validationTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentWallet?.publicKey?.toString() || 'system'
      };
      
      batch.set(raffleRef, raffleData, { merge: true });
      updates.push({ id: raffle.id, action: 'updated' });
    }
    
    // Ejecutar batch
    await batch.commit();
    
    // Registrar en logs de auditoría
    await logAuditEvent('raffles_batch_update', {
      count: updates.length,
      raffleIds: updates.map(u => u.id),
      adminWallet: currentWallet?.publicKey?.toString()
    });
    
    // Log de analytics
    logAnalyticsEvent('raffles_saved', { count: updates.length });
    
    console.log(`✅ ${updates.length} sorteos guardados en Firebase`);
    
    if (CONFIG.FEATURES.DEBUG_MODE) {
      console.log('📝 Updates:', updates);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error guardando sorteos en Firebase:', error);
    
    await logAuditEvent('save_raffles_failed', {
      error: error.message,
      count: raffles.length,
      adminWallet: currentWallet?.publicKey?.toString()
    });
    
    errorHandler.handleGlobalError(error, {
      source: 'save_raffles',
      data: { count: raffles.length }
    });
    
    return false;
  }
}

// Función para cargar sorteos con caché
async function loadRafflesFromFirebase() {
  if (!db) {
    console.error('❌ Firebase no disponible');
    raffles = [];
    errorHandler.handleGlobalError(new Error('Firebase no disponible'), { 
      source: 'load_raffles',
      critical: false 
    });
    return;
  }

  try {
    const startTime = Date.now();
    const snapshot = await db.collection('raffles').get();
    const duration = Date.now() - startTime;
    
    if (!snapshot.empty) {
      raffles = [];
      snapshot.forEach(doc => {
        const raffleData = doc.data();
        
        // Asegurar que los campos necesarios existan
        const defaultRaffle = {
          soldNumbers: [],
          numberOwners: {},
          winner: null,
          prizeClaimed: false,
          isSelectingWinner: false,
          completed: false,
          shippingStatus: 'pending',
          createdAt: new Date().toISOString(),
          validated: false,
          lastUpdated: new Date().toISOString()
        };
        
        // Combinar con valores por defecto
        const processedRaffle = {
          ...defaultRaffle,
          ...raffleData,
          id: doc.id // Mantener el ID del documento
        };
        
        // Convertir Timestamp a string si es necesario
        if (processedRaffle.createdAt?.toDate) {
          processedRaffle.createdAt = processedRaffle.createdAt.toDate().toISOString();
        }
        
        if (processedRaffle.lastUpdated?.toDate) {
          processedRaffle.lastUpdated = processedRaffle.lastUpdated.toDate().toISOString();
        }
        
        raffles.push(processedRaffle);
      });
      
      console.log(`✅ ${raffles.length} sorteos cargados desde Firebase (${duration}ms)`);
      
      // Log de analytics
      logAnalyticsEvent('raffles_loaded', { 
        count: raffles.length, 
        duration 
      });
      
      // Actualizar caché
      if (cacheManager && cacheManager.enabled) {
        cacheManager.cacheRaffles(raffles);
      }
      
    } else {
      console.log('📝 No hay sorteos en Firebase');
      raffles = [];
    }
    
  } catch (error) {
    console.error('❌ Error cargando sorteos desde Firebase:', error);
    
    errorHandler.handleGlobalError(error, {
      source: 'load_raffles',
      critical: false
    });
    
    raffles = [];
    
    // Intentar cargar desde caché si hay error
    if (cacheManager && cacheManager.enabled) {
      const cachedRaffles = cacheManager.getCachedRaffles();
      if (cachedRaffles && cachedRaffles.length > 0) {
        console.log('🔄 Usando datos de caché debido a error de Firebase');
        raffles = cachedRaffles;
      }
    }
  }
}

// Transacción atómica para reservar números
async function reserveNumbersWithTransaction(raffleId, numbers, userWallet) {
  if (!db) {
    throw new Error('Firebase no disponible');
  }

  try {
    const raffleRef = db.collection('raffles').doc(raffleId);
    
    return await db.runTransaction(async (transaction) => {
      const raffleDoc = await transaction.get(raffleRef);
      
      if (!raffleDoc.exists) {
        throw new Error('Sorteo no encontrado');
      }
      
      const raffleData = raffleDoc.data();
      const soldNumbers = raffleData.soldNumbers || [];
      const numberOwners = raffleData.numberOwners || {};
      
      // Verificar disponibilidad de TODOS los números
      const unavailableNumbers = numbers.filter(num => 
        soldNumbers.includes(num) || numberOwners[num]
      );
      
      if (unavailableNumbers.length > 0) {
        throw new Error(`Números ${unavailableNumbers.join(', ')} ya no disponibles`);
      }
      
      // Reservar números atómicamente
      numbers.forEach(num => {
        soldNumbers.push(num);
        numberOwners[num] = userWallet;
      });
      
      // Actualizar en transacción
      transaction.update(raffleRef, {
        soldNumbers: soldNumbers,
        numberOwners: numberOwners,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Registrar auditoría
      logAuditEvent('numbers_reserved', {
        raffleId,
        numbers,
        userWallet,
        transaction: 'atomic'
      }, userWallet);
      
      return { success: true, reservedNumbers: numbers };
    });
    
  } catch (error) {
    console.error('❌ Error en transacción de reserva:', error);
    
    logAuditEvent('reservation_failed', {
      raffleId,
      numbers,
      userWallet,
      error: error.message
    }, userWallet);
    
    throw error;
  }
}

// Sistema de logs de auditoría mejorado
async function logAuditEvent(eventType, data, userWallet = null) {
  if (!db) {
    console.warn('Firebase no disponible para logging');
    return false;
  }

  try {
    const auditData = {
      eventType,
      data,
      userWallet: userWallet || currentWallet?.publicKey?.toString() || 'system',
      userAgent: navigator.userAgent,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      metadata: {
        version: CONFIG.VERSION,
        url: window.location.href,
        online: navigator.onLine
      }
    };
    
    await db.collection('audit_logs').add(auditData);
    
    if (CONFIG.FEATURES.DEBUG_MODE) {
      console.log('📝 Evento de auditoría:', eventType, data);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error guardando log de auditoría:', error);
    return false;
  }
}

// Analytics mejorado
function logAnalyticsEvent(eventName, eventParams = {}) {
  if (!analytics) return;
  
  try {
    const params = {
      ...eventParams,
      app_version: CONFIG.VERSION,
      environment: CONFIG.FEATURES.DEBUG_MODE ? 'development' : 'production',
      timestamp: new Date().toISOString()
    };
    
    analytics.logEvent(eventName, params);
    
    if (CONFIG.FEATURES.DEBUG_MODE) {
      console.log('📊 Analytics:', eventName, params);
    }
  } catch (error) {
    console.warn('Error en analytics:', error);
  }
}

// Sistema de listeners en tiempo real mejorado
function setupRafflesRealTimeListener() {
  if (!db || realtimeListeners.raffles) return;
  
  try {
    realtimeListeners.raffles = db.collection('raffles')
      .onSnapshot((snapshot) => {
        console.log('🔄 Actualización en tiempo real de sorteos recibida');
        
        const updatedRaffles = [];
        const changes = {
          added: 0,
          modified: 0,
          removed: 0
        };
        
        snapshot.docChanges().forEach(change => {
          changes[change.type]++;
          
          const raffleData = change.doc.data();
          raffleData.id = change.doc.id;
          
          // Procesar datos
          const processedRaffle = processRaffleData(raffleData);
          
          if (change.type === 'added' || change.type === 'modified') {
            updatedRaffles.push(processedRaffle);
          }
        });
        
        // Actualizar array global
        raffles = updatedRaffles;
        
        // Actualizar caché
        if (cacheManager && cacheManager.enabled) {
          cacheManager.cacheRaffles(raffles);
        }
        
        // Re-renderizar UI
        renderRaffles();
        updateClaimButtons();
        
        // Actualizar modal de selección si está abierto
        if (currentRaffle && document.getElementById('number-selection-modal').classList.contains('active')) {
          const updatedCurrentRaffle = raffles.find(r => r.id === currentRaffle.id);
          if (updatedCurrentRaffle) {
            currentRaffle = updatedCurrentRaffle;
            renderNumbersGrid();
            updateSelectionUI();
          }
        }
        
        // Log de cambios
        if (CONFIG.FEATURES.DEBUG_MODE && (changes.added > 0 || changes.modified > 0)) {
          console.log(`📊 Cambios en tiempo real: +${changes.added} ~${changes.modified} -${changes.removed}`);
        }
        
      }, (error) => {
        console.error('❌ Error en listener de sorteos:', error);
        
        errorHandler.handleGlobalError(error, {
          source: 'realtime_listener',
          type: 'raffles'
        });
        
        // Intentar reconectar después de 5 segundos
        setTimeout(() => {
          if (db) {
            setupRafflesRealTimeListener();
          }
        }, 5000);
      });
    
    console.log('✅ Listener de sorteos en tiempo real activado');
    
  } catch (error) {
    console.error('❌ Error activando listener de sorteos:', error);
  }
}

// Procesar datos del sorteo
function processRaffleData(raffleData) {
  const defaults = {
    soldNumbers: [],
    numberOwners: {},
    winner: null,
    prizeClaimed: false,
    isSelectingWinner: false,
    completed: false,
    shippingStatus: 'pending',
    validated: false
  };
  
  // Combinar con valores por defecto
  const processed = { ...defaults, ...raffleData };
  
  // Convertir Timestamps
  if (processed.createdAt?.toDate) {
    processed.createdAt = processed.createdAt.toDate().toISOString();
  }
  
  if (processed.lastUpdated?.toDate) {
    processed.lastUpdated = processed.lastUpdated.toDate().toISOString();
  }
  
  if (processed.winner?.date?.toDate) {
    processed.winner.date = processed.winner.date.toDate().toISOString();
  }
  
  return processed;
}

// Inicializar todos los listeners en tiempo real
async function initRealtimeSync() {
  if (!db) {
    console.error('❌ Firebase no disponible para sincronización');
    return false;
  }
  
  try {
    console.log('🔄 Iniciando sincronización en tiempo real...');
    
    // Activar listeners
    setupRafflesRealTimeListener();
    setupWinnersRealTimeListener();
    setupClaimsRealTimeListener();
    
    // Verificar estado de conexión
    const connection = await verifyFirebaseConnection();
    
    console.log('✅ Sincronización en tiempo real activada');
    
    // Registrar evento
    logAnalyticsEvent('realtime_sync_started', {
      latency: connection.latency,
      success: connection.success
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Error iniciando sincronización en tiempo real:', error);
    
    errorHandler.handleGlobalError(error, {
      source: 'init_realtime_sync',
      critical: false
    });
    
    return false;
  }
}

// Función para forzar resincronización
async function forceResync() {
  console.log('🔄 Forzando resincronización completa...');
  
  try {
    // Mostrar indicador de carga
    showLoadingOverlay('Resincronizando datos...');
    
    // 1. Recargar datos desde Firebase
    await loadRafflesFromFirebase();
    await loadWinnersFromFirebase();
    
    // 2. Actualizar caché
    if (cacheManager && cacheManager.enabled) {
      cacheManager.cacheRaffles(raffles);
      cacheManager.cacheWinners(winners);
    }
    
    // 3. Re-renderizar todo
    renderRaffles();
    renderWinnersArchive();
    updateClaimButtons();
    
    // 4. Actualizar sorteo actual si está en modal
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
    
    // 5. Ocultar indicador
    hideLoadingOverlay();
    
    console.log('✅ Resincronización completada');
    
    showUserAlert('✅ Datos resincronizados correctamente', 'success');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error en resincronización:', error);
    hideLoadingOverlay();
    
    errorHandler.handleGlobalError(error, {
      source: 'force_resync',
      critical: false
    });
    
    showUserAlert('❌ Error al resincronizar datos', 'error');
    
    return false;
  }
}

// Verificar estado de sincronización
function checkRealtimeStatus() {
  return {
    raffles: !!realtimeListeners.raffles,
    winners: !!realtimeListeners.winners,
    claims: !!realtimeListeners.claims,
    connected: !!db,
    lastSync: new Date().toISOString()
  };
}

// Configurar manejo de conexión/desconexión
function setupRealtimeConnectionHandlers() {
  // Detectar cambios en conexión a internet
  window.addEventListener('online', () => {
    console.log('🌐 Conexión a internet restablecida');
    
    showUserAlert('✅ Conexión a internet restablecida', 'success', 3000);
    
    // Intentar reconectar Firebase
    if (!db) {
      initializeFirebase();
    }
    
    // Forzar resincronización
    setTimeout(() => {
      forceResync();
    }, 2000);
  });
  
  window.addEventListener('offline', () => {
    console.log('🌐 Sin conexión a internet');
    
    showUserAlert('⚠️ Sin conexión a internet. Los datos pueden no estar actualizados.', 'warning', 0);
    
    // Registrar evento
    logAuditEvent('network_offline', { timestamp: new Date().toISOString() });
  });
}

// Inicializar cuando se carga el DOM
document.addEventListener('DOMContentLoaded', async () => {
  // Inicializar Firebase
  const firebaseInitialized = await initializeFirebase();
  
  if (firebaseInitialized) {
    // Precargar datos críticos
    await preloadCriticalData();
    
    // Inicializar sincronización en tiempo real
    if (CONFIG.FEATURES.REALTIME_SYNC) {
      await initRealtimeSync();
    }
    
    // Configurar manejadores de conexión
    setupRealtimeConnectionHandlers();
  }
});

// Exportar funciones para uso global
window.db = db;
window.firebaseApp = firebaseApp;
window.initializeFirebase = initializeFirebase;
window.saveRafflesToFirebase = withErrorHandling(saveRafflesToFirebase);
window.loadRafflesFromFirebase = withErrorHandling(loadRafflesFromFirebase);
window.reserveNumbersWithTransaction = withErrorHandling(reserveNumbersWithTransaction);
window.validatePurchase = validatePurchase;
window.logAuditEvent = logAuditEvent;
window.initRealtimeSync = initRealtimeSync;
window.checkRealtimeStatus = checkRealtimeStatus;
window.forceResync = withErrorHandling(forceResync);
window.setupRealtimeConnectionHandlers = setupRealtimeConnectionHandlers;

console.log('🔥 Firebase.js mejorado cargado completamente');
