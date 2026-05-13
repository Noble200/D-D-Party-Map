// ==========================================
// Dock de Acciones del Jugador
// Patrón: mapa al 100% + 4 triggers flotantes + drawers + barra quick-favs.
// ==========================================

import { SKILL_ABILITIES } from '../config.js';

class ActionDock {
    constructor(app) {
        this.app = app;
        this.root = document.getElementById('actionDock');
        this.initialized = false;

        // Estado: qué drawer está abierto (null si ninguno)
        this.activeDrawer = null;

        this.triggers = {
            pasivas:  document.getElementById('triggerPasivas'),
            activas:  document.getElementById('triggerActivas'),
            conjuros: document.getElementById('triggerConjuros'),
            tiradas:  document.getElementById('triggerTiradas'),
        };
        this.drawers = {
            pasivas:  document.getElementById('drawerPasivas'),
            activas:  document.getElementById('drawerActivas'),
            conjuros: document.getElementById('drawerConjuros'),
            tiradas:  document.getElementById('drawerTiradas'),
        };
        this.drawerContents = {
            pasivas:  document.getElementById('drawerPasivasContent'),
            activas:  document.getElementById('drawerActivasContent'),
            conjuros: document.getElementById('drawerConjurosContent'),
            tiradas:  document.getElementById('drawerTiradasContent'),
        };
        this.quickFavsContent = document.getElementById('quickFavsContent');

        // Callbacks asignados desde PlayerView
        this.onActivateCantrip   = null;
        this.onActivateSpell     = null;
        this.onActivateTrait     = null;
        this.onActivateSkillRoll = null;
        this.onActivateSaveRoll  = null;
        this.onRest              = null;
    }

    init() {
        if (this.initialized || !this.root) return;

        // Triggers abren su drawer correspondiente
        Object.entries(this.triggers).forEach(([key, btn]) => {
            if (!btn) return;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDrawer(key);
            });
        });

        // Botones de descanso (dentro del drawer Activas)
        this.root.querySelectorAll('.drawer-rest-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const restType = e.currentTarget.dataset.rest;
                if (typeof this.onRest === 'function') this.onRest(restType);
            });
        });

        // Click fuera (en el canvas del mapa) cierra drawers
        const canvas = document.getElementById('playerMapCanvas');
        if (canvas) {
            canvas.addEventListener('mousedown', () => this.closeAllDrawers());
        }

        // Esc también cierra drawers
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeDrawer) this.closeAllDrawers();
        });

        // Refrescar al cargar/cambiar personaje o favoritos
        document.addEventListener('favorites-changed', () => this.render());
        document.addEventListener('character-loaded', () => this.render());

        this.initialized = true;
    }

    show() {
        if (!this.root) return;
        this.root.hidden = false;
        this.render();
    }

    hide() {
        if (this.root) this.root.hidden = true;
        this.closeAllDrawers();
    }

    toggleDrawer(key) {
        if (this.activeDrawer === key) {
            this.closeAllDrawers();
            return;
        }
        this.closeAllDrawers();
        this.activeDrawer = key;
        this.drawers[key]?.classList.add('open');
        this.triggers[key]?.classList.add('active');
    }

    closeAllDrawers() {
        this.activeDrawer = null;
        Object.values(this.drawers).forEach(d => d?.classList.remove('open'));
        Object.values(this.triggers).forEach(t => t?.classList.remove('active'));
    }

    // ==========================================
    // Render
    // ==========================================
    render() {
        const sheet = this.app.characterSheet;
        if (!sheet || !sheet.getAllDockItems) {
            this.renderEmpty('Sin personaje cargado');
            return;
        }

        const groups = sheet.getAllDockItems();
        const favFirst = (a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);

        // Pasivas
        const pasivas = groups.traits.filter(t => !t.isActive).sort(favFirst);
        this.renderList(this.drawerContents.pasivas, pasivas.map(t => this.renderTraitCard(t)));

        // Activas
        const activas = groups.traits.filter(t => t.isActive).sort(favFirst);
        this.renderList(this.drawerContents.activas, activas.map(t => this.renderTraitCard(t)));

        // Conjuros (trucos + conjuros por nivel)
        this.renderConjuros(groups.cantrips, groups.spells, favFirst);

        // Tiradas (skills + saves)
        const tiradas = [...groups.quickRolls].sort(favFirst);
        this.renderList(this.drawerContents.tiradas, tiradas.map(q => this.renderQuickRollCard(q)));

        // Quick-favs bar
        this.renderQuickFavs();

        // Bind eventos a las cards renderizadas
        this.bindCardEvents();
    }

    renderEmpty(msg) {
        Object.values(this.drawerContents).forEach(c => {
            if (c) c.innerHTML = `<div class="drawer-empty">${this.escape(msg)}</div>`;
        });
        if (this.quickFavsContent) {
            this.quickFavsContent.innerHTML = '<span class="quick-favs-empty">Sin personaje</span>';
        }
    }

    renderList(container, cardsHtml) {
        if (!container) return;
        if (cardsHtml.length === 0) {
            container.innerHTML = '<div class="drawer-empty">Vacío</div>';
            return;
        }
        container.innerHTML = cardsHtml.join('');
    }

    renderConjuros(cantrips, spells, favFirst) {
        const container = this.drawerContents.conjuros;
        if (!container) return;

        let html = '';

        if (cantrips.length > 0) {
            const sorted = [...cantrips].sort(favFirst);
            html += `<div class="drawer-subsection">
                <div class="drawer-subsection-title">Trucos</div>
                ${sorted.map(c => this.renderCantripCard(c)).join('')}
            </div>`;
        }

        const levels = Object.keys(spells).sort((a, b) => parseInt(a) - parseInt(b));
        levels.forEach(lvl => {
            const sorted = [...spells[lvl]].sort(favFirst);
            html += `<div class="drawer-subsection">
                <div class="drawer-subsection-title">Nivel ${lvl}</div>
                ${sorted.map(s => this.renderSpellCard(s)).join('')}
            </div>`;
        });

        if (!html) html = '<div class="drawer-empty">No conoces conjuros</div>';
        container.innerHTML = html;
    }

    // ==========================================
    // Renderers de cards individuales
    // ==========================================
    renderCantripCard(item) {
        const school = item.data?.school || '';
        const favType = item.type === 'custom-ability' ? 'custom-ability' : 'cantrip';
        return this.wrapCard(
            'cantrip',
            { id: item.id, favType },
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
        const favType = item.type === 'custom-ability' ? 'custom-ability' : 'spell';
        return this.wrapCard(
            'spell',
            { id: item.id, level, favType },
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
        const favType = item.type === 'custom-ability' ? 'custom-ability' : 'trait';

        const sheet = this.app.characterSheet;
        const uses = sheet?.abilityUses?.[item.id];
        const extraHtml = uses ? `<span class="dock-card-counter">${uses.current}/${uses.max}</span>` : '';

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
            { id: item.id, bonus, favType: isSkill ? 'skill' : 'save' },
            ['dock-card-quickroll', item.favorite ? 'is-favorite' : ''],
            tag,
            item.name,
            '',
            bonusHtml,
            item.favorite
        );
    }

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
                <button type="button" class="${starClass}" title="${isFav ? 'Quitar de favoritos' : 'Marcar como favorito'}">${starChar}</button>
            </div>
        `;
    }

    // ==========================================
    // Quick-favs bar (siempre visible)
    // ==========================================
    renderQuickFavs() {
        if (!this.quickFavsContent) return;
        const sheet = this.app.characterSheet;
        const favs = sheet?.favorites || [];

        if (favs.length === 0) {
            this.quickFavsContent.innerHTML = '<span class="quick-favs-empty">Sin favoritos</span>';
            return;
        }

        const MAX_VISIBLE = 6;
        const visible = favs.slice(0, MAX_VISIBLE);
        const overflow = favs.length - visible.length;

        const chipsHtml = visible.map(fav => {
            const resolved = sheet.resolveFavorite(fav);
            if (!resolved) return '';
            const tag = this.tagForFav(fav);
            return `
                <button type="button" class="quick-fav-chip"
                    data-fav-type="${this.escape(fav.type)}"
                    data-fav-id="${this.escape(fav.id)}"
                    ${fav.level !== undefined ? `data-fav-level="${fav.level}"` : ''}
                    title="${this.escape(resolved.name)}">
                    <span class="quick-fav-chip-tag">${tag}</span>${this.escape(resolved.name)}
                </button>
            `;
        }).join('');

        const moreHtml = overflow > 0 ? `<span class="quick-favs-more">+${overflow}</span>` : '';
        this.quickFavsContent.innerHTML = chipsHtml + moreHtml;
    }

    // Tag corto según el tipo de favorito
    tagForFav(fav) {
        switch (fav.type) {
            case 'cantrip': return 'Tr';
            case 'spell':   return `C${fav.level || 1}`;
            case 'trait':   return 'Ra';
            case 'custom-ability': return 'Cu';
            case 'skill':   return 'Hb';
            case 'save':    return 'Sv';
            default:        return '·';
        }
    }

    // Calcula bonus para skill/save desde la ficha
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
            const sd = data.skills?.[item.id];
            isProficient = !!sd?.proficient;
            hasExpertise = !!sd?.expertise;
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

    // ==========================================
    // Bindings de eventos en cards y chips
    // ==========================================
    bindCardEvents() {
        // Estrellas dentro de cards: toggle favorito
        this.root.querySelectorAll('.dock-card-star').forEach(star => {
            star.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = star.closest('.dock-card');
                if (!card) return;
                const sheet = this.app.characterSheet;
                if (!sheet) return;

                const favType = card.dataset.favType || card.dataset.action;
                const id = card.dataset.id;
                const extra = {};
                if (card.dataset.level !== undefined) extra.level = parseInt(card.dataset.level);
                sheet.toggleFavorite(favType, id, extra);
                // Re-render lo dispara el evento 'favorites-changed'
            });
        });

        // Click en el cuerpo del card: ejecutar acción
        this.root.querySelectorAll('.dock-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('dock-card-star')) return;
                this.activateCard(card);
            });
        });

        // Click en chip de quick-favs: ejecutar acción
        this.quickFavsContent?.querySelectorAll('.quick-fav-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                this.activateFavChip(chip);
            });
        });
    }

    // Resuelve una card y dispara la acción correspondiente
    activateCard(card) {
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
    }

    // Resuelve un chip de favoritos y dispara la acción
    activateFavChip(chip) {
        const type = chip.dataset.favType;
        const id = chip.dataset.favId;
        const level = chip.dataset.favLevel !== undefined ? parseInt(chip.dataset.favLevel) : null;
        const sheet = this.app.characterSheet;
        if (!sheet) return;

        switch (type) {
            case 'cantrip':
                this.onActivateCantrip?.(id, chip);
                break;
            case 'spell':
                this.onActivateSpell?.(id, level, chip);
                break;
            case 'trait': {
                // Necesitamos saber si es activo: buscar en getAllDockItems
                const groups = sheet.getAllDockItems();
                const trait = groups.traits.find(t => t.id === id);
                const isActive = trait ? !!trait.isActive : false;
                this.onActivateTrait?.(id, isActive, chip);
                break;
            }
            case 'custom-ability': {
                // Buscar en customAbilities para saber categoría
                const custom = (sheet.customAbilities || []).find(a => a.id === id);
                if (!custom) return;
                if (custom.category === 'cantrip') {
                    this.onActivateCantrip?.(id, chip);
                } else if (custom.category === 'spell') {
                    this.onActivateSpell?.(id, custom.level || 1, chip);
                } else {
                    this.onActivateTrait?.(id, custom.type === 'active', chip);
                }
                break;
            }
            case 'skill': {
                const bonus = this.calculateRollBonus({ type: 'skill', id });
                this.onActivateSkillRoll?.(id, bonus, chip);
                break;
            }
            case 'save': {
                const bonus = this.calculateRollBonus({ type: 'save', id });
                this.onActivateSaveRoll?.(id, bonus, chip);
                break;
            }
        }
    }

    escape(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

export { ActionDock };
