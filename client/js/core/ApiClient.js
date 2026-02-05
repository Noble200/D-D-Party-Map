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

    // Obtener personaje por nombre de jugador (nuevo metodo simplificado)
    async getCharacterByPlayerName(roomCode, playerName) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/character?playerName=${encodeURIComponent(playerName)}`);
        return response.json();
    }

    // Guardar personaje por nombre de jugador (nuevo metodo simplificado)
    async saveCharacterByPlayerName(roomCode, playerName, characterName, characterData) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/character`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerName, characterName, characterData })
        });
        return response.json();
    }

    // Obtener personaje de usuario en sala (legacy)
    async getCharacter(roomCode, userId) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/characters/${userId}`);
        return response.json();
    }

    // Crear o actualizar personaje (legacy)
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

    // ==========================================
    // NPCs
    // ==========================================

    // Listar NPCs de la sala
    async getNpcs(roomCode, adminPassword) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/npcs/list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword })
        });
        return response.json();
    }

    // Crear nuevo NPC
    async createNpc(roomCode, adminPassword, data) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/npcs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword, ...data })
        });
        return response.json();
    }

    // Actualizar NPC
    async updateNpc(roomCode, npcId, adminPassword, data) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/npcs/${npcId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword, ...data })
        });
        return response.json();
    }

    // Eliminar NPC
    async deleteNpc(roomCode, npcId, adminPassword) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/npcs/${npcId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword })
        });
        return response.json();
    }

    // ==========================================
    // JUGADORES DE SALA
    // ==========================================

    // Listar jugadores de la sala
    async getRoomPlayers(roomCode, adminPassword) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/players`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword })
        });
        return response.json();
    }

    // ==========================================
    // NOTAS DE SESION
    // ==========================================

    // Listar notas
    async getSessionNotes(roomCode, adminPassword) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/notes/list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword })
        });
        return response.json();
    }

    // Crear nota
    async createSessionNote(roomCode, adminPassword, data) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword, ...data })
        });
        return response.json();
    }

    // Actualizar nota
    async updateSessionNote(roomCode, noteId, adminPassword, data) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/notes/${noteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword, ...data })
        });
        return response.json();
    }

    // Eliminar nota
    async deleteSessionNote(roomCode, noteId, adminPassword) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/notes/${noteId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword })
        });
        return response.json();
    }

    // ==========================================
    // HISTORIAL DE DADOS
    // ==========================================

    // Obtener historial de tiradas
    async getDiceRollHistory(roomCode, limit = 50) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/dice/history?limit=${limit}`);
        return response.json();
    }

    // ==========================================
    // TRACKER DE COMBATE
    // ==========================================

    // Obtener tracker de combate
    async getCombatTracker(roomCode) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/combat`);
        return response.json();
    }

    // Actualizar tracker
    async updateCombatTracker(roomCode, adminPassword, data) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/combat`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword, ...data })
        });
        return response.json();
    }

    // Resetear tracker
    async resetCombatTracker(roomCode, adminPassword) {
        const response = await fetch(`${API_URL}/rooms/${roomCode}/combat/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword })
        });
        return response.json();
    }
}

// Exportar instancia única
export const apiClient = new ApiClient();
