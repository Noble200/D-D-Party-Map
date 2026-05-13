// ==========================================
// Vista de jugador - Solo visualización
// ==========================================

import { MapEditor } from '../core/MapEditor.js';
import { screenManager } from '../core/ScreenManager.js';
import { apiClient } from '../core/ApiClient.js';
import { socketClient } from '../core/SocketClient.js';
import { showNotification } from '../utils/helpers.js';
import { ActionDock } from '../components/ActionDock.js';

class PlayerView {
    constructor(app) {
        this.app = app;
        this.viewer = null;
        this.initialized = false;
        this.currentMapId = null;
        this.actionDock = null;
    }

    // Inicializar la vista cuando se muestra
    init() {
        if (this.initialized) {
            this.viewer?.resizeCanvas();
            return;
        }

        // Crear visor de mapas (no editable)
        this.viewer = new MapEditor('playerMapCanvas', false);

        // Crear dock de acciones (favoritos)
        this.actionDock = new ActionDock(this.app);
        this.actionDock.init();
        this.wireActionDockCallbacks();

        this.bindEvents();
        this.initialized = true;
    }

    // Conectar las acciones del dock con quickRoll y manejo de rasgos
    wireActionDockCallbacks() {
        // Tirada rápida de skill: 1d20 + bonus
        this.actionDock.onActivateSkillRoll = (skillId, bonus) => {
            const sheet = this.app.characterSheet;
            const skillName = sheet?.constructor.name ? null : null;
            // Usar nombre legible
            const labels = {
                acrobatics: 'Acrobacias', animalHandling: 'Trato con Animales',
                arcana: 'Arcanos', athletics: 'Atletismo',
                deception: 'Engaño', history: 'Historia',
                insight: 'Perspicacia', intimidation: 'Intimidación',
                investigation: 'Investigación', medicine: 'Medicina',
                nature: 'Naturaleza', perception: 'Percepción',
                performance: 'Interpretación', persuasion: 'Persuasión',
                religion: 'Religión', sleightOfHand: 'Juego de Manos',
                stealth: 'Sigilo', survival: 'Supervivencia'
            };
            this.app.roomMenuView?.quickRoll({
                dice: ['d20'],
                modifier: bonus,
                rollType: 'skill',
                actionLabel: labels[skillId] || skillId
            });
        };

        // Tirada rápida de salvación: 1d20 + bonus
        this.actionDock.onActivateSaveRoll = (ability, bonus) => {
            const labels = {
                strength: 'Salv. Fuerza', dexterity: 'Salv. Destreza',
                constitution: 'Salv. Constitución', intelligence: 'Salv. Inteligencia',
                wisdom: 'Salv. Sabiduría', charisma: 'Salv. Carisma'
            };
            this.app.roomMenuView?.quickRoll({
                dice: ['d20'],
                modifier: bonus,
                rollType: 'save',
                actionLabel: labels[ability] || ability
            });
        };

        // Rasgo: pasivo solo muestra info; activo decrementa contador
        this.actionDock.onActivateTrait = (traitId, isActive, card) => {
            this.activateTrait(traitId, isActive, card);
        };

        // Descansos: restauran usos según el tipo
        this.actionDock.onRest = (restType) => {
            this.applyRest(restType);
        };

        // Trucos: tirada de daño (si tiene) con target opcional
        this.actionDock.onActivateCantrip = (cantripId) => {
            const sheet = this.app.characterSheet;
            const cantrip = sheet?.spellsData?.cantrips?.[cantripId];
            if (!cantrip) {
                showNotification('Truco no encontrado', 'warning');
                return;
            }
            this.castSpell({ name: cantrip.name, data: cantrip, level: 0, id: cantripId });
        };

        // Conjuros: tirada de daño + consumo de slot
        this.actionDock.onActivateSpell = (spellId, level) => {
            const sheet = this.app.characterSheet;
            const spell = sheet?.spellsData?.[`level${level}`]?.[spellId];
            if (!spell) {
                showNotification('Conjuro no encontrado', 'warning');
                return;
            }
            this.castSpell({ name: spell.name, data: spell, level, id: spellId });
        };
    }

    // Lanzar un conjuro: seleccionar objetivo (si aplica) + tirar daño + broadcast
    async castSpell({ name, data, level, id }) {
        // 1) Determinar si necesita objetivo (rango distinto de Personal)
        const range = data.range || data.alcance || '';
        const needsTarget = range && !/personal/i.test(range);

        let targetToken = null;
        if (needsTarget) {
            showNotification(`Click en un token para elegir objetivo de "${name}" (Esc para cancelar)`, 'info');
            targetToken = await this.requestTarget();
            if (!targetToken) {
                showNotification('Lanzamiento cancelado', 'warning');
                return;
            }
        }

        // 2) Si es conjuro de nivel 1+, pedir el nivel de slot
        let slotLevel = level;
        if (level > 0) {
            const chosen = await this.pickSpellSlot(level, name);
            if (chosen === null) return; // canceló
            slotLevel = chosen;
            this.consumeSpellSlot(slotLevel);
        }

        // 3) Parsear notación de daño/curación
        const damageDice = data.damage?.dice || data.healing?.dice || '';
        const dice = this.parseDiceNotation(damageDice);

        // 4) Construir etiqueta de acción
        const targetName = targetToken?.name || null;
        let actionLabel = name;
        if (level > 0 && slotLevel !== level) {
            actionLabel += ` (Nv${slotLevel})`;
        }

        // 5) Si hay dados, tirar; si no, solo broadcast
        if (dice.length > 0) {
            await this.app.roomMenuView?.quickRoll({
                dice,
                modifier: 0,
                rollType: 'spell',
                actionLabel,
                targetName
            });
        } else {
            // Sin daño calculable: broadcast simple
            socketClient.emit('dice-roll', {
                roomCode: this.app.currentRoom.code,
                userName: this.app.playerName,
                characterName: this.app.characterName || null,
                rollType: 'spell',
                actionLabel,
                targetName,
                diceFormula: '—',
                results: [],
                modifier: 0,
                total: 0,
                isPrivate: false
            });
        }
    }

    // Pedir target con el modo crosshair del MapEditor
    requestTarget() {
        return new Promise(resolve => {
            this.viewer.enterTargetMode((token) => resolve(token));
        });
    }

    // Modal mínima para elegir nivel de slot a usar
    pickSpellSlot(baseLevel, spellName) {
        return new Promise(resolve => {
            const sheet = this.app.characterSheet;
            const slots = sheet?.classData?.[sheet.characterData?.class || sheet.getCharacterData?.()?.class]
                          ?.spellcasting?.spellSlots?.[sheet.getCharacterData?.()?.level || 1] || {};
            const used = sheet?.usedSpellSlots || {};

            // Construir opciones disponibles del nivel base hacia arriba
            const opts = [];
            for (let lvl = baseLevel; lvl <= 9; lvl++) {
                const max = slots[lvl] || 0;
                const consumed = used[lvl] || 0;
                const remaining = max - consumed;
                if (remaining > 0) opts.push({ lvl, remaining });
            }

            if (opts.length === 0) {
                showNotification(`No te quedan espacios de nivel ${baseLevel} o superior`, 'warning');
                resolve(null);
                return;
            }

            // Si solo hay una opción (la base), usar directamente
            if (opts.length === 1) {
                resolve(opts[0].lvl);
                return;
            }

            // Construir prompt textual
            const lines = opts.map(o => `${o.lvl} = Nivel ${o.lvl} (${o.remaining} disponible${o.remaining === 1 ? '' : 's'})`).join('\n');
            const input = prompt(`Lanzar ${spellName} usando qué nivel de espacio?\n\n${lines}\n\nEscribe el número (${baseLevel}-9):`, String(baseLevel));
            if (input === null) {
                resolve(null);
                return;
            }
            const chosen = parseInt(input);
            if (!opts.find(o => o.lvl === chosen)) {
                showNotification('Nivel de slot inválido', 'warning');
                resolve(null);
                return;
            }
            resolve(chosen);
        });
    }

    // Consumir un espacio de conjuro y guardar
    consumeSpellSlot(level) {
        const sheet = this.app.characterSheet;
        if (!sheet) return;
        sheet.usedSpellSlots = sheet.usedSpellSlots || {};
        sheet.usedSpellSlots[level] = (sheet.usedSpellSlots[level] || 0) + 1;
        sheet.save?.();
    }

    // Parsear "8d6" → ['d6','d6','d6','d6','d6','d6','d6','d6']
    parseDiceNotation(notation) {
        if (!notation || typeof notation !== 'string') return [];
        const dice = [];
        // Soporta múltiples grupos separados por + (ej: "2d6+1d8")
        notation.split('+').forEach(part => {
            const m = part.trim().match(/^(\d+)?d(\d+)$/i);
            if (!m) return;
            const count = parseInt(m[1] || '1');
            const sides = parseInt(m[2]);
            const die = `d${sides}`;
            // Solo soportar dados estándar
            if (['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'].includes(die)) {
                for (let i = 0; i < count; i++) dice.push(die);
            }
        });
        return dice;
    }

    // Activar un rasgo: pasivo → info, activo → decrementa contador
    activateTrait(traitId, isActive, card) {
        const sheet = this.app.characterSheet;
        if (!sheet) return;

        // Resolver datos del rasgo para tener nombre y descripción
        const resolved = sheet.resolveFavorite({ type: 'trait', id: traitId })
                      || sheet.resolveFavorite({ type: 'custom-ability', id: traitId });
        if (!resolved) {
            showNotification('Rasgo no encontrado', 'warning');
            return;
        }

        // Pasivo: solo mostrar descripción (recordatorio)
        if (!isActive) {
            const desc = resolved.data?.description || 'Sin descripción';
            showNotification(`${resolved.name}: ${desc.slice(0, 180)}${desc.length > 180 ? '…' : ''}`, 'info');
            return;
        }

        // Activo: si no hay usos configurados, pedir configuración inicial
        let uses = sheet.abilityUses?.[traitId];
        if (!uses) {
            uses = this.promptUsesConfig(resolved.name);
            if (!uses) return; // canceló
            sheet.abilityUses = sheet.abilityUses || {};
            sheet.abilityUses[traitId] = uses;
        }

        // Verificar que queden usos
        if (uses.current <= 0) {
            showNotification(`${resolved.name} sin usos disponibles. Descansa para recuperar.`, 'warning');
            return;
        }

        // Confirmar uso
        if (!confirm(`¿Activar ${resolved.name}? (Quedarán ${uses.current - 1}/${uses.max})`)) return;

        // Decrementar
        uses.current = Math.max(0, uses.current - 1);

        // Actualizar contador en el card
        const counterEl = card?.querySelector('.dice-card-counter, .dock-card-counter');
        if (counterEl) counterEl.textContent = `${uses.current}/${uses.max}`;

        // Re-renderizar dock para reflejar contador
        this.actionDock?.render();

        // Persistir
        sheet.save?.();

        // Broadcast por el sistema de dados (sin tirada, solo notificación)
        socketClient.emit('dice-roll', {
            roomCode: this.app.currentRoom.code,
            userName: this.app.playerName,
            characterName: this.app.characterName || null,
            rollType: 'trait',
            actionLabel: resolved.name,
            targetName: null,
            diceFormula: '—',
            results: [],
            modifier: 0,
            total: 0,
            isPrivate: false
        });
    }

    // Prompt simple para configurar usos máximos y tipo de recarga
    promptUsesConfig(traitName) {
        const maxStr = prompt(`Configurar usos para "${traitName}"\n\n¿Cuántos usos máximos tiene? (ej: 2)`, '1');
        if (maxStr === null) return null;
        const max = parseInt(maxStr);
        if (!Number.isFinite(max) || max <= 0) {
            showNotification('Número de usos inválido', 'warning');
            return null;
        }
        const rechargeStr = prompt(`Recarga de "${traitName}":\n\n1 = Descanso corto\n2 = Descanso largo\n3 = No se recupera\n\nEscribe 1, 2 o 3:`, '2');
        if (rechargeStr === null) return null;
        const recharge = rechargeStr === '1' ? 'short' : rechargeStr === '3' ? 'none' : 'long';
        return { max, current: max, recharge };
    }

    // Restaurar usos según el tipo de descanso
    applyRest(restType) {
        const sheet = this.app.characterSheet;
        if (!sheet || !sheet.abilityUses) return;

        const label = restType === 'short' ? 'descanso corto' : 'descanso largo';
        if (!confirm(`¿Aplicar ${label}? Esto restaurará los usos de los rasgos correspondientes.`)) return;

        let restored = 0;
        Object.keys(sheet.abilityUses).forEach(id => {
            const u = sheet.abilityUses[id];
            // Descanso largo restaura todo excepto los marcados como 'none'
            // Descanso corto solo restaura los marcados como 'short'
            const shouldRestore = restType === 'long'
                ? u.recharge !== 'none'
                : u.recharge === 'short';
            if (shouldRestore && u.current < u.max) {
                u.current = u.max;
                restored++;
            }
        });

        this.actionDock?.render();
        sheet.save?.();
        showNotification(`${label} aplicado. ${restored} rasgo(s) restaurado(s).`, 'success');
    }

    bindEvents() {
        // Volver al menu de sala
        document.getElementById('btnBackFromPlayer')?.addEventListener('click', () => {
            screenManager.show('roomMenu');
        });

        // Abrir hoja de personaje
        document.getElementById('btnCharacterSheet')?.addEventListener('click', () => {
            this.openCharacterSheet();
        });

        // Socket events de tokens
        socketClient.onTokenUpdated = (data) => {
            this.viewer?.updateToken(data.token);
        };
        socketClient.onTokenAddedSync = (data) => {
            this.viewer?.addToken(data.token);
        };
        socketClient.onTokenRemovedSync = (data) => {
            this.viewer?.removeToken(data.tokenId);
        };
        socketClient.onTokenSelectedSync = (data) => {
            if (this.viewer) {
                this.viewer.selectedTokenId = data.tokenId;
                this.viewer.render();
            }
        };

        // Callback cuando el jugador mueve su token
        this.viewer.onTokenMoved = (token) => {
            socketClient.emitTokenMoved(this.currentMapId, token, this.app.playerName);
        };

        // Callback cuando se selecciona/deselecciona un token
        this.viewer.onTokenSelected = (tokenId) => {
            socketClient.emitTokenSelected(tokenId);
        };
    }

    // Actualizar UI con datos de la sala
    async updateUI() {
        const room = this.app.currentRoom;
        if (!room) return;

        document.getElementById('playerRoomName').textContent = room.name;

        // Conectar al socket con datos de usuario
        socketClient.onUsersUpdated = (users) => this.updateUsersUI(users);
        socketClient.onMapChanged = () => this.reloadMap();
        socketClient.onActiveMapChanged = () => this.reloadMap();

        // Obtener foto y color del token desde la hoja de personaje
        const tokenPhoto = this.app.characterSheet?.tokenPhoto || null;
        const tokenBorderColor = document.getElementById('tokenBorderColor')?.value || null;

        // Unirse con datos extendidos
        socketClient.joinRoom(
            room.code,
            'player',
            this.app.playerName,
            this.app.currentUser?.id,
            this.app.characterName,
            tokenPhoto,
            tokenBorderColor
        );

        // Cargar personaje del servidor
        await this.loadCharacter();

        // Mostrar dock de acciones con los favoritos
        if (this.actionDock) {
            this.actionDock.show();
        }
    }

    // Cargar personaje del servidor
    async loadCharacter() {
        if (!this.app.characterSheet) return;

        const character = await this.app.characterSheet.loadFromServer();

        if (character && character.characterData?.name) {
            // Sincronizar nombre del personaje desde la hoja guardada
            this.app.characterName = character.characterData.name;
        } else if (!character && this.app.characterName) {
            // Si no hay personaje guardado, usar el nombre ingresado en pre-join
            document.getElementById('charName').value = this.app.characterName;
        }
    }

    // Abrir modal de hoja de personaje
    openCharacterSheet() {
        if (this.app.characterSheet) {
            this.app.characterSheet.show();
        }
    }

    // Actualizar HUD de usuarios conectados
    updateUsersUI(users) {
        const countEl = document.getElementById('playerUsersHudCount');
        const listEl = document.getElementById('playerUsersHudList');

        if (countEl) countEl.textContent = users.total || 0;

        if (listEl) {
            let html = '';

            // Mostrar admins
            if (users.admins?.length > 0) {
                html += '<div class="users-hud-group">';
                html += '<span class="users-hud-group-label">Admin</span>';
                users.admins.forEach(admin => {
                    const name = typeof admin === 'object' ? admin.name : admin;
                    html += `<div class="users-hud-item"><span class="users-hud-dot admin"></span><span class="users-hud-name">${this.escapeHtml(name)}</span></div>`;
                });
                html += '</div>';
            }

            // Mostrar jugadores
            if (users.players?.length > 0) {
                html += '<div class="users-hud-group">';
                html += '<span class="users-hud-group-label">Jugadores</span>';
                users.players.forEach(player => {
                    const name = typeof player === 'object' ? player.name : player;
                    const charName = typeof player === 'object' ? player.characterName : null;
                    const displayName = charName ? `${charName} (${name})` : name;
                    html += `<div class="users-hud-item"><span class="users-hud-dot"></span><span class="users-hud-name">${this.escapeHtml(displayName)}</span></div>`;
                });
                html += '</div>';
            }

            if (!html) {
                html = '<div class="users-hud-empty">Sin usuarios</div>';
            }

            listEl.innerHTML = html;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // Recargar mapa cuando el admin lo actualiza o cambia el mapa activo
    async reloadMap() {
        const room = this.app.currentRoom;
        if (!room || !this.viewer) return;

        try {
            // Cargar mapa activo
            const result = await apiClient.getActiveMap(room.code);

            if (result.success && result.map) {
                const map = result.map;
                this.currentMapId = map.id;

                if (map.imageData) {
                    this.viewer.loadImageFromData(map.imageData);
                }

                if (map.imageTransform) {
                    const transform = typeof map.imageTransform === 'string'
                        ? JSON.parse(map.imageTransform)
                        : map.imageTransform;
                    this.viewer.imageTransform = { ...transform };
                }

                if (map.gridConfig) {
                    const gridConfig = typeof map.gridConfig === 'string'
                        ? JSON.parse(map.gridConfig)
                        : map.gridConfig;
                    this.viewer.gridConfig = { ...gridConfig };
                }

                this.viewer.render();

                // Cargar tokens
                await this.loadTokens();

                showNotification('Mapa actualizado', 'info');
            } else {
                // Fallback: cargar desde room (compatibilidad)
                const data = await apiClient.getRoom(room.code);
                if (data.success && data.room) {
                    this.viewer.loadState(
                        data.room.image_data,
                        data.room.image_transform,
                        data.room.grid_config
                    );
                }
            }
        } catch (error) {
            console.error('Error al recargar mapa:', error);
        }
    }

    // Cargar tokens del mapa activo
    async loadTokens() {
        if (!this.currentMapId) return;
        try {
            const result = await apiClient.getMapTokens(
                this.app.currentRoom.code,
                this.currentMapId
            );
            if (result.success) {
                this.viewer.setTokens(result.tokens || []);
                // El jugador solo puede mover su propio token
                const ownTokenId = `player_${this.app.playerName}`;
                this.viewer.enableTokens(false, ownTokenId);
            }
        } catch (error) {
            console.error('Error al cargar tokens:', error);
        }
    }

    // Cargar datos de la sala en el visor
    async loadRoomData() {
        const room = this.app.currentRoom;
        if (!room || !this.viewer) return;

        // Intentar cargar mapa activo primero
        try {
            const result = await apiClient.getActiveMap(room.code);

            if (result.success && result.map) {
                const map = result.map;
                this.currentMapId = map.id;

                if (map.imageData) {
                    this.viewer.loadImageFromData(map.imageData);
                }

                if (map.imageTransform) {
                    const transform = typeof map.imageTransform === 'string'
                        ? JSON.parse(map.imageTransform)
                        : map.imageTransform;
                    this.viewer.imageTransform = { ...transform };
                }

                if (map.gridConfig) {
                    const gridConfig = typeof map.gridConfig === 'string'
                        ? JSON.parse(map.gridConfig)
                        : map.gridConfig;
                    this.viewer.gridConfig = { ...gridConfig };
                }

                this.viewer.render();

                // Cargar tokens
                await this.loadTokens();
                return;
            }
        } catch (error) {
            console.error('Error al cargar mapa activo:', error);
        }

        // Fallback: cargar desde room
        this.viewer.loadState(
            room.image_data,
            room.image_transform,
            room.grid_config
        );
    }
}

export { PlayerView };
