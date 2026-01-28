// ==========================================
// Vista de Editor de Mapas (Admin)
// ==========================================

import { MapEditor } from '../core/MapEditor.js';
import { screenManager } from '../core/ScreenManager.js';
import { apiClient } from '../core/ApiClient.js';
import { socketClient } from '../core/SocketClient.js';
import { DEFAULT_DISTANCE_CONFIG } from '../config.js';
import { showNotification, copyToClipboard } from '../utils/helpers.js';

class AdminEditorView {
    constructor(app) {
        this.app = app;
        this.editor = null;
        this.initialized = false;
        this.currentMapId = null;
        this.currentMapName = '';
    }

    // Inicializar la vista cuando se muestra
    init() {
        if (this.initialized) {
            this.editor?.resizeCanvas();
            return;
        }

        // Crear editor de mapas
        this.editor = new MapEditor('adminMapCanvas', true);

        // Callback para actualizar UI cuando cambia el zoom con la rueda
        this.editor.onScaleChange = (value) => {
            const scaleInput = document.getElementById('imageScale');
            const scaleValue = document.getElementById('scaleValue');
            if (scaleInput) scaleInput.value = value;
            if (scaleValue) scaleValue.textContent = value;
        };

        this.bindEvents();
        this.initialized = true;
    }

    bindEvents() {
        // Volver a la vista de admin (no al home)
        document.getElementById('btnBackFromAdmin')?.addEventListener('click', () => {
            screenManager.show('adminViewer');
        });

        // Copiar código
        document.getElementById('btnCopyCode')?.addEventListener('click', async () => {
            const code = document.getElementById('adminRoomCode')?.textContent;
            if (code && await copyToClipboard(code)) {
                showNotification('Código copiado', 'success');
            }
        });

        // Guardar cambios
        document.getElementById('btnSaveRoom')?.addEventListener('click', () => {
            this.saveMap();
        });

        // Cargar imagen
        document.getElementById('imageInput')?.addEventListener('change', (e) => {
            this.editor?.loadImage(e);
        });

        // Controles de imagen
        document.getElementById('imageScale')?.addEventListener('input', (e) => {
            this.editor?.setImageScale(e.target.value);
            document.getElementById('scaleValue').textContent = e.target.value;
        });

        document.getElementById('imageRotation')?.addEventListener('input', (e) => {
            this.editor?.setImageRotation(e.target.value);
            document.getElementById('rotationValue').textContent = e.target.value;
        });

        document.getElementById('resetImage')?.addEventListener('click', () => {
            this.editor?.resetImage();
            this.updateImageControls();
        });

        // Controles de cuadrícula
        document.getElementById('gridSize')?.addEventListener('input', (e) => {
            this.editor?.setGridSize(e.target.value);
            document.getElementById('gridSizeValue').textContent = e.target.value;
        });

        document.getElementById('gridOpacity')?.addEventListener('input', (e) => {
            this.editor?.setGridOpacity(e.target.value);
            document.getElementById('gridOpacityValue').textContent = e.target.value;
        });

        document.getElementById('gridColor')?.addEventListener('input', (e) => {
            this.editor?.setGridColor(e.target.value);
        });

        document.getElementById('gridLineWidth')?.addEventListener('input', (e) => {
            this.editor?.setGridLineWidth(e.target.value);
            document.getElementById('gridLineWidthValue').textContent = e.target.value;
        });

        document.getElementById('showGrid')?.addEventListener('change', (e) => {
            this.editor?.toggleGrid(e.target.checked);
        });

        document.getElementById('gridOffsetX')?.addEventListener('input', (e) => {
            this.editor?.setGridOffsetX(e.target.value);
            document.getElementById('gridOffsetXValue').textContent = e.target.value;
        });

        document.getElementById('gridOffsetY')?.addEventListener('input', (e) => {
            this.editor?.setGridOffsetY(e.target.value);
            document.getElementById('gridOffsetYValue').textContent = e.target.value;
        });

        // Controles de distancia
        document.getElementById('distanceSize')?.addEventListener('input', (e) => {
            this.editor?.setDistanceSize(e.target.value);
        });

        document.getElementById('distanceUnit')?.addEventListener('change', (e) => {
            this.editor?.setDistanceUnit(e.target.value);
        });
    }

    // Mostrar vista con datos de la sala y mapa
    async show(room, mapId = null) {
        if (!room) return;

        document.getElementById('adminRoomName').textContent = room.name;
        document.getElementById('adminRoomCode').textContent = room.code;

        // Si se especifica un mapId, cargar ese mapa
        if (mapId) {
            await this.loadMap(mapId);
        } else {
            // Cargar el mapa activo
            await this.loadActiveMap();
        }

        this.updateImageControls();
        this.updateGridControls();
        this.updateDistanceControls();
    }

    // Cargar un mapa específico
    async loadMap(mapId) {
        try {
            const result = await apiClient.getMaps(this.app.currentRoom.code);

            if (result.success) {
                const map = result.maps.find(m => m.id === mapId);
                if (map) {
                    this.currentMapId = map.id;
                    this.currentMapName = map.name;
                    this.loadMapData(map);
                }
            }
        } catch (error) {
            console.error('Error al cargar mapa:', error);
        }
    }

    // Cargar el mapa activo
    async loadActiveMap() {
        try {
            const result = await apiClient.getActiveMap(this.app.currentRoom.code);

            if (result.success && result.map) {
                this.currentMapId = result.map.id;
                this.currentMapName = result.map.name;
                this.loadMapData(result.map);
            } else {
                // No hay mapa activo, crear uno nuevo al guardar
                this.currentMapId = null;
                this.currentMapName = 'Mapa Principal';
            }
        } catch (error) {
            console.error('Error al cargar mapa activo:', error);
        }
    }

    // Cargar datos del mapa en el editor
    loadMapData(mapData) {
        if (!this.editor) return;

        if (mapData.imageData) {
            this.editor.loadImageFromData(mapData.imageData);
        }

        if (mapData.imageTransform) {
            const transform = typeof mapData.imageTransform === 'string'
                ? JSON.parse(mapData.imageTransform)
                : mapData.imageTransform;
            this.editor.imageTransform = { ...transform };
        }

        if (mapData.gridConfig) {
            const gridConfig = typeof mapData.gridConfig === 'string'
                ? JSON.parse(mapData.gridConfig)
                : mapData.gridConfig;
            this.editor.gridConfig = { ...gridConfig };
        }

        if (mapData.distanceConfig) {
            const distanceConfig = typeof mapData.distanceConfig === 'string'
                ? JSON.parse(mapData.distanceConfig)
                : mapData.distanceConfig;
            this.editor.distanceConfig = { ...DEFAULT_DISTANCE_CONFIG, ...distanceConfig };
        }

        this.editor.render();
    }

    // Actualizar UI con datos de la sala (compatibilidad)
    updateUI() {
        const room = this.app.currentRoom;
        if (!room) return;

        document.getElementById('adminRoomName').textContent = room.name;
        document.getElementById('adminRoomCode').textContent = room.code;

        // Conectar al socket y unirse a la sala
        socketClient.onUsersUpdated = (users) => this.updateUsersUI(users);
        socketClient.joinRoom(room.code, 'admin');
    }

    // Actualizar HUD de usuarios conectados
    updateUsersUI(users) {
        const countEl = document.getElementById('usersHudCount');
        const listEl = document.getElementById('usersHudList');

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

    // Cargar datos de la sala en el editor (compatibilidad)
    loadRoomData() {
        const room = this.app.currentRoom;
        if (!room || !this.editor) return;

        // Intentar cargar mapa activo primero
        this.loadActiveMap().then(() => {
            this.updateImageControls();
            this.updateGridControls();
            this.updateDistanceControls();
        });
    }

    // Actualizar controles de imagen en la UI
    updateImageControls() {
        if (!this.editor) return;

        const scalePercent = Math.round(this.editor.imageTransform.scale * 100);
        const rotationDegrees = Math.round(this.editor.imageTransform.rotation * (180 / Math.PI));

        const scaleInput = document.getElementById('imageScale');
        const scaleValue = document.getElementById('scaleValue');
        const rotationInput = document.getElementById('imageRotation');
        const rotationValue = document.getElementById('rotationValue');

        if (scaleInput) scaleInput.value = scalePercent;
        if (scaleValue) scaleValue.textContent = scalePercent;
        if (rotationInput) rotationInput.value = rotationDegrees;
        if (rotationValue) rotationValue.textContent = rotationDegrees;
    }

    // Actualizar controles de cuadrícula en la UI
    updateGridControls() {
        if (!this.editor) return;

        const gc = this.editor.gridConfig;

        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };

        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        setValue('gridSize', gc.size);
        setText('gridSizeValue', gc.size);
        setValue('gridOpacity', gc.opacity * 100);
        setText('gridOpacityValue', Math.round(gc.opacity * 100));
        setValue('gridColor', gc.color);
        setValue('gridLineWidth', gc.lineWidth);
        setText('gridLineWidthValue', gc.lineWidth);

        const showGridEl = document.getElementById('showGrid');
        if (showGridEl) showGridEl.checked = gc.visible;

        setValue('gridOffsetX', gc.offsetX);
        setText('gridOffsetXValue', gc.offsetX);
        setValue('gridOffsetY', gc.offsetY);
        setText('gridOffsetYValue', gc.offsetY);
    }

    // Actualizar controles de distancia en la UI
    updateDistanceControls() {
        if (!this.editor) return;

        const dc = this.editor.distanceConfig;

        const distanceSize = document.getElementById('distanceSize');
        const distanceUnit = document.getElementById('distanceUnit');

        if (distanceSize) distanceSize.value = dc.squareSize;
        if (distanceUnit) distanceUnit.value = dc.unit;
    }

    // Guardar mapa en el servidor
    async saveMap() {
        const room = this.app.currentRoom;
        const password = this.app.adminPassword;

        if (!room) {
            showNotification('Error: no hay sala activa', 'error');
            console.error('saveMap: no room');
            return;
        }
        if (!password) {
            showNotification('Error: sin contraseña de admin', 'error');
            console.error('saveMap: no password');
            return;
        }
        if (!this.editor) {
            showNotification('Error: editor no inicializado', 'error');
            console.error('saveMap: no editor');
            return;
        }

        try {
            const state = this.editor.getState();
            let result;

            if (this.currentMapId) {
                // Actualizar mapa existente
                result = await apiClient.updateMap(
                    room.code,
                    this.currentMapId,
                    password,
                    {
                        imageData: state.imageData,
                        imageTransform: state.imageTransform,
                        gridConfig: state.gridConfig,
                        distanceConfig: state.distanceConfig
                    }
                );
            } else {
                // Crear nuevo mapa
                result = await apiClient.createMap(
                    room.code,
                    password,
                    this.currentMapName || 'Mapa Principal',
                    state.imageData,
                    state.imageTransform,
                    state.gridConfig,
                    state.distanceConfig
                );

                if (result.success && result.map) {
                    this.currentMapId = result.map.id;
                    // Activar el nuevo mapa
                    await apiClient.activateMap(room.code, result.map.id, password);
                }
            }

            if (result.success) {
                // Si actualizamos un mapa existente, también activarlo para que los jugadores vean los cambios
                if (this.currentMapId) {
                    await apiClient.activateMap(room.code, this.currentMapId, password);
                }
                showNotification('Cambios guardados', 'success');
                // Notificar a los jugadores que el mapa cambió
                socketClient.notifyMapUpdate();
            } else {
                showNotification(result.error || 'Error al guardar', 'error');
                console.error('saveMap error:', result);
            }
        } catch (error) {
            showNotification('Error al guardar', 'error');
            console.error('saveMap exception:', error);
        }
    }

    // Mantener compatibilidad con saveRoom
    async saveRoom() {
        return this.saveMap();
    }
}

export { AdminEditorView };
