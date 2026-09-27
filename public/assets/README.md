# Ассеты игры (runtime assets)

Эта папка (`public/assets/`) — **единственное место для файлов, которые Phaser
загружает во время выполнения** (картинки, спрайты, звук, шрифты).

Почему именно `public/`: содержимое этой папки копируется в `dist/` **без
хеширования имён** и с сохранением структуры. Поэтому путь в коде
(`this.load.image('bg', 'assets/images/backgrounds/bg.png')`) совпадает с путём
в собранном приложении и корректно работает в Capacitor (Android/iOS).

> Не используйте `import bg from './bg.png'` из `src/` для Phaser-загрузчика —
> Vite переименует файл с хешем, и рантайм-путь сломается.

## Правила путей

- Всегда **относительные** пути, без ведущего `/`:
  - ✅ `assets/images/ui/button.png`
  - ❌ `/assets/images/ui/button.png`
- Ведущий слэш ломает загрузку в нативной сборке Capacitor.

## Структура

```
assets/
├── images/                 # статичные картинки
│   ├── backgrounds/        # фоны сцен и уровней
│   ├── ui/                 # кнопки, панели, иконки интерфейса
│   └── levels/             # иллюстрации конкретных уровней
├── sprites/                # отдельные спрайты (если не упакованы в атлас)
│   ├── characters/         # персонажи
│   └── items/              # предметы, фигуры, награды
├── atlases/                # texture atlas: *.png + *.json (рекомендуется)
├── audio/
│   ├── music/              # фоновая музыка (длинные треки)
│   └── sfx/                # короткие звуки (клики, победа и т.п.)
├── audiosprites/           # аудио-спрайт: один файл на набор звуков
├── fonts/                  # bitmap/webfont файлы (если не системный шрифт)
└── localization/           # языко-зависимые ассеты
    ├── ru/
    └── en/
```

## Что где хранить

| Тип                      | Папка                         | Как грузить                                            |
| ------------------------ | ----------------------------- | ------------------------------------------------------ |
| Фон                      | `images/backgrounds/`         | `this.load.image('bg', 'assets/images/backgrounds/bg.png')` |
| Иконка/кнопка UI         | `images/ui/`                  | `this.load.image(...)`                                 |
| Спрайты (много)          | `atlases/`                    | `this.load.atlas('game', 'assets/atlases/game.png', 'assets/atlases/game.json')` |
| Музыка                   | `audio/music/`                | `this.load.audio('bgm', 'assets/audio/music/bgm.mp3')` |
| Короткий звук            | `audio/sfx/`                  | `this.load.audio('click', 'assets/audio/sfx/click.mp3')` |
| Набор звуков             | `audiosprites/`               | `this.load.audioSprite('sfx', 'assets/audiosprites/sfx.json', [...])` |
| Озвучка/тексты по языку  | `localization/<lang>/`        | `assets/localization/${getLanguage()}/...`             |

## Рекомендации

- **Спрайты** — пакуйте в атлас (TexturePacker / free-tex-packer).
  1 HTTP-запрос вместо десятков + меньше памяти на мобилках.
- **Звук** — для iOS нужен `.m4a`/`.aac`, для web/Android — `.ogg`/`.mp3`.
  Передавайте массив источников — Phaser выберет поддерживаемый формат.
- **Локализация** — держите языко-независимые ассеты общими, а зависящие от
  языка (озвучка цифр/букв, подписи-картинки) кладите в `localization/<lang>/`
  и грузите с учётом `getLanguage()`.
- **Большие игры** — грузите ассеты **поуровнево** в `GameScene.preload()`,
  а не всё сразу в `PreloadScene`: это ускоряет запуск.
- **Размер** — следите за общим весом (держите разумно, ориентир < 100–200 МБ).
