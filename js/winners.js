// Gestión de ganadores - VeriRifa-Sol
// Versión 2.0 - Con gestión mejorada de formularios y sincronización

let winners = [];
let currentPrizeToClaim = null;
let currentShippingRaffle = null;
let claimFormResetTimer = null;

// ✅ NUEVO: Estado de formulario para mejor gestión
const formState = {
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    isValid: false
};

// ✅ NUEVO: Configuración de validación
const validationRules = {
    name: {
        minLength: 2,
        maxLength: 100,
        pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/
    },
    email: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    phone: {
        minLength: 9,
        maxLength: 20,
        pattern: /^[0-9+\s\-()]+$/
    },
    address: {
        minLength: 10,
        maxLength: 500
    }
};

function renderWinnersArchive() {
    const winnersContainer = document.getElementById('winners-container');
    winnersContainer.innerHTML = '';

    if (winners.length === 0) {
        winnersContainer.innerHTML = `
            <div style="text-align: center; color: var(--gray); padding: 2rem;">
                <h3>📝 Aún no hay ganadores</h3>
                <p>Los ganadores aparecerán aquí una vez que se realicen los sorteos</p>
            </div>
        `;
        return;
    }

    winners.forEach(winner => {
        const winnerCard = document.createElement('div');
        winnerCard.className = 'winner-card';
        
        const winnerDate = new Date(winner.winnerDate).toLocaleDateString('es-ES');
        const shortWallet = `${winner.winnerWallet.substring(0, 8)}...${winner.winnerWallet.substring(winner.winnerWallet.length - 4)}`;

        // ✅ MEJORADO: Sanitizar datos antes de mostrar
        const safePrize = sanitizeHTML(winner.prize);
        const safeRaffleName = sanitizeHTML(winner.raffleName);
        const safeWinnerInfo = winner.winnerInfo ? sanitizeHTML(winner.winnerInfo.name) : '';

        winnerCard.innerHTML = `
            <div class="winner-header">
                <div class="winner-prize">${safePrize}</div>
                <div class="winner-date">${winnerDate}</div>
            </div>
            <div class="winner-details">
                <div><strong>Sorteo:</strong> ${safeRaffleName}</div>
                <div><strong>Número ganador:</strong> ${winner.winningNumber}</div>
                <div><strong>Wallet:</strong> <span class="winner-wallet">${shortWallet}</span></div>
                ${winner.winnerInfo ? `<div><strong>Ganador:</strong> ${safeWinnerInfo}</div>` : ''}
            </div>
        `;

        winnersContainer.appendChild(winnerCard);
    });
}

function checkUserWinnings() {
    if (!currentWallet.publicKey) return [];

    const userAddress = currentWallet.publicKey.toString();
    const userWinnings = [];

    raffles.forEach(raffle => {
        if (raffle.winner && raffle.winner.wallet === userAddress && !raffle.prizeClaimed) {
            userWinnings.push({
                raffle: raffle,
                winningNumber: raffle.winner.number,
                prize: raffle.prize
            });
        }
    });

    return userWinnings;
}

// ✅ MEJORADO: Función para abrir modal de reclamación con limpieza completa
function openClaimPrizeModal(raffleId) {
    const raffle = raffles.find(r => r.id === raffleId);
    if (!raffle || !raffle.winner) return;

    // Verificar que el usuario actual es el ganador
    if (currentWallet.publicKey.toString() !== raffle.winner.wallet) {
        showUserAlert('❌ No eres el ganador de este sorteo', 'error');
        return;
    }

    // ✅ NUEVO: Cancelar timer de reseteo si existe
    if (claimFormResetTimer) {
        clearTimeout(claimFormResetTimer);
        claimFormResetTimer = null;
    }

    currentPrizeToClaim = raffle;

    // ✅ NUEVO: Restablecer estado del formulario
    resetFormState();

    document.getElementById('prize-name').textContent = `Premio: ${raffle.prize}`;
    document.getElementById('claim-raffle-name').textContent = raffle.name;
    document.getElementById('winning-number').textContent = raffle.winner.number;
    document.getElementById('winner-wallet').textContent =
        `${currentWallet.publicKey.toString().substring(0, 8)}...${currentWallet.publicKey.toString().substring(currentWallet.publicKey.toString().length - 4)}`;

    // ✅ MEJORADO: Limpieza completa del formulario
    resetClaimForm();

    document.getElementById('claim-prize-modal').classList.add('active');
}

// ✅ NUEVO: Función para restablecer estado del formulario
function resetFormState() {
    formState.name = '';
    formState.email = '';
    formState.phone = '';
    formState.address = '';
    formState.notes = '';
    formState.isValid = false;
}

// ✅ MEJORADO: Función para limpiar completamente el formulario de reclamación
function resetClaimForm() {
    const formElements = [
        'winner-name',
        'winner-email',
        'winner-phone',
        'winner-address',
        'winner-notes'
    ];

    formElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = '';
            element.classList.remove('success', 'error', 'validating');
        }
    });

    // Limpiar mensajes de validación
    clearFormValidations();

    // Restablecer botón de envío
    const submitBtn = document.getElementById('submit-claim-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '✅ Enviar Información y Reclamar Premio';
        submitBtn.classList.remove('btn-success', 'btn-disabled');
        submitBtn.classList.add('btn-success');
    }

    // Ocultar estado de transacción
    const claimStatus = document.getElementById('claim-status');
    if (claimStatus) {
        claimStatus.style.display = 'none';
    }
}

// ✅ NUEVO: Función mejorada para cargar información guardada
function loadSavedContactInfo() {
    // Para VeriRifa-Sol, siempre empezamos con formulario limpio
    resetClaimForm();
    
    // ✅ MEJORADO: Limpiar también el campo de notas que estaba causando el problema
    const notesField = document.getElementById('winner-notes');
    if (notesField) {
        notesField.value = '';
        notesField.classList.remove('success', 'error');
    }
    
    // Limpiar validaciones
    clearFormValidations();
    
    console.log('✅ Formulario de reclamación limpiado completamente');
}

// ✅ MEJORADO: Validación de formulario con real-time feedback
function validateClaimForm() {
    const name = document.getElementById('winner-name').value.trim();
    const email = document.getElementById('winner-email').value.trim();
    const phone = document.getElementById('winner-phone').value.trim();
    const address = document.getElementById('winner-address').value.trim();
    
    let isValid = true;
    
    // Validar nombre
    const nameValidation = document.getElementById('name-validation');
    const nameField = document.getElementById('winner-name');
    
    if (!name || name.length < validationRules.name.minLength) {
        nameField.classList.remove('success');
        nameField.classList.add('error');
        nameValidation.textContent = `El nombre debe tener al menos ${validationRules.name.minLength} caracteres`;
        nameValidation.classList.add('show');
        isValid = false;
    } else if (name.length > validationRules.name.maxLength) {
        nameField.classList.remove('success');
        nameField.classList.add('error');
        nameValidation.textContent = `El nombre no puede exceder ${validationRules.name.maxLength} caracteres`;
        nameValidation.classList.add('show');
        isValid = false;
    } else if (!validationRules.name.pattern.test(name)) {
        nameField.classList.remove('success');
        nameField.classList.add('error');
        nameValidation.textContent = 'El nombre solo puede contener letras y espacios';
        nameValidation.classList.add('show');
        isValid = false;
    } else {
        nameField.classList.remove('error');
        nameField.classList.add('success');
        nameValidation.classList.remove('show');
    }
    
    // Validar email
    const emailValidation = document.getElementById('email-validation');
    const emailField = document.getElementById('winner-email');
    
    if (!email || !validationRules.email.pattern.test(email)) {
        emailField.classList.remove('success');
        emailField.classList.add('error');
        emailValidation.textContent = 'Por favor, introduce un email válido';
        emailValidation.classList.add('show');
        isValid = false;
    } else {
        emailField.classList.remove('error');
        emailField.classList.add('success');
        emailValidation.classList.remove('show');
    }
    
    // Validar teléfono
    const phoneValidation = document.getElementById('phone-validation');
    const phoneField = document.getElementById('winner-phone');
    const cleanPhone = phone.replace(/\s/g, '');
    
    if (!phone || cleanPhone.length < validationRules.phone.minLength) {
        phoneField.classList.remove('success');
        phoneField.classList.add('error');
        phoneValidation.textContent = `El teléfono debe tener al menos ${validationRules.phone.minLength} dígitos`;
        phoneValidation.classList.add('show');
        isValid = false;
    } else if (cleanPhone.length > validationRules.phone.maxLength) {
        phoneField.classList.remove('success');
        phoneField.classList.add('error');
        phoneValidation.textContent = `El teléfono no puede exceder ${validationRules.phone.maxLength} caracteres`;
        phoneValidation.classList.add('show');
        isValid = false;
    } else if (!validationRules.phone.pattern.test(phone)) {
        phoneField.classList.remove('success');
        phoneField.classList.add('error');
        phoneValidation.textContent = 'Formato de teléfono inválido';
        phoneValidation.classList.add('show');
        isValid = false;
    } else {
        phoneField.classList.remove('error');
        phoneField.classList.add('success');
        phoneValidation.classList.remove('show');
    }
    
    // Validar dirección
    const addressValidation = document.getElementById('address-validation');
    const addressField = document.getElementById('winner-address');
    
    if (!address || address.length < validationRules.address.minLength) {
        addressField.classList.remove('success');
        addressField.classList.add('error');
        addressValidation.textContent = `La dirección debe tener al menos ${validationRules.address.minLength} caracteres`;
        addressValidation.classList.add('show');
        isValid = false;
    } else if (address.length > validationRules.address.maxLength) {
        addressField.classList.remove('success');
        addressField.classList.add('error');
        addressValidation.textContent = `La dirección no puede exceder ${validationRules.address.maxLength} caracteres`;
        addressValidation.classList.add('show');
        isValid = false;
    } else {
        addressField.classList.remove('error');
        addressField.classList.add('success');
        addressValidation.classList.remove('show');
    }
    
    // Actualizar estado del botón de envío
    const submitBtn = document.getElementById('submit-claim-btn');
    if (submitBtn) {
        submitBtn.disabled = !isValid;
        if (isValid) {
            submitBtn.classList.remove('btn-disabled');
            submitBtn.classList.add('btn-success');
        } else {
            submitBtn.classList.add('btn-disabled');
            submitBtn.classList.remove('btn-success');
        }
    }
    
    // Guardar estado del formulario
    formState.isValid = isValid;
    formState.name = name;
    formState.email = email;
    formState.phone = phone;
    formState.address = address;
    
    return isValid;
}

// ✅ NUEVO: Validación en tiempo real para cada campo
function setupRealTimeValidation() {
    const fields = ['winner-name', 'winner-email', 'winner-phone', 'winner-address'];
    
    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            // Eliminar listeners anteriores para evitar duplicados
            field.removeEventListener('input', handleFieldValidation);
            field.addEventListener('input', handleFieldValidation);
            
            // También validar al perder el foco
            field.removeEventListener('blur', handleFieldValidation);
            field.addEventListener('blur', handleFieldValidation);
        }
    });
    
    // Campo de notas (solo limpiar estilos)
    const notesField = document.getElementById('winner-notes');
    if (notesField) {
        notesField.addEventListener('focus', function() {
            this.classList.remove('error');
        });
    }
}

// ✅ NUEVO: Manejador de validación para campos individuales
function handleFieldValidation(event) {
    const field = event.target;
    const fieldId = field.id;
    const value = field.value.trim();
    
    // Remover estilos previos
    field.classList.remove('success', 'error');
    
    // Validar según el campo
    switch(fieldId) {
        case 'winner-name':
            if (value && value.length >= validationRules.name.minLength && 
                value.length <= validationRules.name.maxLength && 
                validationRules.name.pattern.test(value)) {
                field.classList.add('success');
            } else if (value) {
                field.classList.add('error');
            }
            break;
            
        case 'winner-email':
            if (value && validationRules.email.pattern.test(value)) {
                field.classList.add('success');
            } else if (value) {
                field.classList.add('error');
            }
            break;
            
        case 'winner-phone':
            const cleanPhone = value.replace(/\s/g, '');
            if (value && cleanPhone.length >= validationRules.phone.minLength && 
                cleanPhone.length <= validationRules.phone.maxLength && 
                validationRules.phone.pattern.test(value)) {
                field.classList.add('success');
            } else if (value) {
                field.classList.add('error');
            }
            break;
            
        case 'winner-address':
            if (value && value.length >= validationRules.address.minLength && 
                value.length <= validationRules.address.maxLength) {
                field.classList.add('success');
            } else if (value) {
                field.classList.add('error');
            }
            break;
    }
    
    // Validar formulario completo
    validateClaimForm();
}

async function submitPrizeClaim() {
    // Validar formulario antes de enviar
    if (!validateClaimForm()) {
        showUserAlert('Por favor, corrige los errores en el formulario', 'error');
        return;
    }

    const name = document.getElementById('winner-name').value.trim();
    const email = document.getElementById('winner-email').value.trim();
    const phone = document.getElementById('winner-phone').value.trim();
    const address = document.getElementById('winner-address').value.trim();
    const notes = document.getElementById('winner-notes').value.trim();

    if (!name || !email || !phone || !address) {
        showUserAlert('Por favor, completa todos los campos obligatorios', 'error');
        return;
    }

    if (!currentPrizeToClaim) {
        showUserAlert('Error: No se encontró información del premio', 'error');
        return;
    }

    showClaimStatus('⏳ Guardando información del ganador en Firebase...', 'info');
    
    const submitBtn = document.getElementById('submit-claim-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Guardando...';
        submitBtn.classList.add('btn-disabled');
    }

    try {
        const claimData = {
            raffleId: currentPrizeToClaim.id,
            raffleName: currentPrizeToClaim.name,
            prize: currentPrizeToClaim.prize,
            winningNumber: currentPrizeToClaim.winner.number,
            winnerWallet: currentWallet.publicKey.toString(),
            winnerInfo: {
                name: name,
                email: email,
                phone: phone,
                address: address,
                notes: notes
            },
            claimDate: new Date().toISOString(),
            claimTimestamp: Date.now()
        };

        // Guardar en Firebase
        const saved = await saveClaimToFirebase(claimData);

        if (saved) {
            // Actualizar el sorteo local
            currentPrizeToClaim.prizeClaimed = true;
            currentPrizeToClaim.claimDate = new Date().toISOString();
            currentPrizeToClaim.winnerInfo = claimData.winnerInfo;
            currentPrizeToClaim.shippingStatus = 'claimed';

            // Guardar en Firebase
            await saveRafflesToFirebase();

            showClaimStatus(
                `✅ ¡Información guardada correctamente en Firebase!\n\n` +
                `• Hemos recibido tus datos de envío\n` +
                `• Te contactaremos pronto a: ${email}\n` +
                `• Premio: ${currentPrizeToClaim.prize}\n` +
                `• Número ganador: ${currentPrizeToClaim.winner.number}\n\n` +
                `¡Felicidades nuevamente! 🎉`,
                'success'
            );

            // Actualizar UI
            updateClaimButtons();
            renderRaffles();
            loadWinnersAdminTable();
            
            // ✅ MEJORADO: Programar cierre automático con reset
            claimFormResetTimer = setTimeout(() => {
                closeClaimPrizeModal();
                
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = '✅ Enviar Información y Reclamar Premio';
                    submitBtn.classList.remove('btn-disabled');
                }
                
                // Mostrar confirmación
                showUserAlert(`🎉 ¡Premio reclamado exitosamente! Te contactaremos pronto.`, 'success');
            }, 5000);

        } else {
            throw new Error('Error al guardar en Firebase');
        }

    } catch (error) {
        console.error('Error reclamando premio:', error);
        showClaimStatus(`❌ Error: ${error.message}`, 'error');
        
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '✅ Enviar Información y Reclamar Premio';
            submitBtn.classList.remove('btn-disabled');
        }
        
        showUserAlert(`❌ Error al reclamar premio: ${error.message}`, 'error');
    }
}

function closeClaimPrizeModal() {
    document.getElementById('claim-prize-modal').classList.remove('active');
    
    // ✅ NUEVO: Cancelar timer si existe
    if (claimFormResetTimer) {
        clearTimeout(claimFormResetTimer);
        claimFormResetTimer = null;
    }
    
    currentPrizeToClaim = null;
    
    // ✅ MEJORADO: Reset completo del formulario con pequeño delay
    setTimeout(() => {
        resetClaimForm();
        resetFormState();
    }, 300);
}

// FUNCIONES PARA LA TABLA DE GANADORES EN ADMIN
function loadWinnersAdminTable() {
    if (!isAdmin) return;
    
    const winnersTbody = document.getElementById('winners-admin-tbody');
    const winnersTable = document.getElementById('winners-admin-table');
    const noWinnersMessage = document.getElementById('no-winners-message');
    
    // Filtrar sorteos con ganadores que han reclamado premios
    const claimedRaffles = raffles.filter(raffle => 
        raffle.winner && raffle.prizeClaimed && raffle.winnerInfo
    );
    
    if (claimedRaffles.length === 0) {
        if (winnersTable) winnersTable.style.display = 'none';
        if (noWinnersMessage) noWinnersMessage.style.display = 'block';
        return;
    }
    
    // Aplicar filtros
    const searchTerm = document.getElementById('winner-search')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('winner-status-filter')?.value || 'all';
    
    const filteredRaffles = claimedRaffles.filter(raffle => {
        // Filtro de búsqueda
        const matchesSearch = 
            raffle.winnerInfo.name.toLowerCase().includes(searchTerm) ||
            raffle.winnerInfo.email.toLowerCase().includes(searchTerm) ||
            raffle.prize.toLowerCase().includes(searchTerm) ||
            raffle.name.toLowerCase().includes(searchTerm);
        
        // Filtro de estado
        let matchesStatus = true;
        if (statusFilter !== 'all') {
            const raffleStatus = raffle.shippingStatus || 'pending';
            matchesStatus = raffleStatus === statusFilter;
        }
        
        return matchesSearch && matchesStatus;
    });
    
    if (filteredRaffles.length === 0) {
        if (winnersTable) winnersTable.style.display = 'none';
        if (noWinnersMessage) {
            noWinnersMessage.innerHTML = `
                <h4>🔍 No se encontraron resultados</h4>
                <p>No hay ganadores que coincidan con los criterios de búsqueda</p>
            `;
            noWinnersMessage.style.display = 'block';
        }
        return;
    }
    
    // Generar filas de la tabla
    if (winnersTbody) {
        winnersTbody.innerHTML = '';
        filteredRaffles.forEach(raffle => {
            const winnerInfo = raffle.winnerInfo;
            const winnerDate = new Date(raffle.winner.date).toLocaleDateString('es-ES');
            const shortWallet = `${raffle.winner.wallet.substring(0, 8)}...${raffle.winner.wallet.substring(raffle.winner.wallet.length - 4)}`;
            const shippingStatus = raffle.shippingStatus || 'pending';
            
            // Determinar texto y clase del estado
            let statusText, statusClass;
            switch(shippingStatus) {
                case 'claimed':
                    statusText = 'Reclamado';
                    statusClass = 'status-claimed';
                    break;
                case 'shipped':
                    statusText = 'Enviado';
                    statusClass = 'status-shipped';
                    break;
                case 'delivered':
                    statusText = 'Entregado';
                    statusClass = 'status-delivered';
                    break;
                default:
                    statusText = 'Pendiente';
                    statusClass = 'status-pending';
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <strong>${sanitizeHTML(winnerInfo.name)}</strong><br>
                    <small style="color: var(--gray);">${shortWallet}</small>
                </td>
                <td class="winner-contact-info">
                    <div>📧 ${sanitizeHTML(winnerInfo.email)}</div>
                    <div>📞 ${sanitizeHTML(winnerInfo.phone)}</div>
                    <div>🏠 ${sanitizeHTML(winnerInfo.address.substring(0, 30))}...</div>
                    ${winnerInfo.notes ? `<div>📝 ${sanitizeHTML(winnerInfo.notes.substring(0, 30))}...</div>` : ''}
                </td>
                <td>${sanitizeHTML(raffle.prize)}</td>
                <td>${sanitizeHTML(raffle.name)}</td>
                <td><strong>${raffle.winner.number}</strong></td>
                <td>${winnerDate}</td>
                <td>
                    <span class="winner-status-badge ${statusClass}">${statusText}</span>
                </td>
                <td class="winner-actions">
                    <button class="btn btn-info btn-small view-winner-details" data-raffle="${raffle.id}">👁️</button>
                    <button class="btn btn-warning btn-small update-shipping-status" data-raffle="${raffle.id}">📦</button>
                </td>
            `;
            
            winnersTbody.appendChild(row);
        });
    }
    
    if (winnersTable) winnersTable.style.display = 'table';
    if (noWinnersMessage) noWinnersMessage.style.display = 'none';
    
    // Agregar event listeners a los botones
    setupWinnerAdminButtons();
}

function setupWinnerAdminButtons() {
    // Botón para ver detalles completos
    document.querySelectorAll('.view-winner-details').forEach(btn => {
        btn.addEventListener('click', function() {
            const raffleId = this.getAttribute('data-raffle');
            showWinnerDetailsModal(raffleId);
        });
    });
    
    // Botón para actualizar estado de envío
    document.querySelectorAll('.update-shipping-status').forEach(btn => {
        btn.addEventListener('click', function() {
            const raffleId = this.getAttribute('data-raffle');
            openShippingStatusModal(raffleId);
        });
    });
}

function showWinnerDetailsModal(raffleId) {
    const raffle = raffles.find(r => r.id === raffleId);
    if (!raffle || !raffle.winnerInfo) return;
    
    const winnerInfo = raffle.winnerInfo;
    
    // Crear modal dinámicamente
    const modalId = 'winner-details-modal';
    let modal = document.getElementById(modalId);
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">📋 Detalles Completos del Ganador</h3>
                    <button class="close-modal" id="close-winner-details-modal">&times;</button>
                </div>
                <div id="winner-details-content">
                    <!-- Contenido dinámico -->
                </div>
                <div style="margin-top: 1.5rem; text-align: center;">
                    <button class="btn btn-outline" id="close-winner-details-btn">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Event listeners para cerrar modal
        document.getElementById('close-winner-details-modal').addEventListener('click', function() {
            modal.classList.remove('active');
        });
        
        document.getElementById('close-winner-details-btn').addEventListener('click', function() {
            modal.classList.remove('active');
        });
        
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.classList.remove('active');
            }
        });
    }
    
    const content = document.getElementById('winner-details-content');
    const shippingStatus = raffle.shippingStatus || 'pending';
    
    content.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
            <div class="local-info">
                <h4>👤 Información Personal</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <div><strong>Nombre:</strong> ${sanitizeHTML(winnerInfo.name)}</div>
                    <div><strong>Email:</strong> ${sanitizeHTML(winnerInfo.email)}</div>
                    <div><strong>Teléfono:</strong> ${sanitizeHTML(winnerInfo.phone)}</div>
                    <div><strong>Wallet:</strong> ${raffle.winner.wallet}</div>
                </div>
            </div>
            
            <div class="local-info">
                <h4>🏠 Dirección de Envío</h4>
                <p>${sanitizeHTML(winnerInfo.address).replace(/\n/g, '<br>')}</p>
            </div>
            
            ${winnerInfo.notes ? `
            <div class="local-info">
                <h4>📝 Notas Adicionales</h4>
                <p>${sanitizeHTML(winnerInfo.notes).replace(/\n/g, '<br>')}</p>
            </div>
            ` : ''}
            
            <div class="local-info">
                <h4>🎯 Información del Premio</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <div><strong>Sorteo:</strong> ${sanitizeHTML(raffle.name)}</div>
                    <div><strong>Premio:</strong> ${sanitizeHTML(raffle.prize)}</div>
                    <div><strong>Número Ganador:</strong> ${raffle.winner.number}</div>
                    <div><strong>Fecha del Sorteo:</strong> ${new Date(raffle.winner.date).toLocaleDateString('es-ES')}</div>
                    <div><strong>Fecha de Reclamación:</strong> ${raffle.claimDate ? new Date(raffle.claimDate).toLocaleDateString('es-ES') : 'No disponible'}</div>
                    <div><strong>Estado de Envío:</strong> 
                        <span class="winner-status-badge status-${shippingStatus}">${getShippingStatusText(shippingStatus)}</span>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 1rem;">
                <button class="btn btn-warning update-shipping-from-details" data-raffle="${raffle.id}">📦 Actualizar Estado</button>
                <button class="btn btn-info" onclick="window.print()">🖨️ Imprimir</button>
            </div>
        </div>
    `;
    
    // Agregar event listener para actualizar estado de envío
    const updateBtn = document.querySelector('.update-shipping-from-details');
    if (updateBtn) {
        updateBtn.addEventListener('click', function() {
            const raffleId = this.getAttribute('data-raffle');
            modal.classList.remove('active');
            openShippingStatusModal(raffleId);
        });
    }
    
    modal.classList.add('active');
}

// MEJORA: Función para abrir el modal de estado de envío
function openShippingStatusModal(raffleId) {
    const raffle = raffles.find(r => r.id === raffleId);
    if (!raffle || !raffle.winnerInfo) return;
    
    currentShippingRaffle = raffle;
    
    const winnerInfo = raffle.winnerInfo;
    const currentStatus = raffle.shippingStatus || 'pending';
    
    document.getElementById('shipping-prize-name').textContent = `Premio: ${raffle.prize}`;
    document.getElementById('shipping-raffle-name').textContent = raffle.name;
    document.getElementById('shipping-winner-name').textContent = winnerInfo.name;
    document.getElementById('current-shipping-status').textContent = getShippingStatusText(currentStatus);
    
    // Actualizar botones de estado
    document.querySelectorAll('.shipping-status-btn').forEach(btn => {
        const status = btn.getAttribute('data-status');
        btn.classList.remove('active');
        if (status === currentStatus) {
            btn.classList.add('active');
        }
    });
    
    document.getElementById('shipping-status-modal').classList.add('active');
}

// MEJORA: Función para actualizar el estado de envío
async function updateShippingStatus(newStatus) {
    if (!currentShippingRaffle) return;
    
    const raffle = currentShippingRaffle;
    
    // Actualizar estado
    raffle.shippingStatus = newStatus;
    
    // Guardar en Firebase
    await saveRafflesToFirebase();
    
    // Actualizar tabla
    loadWinnersAdminTable();
    
    // Cerrar modal
    closeShippingStatusModal();
    
    showUserAlert(`✅ Estado de envío actualizado a: ${getShippingStatusText(newStatus)}`, 'success');
}

// MEJORA: Función para cerrar el modal de estado de envío
function closeShippingStatusModal() {
    document.getElementById('shipping-status-modal').classList.remove('active');
    currentShippingRaffle = null;
}

// Configurar event listeners para los filtros
function setupWinnersAdminFilters() {
    const searchInput = document.getElementById('winner-search');
    const statusFilter = document.getElementById('winner-status-filter');
    const refreshBtn = document.getElementById('refresh-winners-btn');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            loadWinnersAdminTable();
        });
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            loadWinnersAdminTable();
        });
    }
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadWinnersAdminTable();
            showUserAlert('🔄 Lista de ganadores actualizada', 'info');
        });
    }
}

// FUNCIÓN PARA EL BOTÓN "INFO GANADOR"
function setupWinnerInfoButton() {
    const winnerInfoBtn = document.getElementById('winner-info-btn');
    
    if (winnerInfoBtn) {
        winnerInfoBtn.addEventListener('click', function() {
            if (!currentWallet.publicKey) {
                showUserAlert('🔗 Conecta tu wallet primero para ver información de ganador', 'warning');
                return;
            }

            const userWinnings = checkUserWinnings();
            const userAddress = currentWallet.publicKey.toString();

            // Buscar todos los sorteos donde el usuario sea ganador
            const userWinnerRaffles = raffles.filter(raffle => 
                raffle.winner && raffle.winner.wallet === userAddress
            );

            if (userWinnerRaffles.length === 0) {
                // Mostrar información general si no es ganador
                showWinnerInfoModal(null);
            } else {
                // Mostrar información específica si es ganador
                showWinnerInfoModal(userWinnerRaffles);
            }
        });
    }
}

function showWinnerInfoModal(winnerRaffles) {
    // Crear modal dinámicamente
    const modalId = 'winner-info-modal';
    let modal = document.getElementById(modalId);
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">🏆 Información del Ganador</h3>
                    <button class="close-modal" id="close-winner-info-modal">&times;</button>
                </div>
                <div id="winner-info-content">
                    <!-- Contenido dinámico -->
                </div>
                <div style="margin-top: 1.5rem; text-align: center;">
                    <button class="btn btn-outline" id="close-winner-info-btn">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Event listeners para cerrar modal
        document.getElementById('close-winner-info-modal').addEventListener('click', function() {
            modal.classList.remove('active');
        });
        
        document.getElementById('close-winner-info-btn').addEventListener('click', function() {
            modal.classList.remove('active');
        });
        
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.classList.remove('active');
            }
        });
    }
    
    const content = document.getElementById('winner-info-content');
    
    if (!winnerRaffles || winnerRaffles.length === 0) {
        // Usuario no es ganador
        const userParticipations = getUserParticipations();
        const totalSpent = userParticipations.reduce((sum, part) => sum + part.price, 0);
        
        content.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📋</div>
                <h3 style="color: var(--secondary); margin-bottom: 1rem;">Información de Participante</h3>
                <p><strong>Wallet conectada:</strong><br>
                <span style="font-family: monospace; background: rgba(255,255,255,0.1); padding: 0.3rem 0.6rem; border-radius: 8px; display: inline-block; margin: 0.5rem 0;">
                    ${currentWallet.publicKey.toString().substring(0, 8)}...${currentWallet.publicKey.toString().substring(currentWallet.publicKey.toString().length - 4)}
                </span></p>
                
                <div class="winner-stats">
                    <div class="winner-stat-card">
                        <div class="winner-stat-number">${userParticipations.length}</div>
                        <div class="winner-stat-label">Números Comprados</div>
                    </div>
                    <div class="winner-stat-card">
                        <div class="winner-stat-number">${totalSpent.toFixed(2)} SOL</div>
                        <div class="winner-stat-label">Total Gastado</div>
                    </div>
                    <div class="winner-stat-card">
                        <div class="winner-stat-number">${raffles.filter(r => !r.completed).length}</div>
                        <div class="winner-stat-label">Sorteos Activos</div>
                    </div>
                    <div class="winner-stat-card">
                        <div class="winner-stat-number">${winners.length}</div>
                        <div class="winner-stat-label">Ganadores Totales</div>
                    </div>
                </div>
                
                <div style="background: rgba(20, 241, 149, 0.1); border-radius: 10px; padding: 1rem; margin: 1rem 0;">
                    <h4 style="color: var(--secondary); margin-bottom: 0.5rem;">📝 Cuando Ganes</h4>
                    <p>Al ganar un sorteo, podrás:</p>
                    <p>✅ <strong>Reclamar tu premio</strong> completando tus datos</p>
                    <p>📧 <strong>Recibir notificación</strong> por email</p>
                    <p>📦 <strong>Recibir el premio físico</strong> en tu dirección</p>
                    <p>🔗 <strong>Verificar transacción</strong> en la blockchain</p>
                </div>
            </div>
        `;
    } else {
        // Usuario es ganador de uno o más sorteos
        content.innerHTML = `
            <div style="text-align: center; padding: 1rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🏆</div>
                <h3 style="color: var(--success); margin-bottom: 1rem;">¡Eres Ganador!</h3>
                <p><strong>Wallet ganadora:</strong><br>
                <span style="font-family: monospace; background: rgba(20, 241, 149, 0.2); padding: 0.3rem 0.6rem; border-radius: 8px; display: inline-block; margin: 0.5rem 0;">
                    ${currentWallet.publicKey.toString().substring(0, 8)}...${currentWallet.publicKey.toString().substring(currentWallet.publicKey.toString().length - 4)}
                </span></p>
            </div>
        `;
        
        winnerRaffles.forEach((raffle, index) => {
            const raffleCard = document.createElement('div');
            raffleCard.className = 'local-info';
            raffleCard.style.margin = '1rem 0';
            
            const shippingStatus = raffle.shippingStatus || 'pending';
            const statusText = getShippingStatusText(shippingStatus);
            
            raffleCard.innerHTML = `
                <h4>${sanitizeHTML(raffle.name)}</h4>
                <div style="display: grid; grid-template-columns: 1fr; gap: 0.5rem; margin: 1rem 0;">
                    <div><strong>Premio ganado:</strong> ${sanitizeHTML(raffle.prize)}</div>
                    <div><strong>Número ganador:</strong> ${raffle.winner.number}</div>
                    <div><strong>Fecha del sorteo:</strong> ${new Date(raffle.winner.date).toLocaleDateString('es-ES')}</div>
                    <div><strong>Estado:</strong> <span class="winner-status-badge status-${shippingStatus}">${statusText}</span></div>
                </div>
                ${!raffle.prizeClaimed ? `
                    <button class="btn btn-success claim-from-info-btn" data-raffle="${raffle.id}" style="width: 100%;">
                        🎉 Reclamar Premio
                    </button>
                ` : `
                    <div style="background: rgba(20, 241, 149, 0.1); padding: 1rem; border-radius: 8px; text-align: center;">
                        <strong>${shippingStatus === 'delivered' ? '✅ Premio entregado' : '📦 Premio en proceso de envío'}</strong>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">
                            ${raffle.winnerInfo ? `Contacto: ${sanitizeHTML(raffle.winnerInfo.name)} - ${sanitizeHTML(raffle.winnerInfo.email)}` : 'Datos de envío confirmados'}
                        </p>
                    </div>
                `}
            `;
            
            content.appendChild(raffleCard);
        });
        
        // Agregar event listeners para los botones de reclamar
        setTimeout(() => {
            document.querySelectorAll('.claim-from-info-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const raffleId = this.getAttribute('data-raffle');
                    modal.classList.remove('active');
                    openClaimPrizeModal(raffleId);
                });
            });
        }, 100);
    }
    
    modal.classList.add('active');
}

function getUserParticipations() {
    if (!currentWallet.publicKey) return [];
    
    const userAddress = currentWallet.publicKey.toString();
    const participations = [];
    
    raffles.forEach(raffle => {
        if (raffle.numberOwners) {
            Object.entries(raffle.numberOwners).forEach(([number, wallet]) => {
                if (wallet === userAddress) {
                    participations.push({
                        raffle: raffle.name,
                        number: parseInt(number),
                        price: raffle.price,
                        isWinner: raffle.winner && raffle.winner.wallet === userAddress && raffle.winner.number === parseInt(number)
                    });
                }
            });
        }
    });
    
    return participations;
}

// FUNCIÓN PARA VISUALIZAR TRANSACCIONES
function setupTransactionsView() {
    const viewTransactionsBtn = document.getElementById('view-transactions');
    
    if (viewTransactionsBtn) {
        viewTransactionsBtn.addEventListener('click', function() {
            if (!isAdmin) {
                showUserAlert('❌ Solo el verificador puede ver las transacciones', 'error');
                return;
            }
            showTransactionsModal();
        });
    }
}

function showTransactionsModal() {
    // Crear modal dinámicamente
    const modalId = 'transactions-modal';
    let modal = document.getElementById(modalId);
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">📊 Historial de Transacciones</h3>
                    <button class="close-modal" id="close-transactions-modal">&times;</button>
                </div>
                <div id="transactions-content">
                    <!-- Contenido dinámico -->
                </div>
                <div style="margin-top: 1.5rem; text-align: center;">
                    <button class="btn btn-outline" id="close-transactions-btn">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Event listeners para cerrar modal
        document.getElementById('close-transactions-modal').addEventListener('click', function() {
            modal.classList.remove('active');
        });
        
        document.getElementById('close-transactions-btn').addEventListener('click', function() {
            modal.classList.remove('active');
        });
        
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.classList.remove('active');
            }
        });
    }
    
    const content = document.getElementById('transactions-content');
    
    // Generar transacciones a partir de los datos de los sorteos
    const allTransactions = generateTransactionsFromRaffles();
    
    if (allTransactions.length === 0) {
        content.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📝</div>
                <h3 style="color: var(--secondary); margin-bottom: 1rem;">No hay transacciones</h3>
                <p>No se han realizado transacciones aún.</p>
            </div>
        `;
    } else {
        content.innerHTML = `
            <div class="transactions-grid">
                ${allTransactions.map(transaction => `
                    <div class="transaction-card">
                        <div class="transaction-header">
                            <div class="transaction-amount">
                                ${transaction.type === 'purchase' ? '🎫 Compra' : '🏆 Premio'} 
                                - ${transaction.amount ? transaction.amount.toFixed(4) + ' SOL' : 'N/A'}
                            </div>
                            <div class="transaction-date">
                                ${new Date(transaction.date).toLocaleDateString('es-ES')}
                            </div>
                        </div>
                        <div class="transaction-details">
                            <div><strong>Sorteo:</strong> ${sanitizeHTML(transaction.raffleName)}</div>
                            ${transaction.type === 'purchase' ? 
                                `<div><strong>Números:</strong> ${transaction.numbers.join(', ')}</div>` :
                                `<div><strong>Premio:</strong> ${sanitizeHTML(transaction.prize)}</div>`
                            }
                            <div><strong>Wallet:</strong> <span class="transaction-wallet">${transaction.userWallet.substring(0, 8)}...${transaction.userWallet.substring(transaction.userWallet.length - 4)}</span></div>
                            <div><strong>Estado:</strong> <span class="transaction-status-badge status-${transaction.status}">${transaction.status === 'confirmed' ? '✅ Confirmada' : (transaction.status === 'claimed' ? '🎉 Reclamado' : '⏳ Pendiente')}</span></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    modal.classList.add('active');
}

function generateTransactionsFromRaffles() {
    const transactions = [];
    
    raffles.forEach(raffle => {
        // Transacciones de compra
        if (raffle.numberOwners) {
            Object.entries(raffle.numberOwners).forEach(([number, wallet]) => {
                transactions.push({
                    type: 'purchase',
                    userWallet: wallet,
                    raffleId: raffle.id,
                    raffleName: raffle.name,
                    numbers: [parseInt(number)],
                    amount: raffle.price,
                    status: 'confirmed',
                    date: raffle.createdAt || new Date().toISOString()
                });
            });
        }
        
        // Transacciones de premios reclamados
        if (raffle.winner && raffle.prizeClaimed) {
            transactions.push({
                type: 'prize_claim',
                userWallet: raffle.winner.wallet,
                raffleId: raffle.id,
                raffleName: raffle.name,
                prize: raffle.prize,
                winningNumber: raffle.winner.number,
                status: 'claimed',
                date: raffle.claimDate || new Date().toISOString(),
                winnerInfo: raffle.winnerInfo || {}
            });
        }
    });
    
    // Ordenar por fecha (más reciente primero)
    return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// FUNCIONES AUXILIARES
function getShippingStatusText(status) {
    switch(status) {
        case 'pending': return 'Pendiente';
        case 'claimed': return 'Reclamado';
        case 'shipped': return 'Enviado';
        case 'delivered': return 'Entregado';
        default: return 'Pendiente';
    }
}

function generateRandomWallet() {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 44; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ✅ NUEVO: Inicializar módulo de ganadores
function initWinnersModule() {
    console.log('🎯 Módulo de ganadores inicializado');
    
    // Configurar validación en tiempo real
    setupRealTimeValidation();
    
    // Configurar filtros de admin
    setupWinnersAdminFilters();
    
    // Configurar botón de información de ganador
    setupWinnerInfoButton();
    
    // Configurar vista de transacciones
    setupTransactionsView();
}

// ✅ NUEVO: Función para limpiar formularios
function clearFormValidations() {
    document.querySelectorAll('.form-validation').forEach(validation => {
        validation.classList.remove('show');
    });
    document.querySelectorAll('.form-control').forEach(input => {
        input.classList.remove('error', 'success');
    });
}

// ✅ NUEVO: Mostrar estado de reclamo
function showClaimStatus(message, type = 'info') {
    const claimStatus = document.getElementById('claim-status');
    const claimDetails = document.getElementById('claim-details');

    if (claimStatus) {
        claimStatus.style.display = 'block';
        
        const sanitizedMessage = sanitizeHTML(message.replace(/\n/g, '<br>'));
        claimDetails.innerHTML = sanitizedMessage;
        
        claimStatus.className = `transaction-status ${type === 'success' ? 'transaction-success' : ''} ${type === 'error' ? 'transaction-error' : ''}`;
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        initWinnersModule();
    }, 500);
});

// Exportar funciones para uso global
window.openClaimPrizeModal = openClaimPrizeModal;
window.closeClaimPrizeModal = closeClaimPrizeModal;
window.submitPrizeClaim = submitPrizeClaim;
window.updateShippingStatus = updateShippingStatus;
window.closeShippingStatusModal = closeShippingStatusModal;
window.showWinnerInfoModal = showWinnerInfoModal;
window.showTransactionsModal = showTransactionsModal;
window.clearFormValidations = clearFormValidations;
window.validateClaimForm = validateClaimForm;
window.resetClaimForm = resetClaimForm;
