// ==========================================
// Componente de Hoja de Personaje D&D 5e
// ==========================================

import { apiClient } from '../core/ApiClient.js';
import { showNotification } from '../utils/helpers.js';
import { DEFAULT_CHARACTER, SKILL_ABILITIES, SKILL_NAMES_ES, DEFAULT_CUSTOM_ABILITY, ABILITY_OPTIONS } from '../config.js';

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
        // Datos de clases cargados desde JSON
        this.classData = null;
        this.classDataLoaded = false;
        // Datos de conjuros cargados desde JSON
        this.spellsData = null;
        this.spellsDataLoaded = false;
        // Datos de trasfondos cargados desde JSON
        this.backgroundData = null;
        this.backgroundDataLoaded = false;
        // Conjuros seleccionados por el personaje
        this.selectedCantrips = [];
        this.selectedSpells = [];
        // Espacios de conjuros usados
        this.usedSpellSlots = {};
        // Habilidades personalizadas
        this.customAbilities = [];
        // Habilidad actualmente siendo editada (null para nueva)
        this.editingAbilityId = null;
        // Favoritos del jugador (para el dock de acciones)
        this.favorites = [];
        // Trackeo de usos por descanso { [id]: { max, current, recharge } }
        this.abilityUses = {};
        // Lista de bonificadores temporales para el formulario
        this.tempBonuses = [];
        // Foto y color del token
        this.tokenPhoto = null;
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

    // Cargar datos de clases desde el archivo JSON
    async loadClassData() {
        if (this.classDataLoaded) return this.classData;

        try {
            const response = await fetch('/data/classes.json');
            if (!response.ok) {
                throw new Error(`Error cargando clases: ${response.status}`);
            }
            this.classData = await response.json();
            this.classDataLoaded = true;
            console.log('Datos de clases cargados correctamente');
            return this.classData;
        } catch (error) {
            console.error('Error al cargar datos de clases:', error);
            return null;
        }
    }

    // Obtener datos de una clase específica
    getClassInfo(classKey) {
        if (!this.classData || !classKey) return null;
        return this.classData[classKey] || null;
    }

    // Cargar datos de conjuros desde el archivo JSON
    async loadSpellsData() {
        if (this.spellsDataLoaded) return this.spellsData;

        try {
            const response = await fetch('/data/spells.json');
            if (!response.ok) {
                throw new Error(`Error cargando conjuros: ${response.status}`);
            }
            this.spellsData = await response.json();
            this.spellsDataLoaded = true;
            console.log('Datos de conjuros cargados correctamente');
            return this.spellsData;
        } catch (error) {
            console.error('Error al cargar datos de conjuros:', error);
            return null;
        }
    }

    // Cargar datos de trasfondos desde el archivo JSON
    async loadBackgroundData() {
        if (this.backgroundDataLoaded) return this.backgroundData;

        try {
            const response = await fetch('/data/backgrounds.json');
            if (!response.ok) {
                throw new Error(`Error cargando trasfondos: ${response.status}`);
            }
            this.backgroundData = await response.json();
            this.backgroundDataLoaded = true;
            console.log('Datos de trasfondos cargados correctamente');
            return this.backgroundData;
        } catch (error) {
            console.error('Error al cargar datos de trasfondos:', error);
            return null;
        }
    }

    // Obtener datos de un trasfondo específico
    getBackgroundInfo(bgKey) {
        if (!this.backgroundData || !bgKey) return null;
        return this.backgroundData[bgKey] || null;
    }

    async init() {
        if (this.initialized) return;

        // Cargar todos los datos JSON en paralelo
        await Promise.all([
            this.loadRaceData(),
            this.loadClassData(),
            this.loadSpellsData(),
            this.loadBackgroundData()
        ]);

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

        // Listener de nivel para bonus de competencia y actualización de rasgos
        document.getElementById('charLevel').addEventListener('change', () => {
            this.updateAllCalculations();
            this.updateSpellsSection();
            this.updateHitDice(this.getClassInfo(document.getElementById('charClass')?.value));
        });

        // Listeners de botones de nivel +/-
        this.initLevelButtons();

        // Listeners para campos custom (raza/trasfondo "Otro")
        this.initCustomFieldListeners();

        // Listeners de tiradas de salvación
        this.initSavingThrowListeners();

        // Listener de habilidad de lanzamiento (si existe el elemento)
        const spellAbilitySelect = document.getElementById('spellcastingAbility');
        if (spellAbilitySelect) {
            spellAbilitySelect.addEventListener('change', () => this.updateSpellStats());
        }

        // Listeners de raza y subraza
        this.initRaceListeners();

        // Listeners de clase
        this.initClassListeners();

        // Listeners de trasfondo
        this.initBackgroundListeners();

        // Listeners del tab de conjuros
        this.initSpellsTabListeners();

        // Listeners de token (foto y color)
        this.initTokenConfigListeners();

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

        // Actualizar sección de habilidades automáticas
        this.updateAbilitiesSection();
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

        // Actualizar sección de habilidades automáticas
        this.updateAbilitiesSection();
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
        // Inyectar estrellas ★ en skills y saves (HTML estático)
        this.injectFavStarsOnSkillsAndSaves();
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

    // Actualizar stats de lanzamiento de conjuros (si existen los elementos)
    updateSpellStats() {
        const abilitySelect = document.getElementById('spellcastingAbility');
        const saveDCEl = document.getElementById('spellSaveDC');
        const attackBonusEl = document.getElementById('spellAttackBonus');

        // Si no existen los elementos, no hacer nada
        if (!abilitySelect || !saveDCEl || !attackBonusEl) return;

        const ability = abilitySelect.value;

        if (!ability) {
            saveDCEl.textContent = '8';
            attackBonusEl.textContent = '+0';
            return;
        }

        // Usar puntuación total (base + racial)
        const abilityScore = this.getTotalAbilityScore(ability);
        const abilityMod = this.calculateModifier(abilityScore);

        const level = parseInt(document.getElementById('charLevel').value) || 1;
        const profBonus = this.calculateProficiencyBonus(level);

        const saveDC = 8 + profBonus + abilityMod;
        const attackBonus = profBonus + abilityMod;

        saveDCEl.textContent = saveDC;
        attackBonusEl.textContent = attackBonus >= 0 ? `+${attackBonus}` : attackBonus.toString();
    }

    // ==========================================
    // Configuración de Token (foto y color)
    // ==========================================

    initTokenConfigListeners() {
        // Subir foto
        const photoInput = document.getElementById('tokenPhotoInput');
        if (photoInput) {
            photoInput.addEventListener('change', (e) => this.onPhotoSelected(e));
        }

        // Quitar foto
        const removeBtn = document.getElementById('btnRemoveTokenPhoto');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.removeTokenPhoto());
        }

        // Color del borde
        const colorInput = document.getElementById('tokenBorderColor');
        if (colorInput) {
            colorInput.addEventListener('input', () => this.updateTokenPreview());
        }

        // Listener del nombre para actualizar preview
        const nameInput = document.getElementById('charName');
        if (nameInput) {
            nameInput.addEventListener('input', () => this.updateTokenPreview());
        }

        // Renderizar preview inicial
        this.updateTokenPreview();
    }

    onPhotoSelected(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Limitar tamaño (500KB)
        if (file.size > 500 * 1024) {
            showNotification('La imagen es muy grande. Máximo 500KB.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            // Redimensionar para no sobrecargar
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxSize = 128;
                canvas.width = maxSize;
                canvas.height = maxSize;
                const ctx = canvas.getContext('2d');
                // Recortar al centro manteniendo aspect ratio (crop cuadrado)
                const side = Math.min(img.width, img.height);
                const sx = (img.width - side) / 2;
                const sy = (img.height - side) / 2;
                ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
                this.tokenPhoto = canvas.toDataURL('image/jpeg', 0.8);
                this.showPhotoPreview();
                this.updateTokenPreview();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    showPhotoPreview() {
        const preview = document.getElementById('tokenPhotoPreview');
        const removeBtn = document.getElementById('btnRemoveTokenPhoto');
        if (preview && this.tokenPhoto) {
            preview.innerHTML = `<img src="${this.tokenPhoto}" alt="Token">`;
            if (removeBtn) removeBtn.classList.remove('hidden');
        }
    }

    removeTokenPhoto() {
        this.tokenPhoto = null;
        const preview = document.getElementById('tokenPhotoPreview');
        const removeBtn = document.getElementById('btnRemoveTokenPhoto');
        const input = document.getElementById('tokenPhotoInput');
        if (preview) preview.innerHTML = '<span class="token-photo-placeholder">Sin foto</span>';
        if (removeBtn) removeBtn.classList.add('hidden');
        if (input) input.value = '';
        this.updateTokenPreview();
    }

    updateTokenPreview() {
        const canvas = document.getElementById('tokenPreviewCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const cx = w / 2;
        const cy = 55;
        const radius = 35;
        const name = document.getElementById('charName')?.value || 'Nombre';
        const borderColor = document.getElementById('tokenBorderColor')?.value || '#e74c3c';

        // Sombra
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        if (this.tokenPhoto) {
            // Dibujar foto recortada en circulo
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, w, h);
                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
                ctx.restore();

                // Borde
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.lineWidth = 3;
                ctx.strokeStyle = borderColor;
                ctx.stroke();

                // Nombre
                this.drawTokenPreviewName(ctx, cx, cy + radius + 14, name);
            };
            img.src = this.tokenPhoto;
        } else {
            // Circulo con color e iniciales
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = borderColor;
            ctx.fill();

            ctx.shadowColor = 'transparent';
            ctx.lineWidth = 3;
            ctx.strokeStyle = borderColor;
            ctx.stroke();

            // Iniciales
            const label = this.getTokenLabel(name);
            ctx.font = 'bold 22px Cinzel, serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, cx, cy);

            ctx.restore();

            // Nombre
            this.drawTokenPreviewName(ctx, cx, cy + radius + 14, name);
        }
    }

    drawTokenPreviewName(ctx, x, y, name) {
        ctx.font = '12px Cinzel, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText(name, x, y);
        ctx.fillText(name, x, y);
    }

    getTokenLabel(name) {
        if (!name) return '?';
        const words = name.trim().split(/\s+/);
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
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
                cantripsKnown: [...this.selectedCantrips],
                spellsKnown: [...this.selectedSpells],
                spellSlots: { ...this.usedSpellSlots },
                customAbilities: JSON.parse(JSON.stringify(this.customAbilities)),
                notes: document.getElementById('spellsNotes')?.value || ''
            },

            personality: {
                traits: document.getElementById('personalityTraits')?.value || '',
                ideals: document.getElementById('personalityIdeals')?.value || '',
                bonds: document.getElementById('personalityBonds')?.value || '',
                flaws: document.getElementById('personalityFlaws')?.value || ''
            },

            features: document.getElementById('features')?.value || '',
            equipment: document.getElementById('equipment')?.value || '',

            tokenPhoto: this.tokenPhoto || null,
            tokenBorderColor: document.getElementById('tokenBorderColor')?.value || '#e74c3c',

            // Sistema de favoritos y usos limitados (dock de acciones)
            favorites: JSON.parse(JSON.stringify(this.favorites || [])),
            abilityUses: JSON.parse(JSON.stringify(this.abilityUses || {}))
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
            const spellClassEl = document.getElementById('spellcastingClass');
            const spellAbilityEl = document.getElementById('spellcastingAbility');
            const spellNotesEl = document.getElementById('spellsNotes');

            if (spellClassEl) spellClassEl.value = data.spellcasting.class || '';
            if (spellAbilityEl) spellAbilityEl.value = data.spellcasting.ability || '';
            if (spellNotesEl) spellNotesEl.value = data.spellcasting.notes || '';

            // Cargar trucos y conjuros seleccionados
            this.selectedCantrips = data.spellcasting.cantripsKnown || [];
            this.selectedSpells = data.spellcasting.spellsKnown || [];
            this.usedSpellSlots = data.spellcasting.spellSlots || {};

            // Cargar habilidades personalizadas
            this.customAbilities = data.spellcasting.customAbilities || [];

            // Actualizar UI de conjuros y habilidades
            this.updateSpellsSection();
            this.renderCustomAbilities();
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

        // Token config
        this.tokenPhoto = data.tokenPhoto || null;
        if (data.tokenBorderColor) {
            const colorInput = document.getElementById('tokenBorderColor');
            if (colorInput) colorInput.value = data.tokenBorderColor;
        }
        if (this.tokenPhoto) {
            this.showPhotoPreview();
        }
        this.updateTokenPreview();

        // Cargar favoritos y trackeo de usos (sistema de dock de acciones)
        this.favorites = Array.isArray(data.favorites) ? data.favorites : [];
        this.abilityUses = (data.abilityUses && typeof data.abilityUses === 'object') ? data.abilityUses : {};

        this.characterData = data;
        this.isLoaded = true;
        this.updateAllCalculations();

        // Refrescar dock de acciones si está activo
        document.dispatchEvent(new CustomEvent('character-loaded', {
            detail: { characterSheet: this }
        }));
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

                // Sincronizar nombre de personaje con la app
                if (characterName && characterName !== 'Sin nombre') {
                    this.app.characterName = characterName;
                }

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

    // ==========================================
    // Manejo de Clases
    // ==========================================

    initClassListeners() {
        const classSelect = document.getElementById('charClass');
        if (classSelect) {
            classSelect.addEventListener('change', () => this.onClassChange());
        }
    }

    onClassChange() {
        const classSelect = document.getElementById('charClass');
        const classKey = classSelect?.value;
        const classInfo = this.getClassInfo(classKey);

        // Auto-rellenar clase lanzadora si tiene spellcasting
        const spellcastingClassInput = document.getElementById('spellcastingClass');
        if (spellcastingClassInput && classInfo?.spellcasting) {
            spellcastingClassInput.value = classInfo.name;
        } else if (spellcastingClassInput) {
            spellcastingClassInput.value = '';
        }

        // Auto-rellenar característica de lanzamiento
        const spellcastingAbilitySelect = document.getElementById('spellcastingAbility');
        if (spellcastingAbilitySelect && classInfo?.spellcasting?.ability) {
            spellcastingAbilitySelect.value = classInfo.spellcasting.ability;
        }

        // Aplicar tiradas de salvación con competencia
        this.applyClassSavingThrows(classInfo);

        // Actualizar dado de golpe
        this.updateHitDice(classInfo);

        // Actualizar sección de conjuros y habilidades
        this.updateSpellsSection();
        this.updateAbilitiesSection();
    }

    applyClassSavingThrows(classInfo) {
        // Limpiar todas las tiradas de salvación primero
        const saves = ['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha'];
        const abilityMap = {
            'strength': 'Str',
            'dexterity': 'Dex',
            'constitution': 'Con',
            'intelligence': 'Int',
            'wisdom': 'Wis',
            'charisma': 'Cha'
        };

        saves.forEach(save => {
            const checkbox = document.getElementById(`saveProf${save}`);
            if (checkbox) {
                checkbox.checked = false;
                checkbox.classList.remove('class-proficiency');
            }
        });

        // Aplicar tiradas de salvación de la clase
        if (classInfo?.savingThrows) {
            classInfo.savingThrows.forEach(ability => {
                const saveId = abilityMap[ability];
                if (saveId) {
                    const checkbox = document.getElementById(`saveProf${saveId}`);
                    if (checkbox) {
                        checkbox.checked = true;
                        checkbox.classList.add('class-proficiency');
                    }
                }
            });
        }

        this.updateSavingThrows();
    }

    updateHitDice(classInfo) {
        const hitDiceInput = document.getElementById('hitDice');
        const level = parseInt(document.getElementById('charLevel')?.value) || 1;

        if (hitDiceInput && classInfo?.hitDie) {
            hitDiceInput.value = `${level}${classInfo.hitDie}`;
        }
    }

    // ==========================================
    // Manejo de Trasfondos
    // ==========================================

    initBackgroundListeners() {
        const bgSelect = document.getElementById('charBackground');
        if (bgSelect) {
            bgSelect.addEventListener('change', () => this.onBackgroundChange());
        }
    }

    onBackgroundChange() {
        const bgSelect = document.getElementById('charBackground');
        const bgKey = bgSelect?.value;

        if (!bgKey || bgKey === 'Other') {
            this.updateAbilitiesSection();
            return;
        }

        const bgInfo = this.getBackgroundInfo(bgKey);
        if (bgInfo) {
            // Aplicar competencias de habilidades del trasfondo
            this.applyBackgroundSkillProficiencies(bgInfo);
        }

        // Actualizar sección de habilidades
        this.updateAbilitiesSection();
    }

    applyBackgroundSkillProficiencies(bgInfo) {
        if (!bgInfo?.skillProficiencies) return;

        bgInfo.skillProficiencies.forEach(skillKey => {
            const capitalSkill = skillKey.charAt(0).toUpperCase() + skillKey.slice(1);
            const skillItem = this.modal.querySelector(`.skill-item[data-skill="${skillKey}"]`) ||
                              this.modal.querySelector(`#skill${capitalSkill}`)?.closest('.skill-item');

            if (skillItem) {
                const profCheck = skillItem.querySelector('.skill-prof');
                if (profCheck && !profCheck.disabled) {
                    profCheck.checked = true;
                }
            }
        });

        // Recalcular bonuses de habilidades
        const skillItems = this.modal.querySelectorAll('.skill-item');
        skillItems.forEach(item => this.updateSkillBonus(item));
    }

    // ==========================================
    // Sistema de Rasgos Automáticos
    // ==========================================

    // Clasificar un rasgo como pasivo o activo
    classifyTrait(trait) {
        if (!trait?.description) return 'passive';

        const desc = trait.description.toLowerCase();
        const activeKeywords = [
            'como acción', 'acción adicional', 'puedes usar',
            'una vez por', 'usos igual', 'recuperas', 'gasta',
            'puedes lanzar', 'como reacción', 'tras descanso',
            'veces igual', 'cargas'
        ];

        for (const keyword of activeKeywords) {
            if (desc.includes(keyword)) return 'active';
        }
        return 'passive';
    }

    // Obtener todos los rasgos del personaje
    getAllCharacterTraits() {
        const traits = { passive: [], active: [] };

        // 1. Rasgos raciales
        const raceKey = document.getElementById('charRace')?.value;
        const subraceKey = document.getElementById('charSubrace')?.value;
        const raceInfo = this.getRaceInfo(raceKey);

        if (raceInfo?.traits) {
            raceInfo.traits.forEach(trait => {
                const type = this.classifyTrait(trait);
                traits[type].push({
                    ...trait,
                    source: `Raza: ${raceInfo.name}`,
                    sourceType: 'race'
                });
            });
        }

        if (subraceKey && raceInfo?.subraces?.[subraceKey]?.traits) {
            const subraceData = raceInfo.subraces[subraceKey];
            subraceData.traits.forEach(trait => {
                const type = this.classifyTrait(trait);
                traits[type].push({
                    ...trait,
                    source: `Subraza: ${subraceData.name}`,
                    sourceType: 'subrace'
                });
            });
        }

        // Agregar visión en la oscuridad como rasgo pasivo si aplica
        const darkvision = raceInfo?.subraces?.[subraceKey]?.darkvision ?? raceInfo?.darkvision ?? 0;
        if (darkvision > 0) {
            const existingDarkvision = traits.passive.find(t => t.name === 'Visión en la Oscuridad');
            if (!existingDarkvision) {
                traits.passive.unshift({
                    name: 'Visión en la Oscuridad',
                    description: `Puedes ver en luz tenue a 60 pies como si fuera luz brillante, y en oscuridad como si fuera luz tenue. No puedes discernir colores en la oscuridad, solo tonos de gris.`,
                    source: `Raza: ${raceInfo?.name || 'Desconocida'}`,
                    sourceType: 'race',
                    range: darkvision
                });
            }
        }

        // 2. Rasgos de clase por nivel
        const classKey = document.getElementById('charClass')?.value;
        const level = parseInt(document.getElementById('charLevel')?.value) || 1;
        const classInfo = this.getClassInfo(classKey);

        if (classInfo?.features) {
            for (let lvl = 1; lvl <= level; lvl++) {
                const levelFeatures = classInfo.features[lvl.toString()];
                if (levelFeatures) {
                    levelFeatures.forEach(feature => {
                        const type = this.classifyTrait(feature);
                        traits[type].push({
                            ...feature,
                            source: `Clase: ${classInfo.name} Nv${lvl}`,
                            sourceType: 'class',
                            level: lvl
                        });
                    });
                }
            }
        }

        // 3. Rasgo de trasfondo
        const bgKey = document.getElementById('charBackground')?.value;
        const bgInfo = this.getBackgroundInfo(bgKey);

        if (bgInfo?.feature) {
            const type = this.classifyTrait(bgInfo.feature);
            traits[type].push({
                ...bgInfo.feature,
                source: `Trasfondo: ${bgInfo.name}`,
                sourceType: 'background'
            });
        }

        return traits;
    }

    // Renderizar la sección de habilidades/rasgos
    updateAbilitiesSection() {
        const container = document.getElementById('abilitiesContainer');
        if (!container) return;

        const traits = this.getAllCharacterTraits();

        // Agregar habilidades personalizadas (que no son trucos ni conjuros)
        const customFeatures = this.customAbilities.filter(a =>
            !['cantrip', 'spell'].includes(a.category)
        );

        customFeatures.forEach(feature => {
            const target = feature.type === 'passive' ? traits.passive : traits.active;
            target.push({
                name: feature.name,
                description: feature.description,
                source: feature.sourceDetail || 'Custom',
                sourceType: 'custom',
                isCustom: true,
                id: feature.id
            });
        });

        // Construir HTML
        let html = '';

        // Sección Pasivas
        if (traits.passive.length > 0) {
            html += '<div class="traits-group traits-passive">';
            html += '<h5 class="traits-group-title">Pasivas</h5>';
            traits.passive.forEach(trait => {
                html += this.renderTraitItem(trait, 'passive');
            });
            html += '</div>';
        }

        // Sección Activas
        if (traits.active.length > 0) {
            html += '<div class="traits-group traits-active">';
            html += '<h5 class="traits-group-title">Activas</h5>';
            traits.active.forEach(trait => {
                html += this.renderTraitItem(trait, 'active');
            });
            html += '</div>';
        }

        // Mensaje si no hay rasgos
        if (traits.passive.length === 0 && traits.active.length === 0) {
            html = '<p class="no-traits">Selecciona una raza, clase y trasfondo para ver tus habilidades.</p>';
        }

        container.innerHTML = html;

        // Agregar listeners para editar/eliminar traits custom
        container.querySelectorAll('.btn-edit-trait').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.editAbility(e.target.dataset.id);
            });
        });

        container.querySelectorAll('.btn-delete-trait').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteAbility(e.target.dataset.id);
            });
        });

        // Inyectar estrellas de favorito en cada rasgo
        this.injectFavStarsOnAnchors(container);
    }

    renderTraitItem(trait, type) {
        const sourceIcon = this.getSourceIcon(trait.sourceType);
        const customClass = trait.isCustom ? 'custom-trait' : '';
        const editButtons = trait.isCustom ? `
            <button type="button" class="btn-edit-trait" data-id="${trait.id}" title="Editar">&#9998;</button>
            <button type="button" class="btn-delete-trait" data-id="${trait.id}" title="Eliminar">&times;</button>
        ` : '';

        // Determinar identificador estable para favoritos
        const favType = trait.isCustom ? 'custom-ability' : 'trait';
        const favId = trait.isCustom ? trait.id : this.slugifyTraitId(trait.name);

        return `
            <div class="trait-item trait-${type} ${customClass}" data-source-type="${trait.sourceType}" ${trait.id ? `data-id="${trait.id}"` : ''} data-fav-anchor data-fav-type="${favType}" data-fav-id="${favId}" data-fav-active="${type === 'active' ? '1' : '0'}">
                <div class="trait-header">
                    <span class="trait-icon">${sourceIcon}</span>
                    <span class="trait-name">${trait.name}</span>
                    <span class="trait-source">(${trait.source})</span>
                    ${editButtons}
                </div>
                <p class="trait-description">${trait.description}</p>
            </div>
        `;
    }

    getSourceIcon(sourceType) {
        switch (sourceType) {
            case 'race':
            case 'subrace':
                return '&#9670;'; // Diamante
            case 'class':
                return '&#9733;'; // Estrella
            case 'background':
                return '&#9829;'; // Corazón
            case 'custom':
                return '&#9998;'; // Lápiz (editable)
            default:
                return '&#9679;'; // Círculo
        }
    }

    // ==========================================
    // Sistema de Conjuros
    // ==========================================

    initSpellsTabListeners() {
        console.log('initSpellsTabListeners llamado');

        // Botón agregar truco - ahora abre el editor de habilidades
        const addCantripBtn = document.getElementById('btnAddCantrip');
        console.log('btnAddCantrip encontrado:', addCantripBtn);
        if (addCantripBtn) {
            addCantripBtn.addEventListener('click', () => {
                console.log('Click en btnAddCantrip');
                this.openAbilityEditor('cantrip');
            });
        }

        // Botón agregar conjuro - ahora abre el editor de habilidades
        const addSpellBtn = document.getElementById('btnAddSpell');
        console.log('btnAddSpell encontrado:', addSpellBtn);
        if (addSpellBtn) {
            addSpellBtn.addEventListener('click', () => {
                console.log('Click en btnAddSpell');
                this.openAbilityEditor('spell');
            });
        }

        // Botón agregar habilidad/rasgo
        const addAbilityBtn = document.getElementById('btnAddAbility');
        console.log('btnAddAbility encontrado:', addAbilityBtn);
        if (addAbilityBtn) {
            addAbilityBtn.addEventListener('click', () => {
                console.log('Click en btnAddAbility');
                this.openAbilityEditor('ability');
            });
        }

        // Listeners del modal de selección (para cuando se implemente el buscador)
        this.initSpellSelectorListeners();

        // Listeners del editor de habilidades
        this.initAbilityEditorListeners();
    }

    initSpellSelectorListeners() {
        const modal = document.getElementById('spellSelectorModal');
        if (!modal) return;

        // Cerrar modal
        const closeBtn = modal.querySelector('.spell-selector-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeSpellSelector());
        }

        // Filtros
        const levelFilter = document.getElementById('spellLevelFilter');
        const schoolFilter = document.getElementById('spellSchoolFilter');
        const searchInput = document.getElementById('spellSearchInput');

        if (levelFilter) {
            levelFilter.addEventListener('change', () => this.filterSpells());
        }
        if (schoolFilter) {
            schoolFilter.addEventListener('change', () => this.filterSpells());
        }
        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterSpells());
        }

        // Botón agregar seleccionados
        const addBtn = document.getElementById('btnAddSelectedSpells');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addSelectedSpells());
        }

        // Cerrar al hacer click fuera
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeSpellSelector();
        });
    }

    // Obtener límite de trucos según clase y nivel
    getCantripsLimit() {
        const classKey = document.getElementById('charClass')?.value;
        const level = parseInt(document.getElementById('charLevel')?.value) || 1;
        const classInfo = this.getClassInfo(classKey);

        if (!classInfo?.spellcasting?.cantripsKnown) return 0;

        const cantripsTable = classInfo.spellcasting.cantripsKnown;
        let maxCantrips = 0;

        for (const [lvl, count] of Object.entries(cantripsTable)) {
            if (parseInt(lvl) <= level) {
                maxCantrips = count;
            }
        }

        return maxCantrips;
    }

    // Obtener límite de conjuros según clase y nivel
    getSpellsLimit() {
        const classKey = document.getElementById('charClass')?.value;
        const level = parseInt(document.getElementById('charLevel')?.value) || 1;
        const classInfo = this.getClassInfo(classKey);

        if (!classInfo?.spellcasting) return { type: 'none', count: 0 };

        const spellcasting = classInfo.spellcasting;

        if (spellcasting.type === 'known' && spellcasting.spellsKnown) {
            let count = 0;
            for (const [lvl, num] of Object.entries(spellcasting.spellsKnown)) {
                if (parseInt(lvl) <= level) count = num;
            }
            return { type: 'known', count };

        } else if (spellcasting.type === 'prepared') {
            const abilityMod = this.getSpellcastingModifier();
            const count = Math.max(1, level + abilityMod);
            return { type: 'prepared', count };
        }

        return { type: 'none', count: 0 };
    }

    // Obtener modificador de característica de lanzamiento
    getSpellcastingModifier() {
        const ability = document.getElementById('spellcastingAbility')?.value;
        if (!ability) return 0;

        const abilityScore = this.getTotalAbilityScore(ability);
        return this.calculateModifier(abilityScore);
    }

    // Obtener espacios de conjuros por nivel
    getSpellSlots() {
        const classKey = document.getElementById('charClass')?.value;
        const level = parseInt(document.getElementById('charLevel')?.value) || 1;
        const classInfo = this.getClassInfo(classKey);

        if (!classInfo?.spellcasting?.spellSlots) return {};

        const slotsTable = classInfo.spellcasting.spellSlots;
        let slots = {};

        for (const [lvl, slotsByLevel] of Object.entries(slotsTable)) {
            if (parseInt(lvl) <= level) {
                slots = { ...slotsByLevel };
            }
        }

        return slots;
    }

    // Actualizar toda la sección de conjuros
    updateSpellsSection() {
        this.updateSpellStats();
        this.updateSpellSlotsUI();
        this.updateCantripsCounter();
        this.updateSpellsCounter();
        this.renderSelectedCantrips();
        this.renderSelectedSpells();
        this.updateAbilitiesSection();
    }

    // Actualizar UI de espacios de conjuros
    updateSpellSlotsUI() {
        const container = document.getElementById('spellSlotsContainer');
        if (!container) return;

        const slots = this.getSpellSlots();

        if (Object.keys(slots).length === 0) {
            container.innerHTML = '<p class="no-slots">Esta clase no tiene espacios de conjuros.</p>';
            return;
        }

        let html = '<div class="spell-slots-grid">';

        for (let level = 1; level <= 9; level++) {
            const totalSlots = slots[level.toString()] || 0;
            if (totalSlots === 0) continue;

            const usedSlots = this.usedSpellSlots[level] || 0;

            html += `<div class="slot-level">`;
            html += `<span class="slot-level-label">Nv${level}</span>`;
            html += `<div class="slot-checkboxes">`;

            for (let i = 0; i < totalSlots; i++) {
                const isUsed = i < usedSlots;
                html += `<input type="checkbox" class="slot-checkbox"
                         data-level="${level}" data-index="${i}"
                         ${isUsed ? 'checked' : ''}>`;
            }

            html += `</div></div>`;
        }

        html += '</div>';
        container.innerHTML = html;

        // Agregar listeners a los checkboxes
        container.querySelectorAll('.slot-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const level = parseInt(e.target.dataset.level);
                const index = parseInt(e.target.dataset.index);
                this.toggleSpellSlot(level, index, e.target.checked);
            });
        });
    }

    toggleSpellSlot(level, index, isUsed) {
        if (!this.usedSpellSlots[level]) {
            this.usedSpellSlots[level] = 0;
        }

        // Contar cuántos están marcados
        const container = document.getElementById('spellSlotsContainer');
        const checkboxes = container.querySelectorAll(`.slot-checkbox[data-level="${level}"]`);
        let count = 0;
        checkboxes.forEach(cb => {
            if (cb.checked) count++;
        });

        this.usedSpellSlots[level] = count;
    }

    // Actualizar contador de trucos
    updateCantripsCounter() {
        const counter = document.getElementById('cantripsCounter');
        if (!counter) return;

        const limit = this.getCantripsLimit();
        const current = this.selectedCantrips.length;

        counter.textContent = `${current}/${limit}`;
        counter.classList.toggle('limit-reached', current >= limit);
    }

    // Actualizar contador de conjuros
    updateSpellsCounter() {
        const counter = document.getElementById('spellsCounter');
        if (!counter) return;

        const { type, count } = this.getSpellsLimit();
        const current = this.selectedSpells.filter(s => s.prepared).length;

        if (type === 'none') {
            counter.textContent = '-';
        } else if (type === 'known') {
            counter.textContent = `${this.selectedSpells.length}/${count} conocidos`;
        } else {
            counter.textContent = `${current}/${count} preparados`;
        }
    }

    // Renderizar trucos seleccionados
    renderSelectedCantrips() {
        const container = document.getElementById('cantripsList');
        if (!container) return;

        if (this.selectedCantrips.length === 0) {
            container.innerHTML = '<p class="empty-list">No hay trucos seleccionados.</p>';
            return;
        }

        let html = '';
        this.selectedCantrips.forEach((spellKey, index) => {
            const spell = this.getSpellByKey(spellKey, 'cantrips');
            if (spell) {
                html += `
                    <div class="spell-item cantrip-item" data-key="${spellKey}">
                        <span class="spell-name">${spell.name}</span>
                        <span class="spell-school">(${spell.school})</span>
                        <button class="btn-remove-spell" data-index="${index}" data-type="cantrip">×</button>
                    </div>
                `;
            }
        });

        container.innerHTML = html;

        // Agregar listeners para eliminar
        container.querySelectorAll('.btn-remove-spell').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.removeCantrip(index);
            });
        });
    }

    // Renderizar conjuros seleccionados
    renderSelectedSpells() {
        const container = document.getElementById('spellsList');
        if (!container) return;

        if (this.selectedSpells.length === 0) {
            container.innerHTML = '<p class="empty-list">No hay conjuros seleccionados.</p>';
            return;
        }

        // Agrupar por nivel
        const spellsByLevel = {};
        this.selectedSpells.forEach((spellData, index) => {
            if (!spellsByLevel[spellData.level]) {
                spellsByLevel[spellData.level] = [];
            }
            spellsByLevel[spellData.level].push({ ...spellData, index });
        });

        const { type } = this.getSpellsLimit();
        let html = '';

        for (let level = 1; level <= 9; level++) {
            const spells = spellsByLevel[level];
            if (!spells || spells.length === 0) continue;

            html += `<div class="spell-level-group">`;
            html += `<h6 class="spell-level-title">Nivel ${level}</h6>`;

            spells.forEach(spellData => {
                const spell = this.getSpellByKey(spellData.key, `level${spellData.level}`);
                if (spell) {
                    const preparedClass = spellData.prepared ? 'prepared' : '';
                    const preparedCheckbox = type === 'prepared' ?
                        `<input type="checkbox" class="spell-prepared" data-index="${spellData.index}" ${spellData.prepared ? 'checked' : ''}>` : '';

                    html += `
                        <div class="spell-item ${preparedClass}" data-key="${spellData.key}">
                            ${preparedCheckbox}
                            <span class="spell-name">${spell.name}</span>
                            <span class="spell-school">(${spell.school})</span>
                            <button class="btn-remove-spell" data-index="${spellData.index}" data-type="spell">×</button>
                        </div>
                    `;
                }
            });

            html += `</div>`;
        }

        container.innerHTML = html;

        // Agregar listeners
        container.querySelectorAll('.btn-remove-spell').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.removeSpell(index);
            });
        });

        container.querySelectorAll('.spell-prepared').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.toggleSpellPrepared(index, e.target.checked);
            });
        });
    }

    // Obtener un conjuro por su key
    getSpellByKey(key, levelKey) {
        if (!this.spellsData || !this.spellsData[levelKey]) return null;
        return this.spellsData[levelKey][key] || null;
    }

    // Abrir modal de selección de conjuros
    openSpellSelector(filterLevel = null) {
        const modal = document.getElementById('spellSelectorModal');
        if (!modal) return;

        this.selectorFilterLevel = filterLevel;
        this.selectedSpellsInModal = [];

        // Configurar filtro de nivel
        const levelFilter = document.getElementById('spellLevelFilter');
        if (levelFilter) {
            if (filterLevel === 0) {
                levelFilter.value = '0';
                levelFilter.disabled = true;
            } else {
                levelFilter.value = 'all';
                levelFilter.disabled = false;
            }
        }

        // Limpiar búsqueda
        const searchInput = document.getElementById('spellSearchInput');
        if (searchInput) searchInput.value = '';

        // Limpiar filtro de escuela
        const schoolFilter = document.getElementById('spellSchoolFilter');
        if (schoolFilter) schoolFilter.value = 'all';

        // Renderizar lista de conjuros
        this.renderSpellSelectorList();

        modal.classList.add('active');
    }

    closeSpellSelector() {
        const modal = document.getElementById('spellSelectorModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    // Filtrar y renderizar lista de conjuros en el selector
    filterSpells() {
        this.renderSpellSelectorList();
    }

    renderSpellSelectorList() {
        const container = document.getElementById('spellSelectorList');
        if (!container || !this.spellsData) return;

        const levelFilter = document.getElementById('spellLevelFilter')?.value || 'all';
        const schoolFilter = document.getElementById('spellSchoolFilter')?.value || 'all';
        const searchText = document.getElementById('spellSearchInput')?.value?.toLowerCase() || '';

        let html = '';
        let count = 0;

        // Determinar qué niveles mostrar
        const levelsToShow = [];
        if (levelFilter === 'all') {
            if (this.selectorFilterLevel === 0) {
                levelsToShow.push('cantrips');
            } else if (this.selectorFilterLevel === null) {
                for (let i = 1; i <= 9; i++) {
                    levelsToShow.push(`level${i}`);
                }
            } else {
                levelsToShow.push(`level${this.selectorFilterLevel}`);
            }
        } else if (levelFilter === '0') {
            levelsToShow.push('cantrips');
        } else {
            levelsToShow.push(`level${levelFilter}`);
        }

        // Iterar por niveles
        levelsToShow.forEach(levelKey => {
            const spells = this.spellsData[levelKey];
            if (!spells) return;

            const isCantrip = levelKey === 'cantrips';

            Object.entries(spells).forEach(([key, spell]) => {
                // Filtrar por escuela
                if (schoolFilter !== 'all' && spell.school !== schoolFilter) return;

                // Filtrar por búsqueda
                if (searchText && !spell.name.toLowerCase().includes(searchText)) return;

                // Verificar si ya está seleccionado
                const alreadySelected = isCantrip ?
                    this.selectedCantrips.includes(key) :
                    this.selectedSpells.some(s => s.key === key);

                if (alreadySelected) return;

                const isChecked = this.selectedSpellsInModal?.some(s => s.key === key);

                html += `
                    <div class="spell-selector-item" data-key="${key}" data-level="${isCantrip ? 0 : spell.level}">
                        <input type="checkbox" class="spell-select-checkbox"
                               data-key="${key}" data-level="${isCantrip ? 0 : spell.level}"
                               ${isChecked ? 'checked' : ''}>
                        <div class="spell-selector-info">
                            <span class="spell-selector-name">${spell.name}</span>
                            <span class="spell-selector-meta">
                                ${isCantrip ? 'Truco' : `Nivel ${spell.level}`} | ${spell.school} | ${spell.castingTime}
                            </span>
                        </div>
                    </div>
                `;
                count++;
            });
        });

        if (count === 0) {
            html = '<p class="no-spells-found">No se encontraron conjuros con estos filtros.</p>';
        }

        container.innerHTML = html;

        // Agregar listeners a los checkboxes
        container.querySelectorAll('.spell-select-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const key = e.target.dataset.key;
                const level = parseInt(e.target.dataset.level);

                if (e.target.checked) {
                    if (!this.selectedSpellsInModal) this.selectedSpellsInModal = [];
                    this.selectedSpellsInModal.push({ key, level });
                } else {
                    this.selectedSpellsInModal = this.selectedSpellsInModal.filter(s => s.key !== key);
                }
            });
        });
    }

    // Agregar conjuros seleccionados desde el modal
    addSelectedSpells() {
        if (!this.selectedSpellsInModal || this.selectedSpellsInModal.length === 0) {
            this.closeSpellSelector();
            return;
        }

        const cantripsLimit = this.getCantripsLimit();
        const { count: spellsLimit } = this.getSpellsLimit();

        this.selectedSpellsInModal.forEach(({ key, level }) => {
            if (level === 0) {
                // Es un truco
                if (this.selectedCantrips.length < cantripsLimit) {
                    this.selectedCantrips.push(key);
                }
            } else {
                // Es un conjuro
                this.selectedSpells.push({
                    key,
                    level,
                    prepared: true
                });
            }
        });

        this.updateSpellsSection();
        this.closeSpellSelector();
    }

    removeCantrip(index) {
        this.selectedCantrips.splice(index, 1);
        this.updateCantripsCounter();
        this.renderSelectedCantrips();
    }

    removeSpell(index) {
        this.selectedSpells.splice(index, 1);
        this.updateSpellsCounter();
        this.renderSelectedSpells();
    }

    toggleSpellPrepared(index, prepared) {
        if (this.selectedSpells[index]) {
            this.selectedSpells[index].prepared = prepared;
            this.updateSpellsCounter();
            this.renderSelectedSpells();
        }
    }

    // ==========================================
    // Editor de Habilidades Personalizadas
    // ==========================================

    initAbilityEditorListeners() {
        const modal = document.getElementById('abilityEditorModal');
        if (!modal) return;

        // Cerrar modal
        const closeBtns = modal.querySelectorAll('.ability-editor-close');
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeAbilityEditor());
        });

        // Cerrar al hacer click fuera
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeAbilityEditor();
        });

        // Guardar habilidad
        const saveBtn = document.getElementById('btnSaveAbility');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveAbility());
        }

        // Cambio de tipo (activa/pasiva)
        const typeSelect = document.getElementById('abilityType');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => this.onAbilityTypeChange());
        }

        // Cambio de categoría
        const categorySelect = document.getElementById('abilityCategory');
        if (categorySelect) {
            categorySelect.addEventListener('change', () => this.onAbilityCategoryChange());
        }

        // Cambio de tipo de acción (mostrar trigger de reacción)
        const actionTypeSelect = document.getElementById('abilityActionType');
        if (actionTypeSelect) {
            actionTypeSelect.addEventListener('change', () => {
                const reactionGroup = document.getElementById('reactionTriggerGroup');
                if (reactionGroup) {
                    reactionGroup.style.display = actionTypeSelect.value === 'reaction' ? 'block' : 'none';
                }
            });
        }

        // Toggle área de efecto
        const hasAreaCheckbox = document.getElementById('abilityHasArea');
        if (hasAreaCheckbox) {
            hasAreaCheckbox.addEventListener('change', () => {
                const areaFields = modal.querySelector('.area-fields');
                if (areaFields) {
                    areaFields.style.display = hasAreaCheckbox.checked ? 'flex' : 'none';
                }
            });
        }

        // Toggle componente material
        const compMCheckbox = document.getElementById('abilityCompM');
        if (compMCheckbox) {
            compMCheckbox.addEventListener('change', () => {
                const materialDesc = modal.querySelector('.material-desc');
                if (materialDesc) {
                    materialDesc.style.display = compMCheckbox.checked ? 'block' : 'none';
                }
            });
        }

        // Toggle uso ilimitado
        const unlimitedCheckbox = document.getElementById('abilityUnlimited');
        if (unlimitedCheckbox) {
            unlimitedCheckbox.addEventListener('change', () => {
                const usesFields = modal.querySelector('.uses-fields');
                if (usesFields) {
                    usesFields.style.display = unlimitedCheckbox.checked ? 'none' : 'flex';
                }
            });
        }

        // Cambio de tipo de recarga
        const rechargeSelect = document.getElementById('abilityRecharge');
        if (rechargeSelect) {
            rechargeSelect.addEventListener('change', () => {
                const rechargeSpecial = modal.querySelector('.recharge-special');
                if (rechargeSpecial) {
                    rechargeSpecial.style.display = rechargeSelect.value === 'special' ? 'block' : 'none';
                }
            });
        }

        // Toggles de combate
        this.initCombatToggles(modal);

        // Secciones colapsables
        this.initCollapsibleSections(modal);

        // Bonificadores dinámicos
        this.initBonusInputs(modal);

        // Toggle escalado
        const hasScalingCheckbox = document.getElementById('abilityHasScaling');
        if (hasScalingCheckbox) {
            hasScalingCheckbox.addEventListener('change', () => {
                const scalingFields = modal.querySelector('.scaling-fields');
                if (scalingFields) {
                    scalingFields.style.display = hasScalingCheckbox.checked ? 'block' : 'none';
                }
            });
        }
    }

    initCombatToggles(modal) {
        // Toggle ataque
        const hasAttackCheckbox = document.getElementById('abilityHasAttack');
        if (hasAttackCheckbox) {
            hasAttackCheckbox.addEventListener('change', () => {
                const attackFields = modal.querySelector('.attack-fields');
                if (attackFields) {
                    attackFields.style.display = hasAttackCheckbox.checked ? 'block' : 'none';
                }
            });
        }

        // Toggle daño
        const hasDamageCheckbox = document.getElementById('abilityHasDamage');
        if (hasDamageCheckbox) {
            hasDamageCheckbox.addEventListener('change', () => {
                const damageFields = modal.querySelector('.damage-fields');
                if (damageFields) {
                    damageFields.style.display = hasDamageCheckbox.checked ? 'block' : 'none';
                }
            });
        }

        // Toggle curación
        const hasHealingCheckbox = document.getElementById('abilityHasHealing');
        if (hasHealingCheckbox) {
            hasHealingCheckbox.addEventListener('change', () => {
                const healingFields = modal.querySelector('.healing-fields');
                if (healingFields) {
                    healingFields.style.display = hasHealingCheckbox.checked ? 'block' : 'none';
                }
            });
        }

        // Toggle salvación
        const hasSaveCheckbox = document.getElementById('abilityHasSave');
        if (hasSaveCheckbox) {
            hasSaveCheckbox.addEventListener('change', () => {
                const saveFields = modal.querySelector('.save-fields');
                if (saveFields) {
                    saveFields.style.display = hasSaveCheckbox.checked ? 'block' : 'none';
                }
            });
        }
    }

    initCollapsibleSections(modal) {
        const collapsibles = modal.querySelectorAll('.collapsible');
        collapsibles.forEach(section => {
            const header = section.querySelector('.collapsible-header');
            const content = section.querySelector('.collapsible-content');
            if (header && content) {
                header.addEventListener('click', () => {
                    section.classList.toggle('open');
                    content.style.display = section.classList.contains('open') ? 'block' : 'none';
                });
            }
        });
    }

    initBonusInputs(modal) {
        const addBonusBtn = modal.querySelector('.btn-add-bonus');
        if (addBonusBtn) {
            addBonusBtn.addEventListener('click', () => this.addBonusToList());
        }
    }

    addBonusToList() {
        const typeSelect = document.querySelector('.bonus-row .bonus-type');
        const valueInput = document.querySelector('.bonus-row .bonus-value');

        if (!typeSelect || !valueInput) return;

        const type = typeSelect.value;
        const value = parseInt(valueInput.value) || 0;

        if (!type || value === 0) return;

        this.tempBonuses.push({ type, value });
        this.renderBonusesList();

        // Limpiar inputs
        typeSelect.value = '';
        valueInput.value = '';
    }

    renderBonusesList() {
        const container = document.getElementById('bonusesList');
        if (!container) return;

        const bonusNames = {
            ac: 'CA',
            speed: 'Velocidad',
            initiative: 'Iniciativa',
            hp: 'PG',
            attack: 'Ataque',
            damage: 'Daño',
            savingThrow: 'T. Salvación'
        };

        container.innerHTML = this.tempBonuses.map((bonus, index) => `
            <span class="bonus-tag">
                ${bonusNames[bonus.type] || bonus.type}: ${bonus.value > 0 ? '+' : ''}${bonus.value}
                <span class="remove-bonus" data-index="${index}">&times;</span>
            </span>
        `).join('');

        // Listeners para eliminar
        container.querySelectorAll('.remove-bonus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.tempBonuses.splice(index, 1);
                this.renderBonusesList();
            });
        });
    }

    onAbilityTypeChange() {
        const typeSelect = document.getElementById('abilityType');
        const actionSection = document.getElementById('sectionAction');

        if (typeSelect && actionSection) {
            // Si es pasiva, ocultar sección de acción o poner en "none"
            if (typeSelect.value === 'passive') {
                const actionTypeSelect = document.getElementById('abilityActionType');
                if (actionTypeSelect) {
                    actionTypeSelect.value = 'none';
                }
            }
        }
    }

    onAbilityCategoryChange() {
        const categorySelect = document.getElementById('abilityCategory');
        const spellSection = document.getElementById('sectionSpell');

        if (categorySelect && spellSection) {
            const isSpellType = ['cantrip', 'spell'].includes(categorySelect.value);
            spellSection.style.display = isSpellType ? 'block' : 'none';

            // Si es truco, poner nivel 0
            if (categorySelect.value === 'cantrip') {
                const levelSelect = document.getElementById('abilitySpellLevel');
                if (levelSelect) levelSelect.value = '0';
            }
        }
    }

    openAbilityEditor(presetCategory = null) {
        console.log('openAbilityEditor llamado con categoría:', presetCategory);
        const modal = document.getElementById('abilityEditorModal');
        console.log('Modal encontrado:', modal);
        if (!modal) {
            console.error('Modal abilityEditorModal no encontrado!');
            return;
        }

        // Resetear formulario
        this.resetAbilityForm();
        this.editingAbilityId = null;
        this.tempBonuses = [];
        this.renderBonusesList();

        // Establecer título
        const title = document.getElementById('abilityEditorTitle');
        if (title) {
            title.textContent = 'Nueva Habilidad';
        }

        // Pre-configurar categoría si se especifica
        if (presetCategory) {
            const categorySelect = document.getElementById('abilityCategory');
            if (categorySelect) {
                categorySelect.value = presetCategory;
                this.onAbilityCategoryChange();
            }

            // Si es truco, configurar nivel 0
            if (presetCategory === 'cantrip') {
                const levelSelect = document.getElementById('abilitySpellLevel');
                if (levelSelect) levelSelect.value = '0';
            }
        }

        modal.classList.add('active');
    }

    closeAbilityEditor() {
        const modal = document.getElementById('abilityEditorModal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.editingAbilityId = null;
        this.tempBonuses = [];
    }

    resetAbilityForm() {
        const form = document.getElementById('abilityEditorForm');
        if (form) {
            form.reset();
        }

        // Ocultar campos condicionales
        const conditionalFields = [
            '.area-fields', '.spell-fields', '.material-desc', '.uses-fields',
            '.recharge-special', '.attack-fields', '.damage-fields',
            '.healing-fields', '.save-fields', '.scaling-fields'
        ];

        conditionalFields.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) el.style.display = 'none';
        });

        // Cerrar secciones colapsables
        document.querySelectorAll('.collapsible').forEach(section => {
            section.classList.remove('open');
            const content = section.querySelector('.collapsible-content');
            if (content) content.style.display = 'none';
        });

        // Reset checkboxes de condiciones
        document.querySelectorAll('#conditionsGrid input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        // Marcar uso ilimitado por defecto
        const unlimitedCheckbox = document.getElementById('abilityUnlimited');
        if (unlimitedCheckbox) {
            unlimitedCheckbox.checked = true;
        }
    }

    collectAbilityFormData() {
        const generateId = () => `ability_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

        // Recoger condiciones seleccionadas
        const conditions = [];
        document.querySelectorAll('#conditionsGrid input[type="checkbox"]:checked').forEach(cb => {
            conditions.push(cb.value);
        });

        // Crear objeto de habilidad
        const ability = {
            id: this.editingAbilityId || generateId(),
            name: document.getElementById('abilityName')?.value || '',
            source: document.getElementById('abilitySource')?.value || 'custom',
            sourceDetail: document.getElementById('abilitySourceDetail')?.value || '',
            type: document.getElementById('abilityType')?.value || 'active',
            category: document.getElementById('abilityCategory')?.value || 'ability',
            level: parseInt(document.getElementById('abilitySpellLevel')?.value) || 0,
            school: document.getElementById('abilitySchool')?.value || '',
            description: document.getElementById('abilityDescription')?.value || '',
            actionType: document.getElementById('abilityActionType')?.value || 'action',
            actionCost: document.getElementById('abilityActionCost')?.value || '',
            reactionTrigger: document.getElementById('abilityReactionTrigger')?.value || '',
            range: document.getElementById('abilityRange')?.value || '',
            duration: document.getElementById('abilityDuration')?.value || '',
            concentration: document.getElementById('abilityConcentration')?.checked || false,

            // Área
            area: document.getElementById('abilityHasArea')?.checked ? {
                type: document.getElementById('abilityAreaType')?.value || 'sphere',
                size: parseInt(document.getElementById('abilityAreaSize')?.value) || 0
            } : null,

            // Componentes
            components: {
                verbal: document.getElementById('abilityCompV')?.checked || false,
                somatic: document.getElementById('abilityCompS')?.checked || false,
                material: document.getElementById('abilityCompM')?.checked || false,
                materialDescription: document.getElementById('abilityMaterialDesc')?.value || ''
            },

            // Usos
            uses: {
                unlimited: document.getElementById('abilityUnlimited')?.checked || false,
                max: parseInt(document.getElementById('abilityUsesMax')?.value) || 0,
                current: parseInt(document.getElementById('abilityUsesMax')?.value) || 0,
                recharge: document.getElementById('abilityRecharge')?.value || 'none',
                rechargeDescription: document.getElementById('abilityRechargeDesc')?.value || ''
            },

            // Ataque
            attack: document.getElementById('abilityHasAttack')?.checked ? {
                type: document.getElementById('abilityAttackType')?.value || 'melee',
                ability: document.getElementById('abilityAttackAbility')?.value || 'strength',
                bonus: parseInt(document.getElementById('abilityAttackBonus')?.value) || 0
            } : null,

            // Daño
            damage: document.getElementById('abilityHasDamage')?.checked ? {
                dice: document.getElementById('abilityDamageDice')?.value || '',
                type: document.getElementById('abilityDamageType')?.value || '',
                ability: document.getElementById('abilityDamageAbility')?.value || null,
                addModifier: !!document.getElementById('abilityDamageAbility')?.value,
                bonus: parseInt(document.getElementById('abilityDamageBonus')?.value) || 0
            } : null,

            // Curación
            healing: document.getElementById('abilityHasHealing')?.checked ? {
                dice: document.getElementById('abilityHealingDice')?.value || '',
                ability: document.getElementById('abilityHealingAbility')?.value || null,
                addModifier: !!document.getElementById('abilityHealingAbility')?.value,
                bonus: parseInt(document.getElementById('abilityHealingBonus')?.value) || 0
            } : null,

            // Tirada de salvación
            save: document.getElementById('abilityHasSave')?.checked ? {
                ability: document.getElementById('abilitySaveAbility')?.value || 'dexterity',
                dc: parseInt(document.getElementById('abilitySaveDC')?.value) || null,
                effect: document.getElementById('abilitySaveEffect')?.value || 'half'
            } : null,

            // Efectos
            effects: {
                conditions: conditions,
                advantages: document.getElementById('abilityAdvantages')?.value || '',
                disadvantages: document.getElementById('abilityDisadvantages')?.value || '',
                resistances: document.getElementById('abilityResistances')?.value || '',
                immunities: document.getElementById('abilityImmunities')?.value || '',
                bonuses: [...this.tempBonuses],
                other: document.getElementById('abilityEffectText')?.value || ''
            },

            // Escalado
            scaling: document.getElementById('abilityHasScaling')?.checked ? {
                type: document.getElementById('abilityScalingType')?.value || 'cantrip',
                description: document.getElementById('abilityScalingDesc')?.value || ''
            } : null,

            // Metadatos
            notes: document.getElementById('abilityNotes')?.value || '',
            prepared: true,
            favorite: false
        };

        return ability;
    }

    saveAbility() {
        const ability = this.collectAbilityFormData();

        // Validación básica
        if (!ability.name.trim()) {
            showNotification('El nombre de la habilidad es requerido', 'error');
            return;
        }

        // Buscar si existe para actualizar
        const existingIndex = this.customAbilities.findIndex(a => a.id === ability.id);

        if (existingIndex >= 0) {
            // Actualizar existente
            this.customAbilities[existingIndex] = ability;
        } else {
            // Agregar nueva
            this.customAbilities.push(ability);
        }

        // Actualizar la UI según la categoría
        this.renderCustomAbilities();
        this.updateCantripsCounter();
        this.updateSpellsCounter();

        // Cerrar modal
        this.closeAbilityEditor();

        showNotification(`Habilidad "${ability.name}" guardada`, 'success');
    }

    editAbility(abilityId) {
        const ability = this.customAbilities.find(a => a.id === abilityId);
        if (!ability) return;

        this.editingAbilityId = abilityId;
        this.tempBonuses = ability.effects?.bonuses ? [...ability.effects.bonuses] : [];

        // Abrir modal
        const modal = document.getElementById('abilityEditorModal');
        if (!modal) return;

        // Resetear y luego poblar
        this.resetAbilityForm();

        // Título
        const title = document.getElementById('abilityEditorTitle');
        if (title) title.textContent = 'Editar Habilidad';

        // Poblar campos básicos
        this.setFieldValue('abilityName', ability.name);
        this.setFieldValue('abilityType', ability.type);
        this.setFieldValue('abilityCategory', ability.category);
        this.setFieldValue('abilitySource', ability.source);
        this.setFieldValue('abilitySourceDetail', ability.sourceDetail);
        this.setFieldValue('abilityDescription', ability.description);

        // Acción
        this.setFieldValue('abilityActionType', ability.actionType);
        this.setFieldValue('abilityActionCost', ability.actionCost);
        this.setFieldValue('abilityReactionTrigger', ability.reactionTrigger);
        if (ability.actionType === 'reaction') {
            const reactionGroup = document.getElementById('reactionTriggerGroup');
            if (reactionGroup) reactionGroup.style.display = 'block';
        }

        // Alcance y duración
        this.setFieldValue('abilityRange', ability.range);
        this.setFieldValue('abilityDuration', ability.duration);
        this.setCheckbox('abilityConcentration', ability.concentration);

        // Área
        if (ability.area) {
            this.setCheckbox('abilityHasArea', true);
            document.querySelector('.area-fields').style.display = 'flex';
            this.setFieldValue('abilityAreaType', ability.area.type);
            this.setFieldValue('abilityAreaSize', ability.area.size);
        }

        // Conjuro
        this.onAbilityCategoryChange();
        this.setFieldValue('abilitySpellLevel', ability.level);
        this.setFieldValue('abilitySchool', ability.school);

        // Componentes
        if (ability.components) {
            this.setCheckbox('abilityCompV', ability.components.verbal);
            this.setCheckbox('abilityCompS', ability.components.somatic);
            this.setCheckbox('abilityCompM', ability.components.material);
            if (ability.components.material) {
                document.querySelector('.material-desc').style.display = 'block';
                this.setFieldValue('abilityMaterialDesc', ability.components.materialDescription);
            }
        }

        // Usos
        this.setCheckbox('abilityUnlimited', ability.uses?.unlimited);
        if (!ability.uses?.unlimited) {
            document.querySelector('.uses-fields').style.display = 'flex';
            this.setFieldValue('abilityUsesMax', ability.uses?.max);
            this.setFieldValue('abilityRecharge', ability.uses?.recharge);
            if (ability.uses?.recharge === 'special') {
                document.querySelector('.recharge-special').style.display = 'block';
                this.setFieldValue('abilityRechargeDesc', ability.uses?.rechargeDescription);
            }
        }

        // Ataque
        if (ability.attack) {
            this.setCheckbox('abilityHasAttack', true);
            document.querySelector('.attack-fields').style.display = 'block';
            this.setFieldValue('abilityAttackType', ability.attack.type);
            this.setFieldValue('abilityAttackAbility', ability.attack.ability);
            this.setFieldValue('abilityAttackBonus', ability.attack.bonus);
        }

        // Daño
        if (ability.damage) {
            this.setCheckbox('abilityHasDamage', true);
            document.querySelector('.damage-fields').style.display = 'block';
            this.setFieldValue('abilityDamageDice', ability.damage.dice);
            this.setFieldValue('abilityDamageType', ability.damage.type);
            this.setFieldValue('abilityDamageAbility', ability.damage.ability || '');
            this.setFieldValue('abilityDamageBonus', ability.damage.bonus);
        }

        // Curación
        if (ability.healing) {
            this.setCheckbox('abilityHasHealing', true);
            document.querySelector('.healing-fields').style.display = 'block';
            this.setFieldValue('abilityHealingDice', ability.healing.dice);
            this.setFieldValue('abilityHealingAbility', ability.healing.ability || '');
            this.setFieldValue('abilityHealingBonus', ability.healing.bonus);
        }

        // Salvación
        if (ability.save) {
            this.setCheckbox('abilityHasSave', true);
            document.querySelector('.save-fields').style.display = 'block';
            this.setFieldValue('abilitySaveAbility', ability.save.ability);
            this.setFieldValue('abilitySaveDC', ability.save.dc || '');
            this.setFieldValue('abilitySaveEffect', ability.save.effect);
        }

        // Efectos
        if (ability.effects) {
            // Condiciones
            if (ability.effects.conditions) {
                ability.effects.conditions.forEach(cond => {
                    const cb = document.querySelector(`#conditionsGrid input[value="${cond}"]`);
                    if (cb) cb.checked = true;
                });
            }
            this.setFieldValue('abilityAdvantages', ability.effects.advantages);
            this.setFieldValue('abilityDisadvantages', ability.effects.disadvantages);
            this.setFieldValue('abilityResistances', ability.effects.resistances);
            this.setFieldValue('abilityImmunities', ability.effects.immunities);
            this.setFieldValue('abilityEffectText', ability.effects.other);
        }

        // Escalado
        if (ability.scaling) {
            this.setCheckbox('abilityHasScaling', true);
            document.querySelector('.scaling-fields').style.display = 'block';
            this.setFieldValue('abilityScalingType', ability.scaling.type);
            this.setFieldValue('abilityScalingDesc', ability.scaling.description);
        }

        // Notas
        this.setFieldValue('abilityNotes', ability.notes);

        // Bonuses
        this.renderBonusesList();

        modal.classList.add('active');
    }

    setFieldValue(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field && value !== undefined && value !== null) {
            field.value = value;
        }
    }

    setCheckbox(fieldId, checked) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.checked = !!checked;
        }
    }

    deleteAbility(abilityId) {
        const index = this.customAbilities.findIndex(a => a.id === abilityId);
        if (index >= 0) {
            const ability = this.customAbilities[index];
            this.customAbilities.splice(index, 1);
            this.renderCustomAbilities();
            this.updateCantripsCounter();
            this.updateSpellsCounter();
            showNotification(`Habilidad "${ability.name}" eliminada`, 'info');
        }
    }

    renderCustomAbilities() {
        // Renderizar trucos custom
        const customCantrips = this.customAbilities.filter(a => a.category === 'cantrip');
        this.renderCustomCantrips(customCantrips);

        // Renderizar conjuros custom
        const customSpells = this.customAbilities.filter(a => a.category === 'spell');
        this.renderCustomSpells(customSpells);

        // Renderizar habilidades/rasgos custom en la sección de habilidades
        const customFeatures = this.customAbilities.filter(a =>
            !['cantrip', 'spell'].includes(a.category)
        );
        this.renderCustomFeatures(customFeatures);
    }

    renderCustomCantrips(cantrips) {
        const container = document.getElementById('cantripsList');
        if (!container) return;

        // Combinar trucos del selector con trucos custom
        let html = '';

        // Trucos del selector de conjuros (si los hay)
        this.selectedCantrips.forEach((cantrip, index) => {
            const spellData = this.getSpellByKey(cantrip.key, 0);
            if (spellData) {
                html += `
                    <div class="spell-item cantrip-item" data-fav-anchor data-fav-type="cantrip" data-fav-id="${cantrip.key}">
                        <span class="spell-name">${spellData.name}</span>
                        <span class="spell-school">${spellData.school || ''}</span>
                        <button type="button" class="btn-remove-spell" data-type="selected" data-index="${index}">&times;</button>
                    </div>
                `;
            }
        });

        // Trucos custom
        cantrips.forEach(cantrip => {
            html += `
                <div class="spell-item cantrip-item custom-ability" data-id="${cantrip.id}" data-fav-anchor data-fav-type="custom-ability" data-fav-id="${cantrip.id}">
                    <span class="spell-name">${cantrip.name}</span>
                    <span class="spell-school">${cantrip.school || 'Custom'}</span>
                    <div class="ability-actions">
                        <button type="button" class="btn-edit-ability" data-id="${cantrip.id}" title="Editar">✎</button>
                        <button type="button" class="btn-remove-spell" data-type="custom" data-id="${cantrip.id}">&times;</button>
                    </div>
                </div>
            `;
        });

        if (!html) {
            html = '<p class="empty-list">No hay trucos seleccionados.</p>';
        }

        container.innerHTML = html;

        // Listeners para eliminar trucos seleccionados
        container.querySelectorAll('.btn-remove-spell[data-type="selected"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.removeCantrip(index);
            });
        });

        // Listeners para trucos custom
        container.querySelectorAll('.btn-edit-ability').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.editAbility(e.target.dataset.id);
            });
        });

        container.querySelectorAll('.btn-remove-spell[data-type="custom"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteAbility(e.target.dataset.id);
            });
        });

        // Inyectar estrellas de favorito en cada item
        this.injectFavStarsOnAnchors(container);
    }

    renderCustomSpells(spells) {
        const container = document.getElementById('spellsList');
        if (!container) return;

        // Agrupar por nivel
        const spellsByLevel = {};

        // Conjuros del selector
        this.selectedSpells.forEach((spell, index) => {
            const level = spell.level || 1;
            if (!spellsByLevel[level]) spellsByLevel[level] = [];
            spellsByLevel[level].push({
                type: 'selected',
                index,
                data: spell,
                spellData: this.getSpellByKey(spell.key, level)
            });
        });

        // Conjuros custom
        spells.forEach(spell => {
            const level = spell.level || 1;
            if (!spellsByLevel[level]) spellsByLevel[level] = [];
            spellsByLevel[level].push({
                type: 'custom',
                data: spell
            });
        });

        let html = '';

        // Renderizar por nivel
        const sortedLevels = Object.keys(spellsByLevel).sort((a, b) => parseInt(a) - parseInt(b));

        for (const level of sortedLevels) {
            html += `<div class="spell-level-group"><h6>Nivel ${level}</h6>`;

            spellsByLevel[level].forEach(item => {
                if (item.type === 'selected' && item.spellData) {
                    html += `
                        <div class="spell-item" data-fav-anchor data-fav-type="spell" data-fav-id="${item.data.key}" data-fav-level="${level}">
                            <label class="spell-prepared">
                                <input type="checkbox" ${item.data.prepared ? 'checked' : ''}
                                    data-type="selected" data-index="${item.index}">
                            </label>
                            <span class="spell-name">${item.spellData.name}</span>
                            <span class="spell-school">${item.spellData.school || ''}</span>
                            <button type="button" class="btn-remove-spell" data-type="selected" data-index="${item.index}">&times;</button>
                        </div>
                    `;
                } else if (item.type === 'custom') {
                    html += `
                        <div class="spell-item custom-ability" data-id="${item.data.id}" data-fav-anchor data-fav-type="custom-ability" data-fav-id="${item.data.id}">
                            <label class="spell-prepared">
                                <input type="checkbox" ${item.data.prepared ? 'checked' : ''}
                                    data-type="custom" data-id="${item.data.id}">
                            </label>
                            <span class="spell-name">${item.data.name}</span>
                            <span class="spell-school">${item.data.school || 'Custom'}</span>
                            <div class="ability-actions">
                                <button type="button" class="btn-edit-ability" data-id="${item.data.id}" title="Editar">✎</button>
                                <button type="button" class="btn-remove-spell" data-type="custom" data-id="${item.data.id}">&times;</button>
                            </div>
                        </div>
                    `;
                }
            });

            html += '</div>';
        }

        if (!html) {
            html = '<p class="empty-list">No hay conjuros seleccionados.</p>';
        }

        container.innerHTML = html;

        // Listeners
        container.querySelectorAll('.spell-prepared input[data-type="selected"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.toggleSpellPrepared(index, e.target.checked);
            });
        });

        container.querySelectorAll('.spell-prepared input[data-type="custom"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                const ability = this.customAbilities.find(a => a.id === id);
                if (ability) ability.prepared = e.target.checked;
            });
        });

        container.querySelectorAll('.btn-remove-spell[data-type="selected"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.removeSpell(index);
            });
        });

        container.querySelectorAll('.btn-edit-ability').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.editAbility(e.target.dataset.id);
            });
        });

        container.querySelectorAll('.btn-remove-spell[data-type="custom"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteAbility(e.target.dataset.id);
            });
        });

        // Inyectar estrellas de favorito en cada conjuro
        this.injectFavStarsOnAnchors(container);
    }

    renderCustomFeatures(features) {
        // Agregar features custom a la sección de habilidades junto con los automáticos
        const container = document.getElementById('abilitiesContainer');
        if (!container) return;

        // Obtener los rasgos automáticos existentes
        const traits = this.getAllCharacterTraits();

        // Agregar custom features a las categorías
        features.forEach(feature => {
            const target = feature.type === 'passive' ? traits.passive : traits.active;
            target.push({
                name: feature.name,
                description: feature.description,
                source: feature.sourceDetail || 'Custom',
                isCustom: true,
                id: feature.id
            });
        });

        // Re-renderizar la sección
        this.renderTraitsToContainer(container, traits);
    }

    renderTraitsToContainer(container, traits) {
        let html = '';

        // Pasivas
        if (traits.passive.length > 0) {
            html += '<div class="traits-group passive-traits"><h6 class="traits-group-title">Pasivas</h6>';
            traits.passive.forEach(trait => {
                const customClass = trait.isCustom ? 'custom-trait' : '';
                const editBtn = trait.isCustom ?
                    `<button type="button" class="btn-edit-trait" data-id="${trait.id}" title="Editar">✎</button>
                     <button type="button" class="btn-delete-trait" data-id="${trait.id}" title="Eliminar">&times;</button>` : '';
                const favType = trait.isCustom ? 'custom-ability' : 'trait';
                const favId = trait.isCustom ? trait.id : this.slugifyTraitId(trait.name);
                html += `
                    <div class="trait-item trait-passive ${customClass}" ${trait.id ? `data-id="${trait.id}"` : ''} data-fav-anchor data-fav-type="${favType}" data-fav-id="${favId}" data-fav-active="0">
                        <div class="trait-header">
                            <span class="trait-name">${trait.name}</span>
                            <span class="trait-source">(${trait.source})</span>
                            ${editBtn}
                        </div>
                        <p class="trait-description">${trait.description}</p>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Activas
        if (traits.active.length > 0) {
            html += '<div class="traits-group active-traits"><h6 class="traits-group-title">Activas</h6>';
            traits.active.forEach(trait => {
                const customClass = trait.isCustom ? 'custom-trait' : '';
                const editBtn = trait.isCustom ?
                    `<button type="button" class="btn-edit-trait" data-id="${trait.id}" title="Editar">✎</button>
                     <button type="button" class="btn-delete-trait" data-id="${trait.id}" title="Eliminar">&times;</button>` : '';
                const favType = trait.isCustom ? 'custom-ability' : 'trait';
                const favId = trait.isCustom ? trait.id : this.slugifyTraitId(trait.name);
                html += `
                    <div class="trait-item trait-active ${customClass}" ${trait.id ? `data-id="${trait.id}"` : ''} data-fav-anchor data-fav-type="${favType}" data-fav-id="${favId}" data-fav-active="1">
                        <div class="trait-header">
                            <span class="trait-name">${trait.name}</span>
                            <span class="trait-source">(${trait.source})</span>
                            ${editBtn}
                        </div>
                        <p class="trait-description">${trait.description}</p>
                    </div>
                `;
            });
            html += '</div>';
        }

        if (!html) {
            html = '<p class="no-traits">Selecciona una raza, clase y trasfondo para ver tus habilidades.</p>';
        }

        container.innerHTML = html;

        // Listeners para editar/eliminar traits custom
        container.querySelectorAll('.btn-edit-trait').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.editAbility(e.target.dataset.id);
            });
        });

        container.querySelectorAll('.btn-delete-trait').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteAbility(e.target.dataset.id);
            });
        });

        // Inyectar estrellas de favorito en cada rasgo
        this.injectFavStarsOnAnchors(container);
    }

    getSpellByKey(key, level) {
        if (!this.spellsData) return null;

        if (level === 0) {
            return this.spellsData.cantrips?.[key] || null;
        }

        const levelKey = `level${level}`;
        return this.spellsData[levelKey]?.[key] || null;
    }

    // ==========================================
    // Sistema de Favoritos (dock de acciones)
    // ==========================================

    // Genera un ID estable a partir del nombre de un rasgo
    slugifyTraitId(name) {
        if (!name) return '';
        return String(name)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    // Verifica si un item está marcado como favorito
    isFavorite(type, id) {
        return (this.favorites || []).some(f => f.type === type && f.id === id);
    }

    // Alterna un favorito (agrega si no existe, quita si sí)
    toggleFavorite(type, id, extra = {}) {
        if (!this.favorites) this.favorites = [];
        const idx = this.favorites.findIndex(f => f.type === type && f.id === id);
        if (idx >= 0) {
            this.favorites.splice(idx, 1);
        } else {
            const fav = { type, id };
            if (extra.level !== undefined) fav.level = extra.level;
            if (extra.source) fav.source = extra.source;
            if (extra.active !== undefined) fav.active = extra.active;
            this.favorites.push(fav);
        }
        // Notificar al dock para refrescar
        document.dispatchEvent(new CustomEvent('favorites-changed', {
            detail: { favorites: this.favorites }
        }));
        // Auto-guardar silenciosamente para persistir el cambio
        this.saveSilent?.();
    }

    // Crea un botón ★ reutilizable que alterna favorito
    makeFavStarButton(type, id, extra = {}) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-fav-star';
        btn.dataset.favType = type;
        btn.dataset.favId = id;
        const refresh = () => {
            const isFav = this.isFavorite(type, id);
            btn.textContent = isFav ? '★' : '☆';
            btn.classList.toggle('is-fav', isFav);
            btn.title = isFav ? 'Quitar de favoritos' : 'Agregar a favoritos';
        };
        refresh();
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFavorite(type, id, extra);
            refresh();
        });
        return btn;
    }

    // Inyecta una estrella ★ en cada elemento marcado con data-fav-anchor
    injectFavStarsOnAnchors(root) {
        const scope = root || document;
        scope.querySelectorAll('[data-fav-anchor]').forEach(el => {
            if (el.querySelector(':scope > .btn-fav-star')) return;
            const type = el.dataset.favType;
            const id = el.dataset.favId;
            if (!type || !id) return;
            const extra = {};
            if (el.dataset.favLevel !== undefined) extra.level = parseInt(el.dataset.favLevel);
            if (el.dataset.favActive !== undefined) extra.active = el.dataset.favActive === '1';
            el.appendChild(this.makeFavStarButton(type, id, extra));
        });
    }

    // Inyecta botones ★ en skills y saves (que viven en HTML estático)
    injectFavStarsOnSkillsAndSaves() {
        // Skills
        const skillCheckboxMap = {
            'skillAcrobatics': 'acrobatics', 'skillAnimalHandling': 'animalHandling',
            'skillArcana': 'arcana', 'skillAthletics': 'athletics',
            'skillDeception': 'deception', 'skillHistory': 'history',
            'skillInsight': 'insight', 'skillIntimidation': 'intimidation',
            'skillInvestigation': 'investigation', 'skillMedicine': 'medicine',
            'skillNature': 'nature', 'skillPerception': 'perception',
            'skillPerformance': 'performance', 'skillPersuasion': 'persuasion',
            'skillReligion': 'religion', 'skillSleightOfHand': 'sleightOfHand',
            'skillStealth': 'stealth', 'skillSurvival': 'survival'
        };
        Object.entries(skillCheckboxMap).forEach(([cbId, skillKey]) => {
            const cb = document.getElementById(cbId);
            if (!cb) return;
            const item = cb.closest('.skill-item');
            if (!item || item.querySelector('.btn-fav-star')) return;
            item.appendChild(this.makeFavStarButton('skill', skillKey));
        });

        // Saving throws
        const saveCheckboxMap = {
            'saveProfStr': 'strength', 'saveProfDex': 'dexterity',
            'saveProfCon': 'constitution', 'saveProfInt': 'intelligence',
            'saveProfWis': 'wisdom', 'saveProfCha': 'charisma'
        };
        Object.entries(saveCheckboxMap).forEach(([cbId, ability]) => {
            const cb = document.getElementById(cbId);
            if (!cb) return;
            const item = cb.closest('.save-item');
            if (!item || item.querySelector('.btn-fav-star')) return;
            item.appendChild(this.makeFavStarButton('save', ability));
        });
    }

    // Resuelve un favorito a su información completa (hidratado para el dock)
    resolveFavorite(fav) {
        if (!fav || !fav.type) return null;

        switch (fav.type) {
            case 'cantrip': {
                const spell = this.spellsData?.cantrips?.[fav.id];
                if (!spell) return null;
                return { ...fav, name: spell.name, data: spell, level: 0 };
            }
            case 'spell': {
                const lvl = fav.level || 1;
                const spell = this.spellsData?.[`level${lvl}`]?.[fav.id];
                if (!spell) return null;
                return { ...fav, name: spell.name, data: spell, level: lvl };
            }
            case 'trait': {
                // Buscar entre los rasgos del personaje
                const allTraits = this.getAllCharacterTraits();
                const all = [...allTraits.passive, ...allTraits.active];
                const found = all.find(t => this.slugifyTraitId(t.name) === fav.id);
                if (!found) {
                    // Buscar en customAbilities
                    const custom = (this.customAbilities || []).find(a => a.id === fav.id);
                    if (custom) {
                        return {
                            ...fav,
                            name: custom.name,
                            data: custom,
                            isActive: custom.type === 'active',
                            isCustom: true
                        };
                    }
                    return null;
                }
                const isActive = (allTraits.active.includes(found));
                return {
                    ...fav,
                    name: found.name,
                    data: found,
                    isActive,
                    isCustom: !!found.isCustom
                };
            }
            case 'skill': {
                const name = SKILL_NAMES_ES[fav.id] || fav.id;
                return { ...fav, name, ability: SKILL_ABILITIES[fav.id] };
            }
            case 'save': {
                const labels = {
                    strength: 'Salv. Fuerza', dexterity: 'Salv. Destreza',
                    constitution: 'Salv. Constitución', intelligence: 'Salv. Inteligencia',
                    wisdom: 'Salv. Sabiduría', charisma: 'Salv. Carisma'
                };
                return { ...fav, name: labels[fav.id] || fav.id, ability: fav.id };
            }
            case 'custom-ability': {
                const custom = (this.customAbilities || []).find(a => a.id === fav.id);
                if (!custom) return null;
                return { ...fav, name: custom.name, data: custom, isCustom: true };
            }
            default:
                return null;
        }
    }

    // Devuelve TODOS los items del personaje agrupados para el dock
    // (no solo favoritos: trucos, conjuros, rasgos, skills y saves)
    getAllDockItems() {
        const groups = {
            cantrips: [],
            spells: {}, // por nivel
            traits: [],
            quickRolls: []
        };

        // === Trucos ===
        (this.selectedCantrips || []).forEach(c => {
            const id = c.key;
            if (!id) return;
            const spell = this.spellsData?.cantrips?.[id];
            if (spell) {
                groups.cantrips.push({
                    type: 'cantrip', id, name: spell.name, data: spell, level: 0,
                    favorite: this.isFavorite('cantrip', id)
                });
            }
        });
        // Trucos personalizados
        (this.customAbilities || []).filter(a => a.category === 'cantrip').forEach(c => {
            groups.cantrips.push({
                type: 'custom-ability', id: c.id, name: c.name, data: c, level: 0, isCustom: true,
                favorite: this.isFavorite('custom-ability', c.id)
            });
        });

        // === Conjuros por nivel ===
        (this.selectedSpells || []).forEach(s => {
            const lvl = s.level || 1;
            const spell = this.spellsData?.[`level${lvl}`]?.[s.key];
            if (!spell) return;
            if (!groups.spells[lvl]) groups.spells[lvl] = [];
            groups.spells[lvl].push({
                type: 'spell', id: s.key, name: spell.name, data: spell, level: lvl,
                prepared: s.prepared,
                favorite: this.isFavorite('spell', s.key)
            });
        });
        // Conjuros personalizados
        (this.customAbilities || []).filter(a => a.category === 'spell').forEach(c => {
            const lvl = c.level || 1;
            if (!groups.spells[lvl]) groups.spells[lvl] = [];
            groups.spells[lvl].push({
                type: 'custom-ability', id: c.id, name: c.name, data: c, level: lvl, isCustom: true,
                favorite: this.isFavorite('custom-ability', c.id)
            });
        });

        // === Rasgos (raza, subraza, clase, trasfondo, custom) ===
        const traits = this.getAllCharacterTraits();
        traits.passive.forEach(t => {
            const id = this.slugifyTraitId(t.name);
            groups.traits.push({
                type: 'trait', id, name: t.name, data: t, isActive: false,
                favorite: this.isFavorite('trait', id)
            });
        });
        traits.active.forEach(t => {
            const id = this.slugifyTraitId(t.name);
            groups.traits.push({
                type: 'trait', id, name: t.name, data: t, isActive: true,
                favorite: this.isFavorite('trait', id)
            });
        });
        // Rasgos personalizados (features que no son cantrip ni spell)
        (this.customAbilities || []).filter(a => !['cantrip', 'spell'].includes(a.category)).forEach(c => {
            groups.traits.push({
                type: 'custom-ability', id: c.id, name: c.name, data: c,
                isActive: c.type === 'active', isCustom: true,
                favorite: this.isFavorite('custom-ability', c.id)
            });
        });

        // === Tiradas rápidas: todas las skills y saves ===
        Object.keys(SKILL_NAMES_ES).forEach(skillId => {
            groups.quickRolls.push({
                type: 'skill', id: skillId, name: SKILL_NAMES_ES[skillId],
                ability: SKILL_ABILITIES[skillId],
                favorite: this.isFavorite('skill', skillId)
            });
        });
        const saveLabels = {
            strength: 'Salv. Fuerza', dexterity: 'Salv. Destreza',
            constitution: 'Salv. Constitución', intelligence: 'Salv. Inteligencia',
            wisdom: 'Salv. Sabiduría', charisma: 'Salv. Carisma'
        };
        Object.keys(saveLabels).forEach(ability => {
            groups.quickRolls.push({
                type: 'save', id: ability, name: saveLabels[ability], ability,
                favorite: this.isFavorite('save', ability)
            });
        });

        return groups;
    }

    // Guardado silencioso (sin notificación) — usado al togglear favoritos
    async saveSilent() {
        try {
            const characterData = this.getCharacterData();
            const characterName = characterData.name || 'Sin nombre';
            const playerName = this.app.playerName;
            if (!playerName) return;
            await apiClient.saveCharacterByPlayerName(
                this.app.currentRoom.code,
                playerName,
                characterName,
                characterData
            );
        } catch (e) {
            console.error('Error en saveSilent:', e);
        }
    }

    // Devuelve los favoritos hidratados, agrupados para el dock
    getFavoritesData() {
        const groups = {
            cantrips: [],
            spells: {}, // por nivel
            traits: [],
            quickRolls: []
        };
        (this.favorites || []).forEach(fav => {
            const resolved = this.resolveFavorite(fav);
            if (!resolved) return;
            if (fav.type === 'cantrip') {
                groups.cantrips.push(resolved);
            } else if (fav.type === 'spell') {
                const lvl = resolved.level || 1;
                if (!groups.spells[lvl]) groups.spells[lvl] = [];
                groups.spells[lvl].push(resolved);
            } else if (fav.type === 'trait' || fav.type === 'custom-ability') {
                groups.traits.push(resolved);
            } else if (fav.type === 'skill' || fav.type === 'save') {
                groups.quickRolls.push(resolved);
            }
        });
        return groups;
    }
}

export { CharacterSheet };
