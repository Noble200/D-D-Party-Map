// ==========================================
// Funciones de utilidad
// ==========================================

// Mostrar notificación temporal
export function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Copiar texto al portapapeles
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('Error al copiar:', error);
        return false;
    }
}

// Inicializar controles de numero personalizados
export function initNumberInputControls() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.input-number-btn');
        if (!btn) return;

        const action = btn.dataset.action;
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);

        if (!input) return;

        const step = parseFloat(input.step) || 1;
        const min = parseFloat(input.min);
        const max = parseFloat(input.max);
        let value = parseFloat(input.value) || 0;

        if (action === 'increment') {
            value += step;
            if (!isNaN(max) && value > max) value = max;
        } else if (action === 'decrement') {
            value -= step;
            if (!isNaN(min) && value < min) value = min;
        }

        input.value = value;

        // Disparar evento de cambio para que otros listeners lo detecten
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}
