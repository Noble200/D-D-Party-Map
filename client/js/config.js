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
        notes: ''
    },

    personality: {
        traits: '',
        ideals: '',
        bonds: '',
        flaws: ''
    },

    features: '',
    equipment: ''
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
