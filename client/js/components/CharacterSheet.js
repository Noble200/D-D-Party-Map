// ==========================================
// Componente de Hoja de Personaje D&D 5e
// ==========================================

import { apiClient } from '../core/ApiClient.js';
import { showNotification } from '../utils/helpers.js';
import { DEFAULT_CHARACTER, SKILL_ABILITIES } from '../config.js';

class CharacterSheet {
    constructor(app) {
        this.app = app;
        this.modal = document.getElementById('characterSheetModal');
        this.characterData = { ...DEFAULT_CHARACTER };
        this.characterId = null;
        this.isLoaded = false;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;

        // Tabs
        const tabBtns = this.modal.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Cerrar modal
        document.getElementById('btnCloseCharacter').addEventListener('click', () => this.hide());

        // Guardar personaje
        document.getElementById('btnSaveCharacter').addEventListener('click', () => this.save());

        // Cerrar al hacer click fuera
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hide();
        });

        // Listeners de atributos para cálculo automático
        this.initAbilityListeners();

        // Listeners de habilidades
        this.initSkillListeners();

        // Listener de nivel para bonus de competencia
        document.getElementById('charLevel').addEventListener('change', () => this.updateAllCalculations());

        // Listeners de tiradas de salvación
        this.initSavingThrowListeners();

        // Listener de habilidad de lanzamiento
        document.getElementById('spellcastingAbility')?.addEventListener('change', () => this.updateSpellStats());

        this.initialized = true;
    }

    initAbilityListeners() {
        const abilities = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
        abilities.forEach(ability => {
            const input = document.getElementById(`ability${ability}`);
            input.addEventListener('change', () => {
                this.updateModifier(ability);
                this.updateAllCalculations();
            });
        });
    }

    initSkillListeners() {
        const skillItems = this.modal.querySelectorAll('.skill-item');
        skillItems.forEach(item => {
            const profCheck = item.querySelector('.skill-prof');
            const expCheck = item.querySelector('.skill-exp');

            if (profCheck) {
                profCheck.addEventListener('change', () => this.updateSkillBonus(item));
            }
            if (expCheck) {
                expCheck.addEventListener('change', () => {
                    // Expertise requiere proficiency
                    if (expCheck.checked && profCheck && !profCheck.checked) {
                        profCheck.checked = true;
                    }
                    this.updateSkillBonus(item);
                });
            }
        });
    }

    initSavingThrowListeners() {
        const saves = ['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha'];
        saves.forEach(save => {
            const checkbox = document.getElementById(`saveProf${save}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => this.updateSavingThrows());
            }
        });
    }

    switchTab(tabName) {
        // Actualizar botones de tab
        const tabBtns = this.modal.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Actualizar paneles
        const tabPanes = this.modal.querySelectorAll('.tab-pane');
        tabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.dataset.tab === tabName);
        });
    }

    show() {
        this.modal.classList.add('active');
        // Actualizar todos los cálculos al mostrar
        this.updateAllCalculations();
    }

    hide() {
        this.modal.classList.remove('active');
    }

    // Calcular modificador de atributo
    calculateModifier(score) {
        return Math.floor((score - 10) / 2);
    }

    // Calcular bonus de competencia por nivel
    calculateProficiencyBonus(level) {
        return Math.floor((level - 1) / 4) + 2;
    }

    // Actualizar el modificador mostrado de un atributo
    updateModifier(ability) {
        const input = document.getElementById(`ability${ability}`);
        const modSpan = document.getElementById(`mod${ability}`);
        const score = parseInt(input.value) || 10;
        const mod = this.calculateModifier(score);
        modSpan.textContent = mod >= 0 ? `+${mod}` : mod.toString();
    }

    // Actualizar todos los cálculos
    updateAllCalculations() {
        // Actualizar todos los modificadores de atributos
        const abilities = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
        abilities.forEach(ability => this.updateModifier(ability));

        // Actualizar bonus de competencia
        const level = parseInt(document.getElementById('charLevel').value) || 1;
        const profBonus = this.calculateProficiencyBonus(level);
        document.getElementById('proficiencyBonus').textContent = `+${profBonus}`;

        // Actualizar tiradas de salvación
        this.updateSavingThrows();

        // Actualizar todas las habilidades
        const skillItems = this.modal.querySelectorAll('.skill-item');
        skillItems.forEach(item => this.updateSkillBonus(item));

        // Actualizar percepción pasiva
        this.updatePassivePerception();

        // Actualizar stats de conjuros
        this.updateSpellStats();

        // Actualizar porcentaje de completitud
        this.updateCompletion();
    }

    // Actualizar bonus de una habilidad
    updateSkillBonus(skillItem) {
        const ability = skillItem.dataset.ability;
        const profCheck = skillItem.querySelector('.skill-prof');
        const expCheck = skillItem.querySelector('.skill-exp');
        const bonusSpan = skillItem.querySelector('.skill-bonus');

        // Mapeo de ability a elemento
        const abilityMap = {
            'strength': 'Strength',
            'dexterity': 'Dexterity',
            'constitution': 'Constitution',
            'intelligence': 'Intelligence',
            'wisdom': 'Wisdom',
            'charisma': 'Charisma'
        };

        const abilityElement = document.getElementById(`ability${abilityMap[ability]}`);
        const abilityScore = parseInt(abilityElement?.value) || 10;
        const abilityMod = this.calculateModifier(abilityScore);

        const level = parseInt(document.getElementById('charLevel').value) || 1;
        const profBonus = this.calculateProficiencyBonus(level);

        let bonus = abilityMod;
        if (profCheck?.checked) {
            bonus += profBonus;
        }
        if (expCheck?.checked && profCheck?.checked) {
            bonus += profBonus; // Expertise duplica el bonus
        }

        bonusSpan.textContent = bonus >= 0 ? `+${bonus}` : bonus.toString();
    }

    // Actualizar tiradas de salvación
    updateSavingThrows() {
        const level = parseInt(document.getElementById('charLevel').value) || 1;
        const profBonus = this.calculateProficiencyBonus(level);

        const saves = [
            { id: 'Str', ability: 'Strength' },
            { id: 'Dex', ability: 'Dexterity' },
            { id: 'Con', ability: 'Constitution' },
            { id: 'Int', ability: 'Intelligence' },
            { id: 'Wis', ability: 'Wisdom' },
            { id: 'Cha', ability: 'Charisma' }
        ];

        saves.forEach(save => {
            const checkbox = document.getElementById(`saveProf${save.id}`);
            const bonusSpan = document.getElementById(`save${save.id}Bonus`);
            const abilityInput = document.getElementById(`ability${save.ability}`);

            const abilityScore = parseInt(abilityInput?.value) || 10;
            const abilityMod = this.calculateModifier(abilityScore);

            let bonus = abilityMod;
            if (checkbox?.checked) {
                bonus += profBonus;
            }

            bonusSpan.textContent = bonus >= 0 ? `+${bonus}` : bonus.toString();
        });
    }

    // Actualizar percepción pasiva
    updatePassivePerception() {
        const wisdomInput = document.getElementById('abilityWisdom');
        const wisdomScore = parseInt(wisdomInput?.value) || 10;
        const wisdomMod = this.calculateModifier(wisdomScore);

        const level = parseInt(document.getElementById('charLevel').value) || 1;
        const profBonus = this.calculateProficiencyBonus(level);

        const perceptionProf = document.getElementById('skillPerception');
        const perceptionExp = document.getElementById('skillPerceptionExp');

        let bonus = wisdomMod;
        if (perceptionProf?.checked) {
            bonus += profBonus;
        }
        if (perceptionExp?.checked && perceptionProf?.checked) {
            bonus += profBonus;
        }

        document.getElementById('passivePerception').textContent = 10 + bonus;
    }

    // Actualizar stats de lanzamiento de conjuros
    updateSpellStats() {
        const abilitySelect = document.getElementById('spellcastingAbility');
        const ability = abilitySelect.value;

        if (!ability) {
            document.getElementById('spellSaveDC').textContent = '8';
            document.getElementById('spellAttackBonus').textContent = '+0';
            return;
        }

        const abilityMap = {
            'intelligence': 'Intelligence',
            'wisdom': 'Wisdom',
            'charisma': 'Charisma'
        };

        const abilityInput = document.getElementById(`ability${abilityMap[ability]}`);
        const abilityScore = parseInt(abilityInput?.value) || 10;
        const abilityMod = this.calculateModifier(abilityScore);

        const level = parseInt(document.getElementById('charLevel').value) || 1;
        const profBonus = this.calculateProficiencyBonus(level);

        const saveDC = 8 + profBonus + abilityMod;
        const attackBonus = profBonus + abilityMod;

        document.getElementById('spellSaveDC').textContent = saveDC;
        document.getElementById('spellAttackBonus').textContent = attackBonus >= 0 ? `+${attackBonus}` : attackBonus.toString();
    }

    // Calcular y mostrar porcentaje de completitud
    updateCompletion() {
        const data = this.getCharacterData();
        const requiredFields = [
            data.name,
            data.class,
            data.level > 0,
            data.race,
            data.abilities?.strength !== 10 || data.abilities?.dexterity !== 10,
            data.abilities?.constitution !== 10 || data.abilities?.intelligence !== 10,
            data.abilities?.wisdom !== 10 || data.abilities?.charisma !== 10
        ];

        // Contar campos realmente requeridos
        const checks = [
            !!data.name,
            !!data.class,
            data.level > 0,
            !!data.race,
            data.abilities?.strength > 0,
            data.abilities?.dexterity > 0,
            data.abilities?.constitution > 0,
            data.abilities?.intelligence > 0,
            data.abilities?.wisdom > 0,
            data.abilities?.charisma > 0
        ];

        const filled = checks.filter(Boolean).length;
        const percent = Math.round((filled / checks.length) * 100);

        document.getElementById('completionPercent').textContent = percent;
        document.getElementById('completionFill').style.width = `${percent}%`;

        return percent;
    }

    // Obtener datos del formulario
    getCharacterData() {
        return {
            name: document.getElementById('charName')?.value || '',
            class: document.getElementById('charClass')?.value || '',
            level: parseInt(document.getElementById('charLevel')?.value) || 1,
            race: document.getElementById('charRace')?.value || '',
            background: document.getElementById('charBackground')?.value || '',
            alignment: document.getElementById('charAlignment')?.value || '',
            xp: parseInt(document.getElementById('charXP')?.value) || 0,

            abilities: {
                strength: parseInt(document.getElementById('abilityStrength')?.value) || 10,
                dexterity: parseInt(document.getElementById('abilityDexterity')?.value) || 10,
                constitution: parseInt(document.getElementById('abilityConstitution')?.value) || 10,
                intelligence: parseInt(document.getElementById('abilityIntelligence')?.value) || 10,
                wisdom: parseInt(document.getElementById('abilityWisdom')?.value) || 10,
                charisma: parseInt(document.getElementById('abilityCharisma')?.value) || 10
            },

            combat: {
                armorClass: parseInt(document.getElementById('combatAC')?.value) || 10,
                initiative: parseInt(document.getElementById('combatInitiative')?.value) || 0,
                speed: parseInt(document.getElementById('combatSpeed')?.value) || 30,
                hpMax: parseInt(document.getElementById('hpMax')?.value) || 0,
                hpCurrent: parseInt(document.getElementById('hpCurrent')?.value) || 0,
                hpTemp: parseInt(document.getElementById('hpTemp')?.value) || 0,
                hitDice: document.getElementById('hitDice')?.value || '',
                deathSaves: {
                    successes: this.countChecked(['deathSuccess1', 'deathSuccess2', 'deathSuccess3']),
                    failures: this.countChecked(['deathFail1', 'deathFail2', 'deathFail3'])
                }
            },

            savingThrows: {
                strength: document.getElementById('saveProfStr')?.checked || false,
                dexterity: document.getElementById('saveProfDex')?.checked || false,
                constitution: document.getElementById('saveProfCon')?.checked || false,
                intelligence: document.getElementById('saveProfInt')?.checked || false,
                wisdom: document.getElementById('saveProfWis')?.checked || false,
                charisma: document.getElementById('saveProfCha')?.checked || false
            },

            skills: this.getSkillsData(),

            spellcasting: {
                class: document.getElementById('spellcastingClass')?.value || '',
                ability: document.getElementById('spellcastingAbility')?.value || '',
                notes: document.getElementById('spellsNotes')?.value || ''
            },

            personality: {
                traits: document.getElementById('personalityTraits')?.value || '',
                ideals: document.getElementById('personalityIdeals')?.value || '',
                bonds: document.getElementById('personalityBonds')?.value || '',
                flaws: document.getElementById('personalityFlaws')?.value || ''
            },

            features: document.getElementById('features')?.value || '',
            equipment: document.getElementById('equipment')?.value || ''
        };
    }

    countChecked(ids) {
        return ids.filter(id => document.getElementById(id)?.checked).length;
    }

    getSkillsData() {
        const skills = {};
        const skillNames = [
            'Acrobatics', 'AnimalHandling', 'Arcana', 'Athletics', 'Deception',
            'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
            'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
            'SleightOfHand', 'Stealth', 'Survival'
        ];

        skillNames.forEach(name => {
            const prof = document.getElementById(`skill${name}`)?.checked || false;
            const exp = document.getElementById(`skill${name}Exp`)?.checked || false;
            skills[name.charAt(0).toLowerCase() + name.slice(1)] = { proficient: prof, expertise: exp };
        });

        return skills;
    }

    // Cargar datos en el formulario
    loadCharacter(data) {
        if (!data) return;

        // Info básica
        document.getElementById('charName').value = data.name || '';
        document.getElementById('charClass').value = data.class || '';
        document.getElementById('charLevel').value = data.level || 1;
        document.getElementById('charRace').value = data.race || '';
        document.getElementById('charBackground').value = data.background || '';
        document.getElementById('charAlignment').value = data.alignment || '';
        document.getElementById('charXP').value = data.xp || 0;

        // Atributos
        if (data.abilities) {
            document.getElementById('abilityStrength').value = data.abilities.strength || 10;
            document.getElementById('abilityDexterity').value = data.abilities.dexterity || 10;
            document.getElementById('abilityConstitution').value = data.abilities.constitution || 10;
            document.getElementById('abilityIntelligence').value = data.abilities.intelligence || 10;
            document.getElementById('abilityWisdom').value = data.abilities.wisdom || 10;
            document.getElementById('abilityCharisma').value = data.abilities.charisma || 10;
        }

        // Combate
        if (data.combat) {
            document.getElementById('combatAC').value = data.combat.armorClass || 10;
            document.getElementById('combatInitiative').value = data.combat.initiative || 0;
            document.getElementById('combatSpeed').value = data.combat.speed || 30;
            document.getElementById('hpMax').value = data.combat.hpMax || 0;
            document.getElementById('hpCurrent').value = data.combat.hpCurrent || 0;
            document.getElementById('hpTemp').value = data.combat.hpTemp || 0;
            document.getElementById('hitDice').value = data.combat.hitDice || '';

            // Death saves
            if (data.combat.deathSaves) {
                for (let i = 1; i <= 3; i++) {
                    document.getElementById(`deathSuccess${i}`).checked = i <= (data.combat.deathSaves.successes || 0);
                    document.getElementById(`deathFail${i}`).checked = i <= (data.combat.deathSaves.failures || 0);
                }
            }
        }

        // Tiradas de salvación
        if (data.savingThrows) {
            document.getElementById('saveProfStr').checked = data.savingThrows.strength || false;
            document.getElementById('saveProfDex').checked = data.savingThrows.dexterity || false;
            document.getElementById('saveProfCon').checked = data.savingThrows.constitution || false;
            document.getElementById('saveProfInt').checked = data.savingThrows.intelligence || false;
            document.getElementById('saveProfWis').checked = data.savingThrows.wisdom || false;
            document.getElementById('saveProfCha').checked = data.savingThrows.charisma || false;
        }

        // Habilidades
        if (data.skills) {
            Object.keys(data.skills).forEach(skillName => {
                const skill = data.skills[skillName];
                const capitalName = skillName.charAt(0).toUpperCase() + skillName.slice(1);
                const profEl = document.getElementById(`skill${capitalName}`);
                const expEl = document.getElementById(`skill${capitalName}Exp`);
                if (profEl) profEl.checked = skill.proficient || false;
                if (expEl) expEl.checked = skill.expertise || false;
            });
        }

        // Conjuros
        if (data.spellcasting) {
            document.getElementById('spellcastingClass').value = data.spellcasting.class || '';
            document.getElementById('spellcastingAbility').value = data.spellcasting.ability || '';
            document.getElementById('spellsNotes').value = data.spellcasting.notes || '';
        }

        // Personalidad
        if (data.personality) {
            document.getElementById('personalityTraits').value = data.personality.traits || '';
            document.getElementById('personalityIdeals').value = data.personality.ideals || '';
            document.getElementById('personalityBonds').value = data.personality.bonds || '';
            document.getElementById('personalityFlaws').value = data.personality.flaws || '';
        }

        document.getElementById('features').value = data.features || '';
        document.getElementById('equipment').value = data.equipment || '';

        this.characterData = data;
        this.isLoaded = true;
        this.updateAllCalculations();
    }

    // Guardar personaje en el servidor
    async save() {
        try {
            const characterData = this.getCharacterData();
            const characterName = characterData.name || 'Sin nombre';

            if (!this.app.currentUser?.id) {
                showNotification('Error: Usuario no identificado', 'error');
                return;
            }

            const result = await apiClient.saveCharacter(
                this.app.currentRoom.code,
                this.app.currentUser.hash,
                characterName,
                characterData
            );

            if (result.success) {
                this.characterId = result.character.id;
                showNotification('Personaje guardado correctamente', 'success');

                // Actualizar indicador de completitud en el botón
                const completion = this.updateCompletion();
                this.updateIncompleteIndicator(completion);
            } else {
                showNotification('Error al guardar: ' + (result.error || 'Error desconocido'), 'error');
            }
        } catch (error) {
            console.error('Error al guardar personaje:', error);
            showNotification('Error al guardar personaje', 'error');
        }
    }

    // Cargar personaje del servidor
    async loadFromServer() {
        try {
            if (!this.app.currentUser?.hash || !this.app.currentRoom?.code) {
                return null;
            }

            const result = await apiClient.getCharacter(
                this.app.currentRoom.code,
                this.app.currentUser.hash
            );

            if (result.success && result.character) {
                this.characterId = result.character.id;
                this.loadCharacter(result.character.characterData);
                this.updateIncompleteIndicator(result.character.completionPercent);
                return result.character;
            }

            return null;
        } catch (error) {
            console.error('Error al cargar personaje:', error);
            return null;
        }
    }

    // Actualizar indicador de ficha incompleta
    updateIncompleteIndicator(completionPercent) {
        const indicator = document.getElementById('characterIncomplete');
        if (indicator) {
            // Mostrar indicador si está menos del 70% completo
            indicator.style.display = completionPercent < 70 ? 'inline-block' : 'none';
        }
    }
}

export { CharacterSheet };
