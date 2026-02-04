// ==========================================
// Vista de Editor de Mapas (Admin)
// ==========================================

import { MapEditor } from '../core/MapEditor.js';
import { screenManager } from '../core/ScreenManager.js';
import { apiClient } from '../core/ApiClient.js';
import { socketClient } from '../core/SocketClient.js';
import { DEFAULT_DISTANCE_CONFIG } from '../config.js';
import { showNotification } from '../utils/helpers.js';

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
        // Volver al menu de sala
        document.getElementById('btnBackFromAdmin')?.addEventListener('click', () => {
            screenManager.show('roomMenu');
        });

        // Guardar cambios
        document.getElementById('btnSaveRoom')?.addEventListener('click', () => {
            this.saveMap();
        });

        // Actualizar nombre del mapa cuando cambia el input
        document.getElementById('mapNameEditor')?.addEventListener('change', (e) => {
            this.currentMapName = e.target.value.trim() || 'Mapa Principal';
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
        this.updateMapNameUI();
    }

    // Actualizar nombre del mapa en la UI
    updateMapNameUI() {
        const mapNameInput = document.getElementById('mapNameEditor');
        if (mapNameInput) {
            mapNameInput.value = this.currentMapName || 'Mapa Principal';
        }
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
                } else {
                    // Mapa no encontrado, limpiar editor
                    this.clearEditor();
                }
            }
        } catch (error) {
            console.error('Error al cargar mapa:', error);
            this.clearEditor();
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
                // No hay mapa activo, limpiar editor
                this.currentMapId = null;
                this.currentMapName = 'Mapa Principal';
                this.clearEditor();
            }
        } catch (error) {
            console.error('Error al cargar mapa activo:', error);
            this.clearEditor();
        }
    }

    // Limpiar el editor a estado vacío
    clearEditor() {
        if (!this.editor) return;

        this.editor.image = null;
        this.editor.imageTransform = { x: 0, y: 0, scale: 1, rotation: 0 };
        this.editor.gridConfig = {
            size: 50,
            opacity: 0.5,
            color: '#ffffff',
            lineWidth: 1,
            visible: true,
            offsetX: 0,
            offsetY: 0
        };
        this.editor.distanceConfig = { ...DEFAULT_DISTANCE_CONFIG };
        this.editor.render();
    }

    // Cargar datos del mapa en el editor
    loadMapData(mapData) {
        if (!this.editor) return;

        // Siempre limpiar primero para evitar datos residuales
        this.clearEditor();

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
        // Ya no muestra info de sala en el editor
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

        // Obtener nombre del mapa desde el input
        const mapNameInput = document.getElementById('mapNameEditor');
        if (mapNameInput && mapNameInput.value.trim()) {
            this.currentMapName = mapNameInput.value.trim();
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
                        name: this.currentMapName,
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
