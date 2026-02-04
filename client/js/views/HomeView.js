// ==========================================
// Vista de inicio - Pantalla principal
// ==========================================

import { apiClient } from '../core/ApiClient.js';
import { screenManager } from '../core/ScreenManager.js';
import { showNotification } from '../utils/helpers.js';
import { getUserHash, setPlayerName, getPlayerName, setUserId } from '../utils/userIdentity.js';

class HomeView {
    constructor(app) {
        this.app = app;
        this.modals = {
            createRoom: document.getElementById('createRoomModal'),
            accessAdmin: document.getElementById('accessAdminModal'),
            accessRoomList: document.getElementById('accessRoomListModal')
        };
        this.bindEvents();
        this.restorePlayerName();
        this.loadActiveRooms();
    }

    // Restaurar nombre guardado del jugador
    restorePlayerName() {
        const savedName = getPlayerName();
        if (savedName) {
            const playerInput = document.getElementById('playerNameInput');
            if (playerInput) {
                playerInput.value = savedName;
            }
        }
    }

    bindEvents() {
        // Crear sala
        document.getElementById('btnCreateRoom')?.addEventListener('click', () => {
            this.showModal('createRoom');
        });

        // Acceder como admin
        document.getElementById('btnAccessAdmin')?.addEventListener('click', () => {
            this.showModal('accessAdmin');
        });

        // Unirse como jugador
        document.getElementById('btnJoinRoom')?.addEventListener('click', () => {
            this.joinAsPlayer();
        });

        // Enter en el input de código
        document.getElementById('roomCodeInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinAsPlayer();
        });

        // Modal crear sala
        document.getElementById('btnCancelCreate')?.addEventListener('click', () => {
            this.hideModal('createRoom');
        });
        document.getElementById('btnConfirmCreate')?.addEventListener('click', () => {
            this.createRoom();
        });

        // Modal acceder como admin
        document.getElementById('btnCancelAccess')?.addEventListener('click', () => {
            this.hideModal('accessAdmin');
        });
        document.getElementById('btnConfirmAccess')?.addEventListener('click', () => {
            this.accessAsAdmin();
        });

        // Modal acceder desde lista de salas
        document.getElementById('btnCancelAccessList')?.addEventListener('click', () => {
            this.hideModal('accessRoomList');
        });
        document.getElementById('btnConfirmAccessList')?.addEventListener('click', () => {
            this.accessFromRoomList();
        });

        // Cerrar modales con click fuera
        Object.values(this.modals).forEach(modal => {
            modal?.addEventListener('click', (e) => {
                if (e.target === modal) this.hideAllModals();
            });
        });
    }

    showModal(modalName) {
        this.modals[modalName]?.classList.add('active');
    }

    hideModal(modalName) {
        this.modals[modalName]?.classList.remove('active');
    }

    hideAllModals() {
        Object.values(this.modals).forEach(m => m?.classList.remove('active'));
    }

    // Crear nueva sala
    async createRoom() {
        const name = document.getElementById('roomName').value.trim();
        const password = document.getElementById('adminPassword').value;

        if (!name || !password) {
            showNotification('Completa todos los campos', 'error');
            return;
        }

        try {
            const data = await apiClient.createRoom(name, password);

            if (data.success) {
                this.app.setRoom(data.room, password, true);
                this.hideModal('createRoom');
                screenManager.show('roomMenu');
                showNotification(`Sala creada: ${data.room.code}`, 'success');

                // Limpiar formulario
                document.getElementById('roomName').value = '';
                document.getElementById('adminPassword').value = '';
            } else {
                showNotification(data.error, 'error');
            }
        } catch (error) {
            showNotification('Error de conexión con el servidor', 'error');
            console.error(error);
        }
    }

    // Acceder como admin
    async accessAsAdmin() {
        const code = document.getElementById('accessRoomCode').value.trim().toUpperCase();
        const password = document.getElementById('accessAdminPassword').value;

        if (!code || !password) {
            showNotification('Completa todos los campos', 'error');
            return;
        }

        try {
            const data = await apiClient.verifyAdmin(code, password);

            if (data.success) {
                this.app.setRoom(data.room, password, true);
                this.hideModal('accessAdmin');
                screenManager.show('roomMenu');
                showNotification('Acceso concedido', 'success');

                // Limpiar formulario
                document.getElementById('accessRoomCode').value = '';
                document.getElementById('accessAdminPassword').value = '';
            } else {
                showNotification(data.error, 'error');
            }
        } catch (error) {
            showNotification('Error de conexión con el servidor', 'error');
            console.error(error);
        }
    }

    // Cargar salas activas
    async loadActiveRooms() {
        const container = document.getElementById('activeRoomsList');
        if (!container) return;

        try {
            const data = await apiClient.getActiveRooms();

            if (data.success && data.rooms.length > 0) {
                container.innerHTML = data.rooms.map(room => `
                    <div class="room-card" data-code="${room.code}" data-name="${room.name}">
                        <div class="room-card-name">${room.name}</div>
                        <div class="room-card-date">${this.formatDate(room.created_at)}</div>
                    </div>
                `).join('');

                // Añadir eventos de clic a cada tarjeta
                container.querySelectorAll('.room-card').forEach(card => {
                    card.addEventListener('click', () => {
                        const code = card.dataset.code;
                        const name = card.dataset.name;
                        this.showAccessRoomListModal(code, name);
                    });
                });
            } else {
                container.innerHTML = '<p class="no-rooms">No hay salas activas</p>';
            }
        } catch (error) {
            console.error('Error cargando salas activas:', error);
            container.innerHTML = '<p class="no-rooms">Error al cargar salas</p>';
        }
    }

    // Formatear fecha
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short'
        });
    }

    // Mostrar modal de acceso desde lista
    showAccessRoomListModal(code, name) {
        document.getElementById('accessRoomListCode').value = code;
        document.getElementById('accessRoomListName').textContent = name;
        document.getElementById('accessRoomListPassword').value = '';
        this.showModal('accessRoomList');
    }

    // Acceder desde la lista de salas
    async accessFromRoomList() {
        const code = document.getElementById('accessRoomListCode').value;
        const password = document.getElementById('accessRoomListPassword').value;

        if (!password) {
            showNotification('Ingresa la contraseña', 'error');
            return;
        }

        try {
            const data = await apiClient.verifyAdmin(code, password);

            if (data.success) {
                this.app.setRoom(data.room, password, true);
                this.hideModal('accessRoomList');
                screenManager.show('roomMenu');
                showNotification('Acceso concedido', 'success');
            } else {
                showNotification(data.error || 'Contraseña incorrecta', 'error');
            }
        } catch (error) {
            showNotification('Error de conexión con el servidor', 'error');
            console.error(error);
        }
    }

    // Unirse como jugador
    async joinAsPlayer() {
        const characterName = document.getElementById('characterNameInput')?.value.trim() || '';
        const playerName = document.getElementById('playerNameInput').value.trim();
        const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();

        if (!characterName) {
            showNotification('Ingresa el nombre de tu personaje', 'error');
            return;
        }

        if (!playerName) {
            showNotification('Ingresa tu nombre real', 'error');
            return;
        }

        if (!code) {
            showNotification('Ingresa un código de sala', 'error');
            return;
        }

        try {
            // Verificar sala
            const data = await apiClient.getRoom(code);

            if (!data.success) {
                showNotification(data.error, 'error');
                return;
            }

            // Identificar usuario con hash persistente
            const userHash = getUserHash();
            const userResult = await apiClient.identifyUser(userHash, playerName);

            if (!userResult.success) {
                showNotification('Error al identificar usuario', 'error');
                return;
            }

            // Guardar datos del usuario
            setPlayerName(playerName);
            setUserId(userResult.user.id);

            this.app.currentUser = {
                id: userResult.user.id,
                hash: userHash,
                playerName: playerName
            };

            this.app.setRoom(data.room, null, false);
            this.app.playerName = playerName;
            this.app.characterName = characterName;

            screenManager.show('roomMenu');
            showNotification('Conectado a la sala', 'success');

            // Solo limpiar código, mantener nombres para conveniencia
            document.getElementById('roomCodeInput').value = '';
        } catch (error) {
            showNotification('Error de conexión con el servidor', 'error');
            console.error(error);
        }
    }
}

export { HomeView };
