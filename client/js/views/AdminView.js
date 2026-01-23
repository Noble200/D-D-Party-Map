// ==========================================
// Vista de administrador - Editor de mapas
// ==========================================

import { MapEditor } from '../core/MapEditor.js';
import { screenManager } from '../core/ScreenManager.js';
import { apiClient } from '../core/ApiClient.js';
import { socketClient } from '../core/SocketClient.js';
import { ADMIN_MODES } from '../config.js';
import { showNotification, copyToClipboard } from '../utils/helpers.js';

class AdminView {
    constructor(app) {
        this.app = app;
        this.editor = null;
        this.currentMode = ADMIN_MODES.EDIT;
        this.initialized = false;
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
        // Volver al inicio
        document.getElementById('btnBackFromAdmin')?.addEventListener('click', () => {
            socketClient.leaveRoom();
            this.app.clearRoom();
            screenManager.show('home');
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
            this.saveRoom();
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

        // Mode toggle
        document.getElementById('btnModeEdit')?.addEventListener('click', () => {
            this.setMode(ADMIN_MODES.EDIT);
        });

        document.getElementById('btnModeMaster')?.addEventListener('click', () => {
            this.setMode(ADMIN_MODES.MASTER);
        });
    }

    // Cambiar modo Edit/Master
    setMode(mode) {
        this.currentMode = mode;

        const btnEdit = document.getElementById('btnModeEdit');
        const btnMaster = document.getElementById('btnModeMaster');
        const toolbar = document.querySelector('.toolbar');
        const modeIndicator = document.getElementById('modeIndicator');

        if (mode === ADMIN_MODES.EDIT) {
            btnEdit?.classList.add('active');
            btnMaster?.classList.remove('active');
            toolbar?.classList.remove('master-mode');
            if (modeIndicator) modeIndicator.style.display = 'none';
        } else {
            btnEdit?.classList.remove('active');
            btnMaster?.classList.add('active');
            toolbar?.classList.add('master-mode');
            if (modeIndicator) modeIndicator.style.display = 'flex';
        }
    }

    // Actualizar UI con datos de la sala
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

    // Cargar datos de la sala en el editor
    loadRoomData() {
        const room = this.app.currentRoom;
        if (!room || !this.editor) return;

        this.editor.loadState(
            room.image_data,
            room.image_transform,
            room.grid_config
        );

        this.updateImageControls();
        this.updateGridControls();
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

    // Guardar cambios en el servidor
    async saveRoom() {
        const room = this.app.currentRoom;
        const password = this.app.adminPassword;
        if (!room || !password || !this.editor) return;

        try {
            const state = this.editor.getState();
            const data = await apiClient.updateRoom(
                room.code,
                password,
                state.imageData,
                state.imageTransform,
                state.gridConfig
            );

            if (data.success) {
                showNotification('Cambios guardados', 'success');
                // Notificar a los jugadores que el mapa cambió
                socketClient.notifyMapUpdate();
            } else {
                showNotification(data.error, 'error');
            }
        } catch (error) {
            showNotification('Error al guardar', 'error');
            console.error(error);
        }
    }
}

export { AdminView };
