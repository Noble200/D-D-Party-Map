// ==========================================
// Dock de Acciones del Jugador
// Panel inferior tipo MMO con favoritos del personaje
// ==========================================

import { SKILL_ABILITIES, SKILL_NAMES_ES } from '../config.js';

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

        // Callbacks que la PlayerView puede asignar para ejecutar acciones reales
        // (se implementan en fases siguientes)
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

        // Escuchar cambios de favoritos desde la ficha de personaje
        document.addEventListener('favorites-changed', () => this.render());
        document.addEventListener('character-loaded', () => this.render());

        this.initialized = true;
    }

    bindEvents() {
        // Toggle expandir/colapsar
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

    // Render principal: lee favoritos de la ficha y renderiza secciones
    render() {
        if (!this.sectionsEl) return;

        const sheet = this.app.characterSheet;
        if (!sheet) {
            this.sectionsEl.innerHTML = '<div class="action-dock-empty">Sin personaje cargado</div>';
            return;
        }

        const groups = sheet.getFavoritesData ? sheet.getFavoritesData() : null;
        if (!groups) {
            this.sectionsEl.innerHTML = '<div class="action-dock-empty">Sin favoritos. Abre la ficha y marca con ★ los conjuros, rasgos o habilidades que quieras tener a mano.</div>';
            return;
        }

        // Construir secciones en orden
        let html = '';

        // Trucos
        if (groups.cantrips.length > 0) {
            html += this.renderSection('cantrips', 'Trucos', groups.cantrips.map(c => this.renderCantripCard(c)).join(''));
        }

        // Conjuros por nivel
        const spellLevels = Object.keys(groups.spells).sort((a, b) => parseInt(a) - parseInt(b));
        spellLevels.forEach(lvl => {
            const sectionKey = `spells-${lvl}`;
            const cards = groups.spells[lvl].map(s => this.renderSpellCard(s)).join('');
            html += this.renderSection(sectionKey, `Conjuros Nv${lvl}`, cards);
        });

        // Rasgos (activos y pasivos juntos pero diferenciados visualmente)
        if (groups.traits.length > 0) {
            const cards = groups.traits.map(t => this.renderTraitCard(t)).join('');
            html += this.renderSection('traits', 'Rasgos', cards);
        }

        // Tiradas rápidas (skill + save)
        if (groups.quickRolls.length > 0) {
            const cards = groups.quickRolls.map(q => this.renderQuickRollCard(q)).join('');
            html += this.renderSection('quickRolls', 'Tiradas rápidas', cards);
        }

        if (!html) {
            html = '<div class="action-dock-empty">Sin favoritos. Abre la ficha y marca con ★ los conjuros, rasgos o habilidades que quieras tener a mano.</div>';
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

    // Card de un truco
    renderCantripCard(item) {
        const school = item.data?.school || '';
        return `
            <div class="dock-card dock-card-cantrip" data-action="cantrip" data-id="${item.id}" title="${this.escape(school)}">
                <span class="dock-card-tag">Tr</span>
                <span class="dock-card-name">${this.escape(item.name)}</span>
            </div>
        `;
    }

    // Card de un conjuro (con nivel para estilizar por intensidad)
    renderSpellCard(item) {
        const level = item.level || 1;
        const school = item.data?.school || '';
        return `
            <div class="dock-card dock-card-spell dock-card-spell-lvl${level}" data-action="spell" data-id="${item.id}" data-level="${level}" title="${this.escape(school)}">
                <span class="dock-card-tag">C${level}</span>
                <span class="dock-card-name">${this.escape(item.name)}</span>
            </div>
        `;
    }

    // Card de un rasgo (activo o pasivo)
    renderTraitCard(item) {
        const isActive = item.isActive;
        const cls = isActive ? 'dock-card-trait-active' : 'dock-card-trait-passive';
        const tag = isActive ? 'Ra' : 'Pa';

        // Contador si tiene usos definidos
        const sheet = this.app.characterSheet;
        const uses = sheet?.abilityUses?.[item.id];
        const counterHtml = uses
            ? `<span class="dock-card-counter">${uses.current}/${uses.max}</span>`
            : '';

        return `
            <div class="dock-card dock-card-trait ${cls}" data-action="trait" data-id="${item.id}" data-active="${isActive ? '1' : '0'}" title="${this.escape(item.data?.description || '')}">
                <span class="dock-card-tag">${tag}</span>
                <span class="dock-card-name">${this.escape(item.name)}</span>
                ${counterHtml}
            </div>
        `;
    }

    // Card de una tirada rápida (skill o save)
    renderQuickRollCard(item) {
        const isSkill = item.type === 'skill';
        const tag = isSkill ? 'Hb' : 'Sv';
        const action = isSkill ? 'skill' : 'save';

        // Calcular bonus desde la ficha
        const bonus = this.calculateRollBonus(item);
        const bonusStr = bonus >= 0 ? `+${bonus}` : `${bonus}`;

        return `
            <div class="dock-card dock-card-quickroll" data-action="${action}" data-id="${item.id}" data-bonus="${bonus}">
                <span class="dock-card-tag">${tag}</span>
                <span class="dock-card-name">${this.escape(item.name)}</span>
                <span class="dock-card-bonus">${bonusStr}</span>
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
        if (hasExpertise) bonus += profBonus; // experticia duplica

        return bonus;
    }

    bindCardEvents() {
        this.sectionsEl.querySelectorAll('.dock-card').forEach(card => {
            card.addEventListener('click', (e) => {
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
