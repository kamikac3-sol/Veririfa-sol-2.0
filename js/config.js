// CONFIGURACIÓN CENTRALIZADA - VeriRifa-Sol v2.0
// Archivo: js/config.js

const CONFIG = {
  // Información de versión
  VERSION: '2.0.1',
  BUILD: '2024.01.15',
  RELEASE: 'Fase 1 - Seguridad Mejorada',
  
  // Blockchain - Solana Testnet
  NETWORK: 'testnet',
  CLUSTER_URL: 'https://api.testnet.solana.com',
  COMMITMENT: 'confirmed',
  
  // Wallet verificada del administrador
  ADMIN_WALLET: '3Yekte2UrR2rKFBfm3q6D2DyinZKN58svqJvQF87RX3o',
  
  // Firebase - Proyecto veririfa-sol-2
  FIREBASE: {
    apiKey: "AIzaSyAXdc3j3btUiwItrFJZGvWrHJqhEae0_wU",
    authDomain: "veririfa-sol-2.firebaseapp.com",
    projectId: "veririfa-sol-2",
    storageBucket: "veririfa-sol-2.firebasestorage.app",
    messagingSenderId: "504444330864",
    appId: "1:504444330864:web:abb0847510c5215295a5b5",
    measurementId: "G-62F9LZN3DC"
  },
  
  // Configuración de seguridad
  SECURITY: {
    // Lista de wallets administrador permitidas
    ADMIN_WALLETS: [
      '3Yekte2UrR2rKFBfm3q6D2DyinZKN58svqJvQF87RX3o'
    ],
    
    // Límites de compra
    MAX_NUMBERS_PER_PURCHASE: 20,
    MIN_TICKET_PRICE: 0.01, // Mínimo 0.01 SOL
    MAX_TICKET_PRICE: 10,   // Máximo 10 SOL
    
    // Rate limiting (prevención de abusos)
    RATE_LIMITS: {
      purchases: { max: 10, windowMs: 60000 },     // 10 compras por minuto
      claims: { max: 3, windowMs: 3600000 },       // 3 reclamaciones por hora
      raffleCreation: { max: 5, windowMs: 3600000 } // 5 sorteos por hora
    },
    
    // Reglas de validación
    VALIDATION: {
      minRaffleNameLength: 5,
      maxRaffleNameLength: 100,
      minNumbersPerRaffle: 10,
      maxNumbersPerRaffle: 1000,
      maxRafflesPerAdmin: 50
    }
  },
  
  // Configuración de caché
  CACHE: {
    VERSION: '2.0',
    TTL: { // Time To Live en milisegundos
      RAFFLES: 5 * 60 * 1000,      // 5 minutos
      WINNERS: 10 * 60 * 1000,     // 10 minutos
      USER_DATA: 30 * 60 * 1000,   // 30 minutos
      TRANSACTIONS: 2 * 60 * 1000, // 2 minutos
      DEFAULT: 60 * 1000           // 1 minuto
    },
    QUOTAS: {
      MAX_CACHE_SIZE: 10 * 1024 * 1024, // 10MB máximo
      MAX_ITEMS: 1000,                  // Máximo 1000 items
      MAX_ITEM_SIZE: 1024 * 1024        // 1MB por item máximo
    }
  },
  
  // Configuración de UI/UX
  UI: {
    ALERT_DURATION: 5000,               // 5 segundos
    MODAL_ANIMATION_DURATION: 300,      // 0.3 segundos
    AUTO_REFRESH_INTERVAL: 30000,       // 30 segundos
    LOADING_TIMEOUT: 10000,             // 10 segundos timeout
    CONFIRMATION_DELAY: 2000            // 2 segundos para confirmaciones
  },
  
  // Flags de funcionalidades
  FEATURES: {
    REALTIME_SYNC: true,       // Sincronización en tiempo real
    CACHE_ENABLED: true,       // Sistema de caché activado
    ERROR_REPORTING: true,     // Reporte de errores
    SECURITY_CHECKS: true,     // Verificaciones de seguridad
    MAINTENANCE_MODE: false,   // Modo mantenimiento
    DEBUG_MODE: false          // Modo depuración
  },
  
  // URLs externas
  URLS: {
    FAUCET: 'https://faucet.solana.com/',
    EXPLORER: 'https://explorer.solana.com/',
    SOLANA_DOCS: 'https://docs.solana.com/',
    PHANTOM: 'https://phantom.app/',
    SOLFLARE: 'https://solflare.com/'
  },
  
  // Configuración de monitoreo
  MONITORING: {
    ENABLED: false, // Cambiar a true en producción
    ENDPOINT: 'https://monitoring.veririfa.com/api/errors',
    SAMPLE_RATE: 0.1 // 10% de los errores
  },
  
  // Constantes de la aplicación
  CONSTANTS: {
    LAMPORTS_PER_SOL: 1000000000,
    NUMBERS_PER_PAGE: 100,
    MAX_SELECTED_NUMBERS: 50,
    MIN_CONFIRMATIONS: 1
  }
};

// Función para validar la configuración
function validateConfig() {
  const errors = [];
  const warnings = [];
  
  // Validaciones críticas
  if (!CONFIG.ADMIN_WALLET) {
    errors.push('ADMIN_WALLET no configurada');
  }
  
  if (!CONFIG.FIREBASE.apiKey) {
    errors.push('Firebase API Key no configurada');
  }
  
  if (CONFIG.SECURITY.MAX_TICKET_PRICE <= CONFIG.SECURITY.MIN_TICKET_PRICE) {
    errors.push('MAX_TICKET_PRICE debe ser mayor que MIN_TICKET_PRICE');
  }
  
  // Validaciones de seguridad
  if (CONFIG.SECURITY.MAX_NUMBERS_PER_PURCHASE > 50) {
    warnings.push('MAX_NUMBERS_PER_PURCHASE es muy alto (recomendado: ≤ 20)');
  }
  
  // Validaciones de UI
  if (CONFIG.UI.LOADING_TIMEOUT < 5000) {
    warnings.push('LOADING_TIMEOUT muy bajo (recomendado: ≥ 10000ms)');
  }
  
  // Verificar modo mantenimiento
  if (CONFIG.FEATURES.MAINTENANCE_MODE) {
    warnings.push('⚠️ Modo mantenimiento activado - Algunas funciones estarán deshabilitadas');
  }
  
  // Verificar modo debug
  if (CONFIG.FEATURES.DEBUG_MODE) {
    console.warn('🔧 Modo debug activado - Información detallada en consola');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    timestamp: new Date().toISOString()
  };
}

// Función para obtener configuración según entorno
function getEnvironmentConfig() {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return {
      ...CONFIG,
      FEATURES: {
        ...CONFIG.FEATURES,
        DEBUG_MODE: true,
        MAINTENANCE_MODE: false
      }
    };
  }
  
  // Configuración para producción
  return {
    ...CONFIG,
    FEATURES: {
      ...CONFIG.FEATURES,
      DEBUG_MODE: false,
      ERROR_REPORTING: true
    },
    MONITORING: {
      ...CONFIG.MONITORING,
      ENABLED: true
    }
  };
}

// Función helper para acceder a configuraciones específicas
function getConfig(path, defaultValue = null) {
  const keys = path.split('.');
  let value = CONFIG;
  
  for (const key of keys) {
    if (value[key] === undefined) {
      return defaultValue;
    }
    value = value[key];
  }
  
  return value;
}

// Inicializar configuración validada
const AppConfig = getEnvironmentConfig();
const configValidation = validateConfig();

if (configValidation.isValid) {
  if (configValidation.warnings.length > 0) {
    console.warn('Advertencias de configuración:', configValidation.warnings);
  }
  console.log(`✅ Configuración validada - VeriRifa-Sol v${AppConfig.VERSION}`);
} else {
  console.error('❌ Errores de configuración:', configValidation.errors);
  throw new Error(`Configuración inválida: ${configValidation.errors.join(', ')}`);
}

// Exportar para uso global
window.CONFIG = AppConfig;
window.validateConfig = validateConfig;
window.getConfig = getConfig;

console.log('🎯 Configuración cargada correctamente');
