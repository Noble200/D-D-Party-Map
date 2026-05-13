// ==========================================
// Dock de Acciones del Jugador
// Panel inferior tipo MMO con TODOS los items del personaje,
// donde el jugador marca con ★ los que quiere destacar como favoritos.
// ==========================================

import { SKILL_ABILITIES } from '../config.js';

class ActionDock {
    constructor(app) {
        this.app = app;
        this.root = document.getElementById('actionDock');
        this.sectionsEl = document.getElementById('actionDockSections');
        this.toggleBtn = document.getElementById('actionDockToggle');
        this.expanded = true;
        this.initialized = false;

        // Estado de las secciones (plegadas o no)
        this.collapsedSections = new Set();

        // Callbacks (asignados desde PlayerView)
        this.onActivateCantrip = null;
        this.onActivateSpell = null;
        this.onActivateTrait = null;
        this.onActivateSkillRoll = null;
        this.onActivateSaveRoll = null;
        this.onRest = null;
    }

    init() {
        if (this.initialized || !this.root) return;
        this.bindEvents();

        // Refrescar cuando cambian favoritos o se carga personaje
        document.addEventListener('favorites-changed', () => this.render());
        document.addEventListener('character-loaded', () => this.render());

        this.initialized = true;
    }

    bindEvents() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggleExpanded());
        }

        // Botones de descanso
        this.root.querySelectorAll('.action-dock-rest').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const restType = e.currentTarget.dataset.rest;
                if (typeof this.onRest === 'function') {
                    this.onRest(restType);
                }
            });
        });
    }

    show() {
        if (!this.root) return;
        this.root.hidden = false;
        this.render();
    }

    hide() {
        if (this.root) this.root.hidden = true;
    }

    toggleExpanded() {
        this.expanded = !this.expanded;
        this.root.classList.toggle('action-dock-collapsed', !this.expanded);
        const arrow = this.toggleBtn?.querySelector('.action-dock-toggle-arrow');
        if (arrow) arrow.textContent = this.expanded ? '▾' : '▴';
    }

    // Render principal: muestra TODOS los items del personaje
    render() {
        if (!this.sectionsEl) return;

        const sheet = this.app.characterSheet;
        if (!sheet) {
            this.sectionsEl.innerHTML = '<div class="action-dock-empty">Sin personaje cargado</div>';
            return;
        }

        const groups = sheet.getAllDockItems ? sheet.getAllDockItems() : null;
        if (!groups) {
            this.sectionsEl.innerHTML = '<div class="action-dock-empty">No se pudieron cargar los datos del personaje.</div>';
            return;
        }

        // Ordenar favoritos primero dentro de cada lista
        const favFirst = (a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);

        let html = '';

        // Trucos
        if (groups.cantrips.length > 0) {
            const sorted = [...groups.cantrips].sort(favFirst);
            html += this.renderSection('cantrips', 'Trucos', sorted.map(c => this.renderCantripCard(c)).join(''));
        }

        // Conjuros por nivel
        const spellLevels = Object.keys(groups.spells).sort((a, b) => parseInt(a) - parseInt(b));
        spellLevels.forEach(lvl => {
            const sorted = [...groups.spells[lvl]].sort(favFirst);
            html += this.renderSection(`spells-${lvl}`, `Conjuros Nv${lvl}`, sorted.map(s => this.renderSpellCard(s)).join(''));
        });

        // Rasgos
        if (groups.traits.length > 0) {
            const sorted = [...groups.traits].sort(favFirst);
            html += this.renderSection('traits', 'Rasgos', sorted.map(t => this.renderTraitCard(t)).join(''));
        }

        // Tiradas rápidas
        if (groups.quickRolls.length > 0) {
            const sorted = [...groups.quickRolls].sort(favFirst);
            html += this.renderSection('quickRolls', 'Tiradas rápidas', sorted.map(q => this.renderQuickRollCard(q)).join(''));
        }

        if (!html) {
            html = '<div class="action-dock-empty">No tenés trucos, conjuros, rasgos ni habilidades configuradas. Abrí la ficha y agregalos primero.</div>';
        }

        this.sectionsEl.innerHTML = html;
        this.bindCardEvents();
        this.bindSectionToggles();
    }

    renderSection(key, title, cardsHtml) {
        const collapsed = this.collapsedSections.has(key);
        return `
            <div class="dock-section ${collapsed ? 'dock-section-collapsed' : ''}" data-section="${key}">
                <button type="button" class="dock-section-header">
                    <span class="dock-section-arrow">${collapsed ? '▸' : '▾'}</span>
                    <span class="dock-section-title">${title}</span>
                </button>
                <div class="dock-section-cards">
                    ${cardsHtml}
                </div>
            </div>
        `;
    }

    // ===== Cards =====

    renderCantripCard(item) {
        const school = item.data?.school || '';
        return this.wrapCard(
            'cantrip',
            { id: item.id },
            ['dock-card-cantrip', item.favorite ? 'is-favorite' : ''],
            'Tr',
            item.name,
            school,
            null,
            item.favorite
        );
    }

    renderSpellCard(item) {
        const level = item.level || 1;
        const school = item.data?.school || '';
        return this.wrapCard(
            'spell',
            { id: item.id, level },
            ['dock-card-spell', `dock-card-spell-lvl${level}`, item.favorite ? 'is-favorite' : ''],
            `C${level}`,
            item.name,
            school,
            null,
            item.favorite
        );
    }

    renderTraitCard(item) {
        const isActive = item.isActive;
        const cls = isActive ? 'dock-card-trait-active' : 'dock-card-trait-passive';
        const tag = isActive ? 'Ra' : 'Pa';

        // Contador si tiene usos definidos
        const sheet = this.app.characterSheet;
        const uses = sheet?.abilityUses?.[item.id];
        const extraHtml = uses ? `<span class="dock-card-counter">${uses.current}/${uses.max}</span>` : '';

        const favType = item.type === 'custom-ability' ? 'custom-ability' : 'trait';

        return this.wrapCard(
            'trait',
            { id: item.id, active: isActive ? '1' : '0', favType },
            ['dock-card-trait', cls, item.favorite ? 'is-favorite' : ''],
            tag,
            item.name,
            item.data?.description || '',
            extraHtml,
            item.favorite
        );
    }

    renderQuickRollCard(item) {
        const isSkill = item.type === 'skill';
        const tag = isSkill ? 'Hb' : 'Sv';

        const bonus = this.calculateRollBonus(item);
        const bonusStr = bonus >= 0 ? `+${bonus}` : `${bonus}`;
        const bonusHtml = `<span class="dock-card-bonus">${bonusStr}</span>`;

        return this.wrapCard(
            isSkill ? 'skill' : 'save',
            { id: item.id, bonus },
            ['dock-card-quickroll', item.favorite ? 'is-favorite' : ''],
            tag,
            item.name,
            '',
            bonusHtml,
            item.favorite
        );
    }

    // Helper para construir una card uniforme con su botón ★
    wrapCard(action, data, classes, tag, name, tooltip, extraHtml, isFav) {
        const dataAttrs = Object.entries(data)
            .map(([k, v]) => `data-${k}="${this.escape(String(v))}"`)
            .join(' ');
        const safeTooltip = tooltip ? `title="${this.escape(tooltip)}"` : '';
        const starClass = isFav ? 'dock-card-star is-fav' : 'dock-card-star';
        const starChar = isFav ? '★' : '☆';

        return `
            <div class="dock-card ${classes.filter(Boolean).join(' ')}" data-action="${action}" ${dataAttrs} ${safeTooltip}>
                <span class="dock-card-tag">${tag}</span>
                <span class="dock-card-name">${this.escape(name)}</span>
                ${extraHtml || ''}
                <button type="button" class="${starClass}" data-fav-action="${action}" data-fav-id="${this.escape(data.id)}" ${data.level !== undefined ? `data-fav-level="${data.level}"` : ''} title="${isFav ? 'Quitar de favoritos' : 'Marcar como favorito'}">${starChar}</button>
            </div>
        `;
    }

    // Calcula el bonus de un skill o save desde la ficha de personaje
    calculateRollBonus(item) {
        const sheet = this.app.characterSheet;
        if (!sheet) return 0;

        const data = sheet.getCharacterData ? sheet.getCharacterData() : sheet.characterData;
        if (!data) return 0;

        const abilities = data.abilities || {};
        const level = data.level || 1;
        const profBonus = Math.floor((level - 1) / 4) + 2;

        let ability, isProficient = false, hasExpertise = false;

        if (item.type === 'skill') {
            ability = SKILL_ABILITIES[item.id];
            const skillData = data.skills?.[item.id];
            isProficient = !!skillData?.proficient;
            hasExpertise = !!skillData?.expertise;
        } else if (item.type === 'save') {
            ability = item.id;
            isProficient = !!data.savingThrows?.[item.id];
        }

        if (!ability) return 0;

        const score = abilities[ability] || 10;
        const mod = Math.floor((score - 10) / 2);

        let bonus = mod;
        if (isProficient) bonus += profBonus;
        if (hasExpertise) bonus += profBonus;

        return bonus;
    }

    bindCardEvents() {
        // Click en ★: toggle favorito (sin activar acción)
        this.sectionsEl.querySelectorAll('.dock-card-star').forEach(star => {
            star.addEventListener('click', (e) => {
                e.stopPropagation();
                const sheet = this.app.characterSheet;
                if (!sheet) return;

                const action = star.dataset.favAction;
                const id = star.dataset.favId;
                let favType = action;
                if (action === 'cantrip' || action === 'spell' || action === 'trait') {
                    favType = action;
                }
                // Para custom-ability (trucos/spells/traits personalizados) detectar por el parent
                const card = star.closest('.dock-card');
                if (card?.dataset.favType === 'custom-ability') {
                    favType = 'custom-ability';
                }
                const extra = {};
                if (star.dataset.favLevel !== undefined) extra.level = parseInt(star.dataset.favLevel);
                sheet.toggleFavorite(favType, id, extra);
                // El render se dispara por el evento 'favorites-changed'
            });
        });

        // Click en el resto del card: ejecutar acción
        this.sectionsEl.querySelectorAll('.dock-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Si el click vino del botón ★, ya fue manejado arriba
                if (e.target.classList.contains('dock-card-star')) return;

                const action = card.dataset.action;
                const id = card.dataset.id;
                switch (action) {
                    case 'cantrip':
                        this.onActivateCantrip?.(id, card);
                        break;
                    case 'spell':
                        this.onActivateSpell?.(id, parseInt(card.dataset.level), card);
                        break;
                    case 'trait':
                        this.onActivateTrait?.(id, card.dataset.active === '1', card);
                        break;
                    case 'skill':
                        this.onActivateSkillRoll?.(id, parseInt(card.dataset.bonus), card);
                        break;
                    case 'save':
                        this.onActivateSaveRoll?.(id, parseInt(card.dataset.bonus), card);
                        break;
                }
            });
        });
    }

    bindSectionToggles() {
        this.sectionsEl.querySelectorAll('.dock-section-header').forEach(header => {
            header.addEventListener('click', () => {
                const section = header.parentElement;
                const key = section.dataset.section;
                if (this.collapsedSections.has(key)) {
                    this.collapsedSections.delete(key);
                } else {
                    this.collapsedSections.add(key);
                }
                section.classList.toggle('dock-section-collapsed');
                const arrow = header.querySelector('.dock-section-arrow');
                if (arrow) arrow.textContent = section.classList.contains('dock-section-collapsed') ? '▸' : '▾';
            });
        });
    }

    escape(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

export { ActionDock };
