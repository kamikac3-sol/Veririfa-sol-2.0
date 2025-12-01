// Gestión de ganadores
let winners = [];
let currentPrizeToClaim = null;
let currentShippingRaffle = null;

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

        winnerCard.innerHTML = `
            <div class="winner-header">
                <div class="winner-prize">${winner.prize}</div>
                <div class="winner-date">${winnerDate}</div>
            </div>
            <div class="winner-details">
                <div><strong>Sorteo:</strong> ${winner.raffleName}</div>
                <div><strong>Número ganador:</strong> ${winner.winningNumber}</div>
                <div><strong>Wallet:</strong> <span class="winner-wallet">${shortWallet}</span></div>
                ${winner.winnerInfo ? `<div><strong>Ganador:</strong> ${winner.winnerInfo.name}</div>` : ''}
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

function openClaimPrizeModal(raffleId) {
    const raffle = raffles.find(r => r.id === raffleId);
    if (!raffle || !raffle.winner) return;

    // Verificar que el usuario actual es el ganador
    if (currentWallet.publicKey.toString() !== raffle.winner.wallet) {
        showUserAlert('❌ No eres el ganador de este sorteo', 'error');
        return;
    }

    currentPrizeToClaim = raffle;

    document.getElementById('prize-name').textContent = `Premio: ${raffle.prize}`;
    document.getElementById('claim-raffle-name').textContent = raffle.name;
    document.getElementById('winning-number').textContent = raffle.winner.number;
    document.getElementById('winner-wallet').textContent =
        `${currentWallet.publicKey.toString().substring(0, 8)}...${currentWallet.publicKey.toString().substring(currentWallet.publicKey.toString().length - 4)}`;

    loadSavedContactInfo();

    document.getElementById('claim-prize-modal').classList.add('active');
}

function loadSavedContactInfo() {
    // Solo Firebase - no hay localStorage
    document.getElementById('winner-email').value = '';
    document.getElementById('winner-phone').value = '';
    document.getElementById('winner-name').value = '';
    document.getElementById('winner-address').value = '';
    
    // MEJORA: Limpiar validaciones
    clearFormValidations();
}

async function submitPrizeClaim() {
    // MEJORA: Validar formulario antes de enviar
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
    document.getElementById('submit-claim-btn').disabled = true;
    document.getElementById('submit-claim-btn').textContent = '⏳ Guardando...';

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

        // Guardar en Firebase en lugar de enviar email
        const saved = await saveClaimToFirebase(claimData);

        if (saved) {
            // Actualizar el sorteo local
            currentPrizeToClaim.prizeClaimed = true;
            currentPrizeToClaim.claimDate = new Date().toISOString();
            currentPrizeToClaim.winnerInfo = claimData.winnerInfo;
            currentPrizeToClaim.shippingStatus = 'claimed'; // MEJORA: Establecer estado inicial

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

            updateClaimButtons();
            renderRaffles();
            // Actualizar la tabla de ganadores en admin
            loadWinnersAdminTable();

            setTimeout(() => {
                closeClaimPrizeModal();
                document.getElementById('submit-claim-btn').disabled = false;
                document.getElementById('submit-claim-btn').textContent = '✅ Enviar Información y Reclamar Premio';
            }, 5000);

        } else {
            throw new Error('Error al guardar en Firebase');
        }

    } catch (error) {
        console.error('Error reclamando premio:', error);
        showClaimStatus(`❌ Error: ${error.message}`, 'error');
        document.getElementById('submit-claim-btn').disabled = false;
        document.getElementById('submit-claim-btn').textContent = '✅ Enviar Información y Reclamar Premio';
    }
}

function closeClaimPrizeModal() {
    document.getElementById('claim-prize-modal').classList.remove('active');
    currentPrizeToClaim = null;

    document.getElementById('submit-claim-btn').disabled = false;
    document.getElementById('submit-claim-btn').textContent = '✅ Enviar Información y Reclamar Premio';
    document.getElementById('claim-status').style.display = 'none';
    
    // MEJORA: Limpiar validaciones al cerrar
    clearFormValidations();
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
        winnersTable.style.display = 'none';
        noWinnersMessage.style.display = 'block';
        return;
    }
    
    // Aplicar filtros
    const searchTerm = document.getElementById('winner-search').value.toLowerCase();
    const statusFilter = document.getElementById('winner-status-filter').value;
    
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
        winnersTable.style.display = 'none';
        noWinnersMessage.innerHTML = `
            <h4>🔍 No se encontraron resultados</h4>
            <p>No hay ganadores que coincidan con los criterios de búsqueda</p>
        `;
        noWinnersMessage.style.display = 'block';
        return;
    }
    
    // Generar filas de la tabla
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
                <strong>${winnerInfo.name}</strong><br>
                <small style="color: var(--gray);">${shortWallet}</small>
            </td>
            <td class="winner-contact-info">
                <div>📧 ${winnerInfo.email}</div>
                <div>📞 ${winnerInfo.phone}</div>
                <div>🏠 ${winnerInfo.address.substring(0, 30)}...</div>
                ${winnerInfo.notes ? `<div>📝 ${winnerInfo.notes.substring(0, 30)}...</div>` : ''}
            </td>
            <td>${raffle.prize}</td>
            <td>${raffle.name}</td>
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
    
    winnersTable.style.display = 'table';
    noWinnersMessage.style.display = 'none';
    
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
                    <div><strong>Nombre:</strong> ${winnerInfo.name}</div>
                    <div><strong>Email:</strong> ${winnerInfo.email}</div>
                    <div><strong>Teléfono:</strong> ${winnerInfo.phone}</div>
                    <div><strong>Wallet:</strong> ${raffle.winner.wallet}</div>
                </div>
            </div>
            
            <div class="local-info">
                <h4>🏠 Dirección de Envío</h4>
                <p>${winnerInfo.address.replace(/\n/g, '<br>')}</p>
            </div>
            
            ${winnerInfo.notes ? `
            <div class="local-info">
                <h4>📝 Notas Adicionales</h4>
                <p>${winnerInfo.notes.replace(/\n/g, '<br>')}</p>
            </div>
            ` : ''}
            
            <div class="local-info">
                <h4>🎯 Información del Premio</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <div><strong>Sorteo:</strong> ${raffle.name}</div>
                    <div><strong>Premio:</strong> ${raffle.prize}</div>
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
    document.querySelector('.update-shipping-from-details').addEventListener('click', function() {
        const raffleId = this.getAttribute('data-raffle');
        modal.classList.remove('active');
        openShippingStatusModal(raffleId);
    });
    
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
    document.getElementById('winner-search').addEventListener('input', function() {
        loadWinnersAdminTable();
    });
    
    document.getElementById('winner-status-filter').addEventListener('change', function() {
        loadWinnersAdminTable();
    });
    
    document.getElementById('refresh-winners-btn').addEventListener('click', function() {
        loadWinnersAdminTable();
        showUserAlert('🔄 Lista de ganadores actualizada', 'info');
    });
}

// FUNCIÓN PARA EL BOTÓN "INFO GANADOR"
function setupWinnerInfoButton() {
    const winnerInfoBtn = document.getElementById('winner-info-btn');
    
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
                <h4>${raffle.name}</h4>
                <div style="display: grid; grid-template-columns: 1fr; gap: 0.5rem; margin: 1rem 0;">
                    <div><strong>Premio ganado:</strong> ${raffle.prize}</div>
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
                            ${raffle.winnerInfo ? `Contacto: ${raffle.winnerInfo.name} - ${raffle.winnerInfo.email}` : 'Datos de envío confirmados'}
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
    document.getElementById('view-transactions').addEventListener('click', function() {
        if (!isAdmin) {
            showUserAlert('❌ Solo el verificador puede ver las transacciones', 'error');
            return;
        }
        showTransactionsModal();
    });
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
                            <div><strong>Sorteo:</strong> ${transaction.raffleName}</div>
                            ${transaction.type === 'purchase' ? 
                                `<div><strong>Números:</strong> ${transaction.numbers.join(', ')}</div>` :
                                `<div><strong>Premio:</strong> ${transaction.prize}</div>`
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
