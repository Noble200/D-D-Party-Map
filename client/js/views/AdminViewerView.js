// ==========================================
// Vista de Admin en modo visualización
// Similar a PlayerView pero con controles de admin
// ==========================================

import { MapEditor } from '../core/MapEditor.js';
import { apiClient } from '../core/ApiClient.js';
import { socketClient } from '../core/SocketClient.js';
import { screenManager } from '../core/ScreenManager.js';
import { showNotification } from '../utils/helpers.js';

class AdminViewerView {
    constructor(app) {
        this.app = app;
        this.mapEditor = null;
        this.currentMapId = null;
        this.initialized = false;
        this.connectedPlayers = [];
    }

    init() {
        if (this.initialized) {
            this.mapEditor?.resizeCanvas();
            return;
        }

        // Crear editor de mapa (solo visualización)
        this.mapEditor = new MapEditor('adminViewerCanvas', false);

        // Botón volver
        document.getElementById('btnBackFromAdminViewer')?.addEventListener('click', () => {
            this.leaveRoom();
        });

        // Menu hamburguesa
        const menuBtn = document.getElementById('btnAdminMenu');
        const menuDropdown = document.getElementById('adminMenuDropdown');

        menuBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown?.classList.toggle('hidden');
        });

        // Cerrar menu al hacer click fuera
        document.addEventListener('click', () => {
            menuDropdown?.classList.add('hidden');
        });

        // Botón cambiar mapa
        document.getElementById('btnChangeMap')?.addEventListener('click', () => {
            menuDropdown?.classList.add('hidden');
            this.openMapSelector();
        });

        // Botón editar mapa
        document.getElementById('btnEditMap')?.addEventListener('click', () => {
            menuDropdown?.classList.add('hidden');
            this.goToEditor();
        });

        // Socket events
        socketClient.onUsersUpdated = (users) => this.onUsersUpdated(users);
        socketClient.onMapChanged = () => this.reloadMap();
        socketClient.onActiveMapChanged = (data) => this.onMapSwitched(data);

        // Socket events de tokens
        socketClient.onTokenUpdated = (data) => {
            this.mapEditor?.updateToken(data.token);
        };
        socketClient.onTokenAddedSync = (data) => {
            this.mapEditor?.addToken(data.token);
        };
        socketClient.onTokenRemovedSync = (data) => {
            this.mapEditor?.removeToken(data.tokenId);
        };
        socketClient.onTokenSelectedSync = (data) => {
            if (this.mapEditor) {
                this.mapEditor.selectedTokenId = data.tokenId;
                this.mapEditor.render();
            }
        };

        // Callback cuando el admin mueve un token
        this.mapEditor.onTokenMoved = (token) => {
            socketClient.emitTokenMoved(this.currentMapId, token, 'admin');
        };

        // Callback cuando se selecciona/deselecciona un token
        this.mapEditor.onTokenSelected = (tokenId) => {
            socketClient.emitTokenSelected(tokenId);
        };

        this.initialized = true;
    }

    async show(room) {
        // Mostrar nombre de sala
        document.getElementById('adminViewerRoomName').textContent = room.name;

        // Cargar mapa activo
        await this.loadActiveMap();

        // Conectar socket
        socketClient.joinRoom(room.code, 'admin');
    }

    async loadActiveMap() {
        try {
            const result = await apiClient.getActiveMap(this.app.currentRoom.code);

            if (result.success && result.map) {
                this.currentMapId = result.map.id;
                this.loadMapData(result.map);

                // Cargar tokens y habilitar sistema
                await this.loadTokens();
            } else {
                // No hay mapa activo, verificar si hay mapas
                const mapsResult = await apiClient.getMaps(this.app.currentRoom.code);
                if (mapsResult.success && mapsResult.maps.length === 0) {
                    showNotification('No hay mapas en esta sala. Crea uno desde "Editar Mapa".', 'info');
                }
            }
        } catch (error) {
            console.error('Error al cargar mapa activo:', error);
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
                this.mapEditor.setTokens(result.tokens || []);
                this.mapEditor.enableTokens(true); // Admin puede mover todos
            }
        } catch (error) {
            console.error('Error al cargar tokens:', error);
        }
    }

    // Agregar token para un jugador conectado
    addPlayerToken(playerName, characterName, tokenPhoto, tokenBorderColor) {
        if (!this.mapEditor || !this.currentMapId) return;

        const tokenId = `player_${playerName}`;

        // No duplicar si ya existe
        if (this.mapEditor.tokens.find(t => t.id === tokenId)) return;

        // Buscar posición: usar spawn point de jugador disponible, o celda libre
        const pos = this.findPlayerSpawnPosition();

        const color = tokenBorderColor || MapEditor.getTokenColor(this.mapEditor.tokens.length);

        const token = {
            id: tokenId,
            name: characterName || playerName,
            color: color,
            borderColor: color,
            photo: tokenPhoto || null,
            gridX: pos.gridX,
            gridY: pos.gridY,
            playerName: playerName
        };

        this.mapEditor.addToken(token);
        socketClient.emitTokenAdded(this.currentMapId, token);
    }

    // Buscar posición de spawn para un jugador
    findPlayerSpawnPosition() {
        const playerSpawns = this.mapEditor.getSpawnPointsByType('player');

        if (playerSpawns.length > 0) {
            // Buscar un spawn point libre (no ocupado por un token)
            for (const sp of playerSpawns) {
                if (!this.mapEditor.isCellOccupied(sp.gridX, sp.gridY)) {
                    return { gridX: sp.gridX, gridY: sp.gridY };
                }
            }
            // Todos ocupados: buscar celda libre cerca del último spawn point
            const lastSpawn = playerSpawns[playerSpawns.length - 1];
            return this.findFreeCell(lastSpawn.gridX, lastSpawn.gridY);
        }

        // Sin spawn points: buscar celda libre cerca del centro
        return this.findFreeCell(0, 0);
    }

    // Buscar celda libre cerca de una posición
    findFreeCell(startX, startY) {
        // Buscar en espiral desde el punto de inicio
        for (let radius = 0; radius < 20; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                    const gx = startX + dx;
                    const gy = startY + dy;
                    if (!this.mapEditor.isCellOccupied(gx, gy)) {
                        return { gridX: gx, gridY: gy };
                    }
                }
            }
        }
        return { gridX: startX, gridY: startY };
    }

    loadMapData(mapData) {
        if (mapData.imageData) {
            this.mapEditor.loadImageFromData(mapData.imageData);
        }

        // Aplicar transformaciones
        if (mapData.imageTransform) {
            const transform = typeof mapData.imageTransform === 'string'
                ? JSON.parse(mapData.imageTransform)
                : mapData.imageTransform;

            this.mapEditor.imageTransform = { ...transform };
        }

        // Aplicar configuración de grid
        if (mapData.gridConfig) {
            const gridConfig = typeof mapData.gridConfig === 'string'
                ? JSON.parse(mapData.gridConfig)
                : mapData.gridConfig;

            this.mapEditor.gridConfig = { ...gridConfig };
        }

        // Cargar spawn points (visibles para admin)
        if (mapData.spawnPoints) {
            const spawnPoints = typeof mapData.spawnPoints === 'string'
                ? JSON.parse(mapData.spawnPoints)
                : mapData.spawnPoints;
            this.mapEditor.spawnPoints = [...spawnPoints];
            this.mapEditor.showSpawnPoints = true;
        }

        this.mapEditor.render();
    }

    async reloadMap() {
        await this.loadActiveMap();
        showNotification('Mapa actualizado', 'info');
    }

    onMapSwitched(data) {
        // El admin mismo cambió el mapa, recargar
        if (data.mapId !== this.currentMapId) {
            this.currentMapId = data.mapId;
            this.reloadMap();
        }
    }

    // Cuando se actualiza la lista de usuarios, crear tokens para jugadores nuevos
    onUsersUpdated(users) {
        this.updateUsersUI(users);
        this.connectedPlayers = users.players || [];

        // Auto-crear tokens para jugadores conectados que no tengan token
        if (this.mapEditor?.tokensEnabled && this.currentMapId) {
            this.connectedPlayers.forEach(player => {
                const name = typeof player === 'object' ? player.name : player;
                const charName = typeof player === 'object' ? player.characterName : null;
                const photo = typeof player === 'object' ? player.tokenPhoto : null;
                const borderColor = typeof player === 'object' ? player.tokenBorderColor : null;
                this.addPlayerToken(name, charName, photo, borderColor);
            });
        }
    }

    updateUsersUI(users) {
        const countEl = document.getElementById('adminViewerUsersHudCount');
        const listEl = document.getElementById('adminViewerUsersHudList');

        countEl.textContent = users.total || 0;

        let html = '';

        // Admins
        if (users.admins && users.admins.length > 0) {
            users.admins.forEach(admin => {
                const name = typeof admin === 'object' ? admin.name : admin;
                html += `<div class="user-item admin"><span class="user-dot admin"></span>${this.escapeHtml(name)}</div>`;
            });
        }

        // Jugadores
        if (users.players && users.players.length > 0) {
            users.players.forEach(player => {
                const name = typeof player === 'object' ? player.name : player;
                const charName = typeof player === 'object' ? player.characterName : null;
                const displayName = charName ? `${charName} (${name})` : name;
                html += `<div class="user-item player"><span class="user-dot player"></span>${this.escapeHtml(displayName)}</div>`;
            });
        }

        listEl.innerHTML = html;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    openMapSelector() {
        // Disparar evento para que el componente MapSelector lo maneje
        if (this.app.mapSelector) {
            this.app.mapSelector.show();
        } else {
            showNotification('Selector de mapas no disponible', 'error');
        }
    }

    goToEditor() {
        // Ir al editor con el mapa actual
        this.app.adminEditorView.currentMapId = this.currentMapId;
        screenManager.show('adminEditor');
    }

    leaveRoom() {
        // Deshabilitar tokens al salir
        this.mapEditor?.disableTokens();
        // Volver al menu de sala, no al home
        screenManager.show('roomMenu');
    }
}

export { AdminViewerView };
