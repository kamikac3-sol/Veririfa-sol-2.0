// Gestión de sorteos
let raffles = [];
let currentRaffle = null;
let selectedNumbers = [];
let currentPage = 1;
const numbersPerPage = 100;

// ✅ MEJORADO: Sistema de gestión de event listeners
const eventListeners = new Map();

function renderRaffles() {
    const container = document.getElementById('raffles-container');
    container.innerHTML = '';

    const activeRaffles = raffles.filter(raffle => !raffle.completed);
    
    if (activeRaffles.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--gray); padding: 3rem;">
                <h3>📝 No hay sorteos activos</h3>
                <p>Conecta tu wallet verificada para crear el primer sorteo</p>
            </div>
        `;
        return;
    }

    activeRaffles.forEach(raffle => {
        const raffleCard = document.createElement('div');
        raffleCard.className = 'raffle-card';
        
        const progress = raffle.soldNumbers.length;
        const total = raffle.totalNumbers;
        const progressPercent = total > 0 ? (progress / total) * 100 : 0;
        
        const isUserWinner = raffle.winner && currentWallet.publicKey && 
                            raffle.winner.wallet === currentWallet.publicKey.toString();
        
        let actionButton = '';
        
        // MEJORA: Verificar si todos los números están vendidos
        const allNumbersSold = raffle.soldNumbers.length >= raffle.totalNumbers;
        
        if (raffle.winner) {
            if (isUserWinner) {
                if (raffle.prizeClaimed) {
                    // MEJORA: Mostrar el estado actual de envío en lugar de "Premio Reclamado"
                    const shippingStatus = raffle.shippingStatus || 'pending';
                    const statusText = getShippingStatusText(shippingStatus);
                    let statusColor = 'var(--success)';
                    
                    switch(shippingStatus) {
                        case 'pending': statusColor = 'var(--warning)'; break;
                        case 'claimed': statusColor = 'var(--info)'; break;
                        case 'shipped': statusColor = 'var(--primary)'; break;
                        case 'delivered': statusColor = 'var(--success)'; break;
                    }
                    
                    actionButton = `
                        <button class="btn" style="width: 100%; background: ${statusColor}; cursor: not-allowed;" disabled>
                            ${shippingStatus === 'delivered' ? '✅' : '📦'} ${statusText}
                        </button>
                    `;
                } else {
                    actionButton = `
                        <button class="btn btn-success claim-prize-btn" data-raffle="${raffle.id}" style="width: 100%;">
                            🎉 Reclamar Premio
                        </button>
                    `;
                }
            } else {
                actionButton = `
                    <button class="btn" style="width: 100%; background: var(--gray); cursor: not-allowed;" disabled>
                        ❌ No Ganaste
                    </button>
                `;
            }
        } else if (raffle.isSelectingWinner) {
            actionButton = `
                <button class="btn" style="width: 100%; background: var(--warning); cursor: not-allowed;" disabled>
                    ⏳ Seleccionando Ganador...
                </button>
            `;
        } else {
            // ✅ CORREGIDO: Solo mostrar botones de administrador si el usuario ES administrador
            if (isAdmin) {
                if (allNumbersSold) {
                    actionButton = `
                        <button class="btn btn-warning select-winner-btn" data-raffle="${raffle.id}" style="width: 100%;">
                            🎰 Seleccionar Ganador
                        </button>
                    `;
                } else {
                    const remainingNumbers = raffle.totalNumbers - raffle.soldNumbers.length;
                    actionButton = `
                        <button class="btn btn-disabled" style="width: 100%;" disabled>
                            ⏳ Esperando venta (${remainingNumbers} números restantes)
                        </button>
                    `;
                }
            } else {
                // ✅ CORREGIDO: Para usuarios normales, verificar si hay números disponibles
                if (allNumbersSold) {
                    actionButton = `
                        <button class="btn btn-disabled" style="width: 100%;" disabled>
                            🔒 Todos los números vendidos
                        </button>
                    `;
                } else {
                    actionButton = `
                        <button class="btn participate-btn" data-raffle="${raffle.id}" style="width: 100%;">
                            🎫 Participar (${raffle.price} SOL)
                        </button>
                    `;
                }
            }
        }

        // ✅ MEJORADO: Sanitizar datos antes de usar en innerHTML
        const safeName = sanitizeHTML(raffle.name);
        const safeImage = sanitizeHTML(raffle.image);
        const safePrize = sanitizeHTML(raffle.prize);

        raffleCard.innerHTML = `
            <div class="raffle-image">
                ${raffle.image.startsWith('http') ? 
                    `<img src="${safeImage}" alt="${safeName}" onerror="this.parentElement.innerHTML='${raffle.image.includes('🎮') ? '🎮' : '🎁'}'">` : 
                    `<div style="font-size: 3rem;">${safeImage}</div>`
                }
            </div>
            <div class="raffle-content">
                <h3 class="raffle-title">${safeName}</h3>
                <div class="raffle-price">${raffle.price} SOL por número</div>
                <div class="raffle-info">
                    <span>🎯 Premio: ${safePrize}</span>
                    <span>🔢 ${progress}/${total} números</span>
                </div>
                <div class="progress-bar">
                    <div class="progress" style="width: ${progressPercent}%"></div>
                </div>
                <div class="raffle-info">
                    <span>🏆 Ganador: ${raffle.winner ? 'Sí' : 'No'}</span>
                    <span>${allNumbersSold ? '🔒 Completado' : '🟢 Disponible'}</span>
                </div>
                <div>
                    ${actionButton}
                </div>
            </div>
        `;

        container.appendChild(raffleCard);
    });

    // ✅ MEJORADO: Agregar event listeners de forma segura
    setupRaffleEventListeners();
}

// ✅ MEJORADO: Sistema de gestión de event listeners
function setupRaffleEventListeners() {
    // ✅ LIMPIAR listeners anteriores
    cleanupEventListeners();
    
    document.querySelectorAll('.participate-btn').forEach(btn => {
        const listener = function() {
            if (!currentWallet.publicKey) {
                showUserAlert('🔗 Conecta tu wallet primero para participar', 'warning');
                document.getElementById('wallet-modal').classList.add('active');
                return;
            }
            openNumberSelectionModal(this.getAttribute('data-raffle'));
        };
        
        btn.addEventListener('click', listener);
        eventListeners.set(btn, { type: 'click', listener });
    });

    document.querySelectorAll('.select-winner-btn').forEach(btn => {
        const listener = function() {
            selectWinner(this.getAttribute('data-raffle'));
        };
        
        btn.addEventListener('click', listener);
        eventListeners.set(btn, { type: 'click', listener });
    });

    document.querySelectorAll('.claim-prize-btn').forEach(btn => {
        const listener = function() {
            openClaimPrizeModal(this.getAttribute('data-raffle'));
        };
        
        btn.addEventListener('click', listener);
        eventListeners.set(btn, { type: 'click', listener });
    });
}

// ✅ NUEVO: Limpiar event listeners
function cleanupEventListeners() {
    eventListeners.forEach((info, element) => {
        element.removeEventListener(info.type, info.listener);
    });
    eventListeners.clear();
}

function updateClaimButtons() {
    if (!currentWallet.publicKey) return;

    const userWinnings = checkUserWinnings();

    document.querySelectorAll('.raffle-card').forEach(card => {
        const raffleId = card.querySelector('.participate-btn, .select-winner-btn, .claim-prize-btn')?.getAttribute('data-raffle');
        if (!raffleId) return;

        const raffle = raffles.find(r => r.id === raffleId);
        if (!raffle) return;

        const actionButtonContainer = card.querySelector('.raffle-content').querySelector('button').parentElement;
        
        // MEJORA: Verificar si todos los números están vendidos
        const allNumbersSold = raffle.soldNumbers.length >= raffle.totalNumbers;
        
        if (raffle.winner && raffle.winner.wallet === currentWallet.publicKey.toString()) {
            if (raffle.prizeClaimed) {
                // MEJORA: Mostrar el estado actual de envío en lugar de "Premio Reclamado"
                const shippingStatus = raffle.shippingStatus || 'pending';
                const statusText = getShippingStatusText(shippingStatus);
                let statusColor = 'var(--success)';
                
                switch(shippingStatus) {
                    case 'pending': statusColor = 'var(--warning)'; break;
                    case 'claimed': statusColor = 'var(--info)'; break;
                    case 'shipped': statusColor = 'var(--primary)'; break;
                    case 'delivered': statusColor = 'var(--success)'; break;
                }
                
                actionButtonContainer.innerHTML = `
                    <button class="btn" style="width: 100%; background: ${statusColor}; cursor: not-allowed;" disabled>
                        ${shippingStatus === 'delivered' ? '✅' : '📦'} ${statusText}
                    </button>
                `;
            } else {
                actionButtonContainer.innerHTML = `
                    <button class="btn btn-success claim-prize-btn" data-raffle="${raffle.id}" style="width: 100%;">
                        🎉 Reclamar Premio
                    </button>
                `;
            }
        } else if (raffle.winner) {
            actionButtonContainer.innerHTML = `
                <button class="btn" style="width: 100%; background: var(--gray); cursor: not-allowed;" disabled>
                    ❌ No Ganaste
                </button>
            `;
        } else if (raffle.isSelectingWinner) {
            actionButtonContainer.innerHTML = `
                <button class="btn" style="width: 100%; background: var(--warning); cursor: not-allowed;" disabled>
                    ⏳ Seleccionando Ganador...
                </button>
            `;
        } else {
            // ✅ CORREGIDO: Solo mostrar botones de administrador si el usuario ES administrador
            if (isAdmin) {
                if (allNumbersSold) {
                    actionButtonContainer.innerHTML = `
                        <button class="btn btn-warning select-winner-btn" data-raffle="${raffle.id}" style="width: 100%;">
                            🎰 Seleccionar Ganador
                        </button>
                    `;
                } else {
                    const remainingNumbers = raffle.totalNumbers - raffle.soldNumbers.length;
                    actionButtonContainer.innerHTML = `
                        <button class="btn btn-disabled" style="width: 100%;" disabled>
                            ⏳ Esperando venta (${remainingNumbers} números restantes)
                        </button>
                    `;
                }
            } else {
                // ✅ CORREGIDO: Para usuarios normales, verificar si hay números disponibles
                if (allNumbersSold) {
                    actionButtonContainer.innerHTML = `
                        <button class="btn btn-disabled" style="width: 100%;" disabled>
                            🔒 Todos los números vendidos
                        </button>
                    `;
                } else {
                    actionButtonContainer.innerHTML = `
                        <button class="btn participate-btn" data-raffle="${raffle.id}" style="width: 100%;">
                            🎫 Participar (${raffle.price} SOL)
                        </button>
                    `;
                }
            }
        }
    });

    // ✅ CORREGIDO: Re-configurar los event listeners después de actualizar los botones
    setupRaffleEventListeners();
}

function selectWinner(raffleId) {
    // ✅ MEJORADO: Usar validación robusta de admin
    if (!verifyAdminAccess()) return;

    const raffle = raffles.find(r => r.id === raffleId);
    if (!raffle) {
        showUserAlert('❌ Sorteo no encontrado', 'error');
        return;
    }

    // Verificar que se hayan vendido todos los números
    if (raffle.soldNumbers.length < raffle.totalNumbers) {
        const remainingNumbers = raffle.totalNumbers - raffle.soldNumbers.length;
        showUserAlert(`❌ No se pueden seleccionar ganadores hasta que se vendan todos los números. Faltan ${remainingNumbers} números.`, 'error');
        return;
    }

    if (raffle.soldNumbers.length === 0) {
        showUserAlert('❌ No hay números vendidos para este sorteo', 'error');
        return;
    }

    if (raffle.winner) {
        showUserAlert('ℹ️ Este sorteo ya tiene un ganador', 'info');
        return;
    }

    showUserAlert('🎰 Seleccionando ganador aleatoriamente...\n\n' +
                 `📊 Números vendidos: ${raffle.soldNumbers.length}\n` +
                 `👥 Compradores únicos: ${new Set(Object.values(raffle.numberOwners || {})).size}`, 'info');

    setTimeout(() => {
        // Selección aleatoria de entre los números vendidos
        const randomIndex = Math.floor(Math.random() * raffle.soldNumbers.length);
        const winningNumber = raffle.soldNumbers[randomIndex];
        
        // Usar el comprador real del número ganador
        const winnerWallet = raffle.numberOwners ? raffle.numberOwners[winningNumber] : generateRandomWallet();

        raffle.winner = {
            number: winningNumber,
            wallet: winnerWallet,
            date: new Date().toISOString()
        };

        // Marcar sorteo como completado
        raffle.completed = true;
        raffle.isSelectingWinner = false;

        // Guardar ganador en archivo
        const winnerData = {
            raffleId: raffle.id,
            raffleName: raffle.name,
            prize: raffle.prize,
            winningNumber: winningNumber,
            winnerWallet: winnerWallet,
            winnerDate: new Date().toISOString(),
            totalNumbers: raffle.totalNumbers,
            soldNumbers: raffle.soldNumbers.length,
            totalRevenue: raffle.soldNumbers.length * raffle.price
        };

        saveWinnerToFirebase(winnerData);
        winners.unshift(winnerData);

        // Guardar en Firebase
        saveRafflesToFirebase();
        renderRaffles();
        renderWinnersArchive();
        renderCompletedRaffles();
        loadWinnersAdminTable();
        updateClaimButtons();

        let winnerMessage = `🎉 ¡Ganador seleccionado aleatoriamente!\n\n`;
        winnerMessage += `• Número ganador: ${winningNumber}\n`;
        winnerMessage += `• Wallet ganadora: ${winnerWallet}\n`;
        winnerMessage += `• Premio: ${raffle.prize}\n`;
        winnerMessage += `• Método: Selección aleatoria entre números vendidos\n`;
        winnerMessage += `• Estado: Sorteo archivado en historial\n`;

        showUserAlert(winnerMessage, 'success');

        // Si el usuario actual es el ganador, mostrar notificación
        if (currentWallet.publicKey && winnerWallet === currentWallet.publicKey.toString()) {
            setTimeout(() => {
                showUserAlert(
                    '🎉 ¡FELICIDADES! ¡ERES EL GANADOR! 🎉\n\n' +
                    `Has ganado: ${raffle.prize}\n` +
                    `Tu número ganador: ${winningNumber}\n` +
                    'Haz clic en "Reclamar Premio" para continuar.',
                    'success',
                    10000
                );
            }, 2000);
        }

    }, 2000);
}

function openNumberSelectionModal(raffleId) {
    const raffle = raffles.find(r => r.id === raffleId);
    if (!raffle) return;

    currentRaffle = raffle;
    selectedNumbers = [];
    
    // ✅ MEJORADO: Usar estado de paginación específico por sorteo
    const raffleState = getPaginationState(raffleId);
    currentPage = raffleState.currentPage;

    document.getElementById('modal-raffle-name').textContent = raffle.name;
    document.getElementById('price-per-number').textContent = `${raffle.price} SOL`;
    
    updateUserBalance();
    renderNumbersGrid();
    updateSelectionUI();
    
    document.getElementById('number-selection-modal').classList.add('active');
}

function renderNumbersGrid() {
    const numbersGrid = document.getElementById('numbers-grid');
    const paginationControls = document.getElementById('pagination-controls');
    const pageInfo = document.getElementById('page-info');
    
    numbersGrid.innerHTML = '';
    
    // ✅ MEJORADO: Usar estado de paginación específico por sorteo
    const raffleState = getPaginationState(currentRaffle.id);
    const currentPage = raffleState.currentPage;
    
    const totalPages = Math.ceil(currentRaffle.totalNumbers / numbersPerPage);
    const startNumber = (currentPage - 1) * numbersPerPage + 1;
    const endNumber = Math.min(currentPage * numbersPerPage, currentRaffle.totalNumbers);
    
    // Renderizar números de la página actual
    for (let i = startNumber; i <= endNumber; i++) {
        const numberBtn = document.createElement('button');
        numberBtn.className = 'number-btn';
        numberBtn.textContent = i;
        numberBtn.setAttribute('data-number', i);
        
        if (currentRaffle.soldNumbers.includes(i)) {
            numberBtn.classList.add('sold');
            numberBtn.disabled = true;
        } else if (selectedNumbers.includes(i)) {
            numberBtn.classList.add('selected');
        }
        
        numberBtn.addEventListener('click', function() {
            toggleNumberSelection(i);
        });
        
        numbersGrid.appendChild(numberBtn);
    }
    
    // Renderizar controles de paginación
    paginationControls.innerHTML = '';
    
    if (currentPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.textContent = '← Anterior';
        prevBtn.addEventListener('click', function() {
            // ✅ MEJORADO: Actualizar estado específico del sorteo
            updatePaginationState(currentRaffle.id, { currentPage: currentPage - 1 });
            renderNumbersGrid();
        });
        paginationControls.appendChild(prevBtn);
    }
    
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', function() {
            // ✅ MEJORADO: Actualizar estado específico del sorteo
            updatePaginationState(currentRaffle.id, { currentPage: i });
            renderNumbersGrid();
        });
        paginationControls.appendChild(pageBtn);
    }
    
    if (currentPage < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.textContent = 'Siguiente →';
        nextBtn.addEventListener('click', function() {
            // ✅ MEJORADO: Actualizar estado específico del sorteo
            updatePaginationState(currentRaffle.id, { currentPage: currentPage + 1 });
            renderNumbersGrid();
        });
        paginationControls.appendChild(nextBtn);
    }
    
    pageInfo.textContent = `Página ${currentPage} de ${totalPages} - Números ${startNumber} a ${endNumber}`;
}

function toggleNumberSelection(number) {
    const index = selectedNumbers.indexOf(number);
    
    if (index > -1) {
        selectedNumbers.splice(index, 1);
    } else {
        selectedNumbers.push(number);
    }
    
    renderNumbersGrid();
    updateSelectionUI();
}

function updateSelectionUI() {
    const selectedCount = document.getElementById('selected-count');
    const totalPayment = document.getElementById('total-payment');
    const selectedNumbersList = document.getElementById('selected-numbers-list');
    
    selectedCount.textContent = selectedNumbers.length;
    totalPayment.textContent = `${(selectedNumbers.length * currentRaffle.price).toFixed(4)} SOL`;
    
    selectedNumbersList.innerHTML = '';
    
    selectedNumbers.sort((a, b) => a - b).forEach(number => {
        const numberTag = document.createElement('div');
        numberTag.className = 'selected-number-tag';
        numberTag.textContent = number;
        selectedNumbersList.appendChild(numberTag);
    });
    
    document.getElementById('confirm-payment-btn').disabled = selectedNumbers.length === 0;
}

function closeNumberSelectionModal() {
    document.getElementById('number-selection-modal').classList.remove('active');
    currentRaffle = null;
    selectedNumbers = [];
}

function setupImagePreview() {
    const imageInput = document.getElementById('raffle-image');
    const preview = document.getElementById('image-preview');
    
    imageInput.addEventListener('input', function() {
        const value = this.value.trim();
        
        if (value.startsWith('http')) {
            // ✅ MEJORADO: Sanitizar URL de imagen
            const safeValue = sanitizeHTML(value);
            preview.innerHTML = `<img src="${safeValue}" alt="Preview" onerror="this.style.display='none'; preview.innerHTML='❌ Error cargando imagen'">`;
        } else if (value) {
            // ✅ MEJORADO: Sanitizar emoji
            const safeValue = sanitizeHTML(value);
            preview.innerHTML = `<div class="emoji-preview">${safeValue}</div>`;
        } else {
            preview.innerHTML = '<div class="emoji-preview">🖼️</div>';
        }
    });
}

async function createRaffle(e) {
    e.preventDefault();
    
    // ✅ MEJORADO: Usar validación robusta de admin
    if (!verifyAdminAccess()) return;

    const name = document.getElementById('raffle-name').value.trim();
    const description = document.getElementById('raffle-description').value.trim();
    const price = parseFloat(document.getElementById('ticket-price').value);
    const maxNumbers = parseInt(document.getElementById('max-numbers').value);
    const image = document.getElementById('raffle-image').value.trim();

    if (!name || !description || !price || !maxNumbers || !image) {
        showUserAlert('❌ Por favor, completa todos los campos', 'error');
        return;
    }

    if (price < 0.01) {
        showUserAlert('❌ El precio debe ser al menos 0.01 SOL', 'error');
        return;
    }

    if (maxNumbers < 10) {
        showUserAlert('❌ Debe haber al menos 10 números', 'error');
        return;
    }

    showTransactionStatus('⏳ Creando sorteo verificado...', 'info');

    try {
        const raffleId = 'raffle-' + Date.now();
        
        const newRaffle = {
            id: raffleId,
            name: name,
            description: description,
            price: price,
            image: image,
            totalNumbers: maxNumbers,
            soldNumbers: [],
            numberOwners: {},
            prize: name.includes('-') ? name.split('-')[0].trim() : name,
            contractAddress: 'Testnet Contract',
            status: 'active',
            adminWallet: ADMIN_WALLET_ADDRESS,
            winner: null,
            prizeClaimed: false,
            isSelectingWinner: false,
            completed: false,
            shippingStatus: 'pending',
            createdAt: new Date().toISOString()
        };

        raffles.push(newRaffle);
        
        // Guardar en Firebase
        await saveRafflesToFirebase();
        
        // Limpiar formulario
        document.getElementById('create-raffle-form').reset();
        document.getElementById('image-preview').innerHTML = '<div class="emoji-preview">🖼️</div>';
        
        // Actualizar UI
        renderRaffles();
        
        showTransactionStatus(
            `✅ Sorteo creado exitosamente!\n\n` +
            `• Nombre: ${name}\n` +
            `• Precio: ${price} SOL\n` +
            `• Números: ${maxNumbers}\n` +
            `• Estado: Activo y verificado\n` +
            `• Wallet destino: ${ADMIN_WALLET_ADDRESS}`,
            'success'
        );
        
        showUserAlert('🎯 Sorteo verificado creado y guardado en Firebase', 'success');

    } catch (error) {
        console.error('Error creando sorteo:', error);
        showTransactionStatus(`❌ Error creando sorteo: ${error.message}`, 'error');
    }
}

async function processRealPayment() {
    if (!currentWallet.publicKey || !currentRaffle) {
        showUserAlert('❌ Error: Wallet no conectada o sorteo no seleccionado', 'error');
        return;
    }

    if (selectedNumbers.length === 0) {
        showUserAlert('❌ Selecciona al menos un número', 'error');
        return;
    }

    const totalAmount = selectedNumbers.length * currentRaffle.price;
    
    if (currentWallet.balance < totalAmount) {
        showUserAlert(`❌ Saldo insuficiente. Necesitas ${totalAmount.toFixed(4)} SOL`, 'error');
        return;
    }

    showPaymentStatus('⏳ Preparando transacción en Solana Testnet...', 'info');
    document.getElementById('confirm-payment-btn').disabled = true;

    try {
        // ✅ IMPORTANTE: VERIFICAR DISPONIBILIDAD ACTUALIZADA ANTES DE RESERVAR
        // Forzar actualización del sorteo actual primero
        const updatedRaffle = raffles.find(r => r.id === currentRaffle.id);
        if (updatedRaffle) {
            currentRaffle = updatedRaffle;
        }
        
        const unavailableNumbers = selectedNumbers.filter(num => 
            currentRaffle.soldNumbers.includes(num) || currentRaffle.numberOwners[num]
        );
        
        if (unavailableNumbers.length > 0) {
            throw new Error(`Los números ${unavailableNumbers.join(', ')} ya no están disponibles. Por favor, selecciona otros números.`);
        }

        // ✅ INTENTAR RESERVAR NÚMEROS CON TRANSACCIÓN ATÓMICA
        showPaymentStatus('🔒 Reservando números con transacción atómica...', 'info');
        
        const reservationSuccess = await reserveNumbersWithTransaction(
            currentRaffle.id, 
            selectedNumbers, 
            currentWallet.publicKey.toString()
        );
        
        if (!reservationSuccess) {
            throw new Error('No se pudieron reservar los números seleccionados. Puede que ya hayan sido vendidos.');
        }

        // ✅ CREAR TRANSACCIÓN EN BLOCKCHAIN
        const transaction = new solanaWeb3.Transaction();
        
        // Calcular lamports (1 SOL = 1,000,000,000 lamports)
        const lamports = Math.floor(totalAmount * solanaWeb3.LAMPORTS_PER_SOL);
        
        // Crear instrucción de transferencia
        const transferInstruction = solanaWeb3.SystemProgram.transfer({
            fromPubkey: currentWallet.publicKey,
            toPubkey: ADMIN_WALLET_PUBKEY,
            lamports: lamports
        });
        
        transaction.add(transferInstruction);
        
        // Obtener el último blockhash
        const { blockhash } = await connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = currentWallet.publicKey;
        
        showPaymentStatus('✅ Números reservados. Firmando transacción...', 'info');
        
        // Firmar transacción
        const signedTransaction = await currentWallet.provider.signTransaction(transaction);
        
        showPaymentStatus('📡 Enviando transacción a la blockchain...', 'info');
        
        // Enviar transacción
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());
        
        showPaymentStatus('⏳ Confirmando transacción en la blockchain...', 'info');
        
        // Confirmar transacción
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
            throw new Error('Transacción fallida en la blockchain: ' + confirmation.value.err);
        }
        
        // ✅ ACTUALIZAR DATOS LOCALES PARA CONSISTENCIA
        // Forzar actualización del sorteo después de la transacción exitosa
        await forceResync();
        
        // Actualizar balance del usuario
        await updateUserBalance();
        
        showPaymentStatus(
            `✅ ¡Pago verificado exitosamente!\n\n` +
            `• Transacción: ${signature.substring(0, 16)}...\n` +
            `• Números comprados: ${selectedNumbers.join(', ')}\n` +
            `• Total pagado: ${totalAmount.toFixed(4)} SOL\n` +
            `• Wallet destino: ${ADMIN_WALLET_ADDRESS.substring(0, 8)}...\n` +
            `• Estado: Confirmado en blockchain y Firebase`,
            'success'
        );
        
        // Cerrar modal después de éxito
        setTimeout(() => {
            closeNumberSelectionModal();
            // Los listeners en tiempo real actualizarán automáticamente
            showUserAlert(`🎉 ¡Compra verificada! Números: ${selectedNumbers.join(', ')}`, 'success');
        }, 3000);
        
    } catch (error) {
        console.error('Error procesando pago:', error);
        showPaymentStatus(`❌ Error en transacción: ${error.message}`, 'error');
        
        // ✅ IMPORTANTE: FORZAR ACTUALIZACIÓN DEL SORTEO ACTUAL
        // Recargar datos desde Firebase
        await forceResync();
        
        if (currentRaffle) {
            // Buscar el sorteo más reciente en el array global
            const updatedRaffle = raffles.find(r => r.id === currentRaffle.id);
            if (updatedRaffle) {
                currentRaffle = updatedRaffle;
                renderNumbersGrid();
                updateSelectionUI();
            }
        }
        
        // Mostrar alerta detallada al usuario
        showUserAlert(
            `⚠️ No se pudo completar la compra:\n\n` +
            `${error.message}\n\n` +
            `Los datos se han actualizado. Por favor, verifica la disponibilidad de los números antes de intentar nuevamente.`,
            'warning',
            10000
        );
        
        document.getElementById('confirm-payment-btn').disabled = false;
    }
}

function renderCompletedRaffles() {
    const completedRafflesList = document.getElementById('completed-raffles-list');
    completedRafflesList.innerHTML = '';

    const completedRaffles = raffles.filter(raffle => raffle.completed);
    
    if (completedRaffles.length === 0) {
        completedRafflesList.innerHTML = `
            <p style="color: var(--gray); text-align: center; padding: 1rem;">
                No hay sorteos terminados para gestionar
            </p>
        `;
        return;
    }

    completedRaffles.forEach(raffle => {
        const raffleItem = document.createElement('div');
        raffleItem.className = 'local-info';
        raffleItem.style.marginBottom = '1rem';
        
        const winnerDate = raffle.winner ? new Date(raffle.winner.date).toLocaleDateString('es-ES') : 'No disponible';
        const winnerWallet = raffle.winner ? `${raffle.winner.wallet.substring(0, 8)}...${raffle.winner.wallet.substring(raffle.winner.wallet.length - 4)}` : 'No disponible';

        // ✅ MEJORADO: Sanitizar datos
        const safeName = sanitizeHTML(raffle.name);
        const safePrize = sanitizeHTML(raffle.prize);

        raffleItem.innerHTML = `
            <h4>${safeName}</h4>
            <div style="display: grid; grid-template-columns: 1fr; gap: 0.5rem; margin: 1rem 0;">
                <div><strong>Premio:</strong> ${safePrize}</div>
                <div><strong>Ganador:</strong> ${winnerWallet}</div>
                <div><strong>Fecha:</strong> ${winnerDate}</div>
                <div><strong>Números vendidos:</strong> ${raffle.soldNumbers.length}</div>
                <div><strong>Recaudación:</strong> ${(raffle.soldNumbers.length * raffle.price).toFixed(2)} SOL</div>
            </div>
            <button class="btn btn-danger btn-small delete-raffle-btn" data-raffle="${raffle.id}">
                🗑️ Eliminar Sorteo
            </button>
        `;

        completedRafflesList.appendChild(raffleItem);
    });

    // Agregar event listeners para botones de eliminar
    document.querySelectorAll('.delete-raffle-btn').forEach(btn => {
        const listener = function() {
            const raffleId = this.getAttribute('data-raffle');
            deleteRaffle(raffleId);
        };
        
        btn.addEventListener('click', listener);
        eventListeners.set(btn, { type: 'click', listener });
    });
}

async function deleteRaffle(raffleId) {
    // ✅ MEJORADO: Usar validación robusta de admin
    if (!verifyAdminAccess()) return;

    const raffle = raffles.find(r => r.id === raffleId);
    if (!raffle) {
        showUserAlert('❌ Sorteo no encontrado', 'error');
        return;
    }

    if (!raffle.completed) {
        showUserAlert('❌ Solo se pueden eliminar sorteos terminados', 'error');
        return;
    }

    const confirmDelete = confirm(`¿Estás seguro de que quieres eliminar el sorteo "${raffle.name}"? Esta acción no se puede deshacer.`);
    
    if (!confirmDelete) return;

    try {
        // Eliminar de Firebase
        const success = await deleteRaffleFromFirebase(raffleId);
        
        if (success) {
            // Eliminar del array local
            raffles = raffles.filter(r => r.id !== raffleId);
            
            // Re-renderizar
            renderRaffles();
            renderCompletedRaffles();
            loadWinnersAdminTable();
            
            showUserAlert(`✅ Sorteo "${raffle.name}" eliminado correctamente`, 'success');
        } else {
            throw new Error('Error al eliminar de Firebase');
        }
    } catch (error) {
        console.error('Error eliminando sorteo:', error);
        showUserAlert(`❌ Error eliminando sorteo: ${error.message}`, 'error');
    }
}
