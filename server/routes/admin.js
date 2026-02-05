// ==========================================
// Rutas de API para panel de administración
// ==========================================

const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { ipRestriction } = require('../middleware/ipRestriction');

// Aplicar restricción por IP a todas las rutas de admin
router.use(ipRestriction);

// Obtener todas las salas
router.get('/rooms', async (req, res) => {
    try {
        const rooms = await db.adminGetAllRooms();
        res.json({ success: true, rooms });
    } catch (error) {
        console.error('Error obteniendo salas (admin):', error);
        res.status(500).json({ error: 'Error al obtener salas' });
    }
});

// Obtener estadísticas
router.get('/stats', async (req, res) => {
    try {
        const stats = await db.adminGetStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// Eliminar una sala
router.delete('/rooms/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const deleted = await db.adminDeleteRoom(code);

        if (deleted) {
            res.json({ success: true, deleted });
        } else {
            res.status(404).json({ error: 'Sala no encontrada' });
        }
    } catch (error) {
        console.error('Error eliminando sala:', error);
        res.status(500).json({ error: 'Error al eliminar sala' });
    }
});

// Eliminar múltiples salas
router.post('/rooms/delete-multiple', async (req, res) => {
    try {
        const { codes } = req.body;

        if (!codes || !Array.isArray(codes) || codes.length === 0) {
            return res.status(400).json({ error: 'Se requiere un array de códigos' });
        }

        const deleted = await db.adminDeleteMultipleRooms(codes);
        res.json({ success: true, deleted, count: deleted.length });
    } catch (error) {
        console.error('Error eliminando salas:', error);
        res.status(500).json({ error: 'Error al eliminar salas' });
    }
});

// Forzar limpieza de salas inactivas
router.post('/cleanup', async (req, res) => {
    try {
        const { days = 7 } = req.body;
        const deleted = await db.cleanupInactiveRooms(days);
        res.json({ success: true, deleted, count: deleted.length });
    } catch (error) {
        console.error('Error en limpieza:', error);
        res.status(500).json({ error: 'Error en limpieza' });
    }
});

module.exports = router;
