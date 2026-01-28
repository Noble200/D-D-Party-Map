// ==========================================
// Conexión y operaciones de base de datos
// ==========================================

const { Pool } = require('pg');

// Configuración del pool de conexiones
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Inicializar tablas de la base de datos
async function initDB() {
    const client = await pool.connect();
    try {
        // Tabla de salas (existente)
        await client.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                id SERIAL PRIMARY KEY,
                code VARCHAR(10) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                admin_password VARCHAR(255) NOT NULL,
                image_data TEXT,
                image_transform JSONB DEFAULT '{"x": 0, "y": 0, "scale": 1, "rotation": 0}',
                grid_config JSONB DEFAULT '{"size": 50, "opacity": 0.5, "color": "#ffffff", "lineWidth": 1, "visible": true, "offsetX": 0, "offsetY": 0}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Agregar columna last_activity si no existe (migración)
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'rooms' AND column_name = 'last_activity'
                ) THEN
                    ALTER TABLE rooms ADD COLUMN last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                    UPDATE rooms SET last_activity = COALESCE(updated_at, created_at);
                END IF;
            END $$;
        `);

        // Índice para optimizar búsqueda de salas inactivas
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_rooms_last_activity ON rooms(last_activity);
        `);

        // Tabla de usuarios persistentes
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_hash VARCHAR(64) UNIQUE NOT NULL,
                player_name VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabla de personajes D&D
        await client.query(`
            CREATE TABLE IF NOT EXISTS characters (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                room_code VARCHAR(10) REFERENCES rooms(code) ON DELETE CASCADE,
                character_name VARCHAR(255) NOT NULL,
                character_data JSONB NOT NULL DEFAULT '{}',
                completion_percent INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, room_code)
            )
        `);

        // Tabla de mapas múltiples por sala
        await client.query(`
            CREATE TABLE IF NOT EXISTS maps (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                room_code VARCHAR(10) REFERENCES rooms(code) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                image_data TEXT,
                image_transform JSONB DEFAULT '{"x": 0, "y": 0, "scale": 1, "rotation": 0}',
                grid_config JSONB DEFAULT '{"size": 50, "opacity": 0.5, "color": "#ffffff", "lineWidth": 1, "visible": true, "offsetX": 0, "offsetY": 0}',
                distance_config JSONB DEFAULT '{"squareSize": 5, "unit": "feet"}',
                is_active BOOLEAN DEFAULT false,
                display_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Índices para optimización
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);
            CREATE INDEX IF NOT EXISTS idx_characters_room_code ON characters(room_code);
            CREATE INDEX IF NOT EXISTS idx_maps_room_code ON maps(room_code);
            CREATE INDEX IF NOT EXISTS idx_maps_is_active ON maps(room_code, is_active);
            CREATE INDEX IF NOT EXISTS idx_users_hash ON users(user_hash);
        `);

        console.log('Base de datos inicializada correctamente');
    } finally {
        client.release();
    }
}

// Crear una nueva sala
async function createRoom(code, name, adminPassword) {
    const result = await pool.query(
        'INSERT INTO rooms (code, name, admin_password) VALUES ($1, $2, $3) RETURNING *',
        [code, name, adminPassword]
    );
    return result.rows[0];
}

// Obtener sala por código (solo datos públicos)
async function getRoomByCode(code) {
    const result = await pool.query(
        'SELECT code, name, image_data, image_transform, grid_config FROM rooms WHERE code = $1',
        [code.toUpperCase()]
    );
    return result.rows[0] || null;
}

// Verificar acceso de admin
async function verifyAdminAccess(code, adminPassword) {
    const result = await pool.query(
        'SELECT * FROM rooms WHERE code = $1 AND admin_password = $2',
        [code.toUpperCase(), adminPassword]
    );
    return result.rows[0] || null;
}

// Actualizar sala
async function updateRoom(code, adminPassword, imageData, imageTransform, gridConfig) {
    // Primero verificar permisos
    const verify = await pool.query(
        'SELECT id FROM rooms WHERE code = $1 AND admin_password = $2',
        [code.toUpperCase(), adminPassword]
    );

    if (verify.rows.length === 0) {
        return null;
    }

    // Actualizar datos
    const result = await pool.query(
        `UPDATE rooms SET
            image_data = COALESCE($1, image_data),
            image_transform = COALESCE($2, image_transform),
            grid_config = COALESCE($3, grid_config),
            updated_at = CURRENT_TIMESTAMP
        WHERE code = $4 RETURNING code, name`,
        [imageData, JSON.stringify(imageTransform), JSON.stringify(gridConfig), code.toUpperCase()]
    );

    return result.rows[0];
}

// Listar salas por contraseña de admin
async function listRoomsByAdmin(adminPassword) {
    const result = await pool.query(
        'SELECT code, name, created_at, updated_at FROM rooms WHERE admin_password = $1 ORDER BY updated_at DESC',
        [adminPassword]
    );
    return result.rows;
}

// Actualizar última actividad de una sala (cuando alguien se conecta)
async function updateRoomActivity(code) {
    await pool.query(
        'UPDATE rooms SET last_activity = CURRENT_TIMESTAMP WHERE code = $1',
        [code.toUpperCase()]
    );
}

// Eliminar salas inactivas (sin conexiones en más de X días)
async function cleanupInactiveRooms(daysInactive = 7) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Obtener salas a eliminar para logging
        const toDelete = await client.query(
            `SELECT code, name, last_activity FROM rooms
             WHERE last_activity < NOW() - INTERVAL '1 day' * $1`,
            [daysInactive]
        );

        if (toDelete.rows.length > 0) {
            // Las tablas relacionadas (maps, characters) se eliminan automáticamente
            // gracias a ON DELETE CASCADE
            const result = await client.query(
                `DELETE FROM rooms
                 WHERE last_activity < NOW() - INTERVAL '1 day' * $1
                 RETURNING code, name`,
                [daysInactive]
            );

            await client.query('COMMIT');
            console.log(`Limpieza: ${result.rows.length} salas inactivas eliminadas`);
            return result.rows;
        }

        await client.query('COMMIT');
        return [];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// ==========================================
// FUNCIONES DE USUARIOS
// ==========================================

// Crear o recuperar usuario por hash
async function createOrGetUser(userHash, playerName) {
    // Intentar obtener usuario existente
    let result = await pool.query(
        'SELECT * FROM users WHERE user_hash = $1',
        [userHash]
    );

    if (result.rows.length > 0) {
        // Usuario existe, actualizar last_seen y nombre si cambió
        await pool.query(
            'UPDATE users SET last_seen = CURRENT_TIMESTAMP, player_name = COALESCE($2, player_name) WHERE user_hash = $1',
            [userHash, playerName]
        );
        result = await pool.query('SELECT * FROM users WHERE user_hash = $1', [userHash]);
        return result.rows[0];
    }

    // Crear nuevo usuario
    result = await pool.query(
        'INSERT INTO users (user_hash, player_name) VALUES ($1, $2) RETURNING *',
        [userHash, playerName]
    );
    return result.rows[0];
}

// Obtener usuario por hash
async function getUserByHash(userHash) {
    const result = await pool.query(
        'SELECT * FROM users WHERE user_hash = $1',
        [userHash]
    );
    return result.rows[0] || null;
}

// ==========================================
// FUNCIONES DE PERSONAJES
// ==========================================

// Crear personaje
async function createCharacter(userId, roomCode, characterName, characterData = {}) {
    const result = await pool.query(
        `INSERT INTO characters (user_id, room_code, character_name, character_data, completion_percent)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, room_code)
         DO UPDATE SET character_name = $3, character_data = $4, completion_percent = $5, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [userId, roomCode.toUpperCase(), characterName, JSON.stringify(characterData), calculateCompletion(characterData)]
    );
    return result.rows[0];
}

// Obtener personaje de usuario en sala
async function getCharacter(userId, roomCode) {
    const result = await pool.query(
        'SELECT * FROM characters WHERE user_id = $1 AND room_code = $2',
        [userId, roomCode.toUpperCase()]
    );
    return result.rows[0] || null;
}

// Actualizar personaje
async function updateCharacter(characterId, characterName, characterData) {
    const result = await pool.query(
        `UPDATE characters SET
            character_name = COALESCE($2, character_name),
            character_data = COALESCE($3, character_data),
            completion_percent = $4,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING *`,
        [characterId, characterName, JSON.stringify(characterData), calculateCompletion(characterData)]
    );
    return result.rows[0] || null;
}

// Calcular porcentaje de completitud de la ficha
function calculateCompletion(data) {
    if (!data || typeof data !== 'object') return 0;

    // Campos requeridos para considerar la ficha "completa"
    const requiredFields = [
        'name', 'class', 'level', 'race',
        'abilities.strength', 'abilities.dexterity', 'abilities.constitution',
        'abilities.intelligence', 'abilities.wisdom', 'abilities.charisma'
    ];

    let filled = 0;
    for (const field of requiredFields) {
        const parts = field.split('.');
        let value = data;
        for (const part of parts) {
            value = value?.[part];
        }
        if (value !== undefined && value !== null && value !== '' && value !== 0) {
            filled++;
        }
    }

    return Math.round((filled / requiredFields.length) * 100);
}

// ==========================================
// FUNCIONES DE MAPAS
// ==========================================

// Crear nuevo mapa
async function createMap(roomCode, name, imageData = null, imageTransform = null, gridConfig = null, distanceConfig = null) {
    const result = await pool.query(
        `INSERT INTO maps (room_code, name, image_data, image_transform, grid_config, distance_config, is_active, display_order)
         VALUES ($1, $2, $3, COALESCE($4, '{"x": 0, "y": 0, "scale": 1, "rotation": 0}'::jsonb),
                 COALESCE($5, '{"size": 50, "opacity": 0.5, "color": "#ffffff", "lineWidth": 1, "visible": true, "offsetX": 0, "offsetY": 0}'::jsonb),
                 COALESCE($6, '{"squareSize": 5, "unit": "feet"}'::jsonb),
                 false, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM maps WHERE room_code = $1))
         RETURNING *`,
        [roomCode.toUpperCase(), name, imageData,
         imageTransform ? JSON.stringify(imageTransform) : null,
         gridConfig ? JSON.stringify(gridConfig) : null,
         distanceConfig ? JSON.stringify(distanceConfig) : null]
    );
    return result.rows[0];
}

// Listar mapas de una sala
async function getMaps(roomCode) {
    const result = await pool.query(
        'SELECT * FROM maps WHERE room_code = $1 ORDER BY display_order ASC',
        [roomCode.toUpperCase()]
    );
    return result.rows;
}

// Obtener mapa activo de una sala
async function getActiveMap(roomCode) {
    const result = await pool.query(
        'SELECT * FROM maps WHERE room_code = $1 AND is_active = true',
        [roomCode.toUpperCase()]
    );
    return result.rows[0] || null;
}

// Obtener mapa por ID
async function getMapById(mapId) {
    const result = await pool.query(
        'SELECT * FROM maps WHERE id = $1',
        [mapId]
    );
    return result.rows[0] || null;
}

// Activar un mapa (desactiva los demás)
async function setActiveMap(roomCode, mapId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Desactivar todos los mapas de la sala
        await client.query(
            'UPDATE maps SET is_active = false WHERE room_code = $1',
            [roomCode.toUpperCase()]
        );

        // Activar el mapa seleccionado
        const result = await client.query(
            'UPDATE maps SET is_active = true WHERE id = $1 AND room_code = $2 RETURNING *',
            [mapId, roomCode.toUpperCase()]
        );

        await client.query('COMMIT');
        return result.rows[0] || null;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Actualizar mapa
async function updateMap(mapId, data) {
    const { name, imageData, imageTransform, gridConfig, distanceConfig } = data;

    const result = await pool.query(
        `UPDATE maps SET
            name = COALESCE($2, name),
            image_data = COALESCE($3, image_data),
            image_transform = COALESCE($4, image_transform),
            grid_config = COALESCE($5, grid_config),
            distance_config = COALESCE($6, distance_config),
            updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING *`,
        [mapId, name, imageData,
         imageTransform ? JSON.stringify(imageTransform) : null,
         gridConfig ? JSON.stringify(gridConfig) : null,
         distanceConfig ? JSON.stringify(distanceConfig) : null]
    );
    return result.rows[0] || null;
}

// Eliminar mapa
async function deleteMap(mapId) {
    const result = await pool.query(
        'DELETE FROM maps WHERE id = $1 RETURNING *',
        [mapId]
    );
    return result.rows[0] || null;
}

// Migrar datos de sala existente a tabla maps (ejecutar una vez)
async function migrateRoomMapsData() {
    const client = await pool.connect();
    try {
        // Obtener salas con datos de imagen que no tienen mapas migrados
        const rooms = await client.query(`
            SELECT r.code, r.name, r.image_data, r.image_transform, r.grid_config
            FROM rooms r
            WHERE r.image_data IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM maps m WHERE m.room_code = r.code)
        `);

        for (const room of rooms.rows) {
            await client.query(
                `INSERT INTO maps (room_code, name, image_data, image_transform, grid_config, is_active, display_order)
                 VALUES ($1, $2, $3, $4, $5, true, 0)`,
                [room.code, 'Mapa Principal', room.image_data, room.image_transform, room.grid_config]
            );
        }

        console.log(`Migrados ${rooms.rows.length} mapas de salas existentes`);
        return rooms.rows.length;
    } finally {
        client.release();
    }
}

module.exports = {
    pool,
    initDB,
    // Salas
    createRoom,
    getRoomByCode,
    verifyAdminAccess,
    updateRoom,
    listRoomsByAdmin,
    updateRoomActivity,
    cleanupInactiveRooms,
    // Usuarios
    createOrGetUser,
    getUserByHash,
    // Personajes
    createCharacter,
    getCharacter,
    updateCharacter,
    calculateCompletion,
    // Mapas
    createMap,
    getMaps,
    getActiveMap,
    getMapById,
    setActiveMap,
    updateMap,
    deleteMap,
    migrateRoomMapsData
};
