// ==========================================
// Controlador de NPCs
// ==========================================

const db = require('../db/database');

// Listar NPCs de una sala
async function getNpcs(req, res) {
    try {
        const { code } = req.params;
        const { adminPassword } = req.body;

        // Verificar acceso de admin (solo admin puede ver NPCs con notas)
        const room = await db.verifyAdminAccess(code, adminPassword);
        if (!room) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const npcs = await db.getNpcs(code);

        res.json({
            success: true,
            npcs: npcs.map(n => ({
                id: n.id,
                name: n.name,
                type: n.type,
                description: n.description,
                notes: n.notes,
                npcData: n.npc_data,
                createdAt: n.created_at,
                updatedAt: n.updated_at
            }))
        });
    } catch (error) {
        console.error('Error al obtener NPCs:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Crear nuevo NPC
async function createNpc(req, res) {
    try {
        const { code } = req.params;
        const { adminPassword, name, type, description, notes, npcData } = req.body;

        if (!adminPassword || !name) {
            return res.status(400).json({ error: 'Se requiere adminPassword y name' });
        }

        // Verificar acceso de admin
        const room = await db.verifyAdminAccess(code, adminPassword);
        if (!room) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const npc = await db.createNpc(code, { name, type, description, notes, npcData });

        res.json({
            success: true,
            npc: {
                id: npc.id,
                name: npc.name,
                type: npc.type,
                description: npc.description,
                notes: npc.notes,
                npcData: npc.npc_data,
                createdAt: npc.created_at,
                updatedAt: npc.updated_at
            }
        });
    } catch (error) {
        console.error('Error al crear NPC:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Actualizar NPC
async function updateNpc(req, res) {
    try {
        const { code, npcId } = req.params;
        const { adminPassword, name, type, description, notes, npcData } = req.body;

        if (!adminPassword) {
            return res.status(400).json({ error: 'Se requiere adminPassword' });
        }

        // Verificar acceso de admin
        const room = await db.verifyAdminAccess(code, adminPassword);
        if (!room) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        // Verificar que el NPC pertenece a la sala
        const existingNpc = await db.getNpcById(npcId);
        if (!existingNpc || existingNpc.room_code !== code.toUpperCase()) {
            return res.status(404).json({ error: 'NPC no encontrado' });
        }

        const npc = await db.updateNpc(npcId, { name, type, description, notes, npcData });

        res.json({
            success: true,
            npc: {
                id: npc.id,
                name: npc.name,
                type: npc.type,
                description: npc.description,
                notes: npc.notes,
                npcData: npc.npc_data,
                createdAt: npc.created_at,
                updatedAt: npc.updated_at
            }
        });
    } catch (error) {
        console.error('Error al actualizar NPC:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Eliminar NPC
async function deleteNpc(req, res) {
    try {
        const { code, npcId } = req.params;
        const { adminPassword } = req.body;

        if (!adminPassword) {
            return res.status(400).json({ error: 'Se requiere adminPassword' });
        }

        // Verificar acceso de admin
        const room = await db.verifyAdminAccess(code, adminPassword);
        if (!room) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        // Verificar que el NPC pertenece a la sala
        const existingNpc = await db.getNpcById(npcId);
        if (!existingNpc || existingNpc.room_code !== code.toUpperCase()) {
            return res.status(404).json({ error: 'NPC no encontrado' });
        }

        const deleted = await db.deleteNpc(npcId);

        res.json({
            success: true,
            deleted: {
                id: deleted.id,
                name: deleted.name
            }
        });
    } catch (error) {
        console.error('Error al eliminar NPC:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Obtener jugadores de una sala (con sus personajes)
async function getPlayers(req, res) {
    try {
        const { code } = req.params;
        const { adminPassword } = req.body;

        if (!adminPassword) {
            return res.status(400).json({ error: 'Se requiere adminPassword' });
        }

        // Verificar acceso de admin
        const room = await db.verifyAdminAccess(code, adminPassword);
        if (!room) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const players = await db.getRoomPlayers(code);

        res.json({
            success: true,
            players: players.map(p => ({
                id: p.id,
                userId: p.user_id,
                playerName: p.player_name,
                characterName: p.character_name,
                characterData: p.character_data,
                completionPercent: p.completion_percent
            }))
        });
    } catch (error) {
        console.error('Error al obtener jugadores:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

module.exports = {
    getNpcs,
    createNpc,
    updateNpc,
    deleteNpc,
    getPlayers
};
