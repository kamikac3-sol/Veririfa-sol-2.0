// Firebase Configuration - Versión Compat (CDN)
const firebaseConfig = {
    apiKey: "AIzaSyAXdc3j3btUiwItrFJZGvWrHJqhEae0_wU",
    authDomain: "veririfa-sol-2.firebaseapp.com",
    projectId: "veririfa-sol-2",
    storageBucket: "veririfa-sol-2.firebasestorage.app",
    messagingSenderId: "504444330864",
    appId: "1:504444330864:web:abb0847510c5215295a5b5",
    measurementId: "G-62F9LZN3DC"
};

// Initialize Firebase with compat version
try {
    // Initialize Firebase
    const app = firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const analytics = firebase.analytics();

    console.log("✅ Firebase conectado correctamente a veririfa-sol-2");
    
    // Configuración para desarrollo
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        db.settings({
            experimentalForceLongPolling: true
        });
        console.log("🔧 Modo desarrollo activado");
    }

    // Export for use in other files
    window.db = db;
    window.firebaseApp = app;
    
    // Verificar conexión
    db.collection("raffles").limit(1).get().then(() => {
        console.log("📡 Conexión a Firestore verificada");
        showAlert("✅ Conectado a Firebase", "success");
    }).catch(error => {
        console.error("❌ Error conectando a Firestore:", error);
        showAlert("❌ Error conectando a la base de datos", "error");
    });

} catch (error) {
    console.error("❌ Error inicializando Firebase:", error);
}

// Función de alerta para mostrar estado
function showAlert(message, type = "info") {
    const alert = document.getElementById('user-alert');
    const alertMessage = document.getElementById('alert-message');
    const alertIcon = document.getElementById('alert-icon');
    
    if (alert && alertMessage && alertIcon) {
        alertMessage.textContent = message;
        
        const icons = {
            success: "✅",
            error: "❌",
            warning: "⚠️",
            info: "ℹ️"
        };
        
        alertIcon.textContent = icons[type] || "ℹ️";
        alert.classList.add('show');
        
        setTimeout(() => {
            alert.classList.remove('show');
        }, 5000);
    }
}
