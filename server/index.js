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
const { initDB } = require('./db/database');
const roomRoutes = require('./routes/rooms');

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

// Almacén de usuarios por sala: { roomCode: { socketId: { type, name } } }
const roomUsers = {};

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // Unirse a una sala
    socket.on('join-room', ({ roomCode, userType, userName }) => {
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.userType = userType;
        socket.userName = userName || (userType === 'admin' ? 'Admin' : 'Jugador');

        // Inicializar sala si no existe
        if (!roomUsers[roomCode]) {
            roomUsers[roomCode] = {};
        }

        // Agregar usuario
        roomUsers[roomCode][socket.id] = {
            type: userType,
            name: socket.userName
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
    if (!roomUsers[roomCode]) return { admins: [], players: [] };

    const users = Object.values(roomUsers[roomCode]);
    return {
        admins: users.filter(u => u.type === 'admin').map(u => u.name),
        players: users.filter(u => u.type === 'player').map(u => u.name),
        total: users.length
    };
}

// Iniciar servidor
initDB().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Servidor corriendo en puerto ${PORT}`);
    });
}).catch(console.error);
