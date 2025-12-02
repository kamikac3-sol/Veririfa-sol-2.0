// Configuración de Firebase - NUEVO PROYECTO: veririfa-sol-2
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAXdc3j3btUiwItrFJZGvWrHJqhEae0_wU",
    authDomain: "veririfa-sol-2.firebaseapp.com",
    projectId: "veririfa-sol-2",
    storageBucket: "veririfa-sol-2.firebasestorage.app",
    messagingSenderId: "504444330864",
    appId: "1:504444330864:web:abb0847510c5215295a5b5",
    measurementId: "G-62F9LZN3DC"
};

// Inicializar Firebase
let firebaseApp;
let db;
let analytics;

try {
    firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    analytics = firebase.analytics();
    
    // Configuración para desarrollo
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        db.settings({
            experimentalForceLongPolling: true
        });
        console.log("🔧 Modo desarrollo activado para Firebase");
    }
    
    console.log('✅ Firebase inicializado correctamente para veririfa-sol-2');
    
    // Verificar conexión
    db.collection("raffles").limit(1).get().then(() => {
        console.log("📡 Conexión a Firestore verificada");
    }).catch(error => {
        console.error("❌ Error conectando a Firestore:", error);
    });
    
} catch (error) {
    console.error('❌ Error inicializando Firebase:', error);
    showUserAlert('Error: No se puede conectar a la base de datos Firebase', 'error');
}

// Funciones de Firebase
async function saveRafflesToFirebase() {
    if (!db) {
        console.error('❌ Firebase no disponible');
        showUserAlert('Error: No se puede conectar a la base de datos', 'error');
        return false;
    }

    try {
        for (const raffle of raffles) {
            await db.collection('raffles').doc(raffle.id).set({
                ...raffle,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        console.log('✅ Sorteos guardados en Firebase:', raffles.length);
        return true;
    } catch (error) {
        console.error('❌ Error guardando sorteos en Firebase:', error);
        showUserAlert('Error guardando datos en la nube', 'error');
        return false;
    }
}

// ✅ NUEVA: Función de transacción atómica para reservar números
async function reserveNumbersWithTransaction(raffleId, numbers, userWallet) {
    if (!db) {
        console.error('❌ Firebase no disponible');
        return false;
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
            
            return true;
        });
        
    } catch (error) {
        console.error('Error en transacción de reserva:', error);
        throw error;
    }
}

async function loadRafflesFromFirebase() {
    if (!db) {
        console.error('❌ Firebase no disponible');
        raffles = [];
        showUserAlert('Error: No se puede conectar a la base de datos', 'error');
        return;
    }

    try {
        const snapshot = await db.collection('raffles').get();
        
        if (!snapshot.empty) {
            raffles = [];
            snapshot.forEach(doc => {
                const raffleData = doc.data();
                
                // Asegurar que los campos necesarios existan
                if (!raffleData.soldNumbers) raffleData.soldNumbers = [];
                if (!raffleData.numberOwners) raffleData.numberOwners = {};
                if (!raffleData.winner) raffleData.winner = null;
                if (raffleData.prizeClaimed === undefined) raffleData.prizeClaimed = false;
                if (raffleData.completed === undefined) raffleData.completed = false;
                if (!raffleData.shippingStatus) raffleData.shippingStatus = 'pending';
                if (!raffleData.createdAt) raffleData.createdAt = new Date().toISOString();
                
                // Mantener el ID del documento
                raffleData.id = doc.id;
                
                raffles.push(raffleData);
            });
            console.log('✅ Sorteos cargados desde Firebase:', raffles.length);
        } else {
            console.log('📝 No hay sorteos en Firebase');
            raffles = [];
        }
    } catch (error) {
        console.error('❌ Error cargando sorteos desde Firebase:', error);
        raffles = [];
        showUserAlert('Error cargando datos desde la nube', 'error');
    }
}

async function loadWinnersFromFirebase() {
    if (!db) {
        console.error('❌ Firebase no disponible');
        winners = [];
        return;
    }

    try {
        const snapshot = await db.collection('winners').orderBy('winnerDate', 'desc').get();
        
        if (!snapshot.empty) {
            winners = [];
            snapshot.forEach(doc => {
                const winnerData = doc.data();
                winnerData.id = doc.id;
                winners.push(winnerData);
            });
            console.log('✅ Ganadores cargados desde Firebase:', winners.length);
        } else {
            console.log('📝 No hay ganadores en Firebase');
            winners = [];
        }
    } catch (error) {
        console.error('❌ Error cargando ganadores desde Firebase:', error);
        winners = [];
    }
}

async function saveWinnerToFirebase(winnerData) {
    if (!db) {
        console.error('❌ Firebase no disponible');
        return false;
    }

    try {
        await db.collection('winners').add({
            ...winnerData,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Ganador guardado en Firebase');
        return true;
    } catch (error) {
        console.error('❌ Error guardando ganador en Firebase:', error);
        return false;
    }
}

async function saveClaimToFirebase(claimData) {
    if (!db) {
        console.error('❌ Firebase no disponible');
        return false;
    }

    try {
        await db.collection('claims').add({
            ...claimData,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending',
            processed: false
        });
        console.log('✅ Reclamación guardada en Firebase');
        return true;
    } catch (error) {
        console.error('❌ Error guardando reclamación en Firebase:', error);
        return false;
    }
}

async function deleteRaffleFromFirebase(raffleId) {
    if (!db) {
        console.error('❌ Firebase no disponible');
        return false;
    }

    try {
        await db.collection('raffles').doc(raffleId).delete();
        console.log('✅ Sorteo eliminado de Firebase:', raffleId);
        return true;
    } catch (error) {
        console.error('❌ Error eliminando sorteo de Firebase:', error);
        return false;
    }
}

// Función para obtener estadísticas
async function getFirebaseStats() {
    if (!db) return null;

    try {
        const stats = {
            totalRaffles: 0,
            activeRaffles: 0,
            completedRaffles: 0,
            totalWinners: 0,
            totalClaims: 0
        };

        // Contar sorteos
        const rafflesSnapshot = await db.collection('raffles').get();
        stats.totalRaffles = rafflesSnapshot.size;
        
        rafflesSnapshot.forEach(doc => {
            const raffle = doc.data();
            if (raffle.completed) {
                stats.completedRaffles++;
            } else {
                stats.activeRaffles++;
            }
        });

        // Contar ganadores
        const winnersSnapshot = await db.collection('winners').get();
        stats.totalWinners = winnersSnapshot.size;

        // Contar reclamaciones
        const claimsSnapshot = await db.collection('claims').get();
        stats.totalClaims = claimsSnapshot.size;

        console.log('📊 Estadísticas de Firebase:', stats);
        return stats;
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas de Firebase:', error);
        return null;
    }
}

// Función para limpiar datos de prueba (SOLO DESARROLLO)
async function clearTestData() {
    if (!db || !window.location.hostname.includes('localhost')) {
        console.error('❌ Esta función solo está disponible en localhost');
        return;
    }

    try {
        // Eliminar todos los documentos de las colecciones
        const collections = ['raffles', 'winners', 'claims'];
        
        for (const collectionName of collections) {
            const snapshot = await db.collection(collectionName).get();
            const batch = db.batch();
            
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log(`✅ Datos de ${collectionName} eliminados`);
        }
        
        showUserAlert('✅ Datos de prueba eliminados', 'success');
    } catch (error) {
        console.error('❌ Error eliminando datos de prueba:', error);
        showUserAlert('Error eliminando datos de prueba', 'error');
    }
}

// Función para exportar datos
async function exportFirebaseData() {
    if (!db) return null;

    try {
        const exportData = {
            raffles: [],
            winners: [],
            claims: [],
            exportDate: new Date().toISOString(),
            project: 'veririfa-sol-2'
        };

        // Obtener sorteos
        const rafflesSnapshot = await db.collection('raffles').get();
        rafflesSnapshot.forEach(doc => {
            exportData.raffles.push(doc.data());
        });

        // Obtener ganadores
        const winnersSnapshot = await db.collection('winners').get();
        winnersSnapshot.forEach(doc => {
            exportData.winners.push(doc.data());
        });

        // Obtener reclamaciones
        const claimsSnapshot = await db.collection('claims').get();
        claimsSnapshot.forEach(doc => {
            exportData.claims.push(doc.data());
        });

        console.log('📤 Datos exportados de Firebase:', exportData);
        return exportData;
    } catch (error) {
        console.error('❌ Error exportando datos de Firebase:', error);
        return null;
    }
}

// ✅ NUEVO: Configurar listeners en tiempo real para sorteos
function setupRafflesRealTimeListener() {
    if (!db) {
        console.error('❌ Firebase no disponible');
        return;
    }

    // Escuchar cambios en tiempo real en todos los sorteos
    db.collection('raffles').onSnapshot((snapshot) => {
        console.log('🔄 Actualización en tiempo real de sorteos recibida');
        
        const updatedRaffles = [];
        snapshot.forEach(doc => {
            const raffleData = doc.data();
            
            // Asegurar que los campos necesarios existan
            if (!raffleData.soldNumbers) raffleData.soldNumbers = [];
            if (!raffleData.numberOwners) raffleData.numberOwners = {};
            if (!raffleData.winner) raffleData.winner = null;
            if (raffleData.prizeClaimed === undefined) raffleData.prizeClaimed = false;
            if (raffleData.completed === undefined) raffleData.completed = false;
            if (!raffleData.shippingStatus) raffleData.shippingStatus = 'pending';
            if (!raffleData.createdAt) raffleData.createdAt = new Date().toISOString();
            
            // Mantener el ID del documento
            raffleData.id = doc.id;
            
            updatedRaffles.push(raffleData);
        });
        
        // Actualizar el array global de sorteos
        raffles = updatedRaffles;
        
        // Re-renderizar la interfaz de usuario
        renderRaffles();
        updateClaimButtons();
        
        // Si estamos en el modal de selección de números, actualizar la cuadrícula
        if (currentRaffle) {
            // Encontrar el sorteo actualizado
            const updatedCurrentRaffle = raffles.find(r => r.id === currentRaffle.id);
            if (updatedCurrentRaffle) {
                currentRaffle = updatedCurrentRaffle;
                renderNumbersGrid();
                updateSelectionUI();
            }
        }
        
        console.log('✅ Sorteos actualizados en tiempo real:', raffles.length);
        
        // Si estamos en el panel admin, actualizar también
        if (isAdmin && document.getElementById('admin-panel').classList.contains('active')) {
            renderCompletedRaffles();
            loadWinnersAdminTable();
        }
        
    }, (error) => {
        console.error('❌ Error en listener de sorteos:', error);
    });
}

// ✅ NUEVO: Configurar listeners en tiempo real para ganadores
function setupWinnersRealTimeListener() {
    if (!db) {
        console.error('❌ Firebase no disponible');
        return;
    }

    db.collection('winners').orderBy('winnerDate', 'desc').onSnapshot((snapshot) => {
        console.log('🔄 Actualización en tiempo real de ganadores recibida');
        
        const updatedWinners = [];
        snapshot.forEach(doc => {
            const winnerData = doc.data();
            winnerData.id = doc.id;
            updatedWinners.push(winnerData);
        });
        
        winners = updatedWinners;
        renderWinnersArchive();
        
        console.log('✅ Ganadores actualizados en tiempo real:', winners.length);
    }, (error) => {
        console.error('❌ Error en listener de ganadores:', error);
    });
}

// ✅ NUEVO: Escuchar reclamaciones en tiempo real
function setupClaimsRealTimeListener() {
    if (!db) return;
    
    db.collection('claims').orderBy('claimDate', 'desc').onSnapshot((snapshot) => {
        console.log('🔄 Actualización en tiempo real de reclamaciones recibida');
        
        // Actualizar la tabla de admin si está visible
        if (isAdmin && document.getElementById('admin-panel').classList.contains('active')) {
            loadWinnersAdminTable();
        }
    });
}

// ✅ NUEVO: Gestión de sincronización en tiempo real
let realtimeSync = {
    raffles: false,
    winners: false,
    claims: false
};

// ✅ NUEVO: Inicializar todos los listeners en tiempo real
async function initRealtimeSync() {
    console.log('🔄 Iniciando sincronización en tiempo real...');
    
    try {
        // Configurar listeners
        setupRafflesRealTimeListener();
        setupWinnersRealTimeListener();
        setupClaimsRealTimeListener();
        
        realtimeSync = {
            raffles: true,
            winners: true,
            claims: true
        };
        
        console.log('✅ Sincronización en tiempo real activada');
        return true;
    } catch (error) {
        console.error('❌ Error iniciando sincronización en tiempo real:', error);
        return false;
    }
}

// ✅ NUEVO: Verificar estado de sincronización
function checkRealtimeStatus() {
    const status = {
        raffles: realtimeSync.raffles ? '🟢 Conectado' : '🔴 Desconectado',
        winners: realtimeSync.winners ? '🟢 Conectado' : '🔴 Desconectado',
        claims: realtimeSync.claims ? '🟢 Conectado' : '🔴 Desconectado'
    };
    
    return status;
}

// ✅ NUEVO: Forzar resincronización
async function forceResync() {
    console.log('🔄 Forzando resincronización...');
    
    // Recargar datos desde Firebase
    await loadRafflesFromFirebase();
    await loadWinnersFromFirebase();
    
    // Re-renderizar todo
    renderRaffles();
    renderWinnersArchive();
    updateClaimButtons();
    
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
    
    console.log('✅ Resincronización completada');
    showUserAlert('✅ Datos resincronizados correctamente', 'success');
}

// ✅ NUEVO: Manejo de desconexión/reconexión
function setupRealtimeConnectionHandlers() {
    // Detectar cambios en conexión a internet
    window.addEventListener('online', () => {
        console.log('🌐 Conexión a internet restablecida');
        forceResync();
    });
    
    window.addEventListener('offline', () => {
        console.log('🌐 Sin conexión a internet');
        showUserAlert('⚠️ Sin conexión a internet. Los datos pueden no estar actualizados.', 'warning', 0);
    });
}

// Exportar funciones para uso global
window.db = db;
window.firebaseApp = firebaseApp;
window.getFirebaseStats = getFirebaseStats;
window.exportFirebaseData = exportFirebaseData;
window.clearTestData = clearTestData;
window.reserveNumbersWithTransaction = reserveNumbersWithTransaction;
window.initRealtimeSync = initRealtimeSync;
window.checkRealtimeStatus = checkRealtimeStatus;
window.forceResync = forceResync;
window.setupRealtimeConnectionHandlers = setupRealtimeConnectionHandlers;

console.log('🔥 Firebase.js cargado completamente para veririfa-sol-2 con sincronización en tiempo real');
