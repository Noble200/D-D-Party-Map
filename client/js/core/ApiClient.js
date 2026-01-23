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
}

// Exportar instancia única
export const apiClient = new ApiClient();
