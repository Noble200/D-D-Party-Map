// ==========================================
// Vista de Admin en modo visualización
// Similar a PlayerView pero con controles de admin
// ==========================================

import { MapEditor } from '../core/MapEditor.js';
import { apiClient } from '../core/ApiClient.js';
import { socketClient } from '../core/SocketClient.js';
import { screenManager } from '../core/ScreenManager.js';
import { showNotification, copyToClipboard } from '../utils/helpers.js';

class AdminViewerView {
    constructor(app) {
        this.app = app;
        this.mapEditor = null;
        this.currentMapId = null;
        this.initialized = false;
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

        // Botón copiar código
        document.getElementById('btnCopyCodeViewer')?.addEventListener('click', () => {
            copyToClipboard(this.app.currentRoom.code);
            showNotification('Código copiado', 'success');
        });

        // Botón cambiar mapa
        document.getElementById('btnChangeMap')?.addEventListener('click', () => {
            this.openMapSelector();
        });

        // Botón editar mapa
        document.getElementById('btnEditMap')?.addEventListener('click', () => {
            this.goToEditor();
        });

        // Socket events
        socketClient.onUsersUpdated = (users) => this.updateUsersUI(users);
        socketClient.onMapChanged = () => this.reloadMap();
        socketClient.onActiveMapChanged = (data) => this.onMapSwitched(data);

        this.initialized = true;
    }

    async show(room) {
        // Mostrar info de sala
        document.getElementById('adminViewerRoomName').textContent = room.name;
        document.getElementById('adminViewerRoomCode').textContent = room.code;

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
            } else {
                // No hay mapa activo, verificar si hay mapas
                const mapsResult = await apiClient.getMaps(this.app.currentRoom.code);
                if (mapsResult.success && mapsResult.maps.length === 0) {
                    // No hay mapas, sugerir crear uno
                    showNotification('No hay mapas en esta sala. Crea uno desde "Editar Mapa".', 'info');
                }
            }
        } catch (error) {
            console.error('Error al cargar mapa activo:', error);
        }
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
        socketClient.leaveRoom();
        this.app.currentRoom = null;
        this.app.adminPassword = null;
        this.app.isAdmin = false;
        this.currentMapId = null;
        screenManager.show('home');
    }
}

export { AdminViewerView };
