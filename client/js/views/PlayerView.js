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
        // Volver al inicio
        document.getElementById('btnBackFromPlayer')?.addEventListener('click', () => {
            socketClient.leaveRoom();
            this.app.clearRoom();
            screenManager.show('home');
        });
    }

    // Actualizar UI con datos de la sala
    updateUI() {
        const room = this.app.currentRoom;
        if (!room) return;

        document.getElementById('playerRoomName').textContent = room.name;
        document.getElementById('playerRoomCode').textContent = room.code;

        // Conectar al socket y unirse a la sala con el nombre del jugador
        socketClient.onUsersUpdated = (users) => this.updateUsersUI(users);
        socketClient.onMapChanged = () => this.reloadMap();
        socketClient.joinRoom(room.code, 'player', this.app.playerName);
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
                users.admins.forEach(name => {
                    html += `<div class="users-hud-item"><span class="users-hud-dot admin"></span><span class="users-hud-name">${name}</span></div>`;
                });
                html += '</div>';
            }

            // Mostrar jugadores
            if (users.players?.length > 0) {
                html += '<div class="users-hud-group">';
                html += '<span class="users-hud-group-label">Jugadores</span>';
                users.players.forEach(name => {
                    html += `<div class="users-hud-item"><span class="users-hud-dot"></span><span class="users-hud-name">${name}</span></div>`;
                });
                html += '</div>';
            }

            if (!html) {
                html = '<div class="users-hud-empty">Sin usuarios</div>';
            }

            listEl.innerHTML = html;
        }
    }

    // Recargar mapa cuando el admin lo actualiza
    async reloadMap() {
        const room = this.app.currentRoom;
        if (!room || !this.viewer) return;

        try {
            const data = await apiClient.getRoom(room.code);
            if (data.success && data.room) {
                this.viewer.loadState(
                    data.room.image_data,
                    data.room.image_transform,
                    data.room.grid_config
                );
                showNotification('Mapa actualizado', 'info');
            }
        } catch (error) {
            console.error('Error al recargar mapa:', error);
        }
    }

    // Cargar datos de la sala en el visor
    loadRoomData() {
        const room = this.app.currentRoom;
        if (!room || !this.viewer) return;

        this.viewer.loadState(
            room.image_data,
            room.image_transform,
            room.grid_config
        );
    }
}

export { PlayerView };
