/**
 * Разрешение путей к ассетам.
 *
 * Phaser при `load.image(key, path)` с относительным путём резолвит его
 * относительно URL документа (window.location), а НЕ относительно корня
 * сборки. Это ломается, когда игра открыта не с корня сайта: Capacitor
 * (capacitor://localhost / https://localhost), глубокие ссылки, iframe и т.п.
 *
 * `import.meta.env.BASE_URL` задан в vite.config.ts как './'. Приводим путь
 * к виду, который корректно резолвится в dev, в dist/ и в нативной сборке.
 */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || './';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  return cleanBase + path.replace(/^\//, '');
}
