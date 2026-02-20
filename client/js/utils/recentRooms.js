// ==========================================
// Servicio de Partidas Recientes
// Guarda y recupera historial de conexiones
// ==========================================

const STORAGE_KEY = 'dnd_recent_rooms';
const MAX_RECENT_ROOMS = 10; // Máximo por categoría

/**
 * Estructura de una partida reciente:
 * {
 *   code: string,           // Código de la sala
 *   name: string,           // Nombre de la sala
 *   role: 'dm' | 'player',  // Rol del usuario
 *   characterName?: string, // Nombre del personaje (solo jugadores)
 *   playerName?: string,    // Nombre real del jugador
 *   lastAccess: number,     // Timestamp de última conexión
 *   adminToken?: string     // Token de admin (solo DMs, para reconexión)
 * }
 */

// Obtener todas las partidas recientes
function getRecentRooms() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : { dm: [], player: [] };
    } catch (e) {
        console.error('Error leyendo partidas recientes:', e);
        return { dm: [], player: [] };
    }
}

// Guardar partidas recientes
function saveRecentRooms(rooms) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
    } catch (e) {
        console.error('Error guardando partidas recientes:', e);
    }
}

// Agregar partida como DM
function addDMRoom(room, adminPassword) {
    const rooms = getRecentRooms();

    // Eliminar si ya existe
    rooms.dm = rooms.dm.filter(r => r.code !== room.code);

    // Agregar al principio
    rooms.dm.unshift({
        code: room.code,
        name: room.name,
        role: 'dm',
        lastAccess: Date.now(),
        adminToken: adminPassword // Guardamos para reconexión rápida
    });

    // Limitar cantidad
    rooms.dm = rooms.dm.slice(0, MAX_RECENT_ROOMS);

    saveRecentRooms(rooms);
}

// Agregar partida como jugador
function addPlayerRoom(room, playerName, characterName) {
    const rooms = getRecentRooms();

    // Eliminar si ya existe
    rooms.player = rooms.player.filter(r => r.code !== room.code);

    // Agregar al principio
    rooms.player.unshift({
        code: room.code,
        name: room.name,
        role: 'player',
        playerName: playerName,
        characterName: characterName,
        lastAccess: Date.now()
    });

    // Limitar cantidad
    rooms.player = rooms.player.slice(0, MAX_RECENT_ROOMS);

    saveRecentRooms(rooms);
}

// Obtener partidas como DM
function getDMRooms() {
    return getRecentRooms().dm || [];
}

// Obtener partidas como jugador
function getPlayerRooms() {
    return getRecentRooms().player || [];
}

// Eliminar una partida del historial
function removeRoom(code, role) {
    const rooms = getRecentRooms();

    if (role === 'dm') {
        rooms.dm = rooms.dm.filter(r => r.code !== code);
    } else {
        rooms.player = rooms.player.filter(r => r.code !== code);
    }

    saveRecentRooms(rooms);
}

// Formatear fecha relativa
function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes}m`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days}d`;

    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export {
    getRecentRooms,
    addDMRoom,
    addPlayerRoom,
    getDMRooms,
    getPlayerRooms,
    removeRoom,
    formatRelativeTime
};
