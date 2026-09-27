/**
 * Загрузка веб-шрифтов.
 *
 * Phaser рендерит текст на canvas, поэтому браузер должен загрузить веб-шрифт
 * ДО первого рендера текста. Иначе первый кадр отрисуется системным фолбэком,
 * и только после его загрузки текст «переключится» на нужный шрифт — заметный
 * визуальный скачок.
 *
 * Шрифт регистрируем программно через FontFace API (а не через @font-face в
 * inline-<style> в index.html), чтобы URL корректно строился от
 * import.meta.env.BASE_URL. Относительный путь в CSS ломается, когда игра
 * отдаётся под вложенным путём (например /auth/...): тогда assets/... резолвится
 * относительно текущего URL, а не корня сайта, и шрифт не загружается.
 */

/** Семейство декоративного шрифта (должно совпадать с FONTS.dynaPuff). */
const FONT_FAMILY = 'DynaPuff';

/** Относительный путь к файлу шрифта внутри public/. */
const FONT_FILE = 'assets/fonts/DynaPuff-VariableFont_wdth,wght.ttf';

/** Шрифты, которые регистрируем и предзагружаем. */
const FONT_SPECS = ['bold 32px "DynaPuff"', '32px "DynaPuff"'] as const;

/** Регистрируем @font-face один раз за время жизни страницы. */
let registered = false;

/**
 * Регистрирует декоративный шрифт через FontFace API.
 * URL строится от base-пути приложения, поэтому работает и в dev (base '/'),
 * и в собранном приложении/Capacitor (base './').
 */
function registerFont(): void {
  if (registered) return;
  registered = true;
  const fontFaces = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fontFaces || typeof FontFace === 'undefined') return;

  // import.meta.env.BASE_URL всегда заканчивается на '/' ('./' в build).
  const url = `${import.meta.env.BASE_URL}${FONT_FILE}`;
  try {
    const face = new FontFace(FONT_FAMILY, `url("${url}") format("truetype")`, {
      weight: '400 900',
      display: 'swap',
    });
    fontFaces.add(face);
  } catch {
    // Ошибка регистрации не критична — останется системный фолбэк.
  }
}

/**
 * Ждёт загрузку всех веб-шрифтов игры.
 * Если Font Loading API недоступен — резолвится сразу (мягкая деградация).
 */
export async function ensureFontsLoaded(): Promise<void> {
  registerFont();

  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts?.load) return;

  try {
    await Promise.all(FONT_SPECS.map((spec) => fonts.load(spec)));
    // Даём браузеру применить загруженные шрифты к раскладке.
    await fonts.ready;
  } catch {
    // Ошибки загрузки шрифта не критичны — используем фолбэк.
  }
}

