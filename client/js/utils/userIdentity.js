// ==========================================
// Sistema de identificación de usuarios
// ==========================================

const STORAGE_KEYS = {
    USER_HASH: 'dyd_user_hash',
    PLAYER_NAME: 'dyd_player_name',
    USER_ID: 'dyd_user_id'
};

// Generar hash único para identificar al usuario
function generateHash() {
    // Usar crypto.randomUUID si está disponible
    if (crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback para navegadores antiguos
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Obtener o crear hash del usuario
export function getUserHash() {
    let hash = localStorage.getItem(STORAGE_KEYS.USER_HASH);
    if (!hash) {
        hash = generateHash();
        localStorage.setItem(STORAGE_KEYS.USER_HASH, hash);
    }
    return hash;
}

// Guardar nombre del jugador
export function setPlayerName(name) {
    if (name) {
        localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name);
    }
}

// Obtener nombre del jugador guardado
export function getPlayerName() {
    return localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || '';
}

// Guardar ID del usuario (del servidor)
export function setUserId(id) {
    if (id) {
        localStorage.setItem(STORAGE_KEYS.USER_ID, id);
    }
}

// Obtener ID del usuario
export function getUserId() {
    return localStorage.getItem(STORAGE_KEYS.USER_ID) || null;
}

// Limpiar todos los datos de identidad (para cambiar de usuario)
export function clearIdentity() {
    localStorage.removeItem(STORAGE_KEYS.USER_HASH);
    localStorage.removeItem(STORAGE_KEYS.PLAYER_NAME);
    localStorage.removeItem(STORAGE_KEYS.USER_ID);
}

// Verificar si el usuario tiene identidad guardada
export function hasStoredIdentity() {
    return !!localStorage.getItem(STORAGE_KEYS.USER_HASH);
}

export default {
    getUserHash,
    setPlayerName,
    getPlayerName,
    setUserId,
    getUserId,
    clearIdentity,
    hasStoredIdentity
};
