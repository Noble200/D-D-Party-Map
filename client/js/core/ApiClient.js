// ==========================================
// Cliente de API - Comunicación con el servidor
// ==========================================

import { API_URL } from '../config.js';

class ApiClient {
    // Crear nueva sala
    async createRoom(name, adminPassword) {
        const response = await fetch(`${API_URL}/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, adminPassword })
        });
        return response.json();
    }

    // Verificar acceso de admin
    async verifyAdmin(code, adminPassword) {
        const response = await fetch(`${API_URL}/rooms/${code}/admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword })
        });
        return response.json();
    }

    // Obtener sala (solo lectura para jugadores)
    async getRoom(code) {
        const response = await fetch(`${API_URL}/rooms/${code}`);
        return response.json();
    }

    // Actualizar sala (admin)
    async updateRoom(code, adminPassword, imageData, imageTransform, gridConfig) {
        const response = await fetch(`${API_URL}/rooms/${code}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminPassword,
                imageData,
                imageTransform,
                gridConfig
            })
        });
        return response.json();
    }

    // Listar salas de un admin
    async listRooms(adminPassword) {
        const response = await fetch(`${API_URL}/rooms/list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword })
        });
        return response.json();
    }

    // ==========================================
    // USUARIOS
    // ==========================================

    // Identificar o crear usuario
    async identifyUser(userHash, playerName) {
        const response = await fetch(`${API_URL}/users/identify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userHash, playerName })
        });
        return response.json();
    }

    // ==========================================
    // PERSONAJES
    // ==========================================

    // Obtener personaje de usuario en sala
    async getCharacter(roomCode, userId) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/characters/${userId}`);
        return response.json();
    }

    // Crear o actualizar personaje
    async saveCharacter(roomCode, userId, characterName, characterData) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/characters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, characterName, characterData })
        });
        return response.json();
    }

    // Actualizar personaje existente
    async updateCharacter(roomCode, characterId, characterName, characterData) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/characters/${characterId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterName, characterData })
        });
        return response.json();
    }

    // ==========================================
    // MAPAS
    // ==========================================

    // Obtener mapa activo
    async getActiveMap(roomCode) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/maps/active`);
        return response.json();
    }

    // Listar todos los mapas de la sala
    async getMaps(roomCode) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/maps`);
        return response.json();
    }

    // Crear nuevo mapa
    async createMap(roomCode, adminPassword, name, imageData = null, imageTransform = null, gridConfig = null, distanceConfig = null) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/maps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminPassword,
                name,
                imageData,
                imageTransform,
                gridConfig,
                distanceConfig
            })
        });
        return response.json();
    }

    // Actualizar mapa
    async updateMap(roomCode, mapId, adminPassword, data) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/maps/${mapId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminPassword,
                ...data
            })
        });
        return response.json();
    }

    // Activar mapa
    async activateMap(roomCode, mapId, adminPassword) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/maps/${mapId}/activate`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword })
        });
        return response.json();
    }

    // Eliminar mapa
    async deleteMap(roomCode, mapId, adminPassword) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/maps/${mapId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword })
        });
        return response.json();
    }
}

// Exportar instancia única
export const apiClient = new ApiClient();
