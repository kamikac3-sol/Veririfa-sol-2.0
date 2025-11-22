// Configuración de Firebase
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBFeUIpZ4SvDJH60WJyuPB9Ud2JJSbjN7Q",
    authDomain: "veririfa-sol.firebaseapp.com",
    projectId: "veririfa-sol",
    storageBucket: "veririfa-sol.firebasestorage.app",
    messagingSenderId: "398195570983",
    appId: "1:398195570983:web:f415c5e20213ccca2fd102",
    measurementId: "G-1BJXVTRG15"
};

// Inicializar Firebase
let firebaseApp;
let db;
let analytics;

try {
    firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    analytics = firebase.analytics();
    console.log('✅ Firebase inicializado correctamente');
} catch (error) {
    console.error('❌ Error inicializando Firebase:', error);
}

// Funciones de Firebase
async function saveRafflesToFirebase() {
    if (!db) {
        console.error('❌ Firebase no disponible');
        showUserAlert('Error: No se puede conectar a la base de datos', 'error');
        return;
    }

    try {
        for (const raffle of raffles) {
            await db.collection('raffles').doc(raffle.id).set({
                ...raffle,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        console.log('✅ Sorteos guardados en Firebase');
    } catch (error) {
        console.error('❌ Error guardando en Firebase:', error);
        showUserAlert('Error guardando datos en la nube', 'error');
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
                if (!raffleData.soldNumbers) raffleData.soldNumbers = [];
                if (!raffleData.winner) raffleData.winner = null;
                if (raffleData.prizeClaimed === undefined) raffleData.prizeClaimed = false;
                if (!raffleData.numberOwners) raffleData.numberOwners = {};
                if (raffleData.completed === undefined) raffleData.completed = false;
                if (!raffleData.shippingStatus) raffleData.shippingStatus = 'pending';
                
                raffles.push(raffleData);
            });
            console.log('✅ Sorteos cargados desde Firebase:', raffles.length);
        } else {
            console.log('📝 No hay sorteos en Firebase');
            raffles = [];
        }
    } catch (error) {
        console.error('❌ Error cargando desde Firebase:', error);
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
                winners.push(doc.data());
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
    if (!db) return;

    try {
        await db.collection('winners').add({
            ...winnerData,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Ganador guardado en Firebase');
    } catch (error) {
        console.error('❌ Error guardando ganador:', error);
    }
}

async function saveClaimToFirebase(claimData) {
    if (!db) return false;

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
        console.error('❌ Error guardando reclamación:', error);
        return false;
    }
}

async function deleteRaffleFromFirebase(raffleId) {
    if (!db) return false;

    try {
        await db.collection('raffles').doc(raffleId).delete();
        console.log('✅ Sorteo eliminado de Firebase');
        return true;
    } catch (error) {
        console.error('❌ Error eliminando sorteo:', error);
        return false;
    }
}