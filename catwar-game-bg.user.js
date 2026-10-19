// ==UserScript==
// @name         CatWar: смена фона игры
// @namespace    cw-mod-game-bg
// @version      1.1.1
// @description  Плавающая кнопка на игровой странице: вставь ссылку на картинку — фон игрового поля CatWar заменится на неё. Фон сохраняется между обновлениями страницы. Кнопка «Сбросить» возвращает всё как было.
// @author       cw-mod
// @match        https://catwar.su/cw3*
// @match        https://catwar.net/cw3*
// @updateURL    https://cw-mod.github.io/game-bg-changer/catwar-game-bg.meta.js
// @downloadURL  https://cw-mod.github.io/game-bg-changer/catwar-game-bg.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /* =========================================================
     *  ВНУТРЕННЯЯ РЕАЛИЗАЦИЯ
     * ========================================================= */

    const LS_KEY = 'cw-bg-changer:url';
    const STYLE_ID = 'cw-bg-changer-style';
    const ROOT_ID = 'cw-bg-changer-root';

    // Запоминаем исходные фоны, чтобы вернуть их при сбросе.
    const original = new Map();

    // Игровое поле: #cages_div — фон текущей локации (нарисован на нём же),
    // #cages_overflow и #act — чёрная подложка, вылезающая при отдалении зума.
    const FIELD_SELECTORS = ['#cages_div', '#cages_overflow', '#act'];

    // Фолбэк для других страниц: элементы, на которых обычно живёт фон.
    const FALLBACK_SELECTORS = ['body', '#app', '#game', '#field', 'canvas'];

    function pickTarget() {
        if (document.querySelector('#cages_div')) {
            return FIELD_SELECTORS;
        }
        return FALLBACK_SELECTORS;
    }

    function findTargetElement() {
        if (document.querySelector('#cages_div')) {
            return document.querySelector('#cages_div');
        }
        for (const sel of FALLBACK_SELECTORS) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    }

    function rememberOriginal(selectors) {
        if (original.size !== 0 || currentUrl === '') return;
        selectors.forEach((sel) => {
            const el = document.querySelector(sel);
            if (el) {
                const cs = getComputedStyle(el);
                original.set(sel, {
                    image: cs.backgroundImage,
                    color: cs.backgroundColor,
                });
            }
        });
    }

    let currentUrl = '';

    function buildRule(url, selectors, isField) {
        const attach = isField ? '' : ' fixed';
        if (isField) {
            // Поле: красим фон локации; подложку под ним делаем прозрачной,
            // чтобы при отдалении зума виднелось то же поле.
            return (
                `#cages_div { background: url("${url}") center center / cover no-repeat !important; }` +
                `#cages_overflow, #act { background-color: transparent !important; }`
            );
        }
        return (
            selectors.join(', ') +
            ` { background: url("${url}") center center / cover no-repeat${attach} !important; }`
        );
    }

    let appliedUrl = '';
    let appliedIsField = false;

    function refresh() {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            document.head.appendChild(style);
        }
        if (!appliedUrl) {
            style.textContent = '';
            return;
        }
        const isField = !!document.querySelector('#cages_div');
        const rules = buildRule(appliedUrl, isField ? FIELD_SELECTORS : FALLBACK_SELECTORS, isField);
        // Перепоминание исходников при смене типа цели.
        if (appliedIsField !== isField) {
            rememberOriginal(isField ? FIELD_SELECTORS : FALLBACK_SELECTORS);
            appliedIsField = isField;
        }
        style.textContent = rules;
        appliedIsField = isField;
    }

    function apply(url) {
        if (!url) {
            localStorage.removeItem(LS_KEY);
            currentUrl = '';
            appliedUrl = '';
            const style = document.getElementById(STYLE_ID);
            if (style) style.textContent = '';
            // Восстанавливаем исходные фоны.
            original.forEach((bg, sel) => {
                const el = document.querySelector(sel);
                if (el) {
                    el.style.backgroundImage = bg.image;
                    el.style.backgroundColor = bg.color;
                }
            });
            original.clear();
            return;
        }
        localStorage.setItem(LS_KEY, url);
        currentUrl = url;
        appliedUrl = url;
        const isField = !!document.querySelector('#cages_div');
        if (original.size === 0) {
            rememberOriginal(isField ? FIELD_SELECTORS : FALLBACK_SELECTORS);
            appliedIsField = isField;
        }
        refresh();
    }

    /* ---------- UI ---------- */

    function css() {
        return `
        #${ROOT_ID} { all: initial; font-family: Verdana, Arial, sans-serif; }
        #${ROOT_ID} * { box-sizing: border-box; }

        #${ROOT_ID} .cwbg-btn {
            position: fixed; right: 16px; bottom: 16px; z-index: 2147483646;
            width: 44px; height: 44px; border-radius: 12px;
            background: rgba(34, 34, 40, .85); color: #ffd66e; font-size: 22px;
            border: 1px solid rgba(255, 255, 255, .18); cursor: pointer;
            box-shadow: 0 2px 10px rgba(0, 0, 0, .45);
            display: flex; align-items: center; justify-content: center;
        }
        #${ROOT_ID} .cwbg-btn:hover { background: rgba(52, 52, 60, .95); }

        #${ROOT_ID} .cwbg-popup {
            position: fixed; right: 16px; bottom: 68px; z-index: 2147483647;
            width: 300px; padding: 12px; border-radius: 12px;
            background: rgba(34, 34, 40, .95); color: #eee;
            border: 1px solid rgba(255, 255, 255, .18);
            box-shadow: 0 6px 24px rgba(0, 0, 0, .55);
            display: none; flex-direction: column; gap: 8px;
        }
        #${ROOT_ID} .cwbg-popup.open { display: flex; }

        #${ROOT_ID} .cwbg-title { font-size: 13px; font-weight: bold; color: #ffd66e; }
        #${ROOT_ID} input[type="text"] {
            width: 100%; padding: 6px 8px; border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, .25);
            background: rgba(0, 0, 0, .35); color: #eee; font-size: 12px;
        }
        #${ROOT_ID} .cwbg-preview {
            max-height: 80px; border-radius: 8px; border: 1px solid rgba(255,255,255,.15);
            object-fit: cover; width: 100%; display: none;
        }
        #${ROOT_ID} .cwbg-row { display: flex; gap: 6px; }
        #${ROOT_ID} button.cwbg-act {
            flex: 1; padding: 7px 0; border: none; border-radius: 8px;
            background: #c8a04d; color: #222; font-size: 12px; font-weight: bold; cursor: pointer;
        }
        #${ROOT_ID} button.cwbg-reset { background: #55555f; color: #eee; }
        `;
    }

    function buildUI() {
        const root = document.createElement('div');
        root.id = ROOT_ID;
        root.innerHTML = `
            <button class="cwbg-btn" title="Сменить фон игрового поля">🖼️</button>
            <div class="cwbg-popup">
                <div class="cwbg-title">Фон игрового поля</div>
                <input type="text" placeholder="https://ссылка-на-картинку.jpg" spellcheck="false">
                <img class="cwbg-preview" alt="">
                <div class="cwbg-row">
                    <button class="cwbg-act">Применить</button>
                    <button class="cwbg-reset">Сбросить</button>
                </div>
            </div>
        `;
        const styleNode = document.createElement('style');
        styleNode.textContent = css();
        document.head.appendChild(styleNode);
        document.documentElement.appendChild(root);

        const btn = root.querySelector('.cwbg-btn');
        const popup = root.querySelector('.cwbg-popup');
        const input = root.querySelector('input');
        const preview = root.querySelector('.cwbg-preview');

        btn.addEventListener('click', () => {
            popup.classList.toggle('open');
            if (popup.classList.contains('open')) {
                input.focus();
                if (!input.value) updatePreview();
            }
        });
        document.addEventListener('click', (e) => {
            if (!root.contains(e.target)) popup.classList.remove('open');
        });

        function updatePreview() {
            const url = input.value.trim();
            if (url && /^https?:\/\//.test(url)) {
                preview.src = url;
                preview.style.display = 'block';
            } else {
                preview.removeAttribute('src');
                preview.style.display = 'none';
            }
        }

        input.addEventListener('input', updatePreview);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') apply(input.value.trim());
        });

        root.querySelector('.cwbg-act').addEventListener('click', () => {
            apply(input.value.trim());
        });
        root.querySelector('.cwbg-reset').addEventListener('click', () => {
            input.value = '';
            updatePreview();
            apply('');
        });

        // Возвращаем сохранённый фон. #cages_div появляется асинхронно (игра строит DOM),
        // поэтому подхватываем его повторами, а также следим за случайными сменами цели.
        const saved = localStorage.getItem(LS_KEY);
        if (saved) {
            input.value = saved;
            updatePreview();
            apply(saved);
        }
    }

    buildUI();

    // Периодический refresh: непустой appliedUrl в разные моменты игры
    // переключает правила между "поле" и "фолбэк", если цель исчезла/появилась.
    setInterval(refresh, 2000);
})();
