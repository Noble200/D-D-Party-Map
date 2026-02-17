// ==========================================
// Middleware de restricción por IP
// ==========================================

// IPs permitidas por defecto (localhost)
const DEFAULT_ALLOWED_IPS = [
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'localhost'
];

// Verificar si es IP de red local (para desarrollo)
function isLocalNetworkIP(ip) {
    // Remover prefijo IPv6 si existe
    const cleanIP = ip.replace('::ffff:', '');

    // Rangos de IP privada/local
    // 10.x.x.x, 172.16-31.x.x, 192.168.x.x, localhost
    return cleanIP.startsWith('10.') ||
           cleanIP.startsWith('192.168.') ||
           cleanIP.startsWith('172.16.') ||
           cleanIP.startsWith('172.17.') ||
           cleanIP.startsWith('172.18.') ||
           cleanIP.startsWith('172.19.') ||
           cleanIP.startsWith('172.2') ||
           cleanIP.startsWith('172.30.') ||
           cleanIP.startsWith('172.31.') ||
           cleanIP === '127.0.0.1' ||
           cleanIP === 'localhost' ||
           cleanIP === '::1';
}

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
    // Si DISABLE_IP_RESTRICTION está activo, permitir todo (para desarrollo/producción sin restricción)
    if (process.env.DISABLE_IP_RESTRICTION === 'true') {
        return next();
    }

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
    }) || isLocalNetworkIP(clientIP);

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
