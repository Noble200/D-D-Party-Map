// ==========================================
// Controlador de Personajes D&D
// ==========================================

const db = require('../db/database');

// Obtener personaje de usuario en sala
async function getCharacter(req, res) {
    try {
        const { code, userId } = req.params;

        const character = await db.getCharacter(userId, code);

        if (!character) {
            return res.json({
                success: true,
                character: null
            });
        }

        res.json({
            success: true,
            character: {
                id: character.id,
                characterName: character.character_name,
                characterData: character.character_data,
                completionPercent: character.completion_percent,
                createdAt: character.created_at,
                updatedAt: character.updated_at
            }
        });
    } catch (error) {
        console.error('Error al obtener personaje:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Crear o actualizar personaje
async function saveCharacter(req, res) {
    try {
        const { code } = req.params;
        const { userId, characterName, characterData } = req.body;

        if (!userId || !characterName) {
            return res.status(400).json({ error: 'Se requiere userId y characterName' });
        }

        // Verificar que la sala existe
        const room = await db.getRoomByCode(code);
        if (!room) {
            return res.status(404).json({ error: 'Sala no encontrada' });
        }

        // Verificar que el usuario existe
        const user = await db.getUserByHash(userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Crear o actualizar personaje
        const character = await db.createCharacter(
            user.id,
            code,
            characterName,
            characterData || {}
        );

        res.json({
            success: true,
            character: {
                id: character.id,
                characterName: character.character_name,
                characterData: character.character_data,
                completionPercent: character.completion_percent,
                createdAt: character.created_at,
                updatedAt: character.updated_at
            }
        });
    } catch (error) {
        console.error('Error al guardar personaje:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Actualizar personaje existente
async function updateCharacter(req, res) {
    try {
        const { code, characterId } = req.params;
        const { characterName, characterData } = req.body;

        const character = await db.updateCharacter(
            characterId,
            characterName,
            characterData
        );

        if (!character) {
            return res.status(404).json({ error: 'Personaje no encontrado' });
        }

        res.json({
            success: true,
            character: {
                id: character.id,
                characterName: character.character_name,
                characterData: character.character_data,
                completionPercent: character.completion_percent,
                createdAt: character.created_at,
                updatedAt: character.updated_at
            }
        });
    } catch (error) {
        console.error('Error al actualizar personaje:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

module.exports = {
    getCharacter,
    saveCharacter,
    updateCharacter
};
