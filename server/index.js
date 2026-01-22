require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Servir archivos estáticos desde la carpeta client
app.use(express.static(path.join(__dirname, '../client')));

// Conexión a PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Inicializar base de datos
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

// ==========================================
// API ENDPOINTS
// ==========================================

// Crear nueva sala (Admin)
app.post('/api/rooms', async (req, res) => {
    try {
        const { name, adminPassword } = req.body;

        if (!name || !adminPassword) {
            return res.status(400).json({ error: 'Nombre y contraseña son requeridos' });
        }

        const code = nanoid(8).toUpperCase();

        const result = await pool.query(
            'INSERT INTO rooms (code, name, admin_password) VALUES ($1, $2, $3) RETURNING *',
            [code, name, adminPassword]
        );

        res.json({
            success: true,
            room: {
                code: result.rows[0].code,
                name: result.rows[0].name
            }
        });
    } catch (error) {
        console.error('Error creando sala:', error);
        res.status(500).json({ error: 'Error al crear la sala' });
    }
});

// Obtener sala (Usuario - solo lectura)
app.get('/api/rooms/:code', async (req, res) => {
    try {
        const { code } = req.params;

        const result = await pool.query(
            'SELECT code, name, image_data, image_transform, grid_config FROM rooms WHERE code = $1',
            [code.toUpperCase()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Sala no encontrada' });
        }

        res.json({ success: true, room: result.rows[0] });
    } catch (error) {
        console.error('Error obteniendo sala:', error);
        res.status(500).json({ error: 'Error al obtener la sala' });
    }
});

// Verificar acceso admin
app.post('/api/rooms/:code/admin', async (req, res) => {
    try {
        const { code } = req.params;
        const { adminPassword } = req.body;

        const result = await pool.query(
            'SELECT * FROM rooms WHERE code = $1 AND admin_password = $2',
            [code.toUpperCase(), adminPassword]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Código o contraseña incorrectos' });
        }

        res.json({ success: true, room: result.rows[0] });
    } catch (error) {
        console.error('Error verificando admin:', error);
        res.status(500).json({ error: 'Error de verificación' });
    }
});

// Actualizar sala (Admin)
app.put('/api/rooms/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const { adminPassword, imageData, imageTransform, gridConfig } = req.body;

        // Verificar contraseña
        const verify = await pool.query(
            'SELECT id FROM rooms WHERE code = $1 AND admin_password = $2',
            [code.toUpperCase(), adminPassword]
        );

        if (verify.rows.length === 0) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        // Actualizar
        const result = await pool.query(
            `UPDATE rooms SET
                image_data = COALESCE($1, image_data),
                image_transform = COALESCE($2, image_transform),
                grid_config = COALESCE($3, grid_config),
                updated_at = CURRENT_TIMESTAMP
            WHERE code = $4 RETURNING code, name`,
            [imageData, JSON.stringify(imageTransform), JSON.stringify(gridConfig), code.toUpperCase()]
        );

        res.json({ success: true, room: result.rows[0] });
    } catch (error) {
        console.error('Error actualizando sala:', error);
        res.status(500).json({ error: 'Error al actualizar la sala' });
    }
});

// Listar salas de un admin (por contraseña)
app.post('/api/rooms/list', async (req, res) => {
    try {
        const { adminPassword } = req.body;

        const result = await pool.query(
            'SELECT code, name, created_at, updated_at FROM rooms WHERE admin_password = $1 ORDER BY updated_at DESC',
            [adminPassword]
        );

        res.json({ success: true, rooms: result.rows });
    } catch (error) {
        console.error('Error listando salas:', error);
        res.status(500).json({ error: 'Error al listar salas' });
    }
});

// Ruta catch-all para SPA (sirve index.html para cualquier ruta no API)
app.get('*', (req, res) => {
    // No servir HTML para rutas de API
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Iniciar servidor
initDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Servidor corriendo en puerto ${PORT}`);
    });
}).catch(console.error);
