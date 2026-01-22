// ==========================================
// D&D Map Editor - Sistema de Salas
// ==========================================

// Configuración de API (usa la URL actual del servidor)
const API_URL = '/api';

// ==========================================
// Clase principal de la aplicación
// ==========================================

class DnDMapApp {
    constructor() {
        // Estado actual
        this.currentScreen = 'home';
        this.currentRoom = null;
        this.adminPassword = null;
        this.isAdmin = false;

        // Referencias a pantallas
        this.screens = {
            home: document.getElementById('homeScreen'),
            admin: document.getElementById('adminScreen'),
            user: document.getElementById('userScreen')
        };

        // Modales
        this.modals = {
            createRoom: document.getElementById('createRoomModal'),
            accessAdmin: document.getElementById('accessAdminModal')
        };

        // Editores (se inicializarán según la pantalla)
        this.adminEditor = null;
        this.userViewer = null;

        this.init();
    }

    init() {
        this.bindHomeEvents();
        this.bindModalEvents();
    }

    // ==========================================
    // Navegación entre pantallas
    // ==========================================

    showScreen(screenName) {
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        this.screens[screenName].classList.add('active');
        this.currentScreen = screenName;

        // Inicializar editores según la pantalla
        if (screenName === 'admin' && !this.adminEditor) {
            this.adminEditor = new MapEditor('mapCanvas', true);
            this.bindAdminEvents();
        }
        if (screenName === 'user' && !this.userViewer) {
            this.userViewer = new MapEditor('userMapCanvas', false);
        }

        // Redimensionar canvas
        if (screenName === 'admin' && this.adminEditor) {
            this.adminEditor.resizeCanvas();
        }
        if (screenName === 'user' && this.userViewer) {
            this.userViewer.resizeCanvas();
        }
    }

    showModal(modalName) {
        this.modals[modalName].classList.add('active');
    }

    hideModal(modalName) {
        this.modals[modalName].classList.remove('active');
    }

    hideAllModals() {
        Object.values(this.modals).forEach(m => m.classList.remove('active'));
    }

    // ==========================================
    // Eventos de la pantalla de inicio
    // ==========================================

    bindHomeEvents() {
        // Crear sala
        document.getElementById('btnCreateRoom').addEventListener('click', () => {
            this.showModal('createRoom');
        });

        // Acceder como admin
        document.getElementById('btnAccessAdmin').addEventListener('click', () => {
            this.showModal('accessAdmin');
        });

        // Unirse como usuario
        document.getElementById('btnJoinRoom').addEventListener('click', () => {
            this.joinAsUser();
        });

        // Enter en el input de código
        document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinAsUser();
        });
    }

    // ==========================================
    // Eventos de modales
    // ==========================================

    bindModalEvents() {
        // Modal crear sala
        document.getElementById('btnCancelCreate').addEventListener('click', () => {
            this.hideModal('createRoom');
        });
        document.getElementById('btnConfirmCreate').addEventListener('click', () => {
            this.createRoom();
        });

        // Modal acceder como admin
        document.getElementById('btnCancelAccess').addEventListener('click', () => {
            this.hideModal('accessAdmin');
        });
        document.getElementById('btnConfirmAccess').addEventListener('click', () => {
            this.accessAsAdmin();
        });

        // Cerrar modales con click fuera
        Object.values(this.modals).forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.hideAllModals();
            });
        });
    }

    // ==========================================
    // Eventos del panel Admin
    // ==========================================

    bindAdminEvents() {
        // Volver
        document.getElementById('btnBackFromAdmin').addEventListener('click', () => {
            this.showScreen('home');
            this.currentRoom = null;
            this.adminPassword = null;
        });

        // Copiar código
        document.getElementById('btnCopyCode').addEventListener('click', () => {
            const code = document.getElementById('adminRoomCode').textContent;
            navigator.clipboard.writeText(code).then(() => {
                this.showNotification('Código copiado', 'success');
            });
        });

        // Guardar cambios
        document.getElementById('btnSaveRoom').addEventListener('click', () => {
            this.saveRoom();
        });

        // Volver desde usuario
        document.getElementById('btnBackFromUser').addEventListener('click', () => {
            this.showScreen('home');
            this.currentRoom = null;
        });
    }

    // ==========================================
    // API: Crear sala
    // ==========================================

    async createRoom() {
        const name = document.getElementById('roomName').value.trim();
        const password = document.getElementById('adminPassword').value;

        if (!name || !password) {
            this.showNotification('Completa todos los campos', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/rooms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, adminPassword: password })
            });

            const data = await response.json();

            if (data.success) {
                this.currentRoom = data.room;
                this.adminPassword = password;
                this.isAdmin = true;

                this.hideModal('createRoom');
                this.showScreen('admin');
                this.updateAdminUI();
                this.showNotification(`Sala creada: ${data.room.code}`, 'success');

                // Limpiar formulario
                document.getElementById('roomName').value = '';
                document.getElementById('adminPassword').value = '';
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error de conexión con el servidor', 'error');
            console.error(error);
        }
    }

    // ==========================================
    // API: Acceder como admin
    // ==========================================

    async accessAsAdmin() {
        const code = document.getElementById('accessRoomCode').value.trim().toUpperCase();
        const password = document.getElementById('accessAdminPassword').value;

        if (!code || !password) {
            this.showNotification('Completa todos los campos', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/rooms/${code}/admin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminPassword: password })
            });

            const data = await response.json();

            if (data.success) {
                this.currentRoom = data.room;
                this.adminPassword = password;
                this.isAdmin = true;

                this.hideModal('accessAdmin');
                this.showScreen('admin');
                this.updateAdminUI();
                this.loadRoomDataToEditor();
                this.showNotification('Acceso concedido', 'success');

                // Limpiar formulario
                document.getElementById('accessRoomCode').value = '';
                document.getElementById('accessAdminPassword').value = '';
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error de conexión con el servidor', 'error');
            console.error(error);
        }
    }

    // ==========================================
    // API: Unirse como usuario
    // ==========================================

    async joinAsUser() {
        const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();

        if (!code) {
            this.showNotification('Ingresa un código de sala', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/rooms/${code}`);
            const data = await response.json();

            if (data.success) {
                this.currentRoom = data.room;
                this.isAdmin = false;

                this.showScreen('user');
                this.updateUserUI();
                this.loadRoomDataToViewer();
                this.showNotification('Conectado a la sala', 'success');

                document.getElementById('roomCodeInput').value = '';
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error de conexión con el servidor', 'error');
            console.error(error);
        }
    }

    // ==========================================
    // API: Guardar sala
    // ==========================================

    async saveRoom() {
        if (!this.currentRoom || !this.adminPassword) return;

        try {
            const response = await fetch(`${API_URL}/rooms/${this.currentRoom.code}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adminPassword: this.adminPassword,
                    imageData: this.adminEditor.getImageData(),
                    imageTransform: this.adminEditor.imageTransform,
                    gridConfig: this.adminEditor.gridConfig
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Cambios guardados', 'success');
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error al guardar', 'error');
            console.error(error);
        }
    }

    // ==========================================
    // UI Updates
    // ==========================================

    updateAdminUI() {
        document.getElementById('adminRoomName').textContent = this.currentRoom.name;
        document.getElementById('adminRoomCode').textContent = this.currentRoom.code;
    }

    updateUserUI() {
        document.getElementById('userRoomName').textContent = this.currentRoom.name;
        document.getElementById('userRoomCode').textContent = this.currentRoom.code;
    }

    loadRoomDataToEditor() {
        if (!this.currentRoom) return;

        // Cargar configuración de la cuadrícula
        if (this.currentRoom.grid_config) {
            this.adminEditor.gridConfig = this.currentRoom.grid_config;
            this.adminEditor.updateGridControls();
        }

        // Cargar transformación de imagen
        if (this.currentRoom.image_transform) {
            this.adminEditor.imageTransform = this.currentRoom.image_transform;
            this.adminEditor.updateImageControls();
        }

        // Cargar imagen
        if (this.currentRoom.image_data) {
            this.adminEditor.loadImageFromData(this.currentRoom.image_data);
        }

        this.adminEditor.render();
    }

    loadRoomDataToViewer() {
        if (!this.currentRoom) return;

        // Cargar configuración de la cuadrícula
        if (this.currentRoom.grid_config) {
            this.userViewer.gridConfig = this.currentRoom.grid_config;
        }

        // Cargar transformación de imagen
        if (this.currentRoom.image_transform) {
            this.userViewer.imageTransform = this.currentRoom.image_transform;
        }

        // Cargar imagen
        if (this.currentRoom.image_data) {
            this.userViewer.loadImageFromData(this.currentRoom.image_data);
        }

        this.userViewer.render();
    }

    // ==========================================
    // Notificaciones
    // ==========================================

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// ==========================================
// Clase MapEditor (Admin y Usuario)
// ==========================================

class MapEditor {
    constructor(canvasId, isEditable = true) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isEditable = isEditable;

        // Estado de la imagen
        this.image = null;
        this.imageLoaded = false;
        this.imageDataUrl = null;

        // Transformaciones de la imagen
        this.imageTransform = {
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0
        };

        // Configuración de la cuadrícula
        this.gridConfig = {
            size: 50,
            opacity: 0.5,
            color: '#ffffff',
            lineWidth: 1,
            visible: true,
            offsetX: 0,
            offsetY: 0
        };

        // Estado del arrastre
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };

        this.init();
    }

    init() {
        this.resizeCanvas();
        this.bindEvents();
        this.render();
    }

    // ==========================================
    // Configuración del Canvas
    // ==========================================

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.render();
    }

    // ==========================================
    // Bindeo de Eventos
    // ==========================================

    bindEvents() {
        // Redimensionar ventana
        window.addEventListener('resize', () => this.resizeCanvas());

        // Solo para modo editable (admin)
        if (this.isEditable) {
            // Cargar imagen
            document.getElementById('imageInput').addEventListener('change', (e) => this.loadImage(e));

            // Controles de imagen
            document.getElementById('imageScale').addEventListener('input', (e) => this.setImageScale(e.target.value));
            document.getElementById('imageRotation').addEventListener('input', (e) => this.setImageRotation(e.target.value));
            document.getElementById('resetImage').addEventListener('click', () => this.resetImage());

            // Controles de cuadrícula
            document.getElementById('gridSize').addEventListener('input', (e) => this.setGridSize(e.target.value));
            document.getElementById('gridOpacity').addEventListener('input', (e) => this.setGridOpacity(e.target.value));
            document.getElementById('gridColor').addEventListener('input', (e) => this.setGridColor(e.target.value));
            document.getElementById('gridLineWidth').addEventListener('input', (e) => this.setGridLineWidth(e.target.value));
            document.getElementById('showGrid').addEventListener('change', (e) => this.toggleGrid(e.target.checked));
            document.getElementById('gridOffsetX').addEventListener('input', (e) => this.setGridOffsetX(e.target.value));
            document.getElementById('gridOffsetY').addEventListener('input', (e) => this.setGridOffsetY(e.target.value));
        }

        // Eventos del mouse en el canvas (para ambos modos)
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.onMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.onMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));

        // Eventos táctiles
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend', () => this.onMouseUp());
    }

    // ==========================================
    // Carga de Imagen
    // ==========================================

    loadImage(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.imageDataUrl = e.target.result;
            this.loadImageFromData(this.imageDataUrl);
        };
        reader.readAsDataURL(file);
    }

    loadImageFromData(dataUrl) {
        this.imageDataUrl = dataUrl;
        this.image = new Image();
        this.image.onload = () => {
            this.imageLoaded = true;
            this.centerImage();
            this.render();
        };
        this.image.src = dataUrl;
    }

    getImageData() {
        return this.imageDataUrl;
    }

    centerImage() {
        if (!this.image) return;
        this.imageTransform.x = (this.canvas.width - this.image.width * this.imageTransform.scale) / 2;
        this.imageTransform.y = (this.canvas.height - this.image.height * this.imageTransform.scale) / 2;
    }

    resetImage() {
        this.imageTransform.scale = 1;
        this.imageTransform.rotation = 0;
        this.updateImageControls();
        this.centerImage();
        this.render();
    }

    // ==========================================
    // Actualizar controles UI
    // ==========================================

    updateImageControls() {
        if (!this.isEditable) return;

        const scalePercent = Math.round(this.imageTransform.scale * 100);
        const rotationDegrees = Math.round(this.imageTransform.rotation * (180 / Math.PI));

        document.getElementById('imageScale').value = scalePercent;
        document.getElementById('scaleValue').textContent = scalePercent;
        document.getElementById('imageRotation').value = rotationDegrees;
        document.getElementById('rotationValue').textContent = rotationDegrees;
    }

    updateGridControls() {
        if (!this.isEditable) return;

        document.getElementById('gridSize').value = this.gridConfig.size;
        document.getElementById('gridSizeValue').textContent = this.gridConfig.size;
        document.getElementById('gridOpacity').value = this.gridConfig.opacity * 100;
        document.getElementById('gridOpacityValue').textContent = Math.round(this.gridConfig.opacity * 100);
        document.getElementById('gridColor').value = this.gridConfig.color;
        document.getElementById('gridLineWidth').value = this.gridConfig.lineWidth;
        document.getElementById('gridLineWidthValue').textContent = this.gridConfig.lineWidth;
        document.getElementById('showGrid').checked = this.gridConfig.visible;
        document.getElementById('gridOffsetX').value = this.gridConfig.offsetX;
        document.getElementById('gridOffsetXValue').textContent = this.gridConfig.offsetX;
        document.getElementById('gridOffsetY').value = this.gridConfig.offsetY;
        document.getElementById('gridOffsetYValue').textContent = this.gridConfig.offsetY;
    }

    // ==========================================
    // Controles de Imagen
    // ==========================================

    setImageScale(value) {
        const scale = value / 100;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        const oldScale = this.imageTransform.scale;
        this.imageTransform.scale = scale;

        if (this.image) {
            const scaleRatio = scale / oldScale;
            this.imageTransform.x = centerX - (centerX - this.imageTransform.x) * scaleRatio;
            this.imageTransform.y = centerY - (centerY - this.imageTransform.y) * scaleRatio;
        }

        document.getElementById('scaleValue').textContent = value;
        this.render();
    }

    setImageRotation(value) {
        this.imageTransform.rotation = value * (Math.PI / 180);
        document.getElementById('rotationValue').textContent = value;
        this.render();
    }

    // ==========================================
    // Controles de Cuadrícula
    // ==========================================

    setGridSize(value) {
        this.gridConfig.size = parseInt(value);
        document.getElementById('gridSizeValue').textContent = value;
        this.render();
    }

    setGridOpacity(value) {
        this.gridConfig.opacity = value / 100;
        document.getElementById('gridOpacityValue').textContent = value;
        this.render();
    }

    setGridColor(value) {
        this.gridConfig.color = value;
        this.render();
    }

    setGridLineWidth(value) {
        this.gridConfig.lineWidth = parseInt(value);
        document.getElementById('gridLineWidthValue').textContent = value;
        this.render();
    }

    toggleGrid(visible) {
        this.gridConfig.visible = visible;
        this.render();
    }

    setGridOffsetX(value) {
        this.gridConfig.offsetX = parseInt(value);
        document.getElementById('gridOffsetXValue').textContent = value;
        this.render();
    }

    setGridOffsetY(value) {
        this.gridConfig.offsetY = parseInt(value);
        document.getElementById('gridOffsetYValue').textContent = value;
        this.render();
    }

    // ==========================================
    // Eventos del Mouse
    // ==========================================

    onMouseDown(e) {
        this.isDragging = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
    }

    onMouseMove(e) {
        if (!this.isDragging) return;

        const deltaX = e.clientX - this.lastMousePos.x;
        const deltaY = e.clientY - this.lastMousePos.y;

        this.imageTransform.x += deltaX;
        this.imageTransform.y += deltaY;

        this.lastMousePos = { x: e.clientX, y: e.clientY };
        this.render();
    }

    onMouseUp() {
        this.isDragging = false;
    }

    onWheel(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(3, this.imageTransform.scale * zoomFactor));

        const scaleRatio = newScale / this.imageTransform.scale;
        this.imageTransform.x = mouseX - (mouseX - this.imageTransform.x) * scaleRatio;
        this.imageTransform.y = mouseY - (mouseY - this.imageTransform.y) * scaleRatio;
        this.imageTransform.scale = newScale;

        // Actualizar slider solo en modo admin
        if (this.isEditable) {
            const scalePercent = Math.round(newScale * 100);
            document.getElementById('imageScale').value = scalePercent;
            document.getElementById('scaleValue').textContent = scalePercent;
        }

        this.render();
    }

    // ==========================================
    // Eventos Táctiles
    // ==========================================

    onTouchStart(e) {
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.lastMousePos = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        }
    }

    onTouchMove(e) {
        e.preventDefault();
        if (!this.isDragging || e.touches.length !== 1) return;

        const deltaX = e.touches[0].clientX - this.lastMousePos.x;
        const deltaY = e.touches[0].clientY - this.lastMousePos.y;

        this.imageTransform.x += deltaX;
        this.imageTransform.y += deltaY;

        this.lastMousePos = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
        this.render();
    }

    // ==========================================
    // Renderizado
    // ==========================================

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawImage();
        if (this.gridConfig.visible) {
            this.drawGrid();
        }
    }

    drawImage() {
        if (!this.imageLoaded || !this.image) return;

        this.ctx.save();

        const imgCenterX = this.imageTransform.x + (this.image.width * this.imageTransform.scale) / 2;
        const imgCenterY = this.imageTransform.y + (this.image.height * this.imageTransform.scale) / 2;

        this.ctx.translate(imgCenterX, imgCenterY);
        this.ctx.rotate(this.imageTransform.rotation);
        this.ctx.translate(-imgCenterX, -imgCenterY);

        this.ctx.drawImage(
            this.image,
            this.imageTransform.x,
            this.imageTransform.y,
            this.image.width * this.imageTransform.scale,
            this.image.height * this.imageTransform.scale
        );

        this.ctx.restore();
    }

    drawGrid() {
        const { size, opacity, color, lineWidth, offsetX, offsetY } = this.gridConfig;

        this.ctx.save();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.globalAlpha = opacity;

        const startX = (this.imageTransform.x % size) + offsetX;
        const startY = (this.imageTransform.y % size) + offsetY;

        this.ctx.beginPath();

        for (let x = startX; x < this.canvas.width; x += size) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
        }
        for (let x = startX - size; x > 0; x -= size) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
        }

        for (let y = startY; y < this.canvas.height; y += size) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
        }
        for (let y = startY - size; y > 0; y -= size) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
        }

        this.ctx.stroke();
        this.ctx.restore();
    }
}

// ==========================================
// Inicializar la aplicación
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    window.app = new DnDMapApp();
});
