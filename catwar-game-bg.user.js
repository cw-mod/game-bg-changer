// ==UserScript==
// @name         CatWar: смена фона игры
// @namespace    cw-mod-game-bg
// @version      1.2.0
// @description  Плавающая кнопка: вставь ссылку на картинку — фон игрового поля CatWar заменится на неё. Дополнительно: галочка «взять картинку из ЛС» — скрипт сам найдёт диалог отправителя и возьмёт картинку из его личного сообщения.
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

    // Отправитель, чьё ЛС используется как источник картинки.
    const LS_SENDER = 'Млечный Путь';

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

    /* =========================================================
     *  ПАРСИНГ КАРТИНКИ ИЗ ЛС
     * ========================================================= */

    const AJAX_HEADERS = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
    };

    function post(url, data) {
        return fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: AJAX_HEADERS,
            body: data,
        }).then((r) => r.json());
    }

    // Список диалогов (входящие). Возвращает массив {id, login, subject}.
    async function fetchDialogs() {
        const out = [];
        for (let page = 1; page <= 5; page++) {
            const data = await post('/ajax/mess_folder', 'folder=0&page=' + page + '&del=0');
            const list = data && Array.isArray(data.msg) ? data.msg : [];
            if (!list.length) break;
            list.forEach((m) =>
                out.push({
                    id: String(m.id),
                    login: m.login || m['6'] || '',
                    subject: m.subject || m['4'] || '',
                    time: m.time || m['3'] || '',
                })
            );
            if (list.length < 20) break;
        }
        return out;
    }

    // Текст сообщения (HTML) по id диалога.
    async function fetchMessageHtml(dialogId) {
        const data = await post('/ajax/mess_show', 'id=' + encodeURIComponent(dialogId));
        if (!data || data.fail) throw new Error('диалог не найден');
        const html = (data.msg && (data.msg.text || data.msg['text'])) || '';
        return String(html);
    }

    // Достаём из HTML сообщения картинки и выбираем самую "сюжетную".
    function pickImageFromHtml(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const imgs = [...doc.querySelectorAll('img')].map((i) => i.getAttribute('src')).filter(Boolean);

        // Отсекаем служебные картинки сайта (иконки, смайлы, аватарчики, svg).
        const isService = (src) =>
            /\/img\/|\/css\/|smile|emoji|avatar|\.svg($|\?)/i.test(src);

        const candidates = imgs.filter((src) => !isService(src));
        const pool = candidates.length ? candidates : imgs;
        if (!pool.length) return null;

        // Предпочитаем растр (jpg/png/jpeg/webp), он обычно и есть картинка локации.
        const raster = pool.filter((src) => /\.(jpe?g|png|webp|gif)($|\?)/i.test(src));
        const chosen = (raster.length ? raster : pool)[0];

        // Относительные ссылки приводим к абсолютным.
        try {
            return new URL(chosen, location.origin).href;
        } catch (e) {
            return chosen;
        }
    }

    // Полный сценарий: найти диалог отправителя и достать из него картинку.
    async function fetchImageFromLs(senderName) {        const dialogs = await fetchDialogs();
        if (!dialogs.length) throw new Error('нет диалогов');

        let dialog = null;
        const want = (senderName || '').trim().toLowerCase();
        if (want) {
            dialog = dialogs.find((d) => (d.login || '').toLowerCase() === want);
            if (!dialog) {
                dialog = dialogs.find((d) => (d.login || '').toLowerCase().includes(want));
            }
        } else {
            dialog = dialogs[0];
        }
        if (!dialog) throw new Error('диалог от «' + senderName + '» не найден');

        const html = await fetchMessageHtml(dialog.id);
        const url = pickImageFromHtml(html);
        if (!url) throw new Error('в ЛС «' + dialog.login + '» нет картинок');
        return { url, dialog };
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
        #${ROOT_ID} .cwbg-ls {
            display: flex; align-items: center; gap: 6px; font-size: 12px; color: #ddd;
            cursor: pointer; user-select: none;
        }
        #${ROOT_ID} .cwbg-ls input { width: 14px; height: 14px; accent-color: #c8a04d; }
        #${ROOT_ID} .cwbg-lsrow { display: none; flex-direction: column; gap: 6px; }
        #${ROOT_ID} .cwbg-lsrow.open { display: flex; }
        #${ROOT_ID} .cwbg-status { font-size: 11px; color: #9ad; line-height: 1.35; }
        #${ROOT_ID} .cwbg-status.err { color: #e08a8a; }
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
                <label class="cwbg-ls">
                    <input type="checkbox" class="cwbg-ls-check">
                    <span>взять картинку из ЛС</span>
                </label>
                <div class="cwbg-lsrow">
                    <div class="cwbg-status"></div>
                </div>
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
        const input = root.querySelector('input[type="text"]');
        const preview = root.querySelector('.cwbg-preview');
        const lsCheck = root.querySelector('.cwbg-ls-check');
        const lsRow = root.querySelector('.cwbg-lsrow');
        const status = root.querySelector('.cwbg-status');

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

        function setStatus(text, isError) {
            status.textContent = text || '';
            status.classList.toggle('err', !!isError);
        }

        lsCheck.addEventListener('change', () => {
            lsRow.classList.toggle('open', lsCheck.checked);
        });

        input.addEventListener('input', updatePreview);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') onApply();
        });

        async function onApply() {
            if (lsCheck.checked) {
                setStatus('Ищу картинку в ЛС…');
                try {
                    const res = await fetchImageFromLs(LS_SENDER);
                    input.value = res.url;
                    updatePreview();
                    apply(res.url);
                    setStatus('Взято из ЛС: ' + res.dialog.login + ' («' + res.dialog.subject + '»)');
                } catch (e) {
                    setStatus('Не получилось: ' + (e && e.message ? e.message : e), true);
                }
                return;
            }
            apply(input.value.trim());
        }

        root.querySelector('.cwbg-act').addEventListener('click', () => {
            onApply();
        });
        root.querySelector('.cwbg-reset').addEventListener('click', () => {
            input.value = '';
            updatePreview();
            setStatus('');
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
