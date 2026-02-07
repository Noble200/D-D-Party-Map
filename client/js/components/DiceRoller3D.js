// ==========================================
// Componente DiceRoller3D - Dados 3D con Fantastic Dice
// ==========================================

class DiceRoller3D {
    constructor(containerId) {
        this.containerId = containerId;
        this.diceBox = null;
        this.initialized = false;
        this.selectedDice = [];
        this.isRolling = false;
        this.DiceBoxClass = null;

        // Callbacks
        this.onRollComplete = null;
        this.onDiceListChanged = null;
    }

    // Inicializar Fantastic Dice
    async init() {
        if (this.initialized && this.diceBox) {
            return true;
        }

        try {
            // Importar dinamicamente desde CDN
            if (!this.DiceBoxClass) {
                const module = await import(
                    'https://unpkg.com/@3d-dice/dice-box@1.1.3/dist/dice-box.es.min.js'
                );
                this.DiceBoxClass = module.default;
            }

            // Verificar contenedor
            const container = document.getElementById(this.containerId);
            if (!container) {
                console.error('Contenedor no encontrado:', this.containerId);
                return false;
            }

            // Esperar a que el contenedor tenga dimensiones
            await this.waitForContainer(container);

            // Limpiar contenedor previo
            container.innerHTML = '';

            // Crear DiceBox con configuracion correcta
            // origin debe ser la URL base de donde vienen los assets
            this.diceBox = new this.DiceBoxClass({
                assetPath: '/assets/',
                origin: 'https://unpkg.com/@3d-dice/dice-box@1.1.3/dist',
                container: `#${this.containerId}`,
                scale: 6,
                gravity: 1.5,
                mass: 1,
                friction: 0.8,
                restitution: 0.5,
                linearDamping: 0.5,
                angularDamping: 0.4,
                spinForce: 5,
                throwForce: 6,
                startingHeight: 10,
                settleTimeout: 5000,
                delay: 10,
                enableShadows: true,
                theme: 'default',
                themeColor: '#d4a726',
                // Fondo transparente para overlay
                alpha: true
            });

            await this.diceBox.init();

            // Callback cuando termina la tirada
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

    // Esperar a que el contenedor tenga dimensiones
    waitForContainer(container, maxAttempts = 30) {
        return new Promise((resolve) => {
            let attempts = 0;
            const check = () => {
                attempts++;
                const rect = container.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    resolve(true);
                } else if (attempts < maxAttempts) {
                    setTimeout(check, 50);
                } else {
                    console.warn('Contenedor sin dimensiones');
                    resolve(false);
                }
            };
            setTimeout(check, 100);
        });
    }

    // Agregar un dado a la lista
    addDice(diceType) {
        if (this.isRolling) return;

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

    // Quitar un dado de la lista
    removeDice(index) {
        if (this.isRolling) return;

        if (index >= 0 && index < this.selectedDice.length) {
            this.selectedDice.splice(index, 1);
            if (this.onDiceListChanged) {
                this.onDiceListChanged(this.selectedDice);
            }
        }
    }

    // Limpiar todos los dados
    clearDice() {
        if (this.isRolling) return;
        this.selectedDice = [];
        if (this.onDiceListChanged) {
            this.onDiceListChanged(this.selectedDice);
        }
    }

    // Obtener notacion de dados
    getDiceNotation() {
        if (this.selectedDice.length === 0) return '';

        const counts = {};
        this.selectedDice.forEach(die => {
            counts[die.type] = (counts[die.type] || 0) + 1;
        });

        const parts = [];
        Object.entries(counts).forEach(([type, count]) => {
            parts.push(`${count}${type}`);
        });

        return parts.join('+');
    }

    // Lanzar dados
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
            if (this.diceBox) {
                this.diceBox.clear();
            }

            // Construir array de dados para mejor compatibilidad
            // Formato: [{ sides: 20 }, { sides: 6 }, ...]
            const diceArray = this.selectedDice.map(die => {
                const sides = parseInt(die.type.replace('d', ''));
                return { sides };
            });

            console.log('Lanzando dados:', diceArray);

            // Lanzar usando array de objetos
            const results = await this.diceBox.roll(diceArray);
            return results;
        } catch (error) {
            console.error('Error al lanzar:', error);
            this.isRolling = false;
            return null;
        }
    }

    // Manejar resultado
    handleRollComplete(results) {
        this.isRolling = false;

        if (!results || results.length === 0) return;

        let total = 0;
        const rolls = [];

        // La estructura de dice-box es plana: cada resultado es un dado individual
        // { groupId, rollId, sides, theme, themeColor, value }
        results.forEach(result => {
            const value = result.value;
            total += value;
            rolls.push({
                type: `d${result.sides}`,
                value: value
            });
        });

        const rollData = {
            notation: this.getDiceNotation() || results.map(r => `1d${r.sides}`).join('+'),
            rolls,
            total,
            timestamp: Date.now()
        };

        if (this.onRollComplete) {
            this.onRollComplete(rollData);
        }
    }

    // Limpiar canvas
    clear() {
        if (this.diceBox) {
            try {
                this.diceBox.clear();
            } catch (e) {
                // Ignorar errores
            }
        }
    }

    // Destruir instancia
    destroy() {
        if (this.diceBox) {
            try {
                this.diceBox.clear();
            } catch (e) {
                // Ignorar
            }
            this.diceBox = null;
        }
        this.initialized = false;
        this.selectedDice = [];
        this.isRolling = false;
    }
}

export { DiceRoller3D };
