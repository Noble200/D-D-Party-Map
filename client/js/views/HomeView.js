// ==========================================
// Vista de inicio - Pantalla principal
// ==========================================

import { apiClient } from '../core/ApiClient.js';
import { screenManager } from '../core/ScreenManager.js';
import { showNotification } from '../utils/helpers.js';
import { setPlayerName, getPlayerName } from '../utils/userIdentity.js';
import { DiceRoller3D } from '../components/DiceRoller3D.js';

class HomeView {
    constructor(app) {
        this.app = app;
        this.modals = {
            createRoom: document.getElementById('createRoomModal'),
            accessAdmin: document.getElementById('accessAdminModal'),
            testDice: document.getElementById('testDiceModal')
        };

        // Dados de prueba
        this.testDiceRoller = null;

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
