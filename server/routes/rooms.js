// ==========================================
// Rutas de API para salas
// ==========================================

const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const characterController = require('../controllers/characterController');
const mapController = require('../controllers/mapController');

// Listar salas de un admin (por contraseña) - DEBE IR ANTES de :code
router.post('/list', roomController.listRooms);

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

// Obtener personaje de usuario en sala
router.get('/:code/characters/:userId', characterController.getCharacter);

// Crear o actualizar personaje
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

module.exports = router;
