// ==========================================
// Controlador de salas - Lógica de negocio
// ==========================================

const { nanoid } = require('nanoid');
const db = require('../db/database');

// Crear nueva sala
async function createRoom(req, res) {
    try {
        const { name, adminPassword } = req.body;

        if (!name || !adminPassword) {
            return res.status(400).json({ error: 'Nombre y contraseña son requeridos' });
        }

        const code = nanoid(8).toUpperCase();
        const room = await db.createRoom(code, name, adminPassword);

        res.json({
            success: true,
            room: {
                code: room.code,
                name: room.name
            }
        });
    } catch (error) {
        console.error('Error creando sala:', error);
        res.status(500).json({ error: 'Error al crear la sala' });
    }
}

// Verificar acceso de admin
async function verifyAdmin(req, res) {
    try {
        const { code } = req.params;
        const { adminPassword } = req.body;

        const room = await db.verifyAdminAccess(code, adminPassword);

        if (!room) {
            return res.status(401).json({ error: 'Código o contraseña incorrectos' });
        }

        res.json({ success: true, room });
    } catch (error) {
        console.error('Error verificando admin:', error);
        res.status(500).json({ error: 'Error de verificación' });
    }
}

// Obtener sala (solo lectura para jugadores)
async function getRoom(req, res) {
    try {
        const { code } = req.params;
        const room = await db.getRoomByCode(code);

        if (!room) {
            return res.status(404).json({ error: 'Sala no encontrada' });
        }

        res.json({ success: true, room });
    } catch (error) {
        console.error('Error obteniendo sala:', error);
        res.status(500).json({ error: 'Error al obtener la sala' });
    }
}

// Actualizar sala (admin)
async function updateRoom(req, res) {
    try {
        const { code } = req.params;
        const { adminPassword, imageData, imageTransform, gridConfig } = req.body;

        const room = await db.updateRoom(code, adminPassword, imageData, imageTransform, gridConfig);

        if (!room) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        res.json({ success: true, room });
    } catch (error) {
        console.error('Error actualizando sala:', error);
        res.status(500).json({ error: 'Error al actualizar la sala' });
    }
}

// Listar salas de un admin
async function listRooms(req, res) {
    try {
        const { adminPassword } = req.body;
        const rooms = await db.listRoomsByAdmin(adminPassword);

        res.json({ success: true, rooms });
    } catch (error) {
        console.error('Error listando salas:', error);
        res.status(500).json({ error: 'Error al listar salas' });
    }
}

module.exports = {
    createRoom,
    verifyAdmin,
    getRoom,
    updateRoom,
    listRooms
};
