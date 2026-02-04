// ==========================================
// Vista de Menu de Sala - Menu principal para admin y jugadores
// ==========================================

import { apiClient } from '../core/ApiClient.js';
import { socketClient } from '../core/SocketClient.js';
import { screenManager } from '../core/ScreenManager.js';
import { showNotification } from '../utils/helpers.js';

class RoomMenuView {
    constructor(app) {
        this.app = app;
        this.initialized = false;
        this.selectedMapId = null;
        this.maps = [];
        this.npcs = [];
        this.editingNpcId = null;

        // Estado para notas de sesion
        this.notes = [];
        this.editingNoteId = null;
        this.currentNoteCategory = 'all';

        // Estado para dados
        this.diceHistory = [];

        // Estado para combate
        this.combatants = [];
        this.combatActive = false;
        this.currentTurn = 0;
        this.roundNumber = 1;

        // Estado para inventario
        this.inventory = {
            currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
            items: []
        };

        // Referencias a elementos DOM
        this.elements = {
            roomName: document.getElementById('roomMenuName'),
            roomCode: document.getElementById('roomMenuCode'),
            adminOptions: document.getElementById('adminMenuOptions'),
            playerOptions: document.getElementById('playerMenuOptions'),
            gameStatus: document.getElementById('gameStatusMessage'),
            usersCount: document.getElementById('roomMenuUsersCount'),
            usersList: document.getElementById('roomMenuUsersList')
        };

        // Modales
        this.modals = {
            mapsManager: document.getElementById('mapsManagerModal'),
            npcsManager: document.getElementById('npcsManagerModal'),
            npcForm: document.getElementById('npcFormModal'),
            playersList: document.getElementById('playersListModal'),
            startGame: document.getElementById('startGameModal'),
            mapForm: document.getElementById('mapFormModal'),
            sessionNotes: document.getElementById('sessionNotesModal'),
            noteForm: document.getElementById('noteFormModal'),
            diceRoller: document.getElementById('diceRollerModal'),
            combatTracker: document.getElementById('combatTrackerModal'),
            addCombatant: document.getElementById('addCombatantModal'),
            inventory: document.getElementById('inventoryModal')
        };
    }

    init() {
        if (this.initialized) return;
        this.bindEvents();
        this.initialized = true;
    }

    bindEvents() {
        // Boton salir
        document.getElementById('btnExitRoom')?.addEventListener('click', () => {
            this.exitRoom();
        });

        // Boton copiar codigo
        document.getElementById('btnCopyRoomCode')?.addEventListener('click', async () => {
            const code = document.getElementById('roomMenuCode')?.textContent;
            if (code) {
                try {
                    await navigator.clipboard.writeText(code);
                    showNotification('Codigo copiado', 'success');
                } catch (err) {
                    showNotification('Error al copiar', 'error');
                }
            }
        });

        // === Botones de Admin ===
        document.getElementById('btnManageMaps')?.addEventListener('click', () => {
            this.openMapsManager();
        });

        document.getElementById('btnManageNpcs')?.addEventListener('click', () => {
            this.openNpcsManager();
        });

        document.getElementById('btnStartGame')?.addEventListener('click', () => {
            this.openStartGameModal();
        });

        document.getElementById('btnViewPlayers')?.addEventListener('click', () => {
            this.openPlayersList();
        });

        // === Boton de Jugador ===
        document.getElementById('btnEditCharacter')?.addEventListener('click', () => {
            this.app.characterSheet?.open();
        });

        // === Modal Gestion de Mapas ===
        document.getElementById('btnCreateNewMap')?.addEventListener('click', () => {
            this.openMapForm();
        });

        document.getElementById('btnCloseMapsManager')?.addEventListener('click', () => {
            this.hideModal('mapsManager');
        });

        // === Modal Gestion de NPCs ===
        document.getElementById('btnCreateNewNpc')?.addEventListener('click', () => {
            this.openNpcForm();
        });

        document.getElementById('btnCloseNpcsManager')?.addEventListener('click', () => {
            this.hideModal('npcsManager');
        });

        // === Modal Formulario NPC ===
        document.getElementById('btnCancelNpcForm')?.addEventListener('click', () => {
            this.hideModal('npcForm');
        });

        document.getElementById('btnSaveNpcForm')?.addEventListener('click', () => {
            this.saveNpc();
        });

        // === Modal Lista de Jugadores ===
        document.getElementById('btnClosePlayersList')?.addEventListener('click', () => {
            this.hideModal('playersList');
        });

        // === Modal Iniciar Partida ===
        document.getElementById('btnCancelStartGame')?.addEventListener('click', () => {
            this.hideModal('startGame');
            this.selectedMapId = null;
        });

        document.getElementById('btnConfirmStartGame')?.addEventListener('click', () => {
            this.confirmStartGame();
        });

        // === Modal Formulario de Mapa (existente) ===
        document.getElementById('btnCancelMapForm')?.addEventListener('click', () => {
            this.hideModal('mapForm');
        });

        document.getElementById('btnSaveMapForm')?.addEventListener('click', () => {
            this.createMap();
        });

        // === NOTAS DE SESION ===
        document.getElementById('btnSessionNotes')?.addEventListener('click', () => {
            this.openSessionNotes();
        });

        document.getElementById('btnCloseSessionNotes')?.addEventListener('click', () => {
            this.hideModal('sessionNotes');
        });

        document.getElementById('btnNewNote')?.addEventListener('click', () => {
            this.openNoteForm();
        });

        // Filtros de categoria de notas
        document.querySelectorAll('.note-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.note-category-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentNoteCategory = e.target.dataset.category;
                this.renderNotesList();
            });
        });

        // Modal formulario de nota
        document.getElementById('btnCancelNoteForm')?.addEventListener('click', () => {
            this.hideModal('noteForm');
        });

        document.getElementById('btnSaveNoteForm')?.addEventListener('click', () => {
            this.saveNote();
        });

        // === TIRADOR DE DADOS ===
        document.getElementById('btnDiceRoller')?.addEventListener('click', () => {
            this.openDiceRoller();
        });

        document.getElementById('btnPlayerDice')?.addEventListener('click', () => {
            this.openDiceRoller();
        });

        document.getElementById('btnCloseDiceRoller')?.addEventListener('click', () => {
            this.hideModal('diceRoller');
        });

        // Botones de dados rapidos
        document.querySelectorAll('.dice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dice = e.target.dataset.dice;
                this.quickRoll(dice);
            });
        });

        document.getElementById('btnRollDice')?.addEventListener('click', () => {
            this.rollCustomDice();
        });

        // === TRACKER DE COMBATE ===
        document.getElementById('btnCombatTracker')?.addEventListener('click', () => {
            this.openCombatTracker();
        });

        document.getElementById('btnCloseCombatTracker')?.addEventListener('click', () => {
            this.hideModal('combatTracker');
        });

        document.getElementById('btnAddCombatant')?.addEventListener('click', () => {
            this.openAddCombatant();
        });

        document.getElementById('btnNextTurn')?.addEventListener('click', () => {
            this.nextTurn();
        });

        document.getElementById('btnStartCombat')?.addEventListener('click', () => {
            this.startCombat();
        });

        document.getElementById('btnEndCombat')?.addEventListener('click', () => {
            this.endCombat();
        });

        // Modal agregar combatiente
        document.getElementById('btnCancelAddCombatant')?.addEventListener('click', () => {
            this.hideModal('addCombatant');
        });

        document.getElementById('btnConfirmAddCombatant')?.addEventListener('click', () => {
            this.addCombatant();
        });

        // === INVENTARIO ===
        document.getElementById('btnPlayerInventory')?.addEventListener('click', () => {
            this.openInventory();
        });

        document.getElementById('btnCloseInventory')?.addEventListener('click', () => {
            this.hideModal('inventory');
        });

        document.getElementById('btnSaveInventory')?.addEventListener('click', () => {
            this.saveInventory();
        });

        document.getElementById('btnAddItem')?.addEventListener('click', () => {
            this.addItem();
        });

        // Cerrar modales con click fuera
        Object.values(this.modals).forEach(modal => {
            modal?.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideAllModals();
                }
            });
        });
    }

    // Mostrar la vista
    show(room) {
        this.updateUI(room);
        this.connectSocket();
        this.loadInitialData();
    }

    // Actualizar interfaz segun rol
    updateUI(room) {
        if (!room) return;

        this.elements.roomName.textContent = room.name;
        this.elements.roomCode.textContent = room.code;

        // Mostrar opciones segun rol
        if (this.app.isAdmin) {
            this.elements.adminOptions?.classList.remove('hidden');
            this.elements.playerOptions?.classList.add('hidden');
            this.elements.gameStatus?.classList.add('hidden');
        } else {
            this.elements.adminOptions?.classList.add('hidden');
            this.elements.playerOptions?.classList.remove('hidden');

            // Verificar si la partida esta activa
            if (room.gameStarted) {
                this.elements.gameStatus?.classList.add('hidden');
            } else {
                this.elements.gameStatus?.classList.remove('hidden');
            }
        }
    }

    // Conectar al socket
    connectSocket() {
        socketClient.connect();

        const userType = this.app.isAdmin ? 'admin' : 'player';
        const userName = this.app.isAdmin ? 'DM' : this.app.playerName;
        const userId = this.app.currentUser?.id || null;
        const characterName = this.app.characterName || null;

        socketClient.joinRoom(
            this.app.currentRoom.code,
            userType,
            userName,
            userId,
            characterName
        );

        // Escuchar actualizaciones de usuarios
        socketClient.onUsersUpdated = (users) => {
            this.updateUsersList(users);
        };

        // Escuchar cuando la partida inicia
        socketClient.onGameStarted = (data) => {
            this.onGameStarted(data);
        };

        // Escuchar tiradas de dados
        socketClient.onDiceRolled = (data) => {
            this.onDiceRolled(data);
        };

        // Escuchar actualizaciones de combate
        socketClient.onCombatUpdated = (data) => {
            this.onCombatUpdated(data);
        };

        // Escuchar cambio de turno
        socketClient.onCombatTurnChanged = (data) => {
            this.onCombatTurnChanged(data);
        };
    }

    // Cargar datos iniciales
    async loadInitialData() {
        if (this.app.isAdmin) {
            await this.loadMaps();
            await this.loadNpcs();
        }
    }

    // Cargar lista de mapas
    async loadMaps() {
        try {
            const result = await apiClient.getMaps(this.app.currentRoom.code);
            if (result.success) {
                this.maps = result.maps || [];
            }
        } catch (error) {
            console.error('Error cargando mapas:', error);
        }
    }

    // Cargar lista de NPCs
    async loadNpcs() {
        try {
            const result = await apiClient.getNpcs(this.app.currentRoom.code, this.app.adminPassword);
            if (result.success) {
                this.npcs = result.npcs || [];
            }
        } catch (error) {
            console.error('Error cargando NPCs:', error);
            this.npcs = [];
        }
    }

    // Actualizar lista de usuarios conectados
    updateUsersList(users) {
        const total = users.total || 0;
        this.elements.usersCount.textContent = total;

        let html = '';

        // Admins
        if (users.admins && users.admins.length > 0) {
            users.admins.forEach(admin => {
                html += `<div class="user-item user-admin">
                    <span class="user-role">DM</span>
                    <span class="user-name">${admin.userName || 'Admin'}</span>
                </div>`;
            });
        }

        // Jugadores
        if (users.players && users.players.length > 0) {
            users.players.forEach(player => {
                html += `<div class="user-item user-player">
                    <span class="user-character">${player.characterName || 'Sin personaje'}</span>
                    <span class="user-name">(${player.userName || 'Jugador'})</span>
                </div>`;
            });
        }

        if (!html) {
            html = '<div class="no-users">No hay usuarios conectados</div>';
        }

        this.elements.usersList.innerHTML = html;
    }

    // === GESTION DE MAPAS ===

    async openMapsManager() {
        await this.loadMaps();
        this.renderMapsList();
        this.showModal('mapsManager');
    }

    renderMapsList() {
        const container = document.getElementById('mapsManagerList');
        if (!container) return;

        if (this.maps.length === 0) {
            container.innerHTML = '<div class="empty-list">No hay mapas creados</div>';
            return;
        }

        container.innerHTML = this.maps.map(map => `
            <div class="map-card ${map.isActive ? 'active' : ''}" data-map-id="${map.id}">
                <div class="map-card-info">
                    <h4>${map.name}</h4>
                    ${map.isActive ? '<span class="active-badge">Activo</span>' : ''}
                </div>
                <div class="map-card-actions">
                    <button class="btn btn-small btn-edit-map" data-map-id="${map.id}">Editar</button>
                    <button class="btn btn-small btn-danger btn-delete-map" data-map-id="${map.id}">Eliminar</button>
                </div>
            </div>
        `).join('');

        // Bind eventos de editar
        container.querySelectorAll('.btn-edit-map').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mapId = e.target.dataset.mapId;
                this.editMap(mapId);
            });
        });

        // Bind eventos de eliminar
        container.querySelectorAll('.btn-delete-map').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mapId = e.target.dataset.mapId;
                this.deleteMap(mapId);
            });
        });
    }

    openMapForm() {
        document.getElementById('mapFormTitle').textContent = 'Nuevo Mapa';
        document.getElementById('mapNameInput').value = '';
        document.getElementById('squareSizeInput').value = '5';
        document.getElementById('distanceUnitInput').value = 'feet';
        this.showModal('mapForm');
    }

    async createMap() {
        const name = document.getElementById('mapNameInput').value.trim();
        const squareSize = parseInt(document.getElementById('squareSizeInput').value) || 5;
        const unit = document.getElementById('distanceUnitInput').value;

        if (!name) {
            showNotification('Ingresa un nombre para el mapa', 'error');
            return;
        }

        try {
            const distanceConfig = { squareSize, unit };
            const result = await apiClient.createMap(
                this.app.currentRoom.code,
                this.app.adminPassword,
                name,
                null,
                null,
                null,
                distanceConfig
            );

            if (result.success) {
                showNotification('Mapa creado', 'success');
                this.hideModal('mapForm');
                this.hideModal('mapsManager');
                // Navegar directamente al editor con el nuevo mapa
                this.app.adminEditorView.currentMapId = result.map.id;
                screenManager.show('adminEditor');
            } else {
                showNotification(result.error || 'Error al crear mapa', 'error');
            }
        } catch (error) {
            showNotification('Error de conexion', 'error');
            console.error(error);
        }
    }

    editMap(mapId) {
        // Guardar el ID del mapa actual y navegar al editor
        this.app.adminEditorView.currentMapId = mapId;
        this.hideAllModals();
        screenManager.show('adminEditor');
    }

    async deleteMap(mapId) {
        if (!confirm('Estas seguro de eliminar este mapa?')) return;

        try {
            const result = await apiClient.deleteMap(
                this.app.currentRoom.code,
                mapId,
                this.app.adminPassword
            );

            if (result.success) {
                showNotification('Mapa eliminado', 'success');
                await this.loadMaps();
                this.renderMapsList();
            } else {
                showNotification(result.error || 'Error al eliminar', 'error');
            }
        } catch (error) {
            showNotification('Error de conexion', 'error');
            console.error(error);
        }
    }

    // === GESTION DE NPCs ===

    async openNpcsManager() {
        await this.loadNpcs();
        this.renderNpcsList();
        this.showModal('npcsManager');
    }

    renderNpcsList() {
        const container = document.getElementById('npcsManagerList');
        if (!container) return;

        if (this.npcs.length === 0) {
            container.innerHTML = '<div class="empty-list">No hay NPCs creados</div>';
            return;
        }

        container.innerHTML = this.npcs.map(npc => `
            <div class="npc-card" data-npc-id="${npc.id}">
                <div class="npc-card-info">
                    <h4>${npc.name}</h4>
                    <span class="npc-type npc-type-${npc.type}">${this.getNpcTypeLabel(npc.type)}</span>
                    <p class="npc-desc">${npc.description || ''}</p>
                </div>
                <div class="npc-card-actions">
                    <button class="btn btn-small btn-edit-npc" data-npc-id="${npc.id}">Editar</button>
                    <button class="btn btn-small btn-danger btn-delete-npc" data-npc-id="${npc.id}">Eliminar</button>
                </div>
            </div>
        `).join('');

        // Bind eventos
        container.querySelectorAll('.btn-edit-npc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const npcId = e.target.dataset.npcId;
                this.openNpcForm(npcId);
            });
        });

        container.querySelectorAll('.btn-delete-npc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const npcId = e.target.dataset.npcId;
                this.deleteNpc(npcId);
            });
        });
    }

    getNpcTypeLabel(type) {
        const labels = {
            friendly: 'Amigable',
            neutral: 'Neutral',
            hostile: 'Hostil',
            merchant: 'Comerciante',
            quest: 'Quest Giver'
        };
        return labels[type] || type;
    }

    openNpcForm(npcId = null) {
        this.editingNpcId = npcId;

        if (npcId) {
            // Editar NPC existente
            const npc = this.npcs.find(n => n.id === npcId);
            if (npc) {
                document.getElementById('npcFormTitle').textContent = 'Editar NPC';
                document.getElementById('npcName').value = npc.name;
                document.getElementById('npcType').value = npc.type;
                document.getElementById('npcDescription').value = npc.description || '';
                document.getElementById('npcNotes').value = npc.notes || '';
            }
        } else {
            // Nuevo NPC
            document.getElementById('npcFormTitle').textContent = 'Nuevo NPC';
            document.getElementById('npcName').value = '';
            document.getElementById('npcType').value = 'friendly';
            document.getElementById('npcDescription').value = '';
            document.getElementById('npcNotes').value = '';
        }

        this.showModal('npcForm');
    }

    async saveNpc() {
        const name = document.getElementById('npcName').value.trim();
        const type = document.getElementById('npcType').value;
        const description = document.getElementById('npcDescription').value.trim();
        const notes = document.getElementById('npcNotes').value.trim();

        if (!name) {
            showNotification('Ingresa un nombre para el NPC', 'error');
            return;
        }

        try {
            let result;
            if (this.editingNpcId) {
                result = await apiClient.updateNpc(
                    this.app.currentRoom.code,
                    this.editingNpcId,
                    this.app.adminPassword,
                    { name, type, description, notes }
                );
            } else {
                result = await apiClient.createNpc(
                    this.app.currentRoom.code,
                    this.app.adminPassword,
                    { name, type, description, notes }
                );
            }

            if (result.success) {
                showNotification(this.editingNpcId ? 'NPC actualizado' : 'NPC creado', 'success');
                this.hideModal('npcForm');
                this.editingNpcId = null;
                await this.loadNpcs();
                this.renderNpcsList();
            } else {
                showNotification(result.error || 'Error al guardar NPC', 'error');
            }
        } catch (error) {
            showNotification('Error de conexion', 'error');
            console.error(error);
        }
    }

    async deleteNpc(npcId) {
        if (!confirm('Estas seguro de eliminar este NPC?')) return;

        try {
            const result = await apiClient.deleteNpc(
                this.app.currentRoom.code,
                npcId,
                this.app.adminPassword
            );

            if (result.success) {
                showNotification('NPC eliminado', 'success');
                await this.loadNpcs();
                this.renderNpcsList();
            } else {
                showNotification(result.error || 'Error al eliminar', 'error');
            }
        } catch (error) {
            showNotification('Error de conexion', 'error');
            console.error(error);
        }
    }

    // === LISTA DE JUGADORES ===

    async openPlayersList() {
        try {
            const result = await apiClient.getRoomPlayers(this.app.currentRoom.code, this.app.adminPassword);
            this.renderPlayersList(result.players || []);
            this.showModal('playersList');
        } catch (error) {
            showNotification('Error cargando jugadores', 'error');
            console.error(error);
        }
    }

    renderPlayersList(players) {
        const container = document.getElementById('playersListContent');
        if (!container) return;

        if (players.length === 0) {
            container.innerHTML = '<div class="empty-list">No hay jugadores registrados</div>';
            return;
        }

        container.innerHTML = players.map(player => `
            <div class="player-card">
                <div class="player-info">
                    <h4>${player.characterName || 'Sin personaje'}</h4>
                    <span class="player-real-name">${player.playerName || 'Desconocido'}</span>
                </div>
                <div class="player-stats">
                    <span class="player-class">${player.characterData?.class || '-'}</span>
                    <span class="player-level">Nv. ${player.characterData?.level || 1}</span>
                </div>
            </div>
        `).join('');
    }

    // === INICIAR PARTIDA ===

    async openStartGameModal() {
        await this.loadMaps();

        if (this.maps.length === 0) {
            showNotification('Crea al menos un mapa primero', 'error');
            return;
        }

        this.renderStartGameMapsList();
        this.showModal('startGame');
    }

    renderStartGameMapsList() {
        const container = document.getElementById('startGameMapsList');
        if (!container) return;

        container.innerHTML = this.maps.map(map => `
            <div class="start-game-map-option ${this.selectedMapId === map.id ? 'selected' : ''}" data-map-id="${map.id}">
                <span class="map-name">${map.name}</span>
            </div>
        `).join('');

        // Bind seleccion
        container.querySelectorAll('.start-game-map-option').forEach(option => {
            option.addEventListener('click', () => {
                // Deseleccionar todos
                container.querySelectorAll('.start-game-map-option').forEach(o => o.classList.remove('selected'));
                // Seleccionar este
                option.classList.add('selected');
                this.selectedMapId = option.dataset.mapId;
                // Habilitar boton
                document.getElementById('btnConfirmStartGame').disabled = false;
            });
        });
    }

    async confirmStartGame() {
        if (!this.selectedMapId) {
            showNotification('Selecciona un mapa', 'error');
            return;
        }

        try {
            // Activar el mapa seleccionado
            const result = await apiClient.activateMap(
                this.app.currentRoom.code,
                this.selectedMapId,
                this.app.adminPassword
            );

            if (result.success) {
                // Emitir evento de partida iniciada
                socketClient.emit('start-game', {
                    roomCode: this.app.currentRoom.code,
                    mapId: this.selectedMapId
                });

                this.hideModal('startGame');

                // Navegar a la vista de admin viewer
                screenManager.show('adminViewer');
                showNotification('Partida iniciada', 'success');
            } else {
                showNotification(result.error || 'Error al iniciar partida', 'error');
            }
        } catch (error) {
            showNotification('Error de conexion', 'error');
            console.error(error);
        }
    }

    // Cuando la partida inicia (para jugadores)
    onGameStarted(data) {
        if (!this.app.isAdmin) {
            showNotification('La partida ha comenzado!', 'success');
            screenManager.show('player');
        }
    }

    // ==========================================
    // NOTAS DE SESION
    // ==========================================

    async openSessionNotes() {
        await this.loadNotes();
        this.renderNotesList();
        this.showModal('sessionNotes');
    }

    async loadNotes() {
        try {
            const result = await apiClient.getSessionNotes(
                this.app.currentRoom.code,
                this.app.adminPassword
            );
            if (result.success) {
                this.notes = result.notes || [];
            }
        } catch (error) {
            console.error('Error cargando notas:', error);
            this.notes = [];
        }
    }

    renderNotesList() {
        const container = document.getElementById('sessionNotesList');
        if (!container) return;

        let filteredNotes = this.notes;
        if (this.currentNoteCategory !== 'all') {
            filteredNotes = this.notes.filter(n => n.category === this.currentNoteCategory);
        }

        if (filteredNotes.length === 0) {
            container.innerHTML = '<div class="empty-list">No hay notas</div>';
            return;
        }

        container.innerHTML = filteredNotes.map(note => `
            <div class="note-card" data-note-id="${note.id}">
                <div class="note-card-header">
                    <h4>${this.escapeHtml(note.title)}</h4>
                    <span class="note-category note-category-${note.category}">${this.getCategoryLabel(note.category)}</span>
                </div>
                <div class="note-card-content">${this.escapeHtml(note.content || '').substring(0, 150)}${(note.content || '').length > 150 ? '...' : ''}</div>
                <div class="note-card-actions">
                    <button class="btn btn-small btn-edit-note" data-note-id="${note.id}">Editar</button>
                    <button class="btn btn-small btn-danger btn-delete-note" data-note-id="${note.id}">Eliminar</button>
                </div>
            </div>
        `).join('');

        // Bind eventos
        container.querySelectorAll('.btn-edit-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.openNoteForm(e.target.dataset.noteId);
            });
        });

        container.querySelectorAll('.btn-delete-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteNote(e.target.dataset.noteId);
            });
        });
    }

    getCategoryLabel(category) {
        const labels = {
            general: 'General',
            plot: 'Trama',
            combat: 'Combate',
            loot: 'Tesoro'
        };
        return labels[category] || category;
    }

    openNoteForm(noteId = null) {
        this.editingNoteId = noteId;

        if (noteId) {
            const note = this.notes.find(n => n.id === noteId);
            if (note) {
                document.getElementById('noteFormTitle').textContent = 'Editar Nota';
                document.getElementById('noteTitle').value = note.title;
                document.getElementById('noteCategory').value = note.category;
                document.getElementById('noteContent').value = note.content || '';
            }
        } else {
            document.getElementById('noteFormTitle').textContent = 'Nueva Nota';
            document.getElementById('noteTitle').value = '';
            document.getElementById('noteCategory').value = 'general';
            document.getElementById('noteContent').value = '';
        }

        this.showModal('noteForm');
    }

    async saveNote() {
        const title = document.getElementById('noteTitle').value.trim();
        const category = document.getElementById('noteCategory').value;
        const content = document.getElementById('noteContent').value.trim();

        if (!title) {
            showNotification('Ingresa un titulo', 'error');
            return;
        }

        try {
            let result;
            if (this.editingNoteId) {
                result = await apiClient.updateSessionNote(
                    this.app.currentRoom.code,
                    this.editingNoteId,
                    this.app.adminPassword,
                    { title, content, category }
                );
            } else {
                result = await apiClient.createSessionNote(
                    this.app.currentRoom.code,
                    this.app.adminPassword,
                    { title, content, category }
                );
            }

            if (result.success) {
                showNotification(this.editingNoteId ? 'Nota actualizada' : 'Nota creada', 'success');
                this.hideModal('noteForm');
                this.editingNoteId = null;
                await this.loadNotes();
                this.renderNotesList();
            } else {
                showNotification(result.error || 'Error al guardar', 'error');
            }
        } catch (error) {
            showNotification('Error de conexion', 'error');
            console.error(error);
        }
    }

    async deleteNote(noteId) {
        if (!confirm('Eliminar esta nota?')) return;

        try {
            const result = await apiClient.deleteSessionNote(
                this.app.currentRoom.code,
                noteId,
                this.app.adminPassword
            );

            if (result.success) {
                showNotification('Nota eliminada', 'success');
                await this.loadNotes();
                this.renderNotesList();
            } else {
                showNotification(result.error || 'Error al eliminar', 'error');
            }
        } catch (error) {
            showNotification('Error de conexion', 'error');
            console.error(error);
        }
    }

    // ==========================================
    // TIRADOR DE DADOS
    // ==========================================

    async openDiceRoller() {
        await this.loadDiceHistory();
        this.renderDiceHistory();
        document.getElementById('diceResult')?.classList.add('hidden');
        this.showModal('diceRoller');
    }

    async loadDiceHistory() {
        try {
            const result = await apiClient.getDiceRollHistory(this.app.currentRoom.code, 20);
            if (result.success) {
                this.diceHistory = result.rolls || [];
            }
        } catch (error) {
            console.error('Error cargando historial de dados:', error);
            this.diceHistory = [];
        }
    }

    renderDiceHistory() {
        const container = document.getElementById('diceHistoryList');
        if (!container) return;

        if (this.diceHistory.length === 0) {
            container.innerHTML = '<div class="empty-list">Sin tiradas recientes</div>';
            return;
        }

        container.innerHTML = this.diceHistory.map(roll => `
            <div class="dice-history-item ${roll.rollType ? 'roll-type-' + roll.rollType : ''}">
                <span class="dice-history-user">${this.escapeHtml(roll.characterName || roll.userName)}</span>
                <span class="dice-history-formula">${roll.diceFormula}${roll.modifier ? (roll.modifier > 0 ? '+' : '') + roll.modifier : ''}</span>
                <span class="dice-history-total">${roll.total}</span>
            </div>
        `).join('');
    }

    quickRoll(dice) {
        const diceValue = parseInt(dice.replace('d', ''));
        this.performRoll(1, diceValue, 0, '');
    }

    rollCustomDice() {
        const count = parseInt(document.getElementById('diceCount').value) || 1;
        const type = parseInt(document.getElementById('diceType').value) || 20;
        const modifier = parseInt(document.getElementById('diceModifier').value) || 0;
        const rollType = document.getElementById('rollType').value;
        const isPrivate = document.getElementById('privateRoll').checked;

        this.performRoll(count, type, modifier, rollType, isPrivate);
    }

    performRoll(count, diceType, modifier, rollType, isPrivate = false) {
        // Generar tirada localmente
        const results = [];
        for (let i = 0; i < count; i++) {
            results.push(Math.floor(Math.random() * diceType) + 1);
        }
        const sum = results.reduce((a, b) => a + b, 0);
        const total = sum + modifier;

        // Mostrar resultado localmente
        this.showDiceResult(count, diceType, modifier, results, total, rollType);

        // Emitir por socket
        const userName = this.app.isAdmin ? 'DM' : this.app.playerName;
        const characterName = this.app.characterName || null;

        socketClient.emit('dice-roll', {
            roomCode: this.app.currentRoom.code,
            userName,
            characterName,
            rollType,
            diceFormula: `${count}d${diceType}`,
            results,
            modifier,
            total,
            isPrivate
        });
    }

    showDiceResult(count, diceType, modifier, results, total, rollType) {
        const resultContainer = document.getElementById('diceResult');
        if (!resultContainer) return;

        resultContainer.classList.remove('hidden');

        const formula = `${count}d${diceType}${modifier ? (modifier > 0 ? '+' : '') + modifier : ''}`;
        resultContainer.querySelector('.dice-result-formula').textContent = formula;
        resultContainer.querySelector('.dice-result-rolls').textContent = `[${results.join(', ')}]${modifier ? ` ${modifier > 0 ? '+' : ''}${modifier}` : ''}`;
        resultContainer.querySelector('.dice-result-total').textContent = total;

        // Animacion
        resultContainer.classList.add('dice-result-animate');
        setTimeout(() => resultContainer.classList.remove('dice-result-animate'), 500);
    }

    onDiceRolled(data) {
        // Agregar al historial local
        this.diceHistory.unshift(data);
        if (this.diceHistory.length > 20) this.diceHistory.pop();

        // Si el modal esta abierto, actualizar
        if (this.modals.diceRoller?.classList.contains('active')) {
            this.renderDiceHistory();
        }

        // Mostrar notificacion
        const name = data.characterName || data.userName;
        showNotification(`${name} tiro ${data.diceFormula}: ${data.total}`, 'info');
    }

    // ==========================================
    // TRACKER DE COMBATE
    // ==========================================

    async openCombatTracker() {
        await this.loadCombatTracker();
        this.renderCombatTracker();
        this.showModal('combatTracker');
    }

    async loadCombatTracker() {
        try {
            const result = await apiClient.getCombatTracker(this.app.currentRoom.code);
            if (result.success && result.tracker) {
                this.combatants = result.tracker.combatants || [];
                this.combatActive = result.tracker.isActive || false;
                this.currentTurn = result.tracker.currentTurn || 0;
                this.roundNumber = result.tracker.roundNumber || 1;
            }
        } catch (error) {
            console.error('Error cargando combat tracker:', error);
        }
    }

    renderCombatTracker() {
        // Actualizar info de combate
        document.getElementById('combatRound').textContent = this.roundNumber;

        const statusEl = document.getElementById('combatStatus');
        if (statusEl) {
            statusEl.textContent = this.combatActive ? 'En curso' : 'Inactivo';
            statusEl.className = `combat-status ${this.combatActive ? 'active' : ''}`;
        }

        // Mostrar/ocultar controles de admin
        const adminControls = document.getElementById('combatAdminControls');
        if (adminControls) {
            if (this.app.isAdmin) {
                adminControls.classList.remove('hidden');
            } else {
                adminControls.classList.add('hidden');
            }
        }

        // Renderizar lista de combatientes
        const container = document.getElementById('combatantsList');
        if (!container) return;

        if (this.combatants.length === 0) {
            container.innerHTML = '<div class="empty-list">No hay combatientes</div>';
            return;
        }

        // Ordenar por iniciativa (mayor primero)
        const sorted = [...this.combatants].sort((a, b) => b.initiative - a.initiative);

        container.innerHTML = sorted.map((c, index) => `
            <div class="combatant-card ${c.type} ${this.combatActive && index === this.currentTurn ? 'current-turn' : ''}" data-combatant-id="${c.id}">
                <div class="combatant-initiative">${c.initiative}</div>
                <div class="combatant-info">
                    <span class="combatant-name">${this.escapeHtml(c.name)}</span>
                    <span class="combatant-type">${this.getCombatantTypeLabel(c.type)}</span>
                </div>
                ${c.hp !== null && c.hp !== undefined ? `
                <div class="combatant-hp">
                    <span class="hp-current">${c.currentHp || c.hp}</span>/<span class="hp-max">${c.hp}</span>
                </div>
                ` : ''}
                ${this.app.isAdmin ? `
                <div class="combatant-actions">
                    <button class="btn btn-tiny btn-damage" data-id="${c.id}" title="Dano">-</button>
                    <button class="btn btn-tiny btn-heal" data-id="${c.id}" title="Curar">+</button>
                    <button class="btn btn-tiny btn-danger btn-remove" data-id="${c.id}" title="Quitar">x</button>
                </div>
                ` : ''}
            </div>
        `).join('');

        // Bind eventos para admin
        if (this.app.isAdmin) {
            container.querySelectorAll('.btn-damage').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.modifyHP(e.target.dataset.id, -1);
                });
            });
            container.querySelectorAll('.btn-heal').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.modifyHP(e.target.dataset.id, 1);
                });
            });
            container.querySelectorAll('.btn-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.removeCombatant(e.target.dataset.id);
                });
            });
        }
    }

    getCombatantTypeLabel(type) {
        const labels = {
            player: 'Jugador',
            npc: 'NPC',
            enemy: 'Enemigo'
        };
        return labels[type] || type;
    }

    openAddCombatant() {
        document.getElementById('combatantName').value = '';
        document.getElementById('combatantInitiative').value = '10';
        document.getElementById('combatantType').value = 'enemy';
        document.getElementById('combatantHP').value = '';
        this.showModal('addCombatant');
    }

    addCombatant() {
        const name = document.getElementById('combatantName').value.trim();
        const initiative = parseInt(document.getElementById('combatantInitiative').value) || 10;
        const type = document.getElementById('combatantType').value;
        const hp = document.getElementById('combatantHP').value ? parseInt(document.getElementById('combatantHP').value) : null;

        if (!name) {
            showNotification('Ingresa un nombre', 'error');
            return;
        }

        const newCombatant = {
            id: Date.now().toString(),
            name,
            initiative,
            type,
            hp,
            currentHp: hp
        };

        this.combatants.push(newCombatant);
        this.hideModal('addCombatant');
        this.saveCombatTracker();
    }

    removeCombatant(id) {
        this.combatants = this.combatants.filter(c => c.id !== id);
        this.saveCombatTracker();
    }

    modifyHP(id, amount) {
        const combatant = this.combatants.find(c => c.id === id);
        if (combatant && combatant.hp !== null) {
            const delta = prompt(`Cantidad de ${amount > 0 ? 'curacion' : 'dano'}:`, '1');
            if (delta) {
                const value = parseInt(delta) * Math.sign(amount);
                combatant.currentHp = Math.max(0, Math.min(combatant.hp, (combatant.currentHp || combatant.hp) + value));
                this.saveCombatTracker();
            }
        }
    }

    startCombat() {
        if (this.combatants.length === 0) {
            showNotification('Agrega combatientes primero', 'error');
            return;
        }
        this.combatActive = true;
        this.currentTurn = 0;
        this.roundNumber = 1;
        this.saveCombatTracker();
        showNotification('Combate iniciado!', 'success');
    }

    nextTurn() {
        if (!this.combatActive) return;

        this.currentTurn++;
        if (this.currentTurn >= this.combatants.length) {
            this.currentTurn = 0;
            this.roundNumber++;
        }
        this.saveCombatTracker();

        // Emitir evento de cambio de turno
        socketClient.emit('combat-turn', {
            roomCode: this.app.currentRoom.code,
            currentTurn: this.currentTurn,
            roundNumber: this.roundNumber
        });
    }

    endCombat() {
        this.combatActive = false;
        this.currentTurn = 0;
        this.roundNumber = 1;
        this.saveCombatTracker();
        showNotification('Combate terminado', 'info');
    }

    async saveCombatTracker() {
        try {
            const result = await apiClient.updateCombatTracker(
                this.app.currentRoom.code,
                this.app.adminPassword,
                {
                    isActive: this.combatActive,
                    currentTurn: this.currentTurn,
                    roundNumber: this.roundNumber,
                    combatants: this.combatants
                }
            );

            if (result.success) {
                this.renderCombatTracker();

                // Emitir actualizacion por socket
                socketClient.emit('combat-update', {
                    roomCode: this.app.currentRoom.code,
                    tracker: {
                        isActive: this.combatActive,
                        currentTurn: this.currentTurn,
                        roundNumber: this.roundNumber,
                        combatants: this.combatants
                    }
                });
            }
        } catch (error) {
            console.error('Error guardando combat tracker:', error);
        }
    }

    onCombatUpdated(data) {
        if (data.tracker) {
            this.combatants = data.tracker.combatants || [];
            this.combatActive = data.tracker.isActive || false;
            this.currentTurn = data.tracker.currentTurn || 0;
            this.roundNumber = data.tracker.roundNumber || 1;

            if (this.modals.combatTracker?.classList.contains('active')) {
                this.renderCombatTracker();
            }
        }
    }

    onCombatTurnChanged(data) {
        this.currentTurn = data.currentTurn;
        this.roundNumber = data.roundNumber;

        if (this.modals.combatTracker?.classList.contains('active')) {
            this.renderCombatTracker();
        }
    }

    // ==========================================
    // INVENTARIO
    // ==========================================

    async openInventory() {
        await this.loadInventory();
        this.renderInventory();
        this.showModal('inventory');
    }

    async loadInventory() {
        // Cargar inventario desde los datos del personaje
        const characterData = this.app.characterData || {};
        this.inventory = characterData.inventory || {
            currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
            items: []
        };

        // Actualizar campos de monedas
        document.getElementById('currencyPP').value = this.inventory.currency?.pp || 0;
        document.getElementById('currencyGP').value = this.inventory.currency?.gp || 0;
        document.getElementById('currencyEP').value = this.inventory.currency?.ep || 0;
        document.getElementById('currencySP').value = this.inventory.currency?.sp || 0;
        document.getElementById('currencyCP').value = this.inventory.currency?.cp || 0;
    }

    renderInventory() {
        const container = document.getElementById('inventoryItemsList');
        if (!container) return;

        if (!this.inventory.items || this.inventory.items.length === 0) {
            container.innerHTML = '<div class="empty-list">Sin objetos</div>';
            return;
        }

        container.innerHTML = this.inventory.items.map((item, index) => `
            <div class="inventory-item" data-index="${index}">
                <span class="item-qty">${item.quantity || 1}x</span>
                <span class="item-name">${this.escapeHtml(item.name)}</span>
                <button class="btn btn-tiny btn-danger btn-remove-item" data-index="${index}">x</button>
            </div>
        `).join('');

        // Bind eventos
        container.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.removeItem(parseInt(e.target.dataset.index));
            });
        });
    }

    addItem() {
        const name = document.getElementById('newItemName').value.trim();
        const quantity = parseInt(document.getElementById('newItemQty').value) || 1;

        if (!name) {
            showNotification('Ingresa el nombre del objeto', 'error');
            return;
        }

        if (!this.inventory.items) {
            this.inventory.items = [];
        }

        // Verificar si ya existe el item
        const existing = this.inventory.items.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            existing.quantity = (existing.quantity || 1) + quantity;
        } else {
            this.inventory.items.push({ name, quantity });
        }

        document.getElementById('newItemName').value = '';
        document.getElementById('newItemQty').value = '1';

        this.renderInventory();
    }

    removeItem(index) {
        if (this.inventory.items && this.inventory.items[index]) {
            this.inventory.items.splice(index, 1);
            this.renderInventory();
        }
    }

    async saveInventory() {
        // Actualizar monedas desde los inputs
        this.inventory.currency = {
            pp: parseInt(document.getElementById('currencyPP').value) || 0,
            gp: parseInt(document.getElementById('currencyGP').value) || 0,
            ep: parseInt(document.getElementById('currencyEP').value) || 0,
            sp: parseInt(document.getElementById('currencySP').value) || 0,
            cp: parseInt(document.getElementById('currencyCP').value) || 0
        };

        // Guardar en characterData
        if (!this.app.characterData) {
            this.app.characterData = {};
        }
        this.app.characterData.inventory = this.inventory;

        // Guardar en el servidor
        try {
            if (this.app.currentUser?.id) {
                const result = await apiClient.saveCharacter(
                    this.app.currentRoom.code,
                    this.app.currentUser.id,
                    this.app.characterName,
                    this.app.characterData
                );

                if (result.success) {
                    showNotification('Inventario guardado', 'success');
                    this.hideModal('inventory');
                } else {
                    showNotification(result.error || 'Error al guardar', 'error');
                }
            } else {
                showNotification('Inventario guardado localmente', 'success');
                this.hideModal('inventory');
            }
        } catch (error) {
            showNotification('Error de conexion', 'error');
            console.error(error);
        }
    }

    // Metodo helper para escapar HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // === UTILIDADES ===

    showModal(modalName) {
        this.modals[modalName]?.classList.add('active');
    }

    hideModal(modalName) {
        this.modals[modalName]?.classList.remove('active');
    }

    hideAllModals() {
        Object.values(this.modals).forEach(m => m?.classList.remove('active'));
    }

    exitRoom() {
        socketClient.leaveRoom();
        this.app.clearRoom();
        screenManager.show('home');
    }
}

export { RoomMenuView };
