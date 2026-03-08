// ==========================================
// Editor de mapas - Renderizado e interacción del canvas
// ==========================================

import { DEFAULT_IMAGE_TRANSFORM, DEFAULT_GRID_CONFIG, DEFAULT_DISTANCE_CONFIG, ZOOM_MIN, ZOOM_MAX } from '../config.js';

// Colores predefinidos para tokens de jugadores
const TOKEN_COLORS = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
    '#9b59b6', '#1abc9c', '#e67e22', '#e91e63'
];

export class MapEditor {
    constructor(canvasId, isEditable = true) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas no encontrado: ${canvasId}`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.isEditable = isEditable;

        // Estado de la imagen
        this.image = null;
        this.imageLoaded = false;
        this.imageDataUrl = null;

        // Transformaciones de la imagen
        this.imageTransform = { ...DEFAULT_IMAGE_TRANSFORM };

        // Configuración de la cuadrícula
        this.gridConfig = { ...DEFAULT_GRID_CONFIG };

        // Configuración de distancia por celda
        this.distanceConfig = { ...DEFAULT_DISTANCE_CONFIG };

        // Estado del arrastre
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };

        // Callbacks para controles UI
        this.onScaleChange = null;

        // === SISTEMA DE TOKENS ===
        this.tokens = [];
        this.tokensEnabled = false;
        this.draggingToken = null;
        this.dragTokenPos = null; // Posición visual durante el arrastre
        this.selectedTokenId = null;
        this.ownTokenId = null; // ID del token que pertenece a este jugador
        this.isAdmin = false;

        // Callbacks de tokens
        this.onTokenMoved = null;
        this.onTokenSelected = null; // Notifica selección/deselección a otros

        // === SISTEMA DE SPAWN POINTS ===
        this.spawnPoints = []; // { id, gridX, gridY, type: 'player'|'npc' }
        this.spawnToolActive = false; // Herramienta de spawn activa
        this.spawnToolType = 'player'; // Tipo a colocar
        this.showSpawnPoints = false; // Mostrar spawn points (solo admin)
        this.onSpawnPointsChanged = null; // Callback cuando cambian

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
        if (!container) return;
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

        // Eventos del mouse en el canvas
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', () => this.onMouseLeave());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));

        // Eventos táctiles
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));
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
        this.centerImage();
        this.render();
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

        this.render();
    }

    setImageRotation(value) {
        this.imageTransform.rotation = value * (Math.PI / 180);
        this.render();
    }

    // ==========================================
    // Controles de Cuadrícula
    // ==========================================

    setGridSize(value) {
        this.gridConfig.size = parseInt(value);
        this.render();
    }

    setGridOpacity(value) {
        this.gridConfig.opacity = value / 100;
        this.render();
    }

    setGridColor(value) {
        this.gridConfig.color = value;
        this.render();
    }

    setGridLineWidth(value) {
        this.gridConfig.lineWidth = parseInt(value);
        this.render();
    }

    toggleGrid(visible) {
        this.gridConfig.visible = visible;
        this.render();
    }

    setGridOffsetX(value) {
        this.gridConfig.offsetX = parseInt(value);
        this.render();
    }

    setGridOffsetY(value) {
        this.gridConfig.offsetY = parseInt(value);
        this.render();
    }

    // ==========================================
    // Controles de Distancia
    // ==========================================

    setDistanceSize(value) {
        this.distanceConfig.squareSize = parseInt(value);
    }

    setDistanceUnit(value) {
        this.distanceConfig.unit = value;
    }

    // ==========================================
    // Helpers de Grid (conversión coordenadas)
    // ==========================================

    // Obtener tamaño de celda en pixels (escalado)
    getCellSize() {
        return this.gridConfig.size * this.imageTransform.scale;
    }

    // Obtener base del grid (posición 0,0 del grid en pixels de canvas)
    getGridBase() {
        const { offsetX, offsetY } = this.gridConfig;
        return {
            x: this.imageTransform.x + (offsetX * this.imageTransform.scale),
            y: this.imageTransform.y + (offsetY * this.imageTransform.scale)
        };
    }

    // Convertir posición de canvas (pixel) a coordenada de grid
    pixelToGrid(px, py) {
        const cellSize = this.getCellSize();
        const base = this.getGridBase();
        return {
            gridX: Math.floor((px - base.x) / cellSize),
            gridY: Math.floor((py - base.y) / cellSize)
        };
    }

    // Convertir coordenada de grid a pixel de canvas (esquina superior izquierda de la celda)
    gridToPixel(gridX, gridY) {
        const cellSize = this.getCellSize();
        const base = this.getGridBase();
        return {
            x: base.x + (gridX * cellSize),
            y: base.y + (gridY * cellSize)
        };
    }

    // Obtener el centro de una celda en pixels
    gridToCenter(gridX, gridY) {
        const cellSize = this.getCellSize();
        const pos = this.gridToPixel(gridX, gridY);
        return {
            x: pos.x + cellSize / 2,
            y: pos.y + cellSize / 2
        };
    }

    // ==========================================
    // Sistema de Tokens
    // ==========================================

    // Habilitar/deshabilitar tokens
    enableTokens(isAdmin, ownTokenId = null) {
        this.tokensEnabled = true;
        this.isAdmin = isAdmin;
        this.ownTokenId = ownTokenId;
        this.render();
    }

    disableTokens() {
        this.tokensEnabled = false;
        this.tokens = [];
        this.draggingToken = null;
        this.selectedTokenId = null;
        this.render();
    }

    // Cargar tokens
    setTokens(tokens) {
        this.tokens = tokens || [];
        this.render();
    }

    // Agregar un token
    addToken(token) {
        // Verificar que no haya otro token en la misma celda
        const existing = this.tokens.find(t => t.gridX === token.gridX && t.gridY === token.gridY);
        if (existing) return false;
        this.tokens.push(token);
        this.render();
        return true;
    }

    // Eliminar un token
    removeToken(tokenId) {
        this.tokens = this.tokens.filter(t => t.id !== tokenId);
        if (this.selectedTokenId === tokenId) this.selectedTokenId = null;
        this.render();
    }

    // Actualizar un token específico (por movimiento remoto)
    updateToken(token) {
        const idx = this.tokens.findIndex(t => t.id === token.id);
        if (idx >= 0) {
            this.tokens[idx] = { ...this.tokens[idx], ...token };
        } else {
            this.tokens.push(token);
        }
        this.render();
    }

    // Verificar si una celda está ocupada (excluyendo un token específico)
    isCellOccupied(gridX, gridY, excludeTokenId = null) {
        return this.tokens.some(t =>
            t.gridX === gridX && t.gridY === gridY && t.id !== excludeTokenId
        );
    }

    // Buscar token en una posición de canvas
    getTokenAtPixel(px, py) {
        const cellSize = this.getCellSize();
        const radius = cellSize * 0.4;

        for (let i = this.tokens.length - 1; i >= 0; i--) {
            const token = this.tokens[i];
            const center = this.gridToCenter(token.gridX, token.gridY);
            const dist = Math.sqrt((px - center.x) ** 2 + (py - center.y) ** 2);
            if (dist <= radius) {
                return token;
            }
        }
        return null;
    }

    // Seleccionar/deseleccionar token y notificar a todos
    selectToken(tokenId) {
        if (this.selectedTokenId === tokenId) return;
        this.selectedTokenId = tokenId;
        if (this.onTokenSelected) {
            this.onTokenSelected(tokenId);
        }
    }

    // Verificar si el usuario puede mover un token
    canMoveToken(token) {
        if (!this.tokensEnabled) return false;
        if (this.isAdmin) return true;
        return token.id === this.ownTokenId;
    }

    // ==========================================
    // Eventos del Mouse (con soporte de tokens)
    // ==========================================

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        // Si herramienta de spawn activa, colocar/quitar spawn point
        if (this.spawnToolActive) {
            const { gridX, gridY } = this.pixelToGrid(px, py);
            const existing = this.getSpawnAtPixel(px, py);
            if (existing) {
                this.removeSpawnPoint(gridX, gridY);
            } else {
                this.addSpawnPoint(gridX, gridY, this.spawnToolType);
            }
            return;
        }

        // Si tokens habilitados, intentar agarrar un token
        if (this.tokensEnabled) {
            const token = this.getTokenAtPixel(px, py);
            if (token && this.canMoveToken(token)) {
                this.draggingToken = token;
                this.dragTokenPos = { x: px, y: py };
                this.selectToken(token.id);
                this.canvas.style.cursor = 'grabbing';
                this.render();
                return;
            }

            // Click en vacío: deseleccionar
            if (this.selectedTokenId) {
                this.selectToken(null);
                this.render();
            }
        }

        // Arrastre del mapa (comportamiento normal)
        this.isDragging = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        // Arrastrando token
        if (this.draggingToken) {
            this.dragTokenPos = { x: px, y: py };
            this.render();
            return;
        }

        // Cambiar cursor si estamos sobre un token movible
        if (this.tokensEnabled && !this.isDragging) {
            const token = this.getTokenAtPixel(px, py);
            if (token && this.canMoveToken(token)) {
                this.canvas.style.cursor = 'grab';
            } else {
                this.canvas.style.cursor = 'default';
            }
        }

        // Arrastre del mapa
        if (!this.isDragging) return;

        const deltaX = e.clientX - this.lastMousePos.x;
        const deltaY = e.clientY - this.lastMousePos.y;

        this.imageTransform.x += deltaX;
        this.imageTransform.y += deltaY;

        this.lastMousePos = { x: e.clientX, y: e.clientY };
        this.render();
    }

    onMouseUp(e) {
        // Soltar token: snap a la celda más cercana
        if (this.draggingToken && this.dragTokenPos) {
            const { gridX, gridY } = this.pixelToGrid(this.dragTokenPos.x, this.dragTokenPos.y);

            // Verificar si la celda destino está libre
            if (!this.isCellOccupied(gridX, gridY, this.draggingToken.id)) {
                const oldX = this.draggingToken.gridX;
                const oldY = this.draggingToken.gridY;
                this.draggingToken.gridX = gridX;
                this.draggingToken.gridY = gridY;

                // Notificar movimiento si cambió de posición
                if ((oldX !== gridX || oldY !== gridY) && this.onTokenMoved) {
                    this.onTokenMoved({ ...this.draggingToken });
                }
            }
            // Si está ocupada, vuelve a su posición original (no hace nada)

            this.draggingToken = null;
            this.dragTokenPos = null;
            this.selectToken(null); // Deseleccionar al soltar
            this.canvas.style.cursor = 'default';
            this.render();
            return;
        }

        this.isDragging = false;
    }

    onMouseLeave() {
        // Si estaba arrastrando token, cancelar y devolver a posición original
        if (this.draggingToken) {
            this.draggingToken = null;
            this.dragTokenPos = null;
            this.canvas.style.cursor = 'default';
            this.render();
            return;
        }
        this.isDragging = false;
    }

    onWheel(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.imageTransform.scale * zoomFactor));

        const scaleRatio = newScale / this.imageTransform.scale;
        this.imageTransform.x = mouseX - (mouseX - this.imageTransform.x) * scaleRatio;
        this.imageTransform.y = mouseY - (mouseY - this.imageTransform.y) * scaleRatio;
        this.imageTransform.scale = newScale;

        // Notificar cambio de escala si hay callback
        if (this.onScaleChange) {
            this.onScaleChange(Math.round(newScale * 100));
        }

        this.render();
    }

    // ==========================================
    // Eventos Táctiles (con soporte de tokens)
    // ==========================================

    onTouchStart(e) {
        if (e.touches.length === 1) {
            const rect = this.canvas.getBoundingClientRect();
            const px = e.touches[0].clientX - rect.left;
            const py = e.touches[0].clientY - rect.top;

            // Herramienta de spawn en touch
            if (this.spawnToolActive) {
                e.preventDefault();
                const { gridX, gridY } = this.pixelToGrid(px, py);
                const existing = this.getSpawnAtPixel(px, py);
                if (existing) {
                    this.removeSpawnPoint(gridX, gridY);
                } else {
                    this.addSpawnPoint(gridX, gridY, this.spawnToolType);
                }
                return;
            }

            // Intentar agarrar token
            if (this.tokensEnabled) {
                const token = this.getTokenAtPixel(px, py);
                if (token && this.canMoveToken(token)) {
                    e.preventDefault();
                    this.draggingToken = token;
                    this.dragTokenPos = { x: px, y: py };
                    this.selectToken(token.id);
                    this.render();
                    return;
                }

                // Toque en vacío: deseleccionar
                if (this.selectedTokenId) {
                    this.selectToken(null);
                    this.render();
                }
            }

            this.isDragging = true;
            this.lastMousePos = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        }
    }

    onTouchMove(e) {
        e.preventDefault();

        if (e.touches.length !== 1) return;

        const rect = this.canvas.getBoundingClientRect();
        const px = e.touches[0].clientX - rect.left;
        const py = e.touches[0].clientY - rect.top;

        // Arrastrando token
        if (this.draggingToken) {
            this.dragTokenPos = { x: px, y: py };
            this.render();
            return;
        }

        if (!this.isDragging) return;

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

    onTouchEnd(e) {
        // Soltar token en touch
        if (this.draggingToken && this.dragTokenPos) {
            const { gridX, gridY } = this.pixelToGrid(this.dragTokenPos.x, this.dragTokenPos.y);

            if (!this.isCellOccupied(gridX, gridY, this.draggingToken.id)) {
                const oldX = this.draggingToken.gridX;
                const oldY = this.draggingToken.gridY;
                this.draggingToken.gridX = gridX;
                this.draggingToken.gridY = gridY;

                if ((oldX !== gridX || oldY !== gridY) && this.onTokenMoved) {
                    this.onTokenMoved({ ...this.draggingToken });
                }
            }

            this.draggingToken = null;
            this.dragTokenPos = null;
            this.selectToken(null); // Deseleccionar al soltar
            this.render();
            return;
        }

        this.isDragging = false;
    }

    // ==========================================
    // Renderizado
    // ==========================================

    render() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawImage();
        if (this.gridConfig.visible) {
            this.drawGrid();
        }
        // Dibujar spawn points (solo si showSpawnPoints está activo - admin editor/viewer)
        if (this.showSpawnPoints && this.spawnPoints.length > 0) {
            this.drawSpawnPoints();
        }
        // Dibujar tokens encima de todo
        if (this.tokensEnabled) {
            this.drawTokens();
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

        // La cuadrícula escala con la imagen para que todos vean las mismas distancias
        // El tamaño de celda se multiplica por la escala de la imagen
        const cellSize = size * this.imageTransform.scale;

        // Calcular offset considerando la posición de la imagen y el offset configurado
        const baseX = this.imageTransform.x + (offsetX * this.imageTransform.scale);
        const baseY = this.imageTransform.y + (offsetY * this.imageTransform.scale);

        // Calcular el inicio de la cuadrícula para que se alinee con la imagen
        const startX = baseX % cellSize;
        const startY = baseY % cellSize;

        this.ctx.beginPath();

        // Líneas verticales
        for (let x = startX; x <= this.canvas.width; x += cellSize) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
        }
        // Líneas hacia la izquierda si es necesario
        for (let x = startX - cellSize; x >= 0; x -= cellSize) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
        }

        // Líneas horizontales
        for (let y = startY; y <= this.canvas.height; y += cellSize) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
        }
        // Líneas hacia arriba si es necesario
        for (let y = startY - cellSize; y >= 0; y -= cellSize) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
        }

        this.ctx.stroke();
        this.ctx.restore();
    }

    drawTokens() {
        const cellSize = this.getCellSize();
        const radius = cellSize * 0.38;

        for (const token of this.tokens) {
            // Si este token se está arrastrando, dibujar en la posición del mouse
            if (this.draggingToken && this.draggingToken.id === token.id && this.dragTokenPos) {
                this.drawSingleToken(
                    this.dragTokenPos.x,
                    this.dragTokenPos.y,
                    radius, token, true
                );
                continue;
            }

            const center = this.gridToCenter(token.gridX, token.gridY);
            const isSelected = this.selectedTokenId === token.id;
            this.drawSingleToken(center.x, center.y, radius, token, isSelected);
        }
    }

    drawSingleToken(cx, cy, radius, token, isSelected) {
        const ctx = this.ctx;
        const borderColor = token.borderColor || token.color || '#e74c3c';

        ctx.save();

        // Sombra
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Si tiene foto, cargarla y dibujar en circulo
        if (token.photo && !token._photoImg) {
            // Cargar imagen la primera vez
            const img = new Image();
            img.onload = () => {
                token._photoImg = img;
                this.render();
            };
            img.src = token.photo;
            // Mientras carga, dibujar circulo de color
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = borderColor;
            ctx.fill();
        } else if (token._photoImg) {
            // Dibujar foto recortada en circulo
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(token._photoImg, cx - radius, cy - radius, radius * 2, radius * 2);
            ctx.restore();
            ctx.save();
        } else {
            // Sin foto: circulo de color con iniciales
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = borderColor;
            ctx.fill();
        }

        // Borde
        ctx.shadowColor = 'transparent';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeStyle = isSelected ? '#FFD700' : borderColor;
        ctx.stroke();

        // Anillo de selección
        if (isSelected) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#FFD700';
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Texto (iniciales) - solo si no tiene foto
        if (!token._photoImg) {
            const label = this.getTokenLabel(token.name);
            const fontSize = Math.max(10, radius * 0.8);
            ctx.font = `bold ${fontSize}px Cinzel, serif`;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, cx, cy);
        }

        // Nombre completo debajo del token
        if (radius > 12) {
            const nameFontSize = Math.max(8, radius * 0.45);
            ctx.font = `${nameFontSize}px Cinzel, sans-serif`;
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            const nameY = cy + radius + nameFontSize + 2;
            ctx.strokeText(token.name, cx, nameY);
            ctx.fillText(token.name, cx, nameY);
        }

        ctx.restore();
    }

    // Obtener iniciales para mostrar en el token
    getTokenLabel(name) {
        if (!name) return '?';
        const words = name.trim().split(/\s+/);
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    // Obtener un color automático para un token nuevo
    static getTokenColor(index) {
        return TOKEN_COLORS[index % TOKEN_COLORS.length];
    }

    // ==========================================
    // Sistema de Spawn Points
    // ==========================================

    // Activar/desactivar herramienta de spawn
    setSpawnTool(active, type = 'player') {
        this.spawnToolActive = active;
        this.spawnToolType = type;
        this.showSpawnPoints = true;
        this.canvas.style.cursor = active ? 'crosshair' : 'default';
        this.render();
    }

    // Agregar spawn point en coordenadas de grid
    addSpawnPoint(gridX, gridY, type) {
        // No duplicar en la misma celda
        const existing = this.spawnPoints.find(sp => sp.gridX === gridX && sp.gridY === gridY);
        if (existing) return;

        const id = `spawn_${type}_${Date.now()}`;
        this.spawnPoints.push({ id, gridX, gridY, type });
        this.render();
        if (this.onSpawnPointsChanged) this.onSpawnPointsChanged(this.spawnPoints);
    }

    // Eliminar spawn point en coordenadas de grid
    removeSpawnPoint(gridX, gridY) {
        const idx = this.spawnPoints.findIndex(sp => sp.gridX === gridX && sp.gridY === gridY);
        if (idx >= 0) {
            this.spawnPoints.splice(idx, 1);
            this.render();
            if (this.onSpawnPointsChanged) this.onSpawnPointsChanged(this.spawnPoints);
            return true;
        }
        return false;
    }

    // Obtener spawn point en coordenadas de pixel
    getSpawnAtPixel(px, py) {
        const { gridX, gridY } = this.pixelToGrid(px, py);
        return this.spawnPoints.find(sp => sp.gridX === gridX && sp.gridY === gridY) || null;
    }

    // Obtener spawn points por tipo
    getSpawnPointsByType(type) {
        return this.spawnPoints.filter(sp => sp.type === type);
    }

    // Dibujar spawn points (solo visible para admin)
    drawSpawnPoints() {
        const cellSize = this.getCellSize();
        const radius = cellSize * 0.3;

        for (const sp of this.spawnPoints) {
            const center = this.gridToCenter(sp.gridX, sp.gridY);
            this.drawSingleSpawnPoint(center.x, center.y, radius, sp);
        }
    }

    drawSingleSpawnPoint(cx, cy, radius, spawnPoint) {
        const ctx = this.ctx;
        const isPlayer = spawnPoint.type === 'player';

        ctx.save();
        ctx.globalAlpha = 0.45;

        // Fondo del marcador
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = isPlayer ? '#2ecc71' : '#e74c3c';
        ctx.fill();

        // Borde
        ctx.lineWidth = 2;
        ctx.strokeStyle = isPlayer ? '#27ae60' : '#c0392b';
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Icono interior: "S" para spawn
        ctx.globalAlpha = 0.7;
        const fontSize = Math.max(10, radius * 0.9);
        ctx.font = `bold ${fontSize}px Cinzel, serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isPlayer ? 'J' : 'M', cx, cy);

        // Etiqueta debajo
        if (radius > 10) {
            ctx.globalAlpha = 0.5;
            const labelSize = Math.max(7, radius * 0.4);
            ctx.font = `${labelSize}px Cinzel, sans-serif`;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            const label = isPlayer ? 'Jugador' : 'NPC';
            const labelY = cy + radius + labelSize + 1;
            ctx.strokeText(label, cx, labelY);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, cx, labelY);
        }

        ctx.restore();
    }

    // ==========================================
    // Métodos para cargar/guardar estado
    // ==========================================

    loadState(imageData, imageTransform, gridConfig, distanceConfig, spawnPoints) {
        if (gridConfig) {
            this.gridConfig = { ...this.gridConfig, ...gridConfig };
        }
        if (distanceConfig) {
            this.distanceConfig = { ...this.distanceConfig, ...distanceConfig };
        }
        if (imageTransform) {
            this.imageTransform = { ...this.imageTransform, ...imageTransform };
        }
        if (spawnPoints) {
            this.spawnPoints = [...spawnPoints];
        }
        if (imageData) {
            this.loadImageFromData(imageData);
        } else {
            this.render();
        }
    }

    getState() {
        return {
            imageData: this.imageDataUrl,
            imageTransform: this.imageTransform,
            gridConfig: this.gridConfig,
            distanceConfig: this.distanceConfig,
            spawnPoints: this.spawnPoints
        };
    }
}
