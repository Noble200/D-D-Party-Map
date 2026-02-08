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
        // Soporta tanto .input-number-btn como .ability-btn
        const btn = e.target.closest('.input-number-btn, .ability-btn');
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

// Inicializar selects personalizados
export function initCustomSelects(selector = '.character-sheet select') {
    const selects = document.querySelectorAll(selector);

    selects.forEach(select => {
        // Evitar inicializar dos veces
        if (select.parentElement.classList.contains('custom-select-wrapper')) return;

        createCustomSelect(select);
    });

    // Cerrar dropdowns al hacer click fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select-wrapper')) {
            document.querySelectorAll('.custom-select-wrapper.open').forEach(wrapper => {
                wrapper.classList.remove('open');
            });
        }
    });
}

// Crear un select personalizado
function createCustomSelect(select) {
    // Crear wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';

    // Insertar wrapper antes del select y mover select dentro
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    // Crear trigger
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';

    const selectedText = document.createElement('span');
    selectedText.className = 'selected-text';

    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('viewBox', '0 0 24 24');
    arrow.className = 'custom-select-arrow';
    arrow.innerHTML = '<path d="M7 10l5 5 5-5z"/>';

    trigger.appendChild(selectedText);
    trigger.appendChild(arrow);
    wrapper.appendChild(trigger);

    // Crear dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'custom-select-dropdown';

    // Crear opciones
    Array.from(select.options).forEach((option, index) => {
        const optionEl = document.createElement('div');
        optionEl.className = 'custom-select-option';
        optionEl.textContent = option.textContent;
        optionEl.dataset.value = option.value;
        optionEl.dataset.index = index;

        if (option.selected) {
            optionEl.classList.add('selected');
        }

        optionEl.addEventListener('click', () => {
            selectOption(wrapper, select, optionEl);
        });

        dropdown.appendChild(optionEl);
    });

    wrapper.appendChild(dropdown);

    // Actualizar texto inicial
    updateSelectedText(select, selectedText);

    // Toggle dropdown al hacer click en trigger
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();

        // Cerrar otros dropdowns abiertos
        document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
            if (w !== wrapper) w.classList.remove('open');
        });

        wrapper.classList.toggle('open');
    });

    // Escuchar cambios en el select original (por si se cambia programaticamente)
    select.addEventListener('change', () => {
        updateSelectedText(select, selectedText);
        updateSelectedOption(wrapper, select);
    });
}

// Seleccionar una opcion
function selectOption(wrapper, select, optionEl) {
    const value = optionEl.dataset.value;
    const index = parseInt(optionEl.dataset.index);

    // Actualizar select original
    select.selectedIndex = index;
    select.dispatchEvent(new Event('change', { bubbles: true }));

    // Actualizar visual
    wrapper.querySelectorAll('.custom-select-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    optionEl.classList.add('selected');

    // Actualizar texto
    const selectedText = wrapper.querySelector('.selected-text');
    updateSelectedText(select, selectedText);

    // Cerrar dropdown
    wrapper.classList.remove('open');
}

// Actualizar texto del trigger
function updateSelectedText(select, textEl) {
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption) {
        textEl.textContent = selectedOption.textContent;
        textEl.classList.toggle('placeholder', !selectedOption.value);
    }
}

// Actualizar opcion seleccionada visualmente
function updateSelectedOption(wrapper, select) {
    const options = wrapper.querySelectorAll('.custom-select-option');
    options.forEach((opt, index) => {
        opt.classList.toggle('selected', index === select.selectedIndex);
    });
}
