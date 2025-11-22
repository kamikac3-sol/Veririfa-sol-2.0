// Gestión de sorteos
let raffles = [];
let currentRaffle = null;
let selectedNumbers = [];
let currentPage = 1;
const numbersPerPage = 100;

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

        raffleCard.innerHTML = `
            <div class="raffle-image">
                ${raffle.image.startsWith('http') ? 
                    `<img src="${raffle.image}" alt="${raffle.name}" onerror="this.parentElement.innerHTML='${raffle.image.includes('🎮') ? '🎮' : '🎁'}'">` : 
                    `<div style="font-size: 3rem;">${raffle.image}</div>`
                }
            </div>
            <div class="raffle-content">
                <h3 class="raffle-title">${raffle.name}</h3>
                <div class="raffle-price">${raffle.price} SOL por número</div>
                <div class="raffle-info">
                    <span>🎯 Premio: ${raffle.prize}</span>
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

    // ✅ CORREGIDO: Agregar event listeners para todos los botones
    setupRaffleEventListeners();
}

function setupRaffleEventListeners() {
    document.querySelectorAll('.participate-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (!currentWallet.publicKey) {
                showUserAlert('🔗 Conecta tu wallet primero para participar', 'warning');
                document.getElementById('wallet-modal').classList.add('active');
                return;
            }
            openNumberSelectionModal(this.getAttribute('data-raffle'));
        });
    });

    document.querySelectorAll('.select-winner-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            selectWinner(this.getAttribute('data-raffle'));
        });
    });

    document.querySelectorAll('.claim-prize-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            openClaimPrizeModal(this.getAttribute('data-raffle'));
        });
    });
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
    const raffle = raffles.find(r => r.id === raffleId);
    if (!raffle) {
        showUserAlert('❌ Sorteo no encontrado', 'error');
        return;
    }

    if (!isAdmin) {
        showUserAlert('❌ Solo el verificador puede realizar sorteos', 'error');
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
    currentPage = 1;

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
            currentPage--;
            renderNumbersGrid();
        });
        paginationControls.appendChild(prevBtn);
    }
    
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', function() {
            currentPage = i;
            renderNumbersGrid();
        });
        paginationControls.appendChild(pageBtn);
    }
    
    if (currentPage < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.textContent = 'Siguiente →';
        nextBtn.addEventListener('click', function() {
            currentPage++;
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
            preview.innerHTML = `<img src="${value}" alt="Preview" onerror="this.style.display='none'; preview.innerHTML='❌ Error cargando imagen'">`;
        } else if (value) {
            preview.innerHTML = `<div class="emoji-preview">${value}</div>`;
        } else {
            preview.innerHTML = '<div class="emoji-preview">🖼️</div>';
        }
    });
}

async function createRaffle(e) {
    e.preventDefault();
    
    if (!isAdmin) {
        showUserAlert('❌ Solo el verificador puede crear sorteos', 'error');
        return;
    }

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

        raffleItem.innerHTML = `
            <h4>${raffle.name}</h4>
            <div style="display: grid; grid-template-columns: 1fr; gap: 0.5rem; margin: 1rem 0;">
                <div><strong>Premio:</strong> ${raffle.prize}</div>
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
        btn.addEventListener('click', function() {
            const raffleId = this.getAttribute('data-raffle');
            deleteRaffle(raffleId);
        });
    });
}

async function deleteRaffle(raffleId) {
    if (!isAdmin) {
        showUserAlert('❌ Solo los administradores pueden eliminar sorteos', 'error');
        return;
    }

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