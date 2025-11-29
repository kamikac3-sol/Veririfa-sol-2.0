async function processRealPayment() {
    // ... código existente hasta la transacción exitosa
    
    try {
        // ✅ NUEVO: Usar transacción atómica para evitar race conditions
        const success = await reserveNumbersWithTransaction(
            currentRaffle.id, 
            selectedNumbers, 
            currentWallet.publicKey.toString()
        );
        
        if (!success) {
            throw new Error('Algunos números ya fueron vendidos. Por favor, selecciona otros.');
        }
        
        // ✅ CONTINUAR con el resto del proceso...
        
    } catch (error) {
        console.error('Error reservando números:', error);
        showPaymentStatus(`❌ Error: ${error.message}`, 'error');
        document.getElementById('confirm-payment-btn').disabled = false;
        return;
    }
}
