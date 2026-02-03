// ==========================================
// Controlador de Funcionalidades de Juego
// Notas de sesion, dados, combate
// ==========================================

const db = require('../db/database');

// ==========================================
// NOTAS DE SESION
// ==========================================

// Listar notas
async function getSessionNotes(req, res) {
    try {
        const { code } = req.params;
        const { adminPassword } = req.body;

        // Verificar acceso de admin
        const room = await db.verifyAdminAccess(code, adminPassword);
        if (!room) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const notes = await db.getSessionNotes(code);

        res.json({
            success: true,
            notes: notes.map(n => ({
                id: n.id,
                title: n.title,
                content: n.content,
                category: n.category,
                createdAt: n.created_at,
                updatedAt: n.updated_at
            }))
        });
    } catch (error) {
        console.error('Error al obtener notas:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Crear nota
async function createSessionNote(req, res) {
    try {
        const { code } = req.params;
        const { adminPassword, title, content, category } = req.body;

        if (!adminPassword || !title) {
            return res.status(400).json({ error: 'Se requiere adminPassword y title' });
        }

        // Verificar acceso de admin
        const room = await db.verifyAdminAccess(code, adminPassword);
        if (!room) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const note = await db.createSessionNote(code, { title, content, category });

        res.json({
            success: true,
            note: {
                id: note.id,
                title: note.title,
                content: note.content,
                category: note.category,
                createdAt: note.created_at,
                updatedAt: note.updated_at
            }
        });
    } catch (error) {
        console.error('Error al crear nota:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Actualizar nota
async function updateSessionNote(req, res) {
    try {
        const { code, noteId } = req.params;
        const { adminPassword, title, content, category } = req.body;

        if (!adminPassword) {
            return res.status(400).json({ error: 'Se requiere adminPassword' });
        }

        // Verificar acceso de admin
        const room = await db.verifyAdminAccess(code, adminPassword);
        if (!room) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const note = await db.updateSessionNote(noteId, { title, content, category });

        if (!note) {
            return res.status(404).json({ error: 'Nota no encontrada' });
        }

        res.json({
            success: true,
            note: {
                id: note.id,
                title: note.title,
                content: note.content,
                category: note.category,
                createdAt: note.created_at,
                updatedAt: note.updated_at
            }
        });
    } catch (error) {
        console.error('Error al actualizar nota:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Eliminar nota
async function deleteSessionNote(req, res) {
    try {
        const { code, noteId } = req.params;
        const { adminPassword } = req.body;

        if (!adminPassword) {
            return res.status(400).json({ error: 'Se requiere adminPassword' });
        }

        // Verificar acceso de admin
        const room = await db.verifyAdminAccess(code, adminPassword);
        if (!room) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const deleted = await db.deleteSessionNote(noteId);

        if (!deleted) {
            return res.status(404).json({ error: 'Nota no encontrada' });
        }

        res.json({
            success: true,
            deleted: { id: deleted.id, title: deleted.title }
        });
    } catch (error) {
        console.error('Error al eliminar nota:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// ==========================================
// HISTORIAL DE DADOS
// ==========================================

// Obtener historial de tiradas
async function getDiceRollHistory(req, res) {
    try {
        const { code } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        // Verificar que la sala existe
        const room = await db.getRoomByCode(code);
        if (!room) {
            return res.status(404).json({ error: 'Sala no encontrada' });
        }

        const rolls = await db.getDiceRollHistory(code, limit);

        res.json({
            success: true,
            rolls: rolls.map(r => ({
                id: r.id,
                userName: r.user_name,
                characterName: r.character_name,
                rollType: r.roll_type,
                diceFormula: r.dice_formula,
                results: r.results,
                modifier: r.modifier,
                total: r.total,
                createdAt: r.created_at
            }))
        });
    } catch (error) {
        console.error('Error al obtener historial de dados:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// ==========================================
// TRACKER DE COMBATE
// ==========================================

// Obtener tracker de combate
async function getCombatTracker(req, res) {
    try {
        const { code } = req.params;

        // Verificar que la sala existe
        const room = await db.getRoomByCode(code);
        if (!room) {
            return res.status(404).json({ error: 'Sala no encontrada' });
        }

        const tracker = await db.getCombatTracker(code);

        res.json({
            success: true,
            tracker: {
                id: tracker.id,
                isActive: tracker.is_active,
                currentTurn: tracker.current_turn,
                roundNumber: tracker.round_number,
                combatants: tracker.combatants,
                updatedAt: tracker.updated_at
            }
        });
    } catch (error) {
        console.error('Error al obtener tracker de combate:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Actualizar tracker de combate (solo admin)
async function updateCombatTracker(req, res) {
    try {
        const { code } = req.params;
        const { adminPassword, isActive, currentTurn, roundNumber, combatants } = req.body;

        if (!adminPassword) {
            return res.status(400).json({ error: 'Se requiere adminPassword' });
        }

        // Verificar acceso de admin
        const room = await db.verifyAdminAccess(code, adminPassword);
        if (!room) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const tracker = await db.updateCombatTracker(code, {
            isActive, currentTurn, roundNumber, combatants
        });

        res.json({
            success: true,
            tracker: {
                id: tracker.id,
                isActive: tracker.is_active,
                currentTurn: tracker.current_turn,
                roundNumber: tracker.round_number,
                combatants: tracker.combatants,
                updatedAt: tracker.updated_at
            }
        });
    } catch (error) {
        console.error('Error al actualizar tracker:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Resetear tracker de combate
async function resetCombatTracker(req, res) {
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

        const tracker = await db.resetCombatTracker(code);

        res.json({
            success: true,
            tracker: {
                id: tracker.id,
                isActive: tracker.is_active,
                currentTurn: tracker.current_turn,
                roundNumber: tracker.round_number,
                combatants: tracker.combatants
            }
        });
    } catch (error) {
        console.error('Error al resetear tracker:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

module.exports = {
    // Notas
    getSessionNotes,
    createSessionNote,
    updateSessionNote,
    deleteSessionNote,
    // Dados
    getDiceRollHistory,
    // Combate
    getCombatTracker,
    updateCombatTracker,
    resetCombatTracker
};
