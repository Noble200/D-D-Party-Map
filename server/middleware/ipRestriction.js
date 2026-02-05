// ==========================================
// Middleware de restricción por IP
// ==========================================

// IPs permitidas por defecto (localhost)
const DEFAULT_ALLOWED_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

// Obtener IP real del cliente (considerando proxies)
function getClientIP(req) {
    // Headers comunes de proxies
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // X-Forwarded-For puede tener múltiples IPs, la primera es el cliente real
        return forwarded.split(',')[0].trim();
    }

    // Otros headers de proxy
    const realIP = req.headers['x-real-ip'];
    if (realIP) return realIP;

    // IP directa de la conexión
    return req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;
}

// Middleware de restricción
function ipRestriction(req, res, next) {
    // Obtener IPs permitidas desde variable de entorno o usar default
    const allowedIPsEnv = process.env.ADMIN_ALLOWED_IPS || '';
    const allowedIPs = [
        ...DEFAULT_ALLOWED_IPS,
        ...allowedIPsEnv.split(',').map(ip => ip.trim()).filter(Boolean)
    ];

    const clientIP = getClientIP(req);

    // Verificar si la IP está permitida
    const isAllowed = allowedIPs.some(allowedIP => {
        // Comparación exacta o con prefijo ::ffff: (IPv4 mapeado a IPv6)
        return clientIP === allowedIP ||
               clientIP === `::ffff:${allowedIP}` ||
               `::ffff:${clientIP}` === allowedIP;
    });

    if (isAllowed) {
        next();
    } else {
        console.log(`Acceso admin denegado para IP: ${clientIP}`);
        res.status(403).json({
            error: 'Acceso denegado',
            message: 'Tu IP no tiene permiso para acceder a este recurso'
        });
    }
}

module.exports = { ipRestriction, getClientIP };
