// ==========================================
// Editor de mapas - Renderizado e interacción del canvas
// ==========================================

import { DEFAULT_IMAGE_TRANSFORM, DEFAULT_GRID_CONFIG, ZOOM_MIN, ZOOM_MAX } from '../config.js';

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

        // Estado del arrastre
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };

        // Callbacks para controles UI
        this.onScaleChange = null;

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
        if (!this.ctx) return;
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

    // ==========================================
    // Métodos para cargar/guardar estado
    // ==========================================

    loadState(imageData, imageTransform, gridConfig) {
        if (gridConfig) {
            this.gridConfig = { ...this.gridConfig, ...gridConfig };
        }
        if (imageTransform) {
            this.imageTransform = { ...this.imageTransform, ...imageTransform };
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
            gridConfig: this.gridConfig
        };
    }
}
