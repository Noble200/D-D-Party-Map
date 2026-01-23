// ==========================================
// D&D Map Editor - Aplicación principal
// ==========================================

import { screenManager } from './core/ScreenManager.js';
import { HomeView } from './views/HomeView.js';
import { AdminView } from './views/AdminView.js';
import { PlayerView } from './views/PlayerView.js';

class DnDMapApp {
    constructor() {
        // Estado de la aplicación
        this.currentRoom = null;
        this.adminPassword = null;
        this.isAdmin = false;

        // Vistas
        this.homeView = null;
        this.adminView = null;
        this.playerView = null;

        this.init();
    }

    init() {
        // Inicializar vistas
        this.homeView = new HomeView(this);
        this.adminView = new AdminView(this);
        this.playerView = new PlayerView(this);

        // Configurar callback para cambios de pantalla
        screenManager.onChange((screenName) => {
            this.onScreenChange(screenName);
        });
    }

    // Callback cuando cambia la pantalla
    onScreenChange(screenName) {
        switch (screenName) {
            case 'admin':
                this.adminView.init();
                this.adminView.updateUI();
                if (this.currentRoom?.image_data || this.currentRoom?.grid_config) {
                    this.adminView.loadRoomData();
                }
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
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DnDMapApp();
});
