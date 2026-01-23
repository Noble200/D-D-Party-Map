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
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Base de datos inicializada');
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

module.exports = {
    pool,
    initDB,
    createRoom,
    getRoomByCode,
    verifyAdminAccess,
    updateRoom,
    listRoomsByAdmin
};
