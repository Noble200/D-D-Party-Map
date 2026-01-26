// ==========================================
// Gestor de pantallas - Navegación entre vistas
// ==========================================

class ScreenManager {
    constructor() {
        this.screens = {
            home: document.getElementById('homeScreen'),
            adminViewer: document.getElementById('adminViewerScreen'),
            adminEditor: document.getElementById('adminEditorScreen'),
            player: document.getElementById('playerScreen')
        };
        this.currentScreen = 'home';
        this.onScreenChange = null; // Callback para cuando cambia la pantalla
    }

    // Mostrar una pantalla específica
    show(screenName) {
        if (!this.screens[screenName]) {
            console.error(`Pantalla no encontrada: ${screenName}`);
            return;
        }

        // Ocultar todas las pantallas
        Object.values(this.screens).forEach(screen => {
            if (screen) screen.classList.remove('active');
        });

        // Mostrar la pantalla solicitada
        this.screens[screenName].classList.add('active');
        this.currentScreen = screenName;

        // Ejecutar callback si existe
        if (this.onScreenChange) {
            this.onScreenChange(screenName);
        }
    }

    // Obtener pantalla actual
    getCurrent() {
        return this.currentScreen;
    }

    // Registrar callback para cambios de pantalla
    onChange(callback) {
        this.onScreenChange = callback;
    }
}

// Exportar instancia única
export const screenManager = new ScreenManager();
