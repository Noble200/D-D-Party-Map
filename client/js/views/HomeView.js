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
            accessAdmin: document.getElementById('accessAdminModal')
        };
        this.bindEvents();
        this.restorePlayerName();
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
                screenManager.show('adminViewer');
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
                screenManager.show('adminViewer');
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

            screenManager.show('player');
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
