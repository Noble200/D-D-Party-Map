// ==========================================
// Configuración de la aplicación
// ==========================================

// URL base de la API (usa la URL actual del servidor)
export const API_URL = '/api';

// Configuración por defecto de la imagen
export const DEFAULT_IMAGE_TRANSFORM = {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0
};

// Configuración por defecto de la cuadrícula
export const DEFAULT_GRID_CONFIG = {
    size: 50,
    opacity: 0.5,
    color: '#ffffff',
    lineWidth: 1,
    visible: true,
    offsetX: 0,
    offsetY: 0
};

// Límites de zoom
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.1;

// Modos de administrador
export const ADMIN_MODES = {
    EDIT: 'edit',
    MASTER: 'master'
};

// ==========================================
// Configuración de Personajes D&D 5e
// ==========================================

// Estructura por defecto de un personaje
export const DEFAULT_CHARACTER = {
    name: '',
    class: '',
    level: 1,
    race: '',
    background: '',
    alignment: '',
    xp: 0,

    abilities: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10
    },

    combat: {
        armorClass: 10,
        initiative: 0,
        speed: 30,
        hpMax: 0,
        hpCurrent: 0,
        hpTemp: 0,
        hitDice: '',
        deathSaves: { successes: 0, failures: 0 }
    },

    savingThrows: {
        strength: false,
        dexterity: false,
        constitution: false,
        intelligence: false,
        wisdom: false,
        charisma: false
    },

    skills: {
        acrobatics: { proficient: false, expertise: false },
        animalHandling: { proficient: false, expertise: false },
        arcana: { proficient: false, expertise: false },
        athletics: { proficient: false, expertise: false },
        deception: { proficient: false, expertise: false },
        history: { proficient: false, expertise: false },
        insight: { proficient: false, expertise: false },
        intimidation: { proficient: false, expertise: false },
        investigation: { proficient: false, expertise: false },
        medicine: { proficient: false, expertise: false },
        nature: { proficient: false, expertise: false },
        perception: { proficient: false, expertise: false },
        performance: { proficient: false, expertise: false },
        persuasion: { proficient: false, expertise: false },
        religion: { proficient: false, expertise: false },
        sleightOfHand: { proficient: false, expertise: false },
        stealth: { proficient: false, expertise: false },
        survival: { proficient: false, expertise: false }
    },

    spellcasting: {
        class: '',
        ability: '',
        cantripsKnown: [],      // Array de spell keys: ['light', 'fireRay']
        spellsKnown: [],        // Array de {key, level, prepared}
        spellSlots: {           // Espacios usados por nivel
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
        },
        customAbilities: [],    // Array de habilidades personalizadas (ver DEFAULT_CUSTOM_ABILITY)
        notes: ''
    },

    personality: {
        traits: '',
        ideals: '',
        bonds: '',
        flaws: ''
    },

    features: '',
    equipment: '',

    // Favoritos del jugador (trucos/conjuros/rasgos/skills/saves marcados con ★)
    // Cada favorito: { type, id, [level], [source], [active] }
    // type: 'cantrip' | 'spell' | 'trait' | 'skill' | 'save' | 'custom-ability'
    favorites: [],

    // Trackeo de usos por descanso para rasgos activos
    // Estructura: { [traitId]: { max, current, recharge: 'short'|'long'|'special' } }
    abilityUses: {}
};

// ==========================================
// Estructura de Habilidad Personalizada
// ==========================================
// Esta estructura define todos los campos posibles para una habilidad,
// conjuro, rasgo o capacidad que el jugador puede crear o modificar.
export const DEFAULT_CUSTOM_ABILITY = {
    // Identificación
    id: '',                     // ID único generado (timestamp + random)
    name: '',                   // Nombre de la habilidad
    nameEn: '',                 // Nombre en inglés (opcional)
    source: 'custom',           // 'race', 'class', 'background', 'feat', 'item', 'custom'
    sourceDetail: '',           // Detalle: "Elfo", "Mago Nv3", "Acólito", etc.

    // Clasificación
    type: 'active',             // 'passive' o 'active'
    category: 'ability',        // 'cantrip', 'spell', 'ability', 'feature', 'attack'
    level: 0,                   // Nivel del conjuro (0 = truco, 1-9 para conjuros)
    school: '',                 // Escuela de magia: 'abjuración', 'conjuración', 'adivinación',
                                // 'encantamiento', 'evocación', 'ilusión', 'nigromancia', 'transmutación'

    // Descripción
    description: '',            // Descripción completa de la habilidad
    shortDescription: '',       // Descripción corta para mostrar en listas

    // Acción
    actionType: 'action',       // 'action', 'bonusAction', 'reaction', 'free', 'special', 'none'
    actionCost: '1 acción',     // Texto descriptivo: "1 acción", "1 acción adicional", etc.
    reactionTrigger: '',        // Si es reacción, cuál es el disparador

    // Alcance y Área
    range: '',                  // 'Personal', 'Toque', '30 pies', '60 pies', etc.
    rangeValue: 0,              // Valor numérico en pies (para cálculos)
    area: null,                 // Área de efecto: { type: 'cone'|'sphere'|'cube'|'line'|'cylinder', size: 15 }

    // Duración
    duration: '',               // 'Instantánea', '1 minuto', '1 hora', 'Hasta disipar', etc.
    concentration: false,       // Requiere concentración

    // Componentes (para conjuros)
    components: {
        verbal: false,          // V
        somatic: false,         // S
        material: false,        // M
        materialDescription: '' // Descripción del componente material
    },

    // Usos y Recuperación
    uses: {
        unlimited: true,        // Sin límite de usos
        max: 0,                 // Número máximo de usos
        current: 0,             // Usos restantes
        recharge: 'none',       // 'none', 'shortRest', 'longRest', 'dawn', 'round', 'special'
        rechargeDescription: '' // Descripción especial de recarga
    },

    // Mecánicas de Combate
    attack: null,               // Ataque: { type: 'melee'|'ranged', ability: 'strength'|'dexterity'|'spellcasting', bonus: 0 }
    damage: null,               // Daño: { dice: '2d6', type: 'fuego', ability: null, addModifier: false, bonus: 0 }
    healing: null,              // Curación: { dice: '2d8', ability: null, addModifier: false, bonus: 0 }

    // Tirada de Salvación
    save: null,                 // { ability: 'dexterity', dc: null, dcAbility: 'spellcasting', effect: 'half'|'none'|'special' }

    // Efectos Adicionales
    effects: {
        conditions: [],         // Condiciones aplicadas: ['paralyzed', 'stunned', 'frightened', etc.]
        conditionDuration: '',  // Duración de la condición
        advantages: [],         // Ventajas otorgadas: ['attack', 'strength_saves', 'stealth', etc.]
        disadvantages: [],      // Desventajas causadas
        resistances: [],        // Resistencias otorgadas: ['fire', 'cold', 'bludgeoning', etc.]
        immunities: [],         // Inmunidades otorgadas
        bonuses: [],            // Bonificadores: [{ type: 'ac', value: 2 }, { type: 'speed', value: 10 }]
    },

    // Escalado
    scaling: null,              // { type: 'cantrip'|'spellSlot'|'level', data: {...} }

    // Requisitos
    requirements: {
        level: 0,               // Nivel mínimo requerido
        class: '',              // Clase requerida
        equipped: '',           // Item que debe estar equipado
        condition: ''           // Condición especial
    },

    // Metadatos
    prepared: true,             // Para conjuros: está preparado
    favorite: false,            // Marcado como favorito
    notes: ''                   // Notas adicionales del jugador
};

// Opciones para los selectores del formulario de habilidades
export const ABILITY_OPTIONS = {
    actionTypes: {
        action: 'Acción',
        bonusAction: 'Acción Adicional',
        reaction: 'Reacción',
        free: 'Acción Libre',
        special: 'Especial',
        none: 'Ninguna (Pasiva)'
    },
    damageTypes: [
        'ácido', 'contundente', 'frío', 'fuego', 'fuerza', 'eléctrico',
        'necrótico', 'perforante', 'veneno', 'psíquico', 'radiante',
        'cortante', 'trueno'
    ],
    conditions: [
        { key: 'blinded', name: 'Cegado' },
        { key: 'charmed', name: 'Encantado' },
        { key: 'deafened', name: 'Ensordecido' },
        { key: 'exhaustion', name: 'Agotamiento' },
        { key: 'frightened', name: 'Asustado' },
        { key: 'grappled', name: 'Agarrado' },
        { key: 'incapacitated', name: 'Incapacitado' },
        { key: 'invisible', name: 'Invisible' },
        { key: 'paralyzed', name: 'Paralizado' },
        { key: 'petrified', name: 'Petrificado' },
        { key: 'poisoned', name: 'Envenenado' },
        { key: 'prone', name: 'Derribado' },
        { key: 'restrained', name: 'Apresado' },
        { key: 'stunned', name: 'Aturdido' },
        { key: 'unconscious', name: 'Inconsciente' }
    ],
    schools: [
        { key: 'abjuración', name: 'Abjuración' },
        { key: 'conjuración', name: 'Conjuración' },
        { key: 'adivinación', name: 'Adivinación' },
        { key: 'encantamiento', name: 'Encantamiento' },
        { key: 'evocación', name: 'Evocación' },
        { key: 'ilusión', name: 'Ilusión' },
        { key: 'nigromancia', name: 'Nigromancia' },
        { key: 'transmutación', name: 'Transmutación' }
    ],
    abilities: [
        { key: 'strength', name: 'Fuerza' },
        { key: 'dexterity', name: 'Destreza' },
        { key: 'constitution', name: 'Constitución' },
        { key: 'intelligence', name: 'Inteligencia' },
        { key: 'wisdom', name: 'Sabiduría' },
        { key: 'charisma', name: 'Carisma' },
        { key: 'spellcasting', name: 'Lanzamiento de Conjuros' }
    ],
    rechargeTypes: {
        none: 'Sin límite',
        shortRest: 'Descanso Corto',
        longRest: 'Descanso Largo',
        dawn: 'Al Amanecer',
        round: 'Cada Asalto',
        special: 'Especial'
    },
    areaTypes: {
        cone: 'Cono',
        sphere: 'Esfera',
        cube: 'Cubo',
        line: 'Línea',
        cylinder: 'Cilindro'
    },
    sourceTypes: {
        race: 'Raza',
        class: 'Clase',
        background: 'Trasfondo',
        feat: 'Dote',
        item: 'Objeto',
        custom: 'Personalizado'
    }
};

// Mapeo de habilidad -> atributo
export const SKILL_ABILITIES = {
    acrobatics: 'dexterity',
    animalHandling: 'wisdom',
    arcana: 'intelligence',
    athletics: 'strength',
    deception: 'charisma',
    history: 'intelligence',
    insight: 'wisdom',
    intimidation: 'charisma',
    investigation: 'intelligence',
    medicine: 'wisdom',
    nature: 'intelligence',
    perception: 'wisdom',
    performance: 'charisma',
    persuasion: 'charisma',
    religion: 'intelligence',
    sleightOfHand: 'dexterity',
    stealth: 'dexterity',
    survival: 'wisdom'
};

// ==========================================
// NOTA: Los datos de razas están en /data/races.json
// Se cargan dinámicamente en CharacterSheet.js
// ==========================================

// Mapeo de nombres de habilidades en inglés a español
export const SKILL_NAMES_ES = {
    acrobatics: 'Acrobacias',
    animalHandling: 'Trato con Animales',
    arcana: 'Arcano',
    athletics: 'Atletismo',
    deception: 'Engaño',
    history: 'Historia',
    insight: 'Perspicacia',
    intimidation: 'Intimidación',
    investigation: 'Investigación',
    medicine: 'Medicina',
    nature: 'Naturaleza',
    perception: 'Percepción',
    performance: 'Interpretación',
    persuasion: 'Persuasión',
    religion: 'Religión',
    sleightOfHand: 'Juego de Manos',
    stealth: 'Sigilo',
    survival: 'Supervivencia'
};

// Configuración por defecto de distancia de mapa
export const DEFAULT_DISTANCE_CONFIG = {
    squareSize: 5,
    unit: 'feet'
};

// Unidades de distancia disponibles
export const DISTANCE_UNITS = {
    feet: 'pies',
    meters: 'metros',
    km: 'kilómetros',
    miles: 'millas'
};
