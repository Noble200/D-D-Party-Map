// ==========================================
// D&D Map Editor - Aplicación principal
// ==========================================

import { screenManager } from './core/ScreenManager.js';
import { apiClient } from './core/ApiClient.js';
import { HomeView } from './views/HomeView.js';
import { RoomMenuView } from './views/RoomMenuView.js';
import { AdminViewerView } from './views/AdminViewerView.js';
import { AdminEditorView } from './views/AdminEditorView.js';
import { PlayerView } from './views/PlayerView.js';
import { CharacterSheet } from './components/CharacterSheet.js';
import { MapSelector } from './components/MapSelector.js';
import { initNumberInputControls } from './utils/helpers.js';

const SESSION_KEY = 'dnd_session_state';

class DnDMapApp {
    constructor() {
        // Estado de la aplicación
        this.currentRoom = null;
        this.adminPassword = null;
        this.isAdmin = false;
        this.currentUser = null;

        // Vistas
        this.homeView = null;
        this.roomMenuView = null;
        this.adminViewerView = null;
        this.adminEditorView = null;
        this.playerView = null;

        // Componentes
        this.characterSheet = null;
        this.mapSelector = null;

        this.init();
    }

    async init() {
        // Inicializar vistas
        this.homeView = new HomeView(this);
        this.roomMenuView = new RoomMenuView(this);
        this.adminViewerView = new AdminViewerView(this);
        this.adminEditorView = new AdminEditorView(this);
        this.playerView = new PlayerView(this);

        // Inicializar componentes (CharacterSheet es async para cargar JSON de razas)
        this.characterSheet = new CharacterSheet(this);
        await this.characterSheet.init();
        this.mapSelector = new MapSelector(this);
        this.mapSelector.init();

        // Configurar callback para cambios de pantalla
        screenManager.onChange((screenName) => {
            this.onScreenChange(screenName);
            this.saveSession(screenName);
        });

        // Intentar restaurar sesión previa (tras refresh)
        const restored = await this.restoreSession();
        if (!restored) {
            // Restauración falló o no había sesión, mostrar home
            this.clearSession();
            document.documentElement.classList.remove('restoring-session');
            const homeScreen = document.getElementById('homeScreen');
            if (homeScreen) homeScreen.classList.add('active');
        } else {
            // Restauración exitosa, quitar clase de ocultación
            document.documentElement.classList.remove('restoring-session');
        }
    }

    // Callback cuando cambia la pantalla
    onScreenChange(screenName) {
        switch (screenName) {
            case 'roomMenu':
                this.roomMenuView.init();
                this.roomMenuView.show(this.currentRoom);
                break;
            case 'adminViewer':
                this.adminViewerView.init();
                this.adminViewerView.show(this.currentRoom);
                break;
            case 'adminEditor':
                this.adminEditorView.init();
                this.adminEditorView.show(this.currentRoom, this.adminEditorView.currentMapId);
                break;
            case 'player':
                this.playerView.init();
                this.playerView.updateUI();
                this.playerView.loadRoomData();
                break;
        }
    }

    // Establecer sala actual
    setRoom(room, password, isAdmin) {
        this.currentRoom = room;
        this.adminPassword = password;
        this.isAdmin = isAdmin;
    }

    // Limpiar sala actual
    clearRoom() {
        this.currentRoom = null;
        this.adminPassword = null;
        this.isAdmin = false;
        this.currentUser = null;
        this.clearSession();
    }

    // ==========================================
    // Persistencia de sesión (sobrevive refresh)
    // ==========================================

    // Guardar estado de sesión actual
    saveSession(screenName) {
        // Solo guardar si estamos en una sala
        if (!this.currentRoom) return;

        // No guardar pantalla home
        if (screenName === 'home') return;

        const session = {
            screen: screenName,
            roomCode: this.currentRoom.code,
            roomName: this.currentRoom.name,
            isAdmin: this.isAdmin,
            adminPassword: this.adminPassword || null,
            playerName: this.playerName || null,
            characterName: this.characterName || null,
            userId: this.currentUser?.id || this.currentUser?.playerName || null,
            timestamp: Date.now()
        };

        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } catch (e) {
            console.error('Error guardando sesión:', e);
        }
    }

    // Limpiar sesión guardada
    clearSession() {
        sessionStorage.removeItem(SESSION_KEY);
    }

    // Restaurar sesión tras refresh
    async restoreSession() {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return false;

            const session = JSON.parse(raw);

            // Sesión expirada (más de 12 horas)
            if (Date.now() - session.timestamp > 12 * 60 * 60 * 1000) {
                this.clearSession();
                return false;
            }

            // Verificar que la sala sigue existiendo
            const data = await apiClient.getRoom(session.roomCode);
            if (!data.success) {
                this.clearSession();
                return false;
            }

            // Si es admin, verificar credenciales
            if (session.isAdmin && session.adminPassword) {
                const adminCheck = await apiClient.verifyAdmin(session.roomCode, session.adminPassword);
                if (!adminCheck.success) {
                    this.clearSession();
                    return false;
                }
            }

            // Restaurar estado de la app
            this.currentRoom = data.room;
            this.isAdmin = session.isAdmin;
            this.adminPassword = session.adminPassword;
            this.playerName = session.playerName;
            this.characterName = session.characterName;

            if (session.isAdmin) {
                this.currentUser = { id: session.userId };
            } else {
                this.currentUser = { playerName: session.playerName };
            }

            // Navegar a la pantalla guardada
            screenManager.show(session.screen);
            console.log(`Sesión restaurada: ${session.screen} en sala ${session.roomCode}`);
            return true;

        } catch (e) {
            console.error('Error restaurando sesión:', e);
            this.clearSession();
            return false;
        }
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DnDMapApp();
    initNumberInputControls();
});
