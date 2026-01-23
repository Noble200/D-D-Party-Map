// ==========================================
// Rutas de API para salas
// ==========================================

const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

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

module.exports = router;
