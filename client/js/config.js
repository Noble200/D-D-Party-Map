// ==========================================
// Configuración de la aplicación
// ==========================================

// URL base de la API (usa la URL actual del servidor)
export const API_URL = '/api';

// Configuración por defecto de la imagen
export const DEFAULT_IMAGE_TRANSFORM = {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0
};

// Configuración por defecto de la cuadrícula
export const DEFAULT_GRID_CONFIG = {
    size: 50,
    opacity: 0.5,
    color: '#ffffff',
    lineWidth: 1,
    visible: true,
    offsetX: 0,
    offsetY: 0
};

// Límites de zoom
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.1;

// Modos de administrador
export const ADMIN_MODES = {
    EDIT: 'edit',
    MASTER: 'master'
};
