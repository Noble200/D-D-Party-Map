// ==========================================
// Componente Selector de Mapas
// ==========================================

import { apiClient } from '../core/ApiClient.js';
import { socketClient } from '../core/SocketClient.js';
import { screenManager } from '../core/ScreenManager.js';
import { showNotification } from '../utils/helpers.js';
import { DISTANCE_UNITS } from '../config.js';

class MapSelector {
    constructor(app) {
        this.app = app;
        this.modal = document.getElementById('mapSelectorModal');
        this.formModal = document.getElementById('mapFormModal');
        this.maps = [];
        this.editingMapId = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;

        // Cerrar selector
        document.getElementById('btnCloseMapSelector')?.addEventListener('click', () => this.hide());

        // Nuevo mapa
        document.getElementById('btnNewMap')?.addEventListener('click', () => this.openMapForm());

        // Formulario de mapa
        document.getElementById('btnCancelMapForm')?.addEventListener('click', () => this.hideMapForm());
        document.getElementById('btnSaveMapForm')?.addEventListener('click', () => this.saveMapForm());

        // Cerrar al hacer click fuera
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hide();
        });

        this.formModal?.addEventListener('click', (e) => {
            if (e.target === this.formModal) this.hideMapForm();
        });

        this.initialized = true;
    }

    async show() {
        await this.loadMaps();
        this.modal.classList.add('active');
    }

    hide() {
        this.modal.classList.remove('active');
    }

    async loadMaps() {
        try {
            const result = await apiClient.getMaps(this.app.currentRoom.code);

            if (result.success) {
                this.maps = result.maps || [];
                this.render();
            } else {
                showNotification('Error al cargar mapas', 'error');
            }
        } catch (error) {
            console.error('Error al cargar mapas:', error);
            showNotification('Error al cargar mapas', 'error');
        }
    }

    render() {
        const container = document.getElementById('mapsList');

        if (this.maps.length === 0) {
            container.innerHTML = `
                <div class="maps-empty">
                    <p>No hay mapas en esta sala.</p>
                    <p>Crea tu primer mapa para comenzar.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.maps.map(map => {
            const distanceConfig = typeof map.distanceConfig === 'string'
                ? JSON.parse(map.distanceConfig)
                : map.distanceConfig;

            const unitLabel = DISTANCE_UNITS[distanceConfig?.unit] || distanceConfig?.unit || 'pies';
            const squareSize = distanceConfig?.squareSize || 5;

            return `
                <div class="map-card ${map.isActive ? 'active' : ''}" data-id="${map.id}">
                    <div class="map-thumbnail">
                        ${map.imageData
                            ? `<img src="${map.imageData}" alt="${this.escapeHtml(map.name)}">`
                            : '<span class="no-image">Sin imagen</span>'}
                    </div>
                    <div class="map-info">
                        <h4>${this.escapeHtml(map.name)}</h4>
                        <span class="map-distance">${squareSize} ${unitLabel}/cuadro</span>
                        ${map.isActive ? '<span class="active-badge">ACTIVO</span>' : ''}
                    </div>
                    <div class="map-actions">
                        <button class="btn btn-small btn-activate" data-id="${map.id}" ${map.isActive ? 'disabled' : ''}>
                            ${map.isActive ? 'Activo' : 'Activar'}
                        </button>
                        <button class="btn btn-small btn-edit" data-id="${map.id}">Editar</button>
                        <button class="btn btn-small btn-delete" data-id="${map.id}" ${map.isActive ? 'disabled' : ''}>Eliminar</button>
                    </div>
                </div>
            `;
        }).join('');

        // Agregar event listeners
        container.querySelectorAll('.btn-activate').forEach(btn => {
            btn.addEventListener('click', () => this.activateMap(btn.dataset.id));
        });

        container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => this.editMap(btn.dataset.id));
        });

        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => this.deleteMap(btn.dataset.id));
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    async activateMap(mapId) {
        try {
            const result = await apiClient.activateMap(
                this.app.currentRoom.code,
                mapId,
                this.app.adminPassword
            );

            if (result.success) {
                // Notificar a todos los jugadores via socket
                socketClient.emit('map-switched', {
                    roomCode: this.app.currentRoom.code,
                    mapId: mapId
                });

                showNotification('Mapa activado', 'success');
                await this.loadMaps(); // Recargar lista

                // Recargar mapa en la vista
                if (this.app.adminViewerView) {
                    this.app.adminViewerView.reloadMap();
                }
            } else {
                showNotification('Error al activar mapa: ' + (result.error || ''), 'error');
            }
        } catch (error) {
            console.error('Error al activar mapa:', error);
            showNotification('Error al activar mapa', 'error');
        }
    }

    editMap(mapId) {
        // Ir al editor con este mapa
        this.hide();
        if (this.app.adminEditorView) {
            this.app.adminEditorView.currentMapId = mapId;
        }
        screenManager.show('adminEditor');
    }

    async deleteMap(mapId) {
        if (!confirm('¿Estás seguro de eliminar este mapa? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            const result = await apiClient.deleteMap(
                this.app.currentRoom.code,
                mapId,
                this.app.adminPassword
            );

            if (result.success) {
                showNotification('Mapa eliminado', 'success');
                await this.loadMaps();
            } else {
                showNotification('Error: ' + (result.error || 'No se pudo eliminar'), 'error');
            }
        } catch (error) {
            console.error('Error al eliminar mapa:', error);
            showNotification('Error al eliminar mapa', 'error');
        }
    }

    openMapForm(mapId = null) {
        this.editingMapId = mapId;

        // Resetear formulario
        document.getElementById('mapNameInput').value = '';
        document.getElementById('squareSizeInput').value = 5;
        document.getElementById('distanceUnitInput').value = 'feet';

        if (mapId) {
            // Edición: cargar datos existentes
            const map = this.maps.find(m => m.id === mapId);
            if (map) {
                document.getElementById('mapFormTitle').textContent = 'Editar Mapa';
                document.getElementById('mapNameInput').value = map.name;

                const distanceConfig = typeof map.distanceConfig === 'string'
                    ? JSON.parse(map.distanceConfig)
                    : map.distanceConfig;

                document.getElementById('squareSizeInput').value = distanceConfig?.squareSize || 5;
                document.getElementById('distanceUnitInput').value = distanceConfig?.unit || 'feet';
            }
        } else {
            document.getElementById('mapFormTitle').textContent = 'Nuevo Mapa';
        }

        this.formModal.classList.add('active');
    }

    hideMapForm() {
        this.formModal.classList.remove('active');
        this.editingMapId = null;
    }

    async saveMapForm() {
        const name = document.getElementById('mapNameInput').value.trim();
        const squareSize = parseInt(document.getElementById('squareSizeInput').value) || 5;
        const unit = document.getElementById('distanceUnitInput').value || 'feet';

        if (!name) {
            showNotification('Ingresa un nombre para el mapa', 'error');
            return;
        }

        const distanceConfig = { squareSize, unit };

        try {
            let result;

            if (this.editingMapId) {
                // Actualizar mapa existente
                result = await apiClient.updateMap(
                    this.app.currentRoom.code,
                    this.editingMapId,
                    this.app.adminPassword,
                    { name, distanceConfig }
                );
            } else {
                // Crear nuevo mapa
                result = await apiClient.createMap(
                    this.app.currentRoom.code,
                    this.app.adminPassword,
                    name,
                    null, // imageData
                    null, // imageTransform
                    null, // gridConfig
                    distanceConfig
                );
            }

            if (result.success) {
                showNotification(this.editingMapId ? 'Mapa actualizado' : 'Mapa creado', 'success');
                this.hideMapForm();
                await this.loadMaps();

                // Si es nuevo mapa, ir al editor
                if (!this.editingMapId && result.map) {
                    this.editMap(result.map.id);
                }
            } else {
                showNotification('Error: ' + (result.error || ''), 'error');
            }
        } catch (error) {
            console.error('Error al guardar mapa:', error);
            showNotification('Error al guardar mapa', 'error');
        }
    }
}

export { MapSelector };
