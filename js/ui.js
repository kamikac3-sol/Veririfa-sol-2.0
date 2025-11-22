// Funciones de interfaz de usuario

function showUserAlert(message, type = 'info', duration = 5000) {
    const alert = document.getElementById('user-alert');
    const alertIcon = document.getElementById('alert-icon');
    const alertMessage = document.getElementById('alert-message');

    alert.className = `user-alert ${type}`;

    switch(type) {
        case 'success':
            alertIcon.textContent = '✅';
            break;
        case 'error':
            alertIcon.textContent = '❌';
            break;
        case 'warning':
            alertIcon.textContent = '⚠️';
            break;
        default:
            alertIcon.textContent = 'ℹ️';
    }

    alertMessage.textContent = message;
    alert.style.display = 'block';

    if (duration > 0) {
        setTimeout(() => {
            hideUserAlert();
        }, duration);
    }
}

function hideUserAlert() {
    document.getElementById('user-alert').style.display = 'none';
}

function showPaymentStatus(message, type = 'info') {
    const paymentStatus = document.getElementById('payment-status');
    const paymentDetails = document.getElementById('payment-details');
    
    paymentStatus.style.display = 'block';
    paymentDetails.innerHTML = message.replace(/\n/g, '<br>');
    paymentStatus.className = `transaction-status ${type === 'success' ? 'transaction-success' : ''} ${type === 'error' ? 'transaction-error' : ''}`;
}

function showTransactionStatus(message, type = 'info') {
    const statusElement = document.getElementById('transaction-status');
    const detailsElement = document.getElementById('transaction-details');
    
    statusElement.style.display = 'block';
    detailsElement.innerHTML = message.replace(/\n/g, '<br>');
    statusElement.className = `transaction-status ${type === 'success' ? 'transaction-success' : ''} ${type === 'error' ? 'transaction-error' : ''}`;
}

function showClaimStatus(message, type = 'info') {
    const claimStatus = document.getElementById('claim-status');
    const claimDetails = document.getElementById('claim-details');

    claimStatus.style.display = 'block';
    claimDetails.innerHTML = message.replace(/\n/g, '<br>');
    claimStatus.className = `transaction-status ${type === 'success' ? 'transaction-success' : ''} ${type === 'error' ? 'transaction-error' : ''}`;
}

// Funciones para FAQ
function setupFAQ() {
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', function() {
            const answer = this.nextElementSibling;
            const toggle = this.querySelector('.faq-toggle');
            
            // Cerrar todas las demás respuestas
            document.querySelectorAll('.faq-answer').forEach(ans => {
                if (ans !== answer) {
                    ans.classList.remove('active');
                    ans.previousElementSibling.querySelector('.faq-toggle').classList.remove('active');
                }
            });
            
            // Alternar la respuesta actual
            answer.classList.toggle('active');
            toggle.classList.toggle('active');
        });
    });
}

// Funciones para validación de formularios
function clearFormValidations() {
    document.querySelectorAll('.form-validation').forEach(validation => {
        validation.classList.remove('show');
    });
    document.querySelectorAll('.form-control').forEach(input => {
        input.classList.remove('error', 'success');
    });
}

function validateClaimForm() {
    let isValid = true;
    
    const name = document.getElementById('winner-name').value.trim();
    const email = document.getElementById('winner-email').value.trim();
    const phone = document.getElementById('winner-phone').value.trim();
    const address = document.getElementById('winner-address').value.trim();
    
    // Validar nombre
    if (!name) {
        document.getElementById('name-validation').classList.add('show');
        document.getElementById('winner-name').classList.add('error');
        isValid = false;
    } else {
        document.getElementById('name-validation').classList.remove('show');
        document.getElementById('winner-name').classList.remove('error');
        document.getElementById('winner-name').classList.add('success');
    }
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        document.getElementById('email-validation').classList.add('show');
        document.getElementById('winner-email').classList.add('error');
        isValid = false;
    } else {
        document.getElementById('email-validation').classList.remove('show');
        document.getElementById('winner-email').classList.remove('error');
        document.getElementById('winner-email').classList.add('success');
    }
    
    // Validar teléfono (mínimo 9 dígitos)
    const phoneRegex = /^[0-9+][0-9\s-]{8,}$/;
    if (!phone || !phoneRegex.test(phone.replace(/\s/g, ''))) {
        document.getElementById('phone-validation').classList.add('show');
        document.getElementById('winner-phone').classList.add('error');
        isValid = false;
    } else {
        document.getElementById('phone-validation').classList.remove('show');
        document.getElementById('winner-phone').classList.remove('error');
        document.getElementById('winner-phone').classList.add('success');
    }
    
    // Validar dirección
    if (!address || address.length < 10) {
        document.getElementById('address-validation').classList.add('show');
        document.getElementById('winner-address').classList.add('error');
        isValid = false;
    } else {
        document.getElementById('address-validation').classList.remove('show');
        document.getElementById('winner-address').classList.remove('error');
        document.getElementById('winner-address').classList.add('success');
    }
    
    return isValid;
}