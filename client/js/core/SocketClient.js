// ==========================================
// Cliente de Socket.IO - Comunicación en tiempo real
// ==========================================

class SocketClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.roomCode = null;
        this.onUsersUpdated = null;
        this.onMapChanged = null;
    }

    // Conectar al servidor
    connect() {
        if (this.socket) return;

        // Socket.IO se carga desde CDN en index.html
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Socket conectado');
            this.connected = true;
        });

        this.socket.on('disconnect', () => {
            console.log('Socket desconectado');
            this.connected = false;
        });

        // Escuchar actualización de usuarios
        this.socket.on('users-updated', (users) => {
            console.log('Usuarios actualizados:', users);
            if (this.onUsersUpdated) {
                this.onUsersUpdated(users);
            }
        });

        // Escuchar cambios en el mapa (para jugadores)
        this.socket.on('map-changed', () => {
            console.log('Mapa actualizado por admin');
            if (this.onMapChanged) {
                this.onMapChanged();
            }
        });
    }

    // Unirse a una sala
    joinRoom(roomCode, userType, userName = null) {
        if (!this.socket) this.connect();

        this.roomCode = roomCode;
        this.socket.emit('join-room', { roomCode, userType, userName });
    }

    // Salir de la sala actual
    leaveRoom() {
        if (this.socket && this.roomCode) {
            this.socket.emit('leave-room');
            this.roomCode = null;
        }
    }

    // Notificar que el mapa fue actualizado (solo admin)
    notifyMapUpdate() {
        if (this.socket && this.roomCode) {
            this.socket.emit('map-updated', { roomCode: this.roomCode });
        }
    }

    // Desconectar
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
            this.roomCode = null;
        }
    }
}

// Exportar instancia única
export const socketClient = new SocketClient();
