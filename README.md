# CatWar: смена фона игры

Userscript: плавающая кнопка на игровой странице — вставь ссылку на картинку, и фон игры заменится на неё.

- Работает на `catwar.su/cw3` и `catwar.net/cw3`.
- Фон сохраняется между обновлениями страницы (localStorage).
- Кнопка «Сбросить» возвращает исходный фон.

## Установка

1. Поставь юзерскрипт-менеджер (Violentmonkey / Tampermonkey / Greasemonkey).
2. Открой https://cw-mod.github.io/game-bg-changer/ и нажми «Установить»
   (или напрямую файл: https://cw-mod.github.io/game-bg-changer/catwar-game-bg.user.js).

## Файлы

| Файл | Назначение |
|---|---|
| `catwar-game-bg.user.js` | сам скрипт |
| `catwar-game-bg.meta.js` | метаданные для автообновления |
| `index.html` | посадочная страница (GitHub Pages) |
