// ==========================================
// Rutas de API para salas
// ==========================================

const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const characterController = require('../controllers/characterController');
const mapController = require('../controllers/mapController');
const npcController = require('../controllers/npcController');
const gameController = require('../controllers/gameController');

// Listar salas de un admin (por contraseña) - DEBE IR ANTES de :code
router.post('/list', roomController.listRooms);

// Listar salas activas (público)
router.get('/active', roomController.listActiveRooms);

// Crear nueva sala
router.post('/', roomController.createRoom);

// Verificar acceso admin - DEBE IR ANTES de GET :code
router.post('/:code/admin', roomController.verifyAdmin);

// Actualizar sala (admin)
router.put('/:code', roomController.updateRoom);

// Obtener sala (solo lectura para jugadores)
router.get('/:code', roomController.getRoom);

// ==========================================
// Rutas de personajes
// ==========================================

// Obtener personaje por nombre de jugador (nueva ruta simplificada)
router.get('/:code/character', characterController.getCharacterByPlayer);

// Guardar personaje por nombre de jugador (nueva ruta simplificada)
router.post('/:code/character', characterController.saveCharacterByPlayer);

// Obtener personaje de usuario en sala (legacy - por userId)
router.get('/:code/characters/:userId', characterController.getCharacter);

// Crear o actualizar personaje (legacy - por userId)
router.post('/:code/characters', characterController.saveCharacter);

// Actualizar personaje específico
router.put('/:code/characters/:characterId', characterController.updateCharacter);

// ==========================================
// Rutas de mapas
// ==========================================

// Obtener mapa activo (lectura para jugadores)
router.get('/:code/maps/active', mapController.getActiveMap);

// Listar todos los mapas de la sala
router.get('/:code/maps', mapController.getMaps);

// Crear nuevo mapa (admin)
router.post('/:code/maps', mapController.createMap);

// Actualizar mapa (admin)
router.put('/:code/maps/:mapId', mapController.updateMap);

// Activar mapa (admin)
router.put('/:code/maps/:mapId/activate', mapController.activateMap);

// Eliminar mapa (admin)
router.delete('/:code/maps/:mapId', mapController.deleteMap);

// Obtener tokens de un mapa (lectura para jugadores)
router.get('/:code/maps/:mapId/tokens', mapController.getTokens);

// Actualizar tokens de un mapa (admin)
router.put('/:code/maps/:mapId/tokens', mapController.updateTokens);

// ==========================================
// Rutas de NPCs
// ==========================================

// Listar NPCs de la sala (admin)
router.post('/:code/npcs/list', npcController.getNpcs);

// Crear nuevo NPC (admin)
router.post('/:code/npcs', npcController.createNpc);

// Actualizar NPC (admin)
router.put('/:code/npcs/:npcId', npcController.updateNpc);

// Eliminar NPC (admin)
router.delete('/:code/npcs/:npcId', npcController.deleteNpc);

// ==========================================
// Rutas de jugadores de sala
// ==========================================

// Listar jugadores de la sala (admin)
router.post('/:code/players', npcController.getPlayers);

// ==========================================
// Rutas de notas de sesion
// ==========================================

// Listar notas (admin)
router.post('/:code/notes/list', gameController.getSessionNotes);

// Crear nota (admin)
router.post('/:code/notes', gameController.createSessionNote);

// Actualizar nota (admin)
router.put('/:code/notes/:noteId', gameController.updateSessionNote);

// Eliminar nota (admin)
router.delete('/:code/notes/:noteId', gameController.deleteSessionNote);

// ==========================================
// Rutas de dados
// ==========================================

// Obtener historial de tiradas
router.get('/:code/dice/history', gameController.getDiceRollHistory);

// ==========================================
// Rutas de tracker de combate
// ==========================================

// Obtener tracker de combate
router.get('/:code/combat', gameController.getCombatTracker);

// Actualizar tracker (admin)
router.put('/:code/combat', gameController.updateCombatTracker);

// Resetear tracker (admin)
router.post('/:code/combat/reset', gameController.resetCombatTracker);

module.exports = router;
