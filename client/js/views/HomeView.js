// ==========================================
// Vista de inicio - Pantalla principal
// ==========================================

import { apiClient } from '../core/ApiClient.js';
import { screenManager } from '../core/ScreenManager.js';
import { showNotification } from '../utils/helpers.js';
import { setPlayerName, getPlayerName } from '../utils/userIdentity.js';
import { DiceRoller3D } from '../components/DiceRoller3D.js';
import {
    addDMRoom,
    addPlayerRoom,
    getDMRooms,
    getPlayerRooms,
    removeRoom,
    formatRelativeTime
} from '../utils/recentRooms.js';

class HomeView {
    constructor(app) {
        this.app = app;
        this.modals = {
            createRoom: document.getElementById('createRoomModal'),
            accessAdmin: document.getElementById('accessAdminModal'),
            testDice: document.getElementById('testDiceModal')
        };

        // Paneles de partidas recientes
        this.panels = {
            dm: document.getElementById('recentDMPanel'),
            player: document.getElementById('recentPlayerPanel')
        };

        // Dados de prueba
        this.testDiceRoller = null;

        this.bindEvents();
        this.restorePlayerName();
        this.renderRecentRooms();
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

    // Renderizar paneles de partidas recientes
    renderRecentRooms() {
        this.renderDMRooms();
        this.renderPlayerRooms();
    }

    // Renderizar partidas como DM
    renderDMRooms() {
        const rooms = getDMRooms();
        const panel = this.panels.dm;
        const list = document.getElementById('recentDMList');

        if (!panel || !list) return;

        if (rooms.length === 0) {
            panel.classList.add('hidden');
            return;
        }

        panel.classList.remove('hidden');
        list.innerHTML = rooms.map(room => `
            <li class="recent-room-item" data-code="${room.code}" data-role="dm">
                <button class="recent-room-remove" data-code="${room.code}" data-role="dm" title="Eliminar">x</button>
                <div class="recent-room-name">${this.escapeHtml(room.name)}</div>
                <div class="recent-room-meta">
                    <span class="recent-room-code">${room.code}</span>
                    <span class="recent-room-time">${formatRelativeTime(room.lastAccess)}</span>
                </div>
            </li>
        `).join('');

        this.bindRecentRoomEvents(list, 'dm');
    }

    // Renderizar partidas como jugador
    renderPlayerRooms() {
        const rooms = getPlayerRooms();
        const panel = this.panels.player;
        const list = document.getElementById('recentPlayerList');

        if (!panel || !list) return;

        if (rooms.length === 0) {
            panel.classList.add('hidden');
            return;
        }

        panel.classList.remove('hidden');
        list.innerHTML = rooms.map(room => `
            <li class="recent-room-item" data-code="${room.code}" data-role="player"
                data-player="${this.escapeHtml(room.playerName || '')}"
                data-character="${this.escapeHtml(room.characterName || '')}">
                <button class="recent-room-remove" data-code="${room.code}" data-role="player" title="Eliminar">x</button>
                <div class="recent-room-name">${this.escapeHtml(room.name)}</div>
                <div class="recent-room-meta">
                    <span class="recent-room-code">${room.code}</span>
                    <span class="recent-room-time">${formatRelativeTime(room.lastAccess)}</span>
                </div>
                ${room.characterName ? `<div class="recent-room-character">${this.escapeHtml(room.characterName)}</div>` : ''}
            </li>
        `).join('');

        this.bindRecentRoomEvents(list, 'player');
    }

    // Vincular eventos a items de partidas recientes
    bindRecentRoomEvents(list, role) {
        // Click en item para reconectar
        list.querySelectorAll('.recent-room-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('recent-room-remove')) return;
                const code = item.dataset.code;
                if (role === 'dm') {
                    this.quickJoinAsDM(code);
                } else {
                    const playerName = item.dataset.player;
                    const characterName = item.dataset.character;
                    this.quickJoinAsPlayer(code, playerName, characterName);
                }
            });
        });

        // Click en botón eliminar
        list.querySelectorAll('.recent-room-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const code = btn.dataset.code;
                const itemRole = btn.dataset.role;
                removeRoom(code, itemRole);
                this.renderRecentRooms();
            });
        });
    }

    // Reconexión rápida como DM
    async quickJoinAsDM(code) {
        const rooms = getDMRooms();
        const room = rooms.find(r => r.code === code);

        if (!room || !room.adminToken) {
            showNotification('Necesitas ingresar la contraseña nuevamente', 'warning');
            // Abrir modal con código pre-llenado
            document.getElementById('accessRoomCode').value = code;
            this.showModal('accessAdmin');
            return;
        }

        try {
            const data = await apiClient.verifyAdmin(code, room.adminToken);

            if (data.success) {
                // Actualizar timestamp
                addDMRoom(data.room, room.adminToken);
                this.app.setRoom(data.room, room.adminToken, true);
                screenManager.show('roomMenu');
                showNotification('Reconectado como DM', 'success');
            } else {
                // Token inválido, pedir contraseña
                showNotification('La contraseña ha cambiado', 'warning');
                document.getElementById('accessRoomCode').value = code;
                this.showModal('accessAdmin');
            }
        } catch (error) {
            showNotification('Error de conexión', 'error');
            console.error(error);
        }
    }

    // Reconexión rápida como jugador
    async quickJoinAsPlayer(code, playerName, characterName) {
        try {
            const data = await apiClient.getRoom(code);

            if (!data.success) {
                showNotification('La sala ya no existe', 'error');
                removeRoom(code, 'player');
                this.renderRecentRooms();
                return;
            }

            // Pre-llenar formulario y conectar
            if (playerName) {
                document.getElementById('playerNameInput').value = playerName;
                setPlayerName(playerName);
            }
            if (characterName) {
                document.getElementById('characterNameInput').value = characterName;
            }

            // Actualizar timestamp
            addPlayerRoom(data.room, playerName, characterName);

            this.app.currentUser = { playerName };
            this.app.setRoom(data.room, null, false);
            this.app.playerName = playerName;
            this.app.characterName = characterName;

            screenManager.show('roomMenu');
            showNotification('Reconectado a la sala', 'success');
        } catch (error) {
            showNotification('Error de conexión', 'error');
            console.error(error);
        }
    }

    // Escapar HTML para prevenir XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

        // === PRUEBA DE DADOS 3D ===
        document.getElementById('btnTestDice')?.addEventListener('click', () => {
            this.openTestDice();
        });

        document.getElementById('btnCloseTestDice')?.addEventListener('click', () => {
            this.closeTestDice();
        });

        // Botones para agregar dados de prueba
        document.querySelectorAll('.test-dice-add-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dice = e.target.dataset.dice;
                this.addTestDice(dice);
            });
        });

        // Limpiar dados de prueba
        document.getElementById('btnTestClearDice')?.addEventListener('click', () => {
            this.clearTestDice();
        });

        // Lanzar dados de prueba
        document.getElementById('btnTestRollDice')?.addEventListener('click', () => {
            this.rollTestDice();
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
                // Guardar en historial de partidas recientes
                addDMRoom(data.room, password);
                this.renderRecentRooms();

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
                // Guardar en historial de partidas recientes
                addDMRoom(data.room, password);
                this.renderRecentRooms();

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

    // ==========================================
    // PRUEBA DE DADOS 3D
    // ==========================================

    async openTestDice() {
        // Destruir instancia previa si existe
        if (this.testDiceRoller) {
            this.testDiceRoller.destroy();
        }

        // Crear nueva instancia
        this.testDiceRoller = new DiceRoller3D('testDice3dCanvas');

        // Callback cuando cambia la lista de dados
        this.testDiceRoller.onDiceListChanged = (selectedDice) => {
            this.renderTestSelectedDice(selectedDice);
            this.updateTestRollButton(selectedDice.length > 0);
        };

        // Callback cuando termina una tirada
        this.testDiceRoller.onRollComplete = (rollData) => {
            this.showTestDiceResult(rollData);
        };

        this.renderTestSelectedDice([]);
        this.updateTestRollButton(false);
        document.getElementById('testDiceResult')?.classList.add('hidden');

        // Mostrar modal primero
        this.showModal('testDice');

        // Esperar y luego inicializar
        await new Promise(resolve => setTimeout(resolve, 150));
        await this.testDiceRoller.init();
    }

    closeTestDice() {
        if (this.testDiceRoller) {
            this.testDiceRoller.destroy();
            this.testDiceRoller = null;
        }
        this.hideModal('testDice');
    }

    addTestDice(diceType) {
        if (this.testDiceRoller) {
            this.testDiceRoller.addDice(diceType);
        }
    }

    clearTestDice() {
        if (this.testDiceRoller) {
            this.testDiceRoller.clearDice();
            this.testDiceRoller.clear();
        }
        document.getElementById('testDiceResult')?.classList.add('hidden');
    }

    renderTestSelectedDice(selectedDice) {
        const container = document.getElementById('testDiceSelectedList');
        if (!container) return;

        if (selectedDice.length === 0) {
            container.innerHTML = '<span class="dice-empty-message">Haz click en los dados para agregarlos</span>';
            return;
        }

        container.innerHTML = selectedDice.map((die, index) => `
            <span class="dice-chip" data-index="${index}">
                ${die.type}
                <button class="dice-chip-remove" data-index="${index}">x</button>
            </span>
        `).join('');

        // Bind eventos para quitar dados
        container.querySelectorAll('.dice-chip-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(e.target.dataset.index);
                if (this.testDiceRoller) {
                    this.testDiceRoller.removeDice(index);
                }
            });
        });
    }

    updateTestRollButton(enabled) {
        const btn = document.getElementById('btnTestRollDice');
        if (btn) {
            btn.disabled = !enabled;
        }
    }

    async rollTestDice() {
        if (!this.testDiceRoller) return;

        this.updateTestRollButton(false);
        await this.testDiceRoller.roll();
    }

    showTestDiceResult(rollData) {
        const resultContainer = document.getElementById('testDiceResult');
        if (!resultContainer) return;

        resultContainer.classList.remove('hidden');

        const rollsStr = rollData.rolls.map(r => `${r.value}`).join(', ');

        resultContainer.querySelector('.dice-result-formula').textContent = rollData.notation;
        resultContainer.querySelector('.dice-result-rolls').textContent = `[${rollsStr}]`;
        resultContainer.querySelector('.dice-result-total').textContent = rollData.total;

        // Re-habilitar boton y limpiar dados
        if (this.testDiceRoller) {
            this.testDiceRoller.clearDice();
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

            // Guardar en historial de partidas recientes
            addPlayerRoom(data.room, playerName, characterName);
            this.renderRecentRooms();

            // Guardar nombre del jugador localmente para conveniencia
            setPlayerName(playerName);

            // Ya no necesitamos hash - el personaje se vincula por playerName + roomCode
            this.app.currentUser = {
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
