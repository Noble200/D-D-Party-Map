// ==========================================
// D&D Map Editor - Aplicación principal
// ==========================================

import { screenManager } from './core/ScreenManager.js';
import { HomeView } from './views/HomeView.js';
import { AdminViewerView } from './views/AdminViewerView.js';
import { AdminEditorView } from './views/AdminEditorView.js';
import { PlayerView } from './views/PlayerView.js';
import { CharacterSheet } from './components/CharacterSheet.js';
import { MapSelector } from './components/MapSelector.js';

class DnDMapApp {
    constructor() {
        // Estado de la aplicación
        this.currentRoom = null;
        this.adminPassword = null;
        this.isAdmin = false;
        this.currentUser = null;

        // Vistas
        this.homeView = null;
        this.adminViewerView = null;
        this.adminEditorView = null;
        this.playerView = null;

        // Componentes
        this.characterSheet = null;
        this.mapSelector = null;

        this.init();
    }

    init() {
        // Inicializar vistas
        this.homeView = new HomeView(this);
        this.adminViewerView = new AdminViewerView(this);
        this.adminEditorView = new AdminEditorView(this);
        this.playerView = new PlayerView(this);

        // Inicializar componentes
        this.characterSheet = new CharacterSheet(this);
        this.characterSheet.init();
        this.mapSelector = new MapSelector(this);
        this.mapSelector.init();

        // Configurar callback para cambios de pantalla
        screenManager.onChange((screenName) => {
            this.onScreenChange(screenName);
        });
    }

    // Callback cuando cambia la pantalla
    onScreenChange(screenName) {
        switch (screenName) {
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
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DnDMapApp();
});
