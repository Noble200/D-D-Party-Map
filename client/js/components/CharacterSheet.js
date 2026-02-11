// ==========================================
// Componente de Hoja de Personaje D&D 5e
// ==========================================

import { apiClient } from '../core/ApiClient.js';
import { showNotification } from '../utils/helpers.js';
import { DEFAULT_CHARACTER, SKILL_ABILITIES, SKILL_NAMES_ES } from '../config.js';

class CharacterSheet {
    constructor(app) {
        this.app = app;
        this.modal = document.getElementById('characterSheetModal');
        this.characterData = { ...DEFAULT_CHARACTER };
        this.characterId = null;
        this.isLoaded = false;
        this.initialized = false;
        // Bonificadores raciales activos
        this.currentRaceBonuses = {};
        this.currentRaceSkills = [];
        // Datos de razas cargados desde JSON
        this.raceData = null;
        this.raceDataLoaded = false;
    }

    // Cargar datos de razas desde el archivo JSON
    async loadRaceData() {
        if (this.raceDataLoaded) return this.raceData;

        try {
            const response = await fetch('/data/races.json');
            if (!response.ok) {
                throw new Error(`Error cargando razas: ${response.status}`);
            }
            this.raceData = await response.json();
            this.raceDataLoaded = true;
            console.log('Datos de razas cargados correctamente');
            return this.raceData;
        } catch (error) {
            console.error('Error al cargar datos de razas:', error);
            showNotification('Error al cargar datos de razas', 'error');
            return null;
        }
    }

    // Obtener datos de una raza específica
    getRaceInfo(raceKey) {
        if (!this.raceData || !raceKey) return null;
        return this.raceData[raceKey] || null;
    }

    async init() {
        if (this.initialized) return;

        // Cargar datos de razas desde JSON antes de inicializar listeners
        await this.loadRaceData();

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

        // Botones +/- para atributos
        this.initAbilityButtons();

        // Listeners de habilidades
        this.initSkillListeners();

        // Listener de nivel para bonus de competencia
        document.getElementById('charLevel').addEventListener('change', () => this.updateAllCalculations());

        // Listeners de botones de nivel +/-
        this.initLevelButtons();

        // Listeners para campos custom (raza/trasfondo "Otro")
        this.initCustomFieldListeners();

        // Listeners de tiradas de salvación
        this.initSavingThrowListeners();

        // Listener de habilidad de lanzamiento
        document.getElementById('spellcastingAbility')?.addEventListener('change', () => this.updateSpellStats());

        // Listeners de raza y subraza
        this.initRaceListeners();

        this.initialized = true;
    }

    // ==========================================
    // Manejo de Razas
    // ==========================================

    initRaceListeners() {
        const raceSelect = document.getElementById('charRace');
        const subraceSelect = document.getElementById('charSubrace');

        if (raceSelect) {
            raceSelect.addEventListener('change', () => this.onRaceChange());
        }

        if (subraceSelect) {
            subraceSelect.addEventListener('change', () => this.onSubraceChange());
        }
    }

    onRaceChange() {
        const raceSelect = document.getElementById('charRace');
        const raceKey = raceSelect.value;

        console.log('onRaceChange llamado, raza:', raceKey);
        console.log('raceData cargado:', this.raceDataLoaded);

        // Limpiar bonificadores anteriores
        this.clearRaceBonuses();

        if (!raceKey || raceKey === 'Other') {
            this.hideRaceInfo();
            this.hideSubraceSelect();
            return;
        }

        const raceInfo = this.getRaceInfo(raceKey);
        console.log('raceInfo obtenido:', raceInfo);

        if (!raceInfo) {
            console.warn('No se encontró info para la raza:', raceKey);
            this.hideRaceInfo();
            this.hideSubraceSelect();
            return;
        }

        // Mostrar u ocultar selector de subraza
        if (raceInfo.subraces) {
            console.log('Raza tiene subrrazas:', Object.keys(raceInfo.subraces));
            this.populateSubraces(raceInfo.subraces);
            this.showSubraceSelect();
            // También mostrar info de la raza base y aplicar bonificadores base
            this.applyRaceBonuses(raceInfo);
            this.updateRaceInfo(raceInfo);
        } else {
            console.log('Raza sin subrrazas, aplicando bonificadores directamente');
            this.hideSubraceSelect();
            // Aplicar bonificadores de raza base
            this.applyRaceBonuses(raceInfo);
            this.updateRaceInfo(raceInfo);
        }
    }

    onSubraceChange() {
        const raceSelect = document.getElementById('charRace');
        const subraceSelect = document.getElementById('charSubrace');
        const raceKey = raceSelect.value;
        const subraceKey = subraceSelect.value;

        // Limpiar bonificadores anteriores
        this.clearRaceBonuses();

        const raceInfo = this.getRaceInfo(raceKey);
        if (!raceKey || !raceInfo) return;

        if (subraceKey && raceInfo.subraces && raceInfo.subraces[subraceKey]) {
            const subraceData = raceInfo.subraces[subraceKey];
            // Combinar datos de raza base + subraza
            this.applyRaceBonuses(raceInfo, subraceData);
            this.updateRaceInfo(raceInfo, subraceData);
        } else {
            // Solo raza base sin subraza seleccionada
            this.applyRaceBonuses(raceInfo);
            this.updateRaceInfo(raceInfo);
        }
    }

    populateSubraces(subraces) {
        const subraceSelect = document.getElementById('charSubrace');
        if (!subraceSelect) return;

        // Limpiar opciones anteriores
        subraceSelect.innerHTML = '<option value="">Seleccionar subraza...</option>';

        // Agregar subrrazas
        for (const [key, subrace] of Object.entries(subraces)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = subrace.name;
            subraceSelect.appendChild(option);
        }
    }

    showSubraceSelect() {
        const subraceSelect = document.getElementById('charSubrace');
        if (subraceSelect) {
            subraceSelect.classList.remove('hidden');
        }
    }

    hideSubraceSelect() {
        const subraceSelect = document.getElementById('charSubrace');
        if (subraceSelect) {
            subraceSelect.classList.add('hidden');
            subraceSelect.value = '';
        }
    }

    applyRaceBonuses(raceData, subraceData = null) {
        // Combinar bonificadores de raza base + subraza
        const bonuses = { ...raceData.abilityBonuses };

        if (subraceData && subraceData.abilityBonuses) {
            for (const [ability, bonus] of Object.entries(subraceData.abilityBonuses)) {
                bonuses[ability] = (bonuses[ability] || 0) + bonus;
            }
        }

        // Guardar bonificadores actuales
        this.currentRaceBonuses = bonuses;

        // Mostrar bonificadores en la UI
        const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
        abilities.forEach(ability => {
            const capitalAbility = ability.charAt(0).toUpperCase() + ability.slice(1);
            const bonusSpan = document.getElementById(`raceBonus${capitalAbility}`);
            const bonus = bonuses[ability] || 0;

            if (bonusSpan) {
                if (bonus > 0) {
                    bonusSpan.textContent = `+${bonus}`;
                    bonusSpan.classList.remove('hidden');
                    bonusSpan.classList.add('bonus-positive');
                } else {
                    bonusSpan.textContent = '';
                    bonusSpan.classList.add('hidden');
                    bonusSpan.classList.remove('bonus-positive');
                }
            }
        });

        // Aplicar competencias de habilidades raciales
        this.applyRaceSkillProficiencies(raceData, subraceData);

        // Aplicar velocidad
        const speed = subraceData?.speed || raceData.speed || 30;
        const speedInput = document.getElementById('combatSpeed');
        if (speedInput) {
            speedInput.value = speed;
        }

        // Recalcular todos los valores
        this.updateAllCalculations();
    }

    applyRaceSkillProficiencies(raceData, subraceData = null) {
        // Combinar competencias de raza + subraza
        const skills = [...(raceData.skillProficiencies || [])];
        if (subraceData?.skillProficiencies) {
            skills.push(...subraceData.skillProficiencies);
        }

        // Limpiar competencias raciales anteriores
        this.clearRaceSkillProficiencies();

        // Guardar nuevas competencias raciales
        this.currentRaceSkills = skills;

        // Aplicar nuevas competencias
        skills.forEach(skillKey => {
            const capitalSkill = skillKey.charAt(0).toUpperCase() + skillKey.slice(1);
            const skillItem = this.modal.querySelector(`.skill-item[data-skill="${skillKey}"]`) ||
                              this.modal.querySelector(`#skill${capitalSkill}`)?.closest('.skill-item');

            if (skillItem) {
                const profCheck = skillItem.querySelector('.skill-prof');
                if (profCheck) {
                    profCheck.checked = true;
                    profCheck.disabled = true;
                    skillItem.classList.add('race-proficiency');
                }

                // Agregar indicador de origen racial
                let sourceSpan = skillItem.querySelector('.skill-source');
                if (!sourceSpan) {
                    sourceSpan = document.createElement('span');
                    sourceSpan.className = 'skill-source';
                    const skillName = skillItem.querySelector('.skill-name');
                    if (skillName) {
                        skillName.insertAdjacentElement('afterend', sourceSpan);
                    }
                }
                sourceSpan.textContent = '(Raza)';
            }
        });
    }

    clearRaceSkillProficiencies() {
        // Restaurar competencias que fueron aplicadas por raza
        this.currentRaceSkills.forEach(skillKey => {
            const capitalSkill = skillKey.charAt(0).toUpperCase() + skillKey.slice(1);
            const skillItem = this.modal.querySelector(`.skill-item[data-skill="${skillKey}"]`) ||
                              this.modal.querySelector(`#skill${capitalSkill}`)?.closest('.skill-item');

            if (skillItem) {
                const profCheck = skillItem.querySelector('.skill-prof');
                if (profCheck) {
                    profCheck.checked = false;
                    profCheck.disabled = false;
                }
                skillItem.classList.remove('race-proficiency');

                const sourceSpan = skillItem.querySelector('.skill-source');
                if (sourceSpan) {
                    sourceSpan.remove();
                }
            }
        });
        this.currentRaceSkills = [];
    }

    clearRaceBonuses() {
        // Limpiar bonificadores visuales
        const abilities = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
        abilities.forEach(ability => {
            const bonusSpan = document.getElementById(`raceBonus${ability}`);
            if (bonusSpan) {
                bonusSpan.textContent = '';
                bonusSpan.classList.add('hidden');
                bonusSpan.classList.remove('bonus-positive');
            }
        });
        this.currentRaceBonuses = {};

        // Limpiar competencias raciales
        this.clearRaceSkillProficiencies();
    }

    updateRaceInfo(raceData, subraceData = null) {
        const panel = document.getElementById('raceInfoPanel');
        const titleSpan = document.getElementById('raceInfoTitle');
        const statsSpan = document.getElementById('raceInfoStats');
        const bonusesDiv = document.getElementById('raceBonusesDisplay');
        const traitsList = document.getElementById('raceTraitsList');

        if (!panel) return;

        // Título
        let title = raceData.name;
        if (subraceData) {
            title = subraceData.name;
        }
        titleSpan.textContent = title;

        // Stats (velocidad, visión, tamaño)
        const speed = subraceData?.speed || raceData.speed || 30;
        const darkvision = subraceData?.darkvision ?? raceData.darkvision ?? 0;
        const flySpeed = subraceData?.flySpeed || raceData.flySpeed || 0;
        const climbSpeed = subraceData?.climbSpeed || raceData.climbSpeed || 0;
        const swimSpeed = subraceData?.swimSpeed || raceData.swimSpeed || 0;

        let statsText = `Velocidad: ${speed} pies`;
        if (flySpeed) statsText += ` | Vuelo: ${flySpeed} pies`;
        if (climbSpeed) statsText += ` | Trepar: ${climbSpeed} pies`;
        if (swimSpeed) statsText += ` | Nadar: ${swimSpeed} pies`;
        if (darkvision > 0) statsText += ` | Visión oscura: ${darkvision} pies`;
        statsText += ` | Tamaño: ${raceData.size}`;
        statsSpan.textContent = statsText;

        // Bonificadores de características
        const bonuses = { ...raceData.abilityBonuses };
        if (subraceData?.abilityBonuses) {
            for (const [ability, bonus] of Object.entries(subraceData.abilityBonuses)) {
                bonuses[ability] = (bonuses[ability] || 0) + bonus;
            }
        }

        const abilityNames = {
            strength: 'FUE', dexterity: 'DES', constitution: 'CON',
            intelligence: 'INT', wisdom: 'SAB', charisma: 'CAR'
        };

        const bonusStrings = Object.entries(bonuses)
            .filter(([_, v]) => v > 0)
            .map(([ability, bonus]) => `${abilityNames[ability]} +${bonus}`);

        bonusesDiv.textContent = bonusStrings.length > 0 ? bonusStrings.join(', ') : '';

        // Limpiar lista de rasgos
        traitsList.innerHTML = '';

        // Idiomas
        const languages = [...(raceData.languages || [])];
        if (subraceData?.languages) {
            languages.push(...subraceData.languages);
        }
        if (languages.length > 0) {
            const li = document.createElement('li');
            li.innerHTML = `<strong>Idiomas:</strong> ${languages.join(', ')}`;
            traitsList.appendChild(li);
        }

        // Competencias de habilidades
        const skillProfs = [...(raceData.skillProficiencies || [])];
        if (subraceData?.skillProficiencies) {
            skillProfs.push(...subraceData.skillProficiencies);
        }
        if (skillProfs.length > 0) {
            const skillNamesSpanish = skillProfs.map(s => SKILL_NAMES_ES[s] || s);
            const li = document.createElement('li');
            li.innerHTML = `<strong>Competencias:</strong> ${skillNamesSpanish.join(', ')}`;
            traitsList.appendChild(li);
        }

        // Competencias con armas
        const weaponProfs = [...(raceData.weaponProficiencies || [])];
        if (subraceData?.weaponProficiencies) {
            weaponProfs.push(...subraceData.weaponProficiencies);
        }
        if (weaponProfs.length > 0) {
            const li = document.createElement('li');
            li.innerHTML = `<strong>Armas:</strong> ${weaponProfs.join(', ')}`;
            traitsList.appendChild(li);
        }

        // Competencias con armaduras
        const armorProfs = [...(raceData.armorProficiencies || [])];
        if (subraceData?.armorProficiencies) {
            armorProfs.push(...subraceData.armorProficiencies);
        }
        if (armorProfs.length > 0) {
            const li = document.createElement('li');
            li.innerHTML = `<strong>Armaduras:</strong> ${armorProfs.join(', ')}`;
            traitsList.appendChild(li);
        }

        // Rasgos (traits) - soporta formato objeto {name, description} o string
        const traits = [...(raceData.traits || [])];
        if (subraceData?.traits) {
            traits.push(...subraceData.traits);
        }

        traits.forEach(trait => {
            const li = document.createElement('li');
            if (typeof trait === 'object' && trait.name) {
                // Formato objeto del JSON
                li.innerHTML = `<strong>${trait.name}:</strong> ${trait.description}`;
            } else {
                // Formato string simple (compatibilidad)
                li.textContent = trait;
            }
            traitsList.appendChild(li);
        });

        // Conjuros raciales (si existen)
        const spells = [...(raceData.spells || [])];
        if (subraceData?.spells) {
            spells.push(...subraceData.spells);
        }
        if (spells.length > 0) {
            const li = document.createElement('li');
            const spellNames = spells.map(s => typeof s === 'object' ? s.name : s);
            li.innerHTML = `<strong>Conjuros innatos:</strong> ${spellNames.join(', ')}`;
            traitsList.appendChild(li);
        }

        // Mostrar panel
        panel.classList.remove('hidden');
    }

    hideRaceInfo() {
        const panel = document.getElementById('raceInfoPanel');
        if (panel) {
            panel.classList.add('hidden');
        }
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

    // Botones +/- para atributos
    initAbilityButtons() {
        const buttons = this.modal.querySelectorAll('.ability-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const targetId = btn.dataset.target;
                const input = document.getElementById(targetId);

                if (!input) return;

                let value = parseInt(input.value) || 10;

                if (action === 'increment' && value < 30) {
                    value++;
                } else if (action === 'decrement' && value > 1) {
                    value--;
                }

                input.value = value;

                // Extraer el nombre del atributo del ID (abilityStrength -> Strength)
                const abilityName = targetId.replace('ability', '');
                this.updateModifier(abilityName);
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

    // Botones de nivel +/-
    initLevelButtons() {
        const levelInput = document.getElementById('charLevel');
        const btnDown = this.modal.querySelector('.level-btn-down');
        const btnUp = this.modal.querySelector('.level-btn-up');

        if (btnDown) {
            btnDown.addEventListener('click', () => {
                const current = parseInt(levelInput.value) || 1;
                if (current > 1) {
                    levelInput.value = current - 1;
                    this.updateAllCalculations();
                }
            });
        }

        if (btnUp) {
            btnUp.addEventListener('click', () => {
                const current = parseInt(levelInput.value) || 1;
                if (current < 20) {
                    levelInput.value = current + 1;
                    this.updateAllCalculations();
                }
            });
        }
    }

    // Campos custom para "Otra" raza y "Otro" trasfondo
    initCustomFieldListeners() {
        const raceSelect = document.getElementById('charRace');
        const raceCustom = document.getElementById('charRaceCustom');
        const bgSelect = document.getElementById('charBackground');
        const bgCustom = document.getElementById('charBackgroundCustom');

        if (raceSelect && raceCustom) {
            raceSelect.addEventListener('change', () => {
                if (raceSelect.value === 'Other') {
                    raceCustom.classList.remove('hidden');
                    raceCustom.focus();
                } else {
                    raceCustom.classList.add('hidden');
                    raceCustom.value = '';
                }
            });
        }

        if (bgSelect && bgCustom) {
            bgSelect.addEventListener('change', () => {
                if (bgSelect.value === 'Other') {
                    bgCustom.classList.remove('hidden');
                    bgCustom.focus();
                } else {
                    bgCustom.classList.add('hidden');
                    bgCustom.value = '';
                }
            });
        }
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

    // Actualizar el modificador mostrado de un atributo (incluyendo bonus racial)
    updateModifier(ability) {
        const input = document.getElementById(`ability${ability}`);
        const modSpan = document.getElementById(`mod${ability}`);
        const totalSpan = document.getElementById(`total${ability}`);

        const baseScore = parseInt(input.value) || 10;
        const abilityLower = ability.toLowerCase();
        const raceBonus = this.currentRaceBonuses[abilityLower] || 0;
        const totalScore = baseScore + raceBonus;

        // Actualizar total
        if (totalSpan) {
            totalSpan.textContent = totalScore;
        }

        // Calcular modificador basado en el total
        const mod = this.calculateModifier(totalScore);
        modSpan.textContent = mod >= 0 ? `+${mod}` : mod.toString();
    }

    // Obtener el valor total de un atributo (base + racial)
    getTotalAbilityScore(ability) {
        const capitalAbility = ability.charAt(0).toUpperCase() + ability.slice(1);
        const input = document.getElementById(`ability${capitalAbility}`);
        const baseScore = parseInt(input?.value) || 10;
        const raceBonus = this.currentRaceBonuses[ability] || 0;
        return baseScore + raceBonus;
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

        // Obtener puntuación total del atributo (base + racial)
        const abilityScore = this.getTotalAbilityScore(ability);
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
            { id: 'Str', ability: 'strength' },
            { id: 'Dex', ability: 'dexterity' },
            { id: 'Con', ability: 'constitution' },
            { id: 'Int', ability: 'intelligence' },
            { id: 'Wis', ability: 'wisdom' },
            { id: 'Cha', ability: 'charisma' }
        ];

        saves.forEach(save => {
            const checkbox = document.getElementById(`saveProf${save.id}`);
            const bonusSpan = document.getElementById(`save${save.id}Bonus`);

            // Usar puntuación total (base + racial)
            const abilityScore = this.getTotalAbilityScore(save.ability);
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
        // Usar puntuación total (base + racial)
        const wisdomScore = this.getTotalAbilityScore('wisdom');
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

        // Usar puntuación total (base + racial)
        const abilityScore = this.getTotalAbilityScore(ability);
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
        // Obtener raza (custom si es "Other")
        const raceSelect = document.getElementById('charRace')?.value || '';
        const raceCustom = document.getElementById('charRaceCustom')?.value || '';
        const race = raceSelect === 'Other' ? raceCustom : raceSelect;

        // Obtener subraza
        const subraceSelect = document.getElementById('charSubrace')?.value || '';

        // Obtener trasfondo (custom si es "Other")
        const bgSelect = document.getElementById('charBackground')?.value || '';
        const bgCustom = document.getElementById('charBackgroundCustom')?.value || '';
        const background = bgSelect === 'Other' ? bgCustom : bgSelect;

        return {
            name: document.getElementById('charName')?.value || '',
            class: document.getElementById('charClass')?.value || '',
            level: parseInt(document.getElementById('charLevel')?.value) || 1,
            race: race,
            subrace: subraceSelect,
            raceCustom: raceSelect === 'Other' ? raceCustom : '',
            background: background,
            backgroundCustom: bgSelect === 'Other' ? bgCustom : '',
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

        // Raza - verificar si es custom
        const raceSelect = document.getElementById('charRace');
        const raceCustom = document.getElementById('charRaceCustom');
        const subraceSelect = document.getElementById('charSubrace');

        if (data.raceCustom) {
            raceSelect.value = 'Other';
            raceCustom.value = data.raceCustom;
            raceCustom.classList.remove('hidden');
            this.hideSubraceSelect();
            this.hideRaceInfo();
        } else {
            raceSelect.value = data.race || '';
            raceCustom.value = '';
            raceCustom.classList.add('hidden');

            // Cargar subraza si existe
            const raceInfo = this.getRaceInfo(data.race);
            if (data.race && raceInfo) {
                if (raceInfo.subraces && data.subrace) {
                    this.populateSubraces(raceInfo.subraces);
                    this.showSubraceSelect();
                    subraceSelect.value = data.subrace;
                    this.applyRaceBonuses(raceInfo, raceInfo.subraces[data.subrace]);
                    this.updateRaceInfo(raceInfo, raceInfo.subraces[data.subrace]);
                } else if (raceInfo.subraces) {
                    this.populateSubraces(raceInfo.subraces);
                    this.showSubraceSelect();
                } else {
                    this.hideSubraceSelect();
                    this.applyRaceBonuses(raceInfo);
                    this.updateRaceInfo(raceInfo);
                }
            } else {
                this.hideSubraceSelect();
                this.hideRaceInfo();
            }
        }

        // Trasfondo - verificar si es custom
        const bgSelect = document.getElementById('charBackground');
        const bgCustom = document.getElementById('charBackgroundCustom');
        if (data.backgroundCustom) {
            bgSelect.value = 'Other';
            bgCustom.value = data.backgroundCustom;
            bgCustom.classList.remove('hidden');
        } else {
            bgSelect.value = data.background || '';
            bgCustom.value = '';
            bgCustom.classList.add('hidden');
        }

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

            // Usar playerName para identificar (no requiere hash)
            const playerName = this.app.playerName;
            if (!playerName) {
                showNotification('Error: Nombre de jugador no identificado', 'error');
                return;
            }

            const result = await apiClient.saveCharacterByPlayerName(
                this.app.currentRoom.code,
                playerName,
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
            const playerName = this.app.playerName;
            if (!playerName || !this.app.currentRoom?.code) {
                return null;
            }

            const result = await apiClient.getCharacterByPlayerName(
                this.app.currentRoom.code,
                playerName
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
