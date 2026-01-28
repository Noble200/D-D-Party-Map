// ==========================================
// Servidor principal - D&D Map Editor
// ==========================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Importar módulos
const { initDB, migrateRoomMapsData, updateRoomActivity, cleanupInactiveRooms } = require('./db/database');
const roomRoutes = require('./routes/rooms');
const userRoutes = require('./routes/users');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ==========================================
// API ROUTES (definir ANTES de static)
// ==========================================

app.use('/api/rooms', roomRoutes);
app.use('/api/users', userRoutes);

// ==========================================
// ARCHIVOS ESTÁTICOS (después de API)
// ==========================================

app.use(express.static(path.join(__dirname, '../client')));

// Ruta catch-all para SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ==========================================
// SOCKET.IO - Gestión de usuarios en salas
// ==========================================

// Almacén de usuarios por sala: { roomCode: { socketId: { type, name, ... } } }
const roomUsers = {};

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // Unirse a una sala
    socket.on('join-room', async ({ roomCode, userType, userName, userId, characterName }) => {
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.userType = userType;
        socket.userName = userName || (userType === 'admin' ? 'Admin' : 'Jugador');
        socket.userId = userId || null;
        socket.characterName = characterName || null;

        // Actualizar última actividad de la sala en la base de datos
        try {
            await updateRoomActivity(roomCode);
        } catch (err) {
            console.error('Error actualizando actividad de sala:', err);
        }

        // Inicializar sala si no existe
        if (!roomUsers[roomCode]) {
            roomUsers[roomCode] = {};
        }

        // Agregar usuario con datos extendidos
        roomUsers[roomCode][socket.id] = {
            type: userType,
            name: socket.userName,
            odeleteduserId: socket.userId,
            characterName: socket.characterName
        };

        // Emitir lista actualizada a todos en la sala
        io.to(roomCode).emit('users-updated', getUsersList(roomCode));
        console.log(`${socket.userName} (${userType}) se unió a sala ${roomCode}`);
    });

    // Salir de la sala
    socket.on('leave-room', () => {
        leaveRoom(socket);
    });

    // Desconexión
    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
        leaveRoom(socket);
    });

    // Admin notifica actualización del mapa
    socket.on('map-updated', ({ roomCode }) => {
        socket.to(roomCode).emit('map-changed');
    });

    // Admin cambia el mapa activo
    socket.on('map-switched', ({ roomCode, mapId }) => {
        // Notificar a todos los jugadores (excepto al admin que envió)
        socket.to(roomCode).emit('active-map-changed', { mapId });
        console.log(`Mapa activo cambiado en sala ${roomCode} a ${mapId}`);
    });
});

// Función para sacar usuario de la sala
function leaveRoom(socket) {
    const roomCode = socket.roomCode;
    if (roomCode && roomUsers[roomCode]) {
        delete roomUsers[roomCode][socket.id];

        // Eliminar sala si está vacía
        if (Object.keys(roomUsers[roomCode]).length === 0) {
            delete roomUsers[roomCode];
        } else {
            // Notificar a los demás
            io.to(roomCode).emit('users-updated', getUsersList(roomCode));
        }

        socket.leave(roomCode);
        console.log(`Usuario ${socket.id} salió de sala ${roomCode}`);
    }
}

// Obtener lista formateada de usuarios
function getUsersList(roomCode) {
    if (!roomUsers[roomCode]) return { admins: [], players: [], total: 0 };

    const users = Object.values(roomUsers[roomCode]);
    return {
        admins: users.filter(u => u.type === 'admin').map(u => ({
            name: u.name
        })),
        players: users.filter(u => u.type === 'player').map(u => ({
            name: u.name,
            characterName: u.characterName
        })),
        total: users.length
    };
}

// Limpieza periódica de salas inactivas (cada 24 horas)
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas en ms
const DAYS_INACTIVE = 7; // Eliminar salas sin actividad por 7 días

async function runCleanup() {
    try {
        const deleted = await cleanupInactiveRooms(DAYS_INACTIVE);
        if (deleted.length > 0) {
            console.log(`Salas eliminadas por inactividad: ${deleted.map(r => r.code).join(', ')}`);
        }
    } catch (err) {
        console.error('Error en limpieza de salas:', err);
    }
}

// Iniciar servidor
initDB().then(async () => {
    // Migrar datos de mapas existentes (solo si hay datos sin migrar)
    try {
        const migrated = await migrateRoomMapsData();
        if (migrated > 0) {
            console.log(`Migración completada: ${migrated} mapas`);
        }
    } catch (err) {
        console.log('Migración de mapas ya completada o sin datos');
    }

    // Ejecutar limpieza al iniciar y luego cada 24 horas
    runCleanup();
    setInterval(runCleanup, CLEANUP_INTERVAL);

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Servidor corriendo en puerto ${PORT}`);
        console.log(`Limpieza automática configurada: salas inactivas por ${DAYS_INACTIVE}+ días serán eliminadas`);
    });
}).catch(console.error);
