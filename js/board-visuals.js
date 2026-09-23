/* Shared tile presentation, ready for the P3 tutorial. No engine rules live here. */
const FOOD_TINTS = ['174 112 244','255 198 55','51 210 166','255 113 104','80 168 255'];
let motionPreference = 'system';
const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
function reducedMotion() { return motionPreference === 'reduce' || (motionPreference === 'system' && !!motionQuery?.matches); }
function initMotionSetting() {
    const select = document.getElementById('motion-setting');
    try { const saved = localStorage.getItem('nightmarket-motion'); if (['system','reduce','full'].includes(saved)) motionPreference = saved; } catch (_) {}
    select.value = motionPreference;
    function apply() {
        document.getElementById('game-screen').classList[reducedMotion() ? 'add' : 'remove']('reduce-motion');
        if (reducedMotion()) document.getElementById('fx-layer').innerHTML = '';
    }
    select.addEventListener('change', () => {
        motionPreference = select.value;
        try { localStorage.setItem('nightmarket-motion', motionPreference); } catch (_) {}
        apply();
    });
    if (motionQuery?.addEventListener) motionQuery.addEventListener('change', apply);
    apply();
}
function decorateTile(tile, data, types) {
    if (!data) return;
    const rainbow = data.special === 'color-clear';
    const name = rainbow ? '彩虹棉花糖' : types[data.color].name;
    tile.style.setProperty('--food-tint', rainbow ? '207 141 255' : FOOD_TINTS[data.color]);
    const base = document.createElement('span'); base.className = 'tile-base'; tile.appendChild(base);
    const food = document.createElement('img'); food.className = 'tile-food';
    food.src = rainbow ? 'assets/images/item-marshmallow.webp' : types[data.color].img;
    food.alt = ''; food.draggable = false; tile.appendChild(food);
    const mark = document.createElement('span'); mark.className = 'tile-mark';
    if (data.special) {
        tile.classList.add('special', rainbow ? 'special-color' : 'special-bomb');
        mark.textContent = rainbow ? '✦' : '✹';
        if (!rainbow) {
            const badge = document.createElement('img'); badge.src = 'assets/images/item-takoyaki.webp'; badge.alt = ''; mark.appendChild(badge);
        }
    }
    tile.appendChild(mark);
    const fx = document.createElement('span'); fx.className = 'tile-effect'; tile.appendChild(fx);
    tile.title = name + (data.special === 'bomb' ? '・章魚燒炸彈（3×3）' : '');
    tile.setAttribute('aria-label', tile.title);
}
function clearSpecialEffects() {
    document.getElementById('special-fx-layer').innerHTML = '';
}
function showSpecialEffects(wave, preview) {
    clearSpecialEffects();
    if (!wave) return;
    const layer = document.getElementById('special-fx-layer');
    layer.className = preview ? 'preview' : 'activation';
    const wrap = boardWrap.getBoundingClientRect();
    function box(pos, kind) {
        const tile = boardElement.querySelector('[data-row="'+pos.r+'"][data-col="'+pos.c+'"]');
        if (!tile) return;
        const rect = tile.getBoundingClientRect(), el = document.createElement('span');
        el.className = 'effect-cell ' + kind; el.dataset.row = pos.r; el.dataset.col = pos.c;
        // Absolute children use the padding edge, while DOMRect includes the border.
        el.style.left = (rect.left-wrap.left-(boardWrap.clientLeft || 0))+'px';
        el.style.top = (rect.top-wrap.top-(boardWrap.clientTop || 0))+'px';
        el.style.width = rect.width+'px'; el.style.height = rect.height+'px'; layer.appendChild(el);
    }
    if (wave.effects?.length) {
        wave.cells.forEach(p => box(p, 'target'));
        const connected = new Set();
        // At most 64 lines across all sources; cell highlights always show the full union.
        for (const effect of wave.effects) {
            box(effect, effect.special === 'bomb' ? 'bomb-source' : 'color-source');
            if (effect.special === 'bomb') continue;
            const a = getTileCenter(effect.r,effect.c);
            for (const p of effect.cells) {
                const key = p.r+','+p.c; if (connected.has(key)) continue; connected.add(key);
                const b = getTileCenter(p.r,p.c), line = document.createElement('span');
                line.className = 'effect-line';
                line.style.left = (a.x-(boardWrap.clientLeft || 0))+'px'; line.style.top = (a.y-(boardWrap.clientTop || 0))+'px';
                line.style.width = Math.hypot(b.x-a.x,b.y-a.y)+'px';
                line.style.transform = 'rotate('+Math.atan2(b.y-a.y,b.x-a.x)+'rad)'; layer.appendChild(line);
            }
        }
    }
    if (!preview) (wave.generated || []).forEach(p => box(p,'generated'));
}
