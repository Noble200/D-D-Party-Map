// ==========================================
// Vista de jugador - Solo visualización
// ==========================================

import { MapEditor } from '../core/MapEditor.js';
import { screenManager } from '../core/ScreenManager.js';
import { apiClient } from '../core/ApiClient.js';
import { socketClient } from '../core/SocketClient.js';
import { showNotification } from '../utils/helpers.js';

class PlayerView {
    constructor(app) {
        this.app = app;
        this.viewer = null;
        this.initialized = false;
        this.currentMapId = null;
    }

    // Inicializar la vista cuando se muestra
    init() {
        if (this.initialized) {
            this.viewer?.resizeCanvas();
            return;
        }

        // Crear visor de mapas (no editable)
        this.viewer = new MapEditor('playerMapCanvas', false);

        this.bindEvents();
        this.initialized = true;
    }

    bindEvents() {
        // Volver al menu de sala
        document.getElementById('btnBackFromPlayer')?.addEventListener('click', () => {
            screenManager.show('roomMenu');
        });

        // Abrir hoja de personaje
        document.getElementById('btnCharacterSheet')?.addEventListener('click', () => {
            this.openCharacterSheet();
        });

        // Socket events de tokens
        socketClient.onTokenUpdated = (data) => {
            this.viewer?.updateToken(data.token);
        };
        socketClient.onTokenAddedSync = (data) => {
            this.viewer?.addToken(data.token);
        };
        socketClient.onTokenRemovedSync = (data) => {
            this.viewer?.removeToken(data.tokenId);
        };
        socketClient.onTokenSelectedSync = (data) => {
            if (this.viewer) {
                this.viewer.selectedTokenId = data.tokenId;
                this.viewer.render();
            }
        };

        // Callback cuando el jugador mueve su token
        this.viewer.onTokenMoved = (token) => {
            socketClient.emitTokenMoved(this.currentMapId, token, this.app.playerName);
        };

        // Callback cuando se selecciona/deselecciona un token
        this.viewer.onTokenSelected = (tokenId) => {
            socketClient.emitTokenSelected(tokenId);
        };
    }

    // Actualizar UI con datos de la sala
    async updateUI() {
        const room = this.app.currentRoom;
        if (!room) return;

        document.getElementById('playerRoomName').textContent = room.name;

        // Conectar al socket con datos de usuario
        socketClient.onUsersUpdated = (users) => this.updateUsersUI(users);
        socketClient.onMapChanged = () => this.reloadMap();
        socketClient.onActiveMapChanged = () => this.reloadMap();

        // Obtener foto y color del token desde la hoja de personaje
        const tokenPhoto = this.app.characterSheet?.tokenPhoto || null;
        const tokenBorderColor = document.getElementById('tokenBorderColor')?.value || null;

        // Unirse con datos extendidos
        socketClient.joinRoom(
            room.code,
            'player',
            this.app.playerName,
            this.app.currentUser?.id,
            this.app.characterName,
            tokenPhoto,
            tokenBorderColor
        );

        // Cargar personaje del servidor
        await this.loadCharacter();
    }

    // Cargar personaje del servidor
    async loadCharacter() {
        if (!this.app.characterSheet) return;

        const character = await this.app.characterSheet.loadFromServer();

        if (character && character.characterData?.name) {
            // Sincronizar nombre del personaje desde la hoja guardada
            this.app.characterName = character.characterData.name;
        } else if (!character && this.app.characterName) {
            // Si no hay personaje guardado, usar el nombre ingresado en pre-join
            document.getElementById('charName').value = this.app.characterName;
        }
    }

    // Abrir modal de hoja de personaje
    openCharacterSheet() {
        if (this.app.characterSheet) {
            this.app.characterSheet.show();
        }
    }

    // Actualizar HUD de usuarios conectados
    updateUsersUI(users) {
        const countEl = document.getElementById('playerUsersHudCount');
        const listEl = document.getElementById('playerUsersHudList');

        if (countEl) countEl.textContent = users.total || 0;

        if (listEl) {
            let html = '';

            // Mostrar admins
            if (users.admins?.length > 0) {
                html += '<div class="users-hud-group">';
                html += '<span class="users-hud-group-label">Admin</span>';
                users.admins.forEach(admin => {
                    const name = typeof admin === 'object' ? admin.name : admin;
                    html += `<div class="users-hud-item"><span class="users-hud-dot admin"></span><span class="users-hud-name">${this.escapeHtml(name)}</span></div>`;
                });
                html += '</div>';
            }

            // Mostrar jugadores
            if (users.players?.length > 0) {
                html += '<div class="users-hud-group">';
                html += '<span class="users-hud-group-label">Jugadores</span>';
                users.players.forEach(player => {
                    const name = typeof player === 'object' ? player.name : player;
                    const charName = typeof player === 'object' ? player.characterName : null;
                    const displayName = charName ? `${charName} (${name})` : name;
                    html += `<div class="users-hud-item"><span class="users-hud-dot"></span><span class="users-hud-name">${this.escapeHtml(displayName)}</span></div>`;
                });
                html += '</div>';
            }

            if (!html) {
                html = '<div class="users-hud-empty">Sin usuarios</div>';
            }

            listEl.innerHTML = html;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // Recargar mapa cuando el admin lo actualiza o cambia el mapa activo
    async reloadMap() {
        const room = this.app.currentRoom;
        if (!room || !this.viewer) return;

        try {
            // Cargar mapa activo
            const result = await apiClient.getActiveMap(room.code);

            if (result.success && result.map) {
                const map = result.map;
                this.currentMapId = map.id;

                if (map.imageData) {
                    this.viewer.loadImageFromData(map.imageData);
                }

                if (map.imageTransform) {
                    const transform = typeof map.imageTransform === 'string'
                        ? JSON.parse(map.imageTransform)
                        : map.imageTransform;
                    this.viewer.imageTransform = { ...transform };
                }

                if (map.gridConfig) {
                    const gridConfig = typeof map.gridConfig === 'string'
                        ? JSON.parse(map.gridConfig)
                        : map.gridConfig;
                    this.viewer.gridConfig = { ...gridConfig };
                }

                this.viewer.render();

                // Cargar tokens
                await this.loadTokens();

                showNotification('Mapa actualizado', 'info');
            } else {
                // Fallback: cargar desde room (compatibilidad)
                const data = await apiClient.getRoom(room.code);
                if (data.success && data.room) {
                    this.viewer.loadState(
                        data.room.image_data,
                        data.room.image_transform,
                        data.room.grid_config
                    );
                }
            }
        } catch (error) {
            console.error('Error al recargar mapa:', error);
        }
    }

    // Cargar tokens del mapa activo
    async loadTokens() {
        if (!this.currentMapId) return;
        try {
            const result = await apiClient.getMapTokens(
                this.app.currentRoom.code,
                this.currentMapId
            );
            if (result.success) {
                this.viewer.setTokens(result.tokens || []);
                // El jugador solo puede mover su propio token
                const ownTokenId = `player_${this.app.playerName}`;
                this.viewer.enableTokens(false, ownTokenId);
            }
        } catch (error) {
            console.error('Error al cargar tokens:', error);
        }
    }

    // Cargar datos de la sala en el visor
    async loadRoomData() {
        const room = this.app.currentRoom;
        if (!room || !this.viewer) return;

        // Intentar cargar mapa activo primero
        try {
            const result = await apiClient.getActiveMap(room.code);

            if (result.success && result.map) {
                const map = result.map;
                this.currentMapId = map.id;

                if (map.imageData) {
                    this.viewer.loadImageFromData(map.imageData);
                }

                if (map.imageTransform) {
                    const transform = typeof map.imageTransform === 'string'
                        ? JSON.parse(map.imageTransform)
                        : map.imageTransform;
                    this.viewer.imageTransform = { ...transform };
                }

                if (map.gridConfig) {
                    const gridConfig = typeof map.gridConfig === 'string'
                        ? JSON.parse(map.gridConfig)
                        : map.gridConfig;
                    this.viewer.gridConfig = { ...gridConfig };
                }

                this.viewer.render();

                // Cargar tokens
                await this.loadTokens();
                return;
            }
        } catch (error) {
            console.error('Error al cargar mapa activo:', error);
        }

        // Fallback: cargar desde room
        this.viewer.loadState(
            room.image_data,
            room.image_transform,
            room.grid_config
        );
    }
}

export { PlayerView };
