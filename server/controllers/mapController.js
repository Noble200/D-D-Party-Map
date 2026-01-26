// ==========================================
// Controlador de Mapas
// ==========================================

const db = require('../db/database');

// Listar mapas de una sala
async function getMaps(req, res) {
    try {
        const { code } = req.params;

        // Verificar que la sala existe
        const room = await db.getRoomByCode(code);
        if (!room) {
            return res.status(404).json({ error: 'Sala no encontrada' });
        }

        const maps = await db.getMaps(code);

        res.json({
            success: true,
            maps: maps.map(m => ({
                id: m.id,
                name: m.name,
                imageData: m.image_data,
                imageTransform: m.image_transform,
                gridConfig: m.grid_config,
                distanceConfig: m.distance_config,
                isActive: m.is_active,
                displayOrder: m.display_order,
                createdAt: m.created_at,
                updatedAt: m.updated_at
            }))
        });
    } catch (error) {
        console.error('Error al obtener mapas:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Obtener mapa activo
async function getActiveMap(req, res) {
    try {
        const { code } = req.params;

        // Verificar que la sala existe
        const room = await db.getRoomByCode(code);
        if (!room) {
            return res.status(404).json({ error: 'Sala no encontrada' });
        }

        const map = await db.getActiveMap(code);

        if (!map) {
            return res.json({
                success: true,
                map: null
            });
        }

        res.json({
            success: true,
            map: {
                id: map.id,
                name: map.name,
                imageData: map.image_data,
                imageTransform: map.image_transform,
                gridConfig: map.grid_config,
                distanceConfig: map.distance_config,
                isActive: map.is_active,
                displayOrder: map.display_order,
                createdAt: map.created_at,
                updatedAt: map.updated_at
            }
        });
    } catch (error) {
        console.error('Error al obtener mapa activo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Crear nuevo mapa
async function createMap(req, res) {
    try {
        const { code } = req.params;
        const { adminPassword, name, imageData, imageTransform, gridConfig, distanceConfig } = req.body;

        if (!adminPassword || !name) {
            return res.status(400).json({ error: 'Se requiere adminPassword y name' });
        }

        // Verificar acceso de admin
        const room = await db.verifyAdminAccess(code, adminPassword);
        if (!room) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const map = await db.createMap(code, name, imageData, imageTransform, gridConfig, distanceConfig);

        res.json({
            success: true,
            map: {
                id: map.id,
                name: map.name,
                imageData: map.image_data,
                imageTransform: map.image_transform,
                gridConfig: map.grid_config,
                distanceConfig: map.distance_config,
                isActive: map.is_active,
                displayOrder: map.display_order,
                createdAt: map.created_at,
                updatedAt: map.updated_at
            }
        });
    } catch (error) {
        console.error('Error al crear mapa:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Actualizar mapa
async function updateMap(req, res) {
    try {
        const { code, mapId } = req.params;
        const { adminPassword, name, imageData, imageTransform, gridConfig, distanceConfig } = req.body;

        if (!adminPassword) {
            return res.status(400).json({ error: 'Se requiere adminPassword' });
        }

        // Verificar acceso de admin
        const room = await db.verifyAdminAccess(code, adminPassword);
        if (!room) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        // Verificar que el mapa pertenece a la sala
        const existingMap = await db.getMapById(mapId);
        if (!existingMap || existingMap.room_code !== code.toUpperCase()) {
            return res.status(404).json({ error: 'Mapa no encontrado' });
        }

        const map = await db.updateMap(mapId, { name, imageData, imageTransform, gridConfig, distanceConfig });

        res.json({
            success: true,
            map: {
                id: map.id,
                name: map.name,
                imageData: map.image_data,
                imageTransform: map.image_transform,
                gridConfig: map.grid_config,
                distanceConfig: map.distance_config,
                isActive: map.is_active,
                displayOrder: map.display_order,
                createdAt: map.created_at,
                updatedAt: map.updated_at
            }
        });
    } catch (error) {
        console.error('Error al actualizar mapa:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Activar mapa
async function activateMap(req, res) {
    try {
        const { code, mapId } = req.params;
        const { adminPassword } = req.body;

        if (!adminPassword) {
            return res.status(400).json({ error: 'Se requiere adminPassword' });
        }

        // Verificar acceso de admin
        const room = await db.verifyAdminAccess(code, adminPassword);
        if (!room) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const map = await db.setActiveMap(code, mapId);

        if (!map) {
            return res.status(404).json({ error: 'Mapa no encontrado' });
        }

        res.json({
            success: true,
            map: {
                id: map.id,
                name: map.name,
                isActive: map.is_active
            }
        });
    } catch (error) {
        console.error('Error al activar mapa:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Eliminar mapa
async function deleteMap(req, res) {
    try {
        const { code, mapId } = req.params;
        const { adminPassword } = req.body;

        if (!adminPassword) {
            return res.status(400).json({ error: 'Se requiere adminPassword' });
        }

        // Verificar acceso de admin
        const room = await db.verifyAdminAccess(code, adminPassword);
        if (!room) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        // Verificar que el mapa pertenece a la sala
        const existingMap = await db.getMapById(mapId);
        if (!existingMap || existingMap.room_code !== code.toUpperCase()) {
            return res.status(404).json({ error: 'Mapa no encontrado' });
        }

        // No permitir eliminar el único mapa o el mapa activo
        const maps = await db.getMaps(code);
        if (maps.length <= 1) {
            return res.status(400).json({ error: 'No se puede eliminar el único mapa de la sala' });
        }
        if (existingMap.is_active) {
            return res.status(400).json({ error: 'No se puede eliminar el mapa activo. Activa otro mapa primero.' });
        }

        const deleted = await db.deleteMap(mapId);

        res.json({
            success: true,
            deleted: {
                id: deleted.id,
                name: deleted.name
            }
        });
    } catch (error) {
        console.error('Error al eliminar mapa:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

module.exports = {
    getMaps,
    getActiveMap,
    createMap,
    updateMap,
    activateMap,
    deleteMap
};
