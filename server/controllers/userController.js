// ==========================================
// Controlador de Usuarios
// ==========================================

const db = require('../db/database');

// Identificar o crear usuario por hash
async function identifyUser(req, res) {
    try {
        const { userHash, playerName } = req.body;

        if (!userHash) {
            return res.status(400).json({ error: 'Se requiere userHash' });
        }

        const user = await db.createOrGetUser(userHash, playerName);

        res.json({
            success: true,
            user: {
                id: user.id,
                playerName: user.player_name,
                createdAt: user.created_at,
                lastSeen: user.last_seen
            }
        });
    } catch (error) {
        console.error('Error al identificar usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Obtener usuario por ID
async function getUser(req, res) {
    try {
        const { userHash } = req.params;

        const user = await db.getUserByHash(userHash);

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                playerName: user.player_name,
                createdAt: user.created_at,
                lastSeen: user.last_seen
            }
        });
    } catch (error) {
        console.error('Error al obtener usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

module.exports = {
    identifyUser,
    getUser
};
