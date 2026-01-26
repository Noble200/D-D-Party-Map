// ==========================================
// Rutas de API para usuarios
// ==========================================

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Identificar o crear usuario por hash
router.post('/identify', userController.identifyUser);

// Obtener usuario por hash
router.get('/:userHash', userController.getUser);

module.exports = router;
