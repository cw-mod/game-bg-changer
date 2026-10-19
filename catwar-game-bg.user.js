// ==UserScript==
// @name         CatWar: смена фона игры
// @namespace    cw-mod-game-bg
// @version      1.0.0
// @description  Плавающая кнопка на игровой странице: вставь ссылку на картинку — фон игры CatWar заменится на неё. Фон сохраняется между обновлениями страницы. Кнопка «Сбросить» возвращает всё как было.
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

    const TARGETS = ['body', '#app', '#game', '#field', 'canvas'];

    function apply(url) {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            document.head.appendChild(style);
        }
        if (!url) {
            restore();
            return;
        }
        localStorage.setItem(LS_KEY, url);
        // Запоминаем фон только при первой установке (до изменений).
        if (original.size === 0) {
            TARGETS.forEach((sel) => {
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
        // Заменяем фон игрового поля. Фиксированное прикрепление, чтобы не расползалось при скролле лога.
        style.textContent =
            TARGETS.join(', ') +
            ` { background: url("${url}") center center / cover no-repeat fixed !important; }`;
    }

    function restore() {
        localStorage.removeItem(LS_KEY);
        const style = document.getElementById(STYLE_ID);
        if (style) style.textContent = '';
        original.forEach((bg, sel) => {
            const el = document.querySelector(sel);
            if (el) {
                el.style.backgroundImage = bg.image;
                el.style.backgroundColor = bg.color;
            }
        });
        original.clear();
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
        #${ROOT_ID} .cwbg-note { font-size: 11px; color: #999; line-height: 1.35; }
        `;
    }

    function buildUI() {
        const root = document.createElement('div');
        root.id = ROOT_ID;
        root.innerHTML = `
            <button class="cwbg-btn" title="Сменить фон игры">🖼️</button>
            <div class="cwbg-popup">
                <div class="cwbg-title">Фон игры CatWar</div>
                <input type="text" placeholder="https://ссылка-на-картинку.jpg" spellcheck="false">
                <img class="cwbg-preview" alt="">
                <div class="cwbg-row">
                    <button class="cwbg-act">Применить</button>
                    <button class="cwbg-act cwbg-reset">Сбросить</button>
                </div>
                <div class="cwbg-note">Ссылка на любое изображение (jpg/png/gif/webp). Фон сохраняется для этого сайта.</div>
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

        function onInput() { updatePreview(); }
        input.addEventListener('input', onInput);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') apply(input.value.trim());
        });

        root.querySelector('.cwbg-act').addEventListener('click', () => {
            apply(input.value.trim());
        });
        root.querySelector('.cwbg-reset').addEventListener('click', () => {
            input.value = '';
            updatePreview();
            restore();
        });

        // Возвращаем сохранённый фон
        const saved = localStorage.getItem(LS_KEY);
        if (saved) {
            input.value = saved;
            updatePreview();
            requestAnimationFrame(() => apply(saved));
        }
    }

    buildUI();
})();
