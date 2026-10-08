
# Kids Educational Game - Sky Bounty: Catch The Treasure


Детская обучающая игра для Android и iOS.
Стек: **TypeScript + Phaser 3 + Capacitor + Vite**.
Ориентация: **ландшафт (горизонтальная)**.

## Требования

- Node.js 20+ (рекомендуется 22/24)
- Для Android: Android Studio, JDK 17+
- Для iOS (только macOS): Xcode 15+

## Быстрый старт

```bash
npm install

# запуск в браузере для разработки
npm run dev
```

Открой http://localhost:5173 — игра запустится в браузере (web-режим Capacitor).

> Если `npm install` падает с ошибкой прав на `~/.npm`, выполните один раз:
> `sudo chown -R 501:20 "$HOME/.npm"`. Либо используйте временный кэш:
> `npm install --cache ./.npm-cache`.

## Структура проекта

```
src/
├── main.ts                     # точка входа: initCapacitor -> оверлей -> Phaser.Game
├── native/
│   └── capacitor.ts            # ландшафт, keep-awake (нативная инициализация)
├── ui/
│   └── orientationOverlay.ts   # DOM-подсказка «поверните устройство» (web)
└── game/
    ├── config.ts               # конфиг Phaser (1280x720, сцены, физика)
    ├── theme.ts                # палитра и шрифты
    ├── i18n.ts                 # локализация (RU/EN): t(), setLanguage()
    ├── safeArea.ts             # безопасная зона (brow/скругления)
    ├── layout.ts               # адаптивная сетка
    ├── progress.ts             # сохранение прогресса
    ├── ui/
    │   └── Button.ts           # переиспользуемая кнопка
    └── scenes/
        ├── BootScene.ts        # первичная инициализация/заглушки
        ├── PreloadScene.ts     # загрузка ассетов + прогресс-бар
        ├── MenuScene.ts        # главное меню
        ├── LevelSelectScene.ts # выбор уровня (горизонтальная сетка)
        ├── GameScene.ts        # игровая механика (drag & drop)
        └── SettingsScene.ts    # настройки (выбор языка RU/EN)
public/assets/                  # изображения, звуки, шрифты (см. раздел «Ассеты»)
```

## Ориентация экрана (ландшафт)

Игра рассчитана на горизонтальное положение устройства. Логическое поле — **1280×720**,
масштабируется через `Scale.FIT`.

- **Нативная блокировка:** плагин `@capacitor/screen-orientation` фиксирует ландшафт
  (`src/native/capacitor.ts`).
- **Web-режим:** ориентацию браузером заблокировать нельзя, поэтому при портретном
  экране показывается оверлей «Поверните устройство» (`src/ui/orientationOverlay.ts`).
- **Android (вручную):** в `android/app/src/main/AndroidManifest.xml` в теге `<activity>`:
  `android:screenOrientation="sensorLandscape"`.
- **iOS (вручную):** Xcode → Target → General → Deployment Info: оставить только
  Landscape Left / Landscape Right.

## Безопасная зона (safe area)

На ландшафтных экранах с «бровью»/динамическим островом UI у краёв может заезжать
под вырез или скругления. Решение:

1. `index.html` содержит скрытый элемент `#safe-area-probe` с CSS
   `env(safe-area-inset-*)`.
2. `src/game/safeArea.ts` считывает эти значения и переводит в логические
   координаты Phaser (с учётом масштаба канваса).
3. В сценах используется **`getSafeBounds(scale)`** — прямоугольник игровой
   площади без опасных краёв. Размещайте UI внутри него.

```ts
const bounds = getSafeBounds(this.scale, 32);
btn.setPosition(bounds.x + 50, bounds.y + 50);
```

## Адаптивная раскладка

Модуль `src/game/layout.ts` строит сетку под доступную (безопасную) площадь с
подбором числа колонок:

```ts
const cells = buildGrid(this, LEVEL_COUNT, {
  maxColumns: 4,
  maxRows: 3,
  padding: 32,
  gap: 24,
});
cells.forEach((cell) => { /* cell.x, cell.y, cell.width, cell.height */ });
```

Сетка сама центрируется, ограничивает вытянутость ячеек и работает на любых
размерах экрана.

## Экран выбора уровня

`LevelSelectScene` — горизонтальная сетка карточек. Пройденные уровни показывают
звёзды, заблокированные — замок. Прогресс хранится в `src/game/progress.ts`
(localStorage; позже заменяется на `@capacitor/preferences`).

## Настройки и локализация (RU/EN)

- `src/game/i18n.ts` — модуль локализации без внешних зависимостей:
  `t('menu.play')` возвращает строку текущего языка, `setLanguage('en')` меняет
  язык (сохраняется в `localStorage`), `onLanguageChange(cb)` — подписка на смену.
- `SettingsScene` — экран настроек с выбором языка (открывается из главного меню).
- Язык по умолчанию: сохранённый → язык браузера → английский.
- Чтобы добавить язык: расширьте тип `Language`, массив `LANGUAGES` и словарь
  `DICTIONARIES` в `i18n.ts` — экран настроек построит кнопки автоматически.

## Ассеты (картинки, спрайты, звук)

Все рантайм-ассеты лежат в **`public/assets/`**. Именно `public/`, а не `src/`:
содержимое копируется в `dist/` без хеширования имён, поэтому путь в коде
совпадает с путём в собранном приложении и корректно работает в Capacitor.

```
public/assets/
├── images/
│   ├── backgrounds/   # фоны
│   ├── ui/            # кнопки, панели, иконки
│   └── levels/        # иллюстрации уровней
├── sprites/
│   ├── characters/    # персонажи
│   └── items/         # предметы, фигуры
├── atlases/           # texture atlas: *.png + *.json (рекомендуется)
├── audio/
│   ├── music/         # фоновая музыка
│   └── sfx/           # короткие звуки
├── audiosprites/      # аудио-спрайты (наборы звуков)
├── fonts/             # bitmap/webfont
└── localization/
    ├── ru/            # озвучка/тексты (русский)
    └── en/            # озвучка/тексты (английский)
```

Подробности — в `public/assets/README.md`.

### Как загружать

Пути всегда **относительные, без ведущего `/`** (иначе ломается нативная сборка):

```ts
// в PreloadScene.loadAssets() (src/game/scenes/PreloadScene.ts)
this.load.image('background', 'assets/images/backgrounds/background.png');
this.load.atlas('game', 'assets/atlases/game.png', 'assets/atlases/game.json');
this.load.audio('click', 'assets/audio/sfx/click.mp3');
```

### Локализованные ассеты

Языко-независимые ассеты (фоны, спрайты) — общие. Зависящие от языка (озвучка
цифр/букв, подписи-картинки) кладите в `localization/<lang>/` и грузите с учётом
текущего языка:

```ts
import { getLanguage } from './i18n';
const lang = getLanguage();
this.load.audio('voice_0', `assets/localization/${lang}/voice_0.mp3`);
```

### Рекомендации

- **Спрайты** пакуйте в атлас (TexturePacker / free-tex-packer): 1 запрос вместо
  десятков и меньше памяти на мобилках.
- **Звук**: для iOS — `.m4a`/`.aac`, для web/Android — `.ogg`/`.mp3`. Передавайте
  массив источников — Phaser выберет поддерживаемый формат.
- **Большие игры**: грузите ассеты поуровнево в `GameScene.preload()`, а не всё
  сразу в `PreloadScene`, — это ускоряет старт.

## Сборка и добавление платформ

```bash
npm run build

# Android (первый раз создаёт папку android/)
npx cap add android
npm run cap:android        # сборка + синхронизация + Android Studio

# iOS (только macOS)
npx cap add ios
npm run cap:ios
```

После изменений в коде: `npm run cap:sync`, затем пересборка в Android Studio / Xcode.

## Рекомендуемые плагины Capacitor

```bash
npm i @capacitor/screen-orientation   # фиксация ландшафта (уже стоит)
npm i @capacitor/keep-awake           # экран не гаснет
npm i @capacitor/status-bar           # скрыть статус-бар
npm i @capacitor/haptics              # вибрация на ответах
npm i @capacitor/preferences          # нативное хранилище прогресса
npm i @capacitor-community/text-to-speech  # озвучка (для обучения)
```

## Полезно знать

- `base: './'` в `vite.config.ts` обязателен для Capacitor (относительные пути).
- Игровое поле `1280×720` с `Scale.FIT` масштабируется под любые экраны.
- Размеры шрифтов/кнопок крупные — под детские пальцы.


- Phaser вынесен в отдельный чанк через `manualChunks` (`vite.config.ts`). Это
  разделяет движок (~1.48 MB) и код игры (~20 kB): при обновлении игры чанк
  Phaser берётся из кэша и не перезагружается, а предупреждение о размере
  бандла не выводится.

## Дальнейшие шаги

- [ ] Реальные ассеты (картинки, звуки, обучающие задания)
- [x] Настройки (экран выбора языка)
- [x] Локализация (RU/EN)
- [ ] Звуковое сопровождение заданий (TTS)
- [ ] Нативное хранилище прогресса (`@capacitor/preferences`)


