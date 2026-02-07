// ==========================================
// Componente DiceRoller3D - Dados 3D con Fantastic Dice
// ==========================================

class DiceRoller3D {
    constructor(containerId) {
        this.containerId = containerId;
        this.diceBox = null;
        this.initialized = false;
        this.selectedDice = []; // Lista de dados seleccionados para lanzar
        this.isRolling = false;

        // Callbacks
        this.onRollComplete = null;
        this.onDiceListChanged = null;
    }

    // Inicializar Fantastic Dice
    async init() {
        if (this.initialized) return true;

        try {
            // Importar dinamicamente desde CDN
            const { default: DiceBox } = await import(
                'https://unpkg.com/@3d-dice/dice-box@1.1.3/dist/dice-box.es.min.js'
            );

            // Crear contenedor si no existe
            const container = document.getElementById(this.containerId);
            if (!container) {
                console.error('Contenedor de dados no encontrado:', this.containerId);
                return false;
            }

            // Configurar DiceBox
            this.diceBox = new DiceBox(`#${this.containerId}`, {
                assetPath: 'https://unpkg.com/@3d-dice/dice-box@1.1.3/dist/assets/',
                theme: 'default',
                scale: 6,
                gravity: 2,
                mass: 1,
                friction: 0.8,
                restitution: 0.5,
                linearDamping: 0.5,
                angularDamping: 0.4,
                spinForce: 5,
                throwForce: 6,
                startingHeight: 10,
                settleTimeout: 5000,
                offscreen: true,
                delay: 10,
                enableShadows: true,
                shadowTransparency: 0.8
            });

            await this.diceBox.init();

            // Escuchar cuando termina la tirada
            this.diceBox.onRollComplete = (results) => {
                this.handleRollComplete(results);
            };

            this.initialized = true;
            console.log('DiceRoller3D inicializado correctamente');
            return true;
        } catch (error) {
            console.error('Error al inicializar DiceRoller3D:', error);
            return false;
        }
    }

    // Agregar un dado a la lista
    addDice(diceType) {
        if (this.isRolling) return;

        // Validar tipo de dado
        const validDice = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
        if (!validDice.includes(diceType)) {
            console.error('Tipo de dado invalido:', diceType);
            return;
        }

        this.selectedDice.push({
            id: Date.now() + Math.random(),
            type: diceType
        });

        if (this.onDiceListChanged) {
            this.onDiceListChanged(this.selectedDice);
        }
    }

    // Quitar un dado de la lista por indice
    removeDice(index) {
        if (this.isRolling) return;

        if (index >= 0 && index < this.selectedDice.length) {
            this.selectedDice.splice(index, 1);

            if (this.onDiceListChanged) {
                this.onDiceListChanged(this.selectedDice);
            }
        }
    }

    // Limpiar todos los dados seleccionados
    clearDice() {
        if (this.isRolling) return;

        this.selectedDice = [];

        if (this.onDiceListChanged) {
            this.onDiceListChanged(this.selectedDice);
        }
    }

    // Obtener la notacion de dados (ej: "2d6+1d20")
    getDiceNotation() {
        if (this.selectedDice.length === 0) return '';

        // Agrupar por tipo
        const counts = {};
        this.selectedDice.forEach(die => {
            counts[die.type] = (counts[die.type] || 0) + 1;
        });

        // Construir notacion
        const parts = [];
        Object.entries(counts).forEach(([type, count]) => {
            parts.push(`${count}${type}`);
        });

        return parts.join('+');
    }

    // Lanzar los dados seleccionados
    async roll(modifier = 0) {
        if (!this.initialized) {
            const success = await this.init();
            if (!success) return null;
        }

        if (this.selectedDice.length === 0) {
            console.warn('No hay dados seleccionados');
            return null;
        }

        if (this.isRolling) {
            console.warn('Ya hay una tirada en progreso');
            return null;
        }

        this.isRolling = true;

        try {
            // Limpiar dados anteriores
            this.diceBox.clear();

            // Construir notacion de dados
            const notation = this.getDiceNotation();

            // Lanzar dados
            const results = await this.diceBox.roll(notation);
            return results;
        } catch (error) {
            console.error('Error al lanzar dados:', error);
            this.isRolling = false;
            return null;
        }
    }

    // Lanzar un dado rapido (sin agregarlo a la lista)
    async quickRoll(diceType, count = 1) {
        if (!this.initialized) {
            const success = await this.init();
            if (!success) return null;
        }

        if (this.isRolling) {
            console.warn('Ya hay una tirada en progreso');
            return null;
        }

        this.isRolling = true;

        try {
            this.diceBox.clear();
            const notation = `${count}${diceType}`;
            const results = await this.diceBox.roll(notation);
            return results;
        } catch (error) {
            console.error('Error en tirada rapida:', error);
            this.isRolling = false;
            return null;
        }
    }

    // Manejar resultado de tirada
    handleRollComplete(results) {
        this.isRolling = false;

        if (!results || results.length === 0) return;

        // Calcular total
        let total = 0;
        const rolls = [];

        results.forEach(result => {
            if (result.rolls) {
                result.rolls.forEach(roll => {
                    total += roll.value;
                    rolls.push({
                        type: result.die || 'd20',
                        value: roll.value
                    });
                });
            }
        });

        const rollData = {
            notation: this.getDiceNotation() || results.map(r => `1${r.die || 'd20'}`).join('+'),
            rolls,
            total,
            timestamp: Date.now()
        };

        if (this.onRollComplete) {
            this.onRollComplete(rollData);
        }
    }

    // Limpiar el canvas de dados
    clear() {
        if (this.diceBox) {
            this.diceBox.clear();
        }
    }

    // Ocultar el contenedor
    hide() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'none';
        }
    }

    // Mostrar el contenedor
    show() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'block';
        }
    }

    // Destruir instancia
    destroy() {
        if (this.diceBox) {
            this.diceBox.clear();
            this.diceBox = null;
        }
        this.initialized = false;
        this.selectedDice = [];
    }
}

export { DiceRoller3D };
