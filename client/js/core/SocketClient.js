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
        this.onActiveMapChanged = null;
        this.onDiceRolled = null;
        this.onCombatUpdated = null;
        this.onCombatTurnChanged = null;
        this.onGameStarted = null;
        // Tokens
        this.onTokenUpdated = null;
        this.onTokenAddedSync = null;
        this.onTokenRemovedSync = null;
        this.onTokenSelectedSync = null;
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

        // Escuchar cambio de mapa activo
        this.socket.on('active-map-changed', (data) => {
            console.log('Mapa activo cambiado:', data);
            if (this.onActiveMapChanged) {
                this.onActiveMapChanged(data);
            }
        });

        // Escuchar tiradas de dados
        this.socket.on('dice-rolled', (data) => {
            console.log('Dado tirado:', data);
            if (this.onDiceRolled) {
                this.onDiceRolled(data);
            }
        });

        // Escuchar actualizaciones de combate
        this.socket.on('combat-updated', (data) => {
            console.log('Combate actualizado:', data);
            if (this.onCombatUpdated) {
                this.onCombatUpdated(data);
            }
        });

        // Escuchar cambio de turno en combate
        this.socket.on('combat-turn', (data) => {
            console.log('Turno de combate:', data);
            if (this.onCombatTurnChanged) {
                this.onCombatTurnChanged(data);
            }
        });

        // Escuchar inicio de partida
        this.socket.on('game-started', (data) => {
            console.log('Partida iniciada:', data);
            if (this.onGameStarted) {
                this.onGameStarted(data);
            }
        });

        // === Tokens ===
        this.socket.on('token-updated', (data) => {
            if (this.onTokenUpdated) this.onTokenUpdated(data);
        });

        this.socket.on('token-added-sync', (data) => {
            if (this.onTokenAddedSync) this.onTokenAddedSync(data);
        });

        this.socket.on('token-removed-sync', (data) => {
            if (this.onTokenRemovedSync) this.onTokenRemovedSync(data);
        });

        this.socket.on('token-selected-sync', (data) => {
            if (this.onTokenSelectedSync) this.onTokenSelectedSync(data);
        });
    }

    // Unirse a una sala (con datos extendidos)
    joinRoom(roomCode, userType, userName = null, userId = null, characterName = null, tokenPhoto = null, tokenBorderColor = null) {
        if (!this.socket) this.connect();

        this.roomCode = roomCode;
        this.socket.emit('join-room', {
            roomCode,
            userType,
            userName,
            userId,
            characterName,
            tokenPhoto,
            tokenBorderColor
        });
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

    // Emitir movimiento de token
    emitTokenMoved(mapId, token, movedBy) {
        if (this.socket && this.roomCode) {
            this.socket.emit('token-moved', {
                roomCode: this.roomCode, mapId, token, movedBy
            });
        }
    }

    // Emitir token agregado
    emitTokenAdded(mapId, token) {
        if (this.socket && this.roomCode) {
            this.socket.emit('token-added', {
                roomCode: this.roomCode, mapId, token
            });
        }
    }

    // Emitir selección de token (para que todos vean el highlight)
    emitTokenSelected(tokenId) {
        if (this.socket && this.roomCode) {
            this.socket.emit('token-selected', {
                roomCode: this.roomCode, tokenId
            });
        }
    }

    // Emitir token eliminado
    emitTokenRemoved(mapId, tokenId) {
        if (this.socket && this.roomCode) {
            this.socket.emit('token-removed', {
                roomCode: this.roomCode, mapId, tokenId
            });
        }
    }

    // Emitir evento genérico
    emit(event, data) {
        if (this.socket) {
            this.socket.emit(event, data);
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
