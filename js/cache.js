// SISTEMA DE CACHÉ AVANZADO - VeriRifa-Sol v2.0
// Archivo: js/cache.js

class CacheManager {
  constructor(config = {}) {
    // Configuración
    this.config = {
      VERSION: config.VERSION || '2.0',
      TTL: config.TTL || {
        RAFFLES: 5 * 60 * 1000,
        WINNERS: 10 * 60 * 1000,
        USER_DATA: 30 * 60 * 1000,
        TRANSACTIONS: 2 * 60 * 1000,
        DEFAULT: 60 * 1000
      },
      QUOTAS: config.QUOTAS || {
        MAX_CACHE_SIZE: 10 * 1024 * 1024,
        MAX_ITEMS: 1000,
        MAX_ITEM_SIZE: 1024 * 1024
      }
    };
    
    // Estadísticas
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      items: 0,
      lastCleanup: Date.now(),
      errors: 0
    };
    
    // Índice de caché
    this.index = new Map();
    
    // Inicializar
    this.init();
  }

  // Inicializar el sistema de caché
  init() {
    if (!this.isSupported()) {
      console.warn('⚠️ localStorage no soportado, desactivando caché');
      this.enabled = false;
      return;
    }
    
    this.enabled = true;
    
    // Cargar índice existente
    this.loadIndex();
    
    // Limpieza inicial
    this.cleanup();
    
    // Configurar limpieza periódica (cada hora)
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
    
    // Configurar monitoreo de memoria (cada 5 minutos)
    setInterval(() => this.monitorMemory(), 5 * 60 * 1000);
    
    console.log('✅ CacheManager inicializado');
    
    if (CONFIG.FEATURES.DEBUG_MODE) {
      console.log('📊 Estadísticas iniciales:', this.getStats());
    }
  }

  // Verificar compatibilidad con localStorage
  isSupported() {
    try {
      const testKey = '__cache_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.error('localStorage no disponible:', e.message);
      return false;
    }
  }

  // Generar clave de caché consistente
  generateKey(prefix, params = {}) {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    
    const hash = this.hashString(`${prefix}:${paramString}`);
    return `${this.config.VERSION}:${prefix}:${hash}`;
  }

  // Hash simple para strings
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // Obtener datos de caché
  get(key, options = {}) {
    if (!this.enabled) {
      this.stats.misses++;
      return null;
    }

    try {
      const itemStr = localStorage.getItem(key);
      
      if (!itemStr) {
        this.stats.misses++;
        return null;
      }

      const item = JSON.parse(itemStr);
      const now = Date.now();
      
      // Verificar expiración
      const ttl = options.ttl || this.config.TTL[item.metadata?.type] || this.config.TTL.DEFAULT;
      if (now - item.timestamp > ttl) {
        localStorage.removeItem(key);
        this.index.delete(key);
        this.stats.misses++;
        this.stats.size -= item.metadata?.size || 0;
        this.stats.items--;
        return null;
      }

      // Verificar integridad si existe hash
      if (item.metadata?.hash) {
        const calculatedHash = this.hashString(JSON.stringify(item.data));
        if (calculatedHash !== item.metadata.hash) {
          console.warn('⚠️ Corrupción de datos detectada, eliminando...', key);
          localStorage.removeItem(key);
          this.index.delete(key);
          this.stats.misses++;
          this.stats.size -= item.metadata.size || 0;
          this.stats.items--;
          return null;
        }
      }

      this.stats.hits++;
      
      // Actualizar último acceso en el índice
      if (this.index.has(key)) {
        this.index.set(key, {
          ...this.index.get(key),
          lastAccessed: now,
          accessCount: (this.index.get(key).accessCount || 0) + 1
        });
      }
      
      return item.data;
      
    } catch (error) {
      console.error('❌ Error leyendo caché:', error);
      this.stats.errors++;
      this.stats.misses++;
      
      // Limpiar entrada corrupta
      try {
        localStorage.removeItem(key);
        this.index.delete(key);
      } catch (e) {
        // Ignorar errores de limpieza
      }
      
      return null;
    }
  }

  // Guardar datos en caché
  set(key, data, metadata = {}) {
    if (!this.enabled) return false;

    try {
      const itemSize = this.getItemSize(data);
      
      // Verificar límites antes de guardar
      if (!this.checkQuotas(key, itemSize)) {
        return false;
      }

      const item = {
        data,
        timestamp: Date.now(),
        metadata: {
          ...metadata,
          type: metadata.type || 'default',
          size: itemSize,
          hash: metadata.important ? this.hashString(JSON.stringify(data)) : undefined
        }
      };

      const itemStr = JSON.stringify(item);
      const storageSize = this.getItemSize(itemStr);

      // Guardar en localStorage
      localStorage.setItem(key, itemStr);
      
      // Actualizar índice
      this.updateIndex(key, item.metadata, storageSize);
      
      // Actualizar estadísticas
      this.stats.size += storageSize;
      this.stats.items++;
      
      if (CONFIG.FEATURES.DEBUG_MODE) {
        console.log('💾 Cache guardado:', { key, type: metadata.type, size: storageSize });
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Error guardando en caché:', error);
      this.stats.errors++;
      
      // Si es error de espacio, intentar limpieza de emergencia
      if (error.name === 'QuotaExceededError') {
        this.emergencyCleanup();
        
        // Reintentar después de limpieza
        try {
          return this.set(key, data, metadata);
        } catch (retryError) {
          return false;
        }
      }
      
      return false;
    }
  }

  // Actualizar índice de caché
  updateIndex(key, metadata, size) {
    const now = Date.now();
    
    if (this.index.has(key)) {
      const existing = this.index.get(key);
      this.stats.size -= existing.size || 0;
    }
    
    this.index.set(key, {
      key,
      metadata,
      size,
      timestamp: now,
      lastAccessed: now,
      accessCount: 1
    });
    
    // Guardar índice en localStorage periódicamente
    if (now - (this.stats.lastIndexSave || 0) > 60000) {
      this.saveIndex();
      this.stats.lastIndexSave = now;
    }
  }

  // Cargar índice desde localStorage
  loadIndex() {
    try {
      const indexStr = localStorage.getItem('__cache_index__');
      if (indexStr) {
        const savedIndex = JSON.parse(indexStr);
        savedIndex.forEach(item => {
          this.index.set(item.key, item);
          this.stats.size += item.size || 0;
          this.stats.items++;
        });
      }
    } catch (error) {
      console.warn('No se pudo cargar el índice de caché:', error);
    }
  }

  // Guardar índice en localStorage
  saveIndex() {
    try {
      const indexArray = Array.from(this.index.values());
      localStorage.setItem('__cache_index__', JSON.stringify(indexArray));
    } catch (error) {
      console.warn('No se pudo guardar el índice de caché:', error);
    }
  }

  // Verificar cuotas antes de guardar
  checkQuotas(key, newItemSize) {
    // Verificar tamaño máximo por item
    if (newItemSize > this.config.QUOTAS.MAX_ITEM_SIZE) {
      console.warn(`⚠️ Item demasiado grande para caché: ${key}`, newItemSize);
      return false;
    }
    
    // Verificar tamaño total
    if (this.stats.size + newItemSize > this.config.QUOTAS.MAX_CACHE_SIZE) {
      console.log('⚠️ Caché llena, limpiando...');
      this.cleanup();
      
      // Verificar nuevamente después de limpiar
      if (this.stats.size + newItemSize > this.config.QUOTAS.MAX_CACHE_SIZE) {
        console.error('❌ No hay suficiente espacio en caché');
        return false;
      }
    }
    
    // Verificar máximo número de items
    if (this.stats.items >= this.config.QUOTAS.MAX_ITEMS) {
      console.log('⚠️ Máximo número de items alcanzado, limpiando...');
      this.cleanupByAccess();
    }
    
    return true;
  }

  // Calcular tamaño aproximado de un item
  getItemSize(item) {
    try {
      const str = typeof item === 'string' ? item : JSON.stringify(item);
      return new Blob([str]).size;
    } catch (error) {
      return 1024; // Tamaño por defecto si no se puede calcular
    }
  }

  // Limpieza periódica de caché expirada
  cleanup() {
    if (!this.enabled) return;
    
    const now = Date.now();
    let cleanedItems = 0;
    let freedSpace = 0;
    
    try {
      // Limpiar por expiración usando el índice
      for (const [key, item] of this.index.entries()) {
        const ttl = this.config.TTL[item.metadata?.type] || this.config.TTL.DEFAULT;
        
        if (now - item.timestamp > ttl) {
          try {
            localStorage.removeItem(key);
            this.index.delete(key);
            cleanedItems++;
            freedSpace += item.size || 0;
            this.stats.size -= item.size || 0;
            this.stats.items--;
          } catch (e) {
            console.warn('Error eliminando item expirado:', key);
          }
        }
      }
      
      this.stats.lastCleanup = now;
      
      if (cleanedItems > 0 && CONFIG.FEATURES.DEBUG_MODE) {
        console.log(`🧹 Caché limpiada: ${cleanedItems} items, ${(freedSpace / 1024).toFixed(2)}KB liberados`);
      }
      
    } catch (error) {
      console.error('❌ Error en limpieza de caché:', error);
      this.stats.errors++;
    }
  }

  // Limpieza por frecuencia de acceso (LRU)
  cleanupByAccess() {
    const items = Array.from(this.index.values())
      .sort((a, b) => a.lastAccessed - b.lastAccessed);
    
    // Eliminar 20% de los items menos accedidos
    const itemsToRemove = Math.floor(items.length * 0.2);
    
    for (let i = 0; i < itemsToRemove; i++) {
      const item = items[i];
      try {
        localStorage.removeItem(item.key);
        this.index.delete(item.key);
        this.stats.size -= item.size || 0;
        this.stats.items--;
      } catch (e) {
        console.warn('Error en limpieza LRU:', item.key);
      }
    }
    
    if (CONFIG.FEATURES.DEBUG_MODE && itemsToRemove > 0) {
      console.log(`🗑️ Limpieza LRU: ${itemsToRemove} items eliminados`);
    }
  }

  // Limpieza de emergencia cuando se queda sin espacio
  emergencyCleanup() {
    console.log('🚨 Ejecutando limpieza de emergencia de caché');
    
    try {
      // Eliminar todos los items no críticos
      for (const [key, item] of this.index.entries()) {
        if (!item.metadata?.important) {
          localStorage.removeItem(key);
          this.index.delete(key);
          this.stats.size -= item.size || 0;
          this.stats.items--;
        }
      }
      
      // Si todavía hay problemas, eliminar todo excepto config
      if (this.stats.size > this.config.QUOTAS.MAX_CACHE_SIZE * 0.8) {
        for (const [key, item] of this.index.entries()) {
          if (!key.includes('__config__') && !key.includes('__system__')) {
            localStorage.removeItem(key);
            this.index.delete(key);
            this.stats.size -= item.size || 0;
            this.stats.items--;
          }
        }
      }
      
      // Guardar índice actualizado
      this.saveIndex();
      
      console.log('✅ Limpieza de emergencia completada');
      
    } catch (error) {
      console.error('❌ Error en limpieza de emergencia:', error);
    }
  }

  // Monitorear uso de memoria
  monitorMemory() {
    if (!this.enabled) return;
    
    const usage = (this.stats.size / this.config.QUOTAS.MAX_CACHE_SIZE) * 100;
    
    if (usage > 90) {
      console.warn(`⚠️ Uso alto de caché: ${usage.toFixed(2)}%`);
      this.cleanup();
    }
    
    if (CONFIG.FEATURES.DEBUG_MODE && usage > 50) {
      console.log(`📊 Uso de caché: ${usage.toFixed(2)}%`);
    }
  }

  // Limpiar caché por tipo
  clearByType(type) {
    let cleared = 0;
    let freedSpace = 0;
    
    for (const [key, item] of this.index.entries()) {
      if (item.metadata?.type === type) {
        try {
          localStorage.removeItem(key);
          this.index.delete(key);
          cleared++;
          freedSpace += item.size || 0;
          this.stats.size -= item.size || 0;
          this.stats.items--;
        } catch (e) {
          console.warn(`Error eliminando ${type}:`, key);
        }
      }
    }
    
    if (cleared > 0) {
      console.log(`🧹 Caché de tipo "${type}" limpiada: ${cleared} items, ${(freedSpace / 1024).toFixed(2)}KB`);
    }
    
    return cleared;
  }

  // Métodos específicos para VeriRifa-Sol
  cacheRaffles(raffles) {
    const key = this.generateKey('raffles', { type: 'all', count: raffles.length });
    return this.set(key, raffles, { 
      type: 'raffles',
      important: true,
      count: raffles.length,
      timestamp: Date.now()
    });
  }

  getCachedRaffles() {
    const key = this.generateKey('raffles', { type: 'all' });
    return this.get(key);
  }

  cacheWinners(winners) {
    const key = this.generateKey('winners', { type: 'all', count: winners.length });
    return this.set(key, winners, { 
      type: 'winners',
      important: true,
      count: winners.length,
      timestamp: Date.now()
    });
  }

  getCachedWinners() {
    const key = this.generateKey('winners', { type: 'all' });
    return this.get(key);
  }

  cacheUserData(walletAddress, data) {
    const key = this.generateKey('user_data', { wallet: walletAddress });
    return this.set(key, data, { 
      type: 'user_data',
      wallet: walletAddress,
      timestamp: Date.now()
    });
  }

  getCachedUserData(walletAddress) {
    const key = this.generateKey('user_data', { wallet: walletAddress });
    return this.get(key);
  }

  cachePendingTransaction(txData) {
    const key = this.generateKey('pending_tx', { 
      id: Date.now(),
      wallet: txData.wallet 
    });
    return this.set(key, txData, { 
      type: 'transaction',
      status: 'pending',
      ttl: 10 * 60 * 1000 // 10 minutos
    });
  }

  getPendingTransactions(walletAddress) {
    const transactions = [];
    
    for (const [key, item] of this.index.entries()) {
      if (item.metadata?.type === 'transaction' && 
          item.metadata?.status === 'pending' &&
          key.includes(walletAddress)) {
        try {
          const data = this.get(key);
          if (data) transactions.push(data);
        } catch (e) {
          // Ignorar errores
        }
      }
    }
    
    return transactions;
  }

  // Obtener estadísticas
  getStats() {
    const totalAccess = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      enabled: this.enabled,
      hitRate: totalAccess > 0 ? (this.stats.hits / totalAccess * 100).toFixed(2) : 0,
      usage: ((this.stats.size / this.config.QUOTAS.MAX_CACHE_SIZE) * 100).toFixed(2) + '%',
      itemsByType: this.getItemsByType(),
      lastCleanup: new Date(this.stats.lastCleanup).toLocaleTimeString()
    };
  }

  // Obtener distribución de items por tipo
  getItemsByType() {
    const types = {};
    
    for (const item of this.index.values()) {
      const type = item.metadata?.type || 'unknown';
      types[type] = (types[type] || 0) + 1;
    }
    
    return types;
  }

  // Exportar datos de caché para debugging
  exportCacheData() {
    const data = {};
    
    for (const [key, item] of this.index.entries()) {
      try {
        const cached = this.get(key);
        if (cached) {
          data[key] = {
            data: cached,
            metadata: item.metadata,
            size: item.size
          };
        }
      } catch (e) {
        // Ignorar errores
      }
    }
    
    return {
      stats: this.getStats(),
      data,
      exportDate: new Date().toISOString(),
      version: this.config.VERSION
    };
  }

  // Limpiar toda la caché
  clearAll() {
    if (!this.enabled) return;
    
    try {
      // Limpiar localStorage
      localStorage.clear();
      
      // Resetear índice y estadísticas
      this.index.clear();
      this.stats = {
        hits: 0,
        misses: 0,
        size: 0,
        items: 0,
        lastCleanup: Date.now(),
        errors: 0
      };
      
      console.log('🗑️ Toda la caché ha sido limpiada');
      return true;
      
    } catch (error) {
      console.error('❌ Error limpiando caché:', error);
      return false;
    }
  }
}

// Crear instancia global con configuración
const cacheManager = new CacheManager(CONFIG.CACHE);

// Función de precarga de datos críticos
async function preloadCriticalData() {
  if (!cacheManager.enabled) {
    console.log('⏭️ Caché deshabilitada, saltando precarga');
    return;
  }
  
  console.log('🔄 Precargando datos críticos...');
  
  try {
    // Precargar configuración de la aplicación
    const criticalData = {
      adminWallets: CONFIG.SECURITY.ADMIN_WALLETS,
      network: CONFIG.NETWORK,
      version: CONFIG.VERSION,
      features: CONFIG.FEATURES,
      lastUpdated: Date.now()
    };
    
    cacheManager.set('__app_config__', criticalData, { 
      type: 'system', 
      important: true,
      ttl: 24 * 60 * 60 * 1000 // 24 horas
    });
    
    // Si hay wallet conectada, precargar datos del usuario
    if (window.currentWallet?.publicKey) {
      const userData = {
        wallet: currentWallet.publicKey.toString(),
        balance: currentWallet.balance,
        isAdmin: window.isAdmin || false,
        lastSync: Date.now()
      };
      
      cacheManager.cacheUserData(currentWallet.publicKey.toString(), userData);
    }
    
    console.log('✅ Precarga de datos críticos completada');
    
  } catch (error) {
    console.error('❌ Error en precarga de datos:', error);
  }
}

// Integración con funciones existentes de Firebase
async function loadRafflesFromFirebaseWithCache() {
  console.log('📥 Cargando sorteos...');
  
  // Intentar desde caché primero
  const cachedRaffles = cacheManager.getCachedRaffles();
  if (cachedRaffles && cachedRaffles.length > 0) {
    console.log('✅ Sorteos cargados desde caché');
    
    // Actualizar array global
    if (window.raffles) {
      window.raffles = cachedRaffles;
    }
    
    // Cargar en segundo plano desde Firebase para actualizar
    setTimeout(async () => {
      try {
        await loadRafflesFromFirebase();
        
        // Actualizar caché con datos frescos
        cacheManager.cacheRaffles(window.raffles);
        
        if (CONFIG.FEATURES.DEBUG_MODE) {
          console.log('🔄 Sorteos actualizados desde Firebase en background');
        }
      } catch (error) {
        console.error('❌ Error actualizando sorteos en background:', error);
      }
    }, 1000);
    
    return cachedRaffles;
  }
  
  // Si no hay caché o está vacía, cargar desde Firebase
  try {
    await loadRafflesFromFirebase();
    
    // Guardar en caché
    if (window.raffles && window.raffles.length > 0) {
      cacheManager.cacheRaffles(window.raffles);
    }
    
    return window.raffles;
    
  } catch (error) {
    console.error('❌ Error cargando sorteos:', error);
    return [];
  }
}

// Exportar para uso global
window.cacheManager = cacheManager;
window.preloadCriticalData = preloadCriticalData;
window.loadRafflesFromFirebaseWithCache = loadRafflesFromFirebaseWithCache;

console.log('💾 Sistema de caché cargado y listo');
